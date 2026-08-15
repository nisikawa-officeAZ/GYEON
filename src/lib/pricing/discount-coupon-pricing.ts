// EW-DC-1 — Canonical discount / coupon / pricing-parity contract (PURE, no I/O).
//
// This module defines the ONE monetary calculation for manual/adjustment discounts and
// multiple coupons on top of the existing authoritative line/tax math. It is NOT wired to
// any UI, save action, RPC, or database in this phase — it is the reviewed contract that the
// future Wizard preview, server recalculation, and Supabase persistence phases must consume.
//
// Rounding / tax / subtotal / final-clamp authority is REUSED from estimate-totals.ts
// (lineTotal, calculateEstimateTotals) — this module never re-implements the tax or
// line-total formulas. It only adds the sequential dealer → manual → coupon reduction on
// top, then defers taxable/tax/grand-total to the shared authority.
//
// Money: all yen values are finite integers. Percentages: integer BASIS POINTS
// (1% = 100bp, 10% = 1000bp, 100% = 10000bp) — no floating-point percentage ambiguity.
// Coupon identity is the immutable couponId; labels are snapshot-only and never identity.

import { lineTotal, calculateEstimateTotals, type TotalsItemInput } from "./estimate-totals";

export const DISCOUNT_COUPON_CONTRACT_VERSION = "ew-dc-1" as const;
export type DiscountCouponContractVersion = typeof DISCOUNT_COUPON_CONTRACT_VERSION;

export const BASIS_POINTS_PER_PERCENT = 100;
export const FULL_BASIS_POINTS = 10_000; // 100%

// ── Intents / definitions ──────────────────────────────────────────────────────────
export type ManualDiscountIntent =
  | { readonly kind: "none" }
  | { readonly kind: "fixed"; readonly amountYen: number }
  | { readonly kind: "percentage"; readonly basisPoints: number };

export type CouponValue =
  | { readonly kind: "fixed"; readonly amountYen: number }
  | { readonly kind: "percentage"; readonly basisPoints: number };

/** A fully RESOLVED coupon definition. In production the server re-resolves these from the
 *  authoritative catalog/settings before calling — it never trusts browser-supplied definitions. */
export interface ResolvedCoupon {
  readonly couponId: string;      // identity — NEVER the label
  readonly label: string;         // immutable display snapshot (historical preservation)
  readonly value: CouponValue;    // fixed yen OR percentage basis points
  readonly combinable: boolean;   // coupon-to-coupon combinability
  readonly validFrom: string | null; // YYYY-MM-DD inclusive; null = open start
  readonly validTo: string | null;   // YYYY-MM-DD inclusive; null = open end
  readonly displayOrder: number;  // deterministic display/calculation order (ties broken by couponId)
}

export interface PricingLineInput {
  readonly lineId: string;
  readonly quantity: number;
  readonly unitPrice: number;          // yen integer
  readonly discountRatePercent: number; // per-line discount percent (existing lineTotal semantics)
}

export interface DiscountCouponPricingInput {
  readonly calculationDate: string;    // explicit YYYY-MM-DD — never Date.now()/system date
  readonly lines: readonly PricingLineInput[];
  readonly taxRatePercent: number;     // integer percent (default authority is 10)
  readonly dealerTradeBasisPoints: number; // dealer/trade discount % off subtotal (0 = none)
  readonly manualDiscount: ManualDiscountIntent;
  readonly coupons: readonly ResolvedCoupon[];
}

// ── Result breakdown ───────────────────────────────────────────────────────────────
export interface LineSnapshot {
  readonly lineId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountRatePercent: number;
  readonly lineTotal: number;
}

export interface CouponApplication {
  readonly couponId: string;
  readonly label: string;
  readonly value: CouponValue;     // configured value snapshot
  readonly combinable: boolean;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly displayOrder: number;
  readonly appliedAmount: number;  // yen actually applied (after clamp)
}

export type DiscountCouponErrorCode =
  | "DUPLICATE_COUPON_ID"
  | "UNKNOWN_COUPON"
  | "INVALID_FIXED_AMOUNT"
  | "INVALID_PERCENTAGE"
  | "COUPON_OUTSIDE_VALIDITY"
  | "NON_COMBINABLE_COUPON_CONFLICT"
  | "INVALID_MANUAL_DISCOUNT"
  | "INVALID_CALCULATION_DATE";

export interface DiscountCouponError {
  readonly code: DiscountCouponErrorCode;
  readonly message: string;
  readonly couponId?: string;
  readonly field?: string;
}

export interface DiscountCouponWarning {
  readonly code: string;
  readonly message: string;
  readonly couponId?: string;
}

