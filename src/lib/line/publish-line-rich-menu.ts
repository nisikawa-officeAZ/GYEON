"use server";

// DealerOS — Publish LINE Rich Menu
// Creates rich menu via LINE Messaging API, uploads PNG template, sets as default.
// Security:
//   - dealer_id from requireRole → getCurrentDealer() — never from client
//   - requireRole(["owner","manager"]) enforced server-side (Sprint 12L)
//   - line_access_token read server-side only — never returned to client
//   - Pro+ feature gate enforced before any LINE API call

import { createClient }            from "@/lib/supabase/server";
import { requireRole }             from "@/lib/staff/require-role";
import { checkFeatureAccess }      from "@/lib/plans/can-use-feature";
import { generateRichMenuPng }     from "./generate-rich-menu-png";
import { getFirstValidationError } from "./validate-rich-menu-config";
import type { LineRichMenuConfig, RichMenuButton } from "./line-rich-menu-types";

const LINE_API = "https://api.line.me/v2/bot";

// ─── LINE API types ───────────────────────────────────────────────────────────

interface LineArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: string; uri?: string; text?: string; data?: string };
}

interface LineRichMenuBody {
  size:        { width: number; height: number };
  selected:    boolean;
  name:        string;
  chatBarText: string;
  areas:       LineArea[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAction(btn: RichMenuButton, liffId: string | null): LineArea["action"] {
  switch (btn.action_type) {
    case "message":
      if (btn.message) return { type: "message", text: btn.message };
      break;
    case "liff":
      if (btn.liff_path && liffId) {
        return { type: "uri", uri: `https://liff.line.me/${liffId}${btn.liff_path}` };
      }
      break;
    case "postback":
      if (btn.postback_data) {
        return { type: "postback", data: btn.postback_data };
      }
      break;
    case "uri":
    default:
      if (btn.uri) return { type: "uri", uri: btn.uri };
  }
  // Fallback: send button label as a message when no action is fully configured
  return { type: "message", text: btn.label };
}

function buildAreas(buttons: LineRichMenuConfig["buttons"], liffId: string | null): LineArea[] {
  const W = 2500, H = 1686;
  const colW = Math.floor(W / 3);
  const rowH = Math.floor(H / 2);

  return buttons.map((btn, i): LineArea => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      bounds: {
        x:      col * colW,
        y:      row * rowH,
        width:  col === 2 ? W - 2 * colW : colW,
        height: row === 1 ? H - rowH     : rowH,
      },
      action: buildAction(btn, liffId),
    };
  });
}

async function linePost(path: string, token: string, body?: unknown): Promise<Response> {
  return fetch(`${LINE_API}${path}`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function deleteRichMenuOnLine(id: string, token: string): Promise<void> {
  await fetch(`${LINE_API}/richmenu/${id}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ─── Main server action ───────────────────────────────────────────────────────

export async function publishLineRichMenu(
  config: LineRichMenuConfig,
): Promise<{ success: true; richMenuId: string } | { success: false; error: string }> {
  try {
    // Requires owner or manager — throws if role is insufficient or unauthenticated.
    // dealer_id is resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const hasAccess = await checkFeatureAccess("line_rich_menu");
    if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

    const validationError = getFirstValidationError(config);
    if (validationError) return { success: false, error: validationError };

    const supabase = await createClient();

    // Read LINE credentials — server-side only, never passed from client
    const { data: settings } = await supabase
      .from("dealer_settings")
      .select("line_access_token, line_liff_id, line_enabled, line_public_settings")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (!settings?.line_enabled) {
      return { success: false, error: "LINE連携が有効ではありません" };
    }
    if (!settings?.line_access_token) {
      return { success: false, error: "LINEアクセストークンが設定されていません" };
    }
    const token  = settings.line_access_token as string;
    const liffId = typeof settings.line_liff_id === "string" ? settings.line_liff_id : null;

    // Remove previous rich menu if one exists
    const existingPublic = (settings.line_public_settings as Record<string, unknown>) ?? {};
    const existingMenu   = (existingPublic.rich_menu as Record<string, unknown>) ?? {};
    const prevId = typeof existingMenu.rich_menu_id === "string" ? existingMenu.rich_menu_id : null;
    if (prevId) {
      await deleteRichMenuOnLine(prevId, token);
    }

    // 1. Create rich menu
    const menuBody: LineRichMenuBody = {
      size:        { width: 2500, height: 1686 },
      selected:    true,
      name:        "GYEON Detailer Agent メニュー",
      chatBarText: config.chat_bar_text || "メニュー",
      areas:       buildAreas(config.buttons, liffId),
    };

    const createRes = await linePost("/richmenu", token, menuBody);
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      return { success: false, error: `リッチメニュー作成エラー: ${err.message ?? createRes.status}` };
    }
    const { richMenuId } = await createRes.json() as { richMenuId: string };

    // 2. Generate and upload template PNG
    let png: Buffer;
    try {
      png = await generateRichMenuPng();
    } catch {
      await deleteRichMenuOnLine(richMenuId, token);
      return { success: false, error: "テンプレート画像の生成に失敗しました" };
    }

    const uploadRes = await fetch(`${LINE_API}/richmenu/${richMenuId}/content`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
      body:    new Uint8Array(png),
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({})) as { message?: string };
      await deleteRichMenuOnLine(richMenuId, token);
      return { success: false, error: `画像アップロードエラー: ${err.message ?? uploadRes.status}` };
    }

    // 3. Set as default for all users
    const setRes = await linePost(`/user/all/richmenu/${richMenuId}`, token);
    if (!setRes.ok) {
      const err = await setRes.json().catch(() => ({})) as { message?: string };
      await deleteRichMenuOnLine(richMenuId, token);
      return { success: false, error: `デフォルト設定エラー: ${err.message ?? setRes.status}` };
    }

    // 4. Persist richMenuId to DB
    const updatedPublic = {
      ...existingPublic,
      rich_menu: { ...config, rich_menu_id: richMenuId, enabled: true },
    };
    await supabase
      .from("dealer_settings")
      .update({ line_public_settings: updatedPublic, updated_at: new Date().toISOString() })
      .eq("dealer_id", dealerId);

    return { success: true, richMenuId };
  } catch (err) {
    console.error("[publishLineRichMenu] failed:", err);
    const msg = err instanceof Error ? err.message : "リッチメニューの公開に失敗しました";
    return { success: false, error: msg };
  }
}
