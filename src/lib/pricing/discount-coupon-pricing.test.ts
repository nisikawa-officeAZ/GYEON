// EW-DC-1 — canonical discount/coupon pricing tests.
// Run: node --import tsx --test src/lib/pricing/discount-coupon-pricing.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeDiscountCouponPricing,
  DISCOUNT_COUPON_CONTRACT_VERSION,
  type DiscountCouponPricingInput,
  type ManualDiscountIntent,
  type CouponValue,
  type ResolvedCoupon,
} from "./discount-coupon-pricing";

const DATE = "2026-07-17";
const line = (unitPrice: number, quantity = 1, discountRatePercent = 0, lineId = "L1") =>
  ({ lineId, quantity, unitPrice, discountRatePercent });
const fixed = (amountYen: number): CouponValue => ({ kind: "fixed", amountYen });
const pct = (basisPoints: number): CouponValue => ({ kind: "percentage", basisPoints });
const NONE: ManualDiscountIntent = { kind: "none" };
const coupon = (couponId: string, value: CouponValue, o: Partial<ResolvedCoupon> = {}): ResolvedCoupon => ({
  couponId, label: o.label ?? `L(${couponId})`, value, combinable: o.combinable ?? true,
  validFrom: o.validFrom ?? null, validTo: o.validTo ?? null, displayOrder: o.displayOrder ?? 0,
});
const base = (o: Partial<DiscountCouponPricingInput> = {}): DiscountCouponPricingInput => ({
  calculationDate: DATE, lines: [line(10000)], taxRatePercent: 10,
  dealerTradeBasisPoints: 0, manualDiscount: NONE, coupons: [], ...o,
});

type Expect = {
  valid?: boolean; subtotal?: number; dealerTradeDiscount?: number; manualDiscountApplied?: number;
  couponTotal?: number; totalDiscount?: number; taxableAmount?: number; taxAmount?: number; grandTotal?: number;
};

const CASES: Array<{ name: string; input: DiscountCouponPricingInput; expect: Expect }> = [
  { name: "1. no discount", input: base(), expect: { valid: true, subtotal: 10000, totalDiscount: 0, taxableAmount: 10000, taxAmount: 1000, grandTotal: 11000 } },
  { name: "2. fixed manual discount", input: base({ manualDiscount: { kind: "fixed", amountYen: 2000 } }), expect: { manualDiscountApplied: 2000, taxableAmount: 8000, taxAmount: 800, grandTotal: 8800 } },
  { name: "3. percentage manual discount (10%)", input: base({ manualDiscount: { kind: "percentage", basisPoints: 1000 } }), expect: { manualDiscountApplied: 1000, taxableAmount: 9000, taxAmount: 900, grandTotal: 9900 } },
  { name: "4. dealer/trade discount (10%)", input: base({ dealerTradeBasisPoints: 1000 }), expect: { dealerTradeDiscount: 1000, taxableAmount: 9000, taxAmount: 900, grandTotal: 9900 } },
  { name: "5. one fixed coupon", input: base({ coupons: [coupon("c1", fixed(3000))] }), expect: { couponTotal: 3000, taxableAmount: 7000, taxAmount: 700, grandTotal: 7700 } },
  { name: "6. one percentage coupon (20%)", input: base({ coupons: [coupon("c1", pct(2000))] }), expect: { couponTotal: 2000, taxableAmount: 8000, taxAmount: 800, grandTotal: 8800 } },
  { name: "7. multiple combinable coupons (sequential on remaining)", input: base({ coupons: [coupon("c1", fixed(1000), { displayOrder: 1 }), coupon("c2", pct(1000), { displayOrder: 2 })] }), expect: { couponTotal: 1900, taxableAmount: 8100, taxAmount: 810, grandTotal: 8910 } },
  { name: "9. manual + multiple coupons", input: base({ manualDiscount: { kind: "fixed", amountYen: 1000 }, coupons: [coupon("c1", fixed(2000), { displayOrder: 1 }), coupon("c2", pct(1000), { displayOrder: 2 })] }), expect: { manualDiscountApplied: 1000, couponTotal: 2700, totalDiscount: 3700, taxableAmount: 6300, taxAmount: 630, grandTotal: 6930 } },
  { name: "13. inclusive validity boundary applies", input: base({ coupons: [coupon("c1", fixed(3000), { validFrom: DATE, validTo: DATE })] }), expect: { valid: true, couponTotal: 3000, taxableAmount: 7000, grandTotal: 7700 } },
  { name: "16. discount exceeding subtotal clamps safely", input: base({ manualDiscount: { kind: "fixed", amountYen: 999999 } }), expect: { manualDiscountApplied: 10000, totalDiscount: 10000, taxableAmount: 0, taxAmount: 0, grandTotal: 0 } },
  { name: "17. tax uses floor", input: base({ lines: [line(9999)] }), expect: { taxableAmount: 9999, taxAmount: 999, grandTotal: 10998 } },
  { name: "18. percentage deductions use Math.round (52.5 -> 53)", input: base({ lines: [line(105)], coupons: [coupon("c1", pct(5000))] }), expect: { couponTotal: 53, taxableAmount: 52 } },
  { name: "19. total never becomes negative", input: base({ manualDiscount: { kind: "fixed", amountYen: 10000 }, coupons: [coupon("c1", fixed(5000))] }), expect: { manualDiscountApplied: 10000, couponTotal: 0, taxableAmount: 0, taxAmount: 0, grandTotal: 0 } },
];

