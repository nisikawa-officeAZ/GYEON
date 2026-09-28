// Vehicle Registration — deterministic PDF text-layer extraction of the four certificate codes.
//
// A 車検証 exported as a selectable PDF carries its text as a real text layer. For those files the
// 型式 / 原動機の型式 / 型式指定番号 / 類別区分番号 are read HERE, label-anchored and rule-based, and
// then override the AI output for exactly those four fields (see ocr.ts). Everything else about the
// certificate (owner, user, plate, dates, 車名, グレード…) is never touched by this module.
//
// Two label layouts are recognised, both anchored on an EXACT label:
//   (a) same row  — the value directly follows the label on the same visual line ("型式 6BA-ABC1");
//       a code glued to further text ("6BA-ABC1改") or directly followed by a separate modification
//       mark ("6BA-ABC1 改", whatever the gap pdf.js left between the two items) is never truncated
//       to its leading code — the whole candidate is rejected with a notice;
//   (b) two rows  — a row of labels followed by the IMMEDIATELY next visual row of values, where each
//       value sits inside its own label's horizontal column (from the label's left edge up to the next
//       token of the label row) with a small baseline distance. Values are never taken from a later
//       row, never from a neighbouring column, and a value that straddles two columns is rejected;
//       a value glued to further text or followed by a modification mark inside its own column is
//       rejected exactly like (a).
//       Only a label WITHOUT a same-row value takes part (per label): a label already resolved by (a)
//       is never re-interpreted against the next row, however close the rows are.
//
// Fail-closed by design:
//   - page 1 only, bounded bytes / time / item count; no other page is ever parsed;
//   - full-width characters are folded, leading zeros are preserved (values stay strings);
//   - a label counts only as a FIELD label: 「型式」 that merely ends compound text (「車両の型式」, 「この型式」,
//     …) is ordinary text in both rules — nothing is anchored on it, nothing rejected. The same holds when
//     the compound is letter-spaced like the labels themselves (「車両の 型 式」, 「新　型式」): a whitespace-
//     separated QUALIFIER from a small explicit list (新 / 元 / 前 / 現 / 後 / 従来 / 先代 / 当該 / この / その /
//     …の) directly before the label is the head of that compound. A modification mark (「改 型式」) never
//     affects a label;
//   - EXCEPT the 「旧型式」 annotation (glued or letter-spaced: 「旧 型 式」, 「旧　型式」, 「備考: 旧型式 X」): its
//     value is HISTORICAL 型式 evidence, never the current 型式 (T1 old-model rule). It is accepted only when
//     the same value also follows a clean 型式 label on page 1; an old-model-only 型式 is REJECTED with a
//     manual-entry notice (AI reading withheld, no provenance claimed) so the operator enters the current 型式
//     by hand, and distinct old-model / clean values remain an ambiguity rejection. 「旧」 before any OTHER
//     label (「旧型式指定番号」, 「旧原動機の型式」) stays ordinary compound text — only 型式 reaches the estimate;
//   - any OTHER Japanese text separated from a same-row 型式 label only by whitespace (「備考: 旧来 型 式 X」 —
//     but equally a 車名 cell 「車 名 ホンダ 型 式 X」: the two are indistinguishable without a vocabulary) makes
//     that 型式 candidate SUSPECT. It is accepted only when the same value also follows a clean 型式 label on
//     page 1; a suspect-only 型式 is rejected with a manual-entry notice (AI reading withheld, no provenance
//     claimed) instead of being trusted, and distinct suspect / clean values remain an ambiguity rejection;
//   - the 型式 the text layer applied is recorded as provenance (`model_text_layer`, its exact value) so the
//     identity policy can honour it downstream — and ONLY it (see resolveVehicleIdentity);
//   - ambiguous (several different values, including (a) and (b) disagreeing) or conflicting (same
//     value under two labels) matches are rejected with an operator-visible notice — nothing is
//     inferred or completed;
//   - every field whose labelled evidence was rejected is reported in `rejected`, and the AI reading
//     of THAT field is withheld by applyPdfTextLayerCertificateFields(): a value must never be shown
//     next to a notice asking the operator to enter that very field by hand;
//   - a missing text layer (scanned PDF), a non-PDF, a parse failure or a timeout yields NO fields,
//     so the existing OpenAI OCR path continues unchanged.
//
// Server-side only for the pdf.js loader (Node); the row/label functions are pure and test-covered.

