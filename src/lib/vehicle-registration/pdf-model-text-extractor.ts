// GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4 — local, provider-free PDF 型式
// (vehicle type/model code) text-layer extractor.
//
// Runs only for application/pdf, dynamically loading `unpdf` (bundled serverless PDF.js,
// text-only) so image/HEIC/JPEG/PNG/WebP code paths never import it. Bounded by
// MAX_LOCAL_PDF_BYTES / MAX_LOCAL_PDF_PAGES / LOCAL_PDF_PARSE_TIMEOUT_MS. Extracts text
// only — never renders a page, never extracts an image — and never logs the extracted
// text, the matched value, file bytes, or any other PDF content.
//
// Precedence (applied via resolvePdfModel, called from ocr.ts): unambiguous explicit PDF
// text-layer 型式 > nonblank AI model > omitted/manual. An empty, ambiguous, or failed
// local result never clears the AI result or operator-entered input. The raw printed
// value is returned as-is (no NFKC here) — the already-accepted Wizard mapper
// (wizard-vehicle-ocr-apply-core.ts) remains the only NFKC boundary before `vehicleCode`.
//
// GDA_ESTIMATE_WIZARD_OCR_POSTAL_REVERSE_AND_PDF_ADDRESS_INTEGRITY_R1 — the same bounded,
// provider-free text layer additionally locates 所有者(owner)/使用者(user) address values,
// but ONLY when the printed text carries an ATTRIBUTABLE label ("所有者の住所" /
// "使用者の住所" — the label itself states whose address it is). A bare, unattributed
// "住所" is never matched: it would require guessing which section it belongs to, which
// this local fallback must never do. Ambiguity (conflicting values), no match, a non-PDF
// input, or a timeout all resolve to `null` for that address — never a fabricated or
// guessed value — and the correction is applied (in ocr.ts, before candidate construction)
// with the exact same "local unambiguous > nonblank AI > omitted" precedence as 型式.
// Never logs the extracted text or matched value, same as the 型式 path.

export const MAX_LOCAL_PDF_BYTES        = 5 * 1024 * 1024; // 5 MiB
export const MAX_LOCAL_PDF_PAGES        = 3;
export const LOCAL_PDF_PARSE_TIMEOUT_MS = 3_000;

// Defensive bound only — this module never renders a page or decodes an image, and the
// optional `@napi-rs/canvas` peer is never installed.
const MAX_LOCAL_PDF_IMAGE_PIXELS = 4_000_000;

export function isEligiblePdfByteSize(byteLength: number): boolean {
  return Number.isFinite(byteLength) && byteLength > 0 && byteLength <= MAX_LOCAL_PDF_BYTES;
}

export function isEligiblePdfPageCount(pageCount: number): boolean {
  return Number.isInteger(pageCount) && pageCount > 0 && pageCount <= MAX_LOCAL_PDF_PAGES;
}

// ─── Bare 型式 label discrimination ──────────────────────────────────────────────

const BARE_LABEL     = "型式";
const HOSTILE_PREFIX = "原動機の"; // 原動機の型式 — never 型式
const HOSTILE_SUFFIX = "指定番号"; // 型式指定番号 — never 型式
// 類別区分番号 shares no substring with 型式, so it can never match BARE_LABEL below —
// it is excluded by construction, not by a special case.

const LEADING_SEPARATORS = /^[\s　:：=＝]+/;
const VALUE_TOKEN        = /^[0-9A-Za-z\-０-９Ａ-Ｚ－]+/;

export type BareModelLabelMatch = { readonly value: string } | { readonly ambiguous: true } | null;

/**
 * Find the value adjacent to a bare printed 型式 label inside already-extracted plain
 * text. Never matches 原動機の型式 or 型式指定番号. Multiple identical values resolve
 * once; multiple different values are ambiguous and fail closed to no match.
 */
