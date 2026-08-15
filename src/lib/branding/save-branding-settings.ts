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
import { isStampKind, type StampKind } from "@/lib/stamp/stamp-types";
import { BRANDING_SCHEMA_READY } from "@/lib/flags";

const SELECT_COLS =
  "logo_path, stamp_path, logo_url, stamp_url, stamp_kind, brand_primary_color, brand_secondary_color, brand_accent_color, customer_app_theme";
// While the branding schema isn't exposed by REST, only the pre-existing URL
// columns are safe to select; the rest would raise 42703.
const SELECT_COLS_FALLBACK = "logo_url, stamp_url";

export async function getBrandingSettings(): Promise<BrandingSettings | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select(BRANDING_SCHEMA_READY ? SELECT_COLS : SELECT_COLS_FALLBACK)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) {
      console.error("[getBrandingSettings] error:", error);
      return null;
    }
    if (!data) return { ...EMPTY_BRANDING };

    const row = data as unknown as Record<string, unknown>;
    return {
      logo_path:             (row.logo_path             as string | null) ?? null,
      stamp_path:            (row.stamp_path            as string | null) ?? null,
      logo_url:              (row.logo_url              as string | null) ?? null,
      stamp_url:             (row.stamp_url             as string | null) ?? null,
      stamp_kind:            isStampKind(row.stamp_kind) ? row.stamp_kind : null,
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
    // Branding columns are not yet exposed by production REST — refuse the write
    // gracefully instead of failing the upsert with PGRST204. No data is touched.
    if (!BRANDING_SCHEMA_READY) {
      return { error: "ブランディング設定は現在一時的に利用できません(スキーマ更新中)" };
    }
    const { dealerId } = await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const str = (k: string) => (fd.get(k) as string | null)?.trim() || null;

    const stampKindRaw = str("stamp_kind");
    const stampKind: StampKind | null = isStampKind(stampKindRaw) ? stampKindRaw : null;

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
      stamp_kind:            stampKind,
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
