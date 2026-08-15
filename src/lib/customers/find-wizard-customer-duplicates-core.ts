// B2-D.3 — Screen 1 duplicate warning: PURE CORE.
//
// No React, no Supabase, no server module, no I/O, no clock, no `any`, no cast. Everything here is
// input normalisation and query-shape decision, so the whole surface is unit-testable without a
// database.
//
// ── WHAT THIS MODULE DECIDES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
// It decides: how an operator's name/kana/phone become match keys, whether a check is worth issuing
// at all, the shape of the PostgREST filter, the cap arithmetic, and why a returned row matched.
//
// It does NOT decide the tenant. The dealer is resolved server-side from the authenticated actor
// context and is never a parameter here — there is deliberately no argument this core could use to
// scope a query, so no future edit to this file can widen tenancy.
//
// ── THE NORMALISATION MUST MIRROR THE DATABASE EXACTLY ──────────────────────────
// These functions normalise the QUERY value; migration 20260727112326 normalises the STORED value
// through generated columns. Both sides run NFKC and then strip. If they drift, the warning fails
// silently — each side individually correct, the two no longer meeting. duplicate-match-fixtures.ts
// is the shared vector table both are asserted against.
//
// ── WHY NOT REUSE search-dealer-customers-core's DIGIT HELPERS ──────────────────
// That module's `toAsciiDigits` maps only U+FF10–FF19. It is correct for its own purpose and is
// deliberately left untouched. This feature additionally requires half-width katakana equivalence
// (ﾔﾏﾀﾞﾀﾛｳ ≡ ヤマダタロウ), which only a full NFKC pass provides — and using one normalisation for
// digits and a different one for kana would be two contracts where the database has one.

