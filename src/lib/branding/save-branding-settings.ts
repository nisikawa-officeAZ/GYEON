"use server";

// Server Actions — load and persist dealer branding settings.
//
// Security:
//   - getBrandingSettings(): dealer_id from getCurrentDealer() (read).
//   - saveBrandingSettings(): dealer_id from requireRole(["owner","manager"]).
//   - dealer_id is NEVER accepted from client input.
//
// Branding manages ONLY: logo, stamp, primary/secondary/accent colours, and the
// (future) customer-app theme. Store-profile fields live in saveCompanySettings.

import { revalidatePath }    from "next/cache";
import { createClient }      from "@/lib/supabase/server";
import { getCurrentDealer }  from "@/lib/auth/get-current-dealer";
import { requireRole }       from "@/lib/staff/require-role";
import {
  EMPTY_BRANDING,
  normalizeHexColor,
  type BrandingSettings,
  type CustomerAppTheme,
} from "./branding-types";

const SELECT_COLS =
  "logo_path, stamp_path, logo_url, stamp_url, brand_primary_color, brand_secondary_color, brand_accent_color, customer_app_theme";

export async function getBrandingSettings(): Promise<BrandingSettings | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select(SELECT_COLS)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) {
      console.error("[getBrandingSettings] error:", error);
      return null;
    }
    if (!data) return { ...EMPTY_BRANDING };

    const row = data as Record<string, unknown>;
    return {
      logo_path:             (row.logo_path             as string | null) ?? null,
      stamp_path:            (row.stamp_path            as string | null) ?? null,
      logo_url:              (row.logo_url              as string | null) ?? null,
      stamp_url:             (row.stamp_url             as string | null) ?? null,
      brand_primary_color:   (row.brand_primary_color   as string | null) ?? null,
      brand_secondary_color: (row.brand_secondary_color as string | null) ?? null,
      brand_accent_color:    (row.brand_accent_color    as string | null) ?? null,
      customer_app_theme:    (row.customer_app_theme    as CustomerAppTheme | null) ?? null,
    };
  } catch (err) {
    console.error("[getBrandingSettings] failed:", err);
    return null;
  }
}

const VALID_THEMES: CustomerAppTheme[] = ["system", "light", "dark"];

export async function saveBrandingSettings(
  fd: FormData,
): Promise<{ error: string } | { success: true }> {
  try {
    const { dealerId } = await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const str = (k: string) => (fd.get(k) as string | null)?.trim() || null;

    const themeRaw = str("customer_app_theme");
    const theme: CustomerAppTheme | null =
      themeRaw && VALID_THEMES.includes(themeRaw as CustomerAppTheme)
        ? (themeRaw as CustomerAppTheme)
        : null;

    const payload = {
      dealer_id:             dealerId,
      // Storage paths (canonical) + resolved public URLs (for existing consumers)
      logo_path:             str("logo_path"),
      stamp_path:            str("stamp_path"),
      logo_url:              str("logo_url"),
      stamp_url:             str("stamp_url"),
      // Palette (validated hex)
      brand_primary_color:   normalizeHexColor(str("brand_primary_color")),
      brand_secondary_color: normalizeHexColor(str("brand_secondary_color")),
      brand_accent_color:    normalizeHexColor(str("brand_accent_color")),
      // Future customer-app theme
      customer_app_theme:    theme,
      updated_at:            new Date().toISOString(),
    };

    const { error } = await supabase
      .from("dealer_settings")
      .upsert(payload, { onConflict: "dealer_id" });

    if (error) {
      console.error("[saveBrandingSettings] error:", error);
      return { error: error.message };
    }

    revalidatePath("/settings/branding");
    return { success: true };
  } catch (err) {
    console.error("[saveBrandingSettings] failed:", err);
    const msg = err instanceof Error ? err.message : "保存に失敗しました";
    return { error: msg };
  }
}