import { foldVehicleCode, manualEntryNotice } from "./ocr-quality";
import type { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

export type CertificateCodeField = "model" | "engine_model" | "model_code" | "classification_number";

export const CERTIFICATE_CODE_FIELDS: readonly CertificateCodeField[] = [
  "model", "engine_model", "model_code", "classification_number",
];

const FIELD_LABELS: Record<CertificateCodeField, string> = {
  model:                 "型式",
  engine_model:          "原動機の型式",
  model_code:            "型式指定番号",
  classification_number: "類別区分番号",
};

/** Exact label text (after full-width folding and whitespace removal) → field. */
const FIELD_BY_EXACT_LABEL = new Map<string, CertificateCodeField>(
  CERTIFICATE_CODE_FIELDS.map((field) => [FIELD_LABELS[field], field]),
);

/** Minimal positional text item (pdf.js `TextItem` reduced to what the row grouping needs). */
export interface PdfTextItemLike {
  str:     string;
  x:       number;
  y:       number;
  width?:  number;
  height?: number;
}

export type PdfTextLayerStatus =
  | "extracted"    // ≥1 certificate code found with exact label anchoring
  | "no_codes"     // text layer present, but no unambiguous labelled code on page 1
  | "no_text"      // no text layer on page 1 (scanned / image-only PDF)
  | "not_pdf"      // empty input or no %PDF header
  | "too_large"    // over the byte bound — not parsed at all
  | "timeout"      // parsing exceeded the time bound
  | "parse_error"; // pdf.js could not parse the document

export interface PdfTextLayerExtraction {
  status:    PdfTextLayerStatus;
  fields:    Partial<Record<CertificateCodeField, string>>;
  /**
   * Fields for which page 1 DID carry a labelled value that was rejected (glued / modified text,
   * several different values, wrong shape, same value under two labels) → the notice explaining why.
   * Distinct from a field simply absent from the PDF: a rejected field must be entered by hand and the
   * AI reading of it is never shown. Always empty for non-text-layer statuses.
   */
  rejected:  Partial<Record<CertificateCodeField, string>>;
  notices:   string[];
  lineCount: number;
}

export const PDF_TEXT_LAYER_LIMITS = {
  maxBytes:  15 * 1024 * 1024, // upload-sized bound; larger files skip the text layer entirely
  timeoutMs: 8_000,
  maxItems:  4_000,
  maxLines:  400,
} as const;

/** Geometry bounds of the two-row (label row → value row) pairing. Points (PDF user space). */
export const PDF_TWO_ROW_GEOMETRY = {
  /** The value row's baseline may be at most this far below the label row, whatever the font size. */
  maxBaselineGapPt:    30,
  /** …and at least this far is always allowed (tiny fonts), capped by maxBaselineGapPt. */
  minBaselineGapPt:    12,
  /** Otherwise the allowed baseline gap is this multiple of the taller of label / value height. */
  baselineGapRatio:    3,
  /** Letter-spaced label pieces ("型 式") are merged when the gap is at most this × height. */
  labelPieceGapRatio:  1.5,
  /** Upper bound of pieces that may form one label. */
  maxLabelPieces:      6,
} as const;

export interface PdfTextLayerOptions {
  maxBytes?:  number;
  timeoutMs?: number;
  maxItems?:  number;
}

function empty(status: PdfTextLayerStatus, lineCount = 0): PdfTextLayerExtraction {
  return { status, fields: {}, rejected: {}, notices: [], lineCount };
}

// ─── Row / token reconstruction (pure) ───────────────────────────────────────

/** Items whose horizontal gap is at most this fraction of the line height are glued without a space. */
const GLUE_GAP_RATIO = 0.15;

/** One printed word: adjacent pdf.js items re-joined, with its horizontal extent and baseline. */
export interface PdfTextToken {
  str:    string;
  x0:     number;
  x1:     number; // x0 when the width is unknown
  y:      number;
  height: number; // 0 when unknown
}

const finitePositive = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Re-joins the items of one visual row into tokens (left-to-right). pdf.js often splits one printed
 * value into several items ("6BA-" + "ABC1"); adjacent items are glued, distant ones stay apart.
 */
export function tokenizePdfTextRow(row: readonly PdfTextItemLike[]): PdfTextToken[] {
  const ordered = [...row].sort((a, b) => a.x - b.x);
  const tokens: PdfTextToken[] = [];
  let prev: PdfTextItemLike | null = null;
  for (const item of ordered) {
    const width  = finitePositive(item.width);
    const height = finitePositive(item.height);
    const current = tokens[tokens.length - 1];
    if (prev !== null && current !== undefined) {
      const gap = typeof prev.width === "number" && Number.isFinite(prev.width)
        ? item.x - (prev.x + prev.width)
        : Number.POSITIVE_INFINITY;
      const h = Math.max(prev.height ?? 0, item.height ?? 0);
      const glueThreshold = h > 0 ? h * GLUE_GAP_RATIO : 1;
      if (gap <= glueThreshold) {
        current.str    += item.str;
        current.x1      = Math.max(current.x1, item.x + width);
        current.height  = Math.max(current.height, height);
        prev = item;
        continue;
      }
    }
    tokens.push({ str: item.str, x0: item.x, x1: item.x + width, y: item.y, height });
    prev = item;
  }
  return tokens;
}

function joinRowTokens(tokens: readonly PdfTextToken[]): string {
  return tokens.map((t) => t.str).join(" ").replace(/[\s　]+/g, " ").trim();
}

/** Groups positional items into visual rows (top-to-bottom). Each row keeps its items. */
function groupPdfTextItemsIntoRows(
  items: readonly PdfTextItemLike[],
  limits: { maxItems?: number; maxLines?: number } = {},
): PdfTextItemLike[][] {
  const maxItems = limits.maxItems ?? PDF_TEXT_LAYER_LIMITS.maxItems;
  const maxLines = limits.maxLines ?? PDF_TEXT_LAYER_LIMITS.maxLines;
  const usable = items
    .filter((it) => typeof it.str === "string" && it.str.trim() !== ""
      && Number.isFinite(it.x) && Number.isFinite(it.y))
    .slice(0, maxItems)
    .sort((a, b) => (b.y - a.y) || (a.x - b.x)); // PDF y grows upwards → descending y is top-first

  const rows: PdfTextItemLike[][] = [];
  for (const item of usable) {
    const current = rows[rows.length - 1];
    if (current !== undefined) {
      const height = Math.max(current[0].height ?? 0, item.height ?? 0);
      const tolerance = Math.max(2, height * 0.5);
      if (Math.abs(current[0].y - item.y) <= tolerance) { current.push(item); continue; }
    }
    if (rows.length >= maxLines) break;
    rows.push([item]);
  }
  return rows;
}

/**
 * Groups positional text items into visual lines (top-to-bottom, left-to-right) as plain strings.
 * Adjacent split items are re-joined, distant ones keep a space. Geometry is dropped here — the
 * two-row pairing works on `extractCertificateCodesFromItems` instead.
 */
export function groupPdfTextItemsIntoLines(
  items: readonly PdfTextItemLike[],
  limits: { maxItems?: number; maxLines?: number } = {},
): string[] {
  return groupPdfTextItemsIntoRows(items, limits)
    .map((row) => joinRowTokens(tokenizePdfTextRow(row)))
    .filter((line) => line !== "");
}

// ─── Label-anchored code extraction (pure) ───────────────────────────────────

// Labels may be letter-spaced on the certificate ("型　式"); values are ASCII after folding, so a label
// and its value never merge. Alternation order matters: the longer labels containing 「型式」 win.
const LABEL_PATTERN = /(原\s*動\s*機\s*の?\s*型\s*式)|(型\s*式\s*指\s*定\s*番\s*号)|(類\s*別\s*区\s*分\s*番\s*号)|(型\s*式)/g;
// A label is a FIELD label only when it is not the tail of compound Japanese text: 「旧型式 6BA-…」 in a remark,
// 「車両の型式」, 「この型式」 … Two narrow boundary rules decide, nothing broader (ES2017 target: no lookbehind):
//   1. glued — the character DIRECTLY before the match is kanji / kana / half-width kana: compound text.
//      Whitespace, ASCII, a colon or a preceding code keep the label valid, so 「改 型式 …」,
//      「型式:X原動機の型式:Y」 and letter-spaced labels are unaffected;
//   2. letter-spaced qualifier — labels may be letter-spaced on a PDF, and so may the compound: 「旧 型 式」,
//      「旧　型式」. The preceding text is therefore read back across whitespace as ONE Japanese run, and the
//      label is compound text when that run (whitespace removed) ENDS with an explicit qualifier from
//      QUALIFIER_BEFORE_LABEL. Only the listed qualifiers count as compound text; a modification mark (「改 型式」)
//      stays a valid boundary. No certificate field carries such a qualifier as its own value directly before
//      型式, so the rule never loses a genuine label.
//   3. suspect (型式 only) — a Japanese run before the label across whitespace that is NOT a listed qualifier
//      (「備考: 旧来 型 式 X」) cannot be told apart from a 車名 cell (「車 名 ホンダ 型 式 X」) without a vocabulary.
//      The label is anchored, but its candidate is recorded as SUSPECT and only accepted when the same value also
//      follows a clean 型式 label; otherwise the field is rejected (manual entry), never trusted. Applied to 型式
//      alone (the code that reaches the estimate with provenance); the other three labels keep rules 1–2 only.
//   4. old-model (型式 only) — the Japanese run before the label (rule 1 glued or rule 2 across whitespace) ENDS with
//      「旧」 (「旧型式 X」, 「備考: 旧 型 式 X」, 「旧　型式　X」). The label IS anchored, but its candidate is recorded as
//      OLD-MODEL evidence: accepted only when the same value also follows a clean 型式 label; otherwise the field is
//      rejected (manual entry, AI reading withheld) — never trusted, whatever the AI read. Takes precedence over rules
//      1–2 for 型式 alone; before the other three labels 「旧」 stays rule 1–2 compound text (skipped silently, as before).
const CJK_TEXT = /[々-〇぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;
// The trailing Japanese run before a label (whitespace between its characters allowed, whitespace removed
// before testing). ASCII, digits, punctuation and colons end the run: 「型式:X 旧 型式」 tests only 「旧」.
const CJK_RUN_BEFORE_LABEL = /[々-〇぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ\s]+$/;
// Explicit, narrow qualifier list: 旧 / 新 / 元 / 前 / 現 / 後 (変更前・変更後・従前), 従来 / 先代 (「従来 型 式」,
// 「先代 型 式」 in a remark — neither is ever a certificate VALUE), 当該, この / その, and any possessive 「…の」
// (「車両の型式」, 「エンジンの型式」). Matched at the END of the whitespace-stripped run only.
const QUALIFIER_BEFORE_LABEL = /(?:旧|新|元|前|現|後|従来|先代|当該|この|その|の)$/;
// Rule 4: the 「旧型式」 annotation. Tested on the same whitespace-stripped run; 「旧」 must be the LAST character before the
// label (「ホンダ 旧 型 式」 qualifies, 「旧 車名 ホンダ 型 式」 does not — that run is rule 3 suspect). Deliberately narrow:
// 「旧の型式」, 「変更前 型式」, 「従来 型式」 are NOT old-model evidence here — they stay rules 1–2 compound text.
const OLD_MODEL_QUALIFIER = /旧$/;
// …except a bare modification mark glued to the label ("6BA-ABC1 改原動機の型式"): that 改 is the PREVIOUS value's
// own mark (it rejects that value, see isModifierToken), not text the label belongs to.
const MODIFIER_MARK_BEFORE_LABEL = /(?:^|\s)[(（]?改[)）]?$/;
/** True when the whitespace-stripped Japanese text `text` ends with one of the explicit compound qualifiers. */
function endsWithQualifier(text: string): boolean {
  return QUALIFIER_BEFORE_LABEL.test(text);
}
/** True when the whitespace-stripped Japanese text `text` ends with the 「旧」 (old-model) qualifier. */
function endsWithOldModelQualifier(text: string): boolean {
  return OLD_MODEL_QUALIFIER.test(text);
}
type LabelBoundary =
  | { kind: "field" }                        // field boundary: line start, ASCII / colon / code, or a bare 改 mark
  | { kind: "compound" }                     // rules 1–2: the tail of compound text, not a label at all
  | { kind: "old_model" }                    // rule 4: 「旧型式」 / 「旧 型 式」 — the historical-型式 annotation
  | { kind: "suspect"; preceding: string };  // rule 3: unlisted Japanese run across whitespace (whitespace removed)

/**
 * Classifies what precedes the label matched at `index` of `line` (rules 1–4 above). `old_model` is returned for
 * EVERY label preceded by 「旧」; the caller applies it to 型式 only and treats it as `compound` for the other three.
 */
function classifyLabelBoundary(line: string, index: number): LabelBoundary {
  if (index === 0) return { kind: "field" };
  const before = line.slice(0, index);
  const run = CJK_RUN_BEFORE_LABEL.exec(before)?.[0].replace(/\s+/g, "") ?? "";
  if (CJK_TEXT.test(line.charAt(index - 1))) {                                               // rule 1: glued
    if (MODIFIER_MARK_BEFORE_LABEL.test(before)) return { kind: "field" };                   // 「6BA-ABC1 改原動機の型式」
    return endsWithOldModelQualifier(run) ? { kind: "old_model" } : { kind: "compound" };    // 「旧型式」 vs 「車両の型式」
  }
  if (run === "") return { kind: "field" };
  if (endsWithOldModelQualifier(run)) return { kind: "old_model" };                          // rule 4: 「旧 型 式」
  if (endsWithQualifier(run)) return { kind: "compound" };                                   // rule 2: 「この 型 式」
  if (MODIFIER_MARK_BEFORE_LABEL.test(before.replace(/\s+$/, ""))) return { kind: "field" }; // 「改 型式」 / 「(改) 型 式」
  return { kind: "suspect", preceding: run };                                                // rule 3: 「旧来 型 式」
}
function endsWithCjkText(str: string): boolean {
  const text = exactLabelText(str);
  return text !== "" && CJK_TEXT.test(text.charAt(text.length - 1));
}
/** Two-row rule 2: the preceding token of the label row is (or ends with) an explicit compound qualifier, e.g. 「旧」. */
function isQualifierToken(str: string): boolean {
  const text = exactLabelText(str);
  return text !== "" && CJK_TEXT.test(text.charAt(text.length - 1)) && endsWithQualifier(text);
}
/** Two-row rule 4: the preceding token of the label row is (or ends with) the 「旧」 qualifier (「旧」, 「備考:旧」). */
function isOldModelToken(str: string): boolean {
  return endsWithOldModelQualifier(exactLabelText(str));
}
// The value must directly follow the label (optional colon); hyphen variants are folded afterwards.
const VALUE_AFTER_LABEL = /^\s*[:：]?\s*([A-Za-z0-9‐-―−ーｰ-]+)/;
// What may directly follow a same-row value without a separating space: only ANOTHER exact label
// ("型式指定番号12345類別区分番号0007"). Anything else glued to the code (e.g. "6BA-ABC1改") is not a
// code the SHAPE rules describe, and the candidate is rejected whole — never truncated.
const LABEL_AT_START = /^(?:原\s*動\s*機\s*の?\s*型\s*式|型\s*式\s*指\s*定\s*番\s*号|類\s*別\s*区\s*分\s*番\s*号|型\s*式)/;
// A modification mark printed as its OWN token directly after a code ("6BA-ABC1 改", "6BA-ABC1 (改)")
// is part of that certificate value exactly like a glued suffix — however wide the gap pdf.js left
// between the two items (the glue threshold above only decides token joining). Only the token DIRECTLY
// following the code is inspected, so a 改 elsewhere on the page (another row, after another label's
// value, after remark text) never blocks a field.
const MODIFIER_MARK = /^[(（]?改[)）]?/;

/** True for a bare modification-mark token, optionally glued to the NEXT exact label ("改原動機の型式"). */
function isModifierToken(token: string): boolean {
  const mark = MODIFIER_MARK.exec(token);
  if (mark === null) return false;
  const rest = token.slice(mark[0].length);
  return rest === "" || LABEL_AT_START.test(rest);
}

type TrailingText =
  | { kind: "clean" }                             // nothing, another exact label, or ordinary further text
  | { kind: "glued" | "modifier"; text: string }; // the code is only the PREFIX of the printed value

/**
 * Classifies the text directly following a matched code on its line. Text glued to the code without a
 * space ("改", "(改)", …) or a separate modification-mark token after whitespace make the code a mere
 * prefix of the printed value → rejected whole, never truncated. Another exact label directly after
 * the code is the packed layout ("型式指定番号12345類別区分番号0007") and stays clean.
 */
function classifyTrailingText(trailing: string): TrailingText {
  if (trailing === "" || LABEL_AT_START.test(trailing)) return { kind: "clean" };
  if (!/^\s/.test(trailing)) return { kind: "glued", text: /^\S+/.exec(trailing)?.[0] ?? "" };
  const next = /^\s+(\S+)/.exec(trailing)?.[1];
  if (next !== undefined && isModifierToken(next)) return { kind: "modifier", text: next };
  return { kind: "clean" };
}

function trailingTextNotice(field: CertificateCodeField, code: string, trailing: Exclude<TrailingText, { kind: "clean" }>): string {
  const printed = trailing.kind === "glued" ? `${code}${trailing.text}` : `${code} ${trailing.text}`;
  return `PDFの文字情報で${FIELD_LABELS[field]}欄の値（${printed}）はコードの後に文字が続いていたため、${FIELD_LABELS[field]}は自動取得しませんでした。車検証の${FIELD_LABELS[field]}欄を確認して手入力してください。`;
}

/** Leading code of a value-row token plus whatever follows it inside the same token ("6BA-ABC1改" → "改"). */
function splitValueToken(str: string): { code: string; trailing: string } | null {
  const text = foldFullWidthLine(str).trim();
  const match = /^[:：]?\s*([A-Za-z0-9‐-―−ーｰ-]+)(.*)$/.exec(text);
  if (match === null) return null;
  const code = asCodeCandidate(match[1]);
  return code === null ? null : { code, trailing: match[2] };
}

const SHAPE: Record<CertificateCodeField, (v: string) => boolean> = {
  // 型式: letters (+digits), optional single hyphen part; never digits-only (that is a 型式指定番号).
  model:                 (v) => /^[A-Z0-9]{1,8}(-[A-Z0-9]{1,12})?$/.test(v) && /[A-Z]/.test(v),
  // 原動機の型式: short alphanumeric code, optional hyphen part, at least one letter.
  engine_model:          (v) => /^[A-Z0-9]{1,10}(-[A-Z0-9]{1,8})?$/.test(v) && /[A-Z]/.test(v),
  model_code:            (v) => /^\d{1,6}$/.test(v),
  classification_number: (v) => /^\d{1,5}$/.test(v),
};

function foldFullWidthLine(line: string): string {
  return line
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, " ");
}

/** Values that followed a CLEAN field label (same-row rule at a field boundary, or the two-row rule). */
type CandidateSets = Record<CertificateCodeField, Set<string>>;
/** Values that followed a SUSPECT same-row label (rule 3) → the Japanese text that preceded the label. */
type SuspectCandidates = Record<CertificateCodeField, Map<string, string>>;
/** Values that followed an OLD-MODEL label (rule 4, 「旧型式」): historical evidence, never current 型式 on their own. Only `model` is ever filled. */
type OldModelCandidates = CandidateSets;

function newCandidateSets(): CandidateSets {
  return { model: new Set(), engine_model: new Set(), model_code: new Set(), classification_number: new Set() };
}

function newSuspectCandidates(): SuspectCandidates {
  return { model: new Map(), engine_model: new Map(), model_code: new Map(), classification_number: new Map() };
}

/** A folded code candidate, or null when the text is not a code (Japanese text, blank, dash placeholder). */
function asCodeCandidate(raw: string): string | null {
  const folded = foldVehicleCode(raw);
  if (folded === "" || !/^[A-Z0-9-]+$/.test(folded)) return null;
  // A lone dash is the printed placeholder for "no value" (e.g. imports) — not a candidate.
  if (/^-+$/.test(folded)) return null;
  return folded;
}

/**
 * (a) Same-row rule: the value directly follows an exact label on the same text line. A code that is
 * followed by more text of its own value — glued ("6BA-ABC1改", brackets, …) or as a separate
 * modification-mark token ("6BA-ABC1 改") — is NOT a match for its leading code: that field is
 * blocked for the whole page with an operator-visible notice.
 * A 型式 value after a label at a SUSPECT boundary (rule 3: 「旧来 型 式 X」, 「車 名 ホンダ 型 式 X」) goes to
 * `suspect`, not `candidates`; resolveCandidates() accepts it only with a clean occurrence of the same value.
 * A 型式 value after an OLD-MODEL boundary (rule 4: 「旧型式 X」, 「備考: 旧 型 式 X」) goes to `oldModel` under the same
 * acceptance rule — historical evidence never becomes the current 型式 by itself. Trailing-text blocks (「旧型式 X 改」)
 * are applied before either routing, exactly as for a clean label.
 */
function collectSameRowCandidates(
  lines: readonly string[],
  candidates: CandidateSets,
  suspect: SuspectCandidates,
  oldModel: OldModelCandidates,
  blocked: Partial<Record<CertificateCodeField, string>>,
): void {
  for (const raw of lines) {
    const line = foldFullWidthLine(raw);
    LABEL_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LABEL_PATTERN.exec(line)) !== null) {
      const boundary = classifyLabelBoundary(line, match.index);
      if (boundary.kind === "compound") continue; // 「車両の型式 …」 / 「この 型 式 …」: compound text, not a field label
      const field: CertificateCodeField = match[1] ? "engine_model"
        : match[2] ? "model_code"
        : match[3] ? "classification_number"
        : "model";
      if (boundary.kind === "old_model" && field !== "model") continue; // 「旧型式指定番号」 / 「旧 原動機の型式」: compound text, as before
      const afterLabel = line.slice(match.index + match[0].length);
      const value = VALUE_AFTER_LABEL.exec(afterLabel);
      if (value === null) continue;
      const folded = asCodeCandidate(value[1]);
      if (folded === null) continue;
      const trailing = classifyTrailingText(afterLabel.slice(value[0].length));
      if (trailing.kind !== "clean") {
        blocked[field] ??= trailingTextNotice(field, folded, trailing);
        continue;
      }
      if (boundary.kind === "old_model") { // field === "model" here (see above)
        oldModel[field].add(folded);
        continue;
      }
      if (boundary.kind === "suspect" && field === "model") {
        if (!suspect[field].has(folded)) suspect[field].set(folded, boundary.preceding);
        continue;
      }
      candidates[field].add(folded);
    }
  }
}

