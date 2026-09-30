// EW-UI-5A1-B2 — Fixture-free config save mapper tests.
//
// Proves successful catalog+manual mapping with semantic lineIds, deterministic fail-closed precedence
// for every ConfigSaveMapperFailure, result/bundle parity, monetary fail-closed, and source guards.
// The TEST may use computeWizardPricingFromConfig to build authoritative inputs; the PRODUCTION mapper
// may not.
//
// Run: node --import tsx --test src/components/estimates/wizard/save/estimate-save-mapper-from-config.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  mapWizardDraftToSaveRequestFromConfig,
  type ConfigSaveMapperInput, type ConfigSaveMapperResult, type ConfigSaveMapperFailure,
} from "./estimate-save-mapper-from-config";
import { validateEstimateSaveRequest } from "./estimate-save-validation";
import { buildEstimateSaveRpcPayload } from "./estimate-persistence-payload";
import { computeWizardPricingFromConfig } from "../pricing/compute-wizard-pricing-from-config";
import { DEFAULT_PRICING_CATALOG, makePricingCatalog, type PricingCatalog } from "@/lib/pricing/canonical-pricing-engine";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft, WizardDiscountDraft } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import { isServiceCategoryId, type ServiceCategoryId } from "@/lib/estimates/service-categories";
import { WIZARD_CATEGORY_MANUAL_POLICY, WIZARD_CATEGORY_PRICING_POLICY } from "../pricing/wizard-pricing-identity";
import type { ConfiguredPricingConfiguration } from "../pricing/wizard-pricing-input-adapter-config";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import {
  GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
  GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";

const RANK: ShopRank = "detailer";
const CATALOG: PricingCatalog = makePricingCatalog({
  ppfR1: {
    contractVersion: "1.0",
    frontFullPricesBySize: { SS: 80_000, S: 90_000, M: 100_000, ML: 110_000, L: 120_000, LL: 130_000, XL: 140_000 },
    fullBodyPricesBySize: { SS: 400_000, S: 450_000, M: 500_000, ML: 550_000, L: 600_000, LL: 650_000, XL: 700_000 },
    partialPartPrices: { bonnet: 40_000 },
  },
});
const PC: ConfiguredPricingConfiguration = {
  ppfMethods: [{ code: "full", label: "PPFフル施工" }], filmTypes: [],
  ppfTypes: [{ code: "gg1", label: "PPFタイプA" }],
  installCoefficientBpByCode: { gg1: 12_500 },
  maintenanceMenus: [{ code: "mm1", label: "6ヶ月ボディメンテナンス" }], washMenus: [], roomCleaningMenus: [],
  storeGlobalOptions: [
    { code: "go-np", label: "非課金オプション", priceable: false, quantityRequired: false, minQuantity: 1, maxQuantity: null },
    { code: "go-q",  label: "数量オプション",   priceable: true,  quantityRequired: true,  minQuantity: 1, maxQuantity: 5 },
    { code: "go-min", label: "最小数量オプション", priceable: true, quantityRequired: true, minQuantity: 2, maxQuantity: 4 },
    { code: "go-1",  label: "単品オプション",   priceable: true,  quantityRequired: false, minQuantity: 1, maxQuantity: null },
  ],
};
const COUPON_ID = "00000000-0000-4000-8000-000000000100";
const COUPON_PC: ConfiguredPricingConfiguration = {
  ...PC,
  coupons: [{
    couponId: COUPON_ID,
    code: "uat-100-yen",
    label: "本番UAT 100円引き",
    value: { kind: "amount", amountYen: 100 },
    combinable: true,
    validFrom: null,
    validTo: null,
    isActive: true,
    displayOrder: 1,
  }],
};

function draftWith(
  categories: ServiceCategoryId[],
  cfg: Partial<WizardServiceConfigurationDraft> = {},
  dc: Partial<WizardDiscountDraft> = {},
): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  return {
    ...d,
    customer: { ...d.customer, sourceMode: "existing", customerId: "c1" },
    vehicle: { ...d.vehicle, sourceMode: "existing", vehicleId: "v1", bodySizeKey: "M" },
    serviceSelection: { ...d.serviceSelection, selectedCategories: categories },
    serviceConfiguration: { ...d.serviceConfiguration, ...cfg },
    discountAndCoupon: { ...d.discountAndCoupon, ...dc },
  };
}
const coatingCfg = (l1: string, l2: string | null = null, l3: string | null = null): Partial<WizardServiceConfigurationDraft> =>
  ({ coating: { layerCount: l3 ? 3 : l2 ? 2 : 1, layer1Id: l1, layer2Id: l2, layer3Id: l3 } });
const maintCfg: Partial<WizardServiceConfigurationDraft> = { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } };

function run(draft: EstimateWizardDraftV22, over: Partial<ConfigSaveMapperInput> = {}): ConfigSaveMapperResult {
  const pricingConfig = over.pricingConfig ?? PC;
  const pricingResult = over.pricingResult ?? computeWizardPricingFromConfig(draft, pricingConfig, CATALOG, RANK);
  return mapWizardDraftToSaveRequestFromConfig({ draft, pricingResult, pricingConfig, catalog: CATALOG, shopRank: RANK, ...over });
}
const okReq = (r: ConfigSaveMapperResult) => { assert.equal(r.ok, true); if (!r.ok) throw new Error("unreachable"); return r.request; };
const expectFail = (r: ConfigSaveMapperResult, reason: ConfigSaveMapperFailure) => {
  assert.equal(r.ok, false, `expected failure ${reason}`);
  if (r.ok) return;
  assert.equal(r.reason, reason);
  assert.ok(r.issues.length > 0 && r.issues[0].code === reason);
};

// ── Successful mapping ─────────────────────────────────────────────────────────────

test("single-layer catalog line maps with a semantic lineId", () => {
  const req = okReq(run(draftWith(["coating"], coatingCfg("one-evo"))));
  const cat = req.services.filter((s) => s.pricingSource === "catalog");
  assert.equal(cat.length, 1);
  assert.equal(cat[0].lineId, "catalog:coating:base:one-evo");
  assert.equal(cat[0].pricingReferenceId, "one-evo");
  assert.equal(cat[0].metadata.catalogLineRole, "base");
});

test("ONE + ONE creates two distinct lineIds despite the repeated product id", () => {
  const req = okReq(run(draftWith(["coating"], coatingCfg("one-evo", "one-evo"))));
  const ids = req.services.map((s) => s.lineId);
  assert.deepEqual(ids, ["catalog:coating:base:one-evo", "catalog:coating:topcoat2:one-evo"]);
  assert.equal(new Set(ids).size, 2, "distinct");
});

test("ONE + CANCOAT + CANCOAT creates three distinct lineIds", () => {
  const req = okReq(run(draftWith(["coating"], coatingCfg("one-evo", "cancoat-evo", "cancoat-evo"))));
  const ids = req.services.map((s) => s.lineId);
  assert.deepEqual(ids, ["catalog:coating:base:one-evo", "catalog:coating:topcoat2:cancoat-evo", "catalog:coating:topcoat3:cancoat-evo"]);
  assert.equal(new Set(ids).size, 3);
});

test("operator-selected line order becomes the persisted service array order", () => {
  const base = draftWith(["coating"], coatingCfg("one-evo", "cancoat-evo"));
  const draft: EstimateWizardDraftV22 = {
    ...base,
    review: {
      ...base.review,
      serviceLineOrder: [
        "catalog:coating:topcoat2:cancoat-evo",
        "catalog:coating:base:one-evo",
      ],
    },
  };
  const req = okReq(run(draft));
  assert.deepEqual(req.services.map((line) => line.lineId), draft.review.serviceLineOrder);
});

// GDA-ESTIMATE-PR133 P2-1: a quantity override is only valid on a quantityRequired store-global option
// and only within its configured bounds; the catalog coating line's quantity is fixed, so the persisted
// quantity edit below targets the option while the unit-price edit targets the coating line.
const quantityOptionCfg: Partial<WizardServiceConfigurationDraft> = {
  storeGlobalOptions: { selectedOptionIds: ["go-q"], unitPricesByOption: { "go-q": "2000" }, quantitiesByOption: { "go-q": 2 } },
};

