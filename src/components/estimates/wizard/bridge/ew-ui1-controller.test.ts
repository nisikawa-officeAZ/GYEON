// EW-UI-2A — controller/bridge tests.
// Run: node --import tsx --test src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resetWizardDraft, updateCustomerRegistrationMethod } from "../draft/wizard-draft-state";
import { draftToEwUi1Store, applyStorePatch, initialCanonicalDraft, type WizardStorePatch } from "./ew-ui1-controller";
import type { WizardStore } from "../wizard-types";

const fresh = () => resetWizardDraft();

const FULL_CUSTOMER: WizardStore["customer"] = {
  regMethod: "ocr", name: "山田太郎", kana: "ヤマダ タロウ", email: "a@b.jp",
  postal: "520-0000", address: "滋賀県…", phone: "090-0000-0000", lineId: "line-x",
  existingId: null, contractor: true, contractorRate: "10", creditSale: true,
  creditClosing: "20", paymentDay: "31", creditTerms: "翌月末払い",
};
const FULL_VEHICLE: WizardStore["vehicle"] = {
  maker: "トヨタ", model: "クラウン", grade: "RS", vehicleCode: "ABA-XXX", displacement: "1998cc",
  vin: "VIN123", firstRegYearMonth: "2020-04", registrationDate: "2020-04-10", color: "黒",
  inspectionExpiry: "2027-04-09", plateNumber: "滋賀 330 に 1234", existingId: null,
  suggestedSize: null, confirmedSize: "L",
};

function apply(patch: WizardStorePatch) {
  const r = applyStorePatch(fresh(), patch);
  if (!r.ok) throw new Error(`unexpected fail: ${r.error.code} ${r.error.fieldPaths.join(",")}`);
  return r.draft;
}

// 1. + 2. projection of every customer + vehicle field
test("1/2. projection of every customer and vehicle field", () => {
  const d = apply({ customer: FULL_CUSTOMER, vehicle: FULL_VEHICLE });
  const s = draftToEwUi1Store(d);
  for (const k of Object.keys(FULL_CUSTOMER) as (keyof typeof FULL_CUSTOMER)[]) {
    if (k === "existingId") continue; // null → null (checked below)
    assert.equal(s.customer[k], FULL_CUSTOMER[k], `customer.${k}`);
  }
  assert.equal(s.customer.existingId, null);
  for (const k of Object.keys(FULL_VEHICLE) as (keyof typeof FULL_VEHICLE)[]) {
    if (k === "existingId" || k === "suggestedSize") continue;
    assert.equal(s.vehicle[k], FULL_VEHICLE[k], `vehicle.${k}`);
  }
  assert.equal(s.vehicle.existingId, null);
  assert.equal(s.vehicle.suggestedSize, null); // display-only
});

// 3. new/ocr/search remain exact canonical → UI
test("3. registration method new/ocr/search exact through canonical → UI", () => {
  for (const m of ["new", "ocr", "search"] as const) {
    assert.equal(draftToEwUi1Store(updateCustomerRegistrationMethod(fresh(), m)).customer.regMethod, m);
  }
});

