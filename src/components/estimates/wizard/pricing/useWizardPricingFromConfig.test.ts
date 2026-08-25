// EW-UI-4A1 — Authoritative pricing computation tests.
//
// Proves the config-driven route: required four-arg API, the explicitly-supplied catalog controls
// the result, authoritative labels only (no raw-id fallback), display/apply parity, fail-closed
// surfacing of every unresolved/invalid case, no silent-zero, determinism, input immutability, and
// source guards against fixture/default/apply/side-effect imports.
//
// DEFAULT_PRICING_CATALOG and makePricingCatalog are used here ONLY as explicitly-passed test values;
// the production module imports neither.
//
// Run: node --import tsx --test src/components/estimates/wizard/pricing/useWizardPricingFromConfig.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  computeWizardPricingFromConfig,
  useWizardPricingFromConfig,
} from "./useWizardPricingFromConfig";
import {
  calculateEstimate,
  DEFAULT_PRICING_CATALOG,
  makePricingCatalog,
  lineTotal,
  type PricingCatalog,
} from "@/lib/pricing/canonical-pricing-engine";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft, WizardDiscountDraft } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";
import { buildWizardPricingInputFromConfig } from "./wizard-pricing-input-adapter-config";
import { newEstimateWizardDraft } from "../integration/estimateToWizardDraft";
import { buildEstimateEditorApplyPlan } from "../integration/wizardDraftToEditorPatch";

// ── fixtures ────────────────────────────────────────────────────────────────────

const RANK: ShopRank = "detailer";

const CONFIG: ProductionPricingConfiguration = {
  ppfMethods:        [{ code: "full", label: "PPFフル施工" }],
  filmTypes:         [{ code: "ft1", label: "透明フィルム" }],
  maintenanceMenus:  [{ code: "mm1", label: "6ヶ月ボディメンテナンス" }],
  washMenus:         [{ code: "cw1", label: "手洗い洗車" }],
  roomCleaningMenus: [{ code: "rc1", label: "車内清掃" }],
  storeGlobalOptions: [
    { code: "go1",   label: "鉄粉除去",       priceable: true,  quantityRequired: false, minQuantity: 1, maxQuantity: null },
    { code: "go-np", label: "非課金オプション", priceable: false, quantityRequired: false, minQuantity: 1, maxQuantity: null },
    { code: "go-q",  label: "数量オプション",   priceable: true,  quantityRequired: true,  minQuantity: 1, maxQuantity: 5 },
  ],
};

function draftWith(
  categories: ServiceCategoryId[],
  cfgOverride: Partial<WizardServiceConfigurationDraft> = {},
  dcOverride: Partial<WizardDiscountDraft> = {},
): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  return {
    ...d,
    serviceSelection: { ...d.serviceSelection, selectedCategories: categories },
    serviceConfiguration: { ...d.serviceConfiguration, ...cfgOverride },
    discountAndCoupon: { ...d.discountAndCoupon, ...dcOverride },
  };
}

const maintenanceDraft = () =>
  draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } });

const coatingDraft = () =>
  draftWith(["coating"], { coating: { layerCount: 1, layer1Id: "one-evo", layer2Id: null, layer3Id: null } });

const overrideCoatingBase = (id: string, base: number): PricingCatalog =>
  makePricingCatalog({ coatings: DEFAULT_PRICING_CATALOG.coatings.map((c) => (c.id === id ? { ...c, base } : c)) });

/** Fail-closed: unavailable/error pricing must expose NO genuine ¥0 aggregate — every total is null. */
function assertAllAggregatesNull(r: { subtotal: number | null; discountTotal: number | null; taxableSubtotal: number | null; taxTotal: number | null; grandTotal: number | null }) {
  assert.equal(r.subtotal, null, "subtotal null");
  assert.equal(r.discountTotal, null, "discountTotal null");
  assert.equal(r.taxableSubtotal, null, "taxableSubtotal null");
  assert.equal(r.taxTotal, null, "taxTotal null");
  assert.equal(r.grandTotal, null, "grandTotal null");
}

