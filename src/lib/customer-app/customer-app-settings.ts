"use server";

// Customer App foundation — dealer-isolated config get/save.
//
// Security:
//   - getCustomerAppSettings(): dealer_id from getCurrentDealer().
//   - saveCustomerAppSettings(): dealer_id from requireRole(["owner","manager"]).
//   - dealer_id is NEVER accepted from client input; RLS scopes each row.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import {
  EMPTY_CUSTOMER_APP_SETTINGS, CUSTOMER_APP_THEMES,
  type CustomerAppSettings, type CustomerAppTheme,
} from "./customer-app-types";

export async function getCustomerAppSettings(): Promise<CustomerAppSettings> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { ...EMPTY_CUSTOMER_APP_SETTINGS };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customer_app_settings")
      .select("enabled, app_name, welcome_message, theme, points_enabled")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error || !data) return { ...EMPTY_CUSTOMER_APP_SETTINGS };
    const row = data as Record<string, unknown>;
    const theme = row.theme as CustomerAppTheme;
    return {
      enabled:         Boolean(row.enabled),
      app_name:        (row.app_name as string | null) ?? null,
      welcome_message: (row.welcome_message as string | null) ?? null,
      theme:           CUSTOMER_APP_THEMES.includes(theme) ? theme : "system",
      points_enabled:  Boolean(row.points_enabled),
    };
  } catch (err) {
    console.error("[getCustomerAppSettings] failed:", err);
    return { ...EMPTY_CUSTOMER_APP_SETTINGS };
  }
}

export async function saveCustomerAppSettings(
  fd: FormData,
): Promise<{ success: true } | { error: string }> {
  try {
    const { dealerId } = await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const str = (k: string) => (fd.get(k) as string | null)?.trim() || null;
    const themeRaw = str("theme") as CustomerAppTheme | null;
    const theme: CustomerAppTheme =
      themeRaw && CUSTOMER_APP_THEMES.includes(themeRaw) ? themeRaw : "system";

    const { error } = await supabase
      .from("customer_app_settings")
      .upsert({
        dealer_id:       dealerId,   // server-injected
        enabled:         fd.get("enabled") === "true",
        app_name:        str("app_name"),
        welcome_message: str("welcome_message"),
        theme,
        points_enabled:  fd.get("points_enabled") === "true",
        updated_at:      new Date().toISOString(),
      }, { onConflict: "dealer_id" });

    if (error) return { error: error.message };
    revalidatePath("/customer-app");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }
}