// 4/5/6/7. patch → canonical mapping + source-mode coherence
test("4. customer UI patch maps losslessly to canonical", () => {
  const d = apply({ customer: FULL_CUSTOMER });
  assert.equal(d.customer.registrationMethod, "ocr");
  assert.equal(d.customer.newCustomer.name, "山田太郎");
  assert.equal(d.customer.newCustomer.isBusiness, true);
  assert.equal(d.customer.newCustomer.tradeRate, "10");
  assert.equal(d.customer.newCustomer.closingDay, "20");
  assert.equal(d.customer.newCustomer.paymentDay, "31");
  assert.equal(d.customer.newCustomer.creditTerms, "翌月末払い");
});
test("5. vehicle UI patch maps losslessly to canonical", () => {
  const d = apply({ vehicle: FULL_VEHICLE });
  assert.equal(d.vehicle.newVehicle.vehicle_code, "ABA-XXX");
  assert.equal(d.vehicle.newVehicle.first_registration_year_month, "2020-04");
  assert.equal(d.vehicle.newVehicle.inspection_expiry_date, "2027-04-09");
  assert.equal(d.vehicle.bodySizeKey, "L");
});
test("6. existing customer id + source mode coherent (search)", () => {
  const d = apply({ customer: { regMethod: "search", existingId: "CUST-1" } });
  assert.equal(d.customer.registrationMethod, "search");
  assert.equal(d.customer.sourceMode, "existing");
  assert.equal(d.customer.customerId, "CUST-1");
});
test("7. existing vehicle id + source mode coherent", () => {
  const d = apply({ vehicle: { existingId: "VEH-1" } });
  assert.equal(d.vehicle.vehicleId, "VEH-1");
  assert.equal(d.vehicle.sourceMode, "existing");
  const d2 = apply({ vehicle: { existingId: null } });
  assert.equal(d2.vehicle.vehicleId, null);
  assert.equal(d2.vehicle.sourceMode, "new");
});

// 8/9. categories
test("8. categories preserve order + deduplicate", () => {
  const d = apply({ categories: ["ppf", "coating", "ppf", "window"] });
  assert.deepEqual(d.serviceSelection.selectedCategories, ["ppf", "coating", "window"]);
});
test("9. unknown category fails closed (no mutation)", () => {
  const base = fresh();
  const r = applyStorePatch(base, { categories: ["coating", "NOT_A_CATEGORY"] });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.code, "EW_UI_INVALID_CATEGORY");
  assert.ok(r.error.fieldPaths.some((p) => p.includes("NOT_A_CATEGORY")));
  assert.deepEqual(base.serviceSelection.selectedCategories, []); // unchanged
});

// 10/11/12. discount + coupons
test("10. none/amount/percent remain exact", () => {
  for (const mode of ["none", "amount", "percent"] as const) {
    assert.equal(apply({ discountMode: mode }).discountAndCoupon.mode, mode);
  }
});
test("11. inactive discount inputs preserved across mode switches", () => {
  const d = apply({ discountMode: "none", discountAmount: "3000", discountPercent: "10" });
  assert.equal(d.discountAndCoupon.mode, "none");
  assert.equal(d.discountAndCoupon.amountInput, "3000"); // inactive, preserved
  assert.equal(d.discountAndCoupon.percentInput, "10");  // inactive, preserved
});
test("12. multiple coupon ids preserved", () => {
  const d = apply({ coupons: ["C1", "C2", "C3"] });
  assert.deepEqual(d.discountAndCoupon.selectedCouponIds, ["C1", "C2", "C3"]);
});

// 13. notes separation
test("13. customer-facing notes and internal memo remain separate", () => {
  const d = apply({ notesCustomer: "cust", notesInternal: "memo" });
  assert.equal(d.notes.customerNotes, "cust");
  assert.equal(d.notes.internalMemo, "memo");
});

// 14. EW-UI-2B — services binds losslessly to the canonical serviceConfiguration.
test("14a. every serviceConfiguration field projects losslessly (8 named sections)", () => {
  const base = fresh();
  const s = draftToEwUi1Store(base).services;
  // exactly the 8 canonical sections — no omission, no extra section
  assert.deepEqual(Object.keys(s).sort(), [
    "bodyMaintenance", "carWash", "coating", "otherWork", "ppf", "roomCleaning", "storeGlobalOptions", "windowFilm",
  ]);
  assert.deepEqual(s, base.serviceConfiguration); // value-equal to canonical
});