// ── 1. Required four-arg API, no defaults ────────────────────────────────────────

test("1. both exported functions require exactly four arguments and declare no defaults", () => {
  assert.equal(computeWizardPricingFromConfig.length, 4);
  assert.equal(useWizardPricingFromConfig.length, 4);
  const src = readFileSync("src/components/estimates/wizard/pricing/useWizardPricingFromConfig.ts", "utf8");
  // No optional param and no default value on the four inputs of either signature.
  assert.equal(/shopRank\?:/.test(src), false, "shopRank must not be optional");
  assert.equal(/catalog\?:/.test(src), false, "catalog must not be optional");
  assert.equal(/=\s*DEFAULT_PRICING_CATALOG/.test(src), false, "no default catalog");
});

// ── 2. Explicitly-supplied catalog controls the result ──────────────────────────

test("2. a non-default PricingCatalog controls the computed result", () => {
  const draft = coatingDraft();
  const cheap = overrideCoatingBase("one-evo", 100000);
  const pricey = overrideCoatingBase("one-evo", 900000);
  const rCheap = computeWizardPricingFromConfig(draft, CONFIG, cheap, RANK);
  const rPricey = computeWizardPricingFromConfig(draft, CONFIG, pricey, RANK);
  assert.ok(rCheap.grandTotal !== null && rPricey.grandTotal !== null, "both priced");
  assert.notEqual(rCheap.grandTotal, rPricey.grandTotal, "catalog base drives the total");
  assert.ok((rPricey.grandTotal as number) > (rCheap.grandTotal as number));
});

// ── 3. Authoritative labels only; raw IDs never become labels ────────────────────

test("3. manual line label comes from config; the raw id never becomes a label", () => {
  const r = computeWizardPricingFromConfig(maintenanceDraft(), CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  const line = r.lines.find((l) => l.category === "maintenance");
  assert.ok(line, "maintenance line present");
  assert.equal(line!.label, "6ヶ月ボディメンテナンス");
  assert.equal(r.lines.some((l) => l.label === "mm1"), false, "raw id never used as a label");
});

// ── 4. Display / apply parity ────────────────────────────────────────────────────

test("4. display lines + totals match buildEstimateEditorApplyPlan for the same inputs", () => {
  const draft = maintenanceDraft();
  const display = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);

  const hydrated = newEstimateWizardDraft();
  Object.assign(hydrated.draft, draft);
  const plan = buildEstimateEditorApplyPlan(hydrated, "create", DEFAULT_PRICING_CATALOG, CONFIG, RANK);
  assert.equal(plan.status, "ready", "apply plan is ready");
  if (plan.status !== "ready") return;

  // priced identities, in order: label ↔ item_name, quantity, unitPrice ↔ unit_price, line total.
  assert.equal(display.lines.length, plan.items.length, "same line count");
  display.lines.forEach((dl, i) => {
    const it = plan.items[i];
    assert.equal(dl.label, it.item_name, `line ${i}: label ↔ item_name`);
    assert.equal(dl.quantity, it.quantity, `line ${i}: quantity`);
    assert.equal(dl.unitPrice, it.unit_price, `line ${i}: unitPrice ↔ unit_price`);
    assert.equal(dl.lineTotal, lineTotal(it.quantity, it.unit_price, it.discount_rate), `line ${i}: line total`);
  });

  // Totals derive from the SAME bundle + catalog through the canonical engine (no re-computation here).
  const bundle = buildWizardPricingInputFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  const engine = calculateEstimate(bundle.services, bundle.discounts, bundle.taxRate, DEFAULT_PRICING_CATALOG);
  assert.equal(display.subtotal, engine.subtotal, "subtotal parity");
  assert.equal(display.taxTotal, engine.taxAmount, "tax parity");
  assert.equal(display.grandTotal, engine.total, "grand total parity");
});

// ── 4b. No selection at all → unavailable with null aggregate totals ──────────────