test("final-review quantity and unit-price edits persist with recomputed totals", () => {
  const base = draftWith(["coating"], { ...coatingCfg("one-evo"), ...quantityOptionCfg });
  const coatingId = "catalog:coating:base:one-evo";
  const optionId = "manual:store_global_options:go-q";
  const draft: EstimateWizardDraftV22 = {
    ...base,
    review: {
      ...base.review,
      quantityInputsByLine: { [optionId]: "3" },
      unitPriceInputsByLine: { [coatingId]: "60000" },
    },
  };

  const req = okReq(run(draft));
  const coating = req.services.find((s) => s.lineId === coatingId);
  const option = req.services.find((s) => s.lineId === optionId);
  assert.equal(coating?.quantity, 1, "catalog quantity untouched");
  assert.equal(coating?.unitPrice, 60_000);
  assert.equal(coating?.subtotal, 60_000);
  assert.equal(option?.quantity, 3, "configured in-bounds quantity persisted");
  assert.equal(option?.unitPrice, 2_000);
  assert.equal(option?.subtotal, 6_000);
  assert.equal(req.pricing.subtotal, 66_000);
  assert.equal(req.pricing.taxTotal, 6_600);
  assert.equal(req.pricing.grandTotal, 72_600);
});

test("GDA-ESTIMATE-PR133 P2-1: a disallowed quantity override fails the save closed as pricing-error", () => {
  const base = draftWith(["coating", "maintenance"], {
    ...coatingCfg("one-evo"), ...maintCfg,
    storeGlobalOptions: {
      selectedOptionIds: ["go-q", "go-min", "go-1"],
      unitPricesByOption: { "go-q": "2000", "go-min": "1000", "go-1": "500" },
      quantitiesByOption: { "go-q": 2, "go-min": 3 },
    },
  });
  assert.equal(run(base).ok, true, "PRECONDITION: the canonical draft saves");
  const withQuantity = (lineId: string, q: string): EstimateWizardDraftV22 =>
    ({ ...base, review: { ...base.review, quantityInputsByLine: { [lineId]: q } } });

  // not quantityRequired: catalog line, plain manual line, non-quantity option
  expectFail(run(withQuantity("catalog:coating:base:one-evo", "2")), "pricing-error");
  expectFail(run(withQuantity("manual:maintenance:mm1", "2")), "pricing-error");
  expectFail(run(withQuantity("manual:store_global_options:go-1", "2")), "pricing-error");
  // outside the configured bounds
  expectFail(run(withQuantity("manual:store_global_options:go-q", "6")), "pricing-error");   // max 5
  expectFail(run(withQuantity("manual:store_global_options:go-min", "1")), "pricing-error"); // min 2
  expectFail(run(withQuantity("manual:store_global_options:go-min", "5")), "pricing-error"); // max 4
  // configured and in bounds: persisted
  const ok = okReq(run(withQuantity("manual:store_global_options:go-min", "4")));
  assert.equal(ok.services.find((s) => s.lineId === "manual:store_global_options:go-min")?.quantity, 4);
  // identity quantities on fixed lines remain a no-op
  const identity = okReq(run(withQuantity("manual:maintenance:mm1", "1")));
  assert.deepEqual(identity.pricing, okReq(run(base)).pricing);
});

test("GDA-ESTIMATE-PR123-R2: coupon + fixed discount persist with the coupon counted exactly once; identity edits persist identically; edits recompute", () => {
  const canonicalDraft = draftWith(["maintenance"], maintCfg, { mode: "amount", amountInput: "1000", selectedCouponIds: [COUPON_ID] });
  const canonical = okReq(run(canonicalDraft, { pricingConfig: COUPON_PC }));
  assert.equal(canonical.pricing.subtotal, 5000);
  assert.equal(canonical.pricing.couponTotal, 100, "couponTotal is ONLY the coupon");
  assert.equal(canonical.coupon.appliedAmount, 100);
  assert.equal(canonical.pricing.discountTotal, 1100, "applied document discount = authored 1,000 + coupon 100, counted once");
  assert.equal(canonical.discount.appliedAmount, 1100, "engine-applied figure, copied");
  assert.equal(canonical.discount.intent.fixedAmount, 1000, "the authored figure is persisted as intent, never conflated with the applied amount");
  assert.equal(canonical.pricing.taxTotal, 500);
  assert.equal(canonical.pricing.grandTotal, 5000 + 500 - 1100, "total subtracts the applied discount once; couponTotal is never subtracted again");
  assert.equal((canonical.coupon.applications ?? []).reduce((s, a) => s + a.appliedAmount, 0), 100, "per-coupon snapshot sums to couponTotal");

  const lineId = "manual:maintenance:mm1";
  const identityDraft: EstimateWizardDraftV22 = {
    ...canonicalDraft,
    review: { ...canonicalDraft.review, quantityInputsByLine: { [lineId]: "1" }, unitPriceInputsByLine: { [lineId]: "5000" } },
  };
  const identity = okReq(run(identityDraft, { pricingConfig: COUPON_PC }));
  assert.deepEqual(identity.pricing, canonical.pricing, "identity edit: persisted pricing snapshot is byte-identical");
  assert.deepEqual(identity.discount, canonical.discount);
  assert.deepEqual(identity.coupon, canonical.coupon);
  assert.deepEqual(identity.services, canonical.services);

  const editedDraft: EstimateWizardDraftV22 = {
    ...canonicalDraft,
    review: { ...canonicalDraft.review, unitPriceInputsByLine: { [lineId]: "8000" } },
  };
  const edited = okReq(run(editedDraft, { pricingConfig: COUPON_PC }));
  assert.equal(edited.services[0]?.unitPrice, 8000);
  assert.equal(edited.pricing.subtotal, 8000);
  assert.equal(edited.pricing.couponTotal, 100, "amount coupon unchanged by the edit");
  assert.equal(edited.pricing.discountTotal, 1100, "fixed discount unchanged; coupon still counted once");
  assert.equal(edited.pricing.taxTotal, 800);
  assert.equal(edited.pricing.grandTotal, 8000 + 800 - 1100);
  assert.equal(edited.discount.appliedAmount, 1100);
  assert.equal(edited.coupon.appliedAmount, 100);
});

test("catalog ids and roles come directly from the pricing result", () => {
  const draft = draftWith(["coating"], coatingCfg("one-evo", "cancoat-evo", "cancoat-evo"));
  const pr = computeWizardPricingFromConfig(draft, PC, CATALOG, RANK);
  const req = okReq(run(draft, { pricingResult: pr }));
  const prCat = pr.lines.filter((l) => l.kind === "catalog");
  req.services.forEach((s, i) => {
    const pl = prCat[i];
    assert.equal(s.pricingReferenceId, pl.pricingReferenceId);
    assert.equal(s.metadata.catalogLineRole, pl.kind === "catalog" ? pl.catalogLineRole : null);
    assert.equal(s.label, pl.label);
  });
});

test("manual label comes from pricingConfig; identity + option identity preserved", () => {
  // maintenance manual line → label from config; calculated PPF line → optionIdentity from ppfTypeId.
  const draft = draftWith(["maintenance", "ppf"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    ppf: { installationMethod: "full", fullCoverage: "full_body", selectedPartIds: [], quantitiesByPart: {}, ppfTypeId: "gg1", unitPriceInput: "100000", vehicleCoefficientInput: "1.0", interiorRows: [] },
  });
  const req = okReq(run(draft));
  const maint = req.services.find((s) => s.category === "maintenance");
  assert.equal(maint?.label, "6ヶ月ボディメンテナンス", "label from config, not the code");
  assert.equal(maint?.manualPricingIdentity, "mm1");
  const ppf = req.services.find((s) => s.category === "ppf");
  assert.equal(ppf?.manualPricingIdentity, "ppf_r1_full_body_gg1");
  assert.deepEqual(ppf?.selectedOptionReferenceIds, ["gg1"], "option identity preserved");
});

test("customer/vehicle/kana/creditTerms/displacement/notes preserved", () => {
  const d = resetWizardDraft();
  const draft: EstimateWizardDraftV22 = {
    ...d,
    customer: { ...d.customer, sourceMode: "new", customerId: null,
      newCustomer: { ...d.customer.newCustomer, name: "山田太郎", kana: "ヤマダタロウ", creditTerms: "月末締め翌月末払い" } },
    vehicle: { ...d.vehicle, sourceMode: "new", vehicleId: null,
      newVehicle: { ...d.vehicle.newVehicle, model: "クラウン", displacement: "1998cc" }, bodySizeKey: "M" },
    serviceSelection: { ...d.serviceSelection, selectedCategories: ["maintenance"] },
    serviceConfiguration: { ...d.serviceConfiguration, ...maintCfg },
    notes: { customerNotes: "お客様備考", internalMemo: "社内メモ" },
  };
  const req = okReq(run(draft));
  assert.equal(req.customer.mode, "new");
  if (req.customer.mode === "new") { assert.equal(req.customer.kana, "ヤマダタロウ"); assert.equal(req.customer.creditTerms, "月末締め翌月末払い"); }
  assert.equal(req.vehicle.mode, "new");
  if (req.vehicle.mode === "new") assert.equal(req.vehicle.displacement, "1998cc");
  assert.equal(req.notes.customerNotes, "お客様備考");
  assert.equal(req.notes.internalMemo, "社内メモ");
  assert.equal(req.metadata.source, "estimate-wizard-v2.2");
});

