"use server";

// DealerOS — Save LINE Rich Menu Config
// Writes to dealer_settings.line_public_settings.rich_menu (PHASE70 jsonb column).
// Preserves existing rich_menu_id — only publishLineRichMenu sets/clears it.
// Security:
//   - dealer_id from requireRole → getCurrentDealer() — never from client
//   - requireRole(["owner","manager"]) enforced server-side (Sprint 12L)
//   - Pro+ feature gate enforced via checkFeatureAccess

import { createClient }            from "@/lib/supabase/server";
import { requireRole }             from "@/lib/staff/require-role";
import { checkFeatureAccess }      from "@/lib/plans/can-use-feature";
import { getFirstValidationError } from "./validate-rich-menu-config";
import type { LineRichMenuConfig } from "./line-rich-menu-types";

type SaveInput = Omit<LineRichMenuConfig, "rich_menu_id">;

export async function saveLineRichMenuConfig(
  config: SaveInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Requires owner or manager — throws if role is insufficient or unauthenticated.
    // dealer_id is resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const hasAccess = await checkFeatureAccess("line_rich_menu");
    if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

    const validationError = getFirstValidationError(config);
    if (validationError) return { success: false, error: validationError };

    const supabase = await createClient();

    // Read current settings to preserve other keys and existing rich_menu_id
    const { data: current } = await supabase
      .from("dealer_settings")
      .select("line_public_settings")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    const currentPublic = (current?.line_public_settings as Record<string, unknown>) ?? {};
    const existingMenu  = (currentPublic.rich_menu as Record<string, unknown>) ?? {};
    const existingId    = typeof existingMenu.rich_menu_id === "string" ? existingMenu.rich_menu_id : null;

    const updated = {
      ...currentPublic,
      rich_menu: {
        ...config,
        rich_menu_id: existingId,
      },
    };

    const { error } = await supabase
      .from("dealer_settings")
      .update({ line_public_settings: updated, updated_at: new Date().toISOString() })
      .eq("dealer_id", dealerId);

    if (error) return { success: false, error: "設定の保存に失敗しました" };
    return { success: true };
  } catch (err) {
    console.error("[saveLineRichMenuConfig] failed:", err);
    const msg = err instanceof Error ? err.message : "設定の保存に失敗しました";
    return { success: false, error: msg };
  }
}
