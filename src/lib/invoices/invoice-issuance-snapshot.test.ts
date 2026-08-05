// DEALEROS-ESTIMATE-INVOICE-PDF-B1-R4 — issuance snapshot validator tests.
//
// Run: node --import tsx --test src/lib/invoices/invoice-issuance-snapshot.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateInvoiceTotals, lineTotal } from "./invoice-types";
import { isFiniteNumber, validateIssuanceSnapshot } from "./invoice-issuance-snapshot";

/** Build an invoice whose stored aggregates genuinely match its lines. */
function consistentInvoice(
  items: { quantity: number; unit_price: number; discount_rate: number }[],
  opts: { discount_amount?: number; tax_rate?: number; paid_amount?: number } = {}
) {
  const discount_amount = opts.discount_amount ?? 0;
  const tax_rate = opts.tax_rate ?? 10;
  const paid_amount = opts.paid_amount ?? 0;
  const totals = calculateInvoiceTotals(items, discount_amount, tax_rate, paid_amount);
  return {
    // MONTHLY-DATA-B1: a consistent snapshot now also carries a valid delivery_date, since the
    // validator gates on it before the money checks. The money-focused tests keep their reasons.
    delivery_date: "2026-08-04",
    discount_amount,
    tax_rate,
    paid_amount,
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    total: totals.total,
    balance_due: totals.balance_due,
    invoice_items: items.map((i) => ({
      ...i,
      line_total: lineTotal(i.quantity, i.unit_price, i.discount_rate),
    })),
  };
}

const BASE_ITEMS = [
  { quantity: 2, unit_price: 15000, discount_rate: 0 },
  { quantity: 1, unit_price: 48000, discount_rate: 10 },
];

test("1. a consistent snapshot is accepted", () => {
  assert.deepEqual(validateIssuanceSnapshot(consistentInvoice(BASE_ITEMS)), { kind: "valid" });
});

test("2. an invoice with no lines is still consistent when its totals agree", () => {
  assert.deepEqual(validateIssuanceSnapshot(consistentInvoice([])), { kind: "valid" });
});

test("3. discounts, tax rates and payments are all honoured", () => {
  const inv = consistentInvoice(BASE_ITEMS, {
    discount_amount: 5000,
    tax_rate: 8,
    paid_amount: 20000,
  });
  assert.deepEqual(validateIssuanceSnapshot(inv), { kind: "valid" });
});

test("4. a stored line_total that disagrees with the rule is rejected", () => {
  const inv = consistentInvoice(BASE_ITEMS);
  inv.invoice_items[1].line_total += 1;
  const r = validateIssuanceSnapshot(inv);
  assert.equal(r.kind, "invalid");
  assert.equal(r.kind === "invalid" ? r.reason : "", "line-total-mismatch");
  assert.equal(r.kind === "invalid" ? r.detail : "", "items[1]");
});

test("5. each aggregate mismatch is rejected independently", () => {
  const cases = [
    ["subtotal", "subtotal-mismatch"],
    ["tax_amount", "tax-amount-mismatch"],
    ["total", "total-mismatch"],
    ["balance_due", "balance-due-mismatch"],
  ] as const;

  for (const [field, reason] of cases) {
    const inv = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
    inv[field] = (inv[field] as number) + 1;
    const r = validateIssuanceSnapshot(inv);
    assert.equal(r.kind, "invalid", field);
    assert.equal(r.kind === "invalid" ? r.reason : "", reason);
  }
});

test("6. missing, non-numeric, NaN and infinite parent money is rejected", () => {
  for (const field of [
    "discount_amount",
    "tax_rate",
    "paid_amount",
    "subtotal",
    "tax_amount",
    "total",
    "balance_due",
  ]) {
    for (const bad of [undefined, null, "1000", NaN, Infinity, -Infinity, {}]) {
      const inv = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
      inv[field] = bad;
      const r = validateIssuanceSnapshot(inv);
      assert.equal(r.kind, "invalid", `${field}=${String(bad)}`);
      assert.equal(r.kind === "invalid" ? r.reason : "", "invalid-number");
      assert.equal(r.kind === "invalid" ? r.detail : "", field);
    }
  }
});