// ─── (b) Two-row rule: label row → immediately following value row (pure, geometry-bound) ──────

/** `oldModel`: the 型式 label is the 「旧型式」 annotation (rule 4) — its paired value is historical evidence only. */
interface LabelRowToken extends PdfTextToken { field?: CertificateCodeField; oldModel?: boolean }

/** Exact-label text of a token: full-width folded, whitespace removed, optional trailing colon dropped. */
function exactLabelText(str: string): string {
  return foldFullWidthLine(str).replace(/\s+/g, "");
}

/** True when `piece` sits close enough behind `before` to be the next letter of one letter-spaced word. */
function isLabelPieceGap(before: PdfTextToken, piece: PdfTextToken): boolean {
  const h = Math.max(before.height, piece.height);
  const maxGap = Math.max(2, h * PDF_TWO_ROW_GEOMETRY.labelPieceGapRatio);
  return piece.x0 - before.x1 <= maxGap;
}

/**
 * Marks the tokens of a row that are EXACTLY one of the four labels. Letter-spaced labels split into
 * several adjacent pieces ("型", "式") are merged into one token first; nothing else is merged.
 * A label whose first piece directly continues preceding Japanese text ("旧" + "型" + "式") is the tail of
 * compound text, not a field label — unless that preceding token is itself an exact label (two labels
 * printed back to back in one letter-spaced label row). A preceding token that IS an explicit compound
 * qualifier ("車両の", "この", …) makes the label compound text at ANY gap on the row: a letter-spaced 「この 型 式」
 * is not more of a field label because pdf.js left a wider gap after the qualifier. Other preceding Japanese text
 * (a 車名 value, a 改 mark, unrelated label pieces such as 「名」 of 車名) keeps the label valid beyond the gap.
 * Rule 4 (型式 only): a preceding 「旧」 token — adjacent or at any gap — or 「旧型式」 printed as one token (or 「旧型」+「式」)
 * marks the 型式 label `oldModel`: it IS anchored, but its value is historical evidence (see collectTwoRowCandidates).
 * Exactly like the same-row rule 4, the text before 「旧」 does not matter: a remark head glued to the annotation
 * (「備考旧型式」, 「備考:旧型式」) or printed as an adjacent token (「備考」+「旧型式」, 「備考」+「旧」+「型」+「式」) is still the
 * 旧型式 annotation — the label part is what follows the LAST 「旧」 — and a preceding token never demotes an old-model
 * label to compound text (rule 4 takes precedence over rules 1–2 for 型式, as on a same row).
 * 「旧」 before another label (「旧」+「型式指定番号」, 「旧型式指定番号」 / 「備考旧原動機の型式」 in one token) stays compound text, as before.
 */