export function findBareModelLabelValue(text: string): BareModelLabelMatch {
  const values = new Set<string>();
  let from = 0;
  for (;;) {
    const idx = text.indexOf(BARE_LABEL, from);
    if (idx === -1) break;
    from = idx + BARE_LABEL.length;

    const before = text.slice(Math.max(0, idx - HOSTILE_PREFIX.length), idx);
    if (before === HOSTILE_PREFIX) continue;

    const after = text.slice(from, from + HOSTILE_SUFFIX.length);
    if (after === HOSTILE_SUFFIX) continue;

    let rest = text.slice(from);
    const sep = rest.match(LEADING_SEPARATORS);
    if (sep) rest = rest.slice(sep[0].length);
    const value = rest.match(VALUE_TOKEN);
    if (!value) continue;

    values.add(value[0]);
  }

  if (values.size === 0) return null;
  if (values.size > 1) return { ambiguous: true };
  const [only] = values;
  return { value: only };
}

// ─── Precedence ──────────────────────────────────────────────────────────────────

/**
 * unambiguous explicit PDF text-layer 型式 > nonblank AI model > omitted/manual.
 * Returns `undefined` (never `""`) when neither source supplies a value, so the caller
 * can leave an already-absent field genuinely absent instead of writing an empty string.
 */
export function resolvePdfModel(
  localModel: string | null,
  aiModel: string | undefined,
): string | undefined {
  if (localModel !== null && localModel.trim() !== "") return localModel;
  if (typeof aiModel === "string" && aiModel.trim() !== "") return aiModel;
  return undefined;
}

// ─── Bounded local extraction ─────────────────────────────────────────────────────

interface LoadedPdf {
  readonly numPages: number;
  extractPositionedText(): Promise<readonly (readonly PositionedPdfTextItem[])[]>;
  destroy(): Promise<void>;
}

export interface PositionedPdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type PdfLoader = (bytes: Uint8Array) => Promise<LoadedPdf>;

async function defaultLoadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const { getDocumentProxy } = await import("unpdf");
  // unpdf 1.8.1's `DocumentInitParameters` has no `isEvalSupported`/scripting field, and
  // its bundled serverless PDF.js build ships no interactive-forms scripting/sandbox
  // module at all. Embedded PDF JavaScript can only ever run through that module, which
  // this module never reaches — it only calls `getDocumentProxy`/`extractText` (text
  // extraction), never the annotation-layer/rendering APIs that would load it. The
  // no-eval requirement therefore holds by construction, not by an option to disable.
  // Node's Buffer extends Uint8Array, but PDF.js rejects Buffer specifically. OCR passes
  // Buffer.from(base64), so copy to a plain Uint8Array at this dependency boundary.
  const pdfBytes = new Uint8Array(bytes);
  const pdf = await getDocumentProxy(pdfBytes, {
    disableAutoFetch: true,  // fully local input — nothing to fetch
    disableStream:    true,
    maxImageSize:     MAX_LOCAL_PDF_IMAGE_PIXELS, // defensive bound; this module never renders
    useSystemFonts:   false,
  });
  return {
    numPages: pdf.numPages,
    extractPositionedText: async () => {
      const pages: PositionedPdfTextItem[][] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.flatMap((item) => {
          if (!("str" in item) || item.str.trim() === "") return [];
          return [{
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
          }];
        }));
      }
      return pages;
    },
    // PDFDocumentProxy itself has no destroy(); its lifecycle is torn down through the
    // loading task, matching unpdf's own internal `pdf.loadingTask.destroy()` usage.
    destroy: async () => {
      await pdf.loadingTask.destroy();
    },
  };
}

const POSITIONED_VALUE_TOKEN = /^[0-9A-Za-z０-９Ａ-Ｚ]+(?:[-－][0-9A-Za-z０-９Ａ-Ｚ]+)+$/;
const MAX_LABEL_TO_VALUE_GAP = 240;

/**
 * PDF text arrays are commonly emitted in object/section order rather than visual table
 * order. Match a bare `型式` label to the nearest token on its right whose vertical
 * bounding box overlaps the label, while keeping page boundaries and ambiguity checks.
 */
