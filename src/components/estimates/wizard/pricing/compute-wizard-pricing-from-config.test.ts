// EW-UI-5A1-B1 — Server-safe pricing core + stable catalog line-identity tests.
//
// Proves: raw pricing-engine coating lines carry the correct base/topcoat2/topcoat3 catalog ids; the
// mapped Wizard catalog lines carry the SAME ids; all three are distinct; a display-label change does
// not change identity; manual lines have null pricingReferenceId; no label/index/order fallback; the
// pure core has no client boundary; the hook delegates to the core; totals + fail-closed behavior are
// unchanged.
//
// Run: node --import tsx --test src/components/estimates/wizard/pricing/compute-wizard-pricing-from-config.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { computeWizardPricingFromConfig } from "./compute-wizard-pricing-from-config";
import {
  calculateEstimate, DEFAULT_PRICING_CATALOG, makePricingCatalog,
  type ServiceInput, type DiscountInput,
} from "@/lib/pricing/canonical-pricing-engine";
import { mapProductionResultToWizard } from "./wizard-pricing-result-adapter";
import { buildWizardPricingInputFromConfig, type ConfigPricingInputBundle, type ConfiguredPricingConfiguration } from "./wizard-pricing-input-adapter-config";
import { reviewQuantityPolicyForLine } from "./wizard-review-line-adjustments";
import { wizardPricingLineId } from "./wizard-line-order";
import type { WizardPricingLineResult } from "./wizard-pricing-types";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";

const RANK: ShopRank = "detailer";
const NO_DISCOUNT: DiscountInput = { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 };

// A 3-layer coating input using distinct authoritative catalog ids (all present in DEFAULT topcoatBase).
const COATING: ServiceInput = {
  type: "coating", coatingId: "one-evo", sizeKey: "M",
  topcoat2: "cancoat-evo", topcoat3: "cancoat-evo-pro", optionIds: [],
};

function bundleFor(services: ServiceInput[], manualLines: ConfigPricingInputBundle["manualLines"] = []): ConfigPricingInputBundle {
  return {
    services, manualLines, catalogResolved: services.some((s) => s.type === "coating"),
    discounts: NO_DISCOUNT, taxRate: 10, warnings: [], errors: [],
    couponState: { status: "none" }, discountIntent: { mode: "none" }, hasSelection: true,
    // B1.1 additions to ConfigPricingInputBundle. Empty/zero defaults keep this fixture at its
    // existing meaning: no coupons resolved, no discount base needed, no PPF coefficient or
    // PPF/coating reduction — i.e. exactly the pricing these tests already asserted.
    couponApplications: [], discountBaseSubtotal: 0,
    ppfCoefficientBpByIdentity: {}, ppfAdjustmentsByIdentity: {},
  };
}

// ── raw engine: coating lines carry base/topcoat2/topcoat3 catalog ids ────────────

test("raw pricing-engine coating lines carry the correct base/topcoat2/topcoat3 ids AND roles", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const lines = result.services[0].lineItems;
  assert.equal(lines.length, 3, "base + 2 topcoats");
  assert.deepEqual(lines.map((l) => l.pricing_reference_id), ["one-evo", "cancoat-evo", "cancoat-evo-pro"]);
  assert.deepEqual(lines.map((l) => l.catalog_line_role), ["base", "topcoat2", "topcoat3"]);
  // never derived from the visible label
  for (const l of lines) assert.notEqual(l.pricing_reference_id, l.item_name, "id is not the label");
});

test("a coating OPTION line carries role \"option\" and its authoritative option id", () => {
  const withOption: ServiceInput = { type: "coating", coatingId: "one-evo", sizeKey: "M", optionIds: ["polish"] };
  const lines = calculateEstimate([withOption], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG).services[0].lineItems;
  const opt = lines.find((l) => l.catalog_line_role === "option");
  assert.ok(opt, "option line present");
  assert.equal(opt!.pricing_reference_id, "polish", "option id is the authoritative catalog option id");
});

test("the three layer ids are distinct", () => {
  const lines = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG).services[0].lineItems;
  const ids = lines.map((l) => l.pricing_reference_id);
  assert.equal(new Set(ids).size, 3, "all three ids distinct");
});

// ── mapped Wizard catalog lines carry the same ids ────────────────────────────────

test("mapped catalog lines carry the same pricingReferenceId AND role as the engine lines", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const mapped = mapProductionResultToWizard(result, bundleFor([COATING]));
  const cat = mapped.lines.filter((l) => l.kind === "catalog");
  assert.deepEqual(cat.map((l) => l.pricingReferenceId), ["one-evo", "cancoat-evo", "cancoat-evo-pro"]);
  assert.deepEqual(cat.map((l) => (l.kind === "catalog" ? l.catalogLineRole : null)), ["base", "topcoat2", "topcoat3"]);
  // never the label / sourceId
  for (const l of cat) {
    assert.notEqual(l.pricingReferenceId, l.label, "id is not the label");
    assert.notEqual(l.pricingReferenceId, l.sourceId, "id is not the sourceId");
  }
});

// ── repeated product references remain uniquely identifiable via role:id ───────────

test("repeated products keep a unique `role:pricingReferenceId` even when the product id repeats", () => {
  // catalog keys directly (base uses coatingId; topcoats use topcoat catalog keys).
  const cases: Array<{ name: string; input: ServiceInput; expected: Array<[string, string]> }> = [
    { name: "ONE + ONE", input: { type: "coating", coatingId: "one-evo", sizeKey: "M", topcoat2: "one-evo" },
      expected: [["base", "one-evo"], ["topcoat2", "one-evo"]] },
    { name: "ONE + CANCOAT + CANCOAT", input: { type: "coating", coatingId: "one-evo", sizeKey: "M", topcoat2: "cancoat-evo", topcoat3: "cancoat-evo" },
      expected: [["base", "one-evo"], ["topcoat2", "cancoat-evo"], ["topcoat3", "cancoat-evo"]] },
    { name: "MATTE + MATTE", input: { type: "coating", coatingId: "matte-evo", sizeKey: "M", topcoat2: "matte-evo" },
      expected: [["base", "matte-evo"], ["topcoat2", "matte-evo"]] },
  ];
  for (const { name, input, expected } of cases) {
    const mapped = mapProductionResultToWizard(calculateEstimate([input], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG), bundleFor([input]));
    const cat = mapped.lines.filter((l) => l.kind === "catalog");
    assert.deepEqual(cat.map((l) => [l.kind === "catalog" ? l.catalogLineRole : null, l.pricingReferenceId]), expected, `${name}: roles+ids`);
    // Product ids DO repeat where the product repeats…
    const ids = cat.map((l) => l.pricingReferenceId);
    assert.ok(new Set(ids).size < ids.length, `${name}: product ids repeat`);
    // …but `role:id` is always unique — no label/index/order participates.
    const keys = cat.map((l) => `${l.kind === "catalog" ? l.catalogLineRole : ""}:${l.pricingReferenceId}`);
    assert.equal(new Set(keys).size, keys.length, `${name}: role:id unique`);
  }
});

// ── label change does not change identity ─────────────────────────────────────────

