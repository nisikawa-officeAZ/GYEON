// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — pure statement-receipt core tests.
//
// Run: node --import tsx --test src/lib/monthly-statements/statement-receipt-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isEligibleReceipt,
  selectPeriodReceipts,
  splitReceipt,
  summarizeReceiptTotals,
  type CandidatePayment,
} from "./statement-receipt-core";

const SRC = "src/lib/monthly-statements/statement-receipt-core.ts";
const SCOPE = { dealerId: "D1", customerId: "C1" };
const PERIOD = { period_start: "2026-08-01", period_end: "2026-08-31" };

function pay(p: Partial<CandidatePayment>): CandidatePayment {
  return {
    id: "p", dealer_id: "D1", customer_id: "C1", status: "completed",
    payment_date: "2026-08-10", amount: 1000, invoice_id: null, ...p,
  };
}

test("1. eligibility requires completed status AND a valid payment_date", () => {
  assert.equal(isEligibleReceipt("completed", "2026-08-10"), true);
  for (const s of ["pending", "cancelled", "refunded", ""]) assert.equal(isEligibleReceipt(s, "2026-08-10"), false);
  for (const d of [null, "", "2026-13-01", 5]) assert.equal(isEligibleReceipt("completed", d), false);
});

test("2. selection uses payment_date only and includes the inclusive period bounds", () => {
  const list = [
    pay({ id: "a", payment_date: "2026-08-01" }), // lower bound inclusive
    pay({ id: "b", payment_date: "2026-08-31" }), // upper bound inclusive
    pay({ id: "c", payment_date: "2026-07-31" }), // before → excluded
    pay({ id: "d", payment_date: "2026-09-01" }), // after → excluded
  ];
  assert.deepEqual(selectPeriodReceipts(list, SCOPE, PERIOD).map((p) => p.id), ["a", "b"]);
});

test("3. a NULL payment_date is excluded — created_at is NEVER a fallback", () => {
  assert.deepEqual(selectPeriodReceipts([pay({ id: "x", payment_date: null })], SCOPE, PERIOD), []);
  const src = readFileSync(SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/created_at/.test(src), "receipt core must never reference created_at");
  assert.ok(!/paid_amount/.test(src), "receipt core must never reference invoices.paid_amount");
});

test("4. non-completed receipts are excluded from selection", () => {
  const list = [
    pay({ id: "ok", status: "completed" }),
    pay({ id: "pending", status: "pending" }),
    pay({ id: "refunded", status: "refunded" }),
  ];
  assert.deepEqual(selectPeriodReceipts(list, SCOPE, PERIOD).map((p) => p.id), ["ok"]);
});

test("5. deterministic order: payment_date, then id", () => {
  const list = [
    pay({ id: "i3", payment_date: "2026-08-10" }),
    pay({ id: "i1", payment_date: "2026-08-05" }),
    pay({ id: "i2b", payment_date: "2026-08-10" }),
    pay({ id: "i2a", payment_date: "2026-08-10" }),
  ];
  assert.deepEqual(selectPeriodReceipts(list, SCOPE, PERIOD).map((p) => p.id), ["i1", "i2a", "i2b", "i3"]);
});

test("6. cross-dealer/cross-customer receipts are excluded; blank scope fails closed", () => {
  const list = [
    pay({ id: "mine", dealer_id: "D1", customer_id: "C1" }),
    pay({ id: "other-dealer", dealer_id: "D2", customer_id: "C1" }),
    pay({ id: "other-cust", dealer_id: "D1", customer_id: "C2" }),
    pay({ id: "null-cust", dealer_id: "D1", customer_id: null }),
  ];
  assert.deepEqual(selectPeriodReceipts(list, SCOPE, PERIOD).map((p) => p.id), ["mine"]);
  assert.throws(() => selectPeriodReceipts(list, { dealerId: "", customerId: "C1" }, PERIOD));
  assert.throws(() => selectPeriodReceipts(list, { dealerId: "D1", customerId: "  " }, PERIOD));
});

test("7. invalid/reversed period bounds throw", () => {
  assert.throws(() => selectPeriodReceipts([], SCOPE, { period_start: "2026-13-01", period_end: "2026-08-31" }));
  assert.throws(() => selectPeriodReceipts([], SCOPE, { period_start: "2026-08-31", period_end: "2026-08-01" }));
});

test("8. splitReceipt: legacy-direct is fully allocated; allocated/unapplied split by allocated_sum", () => {
  // legacy-direct (invoice_id present): allocated = amount, unapplied = 0 (reconciles an invoice directly)
  assert.deepEqual(splitReceipt(pay({ invoice_id: "INV1", amount: 6000 })),
    { paymentId: "p", amount: 6000, allocated: 6000, unapplied: 0 });
  // pure unapplied credit: invoice_id null, no allocations
  assert.deepEqual(splitReceipt(pay({ invoice_id: null, amount: 6000, allocated_sum: 0 })),
    { paymentId: "p", amount: 6000, allocated: 0, unapplied: 6000 });
  // partial allocation
  assert.deepEqual(splitReceipt(pay({ invoice_id: null, amount: 6000, allocated_sum: 2500 })),
    { paymentId: "p", amount: 6000, allocated: 2500, unapplied: 3500 });
});

test("9. splitReceipt rejects non-finite/negative amounts and over-allocation", () => {
  assert.throws(() => splitReceipt(pay({ amount: NaN })));
  assert.throws(() => splitReceipt(pay({ amount: -1 })));
  assert.throws(() => splitReceipt(pay({ invoice_id: null, amount: 100, allocated_sum: Infinity })));
  assert.throws(() => splitReceipt(pay({ invoice_id: null, amount: 100, allocated_sum: 200 })));
});

test("10. summarizeReceiptTotals reconciles: received = allocated + unapplied", () => {
  const list = [
    pay({ id: "a", invoice_id: "INV1", amount: 60000 }),               // direct → allocated 60000
    pay({ id: "b", invoice_id: null, amount: 40000, allocated_sum: 15000 }), // 15000 alloc / 25000 credit
  ];
  const t = summarizeReceiptTotals(list);
  assert.deepEqual(t, {
    payments_received_total: 100000, allocated_payments_total: 75000, unapplied_credit_total: 25000,
  });
  assert.equal(t.payments_received_total, t.allocated_payments_total + t.unapplied_credit_total);
});

test("11. scenario: unapplied 60000 receipt → received 60000, allocated 0, unapplied 60000", () => {
  const t = summarizeReceiptTotals([pay({ id: "u", invoice_id: null, amount: 60000, allocated_sum: 0 })]);
  assert.deepEqual(t, {
    payments_received_total: 60000, allocated_payments_total: 0, unapplied_credit_total: 60000,
  });
});