// The reason union and candidate shape are owned by the wizard contract, not re-declared here: a
// second spelling could drift from the type the UI actually renders.
import type {
  WizardDuplicateReason,
  WizardDuplicateCandidate,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";

/** Candidates returned to the operator. Exact equality makes a larger set pathological. */
export const RESULT_CAP = 10;
/** Rows fetched: one more than the cap, so `truncated` is OBSERVED rather than guessed. */
export const FETCH_LIMIT = RESULT_CAP + 1;

/**
 * Accepted phone key lengths. A stored fragment such as "03" must never match a typed "03", so a
 * value outside this range yields NO key at all rather than a short one.
 */
export const PHONE_KEY_LENGTHS = [10, 11] as const;

/** Columns the action selects. `name` is included so the legacy label fallback can actually fire. */
export const DUPLICATE_SELECT_COLUMNS =
  "id, dealer_id, last_name, first_name, name, phone, match_phone_digits, match_name_norm, match_kana_norm";

/** Why a particular row was returned. Reported per candidate so the operator can judge it. */
export type DuplicateReason = WizardDuplicateReason;

export interface DuplicateMatchKeys {
  /** Set only when the input yields exactly 10 or 11 digits. */
  readonly phoneKey: string | null;
  /**
   * Set whenever the entered name is non-blank after normalisation. Carried INDEPENDENTLY of
   * `kanaKey`: a full name on its own is now a matching rule, so the name key is no longer voided
   * when kana is missing.
   */
  readonly nameKey: string | null;
  /** Set whenever the entered kana is non-blank after normalisation. */
  readonly kanaKey: string | null;
}

export type DuplicatePlanResult =
  | { readonly ok: true; readonly keys: DuplicateMatchKeys }
  | { readonly ok: false; readonly code: "NOT_APPLICABLE" };

/** NFKC, or the empty string for any non-string. Never throws. */
export function normalizeNfkc(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFKC");
}

/**
 * The phone match key: NFKC, every non-digit removed, and ONLY then a length gate.
 *
 * The length gate lives here rather than at the call site because the database applies the identical
 * rule inside `match_phone_digits`. Keeping both in the key itself means neither side can forget it:
 * an out-of-range value is null, and null equals nothing.
 */
export function phoneMatchKey(raw: unknown): string | null {
  const digits = normalizeNfkc(raw).replace(/[^0-9]/g, "");
  return (PHONE_KEY_LENGTHS as readonly number[]).includes(digits.length) ? digits : null;
}

/**
 * The name/kana match key: NFKC, then ALL whitespace removed.
 *
 * Removed rather than collapsed: 「山田 太郎」 and 「山田太郎」 are one person, and NFKC has already
 * folded the ideographic space U+3000 to U+0020 so a single rule covers both spellings. For kana the
 * same NFKC pass recomposes half-width katakana, dakuten included.
 */
export function textMatchKey(raw: unknown): string | null {
  const normalized = normalizeNfkc(raw).replace(/\s+/g, "");
  return normalized === "" ? null : normalized;
}

/** Alias kept explicit at the call sites so the two branches read as the rule they implement. */
export const nameMatchKey = textMatchKey;
export const kanaMatchKey = textMatchKey;

/**
 * Whether a check is worth issuing, and with which keys.
 *
 * NOT_APPLICABLE is distinct from "no candidates": it means no rule can fire on this input, so the
 * operator is told nothing rather than being shown a reassuring empty result they did not earn.
 *
 * Three rules are applicable, any one of which is enough: an in-range phone, or a full name (with
 * kana if present, without it if not). A kana key on its own is NOT a rule — kana without a name
 * identifies nobody — so it never makes a check applicable by itself.
 *
 * ── WHY A FULL NAME ALONE NOW QUALIFIES ─────────────────────────────────────────
 * The matched value is the WHOLE normalised name, so a surname, a partial, a prefix or a suffix
 * can never equal it — this is exact identity of the entire entered name, not a loose match. It was
 * added because a 車検証 carries no telephone number and prints furigana only when the registration
 * happens to include it: without this rule, OCR intake produces no advisory at all. Manual and OCR
 * entry are treated identically and neither has a bypass.
 */
export function planDuplicateCheck(raw: {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
}): DuplicatePlanResult {
  const phoneKey = phoneMatchKey(raw.phone);
  const nameKey = nameMatchKey(raw.name);
  const kanaKey = kanaMatchKey(raw.kana);

  if (phoneKey === null && nameKey === null) return { ok: false, code: "NOT_APPLICABLE" };

  // Kana is carried only alongside a name: it refines the reason, it is never a rule of its own.
  return { ok: true, keys: { phoneKey, nameKey, kanaKey: nameKey === null ? null : kanaKey } };
}

/**
 * Quote a value for a PostgREST filter.
 *
 * A raw comma or parenthesis would otherwise be read as filter SYNTAX and silently change which
 * columns are compared. Double-quoting is PostgREST's own mechanism; embedded quotes and backslashes
 * are escaped so the quoting cannot be broken out of. Company names routinely contain parentheses,
 * so this is a live concern rather than a theoretical one.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * The PostgREST `or=` expression.
 *
 * Every branch is EQUALITY on an indexed generated column — never `ilike`, never a prefix, never a
 * wildcard. `match_name_norm` holds the WHOLE normalised name, so an equality on it cannot be
 * satisfied by a surname or any partial.
 *
 * ── WHY THE NESTED name+kana CLAUSE IS STILL EMITTED ────────────────────────────
 * For RETRIEVAL the name-only clause subsumes it: any row matching name AND kana also matches name.
 * It is kept because it states the rule the classifier applies, and because the two stop being
 * interchangeable the moment the rules are separated again. Both are served by
 * `customers_match_name_kana_idx` — a name-only equality uses its leading (dealer_id,
 * match_name_norm) columns — so the new rule needs no additional index.
 *
 * Retrieval is deliberately the UNION of the rules; WHICH reason a row is reported under is decided
 * afterwards by `classifyReason`, not by the clause that fetched it. That separation is what lets a
 * row whose kana DIFFERS still surface, and be reported honestly as a name-only match.
 */
export function buildDuplicateOrFilter(keys: DuplicateMatchKeys): string {
  const clauses: string[] = [];
  if (keys.phoneKey !== null) {
    clauses.push(`match_phone_digits.eq.${quoteFilterValue(keys.phoneKey)}`);
  }
  if (keys.nameKey !== null && keys.kanaKey !== null) {
    clauses.push(
      `and(match_name_norm.eq.${quoteFilterValue(keys.nameKey)},` +
        `match_kana_norm.eq.${quoteFilterValue(keys.kanaKey)})`,
    );
  }
  if (keys.nameKey !== null) {
    clauses.push(`match_name_norm.eq.${quoteFilterValue(keys.nameKey)}`);
  }
  return clauses.join(",");
}

/**
 * Why this row came back, at the STRONGEST rule that holds. Precedence is phone > name+kana >
 * name-only: exactly one reason is shown, and it is the most informative one available, so the
 * operator is never asked to weigh two explanations for the same row.
 *
 * The name-only branch is checked LAST and is the fallback. A row whose name matches but whose kana
 * differs falls through to it and is reported as a name-only match — honestly, rather than being
 * dropped or overstated as a name+kana agreement.
 */
export function classifyReason(
  row: { match_phone_digits?: string | null; match_name_norm?: string | null; match_kana_norm?: string | null },
  keys: DuplicateMatchKeys,
): DuplicateReason | null {
  if (keys.phoneKey !== null && row.match_phone_digits === keys.phoneKey) return "phone";
  if (
    keys.nameKey !== null &&
    keys.kanaKey !== null &&
    row.match_name_norm === keys.nameKey &&
    row.match_kana_norm === keys.kanaKey
  ) {
    return "name_kana";
  }
  if (keys.nameKey !== null && row.match_name_norm === keys.nameKey) return "name";
  // No rule explains this row. It is a defect, not a candidate — the caller drops it rather than
  // showing the operator a match it cannot justify.
  return null;
}

export interface CappedCandidates<T> {
  readonly rows: readonly T[];
  readonly truncated: boolean;
}

/**
 * Apply the cap to a fetch of up to FETCH_LIMIT rows. Receiving more than the cap is what PROVES
 * truncation; the surplus row is discarded and never shown. This is the property the 200-row helper
 * this feature replaces did not have: it truncated invisibly.
 */
export function applyCandidateCap<T>(fetched: readonly T[]): CappedCandidates<T> {
  if (fetched.length > RESULT_CAP) {
    return { rows: fetched.slice(0, RESULT_CAP), truncated: true };
  }
  return { rows: fetched, truncated: false };
}

/** A candidate as it leaves the server: the minimal reference plus why it matched. */
export type DuplicateCandidate = WizardDuplicateCandidate;