test("changing a display label changes neither pricingReferenceId nor catalogLineRole", () => {
  const renamed = makePricingCatalog({
    coatings: DEFAULT_PRICING_CATALOG.coatings.map((c) => (c.id === "one-evo" ? { ...c, name: "RENAMED-LABEL" } : c)),
  });
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, renamed);
  const base = result.services[0].lineItems[0];
  assert.equal(base.item_name, "RENAMED-LABEL", "label changed");
  assert.equal(base.pricing_reference_id, "one-evo", "id unchanged");
  assert.equal(base.catalog_line_role, "base", "role unchanged");
  const mapped = mapProductionResultToWizard(result, bundleFor([COATING]));
  const mBase = mapped.lines.find((l) => l.kind === "catalog");
  assert.equal(mBase?.label, "RENAMED-LABEL");
  assert.equal(mBase?.pricingReferenceId, "one-evo");
  assert.equal(mBase?.kind === "catalog" ? mBase.catalogLineRole : null, "base");
});

// ── fail-closed: a catalog line missing EITHER identity component → WHOLE-RESULT error ──

test("a null / empty / whitespace catalog id fails the WHOLE result closed (never a null-id catalog line)", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const svc = result.services[0];
  for (const badId of [null, "", "   "]) {
    const tampered = {
      ...result,
      services: [{ ...svc, lineItems: svc.lineItems.map((it, i) => (i === 0 ? { ...it, pricing_reference_id: badId } : it)) }],
    };
    const mapped = mapProductionResultToWizard(tampered, bundleFor([COATING]));
    assert.equal(mapped.status, "error", `${JSON.stringify(badId)}: status error`);
    assert.equal(mapped.completeness, "error", `${JSON.stringify(badId)}: completeness error`);
    assert.equal(mapped.lines.length, 0, `${JSON.stringify(badId)}: no lines emitted`);
    assert.equal(mapped.subtotal, null);
    assert.equal(mapped.discountTotal, null);
    assert.equal(mapped.taxableSubtotal, null);
    assert.equal(mapped.taxTotal, null);
    assert.equal(mapped.grandTotal, null);
    assert.equal(mapped.couponTotal, 0);
    assert.ok(mapped.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"), `${JSON.stringify(badId)}: error present`);
    assert.ok(mapped.unresolvedItems.some((u) => u.code === "UNKNOWN_PRICING_REFERENCE"), `${JSON.stringify(badId)}: unresolved present`);
    // The type makes a null-id catalog line unconstructable; assert none exists at runtime either.
    assert.equal(mapped.lines.some((l) => l.kind === "catalog"), false, `${JSON.stringify(badId)}: no catalog line returned`);
  }
});

test("a missing catalog_line_role fails the WHOLE result closed", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const svc = result.services[0];
  const tampered = {
    ...result,
    services: [{ ...svc, lineItems: svc.lineItems.map((it, i) => (i === 0 ? { ...it, catalog_line_role: null } : it)) }],
  };
  const mapped = mapProductionResultToWizard(tampered, bundleFor([COATING]));
  assert.equal(mapped.status, "error");
  assert.equal(mapped.completeness, "error");
  assert.equal(mapped.lines.length, 0);
  assert.equal(mapped.subtotal, null);
  assert.equal(mapped.grandTotal, null);
  assert.ok(mapped.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"), "missing role surfaced");
  assert.ok(mapped.unresolvedItems.some((u) => u.code === "UNKNOWN_PRICING_REFERENCE"));
});

// ── manual lines have null identity (via the full config route) ───────────────────

const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [{ code: "mm1", label: "6ヶ月メンテナンス" }],
  washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};
function draftWith(categories: ServiceCategoryId[], cfg: Partial<WizardServiceConfigurationDraft> = {}): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  return { ...d, serviceSelection: { ...d.serviceSelection, selectedCategories: categories }, serviceConfiguration: { ...d.serviceConfiguration, ...cfg } };
}

test("manual Wizard lines have pricingReferenceId === null and catalogLineRole === null", () => {
  const draft = draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } });
  const r = computeWizardPricingFromConfig(draft, PC, makePricingCatalog(), RANK);
  const manual = r.lines.filter((l) => l.kind === "manual");
  assert.ok(manual.length > 0, "a manual maintenance line exists");
  for (const l of manual) {
    assert.equal(l.pricingReferenceId, null, "manual line has null identity");
    assert.equal(l.kind === "manual" ? l.catalogLineRole : "x", null, "manual line has null role");
  }
});

// ── totals + fail-closed behavior unchanged ───────────────────────────────────────

test("totals and fail-closed behavior are unchanged after extraction", () => {
  // complete → numeric totals
  const priced = computeWizardPricingFromConfig(
    draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } }),
    PC, makePricingCatalog(), RANK,
  );
  assert.equal(priced.completeness, "complete");
  assert.ok(typeof priced.grandTotal === "number" && priced.grandTotal > 0, "priced total numeric");
  // no selection → unavailable with null aggregates (fail-closed, never ¥0)
  const empty = computeWizardPricingFromConfig(draftWith([]), PC, makePricingCatalog(), RANK);
  assert.equal(empty.completeness, "unavailable");
  assert.equal(empty.subtotal, null);
  assert.equal(empty.grandTotal, null);
});

// ── core is server-safe; hook delegates to it ─────────────────────────────────────

const codeOf = (p: string): string => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CORE_SRC = "src/components/estimates/wizard/pricing/compute-wizard-pricing-from-config.ts";
const HOOK_SRC = "src/components/estimates/wizard/pricing/useWizardPricingFromConfig.ts";