export interface DiscountCouponPricingResult {
  readonly contractVersion: DiscountCouponContractVersion;
  readonly calculationDate: string;
  readonly lines: readonly LineSnapshot[];
  readonly subtotal: number;
  readonly dealerTradeBasisPoints: number;
  readonly dealerTradeDiscount: number;
  readonly remainingAfterDealer: number;
  readonly manualDiscount: ManualDiscountIntent;
  readonly manualDiscountApplied: number;
  readonly remainingAfterManual: number;
  readonly coupons: readonly CouponApplication[];
  readonly couponTotal: number;
  readonly totalDiscount: number;
  readonly taxableAmount: number;
  readonly taxRatePercent: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
  readonly warnings: readonly DiscountCouponWarning[];
  readonly errors: readonly DiscountCouponError[];
  readonly valid: boolean; // true iff errors.length === 0
}

// ── Pure helpers ───────────────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(lo, v), hi);

/** Percentage of a base in basis points, rounded (Math.round) — the canonical percentage rule. */
const applyPercentage = (base: number, basisPoints: number): number =>
  Math.round((base * basisPoints) / FULL_BASIS_POINTS);

const isInt = (n: number): boolean => Number.isInteger(n);

/** Deterministic YYYY-MM-DD validation with NO Date object (no timezone/system-date inference). */
function isValidDateStr(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

/** Reduce `remaining` by a fixed/percentage value, clamped to [0, remaining]. Returns applied yen. */
function applyValue(value: CouponValue | ManualDiscountIntent, remaining: number): number {
  if (value.kind === "none") return 0;
  if (value.kind === "fixed") return clamp(value.amountYen, 0, remaining);
  // percentage
  return clamp(applyPercentage(remaining, value.basisPoints), 0, remaining);
}

// ── Validation (blocking; never silently discards/zeros/partially applies a coupon) ──
function validate(input: DiscountCouponPricingInput): DiscountCouponError[] {
  const errors: DiscountCouponError[] = [];

  if (!isValidDateStr(input.calculationDate)) {
    errors.push({ code: "INVALID_CALCULATION_DATE", message: `calculationDate must be YYYY-MM-DD: ${input.calculationDate}`, field: "calculationDate" });
  }

  // manual discount well-formedness
  const md = input.manualDiscount;
  if (md.kind === "fixed" && (!isInt(md.amountYen) || md.amountYen < 0)) {
    errors.push({ code: "INVALID_MANUAL_DISCOUNT", message: "manual fixed discount must be a non-negative integer", field: "manualDiscount.amountYen" });
  }
  if (md.kind === "percentage" && (!isInt(md.basisPoints) || md.basisPoints < 0 || md.basisPoints > FULL_BASIS_POINTS)) {
    errors.push({ code: "INVALID_MANUAL_DISCOUNT", message: "manual percentage must be integer basis points in [0, 10000]", field: "manualDiscount.basisPoints" });
  }

  // coupons
  const seen = new Set<string>();
  for (const c of input.coupons) {
    if (!c.couponId || typeof c.couponId !== "string") {
      errors.push({ code: "UNKNOWN_COUPON", message: "coupon has no resolved identity", couponId: c.couponId });
      continue;
    }
    if (seen.has(c.couponId)) {
      errors.push({ code: "DUPLICATE_COUPON_ID", message: `duplicate coupon id: ${c.couponId}`, couponId: c.couponId });
    }
    seen.add(c.couponId);

    const v = c.value;
    if (v == null || (v.kind !== "fixed" && v.kind !== "percentage")) {
      errors.push({ code: "UNKNOWN_COUPON", message: `coupon ${c.couponId} has an unresolved value definition`, couponId: c.couponId });
    } else if (v.kind === "fixed" && (!isInt(v.amountYen) || v.amountYen < 0)) {
      errors.push({ code: "INVALID_FIXED_AMOUNT", message: `coupon ${c.couponId} fixed amount must be a non-negative integer`, couponId: c.couponId });
    } else if (v.kind === "percentage" && (!isInt(v.basisPoints) || v.basisPoints < 0 || v.basisPoints > FULL_BASIS_POINTS)) {
      errors.push({ code: "INVALID_PERCENTAGE", message: `coupon ${c.couponId} percentage must be integer basis points in [0, 10000]`, couponId: c.couponId });
    }

    // inclusive validity window (lexicographic compare valid for YYYY-MM-DD)
    if (isValidDateStr(input.calculationDate)) {
      if (c.validFrom !== null && input.calculationDate < c.validFrom) {
        errors.push({ code: "COUPON_OUTSIDE_VALIDITY", message: `coupon ${c.couponId} not yet valid (from ${c.validFrom})`, couponId: c.couponId });
      }
      if (c.validTo !== null && input.calculationDate > c.validTo) {
        errors.push({ code: "COUPON_OUTSIDE_VALIDITY", message: `coupon ${c.couponId} expired (to ${c.validTo})`, couponId: c.couponId });
      }
    }
  }

  // combinability applies BETWEEN coupons only (a non-combinable coupon still coexists with a manual discount)
  if (input.coupons.length > 1 && input.coupons.some((c) => c.combinable === false)) {
    errors.push({ code: "NON_COMBINABLE_COUPON_CONFLICT", message: "a non-combinable coupon cannot be combined with another coupon" });
  }

  return errors;
}

/** Deterministic coupon order: displayOrder ascending, ties broken by couponId ascending. */
function sortCoupons(coupons: readonly ResolvedCoupon[]): ResolvedCoupon[] {
  return [...coupons].sort((a, b) =>
    a.displayOrder !== b.displayOrder ? a.displayOrder - b.displayOrder : (a.couponId < b.couponId ? -1 : a.couponId > b.couponId ? 1 : 0),
  );
}

// ── Canonical calculation ────────────────────────────────────────────────────────────
export function computeDiscountCouponPricing(input: DiscountCouponPricingInput): DiscountCouponPricingResult {
  const errors = validate(input);

  // Line totals + subtotal reuse the shared authority (lineTotal).
  const lines: LineSnapshot[] = input.lines.map((l) => ({
    lineId: l.lineId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountRatePercent: l.discountRatePercent,
    lineTotal: lineTotal(l.quantity, l.unitPrice, l.discountRatePercent),
  }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // 1. dealer/trade discount — computed FROM subtotal, clamped.
  const dealerBp = isInt(input.dealerTradeBasisPoints) ? clamp(input.dealerTradeBasisPoints, 0, FULL_BASIS_POINTS) : 0;
  const dealerTradeDiscount = clamp(applyPercentage(subtotal, dealerBp), 0, subtotal);
  const remainingAfterDealer = subtotal - dealerTradeDiscount;

  // 2. manual/adjustment discount — applied to the remaining amount.
  const manualDiscountApplied = errors.some((e) => e.code === "INVALID_MANUAL_DISCOUNT")
    ? 0
    : applyValue(input.manualDiscount, remainingAfterDealer);
  const remainingAfterManual = remainingAfterDealer - manualDiscountApplied;

  // 3. coupons — applied sequentially to the remaining amount in deterministic order.
  //    Any coupon/validation error blocks the whole coupon set (never partially applied).
  const couponBlocking = errors.some((e) =>
    e.code === "DUPLICATE_COUPON_ID" || e.code === "UNKNOWN_COUPON" || e.code === "INVALID_FIXED_AMOUNT" ||
    e.code === "INVALID_PERCENTAGE" || e.code === "COUPON_OUTSIDE_VALIDITY" || e.code === "NON_COMBINABLE_COUPON_CONFLICT" ||
    e.code === "INVALID_CALCULATION_DATE");

  const applications: CouponApplication[] = [];
  let remaining = remainingAfterManual;
  if (!couponBlocking) {
    for (const c of sortCoupons(input.coupons)) {
      const appliedAmount = applyValue(c.value, remaining);
      remaining -= appliedAmount;
      applications.push({
        couponId: c.couponId, label: c.label, value: c.value, combinable: c.combinable,
        validFrom: c.validFrom, validTo: c.validTo, displayOrder: c.displayOrder, appliedAmount,
      });
    }
  }
  const couponTotal = applications.reduce((s, a) => s + a.appliedAmount, 0);

  // 4. total reduction, then defer taxable/tax/grand-total to the shared authority.
  const totalDiscount = dealerTradeDiscount + manualDiscountApplied + couponTotal;
  const items: TotalsItemInput[] = input.lines.map((l) => ({ quantity: l.quantity, unit_price: l.unitPrice, discount_rate: l.discountRatePercent }));
  const totals = calculateEstimateTotals(items, totalDiscount, input.taxRatePercent);
  const taxableAmount = Math.max(0, subtotal - totalDiscount); // guaranteed >= 0 (each step clamps to remaining)

  return {
    contractVersion: DISCOUNT_COUPON_CONTRACT_VERSION,
    calculationDate: input.calculationDate,
    lines,
    subtotal,
    dealerTradeBasisPoints: dealerBp,
    dealerTradeDiscount,
    remainingAfterDealer,
    manualDiscount: input.manualDiscount,
    manualDiscountApplied,
    remainingAfterManual,
    coupons: applications,
    couponTotal,
    totalDiscount,
    taxableAmount,
    taxRatePercent: totals.tax_rate,
    taxAmount: totals.tax_amount,
    grandTotal: totals.total,
    warnings: [],
    errors,
    valid: errors.length === 0,
  };
}