function markExactLabels(tokens: readonly PdfTextToken[]): LabelRowToken[] {
  const out: LabelRowToken[] = [];
  let k = 0;
  while (k < tokens.length) {
    let best: { count: number; field: CertificateCodeField; oldModel: boolean } | null = null;
    let text = "";
    // A token that is (or ends with) 「旧」 — 「旧」, 「備考:旧」 — is never the head of a glued 「旧型式」 label: it is judged as
    // the PRECEDING token below, so the longest exact label after it (「型式指定番号」 across pieces) still wins as it always did.
    const oldQualifierToken = isOldModelToken(tokens[k].str);
    const maxPieces = Math.min(PDF_TWO_ROW_GEOMETRY.maxLabelPieces, tokens.length - k);
    for (let n = 1; n <= maxPieces; n++) {
      const piece = tokens[k + n - 1];
      if (n > 1 && !isLabelPieceGap(tokens[k + n - 2], piece)) break;
      text += exactLabelText(piece.str);
      // The label part of the text: all of it — or, when 「旧」 is glued in front (「旧型式」, 「備考旧型式」, 「備考:旧型式」,
      // 「備考」+「旧型式」, 「旧型」+「式」 across pieces), what follows the LAST 「旧」: the same run the same-row rule 4 tests.
      const oldAt = oldQualifierToken ? -1 : text.lastIndexOf("旧");
      const labelText = oldAt >= 0 ? text.slice(oldAt + 1) : text;
      if (labelText.length > 8) break; // longer than any label (+ colon)
      const field = FIELD_BY_EXACT_LABEL.get(text.replace(/:$/, ""));
      if (field !== undefined) best = { count: n, field, oldModel: false };
      else if (oldAt >= 0) {
        // 「旧型式」 / 「備考旧型式」 in one token, 「旧型」+「式」: an OLD-MODEL 型式 label. 「旧型式指定番号」 / 「備考旧原動機の型式」: compound text.
        const qualified = FIELD_BY_EXACT_LABEL.get(labelText.replace(/:$/, ""));
        if (qualified === "model") best = { count: n, field: "model", oldModel: true };
        else if (qualified !== undefined) best = null;
      }
    }
    if (best === null) { out.push({ ...tokens[k] }); k++; continue; }
    const preceding = out[out.length - 1];
    if (preceding !== undefined && preceding.field === undefined
        && ((isLabelPieceGap(preceding, tokens[k]) && endsWithCjkText(preceding.str)) || isQualifierToken(preceding.str))) {
      if (best.field === "model" && (best.oldModel || isOldModelToken(preceding.str))) {
        best = { ...best, oldModel: true }; // 「旧」+「型式」 / 「旧」 … 「型」「式」 / 「この」 … 「旧型式」: the 旧型式 annotation — an OLD-MODEL 型式 label
      } else {
        out.push({ ...tokens[k] }); k++; continue; // 「車両の」+「型式」 / 「旧」+「型式指定番号」: compound text, not a field label
      }
    }
    const pieces = tokens.slice(k, k + best.count);
    out.push({
      str:      pieces.map((p) => p.str).join(""),
      x0:       pieces[0].x0,
      x1:       Math.max(...pieces.map((p) => p.x1)),
      y:        pieces[0].y,
      height:   Math.max(...pieces.map((p) => p.height)),
      field:    best.field,
      oldModel: best.oldModel,
    });
    k += best.count;
  }
  return out;
}