test("the pure core crosses no client boundary and the hook delegates to it", () => {
  const core = codeOf(CORE_SRC);
  assert.equal(/use client/.test(core), false, "core has no \"use client\"");
  assert.equal(/from ["']react["']|useMemo|useState|useEffect|useRef/.test(core), false, "core imports no React/hook");
  assert.match(core, /export function computeWizardPricingFromConfig/, "core owns the pure compute");
  const hook = codeOf(HOOK_SRC);
  assert.match(hook, /^"use client";/, "hook declares the client boundary");
  assert.match(hook, /import \{ computeWizardPricingFromConfig \} from ["']\.\/compute-wizard-pricing-from-config["']/, "hook imports the core");
  assert.match(hook, /export \{ computeWizardPricingFromConfig \} from ["']\.\/compute-wizard-pricing-from-config["']/, "hook re-exports for compatibility");
  assert.match(hook, /useMemo\(/, "hook memoizes and delegates");
  // core function is genuinely importable + callable here (this file imported it, no client crash)
  assert.equal(typeof computeWizardPricingFromConfig, "function");
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — every line carries the canonical quantity policy ──

const PC_Q: ProductionPricingConfiguration = {
  ...PC,
  storeGlobalOptions: [
    { code: "go-q",   label: "数量オプション",     priceable: true, quantityRequired: true,  minQuantity: 1, maxQuantity: 5 },
    { code: "go-min", label: "最小数量オプション", priceable: true, quantityRequired: true,  minQuantity: 2, maxQuantity: null },
    { code: "go-1",   label: "単品オプション",     priceable: true, quantityRequired: false, minQuantity: 1, maxQuantity: null },
  ],
};

function quantityDraft(over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  d.vehicle.bodySizeKey = "M";
  d.serviceSelection.selectedCategories = ["coating", "maintenance"];
  d.serviceConfiguration.coating.layer1Id = "pure-evo";
  d.serviceConfiguration.bodyMaintenance = { menuId: "mm1", unitPriceInput: "5000" };
  const sgo = d.serviceConfiguration.storeGlobalOptions;
  sgo.selectedOptionIds.push("go-q", "go-min", "go-1");
  sgo.unitPricesByOption["go-q"] = "3000";
  sgo.unitPricesByOption["go-min"] = "1000";
  sgo.unitPricesByOption["go-1"] = "2500";
  sgo.quantitiesByOption["go-q"] = 2;
  sgo.quantitiesByOption["go-min"] = 3;
  over?.(d);
  return d;
}

const stripPolicy = (line: WizardPricingLineResult): WizardPricingLineResult => {
  const { quantityPolicy: _policy, ...rest } = line;
  void _policy;
  return rest as WizardPricingLineResult;
};
const policyOf = (r: { lines: readonly WizardPricingLineResult[] }, sourceId: string) =>
  r.lines.find((l) => l.sourceId === sourceId)?.quantityPolicy;

test("every computed line carries EXACTLY the policy reviewQuantityPolicyForLine resolves (null for fixed lines, bounds for quantity-required options)", () => {
  const d = quantityDraft();
  const catalog = makePricingCatalog();
  const r = computeWizardPricingFromConfig(d, PC_Q, catalog, RANK);
  assert.equal(r.completeness, "complete", "PRECONDITION: the draft prices cleanly");
  assert.ok(r.lines.length >= 5, "coating + maintenance + three options");
  const bundle = buildWizardPricingInputFromConfig(d, PC_Q, catalog, RANK);
  for (const line of r.lines) {
    assert.ok("quantityPolicy" in line, `${line.sourceId}: annotated`);
    assert.deepEqual(line.quantityPolicy, reviewQuantityPolicyForLine(line, bundle, PC_Q), `${line.sourceId}: same policy as the adjustment rule`);
  }
  // Concrete matrix: catalog coating → fixed; maintenance → fixed; non-quantity option → fixed;
  // quantity-required options → their configured bounds (maxQuantity null = unbounded above).
  assert.equal(r.lines.find((l) => l.kind === "catalog")?.quantityPolicy, null, "body coating is fixed");
  assert.equal(policyOf(r, "maintenance:mm1"), null, "maintenance is fixed");
  assert.equal(policyOf(r, "store_global_options:go-1"), null, "non-quantity option is fixed");
  assert.deepEqual(policyOf(r, "store_global_options:go-q"), { minQuantity: 1, maxQuantity: 5 });
  assert.deepEqual(policyOf(r, "store_global_options:go-min"), { minQuantity: 2, maxQuantity: null });
});

test("the annotation is display-only: money, quantities and every other line field equal the unannotated engine mapping", () => {
  const d = quantityDraft();
  const catalog = makePricingCatalog();
  const r = computeWizardPricingFromConfig(d, PC_Q, catalog, RANK);
  const bundle = buildWizardPricingInputFromConfig(d, PC_Q, catalog, RANK);
  const raw = mapProductionResultToWizard(calculateEstimate(bundle.services, bundle.discounts, bundle.taxRate, catalog), bundle);
  assert.deepEqual(r.lines.map(stripPolicy), raw.lines, "lines are byte-identical apart from the annotation");
  assert.deepEqual(
    { subtotal: r.subtotal, discountTotal: r.discountTotal, couponTotal: r.couponTotal, taxableSubtotal: r.taxableSubtotal, taxTotal: r.taxTotal, grandTotal: r.grandTotal },
    { subtotal: raw.subtotal, discountTotal: raw.discountTotal, couponTotal: raw.couponTotal, taxableSubtotal: raw.taxableSubtotal, taxTotal: raw.taxTotal, grandTotal: raw.grandTotal },
    "aggregate totals unchanged",
  );
});

test("the annotation survives accepted, identity and rejected review edits (the UI can always tell fixed from editable)", () => {
  const catalog = makePricingCatalog();
  const accepted = computeWizardPricingFromConfig(quantityDraft((d) => {
    d.review.quantityInputsByLine["manual:store_global_options:go-q"] = "3";   // in bounds → accepted
    d.review.quantityInputsByLine["catalog:coating:base:pure-evo"] = "1";      // identity on a fixed line
    d.review.unitPriceInputsByLine["manual:maintenance:mm1"] = "7000";         // unit price edit on a fixed line
  }), PC_Q, catalog, RANK);
  assert.equal(accepted.completeness, "complete");
  assert.equal(accepted.lines.find((l) => l.sourceId === "store_global_options:go-q")?.quantity, 3);
  assert.deepEqual(policyOf(accepted, "store_global_options:go-q"), { minQuantity: 1, maxQuantity: 5 });
  assert.equal(accepted.lines.find((l) => l.kind === "catalog")?.quantityPolicy, null);
  assert.equal(policyOf(accepted, "maintenance:mm1"), null);

  const rejected = computeWizardPricingFromConfig(quantityDraft((d) => {
    d.review.quantityInputsByLine["catalog:coating:base:pure-evo"] = "2";      // fixed line → fail closed
  }), PC_Q, catalog, RANK);
  assert.equal(rejected.status, "error");
  assert.equal(rejected.grandTotal, null);
  assert.ok(rejected.errors.some((e) => e.code === "INVALID_REVIEW_ADJUSTMENT"));
  assert.equal(rejected.lines.find((l) => l.kind === "catalog")?.quantityPolicy, null, "still marked fixed");
  assert.deepEqual(policyOf(rejected, "store_global_options:go-q"), { minQuantity: 1, maxQuantity: 5 }, "still marked editable");
});

test("fail-closed results are unchanged by the annotation: no selection → no lines, null totals; unpriced lines stay unpriced", () => {
  const empty = computeWizardPricingFromConfig(draftWith([]), PC_Q, makePricingCatalog(), RANK);
  assert.equal(empty.completeness, "unavailable");
  assert.deepEqual(empty.lines, []);
  assert.equal(empty.grandTotal, null);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — partial PPF part lines are annotated editable; full PPF stays fixed ──

const PPF_PC: ConfiguredPricingConfiguration = {
  ...PC_Q,
  ppfMethods: [{ code: "full", label: "外装フル施工" }, { code: "partial", label: "部分施工" }],
  ppfTypes: [{ code: "t1", label: "T1" }],
  ppfParts: [{ code: "bonnet", label: "ボンネット", minQuantity: 1, maxQuantity: 4 }, { code: "fender", label: "フェンダー", minQuantity: 2, maxQuantity: null }],
  installCoefficientBpByCode: { t1: 10_000 },
};
const PPF_CATALOG = makePricingCatalog({ ppfR1: {
  contractVersion: "1.0",
  frontFullPricesBySize: { SS: 1, S: 1, M: 100_000, ML: 1, L: 1, LL: 1, XL: 1 },
  fullBodyPricesBySize: { SS: 1, S: 1, M: 300_000, ML: 1, L: 1, LL: 1, XL: 1 },
  partialPartPrices: { bonnet: 40_000, fender: 20_000 },
} });

test("Stage B: every partial PPF PART line carries its configured bounds + ppfPartCode; full-body PPF and coating stay null", () => {
  const d = quantityDraft((sd) => {
    sd.serviceSelection.selectedCategories = ["coating", "ppf"];
    sd.serviceConfiguration.ppf = { ...sd.serviceConfiguration.ppf, installationMethod: "partial", fullCoverage: null, ppfTypeId: "t1", selectedPartIds: ["bonnet", "fender"], quantitiesByPart: { fender: 3 }, vehicleCoefficientInput: "1.0" };
  });
  const r = computeWizardPricingFromConfig(d, PPF_PC, PPF_CATALOG, RANK);
  assert.equal(r.completeness, "complete", "PRECONDITION");
  const bundle = buildWizardPricingInputFromConfig(d, PPF_PC, PPF_CATALOG, RANK);
  for (const line of r.lines) assert.deepEqual(line.quantityPolicy, reviewQuantityPolicyForLine(line, bundle, PPF_PC), line.sourceId);
  assert.deepEqual(policyOf(r, "ppf:ppf_r1_partial_t1_bonnet"), { minQuantity: 1, maxQuantity: 4, ppfPartCode: "bonnet" });
  assert.deepEqual(policyOf(r, "ppf:ppf_r1_partial_t1_fender"), { minQuantity: 2, maxQuantity: null, ppfPartCode: "fender" });
  assert.equal(r.lines.find((l) => l.sourceId === "ppf:ppf_r1_partial_t1_fender")?.quantity, 3);
  assert.equal(r.lines.find((l) => l.kind === "catalog")?.quantityPolicy, null, "body coating fixed");

  const full = computeWizardPricingFromConfig(quantityDraft((sd) => {
    sd.serviceSelection.selectedCategories = ["coating", "ppf"];
    sd.serviceConfiguration.ppf = { ...sd.serviceConfiguration.ppf, installationMethod: "full", fullCoverage: "full_body", ppfTypeId: "t1", vehicleCoefficientInput: "1.0" };
  }), PPF_PC, PPF_CATALOG, RANK);
  assert.equal(full.completeness, "complete");
  assert.equal(policyOf(full, "ppf:ppf_r1_full_body_t1"), null, "full-body PPF stays fixed");
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c1) — dedicated wheel / glass manual lines through the compute route ──

const DEDICATED_PC: ProductionPricingConfiguration = {
  ...PC,
  wheelMenus: [
    { code: "wheel-coat",   label: "ホイールコーティング", minQuantity: 1, maxQuantity: 4,    unitPriceConfigured: true },
    { code: "wheel-repair", label: "ホイールリペア",       minQuantity: 2, maxQuantity: null, unitPriceConfigured: false },
  ],
  glassMenus: [
    { code: "glass-coat", label: "ガラスコーティング", minQuantity: 1, maxQuantity: 6, unitPriceConfigured: true },
  ],
};
/** Step 4 (B5b2) initialises a newly selected wheel menu at quantity 4 and a glass menu at 1 (plan §24.1). */
const WHEEL_INITIAL_QUANTITY = 4;
const GLASS_INITIAL_QUANTITY = 1;

function dedicatedDraft(over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  d.vehicle.bodySizeKey = "M";
  d.serviceSelection.selectedCategories = ["coating", "wheel", "glass"];
  d.serviceConfiguration.coating.layer1Id = "pure-evo";
  d.serviceConfiguration.wheel = { selectedMenuIds: ["wheel-coat"], unitPricesByMenu: { "wheel-coat": "8000" },  quantitiesByMenu: { "wheel-coat": WHEEL_INITIAL_QUANTITY } };
  d.serviceConfiguration.glass = { selectedMenuIds: ["glass-coat"], unitPricesByMenu: { "glass-coat": "15000" }, quantitiesByMenu: { "glass-coat": GLASS_INITIAL_QUANTITY } };
  over?.(d);
  return d;
}
const lineOf = (r: { lines: readonly WizardPricingLineResult[] }, sourceId: string) => r.lines.find((l) => l.sourceId === sourceId);
const errorTriples = (r: { errors: readonly { code: string; category: string | null; sourceId: string | null }[] }) =>
  r.errors.map((e) => [e.code, e.category, e.sourceId]);
/** The coating-only reference run every financial delta below is measured against. */
const coatingOnly = () => computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceSelection.selectedCategories = ["coating"]; }), DEDICATED_PC, makePricingCatalog(), RANK);

test("B5c1: nominal quantities (wheel 4 / glass 1) become one manual line per menu with the EXACT wheel/glass category; body coating stays quantity 1", () => {
  const d = dedicatedDraft();
  const catalog = makePricingCatalog();
  const r = computeWizardPricingFromConfig(d, DEDICATED_PC, catalog, RANK);
  assert.equal(r.completeness, "complete");
  assert.deepEqual(r.errors, []);
  const wheel = lineOf(r, "wheel:wheel-coat");
  const glass = lineOf(r, "glass:glass-coat");
  assert.ok(wheel && glass, "one line per selected menu");
  assert.equal(wheel!.kind, "manual");
  assert.equal(wheel!.pricingReferenceId, null);
  assert.equal(wheel!.category, "wheel");
  assert.equal(wheel!.label, "ホイールコーティング", "authoritative label, never the raw code");
  assert.equal(wheel!.quantity, 4);
  assert.equal(glass!.kind, "manual");
  assert.equal(glass!.category, "glass");
  assert.equal(glass!.label, "ガラスコーティング");
  assert.equal(glass!.quantity, 1);
  assert.equal(r.lines.find((l) => l.kind === "catalog")?.quantity, 1, "body coating fixed at 1");
  assert.equal(r.lines.some((l) => l.category === "other" || l.category === "store_global_options"), false, "never Other / store option");
  // The adapter hands the engine unit × quantity per line and nothing else; totals are the engine's.
  const bundle = buildWizardPricingInputFromConfig(d, DEDICATED_PC, catalog, RANK);
  assert.deepEqual(
    bundle.manualLines.map((l) => [l.sourceCategory, l.manualPricingIdentity, l.quantity, l.unitPrice, l.metadata.menuKind, l.metadata.minQuantity, l.metadata.maxQuantity]),
    [["wheel", "wheel-coat", 4, 8000, "wheel_menu", 1, 4], ["glass", "glass-coat", 1, 15000, "glass_menu", 1, 6]],
  );
  assert.deepEqual(bundle.services.find((s) => s.type === "other"), { type: "other", items: [{ name: "ホイールコーティング", price: 32000 }, { name: "ガラスコーティング", price: 15000 }] });
});

test("B5c1: financial totals flow through the EXISTING engine — subtotal +¥47,000 (4×8000 + 1×15000), tax +¥4,700, grand total +¥51,700 over coating alone", () => {
  const base = coatingOnly();
  const r = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.equal(base.completeness, "complete");
  assert.equal(r.completeness, "complete");
  assert.equal(r.subtotal! - base.subtotal!, 47_000);
  assert.equal(r.taxTotal! - base.taxTotal!, 4_700);
  assert.equal(r.grandTotal! - base.grandTotal!, 51_700);
  assert.equal(r.discountTotal, base.discountTotal, "no discount is computed by the dedicated-menu path");
});

test("B5c1: an operator-edited quantity within bounds re-prices the line (2 wheels → +¥31,000 subtotal over coating alone)", () => {
  const base = coatingOnly();
  const r = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.quantitiesByMenu["wheel-coat"] = 2; }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.equal(r.completeness, "complete");
  assert.equal(lineOf(r, "wheel:wheel-coat")?.quantity, 2);
  assert.equal(r.subtotal! - base.subtotal!, 16_000 + 15_000);
  // GDA-PR143-R2: a ¥0 operator price is INVALID for a dedicated menu (distinct from "missing"): no
  // line, INVALID_MANUAL_PRICE with the positive-integer message, and the sibling category still prices.
  for (const zero of ["0", "00", " 0 "]) {
    const r0 = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.glass!.unitPricesByMenu["glass-coat"] = zero; }), DEDICATED_PC, makePricingCatalog(), RANK);
    assert.notEqual(r0.completeness, "complete", JSON.stringify(zero));
    assert.deepEqual(errorTriples(r0).filter((e) => e[1] === "glass"), [["INVALID_MANUAL_PRICE", "glass", "glass-coat"]], JSON.stringify(zero));
    assert.ok(r0.errors.some((e) => e.message === "「ガラスコーティング」の金額が不正です。1以上の整数で入力してください。"), JSON.stringify(zero));
    assert.equal(lineOf(r0, "glass:glass-coat"), undefined, "never a ¥0 glass line");
    assert.ok(lineOf(r0, "wheel:wheel-coat"), "wheel is independent and still priced");
  }
  // ¥1 is the smallest priced amount; the wheel line is unchanged by it.
  const one = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.glass!.unitPricesByMenu["glass-coat"] = "1"; }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(one.errors, []);
  assert.equal(one.subtotal! - base.subtotal!, 32_000 + 1);
});

test("GDA-PR143-R2: a menu whose configured price is UNCONFIGURED (null or persisted 0 ⇒ unitPriceConfigured false) cannot produce a line without a positive operator price; a positive one still prices", () => {
  const unconfiguredWheel: ProductionPricingConfiguration = {
    ...DEDICATED_PC,
    wheelMenus: [{ code: "wheel-coat", label: "ホイールコーティング", minQuantity: 1, maxQuantity: 4, unitPriceConfigured: false }],
  };
  // Nothing prefilled (Step 4 prefills nothing for an unconfigured price) → settings-flavoured MANUAL_PRICE_REQUIRED, no line.
  const empty = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.unitPricesByMenu = {}; }), unconfiguredWheel, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(empty).filter((e) => e[1] === "wheel"), [["MANUAL_PRICE_REQUIRED", "wheel", "wheel-coat"]]);
  assert.ok(empty.errors.some((e) => e.message === "「ホイールコーティング」の単価が店舗の設定にありません。金額を入力してください。"));
  assert.equal(empty.lines.some((l) => l.category === "wheel"), false);
  // An explicit "0" typed by the operator is still refused (never a saveable ¥0 line).
  const zero = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.unitPricesByMenu["wheel-coat"] = "0"; }), unconfiguredWheel, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(zero).filter((e) => e[1] === "wheel"), [["INVALID_MANUAL_PRICE", "wheel", "wheel-coat"]]);
  assert.equal(zero.lines.some((l) => l.category === "wheel"), false);
  // A positive operator price prices exactly as before (unit × 4) and records the configured-price fact.
  const priced = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.unitPricesByMenu["wheel-coat"] = "8000"; }), unconfiguredWheel, makePricingCatalog(), RANK);
  assert.equal(priced.completeness, "complete");
  assert.deepEqual([lineOf(priced, "wheel:wheel-coat")?.quantity, lineOf(priced, "wheel:wheel-coat")?.unitPrice, lineOf(priced, "wheel:wheel-coat")?.lineTotal], [4, 8000, 32_000]);
});