test("fixed-amount discount intent is preserved with appliedAmount from the result", () => {
  const draft = draftWith(["maintenance"], maintCfg, { mode: "amount", amountInput: "1000" });
  const pr = computeWizardPricingFromConfig(draft, PC, CATALOG, RANK);
  const req = okReq(run(draft, { pricingResult: pr }));
  assert.equal(req.discount.intent.mode, "fixed_amount");
  assert.equal(req.discount.intent.fixedAmount, 1000);
  assert.equal(req.discount.appliedAmount, pr.discountTotal);
  assert.equal(req.pricing.taxRatePercent, 10, "tax rate from the rebuilt bundle");
  assert.equal(req.nonPriceableSelections.length, 0);
});

test("a valid mapped request passes validateEstimateSaveRequest", () => {
  const req = okReq(run(draftWith(["maintenance"], maintCfg)));
  assert.equal(validateEstimateSaveRequest(req).ok, true);
});

// ── Failure cases (each reason) ─────────────────────────────────────────────────────

const baseResult = () => computeWizardPricingFromConfig(draftWith(["maintenance"], maintCfg), PC, CATALOG, RANK);
const withResult = (pr: WizardPricingResult) => run(draftWith(["maintenance"], maintCfg), { pricingResult: pr });

test("pricing-incomplete / pricing-error / unresolved-items", () => {
  expectFail(run(draftWith([])), "pricing-incomplete");                                  // no selection → unavailable
  expectFail(withResult({ ...baseResult(), errors: [{ code: "E", category: null, sourceId: null, message: "e" }] }), "pricing-error");
  expectFail(withResult({ ...baseResult(), unresolvedItems: [{ category: "maintenance", sourceId: null, code: "U", message: "u" }] }), "unresolved-items");
});

// B1.1 — a percentage discount is now AUTHORIZED and no longer blocks the save. What still fails
// closed is an UNRESOLVABLE coupon selection, which is a narrower guard, not a weaker one.
test("an unresolvable coupon selection still fails closed → coupon-unpriced", () => {
  expectFail(withResult({ ...baseResult(), couponState: { status: "selected_not_priced", couponId: "c", label: "x", warningCode: "COUPON_PRICING_NOT_IMPLEMENTED" } }), "coupon-unpriced");
});

test("null / non-finite / negative aggregate + line amounts, and invalid quantity", () => {
  expectFail(withResult({ ...baseResult(), grandTotal: null }), "null-aggregate-total");
  expectFail(withResult({ ...baseResult(), lines: baseResult().lines.map((l) => ({ ...l, unitPrice: null })) }), "null-line-amount");
  expectFail(withResult({ ...baseResult(), subtotal: Infinity }), "non-finite-amount");
  expectFail(withResult({ ...baseResult(), subtotal: -1 }), "negative-amount");
  expectFail(withResult({ ...baseResult(), lines: baseResult().lines.map((l) => ({ ...l, quantity: 0 })) }), "invalid-quantity");
});

test("missing catalog identity / missing manual identity / duplicate line identity", () => {
  const coat = computeWizardPricingFromConfig(draftWith(["coating"], coatingCfg("one-evo")), PC, CATALOG, RANK);
  // empty catalog id → missing-catalog-identity
  const emptyId = { ...coat, lines: coat.lines.map((l) => (l.kind === "catalog" ? { ...l, pricingReferenceId: "" } : l)) };
  expectFail(run(draftWith(["coating"], coatingCfg("one-evo")), { pricingResult: emptyId }), "missing-catalog-identity");
  // manual line correlating to no bundle entry → missing-manual-identity
  const base = baseResult();
  const badManual = { ...base, lines: base.lines.map((l) => (l.kind === "manual" ? { ...l, sourceId: "maintenance:UNKNOWN" } : l)) };
  expectFail(withResult(badManual), "missing-manual-identity");
  // duplicate catalog line → duplicate-line-identity
  const dup = { ...coat, lines: [...coat.lines, coat.lines[0]] };
  expectFail(run(draftWith(["coating"], coatingCfg("one-evo")), { pricingResult: dup }), "duplicate-line-identity");
});

test("unknown-configured-item (selected code not in config)", () => {
  expectFail(run(draftWith(["maintenance"], { bodyMaintenance: { menuId: "no-such-menu", unitPriceInput: "5000" } })), "unknown-configured-item");
});

test("result-bundle-mismatch (result from a different draft)", () => {
  const coatingResult = computeWizardPricingFromConfig(draftWith(["coating"], coatingCfg("one-evo")), PC, CATALOG, RANK);
  // map a coating result against a maintenance draft
  expectFail(run(draftWith(["maintenance"], maintCfg), { pricingResult: coatingResult }), "result-bundle-mismatch");
});

test("a selected priceable:false option is rejected (pricing gate preserved)", () => {
  const draft = draftWith(["maintenance"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    storeGlobalOptions: { selectedOptionIds: ["go-np"], unitPricesByOption: { "go-np": "1000" }, quantitiesByOption: {} },
  });
  const r = run(draft);
  assert.equal(r.ok, false);
});

test("an unexpected internal exception becomes mapping-failed, never thrown", () => {
  const draft = draftWith(["coating"], coatingCfg("one-evo"));
  const badCatalog = {} as unknown as PricingCatalog; // buildWizardPricingInputFromConfig will throw on catalog.coatings
  let r!: ConfigSaveMapperResult;
  assert.doesNotThrow(() => {
    r = mapWizardDraftToSaveRequestFromConfig({ draft, pricingResult: computeWizardPricingFromConfig(draft, PC, CATALOG, RANK), pricingConfig: PC, catalog: badCatalog, shopRank: RANK });
  });
  expectFail(r, "mapping-failed");
});

// ── Deterministic precedence ────────────────────────────────────────────────────────

// B1.1 — with the percentage refusal gone, a null aggregate total is now the first failure a
// percentage-carrying result hits. The remaining fail-closed ordering is unchanged.
test("precedence: a percentage intent no longer pre-empts the null-aggregate guard", () => {
  const pr = { ...baseResult(), discountIntent: { mode: "percentage" as const, percentage: 10 }, grandTotal: null };
  expectFail(withResult(pr), "null-aggregate-total");
});

// ── R50A-F1 — authoritative bundle / payload parity fail-closed corrections ─────────

// A. A forged complete/success pricingResult can NEVER hide an authoritative bundle error.
test("R50A-F1 A: a bundle MANUAL_PRICE_REQUIRED error is not hidden by a forged complete result → pricing-error", () => {
  const badDraft = draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "" } });
  const forgedComplete = baseResult(); // status success, completeness complete, no errors — a decoy
  expectFail(run(badDraft, { pricingResult: forgedComplete }), "pricing-error");
});

test("R50A-F1 A: a selected priceable:false option surfaces as exactly pricing-error", () => {
  const draft = draftWith(["maintenance"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    storeGlobalOptions: { selectedOptionIds: ["go-np"], unitPricesByOption: { "go-np": "1000" }, quantitiesByOption: {} },
  });
  expectFail(run(draft), "pricing-error");
});

// B. Coupon fail-closed — a coupon amount that the authoritative bundle did not resolve is never
//    silently copied. (B1.1 narrowed this from "any non-zero couponTotal" to "a non-zero
//    couponTotal with no resolved applications", which is exactly the forgery case.)
test("R50A-F1 B: a couponTotal with no resolved applications fails closed → coupon-unpriced", () => {
  expectFail(withResult({ ...baseResult(), couponTotal: 999 }), "coupon-unpriced");
});

// C. Complete discount-intent parity — a mode match with a differing amount still rejects.
test("R50A-F1 C: bundle fixed 1000 vs result fixed 2000 → result-bundle-mismatch", () => {
  const draft = draftWith(["maintenance"], maintCfg, { mode: "amount", amountInput: "1000" });
  const pr = computeWizardPricingFromConfig(draft, PC, CATALOG, RANK);
  const forged: WizardPricingResult = { ...pr, discountIntent: { mode: "fixed_amount", amount: 2000 } };
  expectFail(run(draft, { pricingResult: forged }), "result-bundle-mismatch");
});

