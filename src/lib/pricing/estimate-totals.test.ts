// GDA-ESTIMATE-POST-TAX-ADJUSTMENT-R1 — post-tax document-discount regression tests.
//
// Run: node --import tsx --test src/lib/pricing/estimate-totals.test.ts
//
// Owner-ratified rule:
//   tax_amount = floor(subtotal * tax_rate / 100)               (tax on the FULL subtotal)
//   discount   = clamp(requested, 0, subtotal + tax_amount)     (post-tax gross clamp)
//   total      = subtotal + tax_amount - discount
// Line-level discount_rate remains an UNCHANGED pre-tax line-price input.

import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateEstimateTotals, lineTotal } from "./estimate-totals";

test("1. Owner reference case: subtotal 93500, tax 9350, discount 2850, total 100000", () => {
  assert.deepEqual(
    calculateEstimateTotals([{ quantity: 1, unit_price: 93500, discount_rate: 0 }], 2850, 10),
    { subtotal: 93500, discount_amount: 2850, tax_rate: 10, tax_amount: 9350, total: 100000 },
  );
});

test("2. zero discount: total = subtotal + floor tax", () => {
  assert.deepEqual(
    calculateEstimateTotals([{ quantity: 1, unit_price: 10000, discount_rate: 0 }], 0, 10),
    { subtotal: 10000, discount_amount: 0, tax_rate: 10, tax_amount: 1000, total: 11000 },
  );
  // floor: 999 × 10% = 99.9 → 99
  assert.deepEqual(
    calculateEstimateTotals([{ quantity: 1, unit_price: 999, discount_rate: 0 }], 0, 10),
    { subtotal: 999, discount_amount: 0, tax_rate: 10, tax_amount: 99, total: 1098 },
  );
});

test("3. tax is computed BEFORE the discount (regression against the pre-tax rule)", () => {
  // Pre-tax rule would produce tax 0 here; the ratified rule taxes the full subtotal.
  const r = calculateEstimateTotals([{ quantity: 1, unit_price: 10000, discount_rate: 0 }], 10000, 10);
  assert.equal(r.tax_amount, 1000, "tax is on the full subtotal, not the discounted base");
  assert.equal(r.discount_amount, 10000);
  assert.equal(r.total, 1000, "100% goods discount still owes the tax (Owner-ratified)");
});

test("4. a discount above the gross clamps to subtotal + tax and the total is exactly 0", () => {
  const r = calculateEstimateTotals([{ quantity: 2, unit_price: 1000, discount_rate: 0 }], 5000, 10);
  assert.deepEqual(r, { subtotal: 2000, discount_amount: 2200, tax_rate: 10, tax_amount: 200, total: 0 });
});

test("5. negative or non-finite requested discounts apply as 0", () => {
  // Non-finite → treated as 0; negative → clamped up to 0. Either way nothing is applied.
  for (const bad of [-10, NaN, Infinity, -Infinity]) {
    const r = calculateEstimateTotals([{ quantity: 2, unit_price: 1000, discount_rate: 0 }], bad as number, 10);
    assert.deepEqual(r, { subtotal: 2000, discount_amount: 0, tax_rate: 10, tax_amount: 200, total: 2200 }, String(bad));
  }
});

test("6. invalid tax rates fall back to the default 10", () => {
  for (const bad of [NaN, -1, Infinity]) {
    const r = calculateEstimateTotals([{ quantity: 1, unit_price: 1000, discount_rate: 0 }], 0, bad as number);
    assert.equal(r.tax_rate, 10, String(bad));
    assert.equal(r.tax_amount, 100, String(bad));
  }
  // 0% stays a real rate, never coerced to the default.
  const zero = calculateEstimateTotals([{ quantity: 1, unit_price: 1000, discount_rate: 0 }], 0, 0);
  assert.equal(zero.tax_rate, 0);
  assert.equal(zero.tax_amount, 0);
  assert.equal(zero.total, 1000);
});

test("7. line-level discount behavior is unchanged: a pre-tax line-price input", () => {
  assert.equal(lineTotal(2, 1000, 10), 1800, "round(2 × 1000 × 0.9)");
  // The per-line discount reduces the subtotal BEFORE tax; the document discount does not.
  const r = calculateEstimateTotals([{ quantity: 1, unit_price: 10000, discount_rate: 50 }], 0, 10);
  assert.deepEqual(r, { subtotal: 5000, discount_amount: 0, tax_rate: 10, tax_amount: 500, total: 5500 });
});

test("8. the empty estimate stays all-zero", () => {
  assert.deepEqual(calculateEstimateTotals([], 0, 10),
    { subtotal: 0, discount_amount: 0, tax_rate: 10, tax_amount: 0, total: 0 });
  // A requested discount on an empty estimate clamps to the zero gross.
  assert.deepEqual(calculateEstimateTotals([], 500, 10),
    { subtotal: 0, discount_amount: 0, tax_rate: 10, tax_amount: 0, total: 0 });
});
