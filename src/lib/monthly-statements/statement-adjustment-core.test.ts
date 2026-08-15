// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — pure statement-adjustment core tests.
//
// Run: node --import tsx --test src/lib/monthly-statements/statement-adjustment-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isValidAdjustment,
  aggregateAdjustmentsTotal,
} from "./statement-adjustment-core";

test("1. a valid adjustment needs a finite non-zero amount and a non-blank reason", () => {
  assert.equal(isValidAdjustment({ signed_amount: 500, reason: "late fee" }), true);
  assert.equal(isValidAdjustment({ signed_amount: -500, reason: "goodwill credit" }), true);
  assert.equal(isValidAdjustment({ signed_amount: 0, reason: "x" }), false);
  assert.equal(isValidAdjustment({ signed_amount: NaN, reason: "x" }), false);
  assert.equal(isValidAdjustment({ signed_amount: 500, reason: "   " }), false);
});

test("2. adjustments_total is the deterministic signed sum", () => {
  assert.equal(aggregateAdjustmentsTotal([
    { signed_amount: 500, reason: "late fee" },
    { signed_amount: -200, reason: "goodwill" },
    { signed_amount: 1000, reason: "carry-forward" },
  ]), 1300);
  assert.equal(aggregateAdjustmentsTotal([]), 0);
});

test("3. non-finite, zero, or blank-reason adjustments are rejected, never coerced", () => {
  assert.throws(() => aggregateAdjustmentsTotal([{ signed_amount: Infinity, reason: "x" }]));
  assert.throws(() => aggregateAdjustmentsTotal([{ signed_amount: NaN, reason: "x" }]));
  assert.throws(() => aggregateAdjustmentsTotal([{ signed_amount: 0, reason: "x" }]));
  assert.throws(() => aggregateAdjustmentsTotal([{ signed_amount: 100, reason: "" }]));
});