/**
 * True when the label at `index` already has a value on ITS OWN row (exactly what the same-row rule (a)
 * matches: an optional colon, then a code). Such a label is resolved by (a) and must never be paired
 * with the next row as well — that would re-interpret a same-row layout whenever rows are close.
 */
function hasSameRowValue(labelRow: readonly LabelRowToken[], index: number): boolean {
  const rest = foldFullWidthLine(joinRowTokens(labelRow.slice(index + 1)));
  const value = VALUE_AFTER_LABEL.exec(rest);
  return value !== null && asCodeCandidate(value[1]) !== null;
}

function maxBaselineGap(labelHeight: number, valueHeight: number): number {
  const h = Math.max(labelHeight, valueHeight);
  const { maxBaselineGapPt, minBaselineGapPt, baselineGapRatio } = PDF_TWO_ROW_GEOMETRY;
  return h > 0 ? Math.min(maxBaselineGapPt, Math.max(minBaselineGapPt, h * baselineGapRatio)) : minBaselineGapPt;
}

/**
 * Pairs each exact label of a row that has NO same-row value with the single code token that sits
 * inside the label's column on the IMMEDIATELY following row. Column = [label.x0, next token of the
 * label row); the last column extends a bounded distance past the label. A token straddling a column
 * edge blocks that field, and so does a code carrying further text of its own value inside the column
 * (glued "6BA-ABC1改" or a separate modification-mark token "改" directly after the code, whatever the
 * gap). Labels already followed by a value on their own row are skipped per label. A value under an
 * `oldModel` 型式 label (「旧」+「型式」, rule 4) is recorded as old-model evidence, never as a clean candidate.
 */
