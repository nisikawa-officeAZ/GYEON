// B1.1 — Configured coupon resolution → a single yen total for the EXISTING engine slot.
//
// PURE. No React, no server module, no DB, no clock, no randomness, no `any`, no cast.
//
// ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────────
// `calculateEstimate` already accepts `DiscountInput.couponTotal`; nothing ever computed it.
// This module computes it from the dealer's authored coupon catalog and hands the result to
// that existing slot. It deliberately does NOT change the engine, its sum-then-clamp discount
// order, its tax behaviour, or its rounding:
//
//   combinedDiscount = couponTotal + extraAmount + dealerDiscount   ← engine, unchanged
//   clamped to [0, subtotal]                                        ← engine, unchanged
//
// Every coupon is therefore evaluated against the SAME defined base (the subtotal), and the
// amounts are SUMMED — never applied sequentially against a shrinking remainder. Sequential
// application is `discount-coupon-pricing.ts` (`ew-dc-1`) semantics; reconciling the two
// engines is B7 work and is intentionally NOT done here.
//
// Over-application is not clamped locally: the engine clamps the COMBINED discount, and it is
// the single authority for that. Clamping twice would silently disagree with the engine.
//
// ── INTEGER SAFETY ──────────────────────────────────────────────────────────────
// Percentages are integer basis points (1% = 100bp, 100% = 10000bp) — the same convention the
// catalog column and `ew-dc-1` use — so no float percentage ever reaches a yen amount.

/** 1% = 100bp. */
export const BASIS_POINTS_PER_PERCENT = 100;
/** 100% = 10000bp. */
export const FULL_BASIS_POINTS = 10_000;

export type ConfiguredCouponValue =
  | { readonly kind: "amount"; readonly amountYen: number }
  | { readonly kind: "percent"; readonly basisPoints: number };

/**
 * One dealer-authored coupon, already projected from `wizard_catalog_items`. `couponId` is the
 * item's server-owned uuid; `code` is its stable, never-reused catalog code. `label` is display
 * text and is NEVER used as identity.
 */
export interface ConfiguredCoupon {
  readonly couponId: string;
  readonly code: string;
  readonly label: string;
  readonly value: ConfiguredCouponValue;
  readonly combinable: boolean;
  /** ISO `YYYY-MM-DD`, or null for open-ended. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly isActive: boolean;
  readonly displayOrder: number;
}

/**
 * A coupon as ACTUALLY resolved for one estimate. These are SNAPSHOT VALUES: label, kind and
 * amount are frozen here so a later edit to the coupon rule can never change how an already
 * saved estimate is explained.
 */
export interface ResolvedCouponApplication {
  readonly couponId: string;
  readonly code: string;
  readonly label: string;
  readonly valueKind: "amount" | "percent";
  /** yen for `amount`; basis points for `percent`. The authored value, frozen. */
  readonly valueRaw: number;
  /** yen actually contributed to `couponTotal`, frozen. */
  readonly appliedAmount: number;
}

export type ConfiguredCouponErrorCode =
  | "UNKNOWN_COUPON"
  | "INACTIVE_COUPON"
  | "COUPON_OUTSIDE_VALIDITY"
  | "NON_COMBINABLE_COUPON_CONFLICT"
  | "INVALID_COUPON_VALUE"
  | "DUPLICATE_COUPON_ID"
  | "INVALID_SUBTOTAL";

export type ConfiguredCouponResolution =
  | {
      readonly ok: true;
      readonly applications: readonly ResolvedCouponApplication[];
      readonly couponTotal: number;
    }
  | {
      readonly ok: false;
      readonly code: ConfiguredCouponErrorCode;
      readonly unresolvedCouponIds: readonly string[];
      readonly message: string;
    };

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Integer-safe percentage of a yen base, in basis points. `Math.round` is the canonical rule —
 * the same one `ew-dc-1` uses — so the two engines can never disagree on a converted amount.
 */
export function percentOfYen(baseYen: number, basisPoints: number): number {
  if (!Number.isFinite(baseYen) || baseYen <= 0) return 0;
  if (!isInt(basisPoints) || basisPoints <= 0) return 0;
  return Math.round((baseYen * basisPoints) / FULL_BASIS_POINTS);
}

/**
 * Convert an operator-entered percentage discount into the yen `DiscountInput.extraAmount` the
 * engine already understands. Returns 0 for anything not a usable percentage, so a malformed
 * input can never become a silent discount.
 */
export function percentageDiscountToYen(subtotalYen: number, percentage: number): number {
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return 0;
  const bp = Math.round(percentage * BASIS_POINTS_PER_PERCENT);
  return percentOfYen(subtotalYen, bp);
}

/** Deterministic order: displayOrder, then code, then couponId. Never label, never input order. */
function sortCoupons(items: readonly ConfiguredCoupon[]): ConfiguredCoupon[] {
  return [...items].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return a.couponId < b.couponId ? -1 : a.couponId > b.couponId ? 1 : 0;
  });
}