test("B5c1: multiple menus in one category are independent lines with distinct stable identities; a null-max menu accepts any quantity ≥ its min", () => {
  const r = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel = {
      selectedMenuIds: ["wheel-coat", "wheel-repair"],
      unitPricesByMenu: { "wheel-coat": "8000", "wheel-repair": "3000" },
      quantitiesByMenu: { "wheel-coat": 4, "wheel-repair": 100 },
    };
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.equal(r.completeness, "complete");
  assert.equal(lineOf(r, "wheel:wheel-coat")?.quantity, 4);
  assert.equal(lineOf(r, "wheel:wheel-repair")?.quantity, 100);
  assert.equal(lineOf(r, "wheel:wheel-repair")?.label, "ホイールリペア");
  assert.equal(r.lines.filter((l) => l.category === "wheel").length, 2);
});

test("B5c1: a MISSING operator price blocks that menu — it is never read back from the configured price and never priced as ¥0", () => {
  // Configured price exists (wheel-coat) but the operator cleared the input → no fallback.
  const cleared = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.unitPricesByMenu["wheel-coat"] = "  "; }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.notEqual(cleared.completeness, "complete");
  assert.deepEqual(errorTriples(cleared).filter((e) => e[1] === "wheel"), [["MANUAL_PRICE_REQUIRED", "wheel", "wheel-coat"]]);
  assert.equal(lineOf(cleared, "wheel:wheel-coat"), undefined, "no unpriced line");
  assert.ok(lineOf(cleared, "glass:glass-coat"), "the other category is independent and still priced");
  // No configured price AND no input → still MANUAL_PRICE_REQUIRED (a settings prompt, never ¥0).
  const unconfigured = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel = { selectedMenuIds: ["wheel-repair"], unitPricesByMenu: {}, quantitiesByMenu: { "wheel-repair": 2 } };
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(unconfigured).filter((e) => e[1] === "wheel"), [["MANUAL_PRICE_REQUIRED", "wheel", "wheel-repair"]]);
  assert.equal(unconfigured.lines.some((l) => l.category === "wheel"), false);
  // Non-integer / negative / non-numeric / zero yen → INVALID_MANUAL_PRICE, no line.
  for (const bad of ["12.5", "-1", "abc", "1e3", "８０００", "0"]) {
    const invalid = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.glass!.unitPricesByMenu["glass-coat"] = bad; }), DEDICATED_PC, makePricingCatalog(), RANK);
    assert.deepEqual(errorTriples(invalid).filter((e) => e[1] === "glass"), [["INVALID_MANUAL_PRICE", "glass", "glass-coat"]], bad);
    assert.equal(lineOf(invalid, "glass:glass-coat"), undefined, bad);
  }
});

