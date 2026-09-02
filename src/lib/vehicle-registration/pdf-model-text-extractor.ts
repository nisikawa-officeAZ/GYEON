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

export interface ExtractLocalPdfModelOptions {
  readonly timeoutMs?: number;
  /** Test-only injection point; production callers always use the default unpdf loader. */
  readonly loadPdf?: PdfLoader;
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
  if (mimeType !== "application/pdf") return null;
  if (!isEligiblePdfByteSize(bytes.byteLength)) return null;

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
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      // Actively abort/destroy any PDF resource already obtained rather than waiting
      // for `work` to settle on its own — `work` may still be extracting text well
      // past the bounded budget.
      void cleanup();
      resolve(null);
    }, timeoutMs);
  });

  const work = (async (): Promise<string | null> => {
    try {
      doc = await loadPdf(bytes);
      if (!isEligiblePdfPageCount(doc.numPages)) return null;
      const pages = await doc.extractPositionedText();
      const match = findBareModelLabelValueFromPositionedText(pages);
      if (match === null || "ambiguous" in match) return null;
      return match.value;
    } catch {
      // Encrypted, corrupt, malformed, or otherwise parser-failed — fail closed.
      return null;
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
