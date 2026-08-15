// C2B3B2 — focused tests for multi-layer coating pricing (transport + validation + calculation).
// Run: node --import tsx --test src/components/estimates/wizard/pricing/coating-multilayer-pricing.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWizardPricingInput } from "./wizard-pricing-input-adapter";
import { buildWizardPricingInputFromConfig } from "./wizard-pricing-input-adapter-config";
import { calculateService, calculateEstimate, DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import { makePricingCatalog, dealerSettingsToPricingCatalog } from "@/lib/pricing/pricing-catalog";
import { toPricingCatalogTopcoatId } from "@/lib/pricing/wizard-coating-id-adapter";
import { initialEstimateWizardDraftV22 } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ServicePriceSettings } from "@/lib/dealer-settings/dealer-settings-types";

const EMPTY_CONFIG = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
} as const;

function coatingDraft(l1: string | null, l2: string | null, l3: string | null, size = "M"): EstimateWizardDraftV22 {
  const d = structuredClone(initialEstimateWizardDraftV22);
  d.serviceSelection = { selectedCategories: ["coating"] };
  d.vehicle = { ...d.vehicle, bodySizeKey: size };
  d.serviceConfiguration.coating.layer1Id = l1;
  d.serviceConfiguration.coating.layer2Id = l2;
  d.serviceConfiguration.coating.layer3Id = l3;
  return d;
}

/** pre-tax coating subtotal via the fixture adapter → engine (DEFAULT catalog). */
function preTax(rank: ShopRank, l1: string, l2: string | null, l3: string | null, size = "M"): number {
  const bundle = buildWizardPricingInput(coatingDraft(l1, l2, l3, size), rank);
  const svc = bundle.services.find((s) => s.type === "coating");
  assert.ok(svc, `expected a coating service for ${l1}/${l2}/${l3}`);
  assert.ok(!bundle.errors.some((e) => e.category === "coating"), `unexpected coating error for ${l1}/${l2}/${l3}`);
  return calculateService(svc).subtotal;
}

// ── M-size calculation examples (pre-tax) ──────────────────────────────────────
const EXAMPLES: [string, ShopRank, string, string | null, string | null, number][] = [
  ["ONE standalone", "detailer", "one-evo", null, null, 45000],
  ["ONE + ONE", "detailer", "one-evo", "one-evo", null, 60000],
  ["ONE + CANCOAT EVO", "detailer", "one-evo", "cancoat-evo", null, 63000],
  ["ONE + CANCOAT EVO + CANCOAT EVO", "detailer", "one-evo", "cancoat-evo", "cancoat-evo", 81000],
  ["certified ONE + CANCOAT PRO", "certified", "one-evo", "cancoat-pro-evo", null, 70000],
  ["PURE + PURE", "detailer", "pure-evo", "pure-evo", null, 80000],
  ["MOHS + MOHS", "detailer", "mohs-evo", "mohs-evo", null, 85000],
  ["SYNCRO standalone", "detailer", "syncro-evo", null, null, 110000],
  ["SYNCRO + optional MOHS", "detailer", "syncro-evo", "mohs-evo", null, 135000],
  ["certified SYNCRO + CANCOAT PRO", "certified", "syncro-evo", "cancoat-pro-evo", null, 135000],
  ["MATTE standalone", "detailer", "matte-evo", null, null, 150000],
  ["MATTE + MATTE", "detailer", "matte-evo", "matte-evo", null, 175000],
  ["INFINITE BASE 1 + TOPCOAT 1", "certified", "infinite-base-1", "infinite-topcoat-1", null, 170000],
  ["INFINITE BASE 2 + TOPCOAT 2", "certified", "infinite-base-2", "infinite-topcoat-2", null, 210000],
  ["CANCOAT EVO standalone", "shop", "cancoat-evo", null, null, 55000],
  ["CANCOAT PRO standalone", "certified", "cancoat-pro-evo", null, null, 70000],
];

for (const [label, rank, l1, l2, l3, expected] of EXAMPLES) {
  test(`M-size: ${label} = ${expected}`, () => {
    assert.equal(preTax(rank, l1, l2, l3), expected);
  });
}

test("layer-3 INFINITE example: BASE 1 + TOPCOAT 1 + TOPCOAT 2 = 220000", () => {
  assert.equal(preTax("certified", "infinite-base-1", "infinite-topcoat-1", "infinite-topcoat-2"), 220000);
});

test("non-M size keeps per-line rounding (ONE+ONE at LL ×1.5 = 90000)", () => {
  assert.equal(DEFAULT_PRICING_CATALOG.bodySizes.find((b) => b.key === "LL")?.multi, 1.5);
  // round(45000×1.5)=67500 + round(15000×1.5)=22500 = 90000
  assert.equal(preTax("detailer", "one-evo", "one-evo", null, "LL"), 90000);
});