// D. Manual-line identity/category parity — a matched sourceId with a different category rejects.
test("R50A-F1 D: manual sourceId maintenance:mm1 relabelled category ppf → result-bundle-mismatch", () => {
  const base = baseResult();
  const miscat: WizardPricingResult = {
    ...base,
    lines: base.lines.map((l) => (l.kind === "manual" ? { ...l, category: "ppf" } : l)),
  };
  expectFail(withResult(miscat), "result-bundle-mismatch");
});

test("R50A-F1 D: a duplicated manual identity → duplicate-line-identity", () => {
  const base = baseResult(); // one maintenance manual line
  const dupManual: WizardPricingResult = { ...base, lines: [...base.lines, base.lines[0]] };
  expectFail(withResult(dupManual), "duplicate-line-identity");
});

// Catalog identity — a missing catalogLineRole fails closed (defensive; the adapter forbids it upstream).
test("R50A-F1: a catalog line missing its catalogLineRole → missing-catalog-identity", () => {
  const coatDraft = draftWith(["coating"], coatingCfg("one-evo"));
  const coat = computeWizardPricingFromConfig(coatDraft, PC, CATALOG, RANK);
  const noRole: WizardPricingResult = {
    ...coat,
    lines: coat.lines.map((l) => (l.kind === "catalog" ? ({ ...l, catalogLineRole: null } as unknown as typeof l) : l)),
  };
  expectFail(run(coatDraft, { pricingResult: noRole }), "missing-catalog-identity");
});

// Happy path — a valid fixed-amount discount whose bundle/result agree still maps successfully.
test("R50A-F1: a valid fixed-amount discount (bundle == result) still maps successfully", () => {
  const draft = draftWith(["maintenance"], maintCfg, { mode: "amount", amountInput: "1000" });
  const pr = computeWizardPricingFromConfig(draft, PC, CATALOG, RANK);
  const req = okReq(run(draft, { pricingResult: pr }));
  assert.equal(req.discount.intent.mode, "fixed_amount");
  assert.equal(req.discount.intent.fixedAmount, 1000);
  assert.equal(req.coupon.appliedAmount, 0);
  assert.equal(validateEstimateSaveRequest(req).ok, true);
});

// ── Source guards ────────────────────────────────────────────────────────────────

