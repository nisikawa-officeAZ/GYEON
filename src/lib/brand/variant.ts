/**
 * Build-time brand variant selection (R85B).
 *
 * One codebase, deployment-selected at BUILD time via the inlined public env var
 * `NEXT_PUBLIC_APP_BRAND_VARIANT`:
 *   - unset / "" / "obsidian"  -> OBSIDIAN      (default SaaS brand)
 *   - "gyeon-classic"          -> GYEON CLASSIC  (approved deployment brand)
 *   - any other value          -> throws here, failing `next build` closed.
 *
 * No host, tenant, database, middleware, or authorization-flag resolution.
 */

export type BrandVariant = "obsidian" | "gyeon-classic";

function resolveBrandVariant(raw: string | undefined): BrandVariant {
  if (raw === undefined || raw === "" || raw === "obsidian") return "obsidian";
  if (raw === "gyeon-classic") return "gyeon-classic";
  throw new Error(
    `Invalid NEXT_PUBLIC_APP_BRAND_VARIANT="${raw}". ` +
      `Expected unset, "obsidian", or "gyeon-classic".`,
  );
}

export const BRAND_VARIANT: BrandVariant = resolveBrandVariant(
  process.env.NEXT_PUBLIC_APP_BRAND_VARIANT,
);

export interface BrandFavicon {
  ico16: string;
  ico32: string;
  apple180: string;
  android192: string;
  android512: string;
  maskable512: string;
}

export interface BrandLogo {
  /** Public path to the combination lockup (symbol + full name). */
  combination: string;
  /** Intrinsic SVG viewBox dimensions, used to preserve aspect ratio. */
  width: number;
  height: number;
}

export interface BrandConfig {
  variant: BrandVariant;
  name: string;
  shortName: string;
  labelTop: string;
  labelBottom: string;
  description: string;
  colors: { background: string; accent: string; foreground: string };
  assetBase: string;
  logo: BrandLogo;
  favicon: BrandFavicon;
}

const CONFIGS: Record<BrandVariant, BrandConfig> = {
  obsidian: {
    variant: "obsidian",
    name: "Detailer Agent",
    shortName: "Detailer Agent",
    labelTop: "DETAILER",
    labelBottom: "AGENT",
    description: "Detailer Agent — a detailing OS for professionals",
    colors: { background: "#0A0A0A", accent: "#E4C97F", foreground: "#F2ECDC" },
    assetBase: "/brand/obsidian",
    logo: { combination: "/brand/obsidian/logos/combination.svg", width: 1400, height: 360 },
    favicon: {
      ico16: "/brand/obsidian/favicon/favicon-16.png",
      ico32: "/brand/obsidian/favicon/favicon-32.png",
      apple180: "/brand/obsidian/favicon/apple-touch-icon-180.png",
      android192: "/brand/obsidian/favicon/android-chrome-192.png",
      android512: "/brand/obsidian/favicon/android-chrome-512.png",
      maskable512: "/brand/obsidian/favicon/maskable-icon-512.png",
    },
  },
  "gyeon-classic": {
    variant: "gyeon-classic",
    name: "GYEON Detailer Agent",
    shortName: "GYEON DA",
    labelTop: "GYEON",
    labelBottom: "DETAILER AGENT",
    description: "GYEON Detailer Agent — Powered by GYEON",
    colors: { background: "#1f2945", accent: "#E4C97F", foreground: "#F2ECDC" },
    assetBase: "/brand/gyeon-classic",
    logo: { combination: "/brand/gyeon-classic/logos/combination.svg", width: 1400, height: 400 },
    favicon: {
      ico16: "/brand/gyeon-classic/favicon/favicon-16.png",
      ico32: "/brand/gyeon-classic/favicon/favicon-32.png",
      apple180: "/brand/gyeon-classic/favicon/apple-touch-icon-180.png",
      android192: "/brand/gyeon-classic/favicon/android-chrome-192.png",
      android512: "/brand/gyeon-classic/favicon/android-chrome-512.png",
      maskable512: "/brand/gyeon-classic/favicon/maskable-icon-512.png",
    },
  },
};

export const BRAND: BrandConfig = CONFIGS[BRAND_VARIANT];
