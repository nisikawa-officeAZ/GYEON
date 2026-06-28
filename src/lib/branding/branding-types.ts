// Branding settings — shared types and constants.
//
// Pure module (no "use server", no DB). Safe to import from client or server.

import type { StampKind } from "@/lib/stamp/stamp-types";

export const BRANDING_BUCKET = "dealer-branding";

export type BrandingSlot = "logo" | "stamp";

export type CustomerAppTheme = "system" | "light" | "dark";

export interface BrandingSettings {
  // Internal Storage paths (canonical — never shown to the user as a URL field)
  logo_path:  string | null;
  stamp_path: string | null;
  // Resolved public URLs (for preview + existing consumers e.g. PDF)
  logo_url:   string | null;
  stamp_url:  string | null;
  // Stamp shape — drives standardized physical sizing in PDFs
  stamp_kind: StampKind | null;
  // Palette
  brand_primary_color:   string | null;
  brand_secondary_color: string | null;
  brand_accent_color:    string | null;
  // Future customer-app theme
  customer_app_theme: CustomerAppTheme | null;
}

export const EMPTY_BRANDING: BrandingSettings = {
  logo_path:             null,
  stamp_path:            null,
  logo_url:              null,
  stamp_url:             null,
  stamp_kind:            null,
  brand_primary_color:   null,
  brand_secondary_color: null,
  brand_accent_color:    null,
  customer_app_theme:    null,
};

/** Default palette — matches the GYEON dark-luxury direction. */
export const BRANDING_COLOR_DEFAULTS = {
  brand_primary_color:   "#1d4ed8",
  brand_secondary_color: "#0f172a",
  brand_accent_color:    "#4f8ef7",
} as const;

/** Server-generated storage path for a branding asset (never derived from client input). */
export function brandingStoragePath(dealerId: string, slot: BrandingSlot): string {
  return `${dealerId}/branding/${slot}.png`;
}

/** Loose hex-colour validation (#rgb or #rrggbb). Returns null if invalid. */
export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v.toLowerCase() : null;
}
