// EST-WIZ-REQ-F1 — Save-boundary vehicle rule: a NEW vehicle requires a trimmed model.
//
// Run: node --import tsx --test src/components/estimates/wizard/save/estimate-save-validation.test.ts
//
// The approved business rule: maker-only data is REJECTED with VEHICLE_REQUIRED — 車名 is
// the manual-only required identity of the vehicle being created, and the vehicle-OCR apply
// path never supplies it. The existing-mode rule (id required) is regression-locked here too,
// so the navigation discriminator and this boundary read the same states the same way.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateEstimateSaveRequest, evaluateEstimateSaveReadiness } from "./estimate-save-validation";
import { ESTIMATE_SAVE_ERRORS } from "./estimate-save-errors";
import type { EstimateSaveRequest, EstimateSaveVehicle, EstimateSaveCustomer } from "./estimate-save-dto";

// ── Minimal VALID base request (every non-vehicle rule satisfied) ───────────

const NEW_VEHICLE: EstimateSaveVehicle = {
  mode: "new", maker: null, model: "クラウン", grade: null, vehicleCode: null, vin: null,
  firstRegistration: null, registrationDate: null, inspectionExpiry: null,
  displacement: null, color: null, plateNumber: null, bodySizeKey: null,
};

function baseRequest(over: Partial<EstimateSaveRequest> = {}): EstimateSaveRequest {
  return {
    customer: { mode: "existing", customerId: "c-1" },
    vehicle: { mode: "existing", vehicleId: "v-1", bodySizeKey: null },
    services: [{
      lineId: "manual:maintenance:mm1", category: "maintenance",
      pricingSource: "manual", pricingReferenceId: null, manualPricingIdentity: "mm1",
      label: "6ヶ月ボディメンテナンス", description: null,
      quantity: 1, unitPrice: 5000, subtotal: 5000,
      selectedOptionReferenceIds: [], metadata: {},
    }],
    nonPriceableSelections: [],
    discount: { intent: { mode: "none", fixedAmount: null, percentage: null, percentageSupported: true }, appliedAmount: null },
    coupon: { selectedCouponIds: [], status: "none", appliedAmount: null },
    pricing: {
      currency: "JPY", completeness: "complete",
      subtotal: 5000, discountTotal: 0, couponTotal: 0, taxableSubtotal: 5000,
      taxRatePercent: 10, taxTotal: 500, grandTotal: 5500,
      warnings: [], errors: [], unresolvedItems: [],
    },
    notes: { customerNotes: "", internalMemo: "" },
    metadata: {
      source: "estimate-wizard-v2.2", schemaVersion: "2.2", createdFromWizard: true,
      draftLastUpdatedAt: null, previewConfirmed: false, estimateNumber: null,
    },
    ...over,
  };
}

const vehicleIssues = (req: EstimateSaveRequest) =>
  validateEstimateSaveRequest(req).issues.filter((i) => i.code === ESTIMATE_SAVE_ERRORS.VEHICLE_REQUIRED);

// ── Preconditions ───────────────────────────────────────────────────────────

test("PRECONDITION: the base request is fully valid and save-ready", () => {
  const result = validateEstimateSaveRequest(baseRequest());
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.equal(evaluateEstimateSaveReadiness(baseRequest()).status, "ready");
});

// ── Existing mode (regression-locked) ───────────────────────────────────────

test("existing vehicle without an id → VEHICLE_REQUIRED", () => {
  const req = baseRequest({ vehicle: { mode: "existing", vehicleId: "", bodySizeKey: null } });
  const issues = vehicleIssues(req);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].field, "vehicle");
});

test("existing vehicle with an id passes regardless of any model text elsewhere", () => {
  assert.deepEqual(vehicleIssues(baseRequest()), []);
});

// ── New mode — the approved model rule ──────────────────────────────────────

test("new vehicle with a trimmed model is accepted", () => {
  assert.deepEqual(vehicleIssues(baseRequest({ vehicle: NEW_VEHICLE })), []);
});

test("MAKER-ONLY new vehicle is REJECTED with VEHICLE_REQUIRED", () => {
  const req = baseRequest({ vehicle: { ...NEW_VEHICLE, maker: "トヨタ", model: null } });
  const issues = vehicleIssues(req);
  assert.equal(issues.length, 1, "maker alone no longer satisfies the vehicle rule");
  assert.equal(issues[0].field, "vehicle.model");
  assert.equal(evaluateEstimateSaveReadiness(req).status, "invalid");
});

test("empty and whitespace-only models are rejected; plate/vin/color never substitute", () => {
  for (const model of [null, "", "   "]) {
    const req = baseRequest({
      vehicle: { ...NEW_VEHICLE, model, maker: "トヨタ", plateNumber: "滋賀 330 に 1234", vin: "VIN-1", color: "白" },
    });
    assert.equal(vehicleIssues(req).length, 1, `model=${JSON.stringify(model)} must be rejected`);
  }
});

// ── Customer rules stay untouched (regression lock) ─────────────────────────