test("10% tax is added only after the tax-exclusive multi-layer subtotal", () => {
  const bundle = buildWizardPricingInput(coatingDraft("matte-evo", "matte-evo", null), "detailer");
  const result = calculateEstimate(bundle.services, { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 }, 10);
  assert.equal(result.subtotal, 175000);   // pre-tax
  assert.equal(result.taxAmount, 17500);   // floor(175000 × 10%)
  assert.equal(result.total, 192500);      // subtotal + tax
});

// ── Dealer overrides (config path uses the merged catalog) ────────────────────
function coatingSettings(over: { products?: { id: string; base_price_m: number }[]; topcoat_prices?: Record<string, number> }): ServicePriceSettings {
  return {
    coating: {
      products: (over.products ?? []).map((p) => ({ id: p.id, name: p.id, grade: "プレミアム", base_price_m: p.base_price_m, certified_only: false, active: true })),
      size_multipliers: {}, topcoat_prices: over.topcoat_prices ?? {}, option_prices: {}, option_names: {},
    },
  } as unknown as ServicePriceSettings;
}
function configPreTax(rank: ShopRank, l1: string, l2: string | null, catalog: ReturnType<typeof makePricingCatalog>): number {
  const bundle = buildWizardPricingInputFromConfig(coatingDraft(l1, l2, null), EMPTY_CONFIG, catalog, rank);
  const svc = bundle.services.find((s) => s.type === "coating");
  assert.ok(svc, "expected a coating service");
  return calculateService(svc, 0, catalog).subtotal;
}

test("dealer override changes layer2/layer3 totals (base + topcoat overrides)", () => {
  const def = makePricingCatalog();
  assert.equal(configPreTax("detailer", "one-evo", "cancoat-evo", def), 63000); // default 45000 + 18000
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(
    coatingSettings({ products: [{ id: "one-evo", base_price_m: 50000 }], topcoat_prices: { "cancoat-evo": 20000 } }), null));
  assert.equal(configPreTax("detailer", "one-evo", "cancoat-evo", cat), 70000); // 50000 base + 20000 topcoat
});

test("an explicit dealer value of zero is honoured, not replaced by the default", () => {
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(
    coatingSettings({ products: [{ id: "matte-evo", base_price_m: 0 }] }), null));
  assert.equal(cat.coatings.find((c) => c.id === "matte-evo")?.base, 0);
});

// ── Fail-closed validation (no partial coating price) ─────────────────────────
function failsClosed(rank: ShopRank, l1: string, l2: string | null, l3: string | null): void {
  const bundle = buildWizardPricingInput(coatingDraft(l1, l2, l3), rank);
  assert.ok(!bundle.services.some((s) => s.type === "coating"), `should NOT price coating for ${rank}/${l1}/${l2}/${l3}`);
  assert.ok(bundle.errors.some((e) => e.category === "coating"), `expected a coating error for ${rank}/${l1}/${l2}/${l3}`);
}

test("CANCOAT EVO over MATTE fails closed", () => failsClosed("detailer", "matte-evo", "cancoat-evo", null));
test("CANCOAT PRO over CANCOAT EVO fails closed", () => failsClosed("certified", "cancoat-evo", "cancoat-pro-evo", null));
test("CANCOAT PRO upper for a non-certified (detailer) rank fails closed", () => failsClosed("detailer", "one-evo", "cancoat-pro-evo", null));
test("layer-3 without layer-2 fails closed", () => failsClosed("detailer", "one-evo", null, "cancoat-evo"));
test("ppf_installer cannot price coating (fails closed)", () => failsClosed("ppf_installer", "one-evo", null, null));
test("INFINITE BASE for a non-certified (detailer) rank fails closed", () => failsClosed("detailer", "infinite-base-1", null, null));

test("without a shopRank, upper layers stay MULTI_LAYER_NOT_MAPPED and layer-1 is priced", () => {
  const bundle = buildWizardPricingInput(coatingDraft("one-evo", "cancoat-evo", null)); // no rank
  const svc = bundle.services.find((s) => s.type === "coating") as { coatingId: string; topcoat2?: string } | undefined;
  assert.ok(svc, "layer-1 should still price");
  assert.equal(svc?.coatingId, "one-evo");
  assert.equal(svc?.topcoat2, undefined); // upper NOT transported without rank
  assert.ok(bundle.warnings.some((w) => w.code === "MULTI_LAYER_NOT_MAPPED"));
});

test("topcoat translation never maps syncro-evo as an upper layer", () => {
  assert.equal(toPricingCatalogTopcoatId("syncro-evo"), null);
  assert.equal(toPricingCatalogTopcoatId("cancoat-pro-evo"), "cancoat-evo-pro");
  assert.equal(toPricingCatalogTopcoatId("infinite-topcoat-1"), "infinit-t1");
});