test("7. missing, non-numeric, NaN and infinite line money is rejected", () => {
  for (const field of ["quantity", "unit_price", "discount_rate", "line_total"]) {
    for (const bad of [undefined, null, "2", NaN, Infinity]) {
      const inv = consistentInvoice(BASE_ITEMS);
      (inv.invoice_items[0] as Record<string, unknown>)[field] = bad;
      const r = validateIssuanceSnapshot(inv);
      assert.equal(r.kind, "invalid", `${field}=${String(bad)}`);
      assert.equal(r.kind === "invalid" ? r.reason : "", "invalid-number");
      assert.equal(r.kind === "invalid" ? r.detail : "", `items[0].${field}`);
    }
  }
});

test("8. a missing or non-array item collection is rejected", () => {
  for (const bad of [undefined, null, {}, "[]"]) {
    const inv = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
    inv.invoice_items = bad;
    const r = validateIssuanceSnapshot(inv);
    assert.equal(r.kind, "invalid");
    assert.equal(r.kind === "invalid" ? r.reason : "", "missing-items");
  }
});

test("9. isFiniteNumber accepts only real finite numbers", () => {
  for (const good of [0, -1, 1.5, 1e6]) assert.equal(isFiniteNumber(good), true, String(good));
  for (const bad of [NaN, Infinity, -Infinity, "1", null, undefined, {}, []]) {
    assert.equal(isFiniteNumber(bad), false, String(bad));
  }
});

test("10. validation reuses the shared money rules rather than a second policy", () => {
  // A snapshot built purely from the shared helpers must always validate; if the
  // validator had its own rounding or tax policy this would drift.
  for (const rate of [0, 8, 10]) {
    for (const discount of [0, 1234]) {
      for (const paid of [0, 999]) {
        const inv = consistentInvoice(
          [
            { quantity: 3, unit_price: 3333, discount_rate: 7 },
            { quantity: 1, unit_price: 12345, discount_rate: 33 },
          ],
          { tax_rate: rate, discount_amount: discount, paid_amount: paid }
        );
        assert.deepEqual(
          validateIssuanceSnapshot(inv),
          { kind: "valid" },
          `rate=${rate} discount=${discount} paid=${paid}`
        );
      }
    }
  }
});

// ── MONTHLY-DATA-B1: the delivery-date issuance gate ─────────────────────────

test("11. a null, undefined or blank delivery_date is rejected as missing", () => {
  for (const bad of [null, undefined, "", "   "]) {
    const inv = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
    inv.delivery_date = bad;
    const r = validateIssuanceSnapshot(inv);
    assert.equal(r.kind, "invalid");
    assert.equal(r.kind === "invalid" ? r.reason : "", "missing-delivery-date", String(bad));
  }
});

test("12. a malformed or impossible delivery_date is rejected as invalid", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026/08/04", "2026-8-4", "garbage", "2026-08-04T00:00:00Z"]) {
    const inv = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
    inv.delivery_date = bad;
    const r = validateIssuanceSnapshot(inv);
    assert.equal(r.kind, "invalid");
    assert.equal(r.kind === "invalid" ? r.reason : "", "invalid-delivery-date", bad);
  }
});

test("13. a valid delivery_date passes the gate; the check runs before the money checks", () => {
  const ok = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
  ok.delivery_date = "2026-08-04";
  assert.deepEqual(validateIssuanceSnapshot(ok), { kind: "valid" });

  // The delivery gate precedes money validation: a snapshot missing its delivery date is rejected
  // for THAT reason even when a money field is also broken, proving issuance stops early.
  const both = consistentInvoice(BASE_ITEMS) as Record<string, unknown>;
  both.delivery_date = null;
  both.total = 999999; // also inconsistent
  const r = validateIssuanceSnapshot(both);
  assert.equal(r.kind === "invalid" ? r.reason : "", "missing-delivery-date");
});
