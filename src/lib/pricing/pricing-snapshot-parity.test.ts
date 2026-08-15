// EW-DC-1 — client/server pricing-parity tests.
// Run: node --import tsx --test src/lib/pricing/pricing-snapshot-parity.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeDiscountCouponPricing,
  type DiscountCouponPricingInput,
  type DiscountCouponPricingResult,
  type CouponValue,
  type ResolvedCoupon,
} from "./discount-coupon-pricing";
import { comparePricingSnapshots } from "./pricing-snapshot-parity";

const DATE = "2026-07-17";
const line = (unitPrice: number, quantity = 1, discountRatePercent = 0, lineId = "L1") =>
  ({ lineId, quantity, unitPrice, discountRatePercent });
const fixed = (amountYen: number): CouponValue => ({ kind: "fixed", amountYen });
const coupon = (couponId: string, value: CouponValue, o: Partial<ResolvedCoupon> = {}): ResolvedCoupon => ({
  couponId, label: o.label ?? `L(${couponId})`, value, combinable: o.combinable ?? true,
  validFrom: o.validFrom ?? null, validTo: o.validTo ?? null, displayOrder: o.displayOrder ?? 0,
});
const base = (o: Partial<DiscountCouponPricingInput> = {}): DiscountCouponPricingInput => ({
  calculationDate: DATE, lines: [line(10000)], taxRatePercent: 10,
  dealerTradeBasisPoints: 0, manualDiscount: { kind: "none" }, coupons: [], ...o,
});
const clone = (r: DiscountCouponPricingResult): DiscountCouponPricingResult =>
  JSON.parse(JSON.stringify(r)) as DiscountCouponPricingResult;

const RICH = base({
  manualDiscount: { kind: "fixed", amountYen: 1000 },
  coupons: [coupon("beta", fixed(2000), { displayOrder: 1 }), coupon("zeta", fixed(500), { displayOrder: 2 })],
});

// 20. exact parity pass
test("20. exact client/server parity passes", () => {
  const client = computeDiscountCouponPricing(RICH);
  const server = computeDiscountCouponPricing(RICH);
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, true);
});

// 21. one-yen mismatch fails
test("21. one-yen grand-total mismatch fails", () => {
  const client = computeDiscountCouponPricing(base());
  const server = clone(client);
  (server as { grandTotal: number }).grandTotal += 1;
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.code, "PRICING_PARITY_MISMATCH");
  assert.ok(res.mismatches.some((m) => m.path === "grandTotal" && m.client === 11000 && m.server === 11001));
});

// 22. equal grand total but different breakdown fails
test("22. equal grand total, different breakdown fails", () => {
  // client: subtotal 10000, no discount -> taxable 10000, grand 11000
  const client = computeDiscountCouponPricing(base());
  // server: subtotal 12000, manual fixed 2000 -> taxable 10000, grand 11000 (SAME total, different subtotal/discount)
  const server = computeDiscountCouponPricing(base({ lines: [line(12000)], manualDiscount: { kind: "fixed", amountYen: 2000 } }));
  assert.equal(client.grandTotal, server.grandTotal); // totals equal by construction
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.mismatches.some((m) => m.path === "subtotal"));
  assert.ok(res.mismatches.some((m) => m.path === "totalDiscount"));
});

// 23. coupon-definition change fails parity
test("23. coupon definition change fails parity", () => {
  const client = computeDiscountCouponPricing(RICH);
  const server = clone(client);
  (server.coupons[0] as { label: string }).label = "TAMPERED";
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.mismatches.some((m) => m.path === "coupons[0].label"));
});

// 24. coupon-order change fails parity
test("24. coupon order change fails parity", () => {
  const client = computeDiscountCouponPricing(RICH); // applied order [beta, zeta]
  const server = clone(client);
  (server as { coupons: DiscountCouponPricingResult["coupons"] }).coupons = [client.coupons[1], client.coupons[0]]; // [zeta, beta]
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.mismatches.some((m) => m.path === "coupons[0].couponId"));
});

// 25. line-level mismatch fails parity
test("25. line-level mismatch fails parity", () => {
  const client = computeDiscountCouponPricing(base());
  const server = clone(client);
  (server.lines[0] as { lineTotal: number }).lineTotal += 100;
  const res = comparePricingSnapshots(client, server);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.mismatches.some((m) => m.path === "lines[0].lineTotal"));
});