test("the production mapper imports no fixture/default/legacy/persistence and has no monetary fallback", () => {
  const code = readFileSync("src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, "no DEFAULT catalog");
  assert.equal(/EXAMPLE_/.test(code), false, "no EXAMPLE_*");
  assert.equal(/FIXTURE_|wizard-catalog-fixtures/.test(code), false, "no fixtures");
  assert.equal(/buildWizardPricingInput(?!FromConfig)/.test(code), false, "no fixture input adapter");
  assert.equal(/wizard-pricing-input-adapter(?!-config)/.test(code), false, "no fixture adapter path");
  assert.equal(/estimate-save-mapper(?!-from-config)/.test(code), false, "no legacy mapper import");
  assert.equal(/ScreensPreview/.test(code), false, "no ScreensPreview");
  assert.equal(/\?\?\s*0|\|\|\s*0/.test(code), false, "no ?? 0 / || 0 monetary fallback");
  assert.equal(/calculateEstimate\b|computeWizardPricingFromConfig/.test(code), false, "no engine/compute call");
  assert.equal(/use client|from ["']react["']/.test(code), false, "no React / use client");
  assert.equal(/supabase|server-only|persistence|createEstimate|updateEstimate/.test(code), false, "no DB/persistence");
  assert.equal(/next\/(navigation|router|image)/.test(code), false, "no route import");
  assert.equal(/Date\.now|new Date|Math\.random|randomUUID|crypto\./.test(code), false, "no clock/random/uuid");
});

// ── B1.1-B2: configuration revision + per-coupon snapshot ────────────────────

test("B1.1-B2: the configuration revision is copied verbatim into metadata", () => {
  const req = okReq(run(draftWith(["maintenance"], maintCfg), { configurationRevision: 7 }));
  assert.equal(req.metadata.configurationRevision, 7);
});

test("B1.1-B2: an absent revision is null ('unattributed'), never fabricated", () => {
  const req = okReq(run(draftWith(["maintenance"], maintCfg)));
  assert.equal(req.metadata.configurationRevision, null);
});

test("B1.1-B2: a non-integer / negative / non-numeric revision is rejected to null, not persisted", () => {
  for (const bad of [1.5, -1, Number.NaN, "7" as unknown as number]) {
    const req = okReq(run(draftWith(["maintenance"], maintCfg), { configurationRevision: bad }));
    assert.equal(req.metadata.configurationRevision, null);
  }
});

test("B1.1-B2: with no coupons the coupon block stays 'none' with an empty snapshot", () => {
  const req = okReq(run(draftWith(["maintenance"], maintCfg)));
  assert.equal(req.coupon.status, "none");
  assert.deepEqual(req.coupon.selectedCouponIds, []);
  assert.deepEqual(req.coupon.applications, []);
  assert.equal(req.coupon.appliedAmount, 0);
});

test("B1.1-B2: a configured coupon is persisted with its immutable id, authored snapshot, and applied amount", () => {
  const draft = draftWith(["maintenance"], maintCfg, { selectedCouponIds: [COUPON_ID] });
  const req = okReq(run(draft, { pricingConfig: COUPON_PC }));

  assert.equal(req.pricing.subtotal, 5000);
  assert.equal(req.pricing.discountTotal, 100);
  assert.equal(req.pricing.couponTotal, 100);
  // GDA-ESTIMATE-POST-TAX-ADJUSTMENT-R1: the persisted tax base IS the subtotal; the
  // document discount is subtracted AFTER tax (5000 + 500 − 100).
  assert.equal(req.pricing.taxableSubtotal, 5000);
  assert.equal(req.pricing.taxTotal, 500);
  assert.equal(req.pricing.grandTotal, 5400);
  assert.equal(req.coupon.status, "applied");
  assert.equal(req.coupon.appliedAmount, 100);
  assert.deepEqual(req.coupon.selectedCouponIds, [COUPON_ID]);
  assert.deepEqual(req.coupon.applications, [{
    couponId: COUPON_ID,
    code: "uat-100-yen",
    label: "本番UAT 100円引き",
    discountType: "amount",
    discountValue: 100,
    appliedAmount: 100,
  }]);
  assert.equal(validateEstimateSaveRequest(req).ok, true);
});

// ── EST-WIZ-REQ-F1: navigation/save discriminator agreement ──────────────────
//
// The Step-2 navigation predicate and this mapper read the SAME two fields
// (vehicle.sourceMode, vehicle.vehicleId). These tests pin the mapper side of that
// agreement: any draft navigation treats as "will save existing" maps to mode
// "existing" with the exact id, and every degenerate combination falls to "new" —
// where the tightened save validation requires the model.

test("F1: sourceMode existing + vehicleId maps to an EXISTING vehicle with the exact id", () => {
  const req = okReq(run(draftWith(["maintenance"], maintCfg)));
  assert.equal(req.vehicle.mode, "existing");
  if (req.vehicle.mode === "existing") assert.equal(req.vehicle.vehicleId, "v1");
});

test("F1: degenerate drafts (sourceMode new/null with a non-null id) map to NEW — same branch navigation gates on the model", () => {
  for (const sourceMode of ["new", null] as const) {
    const d = draftWith(["maintenance"], maintCfg);
    const degenerate = { ...d, vehicle: { ...d.vehicle, sourceMode, vehicleId: "v1" } };
    const req = okReq(run(degenerate));
    assert.equal(req.vehicle.mode, "new", `sourceMode=${String(sourceMode)} must not save as existing`);
  }
});

test("F1: sourceMode existing WITHOUT an id maps to NEW, and maker-only is then save-blocked", () => {
  const d = draftWith(["maintenance"], maintCfg);
  const noId = {
    ...d,
    vehicle: {
      ...d.vehicle, sourceMode: "existing" as const, vehicleId: null,
      newVehicle: { ...d.vehicle.newVehicle, maker: "トヨタ", model: "" },
    },
  };
  const req = okReq(run(noId));
  assert.equal(req.vehicle.mode, "new");
  const validation = validateEstimateSaveRequest(req);
  assert.equal(validation.ok, false, "maker-only new vehicle is rejected");
  assert.ok(validation.issues.some((i) => i.field === "vehicle.model"), "by the approved model rule");
});

test("F1: stale model text is DROPPED by the existing branch — the id alone is persisted", () => {
  const d = draftWith(["maintenance"], maintCfg);
  const stale = { ...d, vehicle: { ...d.vehicle, newVehicle: { ...d.vehicle.newVehicle, model: "残留モデル" } } };
  const req = okReq(run(stale));
  assert.equal(req.vehicle.mode, "existing");
  assert.equal(JSON.stringify(req.vehicle).includes("残留モデル"), false, "no stale CREATE data rides along");
});

test("F2-R1: sourceMode existing with an EMPTY-STRING vehicleId maps to NEW — the truthy discriminator", () => {
  // The mapper tests `sourceMode === "existing" && v.vehicleId` (truthy), so an empty
  // string falls to the NEW branch; willSaveExistingVehicle mirrors exactly this.
  const d = draftWith(["maintenance"], maintCfg);
  const emptyId = { ...d, vehicle: { ...d.vehicle, sourceMode: "existing" as const, vehicleId: "" } };
  const req = okReq(run(emptyId));
  assert.equal(req.vehicle.mode, "new", "an empty-string id must never save as existing");
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — per-part partial PPF persistence parity ────────────

const PARTIAL_CATALOG: PricingCatalog = makePricingCatalog({ ppfR1: {
  contractVersion: "1.0",
  frontFullPricesBySize: { SS: 1, S: 1, M: 100_000, ML: 1, L: 1, LL: 1, XL: 1 },
  fullBodyPricesBySize: { SS: 1, S: 1, M: 500_000, ML: 1, L: 1, LL: 1, XL: 1 },
  partialPartPrices: { bonnet: 40_000, "front-bumper": 50_000, "door-mirror": 33_333 },
} });
const PARTIAL_PC: ConfiguredPricingConfiguration = {
  ...PC,
  ppfMethods: [{ code: "full", label: "PPFフル施工" }, { code: "partial", label: "部分施工" }],
  ppfParts: [
    { code: "bonnet", label: "ボンネット", minQuantity: 1, maxQuantity: 4 },
    { code: "front-bumper", label: "フロントバンパー", minQuantity: 1, maxQuantity: null },
    { code: "door-mirror", label: "ドアミラー", minQuantity: 1, maxQuantity: 2 },
  ],
};
const partialDraft = (quantities: Record<string, number>, review: Partial<EstimateWizardDraftV22["review"]> = {}) => {
  const d = draftWith(["coating", "ppf"], {
    ...coatingCfg("one-evo"),
    ppf: { installationMethod: "partial", fullCoverage: null, selectedPartIds: ["door-mirror", "bonnet", "front-bumper"], quantitiesByPart: quantities, ppfTypeId: "gg1", unitPriceInput: "", vehicleCoefficientInput: "1.0", interiorRows: [] },
  });
  return { ...d, review: { ...d.review, ...review } };
};
const runPartial = (
  quantities: Record<string, number>,
  review: Partial<EstimateWizardDraftV22["review"]> = {},
  pricingConfig: ConfiguredPricingConfiguration = PARTIAL_PC,
) => {
  const d = partialDraft(quantities, review);
  const pricingResult = computeWizardPricingFromConfig(d, pricingConfig, PARTIAL_CATALOG, RANK);
  return { pricingResult, mapped: mapWizardDraftToSaveRequestFromConfig({ draft: d, pricingResult, pricingConfig, catalog: PARTIAL_CATALOG, shopRank: RANK }) };
};

test("Stage B: three partial parts persist as three distinct lines with quantity, per-unit price, subtotal = unit × quantity", () => {
  const { pricingResult, mapped } = runPartial({ bonnet: 2, "door-mirror": 2 });
  assert.equal(pricingResult.completeness, "complete", "PRECONDITION");
  const req = okReq(mapped);
  const ppf = req.services.filter((s) => s.category === "ppf");
  assert.deepEqual(ppf.map((s) => [s.lineId, s.label, s.quantity, s.unitPrice, s.subtotal]), [
    ["manual:ppf:ppf_r1_partial_gg1_door-mirror", "PPF 部分施工 ドアミラー（PPFタイプA）", 2, 41_666, 83_332],
    ["manual:ppf:ppf_r1_partial_gg1_bonnet", "PPF 部分施工 ボンネット（PPFタイプA）", 2, 50_000, 100_000],
    ["manual:ppf:ppf_r1_partial_gg1_front-bumper", "PPF 部分施工 フロントバンパー（PPFタイプA）", 1, 62_500, 62_500],
  ]);
  assert.equal(new Set(req.services.map((s) => s.lineId)).size, req.services.length, "all line ids distinct");
  for (const s of ppf) {
    assert.equal(s.subtotal, s.unitPrice * s.quantity);
    assert.deepEqual(s.selectedOptionReferenceIds, ["gg1"]);
    assert.equal(s.metadata.ppfScope, "partial");
    assert.equal(s.metadata.ppfPartCode, s.lineId.split("_").at(-1));
  }
  assert.equal(req.pricing.subtotal, pricingResult.subtotal);
  assert.equal(req.pricing.grandTotal, pricingResult.grandTotal);
  assert.equal(validateEstimateSaveRequest(req).ok, true, "a valid mapped request passes save validation");
});

test("Stage B: a stale pre-Stage-B aggregate id in the saved order/overrides is ignored; a valid review quantity edit persists identically to a Step-4 quantity", () => {
  const canonical = runPartial({ bonnet: 3 });
  const stale = runPartial({ bonnet: 3 }, {
    serviceLineOrder: ["manual:ppf:ppf_r1_partial_gg1", "manual:ppf:ppf_r1_partial_gg1_front-bumper", "catalog:coating:base:one-evo"],
    quantityInputsByLine: { "manual:ppf:ppf_r1_partial_gg1": "9" },
  });
  const staleReq = okReq(stale.mapped);
  assert.deepEqual(staleReq.pricing, okReq(canonical.mapped).pricing, "old aggregate id never re-prices a part line");
  assert.deepEqual(staleReq.services.map((s) => s.lineId), [
    "manual:ppf:ppf_r1_partial_gg1_front-bumper", "catalog:coating:base:one-evo",
    "manual:ppf:ppf_r1_partial_gg1_door-mirror", "manual:ppf:ppf_r1_partial_gg1_bonnet",
  ], "known ids ordered as requested, stale id dropped, remaining lines appended in engine order");
  const viaReview = runPartial({ bonnet: 2 }, { quantityInputsByLine: { "manual:ppf:ppf_r1_partial_gg1_bonnet": "3" } });
  assert.deepEqual(okReq(viaReview.mapped).services.map((s) => [s.lineId, s.quantity, s.unitPrice, s.subtotal]), okReq(canonical.mapped).services.map((s) => [s.lineId, s.quantity, s.unitPrice, s.subtotal]));
  assert.deepEqual(okReq(viaReview.mapped).pricing, okReq(canonical.mapped).pricing);
  const outOfBounds = runPartial({ bonnet: 2 }, { quantityInputsByLine: { "manual:ppf:ppf_r1_partial_gg1_bonnet": "5" } });
  expectFail(outOfBounds.mapped, "pricing-error");
});

// The dealer-wide PPF/coating rule shape below is the same one proven by ppf-r1-wizard-pricing.test.ts
// and wizard-review-line-adjustments.test.ts (global method/coating codes, amount 5,000).
const PARTIAL_PC_WITH_REDUCTION: ConfiguredPricingConfiguration = {
  ...PARTIAL_PC,
  ppfCoatingAdjustments: [{
    ruleId: "r",
    ppfMethodCode: GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE,
    coatingCode: GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
    adjustmentType: "amount",
    adjustmentValue: 5_000,
    isActive: true,
  }],
};
const reductionCarriers = (services: readonly { lineId: string; metadata: { ppfCoatingAdjustmentReductionYen?: unknown } }[]) =>
  services.filter((s) => s.metadata.ppfCoatingAdjustmentReductionYen !== undefined).map((s) => [s.lineId, s.metadata.ppfCoatingAdjustmentReductionYen]);
const yen = (value: number | null | undefined, label: string): number => {
  assert.equal(typeof value, "number", `${label} must be a persisted yen number`);
  return value as number;
};

test("Stage B: the PPF/coating reduction persists on exactly ONE part line and remains a single document-level discount across three part lines", () => {
  const quantities = { bonnet: 2, "door-mirror": 2 };
  const { pricingResult, mapped } = runPartial(quantities, {}, PARTIAL_PC_WITH_REDUCTION);
  assert.equal(pricingResult.completeness, "complete", "PRECONDITION");
  assert.equal(pricingResult.discountTotal, 5_000, "PRECONDITION: engine applies the reduction once");
  const req = okReq(mapped);
  const ppf = req.services.filter((s) => s.category === "ppf");
  assert.equal(ppf.length, 3, "three part lines");
  assert.deepEqual(reductionCarriers(req.services), [["manual:ppf:ppf_r1_partial_gg1_door-mirror", 5_000]],
    "exactly one persisted line carries the reduction — the first part line — never the coating line or another part");
  assert.equal(ppf[0]?.metadata.ppfCoatingAdjustmentRuleId, "r");
  assert.equal(ppf[0]?.metadata.ppfCoatingAdjustmentBase, "coating_layers_total");

  // The reduction is document-level: no part line's unit price / subtotal is reduced.
  assert.deepEqual(ppf.map((s) => [s.quantity, s.unitPrice, s.subtotal]), [[2, 41_666, 83_332], [2, 50_000, 100_000], [1, 62_500, 62_500]]);
  const withoutRule = okReq(runPartial(quantities).mapped);
  assert.equal(req.pricing.subtotal, withoutRule.pricing.subtotal, "line subtotal is identical with or without the rule");
  assert.equal(req.pricing.discountTotal, 5_000, "single document-level reduction");
  assert.equal(req.pricing.taxableSubtotal, req.pricing.subtotal, "post-tax discount: the tax base is not reduced");
  assert.equal(req.pricing.taxTotal, withoutRule.pricing.taxTotal);
  assert.equal(req.pricing.grandTotal, yen(req.pricing.subtotal, "subtotal") + yen(req.pricing.taxTotal, "taxTotal") - 5_000);
  assert.equal(req.pricing.grandTotal, yen(withoutRule.pricing.grandTotal, "grandTotal without rule") - 5_000, "the rule changes the document total by exactly one reduction");
  assert.equal(validateEstimateSaveRequest(req).ok, true);

  // A later quantity edit (Step 4 and review) re-prices lines but never adds a second reduction.
  const edited = runPartial(
    { bonnet: 3, "door-mirror": 2 },
    { quantityInputsByLine: { "manual:ppf:ppf_r1_partial_gg1_front-bumper": "2" } },
    PARTIAL_PC_WITH_REDUCTION,
  );
  const editedReq = okReq(edited.mapped);
  assert.deepEqual(editedReq.services.filter((s) => s.category === "ppf").map((s) => [s.quantity, s.subtotal]), [[2, 83_332], [3, 150_000], [2, 125_000]]);
  assert.deepEqual(reductionCarriers(editedReq.services), [["manual:ppf:ppf_r1_partial_gg1_door-mirror", 5_000]], "still exactly one carrier");
  assert.equal(editedReq.pricing.discountTotal, 5_000, "still exactly one reduction");
  assert.equal(editedReq.pricing.grandTotal, yen(editedReq.pricing.subtotal, "edited subtotal") + yen(editedReq.pricing.taxTotal, "edited taxTotal") - 5_000);
  assert.equal(validateEstimateSaveRequest(editedReq).ok, true);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c3) — dedicated wheel / glass save identity (plan §24.1) ────
//
// Wheel and glass are INDEPENDENT Screen-3 categories priced from dealer-authored dedicated menus:
// one manual line per selected menu, operator tax-exclusive unit price × bounded positive-integer
// quantity. The mapper must carry the stable `(category, menu code)` identity, the chosen quantity,
// the unit price and the ENGINE's line total; the RPC payload must persist the category itself —
// `wheel` / `glass` — never `other`. Nothing below hard-codes a coupon or discount figure the engine
// owns: those are asserted as COPIED from the pricing result and internally consistent.

const PERCENT_COUPON_ID = "00000000-0000-4000-8000-000000000200";
const DEDICATED_PC: ConfiguredPricingConfiguration = {
  ...COUPON_PC,
  coupons: [
    ...(COUPON_PC.coupons ?? []),
    {
      couponId: PERCENT_COUPON_ID,
      code: "uat-10-percent",
      label: "本番UAT 10%引き",
      value: { kind: "percent", basisPoints: 1_000 },
      combinable: true,
      validFrom: null,
      validTo: null,
      isActive: true,
      displayOrder: 2,
    },
  ],
  wheelMenus: [
    { code: "wh-coat",  label: "ホイールコーティング", minQuantity: 1, maxQuantity: null, unitPriceConfigured: true },
    { code: "wh-clean", label: "ホイールクリーニング", minQuantity: 1, maxQuantity: 4,    unitPriceConfigured: true },
  ],
  glassMenus: [
    // NO configured unit price: the operator's Step-4 text is the ONLY priced amount for this menu.
    { code: "gl-repel", label: "ガラス撥水", minQuantity: 1, maxQuantity: 2, unitPriceConfigured: false },
  ],
};
const WHEEL_COAT  = "manual:wheel:wh-coat";
const WHEEL_CLEAN = "manual:wheel:wh-clean";
const GLASS_REPEL = "manual:glass:gl-repel";

type DedicatedSections = Pick<WizardServiceConfigurationDraft, "wheel" | "glass">;
const canonicalSections: DedicatedSections = {
  wheel: { selectedMenuIds: ["wh-coat", "wh-clean"], unitPricesByMenu: { "wh-coat": "5000", "wh-clean": "1500" }, quantitiesByMenu: { "wh-coat": 4, "wh-clean": 2 } },
  glass: { selectedMenuIds: ["gl-repel"], unitPricesByMenu: { "gl-repel": "8000" }, quantitiesByMenu: { "gl-repel": 1 } },
};
const dedicatedDraft = (
  sections: DedicatedSections,
  dc: Partial<WizardDiscountDraft> = {},
  review: Partial<EstimateWizardDraftV22["review"]> = {},
): EstimateWizardDraftV22 => {
  const d = draftWith(["wheel", "glass"], sections, dc);
  return { ...d, review: { ...d.review, ...review } };
};
const runDedicated = (draft: EstimateWizardDraftV22) => {
  const pricingResult = computeWizardPricingFromConfig(draft, DEDICATED_PC, CATALOG, RANK);
  return { pricingResult, mapped: run(draft, { pricingResult, pricingConfig: DEDICATED_PC }) };
};
const lineTuple = (s: { lineId: string; quantity: number; unitPrice: number; subtotal: number }) =>
  [s.lineId, s.quantity, s.unitPrice, s.subtotal] as const;

test("B5c3: canonical wheel/glass menus persist one line per menu with stable identity, quantity, unit price and line total; RPC category is wheel/glass, never other", () => {
  const { pricingResult, mapped } = runDedicated(dedicatedDraft(canonicalSections));
  assert.equal(pricingResult.completeness, "complete", `PRECONDITION: ${JSON.stringify(pricingResult.errors)}`);
  const req = okReq(mapped);
  assert.deepEqual(req.services.map((s) => [s.lineId, s.category, s.manualPricingIdentity, s.label, s.quantity, s.unitPrice, s.subtotal]), [
    [WHEEL_COAT,  "wheel", "wh-coat",  "ホイールコーティング", 4, 5_000, 20_000],
    [WHEEL_CLEAN, "wheel", "wh-clean", "ホイールクリーニング", 2, 1_500, 3_000],
    [GLASS_REPEL, "glass", "gl-repel", "ガラス撥水",           1, 8_000, 8_000],
  ]);
  for (const s of req.services) {
    assert.equal(s.pricingSource, "manual");
    assert.equal(s.pricingReferenceId, null);
    assert.equal(s.subtotal, s.unitPrice * s.quantity, "line total = tax-exclusive unit price × quantity");
    assert.equal(s.metadata.menuKind, `${s.category}_menu`, "menu kind travels with the line");
    assert.equal(s.metadata.quantityRequired, true);
  }
  assert.equal(req.services.find((s) => s.lineId === GLASS_REPEL)?.metadata.unitPriceConfigured, false, "operator-priced glass keeps its provenance flag");
  assert.equal(new Set(req.services.map((s) => s.lineId)).size, 3, "all line ids distinct");
  assert.equal(req.pricing.subtotal, 31_000);
  assert.equal(req.pricing.taxTotal, 3_100);
  assert.equal(req.pricing.grandTotal, 34_100);
  assert.equal(validateEstimateSaveRequest(req).ok, true);

  // The RPC payload persists the category ITSELF. Before B5c3 neither key existed in CATEGORY_MAP,
  // so both fell through `?? "other"` — the silent re-classification the contract forbids.
  const payload = buildEstimateSaveRpcPayload(req, { idempotencyKey: "b5c3-dedicated-canonical" });
  assert.deepEqual(payload.services.map((s) => [s.lineId, s.category, s.wizardCategory, s.quantity, s.unitPrice, s.lineTotal]), [
    [WHEEL_COAT,  "wheel", "wheel", 4, 5_000, 20_000],
    [WHEEL_CLEAN, "wheel", "wheel", 2, 1_500, 3_000],
    [GLASS_REPEL, "glass", "glass", 1, 8_000, 8_000],
  ]);
  assert.equal(payload.services.some((s) => s.category === "other"), false, "wheel/glass never silently map to other");
  // Existing categories are untouched by the map extension.
  const maint = buildEstimateSaveRpcPayload(okReq(run(draftWith(["maintenance"], maintCfg))), { idempotencyKey: "b5c3-maint" });
  assert.deepEqual(maint.services.map((s) => [s.category, s.wizardCategory]), [["maintenance", "maintenance"]]);
});

// The B5c2 diagnostic combination, made VALID under the existing contract: every selected dedicated
// menu carries its Step-4 unit-price text (the glass one operator-typed, since none is configured),
// then final review edits a wheel quantity within bounds AND the glass unit price at the same time,
// on top of an authored amount discount, an amount coupon and a percent coupon.
test("B5c3: amount discount + amount coupon + percent coupon + simultaneous review quantity / unit-price edits map successfully with engine figures copied verbatim", () => {
  const draft = dedicatedDraft(
    canonicalSections,
    { mode: "amount", amountInput: "1000", selectedCouponIds: [COUPON_ID, PERCENT_COUPON_ID] },
    { quantityInputsByLine: { [WHEEL_COAT]: "3" }, unitPriceInputsByLine: { [GLASS_REPEL]: "9000" } },
  );
  const { pricingResult: pr, mapped } = runDedicated(draft);
  assert.equal(pr.completeness, "complete", `PRECONDITION: ${JSON.stringify(pr.errors)}`);
  const req = okReq(mapped);
  assert.deepEqual(req.services.map(lineTuple), [
    [WHEEL_COAT,  3, 5_000, 15_000], // review quantity edit, within configured bounds
    [WHEEL_CLEAN, 2, 1_500, 3_000],
    [GLASS_REPEL, 1, 9_000, 9_000],  // review unit-price edit on the operator-priced glass line
  ]);
  assert.equal(req.pricing.subtotal, 27_000);
  assert.equal(req.pricing.taxableSubtotal, 27_000, "post-tax document discount: the tax base is the subtotal");
  assert.equal(req.pricing.taxTotal, 2_700);
  // Engine-owned figures are COPIED, never recomputed by the mapper — and they must be coherent.
  assert.equal(req.pricing.couponTotal, pr.couponTotal);
  assert.equal(req.pricing.discountTotal, pr.discountTotal);
  assert.equal(req.pricing.grandTotal, pr.grandTotal);
  assert.equal(req.coupon.status, "applied");
  assert.deepEqual(req.coupon.selectedCouponIds, [COUPON_ID, PERCENT_COUPON_ID]);
  assert.deepEqual((req.coupon.applications ?? []).map((a) => [a.couponId, a.discountType, a.discountValue]), [
    [COUPON_ID, "amount", 100],
    [PERCENT_COUPON_ID, "percent", 1_000],
  ]);
  assert.equal((req.coupon.applications ?? []).reduce((s, a) => s + a.appliedAmount, 0), req.pricing.couponTotal, "per-coupon snapshot sums to couponTotal");
  assert.equal(req.coupon.appliedAmount, req.pricing.couponTotal);
  assert.equal(req.discount.intent.mode, "fixed_amount");
  assert.equal(req.discount.intent.fixedAmount, 1_000, "the authored figure is intent, never conflated with the applied amount");
  assert.equal(req.discount.appliedAmount, pr.discountTotal);
  assert.equal(yen(req.pricing.discountTotal, "discountTotal"), 1_000 + yen(req.pricing.couponTotal, "couponTotal"), "applied document discount = authored amount + coupons, counted once");
  assert.equal(req.pricing.grandTotal, 27_000 + 2_700 - yen(req.pricing.discountTotal, "discountTotal"), "one discount/tax engine: subtracted exactly once, after tax");
  assert.equal(validateEstimateSaveRequest(req).ok, true);

  // Identity edits (review values equal to Step 4) persist byte-identically to the canonical draft.
  const canonical = okReq(runDedicated(dedicatedDraft(canonicalSections, { mode: "amount", amountInput: "1000", selectedCouponIds: [COUPON_ID, PERCENT_COUPON_ID] })).mapped);
  const identity = okReq(runDedicated(dedicatedDraft(
    canonicalSections,
    { mode: "amount", amountInput: "1000", selectedCouponIds: [COUPON_ID, PERCENT_COUPON_ID] },
    { quantityInputsByLine: { [WHEEL_COAT]: "4" }, unitPriceInputsByLine: { [GLASS_REPEL]: "8000" } },
  )).mapped);
  assert.deepEqual(identity.services, canonical.services);
  assert.deepEqual(identity.pricing, canonical.pricing);
  assert.deepEqual(identity.coupon, canonical.coupon);
});

// THE B5c2 REJECTION, REPRODUCED. That fixture supplied the operator-priced glass menu
// (`unitPriceConfigured: false`) with NO Step-4 unit-price text and relied on the final-review
// unit-price edit instead. Under the existing contract the Step-4 text is the ONLY canonical price
// for a dedicated menu; the authoritative bundle raises MANUAL_PRICE_REQUIRED, and the mapper checks
// `bundle.errors` BEFORE anything else (R50A-F1 A), so the result is `pricing-error` — a correct
// fail-closed refusal, not a mapper defect. A review override is never a substitute canonical price.
test("B5c3 (B5c2 reproduction): an operator-priced glass menu with an EMPTY Step-4 unit price fails closed as pricing-error even when final review supplies a price", () => {
  const dc: Partial<WizardDiscountDraft> = { mode: "amount", amountInput: "1000", selectedCouponIds: [COUPON_ID, PERCENT_COUPON_ID] };
  const review = { quantityInputsByLine: { [WHEEL_COAT]: "3" }, unitPriceInputsByLine: { [GLASS_REPEL]: "9000" } };
  const unpricedGlass: DedicatedSections = {
    ...canonicalSections,
    glass: { selectedMenuIds: ["gl-repel"], unitPricesByMenu: {}, quantitiesByMenu: { "gl-repel": 1 } },
  };
  const draft = dedicatedDraft(unpricedGlass, dc, review);
  const { pricingResult: pr, mapped } = runDedicated(draft);
  assert.ok(
    pr.errors.some((e) => e.code === "MANUAL_PRICE_REQUIRED" && e.category === "glass" && e.sourceId === "gl-repel"),
    `the authoritative route names the exact unpriced menu: ${JSON.stringify(pr.errors)}`,
  );
  assert.equal(pr.lines.some((l) => l.category === "glass"), false, "no glass line is ever invented from the review override");
  expectFail(mapped, "pricing-error");
  // A forged complete/success result cannot hide the authoritative bundle error either.
  const decoy = runDedicated(dedicatedDraft(canonicalSections, dc, review)).pricingResult;
  assert.equal(decoy.completeness, "complete", "PRECONDITION: the decoy is a genuine complete result");
  expectFail(run(draft, { pricingResult: decoy, pricingConfig: DEDICATED_PC }), "pricing-error");
  // The SAME combination with the glass price typed in Step 4 is the positive case above.
  assert.equal(runDedicated(dedicatedDraft(canonicalSections, dc, review)).mapped.ok, true);
});

test("B5c3: dedicated-menu review quantity edits honour configured bounds; out-of-bounds, zero and non-integer fail closed", () => {
  const withQty = (lineId: string, q: string) =>
    runDedicated(dedicatedDraft(canonicalSections, {}, { quantityInputsByLine: { [lineId]: q } })).mapped;
  expectFail(withQty(GLASS_REPEL, "3"), "pricing-error");   // max 2
  expectFail(withQty(WHEEL_CLEAN, "5"), "pricing-error");   // max 4
  expectFail(withQty(WHEEL_COAT, "0"), "pricing-error");    // never zero
  expectFail(withQty(WHEEL_COAT, "1.5"), "pricing-error");  // positive INTEGER only
  const ok = okReq(withQty(GLASS_REPEL, "2"));
  assert.deepEqual(ok.services.filter((s) => s.lineId === GLASS_REPEL).map(lineTuple), [[GLASS_REPEL, 2, 8_000, 16_000]]);
  assert.equal(ok.pricing.subtotal, 39_000);
  // A stale / foreign dedicated menu id in the draft is unknown-configured-item, never a line.
  expectFail(runDedicated(dedicatedDraft({
    ...canonicalSections,
    wheel: { selectedMenuIds: ["wh-gone"], unitPricesByMenu: { "wh-gone": "5000" }, quantitiesByMenu: { "wh-gone": 4 } },
  })).mapped, "unknown-configured-item");
});

// ── GDA-OTHER-COATINGS-R1 (C1) — other_coating category / persisted-category parity ──────────────
//
// C1 established the CATEGORY contract; C4 then added the real pricing path (dealer-authored
// `otherCoatingMenus`). What must hold is exact identity parity across the layers a line crosses —
// the category id is canonical, its policy maps are total, and the RPC payload persists
// `other_coating` ITSELF (never `other`, never body `coating`). The hand-assembled line below pins
// the payload builder (pure and total) independently of the engine; the last two tests pin the
// CURRENT engine behaviour: missing configuration fails closed and blocks save, a positive
// configured path prices and persists, and a ¥0 price never becomes a saveable line.

test("C1: other_coating is canonical and its pricing/manual policy parity is explicit (manual_only / required)", () => {
  assert.equal(isServiceCategoryId("other_coating"), true);
  assert.equal(WIZARD_CATEGORY_PRICING_POLICY.other_coating, "manual_only", "never the catalog body-coating policy");
  assert.equal(WIZARD_CATEGORY_MANUAL_POLICY.other_coating, "required", "no unpriced other-coating line may ever exist");
  assert.equal(WIZARD_CATEGORY_PRICING_POLICY.coating, "catalog_only", "body coating policy unchanged");
  assert.equal(WIZARD_CATEGORY_PRICING_POLICY.wheel, "manual_only");
  assert.equal(WIZARD_CATEGORY_PRICING_POLICY.glass, "manual_only");
  assert.equal(WIZARD_CATEGORY_PRICING_POLICY.other, "manual_only");
});

test("C1: the RPC payload persists other_coating as its OWN category — never other, never coating; existing categories untouched", () => {
  const base = okReq(run(draftWith(["maintenance"], maintCfg)));
  const src = base.services.find((s) => s.pricingSource === "manual");
  assert.ok(src, "a manual source line exists to derive from");
  if (!src) return;
  const line = {
    ...src,
    lineId: "manual:other_coating:oc-trim",
    category: "other_coating",
    manualPricingIdentity: "oc-trim",
    label: "樹脂トリムコーティング",
    quantity: 1,
    unitPrice: 15_000,
    subtotal: 15_000,
    metadata: { ...src.metadata },
  };
  const req = { ...base, services: [...base.services, line] };
  const payload = buildEstimateSaveRpcPayload(req, { idempotencyKey: "c1-other-coating-parity" });
  const oc = payload.services.find((s) => s.lineId === "manual:other_coating:oc-trim");
  assert.ok(oc, "the other_coating line is carried");
  if (!oc) return;
  assert.equal(oc.category, "other_coating", "persisted category is other_coating itself");
  assert.equal(oc.wizardCategory, "other_coating");
  assert.equal(oc.pricingPolicy, "manual_only");
  assert.equal(oc.manualPricePolicy, "required");
  assert.deepEqual([oc.quantity, oc.unitPrice, oc.lineTotal], [1, 15_000, 15_000], "amounts passthrough");
  assert.equal(payload.services.some((s) => s.wizardCategory === "other_coating" && s.category === "other"), false, "never silently re-classified as other");
  assert.equal(payload.services.some((s) => s.wizardCategory === "other_coating" && s.category === "coating"), false, "never merged into body coating");
  // The pre-existing maintenance line is byte-identical to a payload built without the extra line.
  const alone = buildEstimateSaveRpcPayload(base, { idempotencyKey: "c1-other-coating-parity" });
  assert.deepEqual(payload.services.filter((s) => s.wizardCategory === "maintenance"), alone.services);
});

const OC_TRIM_DRAFT = () => draftWith(["maintenance", "other_coating"], {
  ...maintCfg,
  otherCoating: { selectedMenuIds: ["oc-trim"], unitPricesByMenu: { "oc-trim": "15000" }, quantitiesByMenu: { "oc-trim": 1 } },
});
const OC_TRIM_PC: ConfiguredPricingConfiguration = {
  ...PC,
  otherCoatingMenus: [{ code: "oc-trim", label: "樹脂トリムコーティング", quantityRequired: false, minQuantity: null, maxQuantity: null, unitPriceConfigured: true }],
};

test("C1→C4: selecting other_coating with NO other-coating configuration fails CLOSED — DEDICATED_MENU_CONFIG_REQUIRED, no other_coating line, save blocked; the existing category still prices", () => {
  const draft = OC_TRIM_DRAFT();
  // `PC` carries no `otherCoatingMenus` (absent) — and an EMPTY authored collection behaves the same.
  for (const [name, pc] of [["absent", PC], ["empty", { ...PC, otherCoatingMenus: [] }]] as const) {
    const pr = computeWizardPricingFromConfig(draft, pc, CATALOG, RANK);
    assert.notEqual(pr.completeness, "complete", name);
    assert.equal(pr.lines.some((l) => l.category === "other_coating"), false, `${name}: no other_coating line is invented`);
    assert.ok(pr.errors.some((e) => e.code === "DEDICATED_MENU_CONFIG_REQUIRED" && e.category === "other_coating"), `${name}: fail-closed config error`);
    assert.equal(pr.lines.some((l) => l.category === "maintenance"), true, `${name}: the existing category still prices`);
    expectFail(run(draft, { pricingConfig: pc }), "pricing-error");
  }
});

test("C4: a POSITIVE configured other_coating path prices one fixed-one line and persists it as other_coating; a ¥0 price is never a saveable line", () => {
  const pr = computeWizardPricingFromConfig(OC_TRIM_DRAFT(), OC_TRIM_PC, CATALOG, RANK);
  assert.equal(pr.completeness, "complete");
  const line = pr.lines.find((l) => l.category === "other_coating");
  assert.ok(line, "the configured path produces an other_coating line");
  if (!line) return;
  assert.deepEqual([line.kind, line.label, line.quantity, line.unitPrice, line.lineTotal], ["manual", "樹脂トリムコーティング", 1, 15_000, 15_000]);
  const req = okReq(run(OC_TRIM_DRAFT(), { pricingConfig: OC_TRIM_PC, pricingResult: pr }));
  const saved = req.services.find((s) => s.lineId === "manual:other_coating:oc-trim");
  assert.ok(saved, "mapped with the stable other_coating identity");
  if (!saved) return;
  assert.equal(saved.category, "other_coating");
  const payload = buildEstimateSaveRpcPayload(req, { idempotencyKey: "c4-other-coating-positive" });
  const oc = payload.services.find((s) => s.lineId === "manual:other_coating:oc-trim");
  assert.ok(oc);
  if (!oc) return;
  assert.deepEqual([oc.category, oc.wizardCategory, oc.pricingPolicy, oc.manualPricePolicy], ["other_coating", "other_coating", "manual_only", "required"]);
  assert.deepEqual([oc.quantity, oc.unitPrice, oc.lineTotal], [1, 15_000, 15_000]);
  // The save blocker is not weakened: ¥0 (and a blank) never reaches a line, and the mapper refuses.
  for (const price of ["0", ""]) {
    const zero = draftWith(["maintenance", "other_coating"], {
      ...maintCfg,
      otherCoating: { selectedMenuIds: ["oc-trim"], unitPricesByMenu: { "oc-trim": price }, quantitiesByMenu: { "oc-trim": 1 } },
    });
    const zpr = computeWizardPricingFromConfig(zero, OC_TRIM_PC, CATALOG, RANK);
    assert.equal(zpr.lines.some((l) => l.category === "other_coating"), false, `price ${JSON.stringify(price)}: no line`);
    expectFail(run(zero, { pricingConfig: OC_TRIM_PC }), "pricing-error");
  }
});
