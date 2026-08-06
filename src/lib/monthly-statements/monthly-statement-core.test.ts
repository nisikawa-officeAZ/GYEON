// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — pure monthly-statement core tests.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-statement-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isEligibleInvoiceStatus,
  selectEligibleInvoices,
  aggregateStatementTotals,
  resolveOpeningBalance,
  computeClosingBalance,
  deriveWorkDescription,
  type CandidateInvoice,
} from "./monthly-statement-core";

const PERIOD = { period_start: "2026-08-01", period_end: "2026-08-31" };
const SCOPE = { dealerId: "D1", customerId: "C1" };

function inv(p: Partial<CandidateInvoice>): CandidateInvoice {
  return {
    id: "i", dealer_id: "D1", customer_id: "C1", invoice_number: "INV-1", status: "issued",
    delivery_date: "2026-08-10", subtotal: 1000, discount_amount: 0, tax_amount: 100, total: 1100, ...p,
  };
}

test("1. eligible statuses accept issued/paid/partially_paid/overdue; reject draft/cancelled/other", () => {
  for (const s of ["issued", "paid", "partially_paid", "overdue"]) assert.equal(isEligibleInvoiceStatus(s), true, s);
  for (const s of ["draft", "cancelled", "", "ISSUED", null, 5]) assert.equal(isEligibleInvoiceStatus(s), false, String(s));
});

test("2. selection uses delivery_date only and includes the inclusive period bounds", () => {
  const list = [
    inv({ id: "a", delivery_date: "2026-08-01" }), // lower bound inclusive
    inv({ id: "b", delivery_date: "2026-08-31" }), // upper bound inclusive
    inv({ id: "c", delivery_date: "2026-07-31" }), // before period → excluded
    inv({ id: "d", delivery_date: "2026-09-01" }), // after period → excluded
  ];
  const got = selectEligibleInvoices(list, SCOPE, PERIOD).map((i) => i.id);
  assert.deepEqual(got, ["a", "b"]);
});

test("3. issue_date is NEVER used — an invoice with a null delivery_date is excluded even if it has an issue_date", () => {
  // The candidate type exposes no issue_date, and a null delivery_date drops the row.
  const list = [inv({ id: "x", delivery_date: null } as Partial<CandidateInvoice>)];
  assert.deepEqual(selectEligibleInvoices(list, SCOPE, PERIOD), []);
  // The core module CODE never references issue_date (comments explaining its absence don't count).
  const { readFileSync } = require("node:fs");
  const src = readFileSync("src/lib/monthly-statements/monthly-statement-core.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/issue_date/.test(src), "the core code must never reference issue_date");
});

test("4. ineligible statuses are excluded from selection", () => {
  const list = [
    inv({ id: "ok", status: "issued" }),
    inv({ id: "draft", status: "draft" }),
    inv({ id: "cancelled", status: "cancelled" }),
  ];
  assert.deepEqual(selectEligibleInvoices(list, SCOPE, PERIOD).map((i) => i.id), ["ok"]);
});

test("5. deterministic order: delivery_date, then invoice_number, then id", () => {
  const list = [
    inv({ id: "i3", delivery_date: "2026-08-10", invoice_number: "INV-9" }),
    inv({ id: "i1", delivery_date: "2026-08-05", invoice_number: "INV-2" }),
    inv({ id: "i2b", delivery_date: "2026-08-10", invoice_number: "INV-1" }),
    inv({ id: "i2a", delivery_date: "2026-08-10", invoice_number: "INV-1" }),
  ];
  assert.deepEqual(selectEligibleInvoices(list, SCOPE, PERIOD).map((i) => i.id), ["i1", "i2a", "i2b", "i3"]);
});

test("6. invalid period bounds throw", () => {
  assert.throws(() => selectEligibleInvoices([], SCOPE, { period_start: "2026-13-01", period_end: "2026-08-31" }));
  assert.throws(() => selectEligibleInvoices([], SCOPE, { period_start: "2026-08-31", period_end: "2026-08-01" }));
});

test("7. totals are the SUM of stored invoice values — no recalculation", () => {
  const list = [
    inv({ subtotal: 1000, discount_amount: 100, tax_amount: 90, total: 990 }),
    inv({ subtotal: 2000, discount_amount: 0, tax_amount: 200, total: 2200 }),
  ];
  assert.deepEqual(aggregateStatementTotals(list), {
    current_subtotal: 3000, current_discount: 100, current_tax: 290, current_total: 3190,
  });
});

test("8. non-finite stored monetary values are rejected, never coerced to zero", () => {
  assert.throws(() => aggregateStatementTotals([inv({ tax_amount: NaN })]));
  assert.throws(() => aggregateStatementTotals([inv({ total: Infinity })]));
  assert.throws(() => aggregateStatementTotals([inv({ subtotal: "0" as unknown as number })]));
});

test("9. opening balance: previous closing_balance, else zero; non-finite rejected", () => {
  assert.equal(resolveOpeningBalance(null), 0);
  assert.equal(resolveOpeningBalance({ closing_balance: 4200 }), 4200);
  assert.throws(() => resolveOpeningBalance({ closing_balance: NaN }));
});

test("10. closing balance = opening + current_total - allocated + adjustments", () => {
  assert.equal(computeClosingBalance({
    opening_balance: 1000, current_total: 5000, allocated_payments_total: 2000, adjustments_total: 300,
  }), 4300);
  assert.throws(() => computeClosingBalance({
    opening_balance: 0, current_total: NaN, allocated_payments_total: 0, adjustments_total: 0,
  }));
});

test("11. work description: non-blank title first; else deterministic from item names", () => {
  assert.equal(deriveWorkDescription({ title: "8月分 定期メンテナンス" }), "8月分 定期メンテナンス");
  assert.equal(deriveWorkDescription({ title: "   ", item_names: ["コーティング"] }), "コーティング");
  assert.equal(deriveWorkDescription({ item_names: ["コーティング", "PPF", "洗車"] }), "コーティング ほか2件");
  assert.equal(deriveWorkDescription({ title: null, item_names: [] }), "");
});

// ─── B2-R1-3: authoritative tenant scope ─────────────────────────────────────

test("12. cross-dealer invoices are excluded by the authoritative scope", () => {
  const list = [
    inv({ id: "mine", dealer_id: "D1", customer_id: "C1" }),
    inv({ id: "other-dealer", dealer_id: "D2", customer_id: "C1" }),
  ];
  assert.deepEqual(selectEligibleInvoices(list, SCOPE, PERIOD).map((i) => i.id), ["mine"]);
});

test("13. cross-customer invoices are excluded by the authoritative scope", () => {
  const list = [
    inv({ id: "mine", dealer_id: "D1", customer_id: "C1" }),
    inv({ id: "other-cust", dealer_id: "D1", customer_id: "C2" }),
    inv({ id: "null-cust", dealer_id: "D1", customer_id: null }),
  ];
  assert.deepEqual(selectEligibleInvoices(list, SCOPE, PERIOD).map((i) => i.id), ["mine"]);
});

test("14. a blank authoritative dealer/customer scope fails closed (throws), never cross-tenant", () => {
  const list = [inv({ id: "mine" })];
  assert.throws(() => selectEligibleInvoices(list, { dealerId: "", customerId: "C1" }, PERIOD));
  assert.throws(() => selectEligibleInvoices(list, { dealerId: "D1", customerId: "  " }, PERIOD));
  assert.throws(() => selectEligibleInvoices(list, { dealerId: "", customerId: "" }, PERIOD));
});