test("B5c1: a stale / unknown / duplicate menu id blocks with NO line — a raw id never becomes an item name", () => {
  const stale = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel = { selectedMenuIds: ["wheel-old"], unitPricesByMenu: { "wheel-old": "8000" }, quantitiesByMenu: { "wheel-old": 4 } };
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(stale).filter((e) => e[1] === "wheel"), [["UNKNOWN_CONFIGURED_ITEM", "wheel", "wheel-old"]]);
  assert.equal(stale.lines.some((l) => l.category === "wheel"), false);
  assert.equal(stale.lines.some((l) => l.label === "wheel-old"), false, "no raw-id label fallback");
  // A glass id is NOT a wheel id: the two collections are never cross-looked-up.
  const crossed = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel = { selectedMenuIds: ["glass-coat"], unitPricesByMenu: { "glass-coat": "8000" }, quantitiesByMenu: { "glass-coat": 4 } };
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(crossed).filter((e) => e[1] === "wheel"), [["UNKNOWN_CONFIGURED_ITEM", "wheel", "glass-coat"]]);
  const duplicate = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel!.selectedMenuIds = ["wheel-coat", "wheel-coat"];
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(duplicate).filter((e) => e[1] === "wheel"), [["DUPLICATE_CONFIGURED_ITEM", "wheel", "wheel-coat"]]);
  assert.equal(duplicate.lines.filter((l) => l.sourceId === "wheel:wheel-coat").length, 1, "the first occurrence prices once; the duplicate blocks");
});