test("new customer requires both name and furigana", () => {
  const noId: EstimateSaveCustomer = { mode: "existing", customerId: "" };
  const noIdIssues = validateEstimateSaveRequest(baseRequest({ customer: noId }))
    .issues.filter((i) => i.code === ESTIMATE_SAVE_ERRORS.CUSTOMER_REQUIRED);
  assert.equal(noIdIssues.length, 1);

  const newOk: EstimateSaveCustomer = {
    mode: "new", name: "山田太郎", phone: null, email: null, postalCode: null, address: null,
    lineId: null, isBusiness: false, tradeRatePercent: null, accountsReceivableAllowed: false,
    closingDay: null, paymentDay: null, kana: "ヤマダタロウ", creditTerms: null,
  };
  assert.equal(validateEstimateSaveRequest(baseRequest({ customer: newOk })).ok, true);

  for (const kana of [null, "", "   "]) {
    const result = validateEstimateSaveRequest(baseRequest({ customer: { ...newOk, kana } }));
    const issues = result.issues.filter((issue) => issue.field === "customer.kana");
    assert.equal(issues.length, 1, `kana=${JSON.stringify(kana)} must be rejected`);
    assert.equal(issues[0].message, "フリガナが未入力です。");
  }
});

// ── GDA-ESTIMATE-WIZARD-10-STEP-R1 zero-line policy ─────────────────────────

const ZERO_PRICING: EstimateSaveRequest["pricing"] = {
  currency: "JPY", completeness: "complete",
  subtotal: 0, discountTotal: 0, couponTotal: 0, taxableSubtotal: 0,
  taxRatePercent: 10, taxTotal: 0, grandTotal: 0,
  warnings: [], errors: [], unresolvedItems: [],
};
const zeroLineRequest = (over: Partial<EstimateSaveRequest> = {}) =>
  baseRequest({ services: [], pricing: ZERO_PRICING, discount: { intent: { mode: "none", fixedAmount: null, percentage: null, percentageSupported: true }, appliedAmount: 0 }, coupon: { selectedCouponIds: [], status: "none", appliedAmount: 0, applications: [] }, ...over });

test("zero-line: an empty line set with ¥0/¥0/¥0 and no discount/coupon is save-ready", () => {
  const result = validateEstimateSaveRequest(zeroLineRequest());
  assert.deepEqual(result.issues, []);
  assert.equal(evaluateEstimateSaveReadiness(zeroLineRequest()).status, "ready");
});

test("zero-line: a deliberately confirmed ¥0 line remains a line and is save-ready", () => {
  const line = { ...baseRequest().services[0], unitPrice: 0, subtotal: 0 };
  const req = baseRequest({ services: [line], pricing: ZERO_PRICING });
  assert.equal(validateEstimateSaveRequest(req).ok, true);
});

test("zero-line: null or incomplete totals are still rejected (never silently zero)", () => {
  const nullTotals = zeroLineRequest({ pricing: { ...ZERO_PRICING, grandTotal: null, subtotal: null } });
  assert.ok(validateEstimateSaveRequest(nullTotals).issues.some((i) => i.code === ESTIMATE_SAVE_ERRORS.PRICING_INCOMPLETE));
  const unresolved = zeroLineRequest({ pricing: { ...ZERO_PRICING, completeness: "unavailable", unresolvedItems: [{ code: "MANUAL_PRICE_REQUIRED", message: "x" }] } });
  const codes = validateEstimateSaveRequest(unresolved).issues.map((i) => i.code);
  assert.ok(codes.includes(ESTIMATE_SAVE_ERRORS.PRICING_INCOMPLETE) && codes.includes(ESTIMATE_SAVE_ERRORS.UNRESOLVED_PRICING));
});

test("zero-line: hostile discount / coupon / non-zero totals are rejected at the app save boundary", () => {
  const cases: Array<[string, EstimateSaveRequest, string]> = [
    ["fixed discount intent", zeroLineRequest({ discount: { intent: { mode: "fixed_amount", fixedAmount: 500, percentage: null, percentageSupported: true }, appliedAmount: 0 } }), "discount"],
    ["percentage discount intent", zeroLineRequest({ discount: { intent: { mode: "percentage", fixedAmount: null, percentage: 10, percentageSupported: true }, appliedAmount: 0 } }), "discount"],
    ["applied discount amount", zeroLineRequest({ discount: { intent: { mode: "none", fixedAmount: null, percentage: null, percentageSupported: true }, appliedAmount: 500 } }), "discount"],
    ["selected coupon id", zeroLineRequest({ coupon: { selectedCouponIds: ["c-1"], status: "none", appliedAmount: 0 } }), "coupon"],
    ["applied coupon status", zeroLineRequest({ coupon: { selectedCouponIds: [], status: "applied", appliedAmount: 0 } }), "coupon"],
    ["applied coupon amount", zeroLineRequest({ coupon: { selectedCouponIds: [], status: "none", appliedAmount: 100 } }), "coupon"],
    ["coupon application snapshot", zeroLineRequest({ coupon: { selectedCouponIds: [], status: "none", appliedAmount: 0, applications: [{ couponId: "c", code: "c", label: "c", discountType: "amount", discountValue: 1, appliedAmount: 0 }] } }), "coupon"],
    ["non-zero subtotal", zeroLineRequest({ pricing: { ...ZERO_PRICING, subtotal: 100, taxableSubtotal: 100, taxTotal: 10, grandTotal: 110 } }), "pricing"],
  ];
  for (const [label, req, field] of cases) {
    const issues = validateEstimateSaveRequest(req).issues;
    assert.ok(issues.some((i) => i.code === ESTIMATE_SAVE_ERRORS.VALIDATION_ERROR && i.field === field), `${label}: rejected on ${field}`);
    assert.equal(evaluateEstimateSaveReadiness(req).status, "invalid", `${label}: not ready`);
  }
  // Rules for estimates WITH lines are unchanged: the priced base request still passes.
  assert.equal(validateEstimateSaveRequest(baseRequest()).ok, true);
});
