// Document serial — PRESENTATION ONLY.
//
// The allocator (src/lib/numbering) stores numbers as `EST-2026-00012` and that stored value is
// canonical: it is what lives in `estimates.estimate_number`, what Storage paths and `document_files`
// rows are keyed on, and what operators search by. It is never rewritten.
//
// The approved document design prints the same number with slashes (`EST/2026/00012`). That is a
// display concern, so it lives here — one formatter, used by the PDF layer only.

// Canonical stored serial: `PREFIX-YYYY-NNNNN`, where PREFIX is uppercase and may itself contain one
// slash (e.g. `CRT/CO`), the year is exactly four digits, and the sequence is exactly five digits.
const CANONICAL_SERIAL = /^([A-Z]+(?:\/[A-Z]+)?)-(\d{4})-(\d{5})$/;

/**
 * Formats a stored document number for the customer-facing PDF. ONLY the canonical stored shape is
 * re-punctuated to the printed slash form:
 *   `EST-2026-00012`     → `EST/2026/00012`
 *   `CRT/CO-2026-00012`  → `CRT/CO/2026/00012`
 * Anything already slashed, or in any other shape, is passed through untouched rather than mangled:
 *   `EST/2026/00012`, `SOME-RANDOM-THING`, `AB-12-3` → unchanged; null / empty → "".
 */
export function formatDocumentSerial(storedNumber: string | null | undefined): string {
  const n = (storedNumber ?? "").trim();
  if (!n) return "";
  const m = n.match(CANONICAL_SERIAL);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : n;
}