test("B5c1: quantity must be a positive safe integer within the CURRENT configured bounds; an absent quantity is never defaulted (not nominal, not min, not zero)", () => {
  const cases: Array<[string, number | undefined]> = [
    ["zero", 0], ["negative", -1], ["fraction", 1.5], ["above max 4", 5], ["NaN", Number.NaN], ["absent", undefined],
  ];
  for (const [name, qty] of cases) {
    const r = computeWizardPricingFromConfig(dedicatedDraft((d) => {
      if (qty === undefined) delete d.serviceConfiguration.wheel!.quantitiesByMenu["wheel-coat"];
      else d.serviceConfiguration.wheel!.quantitiesByMenu["wheel-coat"] = qty;
    }), DEDICATED_PC, makePricingCatalog(), RANK);
    assert.deepEqual(errorTriples(r).filter((e) => e[1] === "wheel"), [["INVALID_QUANTITY", "wheel", "wheel-coat"]], name);
    assert.equal(lineOf(r, "wheel:wheel-coat"), undefined, name);
  }
  // Below a configured minimum (wheel-repair min 2) blocks even though the value is a positive integer.
  const belowMin = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.serviceConfiguration.wheel = { selectedMenuIds: ["wheel-repair"], unitPricesByMenu: { "wheel-repair": "3000" }, quantitiesByMenu: { "wheel-repair": 1 } };
  }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(belowMin).filter((e) => e[1] === "wheel"), [["INVALID_QUANTITY", "wheel", "wheel-repair"]]);
  // The configured bounds are the CURRENT ones: tightening max to 3 rejects a quantity of 4 that was valid before.
  const tightened: ProductionPricingConfiguration = { ...DEDICATED_PC, wheelMenus: [{ code: "wheel-coat", label: "ホイールコーティング", minQuantity: 1, maxQuantity: 3, unitPriceConfigured: true }] };
  const r4 = computeWizardPricingFromConfig(dedicatedDraft(), tightened, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(r4).filter((e) => e[1] === "wheel"), [["INVALID_QUANTITY", "wheel", "wheel-coat"]]);
});

test("B5c1: a selected wheel/glass category with an ABSENT or EMPTY authoritative collection blocks — no line is invented; the other category is unaffected", () => {
  const catalog = makePricingCatalog();
  // Absent (older fixture / a caller that never ran the resolver): `PC` carries no wheelMenus / glassMenus.
  const absent = computeWizardPricingFromConfig(dedicatedDraft(), PC, catalog, RANK);
  assert.notEqual(absent.completeness, "complete");
  assert.deepEqual(errorTriples(absent).filter((e) => e[1] === "wheel" || e[1] === "glass"), [
    ["DEDICATED_MENU_CONFIG_REQUIRED", "wheel", null],
    ["DEDICATED_MENU_CONFIG_REQUIRED", "glass", null],
  ]);
  assert.equal(absent.lines.some((l) => l.category === "wheel" || l.category === "glass"), false);
  // Existing route semantics are untouched: a priced coating line beside a blocked category is
  // `partial` (never `complete`), and the blocked category contributes nothing to any total.
  assert.equal(absent.completeness, "partial");
  assert.equal(absent.subtotal, coatingOnly().subtotal, "the blocked categories add ¥0 — no invented line, no invented price");
  // Empty (the dealer authored none) for wheel only: wheel blocks, glass still prices.
  const emptyWheel = computeWizardPricingFromConfig(dedicatedDraft(), { ...DEDICATED_PC, wheelMenus: [] }, catalog, RANK);
  assert.deepEqual(errorTriples(emptyWheel).filter((e) => e[1] === "wheel" || e[1] === "glass"), [["DEDICATED_MENU_CONFIG_REQUIRED", "wheel", null]]);
  assert.equal(lineOf(emptyWheel, "wheel:wheel-coat"), undefined);
  assert.ok(lineOf(emptyWheel, "glass:glass-coat"), "glass is independent of the wheel collection");
  // An absent/empty collection is irrelevant when the category is NOT selected: existing drafts price exactly as before.
  const unselected = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceSelection.selectedCategories = ["coating"]; }), PC, catalog, RANK);
  assert.equal(unselected.completeness, "complete");
  assert.deepEqual(unselected.errors, []);
});

test("B5c1: a selected category whose draft section is absent or has no menu selected blocks (MANUAL_PRICE_REQUIRED) without inventing a selection", () => {
  const noSection = computeWizardPricingFromConfig(dedicatedDraft((d) => { delete d.serviceConfiguration.wheel; }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(noSection).filter((e) => e[1] === "wheel"), [["MANUAL_PRICE_REQUIRED", "wheel", null]]);
  assert.equal(noSection.lines.some((l) => l.category === "wheel"), false);
  const noneSelected = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.glass = { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} }; }), DEDICATED_PC, makePricingCatalog(), RANK);
  assert.deepEqual(errorTriples(noneSelected).filter((e) => e[1] === "glass"), [["MANUAL_PRICE_REQUIRED", "glass", null]]);
  assert.equal(noneSelected.lines.some((l) => l.category === "glass"), false);
});

// ── GDA-OTHER-COATINGS-R1 (C4) — DISTINCT `other_coating` manual lines through the compute route ──
// One line per selected dealer row with the stable identity `other_coating:<code>`; the quantity
// rule is READ FROM THE ROW (fixed-one ⇒ exactly 1; quantity-bearing ⇒ bounded n); price is the
// operator's POSITIVE integer text; totals flow through the existing engine; body coating and the
// store-global options are never touched (no double count, no fallback).

const OC_PC: ProductionPricingConfiguration = {
  ...DEDICATED_PC,
  otherCoatingMenus: [
    // fixed-one row: quantityRequired false, no bounds, positive configured price
    { code: "oc-trim",   label: "樹脂パーツコーティング",     quantityRequired: false, minQuantity: null, maxQuantity: null, unitPriceConfigured: true },
    // quantity-bearing row with configured bounds 1..5
    { code: "oc-seat",   label: "シートコーティング",         quantityRequired: true,  minQuantity: 1,    maxQuantity: 5,    unitPriceConfigured: true },
    // quantity-bearing row, absent min (= 1) / absent max (unbounded), NO positive configured price
    { code: "oc-engine", label: "エンジンルームコーティング", quantityRequired: true,  minQuantity: null, maxQuantity: null, unitPriceConfigured: false },
  ],
};
const OC_TRIM = "other_coating:oc-trim";
const OC_SEAT = "other_coating:oc-seat";
const OC_ENGINE = "other_coating:oc-engine";

/** The B5 dedicated draft (coating + wheel + glass) plus the C3 other-coating section: fixed-one × 1, seat × 3. */
function otherCoatingDraft(over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const d = dedicatedDraft();
  d.serviceSelection.selectedCategories = ["coating", "wheel", "glass", "other_coating"];
  d.serviceConfiguration.otherCoating = {
    selectedMenuIds: ["oc-trim", "oc-seat"],
    unitPricesByMenu: { "oc-trim": "6000", "oc-seat": "4000" },
    quantitiesByMenu: { "oc-trim": 1, "oc-seat": 3 },
  };
  over?.(d);
  return d;
}
const ocErrors = (r: { errors: readonly { code: string; category: string | null; sourceId: string | null }[] }) =>
  errorTriples(r).filter((e) => e[1] === "other_coating");
const ocLines = (r: { lines: readonly WizardPricingLineResult[] }) => r.lines.filter((l) => l.category === "other_coating");
/** The B5 reference run (coating + wheel + glass, no other coating) every C4 delta is measured against. */
const dedicatedOnly = () => computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, makePricingCatalog(), RANK);
const compute = (d: EstimateWizardDraftV22, pc: ProductionPricingConfiguration = OC_PC) => computeWizardPricingFromConfig(d, pc, makePricingCatalog(), RANK);