export function findBareModelLabelValueFromPositionedText(
  pages: readonly (readonly PositionedPdfTextItem[])[],
): BareModelLabelMatch {
  const values = new Set<string>();

  for (const items of pages) {
    for (const item of items) {
      const inline = findBareModelLabelValue(item.text);
      if (inline && !("ambiguous" in inline)) values.add(inline.value);
      if (inline && "ambiguous" in inline) return { ambiguous: true };

      if (item.text.trim() !== BARE_LABEL) continue;
      const labelRight = item.x + item.width;
      const labelTop = item.y + item.height;

      const candidates = items
        .map((candidate) => ({ candidate, value: candidate.text.trim() }))
        .filter(({ candidate, value }) => {
          if (!POSITIONED_VALUE_TOKEN.test(value)) return false;
          const gap = candidate.x - labelRight;
          if (gap < 0 || gap > MAX_LABEL_TO_VALUE_GAP) return false;
          const overlap = Math.min(labelTop, candidate.y + candidate.height)
            - Math.max(item.y, candidate.y);
          return overlap > 0;
        })
        .sort((left, right) => left.candidate.x - right.candidate.x);

      if (candidates.length > 0) values.add(candidates[0].value);
    }
  }

  if (values.size === 0) return null;
  if (values.size > 1) return { ambiguous: true };
  const [only] = values;
  return { value: only };
}

// ─── Attributable owner/user address label discrimination ────────────────────────────

export const OWNER_ADDRESS_LABEL = "所有者の住所";
export const USER_ADDRESS_LABEL  = "使用者の住所";

// Every other label that can legitimately sit beside/below an address label on a printed
// 車検証. A candidate value equal to one of these is a label, never an address — most
// importantly "使用の本拠の位置" (base-of-use location), a DIFFERENT field that must never
// be mistaken for either address.
const ADDRESS_LABEL_DENYLIST = new Set([
  OWNER_ADDRESS_LABEL,
  USER_ADDRESS_LABEL,
  "所有者の氏名又は名称",
  "使用者の氏名又は名称",
  "氏名又は名称",
  "使用の本拠の位置",
  BARE_LABEL,
  "車台番号",
  "登録番号",
  "自動車登録番号",
]);

const MIN_ADDRESS_VALUE_LENGTH = 4; // shortest real Japanese address is well over this
const MAX_ADDRESS_LABEL_TO_VALUE_GAP = 260;

/**
 * Recognition-only whitespace normalization: some real 車検証 PDF exports render label glyphs
 * with tracking/kerning spacing between every character — e.g. "所 有 者 の 住 所" instead of
 * "所有者の住所" — a PDF-generator artifact, not a different label. Stripping ALL whitespace
 * (half- and full-width; JS `\s` already covers U+3000) before comparing lets recognition see
 * through this WITHOUT ever touching the captured VALUE text, which keeps its own spacing as
 * printed.
 */
function normalizeLabelWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

function isAttributableAddressLabel(text: string, label: string): boolean {
  return normalizeLabelWhitespace(text.trim()) === normalizeLabelWhitespace(label);
}

const ADDRESS_LABEL_DENYLIST_NORMALIZED = new Set(
  Array.from(ADDRESS_LABEL_DENYLIST, normalizeLabelWhitespace),
);

// A "same as the other party's address" marker printed verbatim on the certificate (e.g.
// "使用者住所に同じ", "所有者住所に同じ", bare "同上") is an ATTRIBUTABLE printed value, not
// noise — it must be preserved and returned as-is so the existing owner/user directional-phrase
// resolver (ocr-customer-mapping.ts, called from ocr.ts after this correction) can follow it.
// Rejecting it here would leave whatever the AI transcribed in its place, which risks a
// truncated/garbled AI literal silently standing in for a clearly attributable marker.
const SAME_AS_MARKER_PATTERN = /に同じ$|^同上$/;

function isPlausibleAddressValue(value: string): boolean {
  if (SAME_AS_MARKER_PATTERN.test(value)) return true;
  if (value.length < MIN_ADDRESS_VALUE_LENGTH) return false;
  return !ADDRESS_LABEL_DENYLIST_NORMALIZED.has(normalizeLabelWhitespace(value));
}

/** Same recognition tolerance as `isAttributableAddressLabel`, for the inline (single-string) matcher. */
function labelRecognitionPattern(label: string): RegExp {
  const escapedChars = Array.from(label).map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escapedChars.join("\\s*"));
}

/**
 * Inline variant (plain concatenated text, no positions) for a single attributable label,
 * tolerant of intra-label whitespace for RECOGNITION only. Stops the captured value at the next
 * newline or the next known label, whichever is closer, so the value never bleeds into an
 * adjacent field.
 */
