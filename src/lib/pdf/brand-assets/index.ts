// Document brand assets — PNG rasterisations of the approved concept-b SVG library.
//
// @react-pdf/renderer's <Image> decodes PNG/JPEG only; it cannot render an SVG `src`. The GenSpark
// package ships its logos, SNS icons, and QR placeholder as SVG, so each is rasterised here at 3×
// (print-safe at the sizes the documents draw them) and read from disk at render time — no network
// dependency, same approach as the bundled fonts. The files are bundled into the serverless function
// via next.config `outputFileTracingIncludes`.
//
// GYEON marks are fixed brand assets (never restyled). Everything tenant-specific — the shop logo —
// is NOT resolved here: it comes from Dealer Settings through BrandProfile.logoUrl. `demoShopLogo`
// exists purely so the fixtures can reproduce the concept-b mock; production must never use it.

import fs from "fs";
import path from "path";
import type { GyeonRank, SnsIcon } from "@/components/documents/types";

const DIR = path.join(process.cwd(), "src", "lib", "pdf", "brand-assets");

function asset(file: string): string | undefined {
  const p = path.join(DIR, file);
  try {
    return fs.existsSync(p) ? p : undefined;
  } catch {
    return undefined;
  }
}

/** GYEON wordmark (navy) — the Summary Invoice masthead lockup. */
export function gyeonWordmark(): string | undefined {
  return asset("gyeon-wordmark-navy.png");
}

/** GYEON rank logo (navy) for a dealer's store rank — the Summary Invoice footer lockup. */
export function gyeonRankLogo(rank: GyeonRank): string | undefined {
  return asset(`gyeon-rank-${rank}-navy.png`);
}

/** Monochrome SNS glyph shown above each QR slot. */
export function snsIcon(icon: SnsIcon): string | undefined {
  return asset(icon === "line" ? "sns-line-brand.png" : `sns-${icon}.png`);
}

/**
 * Placeholder QR artwork. Real QR generation (url → image) is still deferred — the approved mock
 * itself uses a placeholder, so this reproduces concept-b exactly until generation lands.
 */
export function qrPlaceholder(): string | undefined {
  return asset("qr-placeholder.png");
}

/** FIXTURES ONLY — the mock's tenant logo. Production shop logos come from Dealer Settings. */
export function demoShopLogo(): string | undefined {
  return asset("demo-shop-logo.png");
}