test("C4: a fixed-one row prices EXACTLY one `other_coating` line at quantity 1 — stable identity, authoritative label, positive integer unit price, policy null (read-only)", () => {
  const r = compute(otherCoatingDraft());
  assert.equal(r.completeness, "complete");
  assert.deepEqual(r.errors, []);
  const trim = lineOf(r, OC_TRIM);
  assert.ok(trim, "one line for the fixed-one row");
  assert.equal(trim!.kind, "manual");
  assert.equal(trim!.pricingReferenceId, null);
  assert.equal(trim!.category, "other_coating");
  assert.equal(trim!.label, "樹脂パーツコーティング", "authoritative dealer label, never the raw code");
  assert.deepEqual([trim!.quantity, trim!.unitPrice, trim!.lineSubtotal, trim!.lineTotal], [1, 6000, 6000, 6000]);
  assert.equal(trim!.quantityPolicy, null, "fixed-one is never quantity-editable at final review");
  assert.equal(wizardPricingLineId(trim!), "manual:other_coating:oc-trim", "review line id = manual:other_coating:<code>");
  assert.equal(ocLines(r).filter((l) => l.sourceId === OC_TRIM).length, 1, "exactly one distinct line per row");
  // No body-coating double count and no store-option fallback: the coating lines are byte-identical
  // to the B5 reference and no `store_global_options` line appears.
  const ref = dedicatedOnly();
  assert.deepEqual(r.lines.filter((l) => l.category === "coating"), ref.lines.filter((l) => l.category === "coating"));
  assert.equal(r.lines.some((l) => l.category === "store_global_options"), false);
  assert.equal(r.lines.some((l) => l.unitPrice === 0 || l.lineTotal === 0), false, "never a zero-price line");
});

test("C4: a quantity-bearing row prices unit × n and is annotated with the configured bounds + dedicatedMenu { kind: other_coating }; absent min/max mean 1 / unbounded; the annotation equals reviewQuantityPolicyForLine", () => {
  const r = compute(otherCoatingDraft((d) => {
    d.serviceConfiguration.otherCoating!.selectedMenuIds.push("oc-engine");
    d.serviceConfiguration.otherCoating!.unitPricesByMenu["oc-engine"] = "2500";
    d.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-engine"] = 100;
  }));
  assert.deepEqual(r.errors, []);
  const seat = lineOf(r, OC_SEAT)!;
  assert.deepEqual([seat.quantity, seat.unitPrice, seat.lineSubtotal, seat.lineTotal], [3, 4000, 12000, 12000], "unit × 3 from the normal engine");
  assert.deepEqual(seat.quantityPolicy, { minQuantity: 1, maxQuantity: 5, dedicatedMenu: { kind: "other_coating", menuCode: "oc-seat" } });
  const engine = lineOf(r, OC_ENGINE)!;
  assert.deepEqual([engine.quantity, engine.lineTotal], [100, 250000], "a null-max row accepts any quantity ≥ its min");
  assert.deepEqual(engine.quantityPolicy, { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "other_coating", menuCode: "oc-engine" } });
  assert.equal(ocLines(r).length, 3, "one distinct line per selected row");
  // The compute-route annotation is EXACTLY what the review rule resolves from the bundle + config.
  const bundle = buildWizardPricingInputFromConfig(otherCoatingDraft(), OC_PC, makePricingCatalog(), RANK);
  const plain = compute(otherCoatingDraft());
  for (const line of plain.lines) {
    assert.deepEqual(line.quantityPolicy, reviewQuantityPolicyForLine(stripPolicy(line), bundle, OC_PC), line.sourceId);
  }
  const src = bundle.manualLines.find((m) => m.sourceCategory === "other_coating" && m.manualPricingIdentity === "oc-trim")!;
  assert.deepEqual(src.metadata, { menuKind: "other_coating_menu", quantityRequired: false, minQuantity: 1, maxQuantity: 1, unitPriceConfigured: true });
});

test("C4: financial totals flow through the EXISTING engine — subtotal +¥18,000 (1×6000 + 3×4000), tax +¥1,800, grand total +¥19,800 over the B5 wheel/glass/coating reference", () => {
  const ref = dedicatedOnly();
  const r = compute(otherCoatingDraft());
  assert.equal(r.subtotal, (ref.subtotal as number) + 18_000);
  assert.equal(r.taxTotal, (ref.taxTotal as number) + 1_800);
  assert.equal(r.grandTotal, (ref.grandTotal as number) + 19_800);
  assert.equal(r.taxableSubtotal, r.subtotal, "tax base is the subtotal");
  assert.equal(r.taxTotal, Math.floor((r.subtotal as number) / 10));
  assert.equal(r.grandTotal, (r.subtotal as number) + (r.taxTotal as number) - (r.discountTotal as number), "total = subtotal + tax − applied discount");
  // wheel / glass lines are untouched by the new category (B5 no regression)
  assert.deepEqual(lineOf(r, "wheel:wheel-coat"), lineOf(ref, "wheel:wheel-coat"));
  assert.deepEqual(lineOf(r, "glass:glass-coat"), lineOf(ref, "glass:glass-coat"));
});

test("C4: unconfigured / missing / zero / malformed price fails closed — never read back from the configured price, never a ¥0 line", () => {
  // Unconfigured row (null / 0 configured price) with NO operator text: a settings prompt, not a ¥0 line.
  const unconfigured = compute(otherCoatingDraft((d) => {
    d.serviceConfiguration.otherCoating = { selectedMenuIds: ["oc-engine"], unitPricesByMenu: {}, quantitiesByMenu: { "oc-engine": 1 } };
  }));
  assert.deepEqual(ocErrors(unconfigured), [["MANUAL_PRICE_REQUIRED", "other_coating", "oc-engine"]]);
  assert.match(unconfigured.errors.find((e) => e.sourceId === "oc-engine")!.message, /店舗の設定にありません/);
  assert.equal(ocLines(unconfigured).length, 0);
  assert.notEqual(unconfigured.completeness, "complete");
  // Configured row but the operator cleared the text: no fallback to the configured price.
  const cleared = compute(otherCoatingDraft((d) => { d.serviceConfiguration.otherCoating!.unitPricesByMenu["oc-trim"] = "  "; }));
  assert.deepEqual(ocErrors(cleared), [["MANUAL_PRICE_REQUIRED", "other_coating", "oc-trim"]]);
  assert.match(cleared.errors.find((e) => e.sourceId === "oc-trim")!.message, /未入力/);
  assert.equal(lineOf(cleared, OC_TRIM), undefined, "no unpriced line");
  assert.ok(lineOf(cleared, OC_SEAT), "the other row is independent");
  // Zero and malformed prices block: a ZERO price is never a line.
  for (const bad of ["0", "00", "-5", "1.5", "abc", "1e3", "5000円"]) {
    const r = compute(otherCoatingDraft((d) => { d.serviceConfiguration.otherCoating!.unitPricesByMenu["oc-seat"] = bad; }));
    assert.deepEqual(ocErrors(r), [["INVALID_MANUAL_PRICE", "other_coating", "oc-seat"]], `price "${bad}"`);
    assert.equal(lineOf(r, OC_SEAT), undefined, `price "${bad}": no line`);
    assert.equal(r.lines.some((l) => l.unitPrice === 0), false, `price "${bad}": never a zero-price line`);
  }
  // An unconfigured row MAY be priced by an operator-typed positive integer (the operator's text is the only priced amount).
  const typed = compute(otherCoatingDraft((d) => {
    d.serviceConfiguration.otherCoating = { selectedMenuIds: ["oc-engine"], unitPricesByMenu: { "oc-engine": "2500" }, quantitiesByMenu: { "oc-engine": 2 } };
  }));
  assert.deepEqual(ocErrors(typed), []);
  assert.deepEqual([lineOf(typed, OC_ENGINE)?.unitPrice, lineOf(typed, OC_ENGINE)?.lineTotal], [2500, 5000]);
});