export function findLabeledAddressValue(text: string, label: string): BareModelLabelMatch {
  const pattern = labelRecognitionPattern(label);
  const values = new Set<string>();
  let searchFrom = 0;
  for (;;) {
    const remaining = text.slice(searchFrom);
    const match = pattern.exec(remaining);
    if (!match) break;
    const matchEnd = searchFrom + match.index + match[0].length;
    searchFrom = matchEnd;

    let rest = text.slice(matchEnd);
    const sep = rest.match(LEADING_SEPARATORS);
    if (sep) rest = rest.slice(sep[0].length);

    let stop = rest.indexOf("\n");
    for (const stopLabel of ADDRESS_LABEL_DENYLIST) {
      const stopIdx = rest.indexOf(stopLabel);
      if (stopIdx !== -1 && (stop === -1 || stopIdx < stop)) stop = stopIdx;
    }
    const candidate = (stop === -1 ? rest : rest.slice(0, stop)).trim();
    if (!isPlausibleAddressValue(candidate)) continue;
    values.add(candidate);
  }

  if (values.size === 0) return null;
  if (values.size > 1) return { ambiguous: true };
  const [only] = values;
  return { value: only };
}

interface LabelBBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Tier 1: same-row, to the right of the label bbox (same adjacency technique as
 * `findBareModelLabelValueFromPositionedText`). Tier 2 (only tried when tier 1 finds nothing):
 * the value column starts at-or-right-of the label's OWN left edge — NOT bounded to the label's
 * own width, since the real certificate layout this correction targets prints the value on the
 * next visual row in a value column that does not horizontally overlap the (narrow) label box at
 * all — and sits on the nearest row strictly below within a bounded vertical gap. Only the
 * SINGLE nearest row is ever considered — never scanned past — so a blank field (the next
 * field's own label starting immediately below) reads as "no value" rather than reaching into a
 * farther row belonging to a different field (owner's name, the base-of-use location, or the
 * other party's address). If more than one distinct plausible value sits on that nearest row,
 * that is a genuine conflict and fails closed to no value for this label occurrence. Shared by
 * both the single-item label match and the assembled glyph-chain label match below — a plain
 * bounding box, whether it came from one printed item or was assembled from several, is
 * attributed identically.
 */
function matchAddressValueForLabelBBox(
  items: readonly PositionedPdfTextItem[],
  labelBBox: LabelBBox,
): string | null {
  const labelLeft   = labelBBox.x;
  const labelRight  = labelBBox.x + labelBBox.width;
  const labelBottom = labelBBox.y;
  const labelTop    = labelBBox.y + labelBBox.height;

  const rightCandidates = items
    .map((candidate) => ({ candidate, value: candidate.text.trim() }))
    .filter(({ candidate, value }) => {
      if (!isPlausibleAddressValue(value)) return false;
      const gap = candidate.x - labelRight;
      if (gap < 0 || gap > MAX_ADDRESS_LABEL_TO_VALUE_GAP) return false;
      const overlap = Math.min(labelTop, candidate.y + candidate.height)
        - Math.max(labelBottom, candidate.y);
      return overlap > 0;
    })
    .sort((left, right) => left.candidate.x - right.candidate.x);

  if (rightCandidates.length > 0) return rightCandidates[0].value;

  const belowRows = items
    .map((candidate) => ({
      value: candidate.text.trim(),
      verticalGap: labelBottom - (candidate.y + candidate.height),
      horizontalDistance: candidate.x - labelLeft,
    }))
    .filter(({ verticalGap, horizontalDistance }) =>
      verticalGap > 0
      && verticalGap <= MAX_ADDRESS_LABEL_TO_VALUE_GAP
      && horizontalDistance >= 0
      && horizontalDistance <= MAX_ADDRESS_LABEL_TO_VALUE_GAP,
    );

  if (belowRows.length === 0) return null;

  const nearestGap = Math.min(...belowRows.map((row) => row.verticalGap));
  const nearestRowValues = new Set(
    belowRows
      .filter((row) => row.verticalGap === nearestGap)
      .map((row) => row.value)
      .filter((value) => isPlausibleAddressValue(value)),
  );
  // Exactly one distinct plausible value on the nearest row → use it. Zero means the
  // nearest row was blank/a known label/too short (no value here — never fall through to
  // a farther row). More than one is a genuine conflict on that row — fail closed.
  if (nearestRowValues.size !== 1) return null;
  const [only] = nearestRowValues;
  return only;
}

// Some real 車検証 PDF exports emit each label character as its own separately positioned
// text item. Only exact, ordered, tightly spaced full labels are assembled; arbitrary page text
// and partial labels are never concatenated.
const MAX_GLYPH_GAP = 24;
const GLYPH_BASELINE_TOLERANCE_RATIO = 0.4;

function assembleGlyphLabelBBoxes(
  items: readonly PositionedPdfTextItem[],
  glyphs: readonly string[],
): readonly LabelBBox[] {
  const bboxes: LabelBBox[] = [];

  for (const start of items) {
    if (start.text.trim() !== glyphs[0]) continue;

    const chain: PositionedPdfTextItem[] = [start];
    let prev = start;
    let complete = true;

    for (let i = 1; i < glyphs.length; i += 1) {
      const tolerance = Math.abs(prev.height) * GLYPH_BASELINE_TOLERANCE_RATIO;
      const next = items
        .filter((candidate) => {
          if (candidate.text.trim() !== glyphs[i]) return false;
          if (Math.abs(candidate.y - prev.y) > tolerance) return false;
          const gap = candidate.x - (prev.x + prev.width);
          return gap >= 0 && gap <= MAX_GLYPH_GAP;
        })
        .sort(
          (left, right) =>
            (left.x - (prev.x + prev.width)) - (right.x - (prev.x + prev.width)),
        )[0];

      if (!next) { complete = false; break; }
      chain.push(next);
      prev = next;
    }

    if (!complete) continue;

    const minY = Math.min(...chain.map((glyphItem) => glyphItem.y));
    const maxTop = Math.max(...chain.map((glyphItem) => glyphItem.y + glyphItem.height));
    bboxes.push({
      x: chain[0].x,
      y: minY,
      width: (prev.x + prev.width) - chain[0].x,
      height: maxTop - minY,
    });
  }

  return bboxes;
}

/**
 * Positioned variant. Recognizes an attributable label either as a single combined-text item
 * or as a page-local run of exactly matching individual glyph items. Both paths reuse the same
 * spatial attribution and ambiguity rules.
 */
export function findLabeledAddressValueFromPositionedText(
  pages: readonly (readonly PositionedPdfTextItem[])[],
  label: string,
): BareModelLabelMatch {
  const values = new Set<string>();
  const glyphs = Array.from(label);

  for (const items of pages) {
    for (const item of items) {
      const inline = findLabeledAddressValue(item.text, label);
      if (inline && "ambiguous" in inline) return { ambiguous: true };
      if (inline) values.add(inline.value);

      if (!isAttributableAddressLabel(item.text, label)) continue;
      const match = matchAddressValueForLabelBBox(items, item);
      if (match !== null) values.add(match);
    }

    for (const bbox of assembleGlyphLabelBBoxes(items, glyphs)) {
      const match = matchAddressValueForLabelBBox(items, bbox);
      if (match !== null) values.add(match);
    }
  }

  if (values.size === 0) return null;
  if (values.size > 1) return { ambiguous: true };
  const [only] = values;
  return { value: only };
}

// ─── Precedence: owner/user address ───────────────────────────────────────────────

/**
 * unambiguous explicit PDF text-layer address > nonblank AI value > omitted/manual —
 * identical shape and rationale to `resolvePdfModel`.
 */
export function resolvePdfAddress(
  localAddress: string | null,
  aiAddress: string | undefined,
): string | undefined {
  if (localAddress !== null && localAddress.trim() !== "") return localAddress;
  if (typeof aiAddress === "string" && aiAddress.trim() !== "") return aiAddress;
  return undefined;
}

export interface LocalPdfAddresses {
  readonly ownerAddress: string | null;
  readonly userAddress: string | null;
}

export interface ExtractLocalPdfModelOptions {
  readonly timeoutMs?: number;
  /** Test-only injection point; production callers always use the default unpdf loader. */
  readonly loadPdf?: PdfLoader;
}

/**
 * Shared bounded-execution core: eligibility checks, timeout race, and guaranteed
 * document cleanup — identical discipline for every local PDF text-layer extraction,
 * whatever it goes on to look for in the positioned pages. `process` never throws past
 * this boundary; any exception (encrypted/corrupt/malformed) resolves to `fallback`,
 * exactly like a timeout or an ineligible input does.
 */
async function runBoundedLocalPdfExtraction<T>(
  bytes: Uint8Array,
  mimeType: string,
  fallback: T,
  process: (pages: readonly (readonly PositionedPdfTextItem[])[]) => T,
  options: ExtractLocalPdfModelOptions = {},
): Promise<T> {
  if (mimeType !== "application/pdf") return fallback;
  if (!isEligiblePdfByteSize(bytes.byteLength)) return fallback;

  const timeoutMs = options.timeoutMs ?? LOCAL_PDF_PARSE_TIMEOUT_MS;
  const loadPdf   = options.loadPdf   ?? defaultLoadPdf;

  // Shared between the timeout branch and `work`'s own finally so whichever side first
  // has a document handle destroys it — idempotent, and never logs PDF content.
  let doc: LoadedPdf | null = null;
  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp || !doc) return;
    cleanedUp = true;
    await doc.destroy().catch(() => undefined);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      // Actively abort/destroy any PDF resource already obtained rather than waiting
      // for `work` to settle on its own — `work` may still be extracting text well
      // past the bounded budget.
      void cleanup();
      resolve(fallback);
    }, timeoutMs);
  });

  const work = (async (): Promise<T> => {
    try {
      doc = await loadPdf(bytes);
      if (!isEligiblePdfPageCount(doc.numPages)) return fallback;
      const pages = await doc.extractPositionedText();
      return process(pages);
    } catch {
      // Encrypted, corrupt, malformed, or otherwise parser-failed — fail closed.
      return fallback;
    } finally {
      await cleanup();
    }
  })();

  try {
    return await Promise.race([work, timeout]);
  } finally {
    // Normal completion (work wins the race) must not leave a live timer scheduled for
    // the rest of the 3-second budget.
    clearTimeout(timer);
  }
}