function collectTwoRowCandidates(
  rows: readonly (readonly PdfTextToken[])[],
  candidates: CandidateSets,
  oldModel: OldModelCandidates,
  blocked: Partial<Record<CertificateCodeField, string>>,
): void {
  for (let r = 0; r + 1 < rows.length; r++) {
    const labelRow = markExactLabels(rows[r]);
    if (!labelRow.some((t) => t.field !== undefined)) continue;
    const valueRow = rows[r + 1]; // immediately next visual row only — never a later one

    for (let i = 0; i < labelRow.length; i++) {
      const label = labelRow[i];
      const field = label.field;
      if (field === undefined) continue;
      if (hasSameRowValue(labelRow, i)) continue; // resolved by the same-row rule: never re-paired below
      const labelWidth = label.x1 - label.x0;
      const next = labelRow[i + 1];
      const outer = Math.max(2 * labelWidth, 3 * label.height, 12);
      const colStart = label.x0;
      const colEnd   = next !== undefined ? next.x0 : label.x1 + outer;
      const slack    = Math.max(4, 1.5 * label.height);

      for (let v = 0; v < valueRow.length; v++) {
        const value = valueRow[v];
        const gap = label.y - value.y;
        if (!(gap > 0) || gap > maxBaselineGap(label.height, value.height)) continue;
        const inside    = value.x1 > colStart + slack && value.x0 < colEnd - slack;
        const touches   = value.x1 > colStart - slack && value.x0 < colEnd + slack;
        if (!inside && !touches) continue;
        const folded = asCodeCandidate(value.str);
        if (folded === null) {
          // Not a code by itself. Japanese text or a dash placeholder under a label is silently no
          // value; a code with further text glued to it ("6BA-ABC1改") inside this column is a REJECTED
          // value of this field, exactly as on a same row — never truncated, never left to the AI.
          const split = splitValueToken(value.str);
          const trailing = split === null ? null : classifyTrailingText(split.trailing);
          if (split !== null && trailing !== null && trailing.kind !== "clean" && inside) {
            blocked[field] ??= trailingTextNotice(field, split.code, trailing);
          }
          continue;
        }
        const contained = value.x0 >= colStart - slack && value.x1 <= colEnd + slack;
        if (!contained) {
          if (inside) {
            blocked[field] ??= `PDFの文字情報で${FIELD_LABELS[field]}の下の行の値（${folded}）が隣の欄にまたがっていたため、${FIELD_LABELS[field]}は自動取得しませんでした。車検証の${FIELD_LABELS[field]}欄を確認して手入力してください。`;
          }
          continue; // merely touching the edge from outside: belongs to a neighbouring column
        }
        // The very next token of the value row, when it is a bare modification mark that starts inside
        // this column, is part of THIS value ("6BA-ABC1" + "改" split by pdf.js with any gap). A mark
        // starting beyond the column belongs to a neighbour / elsewhere and is never attributed here.
        const follower = valueRow[v + 1];
        if (follower !== undefined && follower.x0 < colEnd + slack) {
          const mark = foldFullWidthLine(follower.str).trim();
          if (isModifierToken(mark)) {
            blocked[field] ??= trailingTextNotice(field, folded, { kind: "modifier", text: mark });
            continue;
          }
        }
        (label.oldModel === true ? oldModel : candidates)[field].add(folded);
      }
    }
  }
}

// ─── Resolution (pure): ambiguity, shape, cross-field conflict ──────────────

