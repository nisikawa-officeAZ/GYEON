// B1.1 — PPF installation coefficient + dealer-scoped PPF/coating adjustment: PURE CORE.
//
// No React, no server module, no Supabase, no DB, no "server-only", no clock, no `any`, no cast.
// Mirrors the division of responsibility already used by `wizard-catalog-authoring-core.ts`:
// this core rejects obviously bad input BEFORE any RPC call, and the SQL CHECK constraints remain
// the AUTHORITATIVE validator. Nothing here re-implements the pricing engine — the two exported
// arithmetic helpers only compose a line's unit price, exactly as the adapter already does for
// quantity extension.

// ── Installation coefficient ─────────────────────────────────────────────────
// Basis points, integer. 10000 = ×1.0 — the same convention as the coupon percentages and
// `ew-dc-1`, so no float multiplier ever reaches a yen amount.
export const COEFFICIENT_BP_IDENTITY = 10_000;

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** A coefficient is usable only when it is a positive integer. Null/absent = no coefficient. */
export function isValidInstallCoefficientBp(bp: unknown): bp is number {
  return isInt(bp) && bp > 0;
}

/**
 * Apply an installation coefficient to a unit price. An absent or invalid coefficient is the
 * IDENTITY — it must never silently zero or discount a line.
 */
export function applyInstallCoefficientBp(unitPriceYen: number, bp: number | null | undefined): number {
  if (!Number.isFinite(unitPriceYen) || unitPriceYen < 0) return 0;
  if (!isValidInstallCoefficientBp(bp)) return Math.round(unitPriceYen);
  return Math.round((unitPriceYen * bp) / COEFFICIENT_BP_IDENTITY);
}

// ── PPF + coating adjustment ─────────────────────────────────────────────────

export type PpfCoatingAdjustmentType = "amount" | "percent";

/** Stable identity used to store the approved dealer-wide combination rule in the existing table. */
export const GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE = "all_body_ppf";
export const GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE = "all_body_coating";

/**
 * One dealer-authored reduction rule, projected from `dealer_ppf_coating_adjustments`.
 * `adjustmentValue` is yen for `amount` and integer basis points for `percent`.
 * Identity is the pair of stable CODES — never labels, never array indices.
 */
export interface PpfCoatingAdjustmentRule {
  readonly ruleId: string;
  readonly ppfMethodCode: string;
  readonly coatingCode: string;
  readonly adjustmentType: PpfCoatingAdjustmentType;
  readonly adjustmentValue: number;
  readonly isActive: boolean;
}

/**
 * A rule as ACTUALLY resolved for one estimate. SNAPSHOT VALUES: the type, the authored value and
 * the computed yen reduction are frozen here so a later rule edit cannot change how an already
 * saved estimate is explained.
 */
export interface ResolvedPpfCoatingAdjustment {
  readonly ruleId: string;
  readonly ppfMethodCode: string;
  readonly coatingCode: string;
  readonly adjustmentType: PpfCoatingAdjustmentType;
  readonly adjustmentValue: number;
  readonly reductionYen: number;
}

export type PpfCoatingAdjustmentErrorCode =
  | "INVALID_PPF_METHOD_CODE"
  | "INVALID_COATING_CODE"
  | "INVALID_ADJUSTMENT_TYPE"
  | "INVALID_ADJUSTMENT_VALUE";

export type PpfCoatingAdjustmentValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: PpfCoatingAdjustmentErrorCode; readonly message: string };

/** Same code shape the catalog enforces (`wci_code_format_check`). */
const CODE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface PpfCoatingAdjustmentInput {
  readonly ppfMethodCode: string;
  readonly coatingCode: string;
  readonly adjustmentType: string;
  readonly adjustmentValue: number;
}

/**
 * Pre-RPC shape check. Deliberately thin: uniqueness, tenancy and lifecycle are enforced by the
 * database, and this must not drift into a second rulebook.
 */
export function validatePpfCoatingAdjustmentRule(
  input: PpfCoatingAdjustmentInput,
): PpfCoatingAdjustmentValidation {
  if (typeof input.ppfMethodCode !== "string" || !CODE_RE.test(input.ppfMethodCode)) {
    return { ok: false, code: "INVALID_PPF_METHOD_CODE", message: "PPF施工方法の識別子が不正です" };
  }
  if (typeof input.coatingCode !== "string" || !CODE_RE.test(input.coatingCode)) {
    return { ok: false, code: "INVALID_COATING_CODE", message: "コーティングの識別子が不正です" };
  }
  if (input.adjustmentType !== "amount" && input.adjustmentType !== "percent") {
    return { ok: false, code: "INVALID_ADJUSTMENT_TYPE", message: "減額の種別が不正です" };
  }
  if (!isInt(input.adjustmentValue) || input.adjustmentValue < 0) {
    return { ok: false, code: "INVALID_ADJUSTMENT_VALUE", message: "減額の値が不正です" };
  }
  if (input.adjustmentType === "percent" && input.adjustmentValue > COEFFICIENT_BP_IDENTITY) {
    return { ok: false, code: "INVALID_ADJUSTMENT_VALUE", message: "減額率は100%を超えられません" };
  }
  return { ok: true };
}

/**
 * Resolve the single dealer-wide combination reduction. The existing pair-keyed table stores it
 * under one reserved, stable identity, so multiplicity remains unrepresentable without a migration.
 *
 * Returns null when no active rule matches. The reduction is clamped to the base so a rule can
 * never drive a line negative.
 */
export function resolveGlobalPpfCoatingAdjustment(
  rules: readonly PpfCoatingAdjustmentRule[],
  baseYen: number,
): ResolvedPpfCoatingAdjustment | null {
  if (!Number.isFinite(baseYen) || baseYen <= 0) return null;

  const rule = rules.find(
    (r) => r.isActive
      && r.ppfMethodCode === GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE
      && r.coatingCode === GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
  );
  if (!rule) return null;

  const raw =
    rule.adjustmentType === "amount"
      ? rule.adjustmentValue
      : Math.round((baseYen * rule.adjustmentValue) / COEFFICIENT_BP_IDENTITY);
  const reductionYen = Math.min(Math.max(raw, 0), Math.round(baseYen));

  return {
    ruleId: rule.ruleId,
    ppfMethodCode: rule.ppfMethodCode,
    coatingCode: rule.coatingCode,
    adjustmentType: rule.adjustmentType,
    adjustmentValue: rule.adjustmentValue,
    reductionYen,
  };
}