function singleUnambiguousValue(match: BareModelLabelMatch): string | null {
  return match === null || "ambiguous" in match ? null : match.value;
}

/**
 * Run bounded local PDF text extraction for one eligible digital PDF and return the
 * unambiguous printed 型式 value, or `null` for every other outcome (non-PDF, oversized,
 * page-excess, scanned/no-text, encrypted, corrupt, malformed, ambiguous, or timed out).
 * Never throws and never logs the extracted text or the matched value.
 */
export async function extractLocalPdfModel(
  bytes: Uint8Array,
  mimeType: string,
  options: ExtractLocalPdfModelOptions = {},
): Promise<string | null> {
  return runBoundedLocalPdfExtraction(
    bytes, mimeType, null,
    (pages) => singleUnambiguousValue(findBareModelLabelValueFromPositionedText(pages)),
    options,
  );
}

/**
 * GDA_ESTIMATE_WIZARD_OCR_POSTAL_REVERSE_AND_PDF_ADDRESS_INTEGRITY_R1 — run the SAME
 * bounded local PDF text extraction to locate the attributable owner/user address
 * values. Each of `ownerAddress`/`userAddress` is `null` independently for every
 * non-attributable outcome (no attributable label, ambiguous, non-PDF, oversized,
 * page-excess, encrypted/corrupt/malformed, or timed out) — never a guessed or
 * cross-attributed value. Never throws and never logs the extracted text.
 */
export async function extractLocalPdfAddresses(
  bytes: Uint8Array,
  mimeType: string,
  options: ExtractLocalPdfModelOptions = {},
): Promise<LocalPdfAddresses> {
  return runBoundedLocalPdfExtraction(
    bytes, mimeType, { ownerAddress: null, userAddress: null },
    (pages) => ({
      ownerAddress: singleUnambiguousValue(findLabeledAddressValueFromPositionedText(pages, OWNER_ADDRESS_LABEL)),
      userAddress:  singleUnambiguousValue(findLabeledAddressValueFromPositionedText(pages, USER_ADDRESS_LABEL)),
    }),
    options,
  );
}