function resolveCandidates(
  candidates: CandidateSets,
  suspect: SuspectCandidates,
  oldModel: OldModelCandidates,
  blocked: Partial<Record<CertificateCodeField, string>>,
  lineCount: number,
): PdfTextLayerExtraction {
  const fields: Partial<Record<CertificateCodeField, string>> = {};
  const rejected: Partial<Record<CertificateCodeField, string>> = {};
  const notices: string[] = [];
  // Every rejection names the field(s) that now REQUIRE manual entry (machine-readable prefix, see
  // ocr-quality.ts) and records them in `rejected`, so the AI reading of those fields is withheld too.
  const reject = (rejectedFields: readonly CertificateCodeField[], message: string): void => {
    const notice = manualEntryNotice(rejectedFields.map((f) => FIELD_LABELS[f]), message);
    notices.push(notice);
    for (const f of rejectedFields) rejected[f] ??= notice;
  };
  for (const field of CERTIFICATE_CODE_FIELDS) {
    const label = FIELD_LABELS[field];
    const blockedNotice = blocked[field];
    if (blockedNotice !== undefined) { reject([field], blockedNotice); continue; }
    // Clean, suspect and old-model occurrences are ONE candidate set: different values are an ambiguity whichever
    // label they followed (a bare-label remark 「備考: 型式 X」 is itself clean, so "clean wins" would be unsafe, and a
    // clean 型式 next to a differing 「旧型式」 is likewise left to the operator).
    const clean = [...candidates[field]];
    const values = [...clean];
    for (const v of [...suspect[field].keys(), ...oldModel[field]]) if (!values.includes(v)) values.push(v);
    if (values.length === 0) continue;
    if (values.length > 1) {
      reject([field], `PDFの文字情報で${label}の候補が複数あったため（${values.join(" / ")}）、${label}は自動取得しませんでした。車検証の${label}欄を確認して手入力してください。`);
      continue;
    }
    const value = values[0];
    if (clean.length === 0) {
      if (oldModel[field].has(value)) {
        // Old-model only (rule 4): the sole evidence is the 「旧型式」 annotation — a HISTORICAL 型式. Fail closed — manual
        // entry, AI reading withheld via `rejected` (even when the AI read this very value) — never the current 型式.
        reject([field], `PDFの文字情報で${label}の値（${value}）は「旧${label}」（変更前の${label}）として記載されたものだけで、現在の${label}欄の値が確認できなかったため、${label}は自動取得しませんでした。車検証の${label}欄を確認して手入力してください。`);
        continue;
      }
      // Suspect only (rule 3): the sole evidence is a label preceded by unlisted Japanese text. Fail closed —
      // manual entry, AI reading withheld via `rejected` — rather than trust a possibly remark-derived value.
      const preceding = suspect[field].get(value) ?? "";
      reject([field], `PDFの文字情報で${label}の欄名の直前に別の文字（${preceding}）が続いていたため、その後の値（${value}）が車検証の${label}欄かどうか判断できず、${label}は自動取得しませんでした。車検証の${label}欄を確認して手入力してください。`);
      continue;
    }
    if (!SHAPE[field](value)) {
      reject([field], `PDFの文字情報の${label}欄の値（${value}）は${label}の形式ではないため自動取得しませんでした。車検証の${label}欄を確認して手入力してください。`);
      continue;
    }
    fields[field] = value;
  }

  // The same value can never belong to two different columns — drop both, never pick one.
  for (let i = 0; i < CERTIFICATE_CODE_FIELDS.length; i++) {
    for (let j = i + 1; j < CERTIFICATE_CODE_FIELDS.length; j++) {
      const a = CERTIFICATE_CODE_FIELDS[i];
      const b = CERTIFICATE_CODE_FIELDS[j];
      if (fields[a] !== undefined && fields[a] === fields[b]) {
        reject([a, b], `PDFの文字情報で${FIELD_LABELS[a]}と${FIELD_LABELS[b]}に同じ値（${fields[a]}）が見つかったため、どちらも自動取得しませんでした。車検証を確認して手入力してください。`);
        delete fields[a];
        delete fields[b];
      }
    }
  }

  const status: PdfTextLayerStatus = Object.keys(fields).length > 0 ? "extracted" : "no_codes";
  return { status, fields, rejected, notices, lineCount };
}

/**
 * Reads the four certificate codes from reconstructed text lines (same-row rule only; plain strings
 * carry no geometry, so labels on one line and values on the next are never paired here).
 * Deterministic; never infers. Returns `fields` only for label-anchored, well-formed, unambiguous codes.
 */
export function extractCertificateCodesFromLines(lines: readonly string[]): PdfTextLayerExtraction {
  const meaningful = lines.filter((line) => typeof line === "string" && line.trim() !== "");
  if (meaningful.length === 0) return empty("no_text", 0);
  const candidates = newCandidateSets();
  const suspect = newSuspectCandidates();
  const oldModel: OldModelCandidates = newCandidateSets();
  const blocked: Partial<Record<CertificateCodeField, string>> = {};
  collectSameRowCandidates(meaningful, candidates, suspect, oldModel, blocked);
  return resolveCandidates(candidates, suspect, oldModel, blocked, meaningful.length);
}

/**
 * Reads the four certificate codes from positional text items: the same-row rule over the joined
 * lines PLUS the geometry-bound two-row rule (label row → immediately following value row). Both
 * feed one candidate set per field, so disagreement is rejected as ambiguity, never resolved.
 */
export function extractCertificateCodesFromItems(
  items: readonly PdfTextItemLike[],
  limits: { maxItems?: number; maxLines?: number } = {},
): PdfTextLayerExtraction {
  const rows = groupPdfTextItemsIntoRows(items, limits).map(tokenizePdfTextRow);
  const lines = rows.map(joinRowTokens);
  const meaningful = lines.filter((line) => line !== "");
  if (meaningful.length === 0) return empty("no_text", 0);

  const candidates = newCandidateSets();
  const suspect = newSuspectCandidates();
  const oldModel: OldModelCandidates = newCandidateSets();
  const blocked: Partial<Record<CertificateCodeField, string>> = {};
  collectSameRowCandidates(meaningful, candidates, suspect, oldModel, blocked);
  collectTwoRowCandidates(rows.filter((row) => row.length > 0), candidates, oldModel, blocked); // two-row values: clean, or old-model under 「旧」+「型式」
  return resolveCandidates(candidates, suspect, oldModel, blocked, meaningful.length);
}

// ─── Override of the AI result (pure) ────────────────────────────────────────

/**
 * Writes the deterministically extracted codes over the AI output — ONLY the four certificate code
 * fields, nothing else. Owner/customer fields, 車名 and グレード are never written here. Every applied
 * value and every rejection is recorded as an operator-visible notice (human confirmation stays).
 *
 * A field the text layer REJECTED (`extraction.rejected`) fails closed: its AI reading is removed as
 * well and reported in `manualEntry`, because a displayed value would contradict the notice asking the
 * operator to enter exactly that field by hand. Fields the PDF simply does not carry, and every
 * non-text-layer status (scanned PDF, image, parse failure), keep the AI reading — fallback unchanged.
 *
 * Provenance: when 型式 itself is applied, its exact value is also recorded as `model_text_layer`. That
 * is the ONLY place this key is ever written (the AI sanitizer never passes it through); any value the
 * input carried is discarded first — including when `extraction` is null/undefined (no PDF at all) — so
 * a rejected, absent or non-text-layer 型式 never keeps a stale claim. resolveVehicleIdentity() honours
 * the claim only while 型式 still equals it.
 */