function fail(
  code: ConfiguredCouponErrorCode,
  unresolvedCouponIds: readonly string[],
  message: string,
): ConfiguredCouponResolution {
  return { ok: false, code, unresolvedCouponIds, message };
}

/**
 * Resolve the operator's selected coupon ids against the dealer's authored coupons.
 *
 * FAIL-CLOSED AND ALL-OR-NOTHING: any unknown, inactive, out-of-validity, malformed, duplicated
 * or non-combinable-conflicting selection rejects the WHOLE set. A coupon set is never partially
 * applied, because a partially applied set would silently under-discount a customer-visible quote.
 *
 * `calculationDate` is passed in (ISO `YYYY-MM-DD`) — this module reads no clock, so it stays pure
 * and its tests stay deterministic.
 */
export function resolveConfiguredCoupons(
  selectedCouponIds: readonly string[],
  coupons: readonly ConfiguredCoupon[],
  subtotalYen: number,
  calculationDate: string,
): ConfiguredCouponResolution {
  if (selectedCouponIds.length === 0) {
    return { ok: true, applications: [], couponTotal: 0 };
  }
  if (!Number.isFinite(subtotalYen) || subtotalYen < 0) {
    return fail("INVALID_SUBTOTAL", selectedCouponIds, "小計が確定していないため、クーポンを適用できません。");
  }

  const seen = new Set<string>();
  for (const id of selectedCouponIds) {
    if (seen.has(id)) {
      return fail("DUPLICATE_COUPON_ID", [id], "同じクーポンが重複して選択されています。");
    }
    seen.add(id);
  }

  const byId = new Map(coupons.map((c) => [c.couponId, c]));
  const picked: ConfiguredCoupon[] = [];
  for (const id of selectedCouponIds) {
    const c = byId.get(id);
    if (!c) {
      return fail("UNKNOWN_COUPON", [id], "選択されたクーポンは店舗設定に存在しません。");
    }
    if (!c.isActive) {
      return fail("INACTIVE_COUPON", [id], `クーポン「${c.label}」は無効化されています。`);
    }
    if (c.validFrom !== null && (!isIsoDate(c.validFrom) || calculationDate < c.validFrom)) {
      return fail("COUPON_OUTSIDE_VALIDITY", [id], `クーポン「${c.label}」は有効期間外です。`);
    }
    if (c.validTo !== null && (!isIsoDate(c.validTo) || calculationDate > c.validTo)) {
      return fail("COUPON_OUTSIDE_VALIDITY", [id], `クーポン「${c.label}」は有効期間外です。`);
    }
    if (c.value.kind === "amount" && (!isInt(c.value.amountYen) || c.value.amountYen < 0)) {
      return fail("INVALID_COUPON_VALUE", [id], `クーポン「${c.label}」の金額が不正です。`);
    }
    if (
      c.value.kind === "percent" &&
      (!isInt(c.value.basisPoints) || c.value.basisPoints < 0 || c.value.basisPoints > FULL_BASIS_POINTS)
    ) {
      return fail("INVALID_COUPON_VALUE", [id], `クーポン「${c.label}」の割引率が不正です。`);
    }
    picked.push(c);
  }

  // Non-combinable: legal alone, never alongside anything else.
  if (picked.length > 1) {
    const blocking = picked.filter((c) => !c.combinable);
    if (blocking.length > 0) {
      return fail(
        "NON_COMBINABLE_COUPON_CONFLICT",
        blocking.map((c) => c.couponId),
        `クーポン「${blocking[0].label}」は他のクーポンと併用できません。`,
      );
    }
  }

  const applications: ResolvedCouponApplication[] = sortCoupons(picked).map((c) => {
    const appliedAmount =
      c.value.kind === "amount" ? c.value.amountYen : percentOfYen(subtotalYen, c.value.basisPoints);
    return {
      couponId: c.couponId,
      code: c.code,
      label: c.label,
      valueKind: c.value.kind,
      valueRaw: c.value.kind === "amount" ? c.value.amountYen : c.value.basisPoints,
      appliedAmount,
    };
  });

  return {
    ok: true,
    applications,
    couponTotal: applications.reduce((s, a) => s + a.appliedAmount, 0),
  };
}