test("4b. a draft with no selected service is unavailable with null aggregate totals", () => {
  const r = computeWizardPricingFromConfig(draftWith([]), CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.equal(r.completeness, "unavailable");
  assertAllAggregatesNull(r);
  assert.equal(r.couponTotal, 0, "couponTotal stays 0 (deferred), not disguising a total");
});

// ── 4c. Selected category, no priceable service, no specific error → NO_SERVICE_SELECTED ──

test("4c. a selected category resolving to no service surfaces NO_SERVICE_SELECTED with null totals", () => {
  // Coating selected but no layer chosen: no coating service, and no more-specific error is raised.
  const draft = draftWith(["coating"], { coating: { layerCount: null, layer1Id: null, layer2Id: null, layer3Id: null } });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.ok(r.errors.some((e) => e.code === "NO_SERVICE_SELECTED"), "NO_SERVICE_SELECTED surfaced");
  assert.equal(r.completeness, "unavailable");
  assertAllAggregatesNull(r);
});

// ── 5. Unknown coating reference surfaced, never silently priced ──────────────────

test("5. unknown coating reference is surfaced, never priced, and yields null totals", () => {
  const draft = draftWith(["coating"], { coating: { layerCount: 1, layer1Id: "not-a-real-coating", layer2Id: null, layer3Id: null } });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.ok(r.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"), "unknown reference surfaced");
  assert.equal(r.lines.some((l) => l.category === "coating"), false, "no coating line invented");
  assert.equal(r.completeness, "unavailable");
  assertAllAggregatesNull(r);
});

// ── 6. Missing authoritative manual label surfaced, no invented label ─────────────

test("6. an unconfigured manual menu is surfaced, invents no label, and yields null totals", () => {
  const draft = draftWith(["maintenance"], { bodyMaintenance: { menuId: "no-such-menu", unitPriceInput: "5000" } });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.ok(r.errors.some((e) => e.code === "UNKNOWN_CONFIGURED_ITEM"), "unknown configured item surfaced");
  assert.equal(r.lines.some((l) => l.label === "no-such-menu"), false, "raw id never becomes a line label");
  assert.equal(r.lines.length, 0, "no line produced for an unconfigured item");
  assert.equal(r.completeness, "unavailable");
  assertAllAggregatesNull(r);
});

// ── 7. Selected non-priceable option surfaced, never a line ──────────────────────

test("7. a selected non-priceable store-global option is surfaced and never billed", () => {
  const draft = draftWith(["maintenance"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    storeGlobalOptions: { selectedOptionIds: ["go-np"], unitPricesByOption: { "go-np": "1000" }, quantitiesByOption: {} },
  });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.ok(r.errors.some((e) => e.code === "NON_PRICEABLE_SELECTED_ITEM"), "non-priceable surfaced");
  assert.equal(r.lines.some((l) => l.label === "非課金オプション"), false, "never becomes a line");
});

// ── 8. Invalid quantity surfaced ─────────────────────────────────────────────────

test("8. an invalid quantity is surfaced as error with null aggregate totals", () => {
  const draft = draftWith(["maintenance"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    storeGlobalOptions: { selectedOptionIds: ["go-q"], unitPricesByOption: { "go-q": "1000" }, quantitiesByOption: { "go-q": 0 } },
  });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.ok(r.errors.some((e) => e.code === "INVALID_QUANTITY"), "invalid quantity surfaced");
  assert.equal(r.completeness, "error", "invalid quantity marks the result as error");
  assertAllAggregatesNull(r);
});

// ── 8b. Partial: one valid priced line + one unresolved item ─────────────────────

test("8b. a partial result keeps numeric priced-subset totals and is not complete", () => {
  // maintenance prices cleanly; coating carries an unknown reference (an unresolved priced service).
  const draft = draftWith(["maintenance", "coating"], {
    bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" },
    coating: { layerCount: 1, layer1Id: "not-a-real-coating", layer2Id: null, layer3Id: null },
  });
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.equal(r.completeness, "partial");
  assert.notEqual(r.completeness, "complete");
  assert.ok(r.unresolvedItems.some((u) => u.code === "UNKNOWN_PRICING_REFERENCE"), "unresolved item present");
  assert.ok(r.lines.some((l) => l.label === "6ヶ月ボディメンテナンス"), "the valid line is priced");
  assert.ok(typeof r.subtotal === "number" && r.subtotal > 0, "priced-subset subtotal remains numeric");
  assert.ok(typeof r.grandTotal === "number" && r.grandTotal > 0, "priced-subset grand total remains numeric");
});

// ── 9. Percentage discount is converted to yen and applied ────────────────────────

test("9. a valid percentage discount is converted to yen and applied", () => {
  const draft = draftWith(
    ["maintenance"],
    { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } },
    { mode: "percent", percentInput: "10" },
  );
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.equal(r.errors.some((e) => e.code === "PERCENTAGE_NOT_SUPPORTED"), false, "valid percentage is accepted");
  assert.equal(r.discountIntent.mode, "percentage", "percentage intent is preserved");
  assert.equal(r.discountTotal, 500, "10% of the 5,000 yen subtotal is applied");
});

// ── 10. Unknown coupon fails closed instead of silently pricing as zero ────────────

test("10. an unconfigured selected coupon fails closed with a visible state", () => {
  const draft = draftWith(
    ["maintenance"],
    { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } },
    { selectedCouponIds: ["cp1"] },
  );
  const r = computeWizardPricingFromConfig(draft, CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.equal(r.couponTotal, 0, "an unknown coupon never reduces the total");
  assert.equal(r.couponState.status, "selected_not_priced", "unpriced coupon state is visible");
  assert.ok(r.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"), "unknown coupon error surfaced");
});

// ── 11. Malformed/missing catalog or config cannot throw and cannot fall back ─────

test("11. a malformed catalog cannot throw through the public compute or fall back to a default", () => {
  const draft = coatingDraft();
  const badCatalog = {} as unknown as PricingCatalog;
  let r!: ReturnType<typeof computeWizardPricingFromConfig>;
  assert.doesNotThrow(() => { r = computeWizardPricingFromConfig(draft, CONFIG, badCatalog, RANK); });
  assert.equal(r.status, "error");
  assert.equal(r.completeness, "error");
  assertAllAggregatesNull(r); // no default-catalog fallback price
  assert.ok(r.errors.some((e) => e.code === "PRODUCTION_PRICING_ERROR"));
  assert.equal(r.errors.some((e) => /\bat\b.*\(/.test(e.message)), false, "no stack trace leaked");
});

test("11b. a malformed config cannot throw through the public compute", () => {
  const draft = maintenanceDraft();
  const badConfig = null as unknown as ProductionPricingConfiguration;
  let r!: ReturnType<typeof computeWizardPricingFromConfig>;
  assert.doesNotThrow(() => { r = computeWizardPricingFromConfig(draft, badConfig, DEFAULT_PRICING_CATALOG, RANK); });
  assert.equal(r.status, "error");
  assert.equal(r.completeness, "error");
  assertAllAggregatesNull(r);
});

// ── 12. Inputs remain value-identical after computation ──────────────────────────

test("12. draft, config, and catalog are not mutated by computation", () => {
  const draft = maintenanceDraft();
  const catalog = DEFAULT_PRICING_CATALOG;
  const draftSnap = JSON.stringify(draft);
  const configSnap = JSON.stringify(CONFIG);
  const catalogSnap = JSON.stringify(catalog);
  computeWizardPricingFromConfig(draft, CONFIG, catalog, RANK);
  assert.equal(JSON.stringify(draft), draftSnap, "draft unchanged");
  assert.equal(JSON.stringify(CONFIG), configSnap, "config unchanged");
  assert.equal(JSON.stringify(catalog), catalogSnap, "catalog unchanged");
});

// ── 13. Determinism ──────────────────────────────────────────────────────────────

test("13. equivalent inputs are deterministic", () => {
  const a = computeWizardPricingFromConfig(maintenanceDraft(), CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  const b = computeWizardPricingFromConfig(maintenanceDraft(), CONFIG, DEFAULT_PRICING_CATALOG, RANK);
  assert.deepEqual(a, b);
});

// ── 14 + 15. Source guards (BOTH the client hook AND the extracted server-safe core) ─────
// The compute logic now lives in the core module; guarding only the thin hook wrapper would pass
// trivially, so every prohibited-import / no-arithmetic check runs against BOTH modules.

const MODULE_SRC = "src/components/estimates/wizard/pricing/useWizardPricingFromConfig.ts";
const CORE_SRC = "src/components/estimates/wizard/pricing/compute-wizard-pricing-from-config.ts";
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("14. both hook and core reject all prohibited fixture/default imports and calls", () => {
  for (const src of [MODULE_SRC, CORE_SRC]) {
    const code = codeOf(src);
    assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, `${src}: no DEFAULT_PRICING_CATALOG`);
    assert.equal(/buildWizardPricingInput(?!FromConfig)/.test(code), false, `${src}: no fixture input adapter`);
    assert.equal(/wizard-pricing-input-adapter(?!-config)/.test(code), false, `${src}: no fixture adapter path`);
    assert.equal(/useWizardPricing(?!FromConfig)/.test(code), false, `${src}: no fixture display hook`);
    assert.equal(/FIXTURE_PRESENTATION_METADATA/.test(code), false, `${src}: no fixture presentation metadata`);
    assert.equal(/wizard-catalog-fixtures/.test(code), false, `${src}: no catalog fixtures`);
    assert.equal(/wizard-manual-pricing(?!-config)/.test(code), false, `${src}: no fixture manual pricing`);
    assert.equal(/ScreensPreview/.test(code), false, `${src}: no ScreensPreview`);
    assert.equal(/production\/EstimateWizardContainer/.test(code), false, `${src}: no production container`);
  }
});

test("15. both hook and core have no arithmetic/apply/save/DB/route; hook uses useMemo; core is server-safe", () => {
  for (const src of [MODULE_SRC, CORE_SRC]) {
    const code = codeOf(src);
    // No arithmetic ownership: forwards engine numbers, never computes totals/rounding here.
    assert.equal(/calculateEstimateTotals|bodySizeMultiplier|Math\.|\.reduce\(/.test(code), false, `${src}: no arithmetic`);
    assert.equal(/buildEstimateEditorApplyPlan|wizardDraftToEditorPatch/.test(code), false, `${src}: no apply path`);
    assert.equal(/from ["'][^"']*\/save\//.test(code), false, `${src}: no save module`);
    assert.equal(/supabase|createEstimate|updateEstimate|create-estimate/.test(code), false, `${src}: no DB/save`);
    assert.equal(/next\/(navigation|router|image)|server-only/.test(code), false, `${src}: no route/server import`);
    assert.equal(/useState|useReducer|useEffect|useRef/.test(code), false, `${src}: no React state/effect`);
  }
  // The HOOK is a client component that memoizes.
  const hook = codeOf(MODULE_SRC);
  assert.equal(/useMemo/.test(hook), true, "hook uses useMemo");
  assert.match(hook, /^"use client";/, "hook declares the client boundary");
  // The CORE is server-safe: NO "use client", NO React import/hook.
  const core = codeOf(CORE_SRC);
  assert.equal(/use client/.test(core), false, "core has no \"use client\"");
  assert.equal(/from ["']react["']|useMemo|useState|useEffect/.test(core), false, "core imports no React");
  assert.match(core, /export function computeWizardPricingFromConfig/, "core owns the pure compute");
  // The hook DELEGATES to the core (imports + re-exports it).
  assert.match(hook, /from ["']\.\/compute-wizard-pricing-from-config["']/, "hook imports the core");
  assert.match(hook, /export \{ computeWizardPricingFromConfig \}/, "hook re-exports the core for compatibility");
});