test("C4: an unknown, duplicate or cross-collection id blocks with NO line — a raw id never becomes an item name, and wheel/glass rows are never resolved as other coating", () => {
  const stale = compute(otherCoatingDraft((d) => {
    d.serviceConfiguration.otherCoating = { selectedMenuIds: ["oc-old"], unitPricesByMenu: { "oc-old": "6000" }, quantitiesByMenu: { "oc-old": 1 } };
  }));
  assert.deepEqual(ocErrors(stale), [["UNKNOWN_CONFIGURED_ITEM", "other_coating", "oc-old"]]);
  assert.equal(ocLines(stale).length, 0);
  assert.equal(stale.lines.some((l) => l.label === "oc-old"), false, "no raw-id label fallback");
  const crossed = compute(otherCoatingDraft((d) => {
    d.serviceConfiguration.otherCoating = { selectedMenuIds: ["wheel-coat"], unitPricesByMenu: { "wheel-coat": "8000" }, quantitiesByMenu: { "wheel-coat": 1 } };
  }));
  assert.deepEqual(ocErrors(crossed), [["UNKNOWN_CONFIGURED_ITEM", "other_coating", "wheel-coat"]]);
  assert.equal(ocLines(crossed).length, 0);
  assert.ok(lineOf(crossed, "wheel:wheel-coat"), "the wheel line itself is unaffected");
  const duplicate = compute(otherCoatingDraft((d) => { d.serviceConfiguration.otherCoating!.selectedMenuIds = ["oc-trim", "oc-trim"]; }));
  assert.deepEqual(ocErrors(duplicate), [["DUPLICATE_CONFIGURED_ITEM", "other_coating", "oc-trim"]]);
  assert.ok(ocLines(duplicate).filter((l) => l.sourceId === OC_TRIM).length <= 1, "never two lines with one identity");
  assert.notEqual(duplicate.completeness, "complete");
});

test("C4: quantity bounds — a quantity-bearing row rejects absent / zero / negative / fractional / out-of-bounds; a fixed-one row accepts ONLY 1 (absent = 1) and blocks anything else", () => {
  const cases: Array<[string, number | undefined]> = [
    ["zero", 0], ["negative", -1], ["fraction", 1.5], ["above max 5", 6], ["NaN", Number.NaN], ["absent", undefined],
  ];
  for (const [name, qty] of cases) {
    const r = compute(otherCoatingDraft((d) => {
      if (qty === undefined) delete d.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-seat"];
      else d.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-seat"] = qty;
    }));
    assert.deepEqual(ocErrors(r), [["INVALID_QUANTITY", "other_coating", "oc-seat"]], name);
    assert.equal(lineOf(r, OC_SEAT), undefined, name);
    assert.ok(lineOf(r, OC_TRIM), `${name}: the fixed-one row is independent`);
  }
  // The configured bounds are the CURRENT ones: tightening max to 2 rejects a quantity of 3 that was valid before.
  const tightened: ProductionPricingConfiguration = { ...OC_PC, otherCoatingMenus: OC_PC.otherCoatingMenus!.map((m) => (m.code === "oc-seat" ? { ...m, maxQuantity: 2 } : m)) };
  assert.deepEqual(ocErrors(compute(otherCoatingDraft(), tightened)), [["INVALID_QUANTITY", "other_coating", "oc-seat"]]);
  // Malformed configured bounds (min 0 / max < min) fail closed rather than pricing anything.
  for (const bounds of [{ minQuantity: 0, maxQuantity: 5 }, { minQuantity: 3, maxQuantity: 2 }, { minQuantity: 1.5, maxQuantity: null }]) {
    const malformed: ProductionPricingConfiguration = { ...OC_PC, otherCoatingMenus: OC_PC.otherCoatingMenus!.map((m) => (m.code === "oc-seat" ? { ...m, ...bounds } : m)) };
    const r = compute(otherCoatingDraft(), malformed);
    assert.deepEqual(ocErrors(r), [["INVALID_QUANTITY", "other_coating", "oc-seat"]], JSON.stringify(bounds));
    assert.equal(lineOf(r, OC_SEAT), undefined);
  }
  // Fixed-one: a draft quantity ≠ 1 is a stale / tampered contradiction and blocks; an absent entry is 1.
  const two = compute(otherCoatingDraft((d) => { d.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-trim"] = 2; }));
  assert.deepEqual(ocErrors(two), [["INVALID_QUANTITY", "other_coating", "oc-trim"]]);
  assert.equal(lineOf(two, OC_TRIM), undefined);
  const absent = compute(otherCoatingDraft((d) => { delete d.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-trim"]; }));
  assert.deepEqual(ocErrors(absent), []);
  assert.deepEqual([lineOf(absent, OC_TRIM)?.quantity, lineOf(absent, OC_TRIM)?.lineTotal], [1, 6000]);
});

test("C4: an ABSENT or EMPTY authoritative collection blocks (no invented line); an absent section / no selection blocks; an unselected category is inert — B5 wheel/glass results are byte-identical", () => {
  const catalog = makePricingCatalog();
  const ref = dedicatedOnly();
  // Absent (the B5 configuration carries no otherCoatingMenus) and empty (the dealer authored none).
  for (const [name, pc] of [["absent", DEDICATED_PC], ["empty", { ...OC_PC, otherCoatingMenus: [] }]] as const) {
    const r = computeWizardPricingFromConfig(otherCoatingDraft(), pc, catalog, RANK);
    assert.deepEqual(ocErrors(r), [["DEDICATED_MENU_CONFIG_REQUIRED", "other_coating", null]], name);
    assert.equal(ocLines(r).length, 0, name);
    assert.equal(r.completeness, "partial", name);
    assert.equal(r.subtotal, ref.subtotal, `${name}: the blocked category adds ¥0 — no invented line, no invented price`);
    assert.ok(lineOf(r, "wheel:wheel-coat") && lineOf(r, "glass:glass-coat"), `${name}: wheel / glass still price`);
  }
  const noSection = compute(otherCoatingDraft((d) => { delete d.serviceConfiguration.otherCoating; }));
  assert.deepEqual(ocErrors(noSection), [["MANUAL_PRICE_REQUIRED", "other_coating", null]]);
  assert.equal(ocLines(noSection).length, 0);
  const noneSelected = compute(otherCoatingDraft((d) => { d.serviceConfiguration.otherCoating = { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} }; }));
  assert.deepEqual(ocErrors(noneSelected), [["MANUAL_PRICE_REQUIRED", "other_coating", null]]);
  // Not selected: the C4 branch never runs — the B5 result with the extended configuration is byte-identical to the reference.
  assert.deepEqual(compute(dedicatedDraft()), ref);
  assert.deepEqual(compute(dedicatedDraft((d) => { d.serviceConfiguration.otherCoating = { selectedMenuIds: ["oc-trim"], unitPricesByMenu: { "oc-trim": "6000" }, quantitiesByMenu: { "oc-trim": 1 } }; })), ref, "a populated but UNSELECTED section prices nothing");
});
