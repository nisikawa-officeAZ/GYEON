import { test } from "node:test";
import assert from "node:assert/strict";

import { toEstimateDocumentData } from "./estimate-document-data";
import type { EstimateDB, EstimateItemDB } from "@/lib/estimates/estimate-types";

function item(overrides: Partial<EstimateItemDB> = {}): EstimateItemDB {
  return {
    id: "i1",
    estimate_id: "e1",
    dealer_id: "d1",
    category: "coating",
    item_name: "MOHS",
    description: null,
    quantity: 1,
    unit_price: 90000,
    discount_rate: 0,
    line_total: 90000,
    sort_order: 0,
    created_at: "2026-07-11",
    updated_at: "2026-07-11",
    ...overrides,
  };
}

function estimate(overrides: Partial<EstimateDB> = {}): EstimateDB {
  return {
    id: "e1",
    customer_id: "c1",
    vehicle_id: "v1",
    estimate_no: "EST-2026-00012",
    estimate_number: "EST-2026-00012",
    title: null,
    status: "sent",
    subtotal: 187500,
    tax: 0,
    tax_rate: 10,
    tax_amount: 18350,
    discount_amount: 4000,
    total: 201850,
    valid_until: "2026-08-10",
    notes: "line1\nline2",
    internal_memo: "SECRET INTERNAL MEMO",
    dealer_id: "d1",
    deleted_at: null,
    created_at: "2026-07-11",
    updated_at: "2026-07-11",
    customers: {
      last_name: "石井",
      first_name: "紗也華",
      phone: "052-000-0000",
      email: "x@example.com",
      postal_code: "460-0002",
      address1: "名古屋市中区",
      is_business: false,
    },
    vehicles: {
      maker: "フェラーリ",
      model: "458",
      year: "2015",
      grade: "Base",
      color: "Red",
      mileage: 28400,
      plate_number: "名古屋 332",
      body_size: null,
      registration_date: null,
      inspection_expiry_date: null,
    },
    estimate_items: [
      item({ id: "i1", item_name: "MOHS", category: "coating", unit_price: 90000, quantity: 1, line_total: 90000 }),
      item({ id: "i2", item_name: "Seat", category: "interior", unit_price: 24000, quantity: 1, line_total: 20000 }),
    ],
    ...overrides,
  };
}

test("persisted subtotal, discount, tax rate, tax and total pass through unchanged", () => {
  const d = toEstimateDocumentData(estimate());
  assert.deepEqual(d.summary, {
    subtotal: 187500,
    discount: 4000,
    taxRatePercent: 10,
    tax: 18350,
    grandTotal: 201850,
  });
});

test("per-line discount equals stored gross minus stored line_total", () => {
  const d = toEstimateDocumentData(estimate());
  const mohs = d.items.find((it) => it.name === "MOHS");
  const seat = d.items.find((it) => it.name === "Seat");
  // 90000×1 − 90000 = 0 → null (no discount, rendered as em-dash)
  assert.equal(mohs?.discount, null);
  // 24000×1 − 20000 = 4000
  assert.equal(seat?.discount, 4000);
  assert.equal(seat?.amount, 20000);
});

test("absent customer name and mileage remain omitted/empty as contracted", () => {
  const d = toEstimateDocumentData(
    estimate({
      customers: {
        last_name: null,
        first_name: null,
        phone: null,
        email: null,
        postal_code: null,
        address1: null,
        is_business: null,
      },
      vehicles: {
        maker: "フェラーリ",
        model: null,
        year: null,
        grade: null,
        color: null,
        mileage: null,
        plate_number: null,
        body_size: null,
        registration_date: null,
        inspection_expiry_date: null,
      },
    }),
  );
  assert.equal(d.customer.name, "");
  assert.equal(d.vehicle.mileage, undefined);
});

test("internal_memo, dealer cost and margin never appear in output", () => {
  const d = toEstimateDocumentData(estimate());
  const serialized = JSON.stringify(d);
  assert.ok(!serialized.includes("SECRET INTERNAL MEMO"), "internal_memo must not leak into the document");
  assert.ok(!("internal_memo" in (d as unknown as Record<string, unknown>)));
  assert.ok(!("cost" in (d as unknown as Record<string, unknown>)));
  assert.ok(!("margin" in (d as unknown as Record<string, unknown>)));
});
