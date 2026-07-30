/**
 * Build-time brand variant selection (R85B).
 *
 * One codebase, deployment-selected at BUILD time via the inlined public env var
 * `NEXT_PUBLIC_APP_BRAND_VARIANT`:
 *   - unset / "" / "gyeon-classic" -> GYEON CLASSIC (default: this is a
 *                                     GYEON-first application today)
 *   - "obsidian"                   -> OBSIDIAN      (neutral SaaS brand)
 *   - any other value              -> throws here, failing `next build` closed.
 *
 * No host, tenant, database, middleware, or authorization-flag resolution.
 */

export type BrandVariant = "obsidian" | "gyeon-classic";

function resolveBrandVariant(raw: string | undefined): BrandVariant {
  if (raw === undefined || raw === "" || raw === "gyeon-classic") return "gyeon-classic";
  if (raw === "obsidian") return "obsidian";
  throw new Error(
    `Invalid NEXT_PUBLIC_APP_BRAND_VARIANT="${raw}". ` +
      `Expected unset, "gyeon-classic", or "obsidian".`,
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

/**
 * Every brand image is an EXPLICIT path. Nothing here is assembled from a shared
 * filename or a shared extension, because the two variants legitimately ship
 * different formats: GYEON Classic supplies SVG artwork, OBSIDIAN supplies PNG.
 * `wordmark` is null when a variant has no standalone wordmark asset.
 */
export interface BrandAssets {
  applicationIcon: string;
  sidebarBadge: string;
  wordmark: string | null;
  heroLockup: string;
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
  /** Short label shown beside the hero lockup. Never the full product name. */
  heroLabel: string;
  assets: BrandAssets;
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
    heroLabel: "DETAILER AGENT",
    logo: { combination: "/brand/obsidian/logos/combination.svg", width: 1400, height: 360 },
    assets: {
      applicationIcon: "/brand/obsidian/app-icons/master-square.png",
      sidebarBadge:    "/brand/obsidian/app-icons/master-square.png",
      wordmark:        null,
      heroLockup:      "/brand/obsidian/logos/combination.svg",
    },
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
    heroLabel: "DETAILER AGENT",
    logo: { combination: "/brand/gyeon-classic/logos/combination.svg", width: 1400, height: 400 },
    assets: {
      // Raster artwork only for the rendered home slots: an <img>-referenced SVG is
      // font-sandboxed, so any live-text SVG would fall back to system fonts.
      applicationIcon: "/brand/gyeon-classic/app-icons/square/icon-1024.png",
      sidebarBadge:    "/brand/gyeon-classic/app-icons/square/icon-1024.png",
      wordmark:        null,
      heroLockup:      "/brand/gyeon-classic/logos/gyeon-wordmark.png",
    },
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

// ─── Desktop-home iframe brand contract ──────────────────────────────────────

export interface BrandAsset {
  /** Same-origin public path under `/brand/<variant>/`. */
  src: string;
  alt: string;
}

/**
 * The exact contract the static desktop home (`/desktop-home.html`) receives.
 *
 * HOME SURFACE ONLY. Authentication screens read BRAND directly through
 * `<Brand>`, and the sidebar and hero wordmarks are transported *text*, not
 * images, so this payload deliberately carries no auth or wordmark asset field.
 *
 * The static file holds no per-brand text and no per-brand asset path: every
 * value it renders arrives here, derived from the canonical configuration above.
 */
export interface HomeBrandPayload {
  version: 1;
  variant: BrandVariant;
  name: string;
  shortName: string;
  labelTop: string;
  labelBottom: string;
  showRegisteredMark: boolean;
  /** Hero caption. Deliberately NOT the full name: the lockup already carries it. */
  heroLabel: string;
  sidebarBadge: BrandAsset | null;
  wordmark: BrandAsset | null;
  heroLockup: BrandAsset | null;
}

/**
 * Pure derivation — no environment read, no I/O, no mutation. Brand resolution
 * (and its fail-closed throw on an invalid variant) stays entirely in
 * `resolveBrandVariant` above; this only projects an already-resolved config.
 *
 * Every asset path is read verbatim from `brand.assets`. Nothing is assembled
 * from a shared filename, so the two variants may ship different formats.
 */
export function deriveHomeBrandPayload(brand: BrandConfig = BRAND): HomeBrandPayload {
  const asset = (src: string | null): BrandAsset | null =>
    src === null ? null : { src, alt: `${brand.name} logo` };

  return {
    version: 1,
    variant:   brand.variant,
    name:      brand.name,
    shortName: brand.shortName,
    labelTop:  brand.labelTop,
    labelBottom: brand.labelBottom,
    // The registered mark belongs to the GYEON trademark and must never render
    // for the neutral product brand.
    showRegisteredMark: brand.variant === "gyeon-classic",
    heroLabel: brand.heroLabel,
    sidebarBadge: asset(brand.assets.sidebarBadge),
    wordmark:     asset(brand.assets.wordmark),
    heroLockup:   asset(brand.assets.heroLockup),
  };
}