for (const c of CASES) {
  test(c.name, () => {
    const r = computeDiscountCouponPricing(c.input);
    assert.equal(r.contractVersion, DISCOUNT_COUPON_CONTRACT_VERSION);
    for (const [k, v] of Object.entries(c.expect)) {
      assert.equal((r as unknown as Record<string, unknown>)[k], v, `${c.name} :: ${k}`);
    }
    // invariant: taxable never negative
    assert.ok(r.taxableAmount >= 0, `${c.name} :: taxable >= 0`);
  });
}

// 8. deterministic coupon ordering — displayOrder asc, then couponId asc
test("8. deterministic coupon ordering (displayOrder then couponId)", () => {
  const r = computeDiscountCouponPricing(base({
    coupons: [coupon("zeta", fixed(100), { displayOrder: 2 }), coupon("beta", fixed(100), { displayOrder: 1 })],
  }));
  assert.deepEqual(r.coupons.map((a) => a.couponId), ["beta", "zeta"]);
  // tie on displayOrder -> couponId asc
  const t = computeDiscountCouponPricing(base({
    coupons: [coupon("b", fixed(100), { displayOrder: 5 }), coupon("a", fixed(100), { displayOrder: 5 })],
  }));
  assert.deepEqual(t.coupons.map((a) => a.couponId), ["a", "b"]);
});

// ── validation / blocking error cases (never silently discard/zero/partially apply) ──
function hasErr(input: DiscountCouponPricingInput, code: string) {
  const r = computeDiscountCouponPricing(input);
  assert.equal(r.valid, false, `expected invalid for ${code}`);
  assert.ok(r.errors.some((e) => e.code === code), `expected error ${code}, got ${r.errors.map((e) => e.code).join(",")}`);
  // coupons must NOT be partially applied when blocked
  assert.equal(r.couponTotal, 0, `coupons must not apply when ${code}`);
  assert.equal(r.coupons.length, 0, `no coupon applications when ${code}`);
  return r;
}

test("10. non-combinable coupon conflict blocks", () => {
  hasErr(base({ coupons: [coupon("c1", fixed(1000), { combinable: false }), coupon("c2", fixed(1000))] }), "NON_COMBINABLE_COUPON_CONFLICT");
});
test("11. expired coupon blocks", () => {
  hasErr(base({ coupons: [coupon("c1", fixed(1000), { validTo: "2026-07-16" })] }), "COUPON_OUTSIDE_VALIDITY");
});
test("12. not-yet-valid coupon blocks", () => {
  hasErr(base({ coupons: [coupon("c1", fixed(1000), { validFrom: "2026-07-18" })] }), "COUPON_OUTSIDE_VALIDITY");
});
test("14. duplicate coupon id blocks", () => {
  hasErr(base({ coupons: [coupon("dup", fixed(1000)), coupon("dup", fixed(2000))] }), "DUPLICATE_COUPON_ID");
});
test("15. invalid percentage blocks", () => {
  hasErr(base({ coupons: [coupon("c1", pct(15000))] }), "INVALID_PERCENTAGE");
});

// D. manual discount stays valid alongside a non-combinable single coupon
test("D. non-combinable single coupon coexists with manual discount", () => {
  const r = computeDiscountCouponPricing(base({
    manualDiscount: { kind: "fixed", amountYen: 1000 },
    coupons: [coupon("solo", fixed(2000), { combinable: false })],
  }));
  assert.equal(r.valid, true); // combinable=false only restricts coupon-to-coupon
  assert.equal(r.manualDiscountApplied, 1000);
  assert.equal(r.couponTotal, 2000);
  assert.equal(r.taxableAmount, 7000);
});

// C. explicit calculation date required (no Date.now / implicit system date)
test("C. invalid calculation date blocks", () => {
  const r = computeDiscountCouponPricing(base({ calculationDate: "2026/07/17" }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "INVALID_CALCULATION_DATE"));
});
