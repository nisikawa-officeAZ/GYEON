// EW-FC-1A — lossless customer/vehicle field-contract tests.
// Run: node --import tsx --test src/components/estimates/wizard/contract/ew-ui1-field-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { newEstimateWizardDraft } from "../integration/estimateToWizardDraft";
import {
  updateNewCustomer, updateNewVehicle, updateDiscountAndCoupon,
  initialEstimateWizardDraftV22, resetWizardDraft, updateCustomerRegistrationMethod,
} from "../draft/wizard-draft-state";
import { computeWizardPricing } from "../pricing/useWizardPricing";
import { mapDraftToEstimateSaveRequest } from "../save/estimate-save-mapper";
import { buildWizardPricingInput } from "../pricing/wizard-pricing-input-adapter";
import { buildWizardPricingInputFromConfig } from "../pricing/wizard-pricing-input-adapter-config";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import { WIZARD_PRICING_ERRORS } from "../pricing/wizard-pricing-types";
import { initialWizardStore, type WizardStore } from "../wizard-types";
import {
  CUSTOMER_FIELD_CONTRACT, VEHICLE_FIELD_CONTRACT, fieldContractFor,
} from "./ew-ui1-field-contract";

const EMPTY_PRICING_CONFIG = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
} as const;

const RANK = "certified" as const;

// EW-FC-1C: fresh canonical draft with the given registration method applied via the canonical helper.
const updateCustomerRegistrationMethodC = (method: "new" | "ocr" | "search") =>
  updateCustomerRegistrationMethod(newEstimateWizardDraft().draft, method);

// Build a canonical draft with new-customer/new-vehicle fields set, then map to the save DTO.
function mapWith(nc: Record<string, unknown>, nv: Record<string, unknown> = {}) {
  const h = newEstimateWizardDraft();
  let draft = updateNewCustomer(h.draft, nc as never);
  draft = updateNewVehicle(draft, nv as never);
  const pricingResult = computeWizardPricing(draft, RANK);
  const req = mapDraftToEstimateSaveRequest({ draft, pricingResult, shopRank: RANK });
  return { req, pricingResult, draft };
}

// ── kana ──────────────────────────────────────────────────────────────────────────
test("kana survives draft → DTO as ONE unchanged string (with an internal space)", () => {
  const KANA = "ヤマダ タロウ"; // space proves it is not split
  const { req } = mapWith({ name: "山田太郎", kana: KANA });
  assert.equal(req.customer.mode, "new");
  if (req.customer.mode !== "new") return;
  assert.equal(req.customer.kana, KANA);
});

test("kana is never split, never copied into closingDay/paymentDay", () => {
  const KANA = "ヤマダ タロウ";
  const { req } = mapWith({ name: "山田", kana: KANA, closingDay: "20", paymentDay: "31" });
  if (req.customer.mode !== "new") return assert.fail("expected new");
  assert.equal(req.customer.kana, KANA);
  assert.notEqual(req.customer.closingDay, KANA);
  assert.notEqual(req.customer.paymentDay, KANA);
  assert.equal(req.customer.closingDay, "20");
  assert.equal(req.customer.paymentDay, "31");
  // exactly one whole token pair — no accidental split into separate DTO parts
  assert.equal(String(req.customer.kana), KANA);
});

// ── creditTerms / closingDay / paymentDay independence ─────────────────────────────
test("creditTerms survives draft → DTO unchanged (free text)", () => {
  const { req } = mapWith({ name: "山田", creditTerms: "翌月末払い" });
  if (req.customer.mode !== "new") return assert.fail("expected new");
  assert.equal(req.customer.creditTerms, "翌月末払い");
});

test("creditTerms, closingDay, paymentDay remain three independent values", () => {
  const { req } = mapWith({ name: "山田", closingDay: "20", paymentDay: "31", creditTerms: "翌月末払い" });
  if (req.customer.mode !== "new") return assert.fail("expected new");
  assert.equal(req.customer.closingDay, "20");
  assert.equal(req.customer.paymentDay, "31");
  assert.equal(req.customer.creditTerms, "翌月末払い");
  const set = new Set([req.customer.closingDay, req.customer.paymentDay, req.customer.creditTerms]);
  assert.equal(set.size, 3, "three fields must hold three distinct values");
});

// ── email / displacement through the EXISTING mapper ───────────────────────────────
test("email survives the existing draft → DTO mapper", () => {
  const { req } = mapWith({ name: "山田", email: "a@b.jp" });
  if (req.customer.mode !== "new") return assert.fail("expected new");
  assert.equal(req.customer.email, "a@b.jp");
});

