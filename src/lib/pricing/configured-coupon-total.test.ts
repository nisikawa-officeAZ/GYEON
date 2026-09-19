import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isValidCouponCalendarDate,
  resolveConfiguredCoupons,
  type ConfiguredCoupon,
} from "./configured-coupon-total";

const coupon = (over: Partial<ConfiguredCoupon> = {}): ConfiguredCoupon => ({
  couponId: "coupon-1",
  code: "coupon-one",
  label: "Coupon One",
  value: { kind: "amount", amountYen: 100 },
  combinable: true,
  validFrom: null,
  validTo: null,
  isActive: true,
  displayOrder: 1,
  ...over,
});

test("calendar date authority rejects impossible dates and accepts a leap date", () => {
  assert.equal(isValidCouponCalendarDate("0000-01-01"), false);
  assert.equal(isValidCouponCalendarDate("0001-01-01"), true);
  assert.equal(isValidCouponCalendarDate("2026-02-30"), false);
  assert.equal(isValidCouponCalendarDate("2027-02-29"), false);
  assert.equal(isValidCouponCalendarDate("2028-02-29"), true);
});

test("an undated coupon remains usable without a business date", () => {
  const result = resolveConfiguredCoupons(["coupon-1"], [coupon()], 1_000, "");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.couponTotal, 100);
});

test("a date-bounded coupon fails closed when the business date is invalid", () => {
  const result = resolveConfiguredCoupons(
    ["coupon-1"],
    [coupon({ validFrom: "2026-01-01" })],
    1_000,
    "2026-02-30",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "COUPON_OUTSIDE_VALIDITY");
});

test("malformed and reversed coupon validity windows fail closed", () => {
  for (const configured of [
    coupon({ validFrom: "2026-02-30" }),
    coupon({ validTo: "2027-02-29" }),
    coupon({ validFrom: "2026-08-01", validTo: "2026-07-01" }),
  ]) {
    const result = resolveConfiguredCoupons(["coupon-1"], [configured], 1_000, "2026-07-17");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "COUPON_OUTSIDE_VALIDITY");
  }
});

test("validity boundaries remain inclusive", () => {
  const configured = coupon({ validFrom: "2026-07-17", validTo: "2026-07-17" });
  const result = resolveConfiguredCoupons(["coupon-1"], [configured], 1_000, "2026-07-17");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.couponTotal, 100);
});
