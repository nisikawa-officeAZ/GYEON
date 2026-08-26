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
import { computeWizardPricingFromConfig } from "../pricing/compute-wizard-pricing-from-config";
import { DEFAULT_PRICING_CATALOG, makePricingCatalog, type PricingCatalog } from "@/lib/pricing/canonical-pricing-engine";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft, WizardDiscountDraft } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { ConfiguredPricingConfiguration } from "../pricing/wizard-pricing-input-adapter-config";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";

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
  ],
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
  const pricingResult = over.pricingResult ?? computeWizardPricingFromConfig(draft, PC, CATALOG, RANK);
  return mapWizardDraftToSaveRequestFromConfig({ draft, pricingResult, pricingConfig: PC, catalog: CATALOG, shopRank: RANK, ...over });
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
