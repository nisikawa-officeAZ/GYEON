// Estimate Completion Sprint 1 — Japanese-capable font registration for all PDF
// templates.
//
// @react-pdf/renderer's built-in fonts (Helvetica/Times/Courier) contain NO CJK glyphs,
// so Japanese text renders blank. This module registers a Japanese font family used by
// every template. The font sources are env-overridable (PDF_JP_FONT_URL /
// PDF_JP_FONT_BOLD_URL) so production can point at a verified or self-hosted TTF/WOFF
// (recommended) without code changes; the defaults are Noto Sans JP (japanese subset).
//
// Registration is idempotent and fail-safe: a registration error is logged but never
// throws at import time (a missing/unreachable font surfaces as a caught render error in
// generate-*-pdf.ts, not a crash). No schema, no network at build time.

import { Font } from "@react-pdf/renderer";

const REGULAR_URL =
  process.env.PDF_JP_FONT_URL ??
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.18/files/noto-sans-jp-japanese-400-normal.woff";

const BOLD_URL =
  process.env.PDF_JP_FONT_BOLD_URL ??
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.18/files/noto-sans-jp-japanese-700-normal.woff";

export const PDF_FONT_FAMILY      = "NotoSansJP";
export const PDF_FONT_FAMILY_BOLD = "NotoSansJP-Bold";

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  try {
    Font.register({ family: PDF_FONT_FAMILY,      src: REGULAR_URL });
    Font.register({ family: PDF_FONT_FAMILY_BOLD, src: BOLD_URL });
    // CJK text has no word boundaries to hyphenate — keep words intact.
    Font.registerHyphenationCallback((word) => [word]);
    registered = true;
  } catch (err) {
    console.error("[registerPdfFonts] registration failed:", err);
  }
}
