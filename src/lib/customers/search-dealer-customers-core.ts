// B2.2B — Dealer customer search: PURE CORE.
//
// No React, no Supabase, no server module, no I/O, no clock, no `any`, no cast. Everything here is
// term handling and query-shape decisions, so the whole surface is unit-testable without a database.
//
// ── WHAT THIS MODULE DECIDES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
// It decides: whether a term is searchable at all, how it is escaped, whether it takes the plate
// branch, the ordering contract, and the cap/truncation arithmetic.
//
// It does NOT decide the tenant. The dealer is resolved server-side from the authenticated actor
// context and is never an input here — there is deliberately no parameter this core could use to
// scope a query, so no future edit to this file can widen tenancy.

/** A term shorter than this is not searched at all: it would scan the whole tenant for nothing. */
export const MIN_TERM_LENGTH = 2;
/** Rows returned to the operator. */
export const RESULT_CAP = 50;
/** Rows fetched: one more than the cap, so `truncated` is observed rather than guessed. */
export const FETCH_LIMIT = RESULT_CAP + 1;

/**
 * The ordering contract, in application order. `id` is the final tie-break so the sequence is
 * stable across calls and cannot depend on insertion timing or physical row order.
 */
export const CUSTOMER_SEARCH_ORDER = [
  { column: "last_name_kana", ascending: true, nullsFirst: false },
  { column: "last_name", ascending: true, nullsFirst: false },
  { column: "id", ascending: true, nullsFirst: false },
] as const;

/** Customer columns a text term is matched against. Plate is NOT here — it lives on vehicles. */
export const CUSTOMER_TEXT_COLUMNS = [
  "last_name",
  "first_name",
  "last_name_kana",
  "first_name_kana",
  "address1",
  "address2",
  "phone",
] as const;

export type SearchPlanFailure = "QUERY_TOO_SHORT";

export interface SearchPlan {
  /** Trimmed, collapsed term. Never blank when `ok`. */
  readonly term: string;
  /** LIKE body with wildcards escaped — embed as `%${likeBody}%`. */
  readonly likeBody: string;
  /**
   * Set only when the term is EXACTLY four ASCII digits. The plate branch matches the last four
   * characters of `vehicles.plate_number`, never an arbitrary substring, so a five-digit term
   * (or a four-digit term with any other character) never reaches it.
   */
  readonly plateLastFour: string | null;
}

export type SearchPlanResult =
  | { readonly ok: true; readonly plan: SearchPlan }
  | { readonly ok: false; readonly code: SearchPlanFailure };

