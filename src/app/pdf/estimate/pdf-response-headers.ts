// R90C — PDF response-header construction, as pure functions.
//
// ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
// `route.ts` imports `@/lib/pdf/brand-profile`, which begins with
// `import "server-only"` — a package that is a devDependency of Next, absent
// from node_modules, and unresolvable by `node --import tsx`. Anything defined
// inside the route is therefore untestable by execution. These helpers decide
// what reaches a RESPONSE HEADER, which is exactly the code that must be proved
// against real inputs rather than against a regex over its own source, so they
// live here: import-free, side-effect-free, and directly executable.

/** The only two dispositions this route may emit. */
export type PdfDisposition = "inline" | "attachment";

/** Used when the document number sanitizes away to nothing. */
export const FALLBACK_PDF_BASENAME = "estimate";

/**
 * Reduce a persisted document number to something safe for a header.
 *
 * CR and LF would allow header injection; a double quote would terminate the
 * quoted-string early; a backslash would start an escape the parser must then
 * interpret. C0 controls, DEL and C1 controls are stripped for the same reason —
 * they have no legitimate place in a filename and several are treated as line
 * terminators by intermediaries. Characters are REMOVED rather than escaped, so
 * there is no escaping scheme left to get wrong.
 */
export function sanitizePdfBasename(documentNumber: string | null | undefined): string {
  const cleaned = (documentNumber ?? "")
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
  return cleaned || FALLBACK_PDF_BASENAME;
}

/**
 * The filename, carrying EXACTLY one `.pdf` extension.
 *
 * A document number that already ends in `.pdf` (in any case) must not become
 * `EST-1.pdf.pdf`, so an existing extension is consumed rather than appended to.
 */
export function buildPdfFilename(documentNumber: string | null | undefined): string {
  // Consume EVERY repeated trailing extension, not just one: `EST-1.pdf.pdf`
  // must normalise to `EST-1.pdf`, so a single anchored strip is insufficient.
  const base = sanitizePdfBasename(documentNumber).replace(/(?:\.pdf)+$/i, "").trim();
  return `${base || FALLBACK_PDF_BASENAME}.pdf`;
}

/**
 * RFC 5987 / RFC 8187 `ext-value` encoding.
 *
 * `encodeURIComponent` alone is NOT sufficient: it leaves `'`, `(`, `)` and `*`
 * literal, and all four are outside `attr-char`. An apostrophe is the delimiter
 * of the `charset'language'value` form itself, so leaving it raw can split the
 * value; parentheses can open a comment in header grammars that allow them.
 */
export function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * An ASCII-only rendering for the legacy `filename` parameter.
 *
 * Every byte outside printable ASCII becomes `_`, so a Japanese document number
 * still yields a non-empty, unambiguous name for clients that ignore
 * `filename*`. The result can never be empty: the input always carries at least
 * the `.pdf` extension.
 */
export function toAsciiFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7e]/g, "_");
}

/**
 * The complete `Content-Disposition` value.
 *
 * Both parameters are always emitted: `filename` for clients that predate
 * RFC 5987, `filename*` for the exact original bytes. The disposition token is a
 * closed union, so no caller can inject a third mode.
 */
export function buildContentDisposition(
  disposition: PdfDisposition,
  documentNumber: string | null | undefined,
): string {
  const filename = buildPdfFilename(documentNumber);
  return `${disposition}; filename="${toAsciiFilename(filename)}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

/**
 * `download` is honoured ONLY for the exact literal "1".
 *
 * A truthiness check would turn "0" and "false" into downloads, so the
 * comparison is deliberately strict and total.
 */
export function isDownloadRequested(raw: string | null): boolean {
  return raw === "1";
}

/** The disposition implied by the query parameter. */
export function resolveDisposition(raw: string | null): PdfDisposition {
  return isDownloadRequested(raw) ? "attachment" : "inline";
}