test("displacement survives the existing draft → DTO mapper", () => {
  const { req } = mapWith({ name: "山田" }, { displacement: "1998cc" });
  assert.equal(req.vehicle.mode, "new");
  if (req.vehicle.mode !== "new") return;
  assert.equal(req.vehicle.displacement, "1998cc");
});

// ── EW-UI defaults & dealerRank removal ────────────────────────────────────────────
test("EW-UI defaults contain email / paymentDay / displacement", () => {
  const s = initialWizardStore();
  assert.equal(s.customer.email, "");
  assert.equal(s.customer.paymentDay, "");
  assert.equal(s.vehicle.displacement, "");
});

test("dealerRank no longer exists in WizardStore or its defaults", () => {
  const s = initialWizardStore();
  assert.equal(Object.prototype.hasOwnProperty.call(s, "dealerRank"), false);
  // compile-time guard: WizardStore has no dealerRank key
  const _noRank: WizardStore = s;
  assert.equal((_noRank as unknown as Record<string, unknown>).dealerRank, undefined);
});

// ── completeness: every customer/vehicle editable field has a declared destination ──
test("every customer/vehicle editable field has a declared destination", () => {
  const s = initialWizardStore();
  const customerKeys = Object.keys(s.customer).map((k) => `customer.${k}`);
  const vehicleKeys = Object.keys(s.vehicle).map((k) => `vehicle.${k}`);
  for (const key of [...customerKeys, ...vehicleKeys]) {
    const entry = fieldContractFor(key);
    assert.ok(entry, `missing field-contract entry for ${key}`);
    // a declared destination = a canonical home OR an explicit non-LOSSLESS status
    const hasDestination = entry!.canonical !== null || entry!.status !== "LOSSLESS";
    assert.ok(hasDestination, `${key} has neither a canonical home nor an explicit status`);
  }
  // and every LOSSLESS customer/vehicle entry must actually declare canonical + dto
  for (const e of [...CUSTOMER_FIELD_CONTRACT, ...VEHICLE_FIELD_CONTRACT]) {
    if (e.status === "LOSSLESS") {
      assert.ok(e.canonical, `${e.ewUiField} LOSSLESS but no canonical`);
      assert.ok(e.dto, `${e.ewUiField} LOSSLESS but no dto`);
    }
  }
});

// ── discount-none explicitly blocked from controller until canonical contract exists ─
// EW-FC-1B — canonical no-discount contract closure
test("discountMode has a canonical destination and is no longer UNRESOLVED", () => {
  const entry = fieldContractFor("discountMode");
  assert.ok(entry);
  assert.notEqual(entry!.status, "UNRESOLVED_CANONICAL_CONTRACT");
  assert.equal(entry!.canonical, "discountAndCoupon.mode");
});

// EW-UI-2A/2B — controller-bound fields become LOSSLESS; unsupported ones stay display-only.
test("EW-UI-2A/2B: bound fields are LOSSLESS; suggestedSize display-only; review controller-phase", () => {
  for (const f of ["categories", "coupons", "discountMode", "discountAmount", "discountPercent", "notesCustomer", "notesInternal"]) {
    const e = fieldContractFor(f);
    assert.ok(e, `missing ${f}`);
    assert.equal(e!.status, "LOSSLESS", `${f} should be LOSSLESS`);
    assert.ok(e!.canonical, `${f} needs a canonical home`);
  }
  // EW-UI-2B: services is now bound to the canonical serviceConfiguration.
  assert.equal(fieldContractFor("services")!.status, "LOSSLESS");
  assert.equal(fieldContractFor("services")!.canonical, "serviceConfiguration");
  // suggestedSize stays display-only; review still controller-phase (unchanged by EW-UI-2B).
  assert.equal(fieldContractFor("vehicle.suggestedSize")!.status, "DISPLAY_ONLY_UNTIL_TYPED_CONTRACT");
  assert.equal(fieldContractFor("review.previewConfirmed")!.status, "CONTROLLER_PHASE");
});

test("canonical initial + reset draft discount mode is 'none'", () => {
  assert.equal(initialEstimateWizardDraftV22.discountAndCoupon.mode, "none");
  assert.equal(resetWizardDraft().discountAndCoupon.mode, "none");
});

test("EW-UI initial discount mode is 'none'", () => {
  assert.equal(initialWizardStore().discountMode, "none");
});

