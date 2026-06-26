"use server";

// DealerOS — Save LINE Rich Menu Config
// Writes to dealer_settings.line_public_settings.rich_menu (PHASE70 jsonb column).
// Preserves existing rich_menu_id — only publishLineRichMenu sets/clears it.
// Security: dealer_id from getCurrentDealer() only — never from client.

import { createClient }            from "@/lib/supabase/server";
import { getCurrentDealer }        from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }      from "@/lib/plans/can-use-feature";
import { getFirstValidationError } from "./validate-rich-menu-config";
import type { LineRichMenuConfig } from "./line-rich-menu-types";

type SaveInput = Omit<LineRichMenuConfig, "rich_menu_id">;

export async function saveLineRichMenuConfig(
  config: SaveInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const hasAccess = await checkFeatureAccess("line_rich_menu");
  if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

  const validationError = getFirstValidationError(config);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();

  // Read current settings to preserve other keys and existing rich_menu_id
  const { data: current } = await supabase
    .from("dealer_settings")
    .select("line_public_settings")
    .eq("dealer_id", dealer.dealer_id)
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
    .eq("dealer_id", dealer.dealer_id);

  if (error) return { success: false, error: "設定の保存に失敗しました" };
  return { success: true };
}
