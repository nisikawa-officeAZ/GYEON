// Estimate Completion Sprint 1 follow-up — Local Japanese font hardening.
//
// @react-pdf/renderer's built-in fonts (Helvetica/Times/Courier) contain NO CJK glyphs,
// so Japanese text renders blank. This module registers a Japanese family used by every
// PDF template.
//
// Source preference (most reliable first):
//   1. Operator override via PDF_JP_FONT_URL / PDF_JP_FONT_BOLD_URL (explicit wins).
//   2. LOCAL bundled TrueType font (default) — M PLUS 1p (OFL; see fonts/OFL.txt),
//      read from disk so there is NO render-time network dependency. The font files are
//      bundled into the serverless function via next.config outputFileTracingIncludes.
//   3. CDN fallback (last resort) only if the bundled file is somehow absent.
//
// The family label is kept "NotoSansJP" so the templates need no change; the underlying
// bundled file is M PLUS 1p (full Japanese coverage, incl. kanji for customer names).
// Registration is idempotent and fail-safe (errors are logged, never thrown at import).

import { Font } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

const FONT_DIR      = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
const LOCAL_REGULAR = path.join(FONT_DIR, "MPLUS1p-Regular.ttf");
const LOCAL_BOLD    = path.join(FONT_DIR, "MPLUS1p-Bold.ttf");

const CDN_REGULAR =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.18/files/noto-sans-jp-japanese-400-normal.woff";
const CDN_BOLD =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.18/files/noto-sans-jp-japanese-700-normal.woff";

export const PDF_FONT_FAMILY      = "NotoSansJP";
export const PDF_FONT_FAMILY_BOLD = "NotoSansJP-Bold";

function resolveSrc(override: string | undefined, localPath: string, cdn: string): string {
  if (override) return override;                          // explicit operator override wins
  try {
    if (fs.existsSync(localPath)) return localPath;       // preferred: local bundled TTF
  } catch {
    /* fall through to CDN */
  }
  return cdn;                                             // last-resort fallback
}

let registered = false;

// ── CJK line breaking ────────────────────────────────────────────────────────
// react-pdf splits a run into "words" at script boundaries, so a Japanese sentence arrives here as
// several kanji/kana chunks with no spaces between them. Its layout engine treats every adjacent
// pair of such chunks as a *hyphenation point* and stamps a literal "-" into the text whenever it
// breaks there ("…有効期限は発行日から30日-/です。"). Returning [word] does not prevent that — the
// chunks are still adjacent boxes.
//
// The engine only breaks cleanly (no hyphen) at a *glue* node, which it creates for any syllable
// whose `.trim()` is empty. U+FEFF is the one such character that is both stripped by `trim()` and
// renders at zero width, so interleaving it between characters gives Japanese a break opportunity
// at every position while adding no visible space and no hyphen.
const ZWNBSP = "﻿";
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿＀-￯]/;
// 行頭禁則 — may not start a line.
const NO_LINE_START = "。、．，・：；？！)]｝〕〉》」』】’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶーゝゞ々…‥";
// 行末禁則 — may not end a line.
const NO_LINE_END = "([｛〔〈《「『【‘“";

function cjkBreakOpportunities(word: string): string[] {
  const chars = [...word];
  const out: string[] = [];
  chars.forEach((ch, i) => {
    out.push(ch);
    const next = chars[i + 1];
    if (next === undefined) return;
    if (NO_LINE_START.includes(next)) return; // would orphan 。、」 etc. to the next line
    if (NO_LINE_END.includes(ch)) return; // would strand 「（ etc. at the line end
    out.push(ZWNBSP);
  });
  return out;
}

export function registerPdfFonts(): void {
  if (registered) return;
  try {
    Font.register({
      family: PDF_FONT_FAMILY,
      src:    resolveSrc(process.env.PDF_JP_FONT_URL, LOCAL_REGULAR, CDN_REGULAR),
    });
    Font.register({
      family: PDF_FONT_FAMILY_BOLD,
      src:    resolveSrc(process.env.PDF_JP_FONT_BOLD_URL, LOCAL_BOLD, CDN_BOLD),
    });
    Font.registerHyphenationCallback((word) =>
      CJK.test(word) ? cjkBreakOpportunities(word) : [word],
    );
    registered = true;
  } catch (err) {
    console.error("[registerPdfFonts] registration failed:", err);
  }
}
