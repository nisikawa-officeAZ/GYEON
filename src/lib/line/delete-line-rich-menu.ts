"use server";

// DealerOS — Delete LINE Rich Menu
// Removes the default rich menu from LINE and clears the stored ID.
// Security: dealer_id from getCurrentDealer() — never from client.

import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess } from "@/lib/plans/can-use-feature";

const LINE_API = "https://api.line.me/v2/bot";

export async function deleteLineRichMenu(): Promise<
  { success: true } | { success: false; error: string }
> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const hasAccess = await checkFeatureAccess("line_rich_menu");
  if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

  const supabase = await createClient();

  const { data } = await supabase
    .from("dealer_settings")
    .select("line_access_token, line_public_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!data?.line_access_token) {
    return { success: false, error: "LINE設定が見つかりません" };
  }
  const token          = data.line_access_token as string;
  const publicSettings = (data.line_public_settings as Record<string, unknown>) ?? {};
  const richMenu       = (publicSettings.rich_menu as Record<string, unknown>) ?? {};
  const richMenuId     = typeof richMenu.rich_menu_id === "string" ? richMenu.rich_menu_id : null;

  if (richMenuId) {
    // Remove as default for all users
    await fetch(`${LINE_API}/user/all/richmenu`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    // Delete the rich menu itself
    await fetch(`${LINE_API}/richmenu/${richMenuId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  // Clear rich_menu_id and set enabled=false in DB
  const updatedPublic = {
    ...publicSettings,
    rich_menu: { ...richMenu, rich_menu_id: null, enabled: false },
  };

  const { error } = await supabase
    .from("dealer_settings")
    .update({ line_public_settings: updatedPublic, updated_at: new Date().toISOString() })
    .eq("dealer_id", dealer.dealer_id);

  if (error) return { success: false, error: "DB更新エラー" };
  return { success: true };
}
