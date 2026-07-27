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
  /** Set only when the input is non-blank after normalisation. */
  readonly nameKey: string | null;
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
 * NOT_APPLICABLE is distinct from "no candidates": it means the rule cannot fire on this input, so
 * the operator is told nothing rather than being shown a reassuring empty result they did not earn.
 * The name branch requires BOTH name and kana — a name alone is far too common a collision in this
 * market to warn on, and the product decision rules it out explicitly.
 */
export function planDuplicateCheck(raw: {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
}): DuplicatePlanResult {
  const phoneKey = phoneMatchKey(raw.phone);
  const nameKey = nameMatchKey(raw.name);
  const kanaKey = kanaMatchKey(raw.kana);

  const nameBranchUsable = nameKey !== null && kanaKey !== null;
  if (phoneKey === null && !nameBranchUsable) return { ok: false, code: "NOT_APPLICABLE" };

  // A name key without a kana key (or vice versa) is carried as null so the filter cannot be built
  // from half the rule.
  return {
    ok: true,
    keys: { phoneKey, nameKey: nameBranchUsable ? nameKey : null, kanaKey: nameBranchUsable ? kanaKey : null },
  };
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
 * Both branches are EQUALITY on an indexed generated column — never `ilike`, never a prefix. The
 * name branch is a nested `and(...)` so name and kana must both hold; expressing it as two top-level
 * clauses would OR them and warn on a name alone.
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
  return clauses.join(",");
}

/**
 * Why this row came back. Phone is reported in preference to name+kana when both hold: it is the
 * stronger signal, and showing one reason keeps the operator's decision simple.
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
  // Neither rule explains this row. It is a defect, not a candidate — the caller drops it rather
  // than showing the operator a match it cannot justify.
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