test("save mapper represents 'none' as intent.none / fixedAmount null / percentage null (never invented)", () => {
  const h = newEstimateWizardDraft(); // canonical default mode is now 'none'
  const req = mapDraftToEstimateSaveRequest({ draft: h.draft, pricingResult: computeWizardPricing(h.draft, RANK), shopRank: RANK });
  assert.equal(req.discount.intent.mode, "none");
  assert.equal(req.discount.intent.fixedAmount, null);
  assert.equal(req.discount.intent.percentage, null);
  assert.equal(req.discount.appliedAmount, 0);
});

test("both pricing input adapters map 'none' to extraAmount 0 / discountIntent none / no percentage error", () => {
  const h = newEstimateWizardDraft(); // mode 'none'
  const a = buildWizardPricingInput(h.draft, RANK);
  assert.equal(a.discounts.extraAmount, 0);
  assert.equal(a.discountIntent.mode, "none");
  assert.equal(a.errors.some((e) => e.code === WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED), false);
  const b = buildWizardPricingInputFromConfig(h.draft, EMPTY_PRICING_CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.equal(b.discounts.extraAmount, 0);
  assert.equal(b.discountIntent.mode, "none");
  assert.equal(b.errors.some((e) => e.code === WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED), false);
});

test("amount mode preserved; percent mode preserved as intent AND still blocked by adapter gate", () => {
  const h = newEstimateWizardDraft();
  // amount
  const amt = updateDiscountAndCoupon(h.draft, { mode: "amount", amountInput: "2000" });
  const ra = buildWizardPricingInput(amt, RANK);
  assert.equal(ra.discounts.extraAmount, 2000);
  assert.equal(ra.discountIntent.mode, "fixed_amount");
  // percent — preserved as intent, blocked (unchanged behavior)
  const pct = updateDiscountAndCoupon(h.draft, { mode: "percent", percentInput: "10" });
  const rp = buildWizardPricingInput(pct, RANK);
  assert.equal(rp.discountIntent.mode, "percentage");
  assert.equal(rp.discounts.extraAmount, 0);
  assert.equal(rp.errors.some((e) => e.code === WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED), true);
});

// ── no pricing arithmetic introduced by the new fields ─────────────────────────────
test("added customer/vehicle fields do not affect pricing (no arithmetic path)", () => {
  const bare = mapWith({ name: "山田" });
  const withFields = mapWith(
    { name: "山田", kana: "ヤマダ タロウ", email: "a@b.jp", creditTerms: "翌月末払い", closingDay: "20", paymentDay: "31" },
    { displacement: "1998cc" },
  );
  assert.equal(withFields.pricingResult.subtotal, bare.pricingResult.subtotal);
  assert.equal(withFields.pricingResult.grandTotal, bare.pricingResult.grandTotal);
});

// ── EW-FC-1C — customer registration-method lossless contract ────────────────────
test("EW-FC-1C: customer.regMethod is LOSSLESS with canonical customer.registrationMethod", () => {
  const entry = fieldContractFor("customer.regMethod");
  assert.ok(entry);
  assert.equal(entry!.status, "LOSSLESS");
  assert.equal(entry!.canonical, "customer.registrationMethod");
});

test("EW-FC-1C: EW-UI default customer.regMethod is 'new' (canonical-typed)", () => {
  assert.equal(initialWizardStore().customer.regMethod, "new");
});

test("EW-FC-1C: UI new/ocr/search round-trip to canonical registrationMethod exactly", () => {
  for (const method of ["new", "ocr", "search"] as const) {
    const d = updateCustomerRegistrationMethodC(method);
    assert.equal(d.customer.registrationMethod, method);
  }
});

test("EW-FC-1C: save mode derives from sourceMode; registrationMethod does not alter it or pricing", () => {
  const ocr = updateCustomerRegistrationMethodC("ocr"); // registrationMethod ocr → sourceMode new
  const req = mapDraftToEstimateSaveRequest({ draft: ocr, pricingResult: computeWizardPricing(ocr, RANK), shopRank: RANK });
  assert.equal(req.customer.mode, "new"); // derived from sourceMode, NOT from registrationMethod
  // pricing identical whether registrationMethod is 'new' or 'ocr' (no monetary effect)
  const asNew = updateCustomerRegistrationMethodC("new");
  assert.equal(computeWizardPricing(ocr, RANK).grandTotal, computeWizardPricing(asNew, RANK).grandTotal);
  assert.equal(computeWizardPricing(ocr, RANK).subtotal, computeWizardPricing(asNew, RANK).subtotal);
});
