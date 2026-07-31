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

test("customer rules are unchanged by the vehicle correction", () => {
  const noId: EstimateSaveCustomer = { mode: "existing", customerId: "" };
  const noIdIssues = validateEstimateSaveRequest(baseRequest({ customer: noId }))
    .issues.filter((i) => i.code === ESTIMATE_SAVE_ERRORS.CUSTOMER_REQUIRED);
  assert.equal(noIdIssues.length, 1);

  const newOk: EstimateSaveCustomer = {
    mode: "new", name: "山田太郎", phone: null, email: null, postalCode: null, address: null,
    lineId: null, isBusiness: false, tradeRatePercent: null, accountsReceivableAllowed: false,
    closingDay: null, paymentDay: null, kana: null, creditTerms: null,
  };
  assert.equal(validateEstimateSaveRequest(baseRequest({ customer: newOk })).ok, true);
});