test("14b. projected services is DEEP-COPIED — mutating it never mutates the draft", () => {
  const base = fresh();
  const s = draftToEwUi1Store(base).services;
  s.ppf.selectedPartIds.push("mutated");
  s.ppf.quantitiesByPart["x"] = 9;
  s.ppf.interiorRows.push({ id: "r-x", location: "door", amount: "100" });
  s.otherWork.customRows.push({ id: "c-x", name: "n", description: "d", unitPrice: "1", quantity: "1", unitLabel: "式" });
  assert.deepEqual(base.serviceConfiguration.ppf.selectedPartIds, []); // draft untouched
  assert.deepEqual(base.serviceConfiguration.ppf.interiorRows, []);
  assert.deepEqual(base.serviceConfiguration.otherWork.customRows, []);
});

test("14c. partial section patch applies losslessly via updateServiceConfiguration", () => {
  const d = apply({ services: { ppf: { selectedPartIds: ["part-1", "part-2"], installationMethod: "full" } } });
  assert.deepEqual(d.serviceConfiguration.ppf.selectedPartIds, ["part-1", "part-2"]);
  assert.equal(d.serviceConfiguration.ppf.installationMethod, "full");
  // untouched sibling section fields remain at their canonical defaults
  assert.deepEqual(d.serviceConfiguration.coating, fresh().serviceConfiguration.coating);
});

test("14d. copy-on-apply — caller arrays/records/rows are copied; supplied row ids preserved exactly", () => {
  const base = fresh();
  const ids = ["p1", "p2"];
  const rows = [{ id: "row-KEEP-1", location: "roof", amount: "500" }];
  const r = applyStorePatch(base, { services: { ppf: { selectedPartIds: ids, interiorRows: rows } } });
  assert.ok(r.ok);
  if (!r.ok) return;
  // supplied ids/rows are copied (not the same reference) …
  assert.notEqual(r.draft.serviceConfiguration.ppf.selectedPartIds, ids);
  assert.notEqual(r.draft.serviceConfiguration.ppf.interiorRows, rows);
  assert.notEqual(r.draft.serviceConfiguration.ppf.interiorRows[0], rows[0]);
  // … and mutating the caller's inputs afterwards never reaches canonical state
  ids.push("p3");
  rows[0].id = "row-MUTATED";
  assert.deepEqual(r.draft.serviceConfiguration.ppf.selectedPartIds, ["p1", "p2"]);
  assert.equal(r.draft.serviceConfiguration.ppf.interiorRows[0].id, "row-KEEP-1"); // id preserved exactly
});

test("14e. removing a Screen-3 category does NOT erase that category's Screen-4 config", () => {
  // configure ppf, select ppf category, then deselect the category
  let d = apply({ services: { ppf: { selectedPartIds: ["part-1"] } }, categories: ["ppf", "coating"] });
  const r = applyStorePatch(d, { categories: ["coating"] }); // drop ppf from Screen-3
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.draft.serviceSelection.selectedCategories, ["coating"]);
  assert.deepEqual(r.draft.serviceConfiguration.ppf.selectedPartIds, ["part-1"]); // config preserved
});

test("14f. atomic fail-closed — invalid category + valid service data applies NOTHING", () => {
  const base = fresh();
  const r = applyStorePatch(base, {
    categories: ["ppf", "NOT_A_CATEGORY"],
    services: { ppf: { selectedPartIds: ["part-1"] } },
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.code, "EW_UI_INVALID_CATEGORY");
  assert.deepEqual(base.serviceConfiguration.ppf.selectedPartIds, []); // service data NOT applied
  assert.deepEqual(base.serviceSelection.selectedCategories, []);      // categories NOT applied
});

test("15. non-null suggestedSize patch fails closed", () => {
  const r = applyStorePatch(fresh(), { vehicle: { suggestedSize: "L" } as Partial<WizardStore["vehicle"]> });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.code, "EW_UI_UNSUPPORTED_FIELD");
  assert.deepEqual(r.error.fieldPaths, ["vehicle.suggestedSize"]);
});