export function applyPdfTextLayerCertificateFields(
  sanitized: VehicleRegistrationOcrResult,
  extraction: PdfTextLayerExtraction | null | undefined,
): { applied: CertificateCodeField[]; trustedModel: boolean; manualEntry: CertificateCodeField[] } {
  const applied: CertificateCodeField[] = [];
  const manualEntry: CertificateCodeField[] = [];
  // Provenance is established below, by THIS extraction only. Discarded BEFORE the no-extraction exit so
  // that an absent text layer (image upload, null/undefined) can never leave a stale or forged claim on
  // the result — the pure function fails closed on its own, independent of the AI sanitizer.
  delete sanitized.model_text_layer;
  if (!extraction) return { applied, trustedModel: false, manualEntry };

  const notices = [...(sanitized.vehicle_identity_notices ?? [])];
  const note = (message: string) => { if (!notices.includes(message)) notices.push(message); };

  if (extraction.status === "extracted") {
    for (const field of CERTIFICATE_CODE_FIELDS) {
      const value = extraction.fields[field];
      if (typeof value !== "string" || value === "") continue;
      const previous = foldVehicleCode(sanitized[field]);
      if (previous !== "" && previous !== value) {
        note(`${FIELD_LABELS[field]}はAI読み取り（${previous}）とPDFの文字情報（${value}）が異なったため、PDFの文字情報を優先しました。車検証と照合してください。`);
      }
      sanitized[field] = value;
      applied.push(field);
    }
    if (applied.includes("model")) sanitized.model_text_layer = sanitized.model; // exact applied value
    if (applied.includes("model") && sanitized.model_needs_confirmation !== undefined) {
      // The legacy "型式 was moved here from another column" flag describes the AI/legacy value that
      // has just been replaced by the label-anchored text-layer 型式. Left in place it would make
      // resolveVehicleIdentity() delete the trusted PDF value. Cleared ONLY when 型式 itself was applied;
      // without a PDF 型式 the flag is untouched and the identity policy still fails closed.
      const wasFlagged = sanitized.model_needs_confirmation === "true";
      delete sanitized.model_needs_confirmation;
      if (wasFlagged) note("以前の読み取りで付いていた型式の確認フラグは、PDFの文字情報から型式を取得したため解除しました。車検証の型式欄と照合してください。");
    }
    if (applied.length > 0) {
      note(`PDFの文字情報から${applied.map((f) => FIELD_LABELS[f]).join("・")}を取得しました。車検証と照合して確認してください。`);
    }
  }
  for (const message of extraction.notices) note(message);

  const rejected = extraction.rejected ?? {};
  for (const field of CERTIFICATE_CODE_FIELDS) {
    if (rejected[field] === undefined) continue;
    manualEntry.push(field);
    const previous = foldVehicleCode(sanitized[field]);
    delete sanitized[field]; // never shown next to the manual-entry notice for this very field
    if (previous !== "") {
      // The withheld AI candidate is untrusted for this field: it is neither displayed nor echoed in
      // this notice (the PDF evidence itself is already quoted by the manual-entry notice above).
      note(`AI読み取りの${FIELD_LABELS[field]}は、PDFの文字情報で${FIELD_LABELS[field]}を確定できなかったため表示しません。車検証の${FIELD_LABELS[field]}欄を確認して手入力してください。`);
    }
  }

  if (notices.length > 0) sanitized.vehicle_identity_notices = notices;
  return { applied, trustedModel: applied.includes("model"), manualEntry };
}

// ─── pdf.js loader (Node / server only) ──────────────────────────────────────

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsModulePromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  pdfjsModulePromise ??= (async () => {
    // pdf.js runs its "fake worker" on the main thread in Node. Registering the worker module on
    // `globalThis.pdfjsWorker` is the documented hook it checks first, so no relative import of
    // "./pdf.worker.mjs" (which a bundler could not resolve at runtime) is attempted. The specifier
    // stays a string literal after type erasure so bundlers and file tracing still see it.
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs" as string);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsModulePromise;
}

class PdfTextLayerTimeout extends Error {
  constructor() { super("pdf text layer timeout"); this.name = "PdfTextLayerTimeout"; }
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, Math.min(bytes.byteLength, 1024));
  for (let i = 0; i + 4 <= head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return true; // %PDF
  }
  return false;
}

/**
 * Extracts the certificate codes from page 1 of a PDF's text layer. Never throws; every failure mode
 * returns an empty `fields` object with a status so the caller falls through to the AI path.
 */
export async function extractCertificateCodesFromPdf(
  bytes: Uint8Array,
  options: PdfTextLayerOptions = {},
): Promise<PdfTextLayerExtraction> {
  const maxBytes  = options.maxBytes  ?? PDF_TEXT_LAYER_LIMITS.maxBytes;
  const timeoutMs = options.timeoutMs ?? PDF_TEXT_LAYER_LIMITS.timeoutMs;
  const maxItems  = options.maxItems  ?? PDF_TEXT_LAYER_LIMITS.maxItems;

  if (bytes.byteLength > maxBytes) return empty("too_large");
  if (bytes.byteLength === 0 || !hasPdfHeader(bytes)) return empty("not_pdf");

  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfTextLayerTimeout()), timeoutMs);
  });
  const bounded = <T,>(p: Promise<T>): Promise<T> => Promise.race([p, deadline]);

  let loadingTask: ReturnType<PdfJsModule["getDocument"]> | null = null;
  try {
    const pdfjs = await bounded(loadPdfJs());
    loadingTask = pdfjs.getDocument({
      data:             new Uint8Array(bytes), // pdf.js takes ownership of the buffer
      isEvalSupported:  false,                 // never evaluate PostScript/JS from the document
      disableFontFace:  true,
      useSystemFonts:   false,
      useWorkerFetch:   false,
      disableAutoFetch: true,
      disableStream:    true,
      stopAtErrors:     false,
      maxImageSize:     1,                     // images are irrelevant to the text layer
      verbosity:        0,                     // errors only
    });
    const doc  = await bounded(loadingTask.promise);
    const page = await bounded(doc.getPage(1));        // page 1 only, by contract
    const content = await bounded(page.getTextContent({ includeMarkedContent: false }));

    const items: PdfTextItemLike[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      if (items.length >= maxItems) break;
      const t = item.transform as unknown[];
      const x = Number(t?.[4]);
      const y = Number(t?.[5]);
      items.push({ str: item.str, x, y, width: item.width, height: item.height });
    }
    return extractCertificateCodesFromItems(items, { maxItems });
  } catch (err) {
    return empty(err instanceof PdfTextLayerTimeout ? "timeout" : "parse_error");
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (loadingTask !== null) {
      await Promise.race([
        loadingTask.destroy().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
      ]);
    }
  }
}

/** Base64 convenience wrapper with the byte bound applied BEFORE decoding. */
export async function extractCertificateCodesFromPdfBase64(
  base64: string,
  options: PdfTextLayerOptions = {},
): Promise<PdfTextLayerExtraction> {
  const maxBytes = options.maxBytes ?? PDF_TEXT_LAYER_LIMITS.maxBytes;
  // 4 base64 chars encode 3 bytes; anything beyond the bound is refused without decoding.
  if (base64.length > Math.ceil(maxBytes / 3) * 4 + 4) return empty("too_large");
  const buffer = Buffer.from(base64, "base64");
  return extractCertificateCodesFromPdf(
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    { ...options, maxBytes },
  );
}