/** Trim and collapse internal whitespace. Non-strings normalise to the empty string, never throw. */
export function normalizeSearchTerm(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Map full-width decimal digits (U+FF10–U+FF19) to ASCII.
 *
 * Japanese keyboards produce `１２３４` as readily as `1234`, and a plate typed either way is the
 * same plate. Applied ONLY to the digit decision and to plate comparison — the free-text term is
 * left exactly as typed, because address and name width normalisation is deliberately out of scope
 * for this slice.
 */
export function toAsciiDigits(value: string): string {
  return value.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/** Every ASCII digit in the value, in order, with all other characters dropped. */
export function digitsOnly(value: string): string {
  return toAsciiDigits(value).replace(/[^0-9]/g, "");
}

/**
 * Escape LIKE/ILIKE wildcards so an operator typing `%` or `_` searches for those characters
 * rather than matching everything. Backslash is escaped first — reversing the order would
 * double-escape the escapes this function itself introduces.
 */
export function escapeLikeWildcards(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Exactly four digits — nothing more, nothing less — after full-width digits are mapped to ASCII.
 * `１２３４` and `1234` both qualify; five digits, three digits, or any mixed content do not.
 */
export function isPlateLastFourTerm(term: string): boolean {
  return /^[0-9]{4}$/.test(toAsciiDigits(term));
}

/**
 * Candidate LIKE suffixes for a four-digit plate query.
 *
 * A plate may be stored with ASCII or full-width digits, so the database pre-filter has to look for
 * both. This is ONLY a pre-filter: it narrows rows cheaply and is never the final word, because a
 * suffix match still cannot distinguish "ends with these digits" from "ends with a longer number
 * that happens to end this way". `plateLastFourMatches` makes that decision.
 */
export function plateSuffixCandidates(plateLastFourAscii: string): readonly string[] {
  const fullWidth = plateLastFourAscii.replace(/[0-9]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0x30 + 0xff10),
  );
  const seen = new Set([plateLastFourAscii, fullWidth]);
  return Array.from(seen).map((v) => `%${escapeLikeWildcards(v)}`);
}

/**
 * FINAL authority for the plate branch: the stored plate's last four NUMERIC digits must equal the
 * query exactly.
 *
 * The stored value is trimmed and width-normalised first, then reduced to digits only, so
 * "滋賀 330 に １２３４" and "滋賀330に1234" behave identically. Requiring the LAST four digits is
 * what stops a plate whose serial merely contains the query — for example 12345 — from being
 * returned for 1234.
 */
export function plateLastFourMatches(storedPlate: unknown, plateLastFourAscii: string): boolean {
  if (typeof storedPlate !== "string") return false;
  const digits = digitsOnly(storedPlate.trim());
  if (digits.length < 4) return false;
  return digits.slice(-4) === plateLastFourAscii;
}

/**
 * Quote a value for a PostgREST `or=` filter.
 *
 * A raw comma or parenthesis in the term would otherwise be read as filter SYNTAX and silently
 * change which columns are searched. Double-quoting is PostgREST's own mechanism; embedded quotes
 * and backslashes are escaped so the quoting cannot be broken out of.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Build the PostgREST `or=` expression for the customer text columns.
 *
 * `extraCustomerIds` carries the plate branch: ids resolved from a separate, tenant-scoped vehicle
 * lookup are folded in as `id.in.(…)` so the whole search remains ONE ordered, capped query rather
 * than two result sets merged and re-sorted in JavaScript.
 */
export function buildCustomerOrFilter(
  likeBody: string,
  extraCustomerIds: readonly string[] = [],
): string {
  const pattern = quoteFilterValue(`%${likeBody}%`);
  const clauses = CUSTOMER_TEXT_COLUMNS.map((c) => `${c}.ilike.${pattern}`);
  if (extraCustomerIds.length > 0) {
    clauses.push(`id.in.(${extraCustomerIds.join(",")})`);
  }
  return clauses.join(",");
}

/**
 * Decide whether and how to search. A blank or too-short term is refused BEFORE any query is
 * issued — the caller must not turn a stray keystroke into a full-tenant scan.
 *
 * `plateLastFour` is stored ASCII-normalised, so the rest of the pipeline never has to care which
 * width the operator typed.
 */
export function planCustomerSearch(rawTerm: unknown): SearchPlanResult {
  const term = normalizeSearchTerm(rawTerm);
  if (term.length < MIN_TERM_LENGTH) return { ok: false, code: "QUERY_TOO_SHORT" };
  return {
    ok: true,
    plan: {
      term,
      likeBody: escapeLikeWildcards(term),
      plateLastFour: isPlateLastFourTerm(term) ? toAsciiDigits(term) : null,
    },
  };
}

export interface CappedRows<T> {
  readonly rows: readonly T[];
  readonly truncated: boolean;
}

/**
 * Apply the cap to a fetch of up to FETCH_LIMIT rows. Receiving more than the cap is what proves
 * truncation; the surplus row is discarded and never shown.
 */
export function applyResultCap<T>(fetched: readonly T[]): CappedRows<T> {
  if (fetched.length > RESULT_CAP) {
    return { rows: fetched.slice(0, RESULT_CAP), truncated: true };
  }
  return { rows: fetched, truncated: false };
}