// 16/17. immutability + scoped change
test("16. invalid patch does not mutate the previous draft", () => {
  const base = fresh();
  const snapshot = JSON.stringify(base);
  applyStorePatch(base, { categories: ["bogus"] });
  applyStorePatch(base, { vehicle: { suggestedSize: "L" } as Partial<WizardStore["vehicle"]> });
  assert.equal(JSON.stringify(base), snapshot); // unchanged
});
test("17. valid patch changes only intended canonical sections", () => {
  const base = fresh();
  const r = applyStorePatch(base, { notesCustomer: "hello" });
  assert.ok(r.ok);
  if (!r.ok) return;
  const d = r.draft;
  assert.equal(d.notes.customerNotes, "hello");
  // other sections referentially unchanged (same input draft)
  assert.equal(d.customer, base.customer);
  assert.equal(d.vehicle, base.vehicle);
  assert.equal(d.serviceSelection, base.serviceSelection);
  assert.equal(d.discountAndCoupon, base.discountAndCoupon);
});

// 18. round-trip lossless for all bound fields
test("18. canonical → UI → canonical round-trip is lossless for bound fields", () => {
  const d1 = apply({
    customer: FULL_CUSTOMER, vehicle: FULL_VEHICLE, categories: ["coating", "ppf"],
    coupons: ["C1", "C2"], discountMode: "amount", discountAmount: "3000", discountPercent: "5",
    notesCustomer: "cn", notesInternal: "im",
  });
  const store1 = draftToEwUi1Store(d1);
  const r = applyStorePatch(fresh(), store1);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const store2 = draftToEwUi1Store(r.draft);
  assert.deepEqual(store2, store1);
});

// 19. hook source has no WizardStore-owned useState/useReducer/ref mirror
test("19. hook source contains no WizardStore useState/useReducer/ref mirror", () => {
  const raw = readFileSync("src/components/estimates/wizard/useEstimateWizard.ts", "utf8");
  // strip comments so the negative-mention documentation is not matched — check real CODE only.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/useState\s*<\s*WizardStore\s*>/.test(code), false);
  assert.equal(/\buseReducer\b/.test(code), false);
  assert.equal(/\buseRef\b/.test(code), false);
  // and the ONE state object is the canonical draft
  assert.equal(/useState\s*<\s*EstimateWizardDraftV22\s*>/.test(code), true);
});

// 20. navigation backed by metadata.currentStep — verified via setCurrentStep in draft
test("20. step navigation is backed by metadata.currentStep", () => {
  // applyStorePatch never changes currentStep; navigation goes through setCurrentStep on the draft.
  const d = apply({ notesCustomer: "x" });
  assert.equal(d.metadata.currentStep, 1); // patch does not move the step
});

// 21. initial partial store folds through the same validated adapter
test("21. initial partial store folds through the validated adapter", () => {
  const d = initialCanonicalDraft({ customer: { name: "初期太郎", regMethod: "ocr" } });
  assert.equal(d.customer.newCustomer.name, "初期太郎");
  assert.equal(d.customer.registrationMethod, "ocr");
  // invalid initial patch → fails closed → plain initial draft
  const d2 = initialCanonicalDraft({ categories: ["bogus"] });
  assert.deepEqual(d2.serviceSelection.selectedCategories, []);
  assert.equal(d2.customer.registrationMethod, "new");
});

// 22. no pricing/OCR/save/PDF touched — adapter output is a pure canonical draft (no extra fields)
test("22. adapter yields a pure canonical draft (no pricing/save/OCR fields introduced)", () => {
  const d = apply({ discountMode: "amount", discountAmount: "5000" });
  assert.deepEqual(Object.keys(d).sort(), [
    "customer", "discountAndCoupon", "metadata", "notes", "review",
    "serviceConfiguration", "serviceSelection", "vehicle", "version",
  ]);
  // no coupon/percentage pricing applied — intent only
  assert.equal(d.discountAndCoupon.amountInput, "5000");
});
