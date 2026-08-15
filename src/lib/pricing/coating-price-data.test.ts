// C2B3B1 — focused tests for the demo default coating price DATA unit.
// Proves matte-evo and cancoat-pro-evo standalone bases, their upper-layer add-ons, size scaling,
// tax-exclusivity, dealer overrides, and that no prior value changed. No multi-layer transport here.
//
// Run: node --import tsx --test src/lib/pricing/coating-price-data.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateService, DEFAULT_PRICING_CATALOG } from "./canonical-pricing-engine";
import { makePricingCatalog, dealerSettingsToPricingCatalog } from "./pricing-catalog";
import { toPricingCatalogCoatingId } from "./wizard-coating-id-adapter";
import type { ServicePriceSettings } from "@/lib/dealer-settings/dealer-settings-types";

const coatBase = (id: string, catalog = DEFAULT_PRICING_CATALOG) =>
  catalog.coatings.find((c) => c.id === id)?.base;
const standaloneLine = (coatingId: string, sizeKey: string, catalog = DEFAULT_PRICING_CATALOG) =>
  calculateService({ type: "coating", coatingId, sizeKey, optionIds: [] }, 0, catalog).subtotal;

function coatingSettings(over: {
  products?: { id: string; base_price_m: number }[];
  topcoat_prices?: Record<string, number>;
}): ServicePriceSettings {
  return {
    coating: {
      products: (over.products ?? []).map((p) => ({
        id: p.id, name: p.id, grade: "プレミアム", base_price_m: p.base_price_m, certified_only: false, active: true,
      })),
      size_multipliers: {},
      topcoat_prices: over.topcoat_prices ?? {},
      option_prices: {},
      option_names: {},
    },
  } as unknown as ServicePriceSettings;
}

// 1 & 2 — standalone M-size resolves to the authoritative base, pre-tax.
test("MATTE standalone at M-size resolves to exactly 150,000 (pre-tax)", () => {
  assert.equal(coatBase("matte-evo"), 150000);
  assert.equal(standaloneLine("matte-evo", "M"), 150000);
});
test("CANCOAT PRO standalone at M-size resolves to exactly 70,000 (pre-tax)", () => {
  assert.equal(coatBase("cancoat-evo-pro"), 70000);
  assert.equal(standaloneLine("cancoat-evo-pro", "M"), 70000);
});

// 3 & 4 — upper-layer add-on data.
test("MATTE upper-layer add-on data is exactly 25,000", () => {
  assert.equal(DEFAULT_PRICING_CATALOG.topcoatBase["matte-evo"], 25000);
});
test("CANCOAT PRO upper-layer add-on data remains exactly 25,000", () => {
  assert.equal(DEFAULT_PRICING_CATALOG.topcoatBase["cancoat-evo-pro"], 25000);
});

// 5 — non-M size uses the unchanged existing multiplier (LL = 1.5).
test("a non-M size uses the unchanged existing size multiplier", () => {
  assert.equal(DEFAULT_PRICING_CATALOG.bodySizes.find((b) => b.key === "LL")?.multi, 1.5);
  assert.equal(standaloneLine("matte-evo", "LL"), 225000); // 150000 × 1.5
  assert.equal(standaloneLine("cancoat-evo-pro", "LL"), 105000); // 70000 × 1.5
});

// 6 — tax is not embedded in the unit price.
test("tax is not embedded in the coating unit price", () => {
  assert.equal(standaloneLine("matte-evo", "M"), 150000); // not 165000
  assert.equal(standaloneLine("cancoat-evo-pro", "M"), 70000); // not 77000
});

// 7–10 — dealer overrides through the existing overlay (no new schema).
test("dealer settings override MATTE standalone base", () => {
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(coatingSettings({ products: [{ id: "matte-evo", base_price_m: 99000 }] }), null));
  assert.equal(coatBase("matte-evo", cat), 99000);
  assert.equal(standaloneLine("matte-evo", "M", cat), 99000);
});
test("dealer settings override CANCOAT PRO standalone base", () => {
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(coatingSettings({ products: [{ id: "cancoat-evo-pro", base_price_m: 88000 }] }), null));
  assert.equal(coatBase("cancoat-evo-pro", cat), 88000);
});
test("dealer settings override MATTE upper add-on", () => {
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(coatingSettings({ topcoat_prices: { "matte-evo": 31000 } }), null));
  assert.equal(cat.topcoatBase["matte-evo"], 31000);
});
test("dealer settings override CANCOAT PRO upper add-on", () => {
  const cat = makePricingCatalog(dealerSettingsToPricingCatalog(coatingSettings({ topcoat_prices: { "cancoat-evo-pro": 33000 } }), null));
  assert.equal(cat.topcoatBase["cancoat-evo-pro"], 33000);
});

// 11 — every prior coating and topcoat value is unchanged.
test("existing coating and topcoat values are unchanged", () => {
  assert.equal(coatBase("one-evo"), 45000);
  assert.equal(coatBase("cancoat-evo"), 55000);
  assert.equal(coatBase("pure-evo"), 60000);
  assert.equal(coatBase("mohs-evo"), 60000);
  assert.equal(coatBase("syncro-evo"), 110000);
  assert.equal(coatBase("infinit1"), 130000);
  assert.equal(coatBase("infinit2"), 160000);
  const t = DEFAULT_PRICING_CATALOG.topcoatBase;
  assert.equal(t["one-evo"], 15000);
  assert.equal(t["pure-evo"], 20000);
  assert.equal(t["mohs-evo"], 25000);
  assert.equal(t["cancoat-evo"], 18000);
  assert.equal(t["cancoat-evo-pro"], 25000);
  assert.equal(t["infinit1"], 130000);
  assert.equal(t["infinit2"], 160000);
  assert.equal(t["infinit-t1"], 40000);
  assert.equal(t["infinit-t2"], 50000);
});

// 12 — no fallback, zero, fixture, or substitution for the two new standalone selections.
test("no fallback / zero / substitution for the two new standalone coatings", () => {
  assert.equal(toPricingCatalogCoatingId("matte-evo"), "matte-evo");
  assert.equal(toPricingCatalogCoatingId("cancoat-pro-evo"), "cancoat-evo-pro");
  // resolves to its OWN base, not 0 and not another product's price
  assert.equal(standaloneLine("matte-evo", "M"), 150000);
  assert.notEqual(standaloneLine("matte-evo", "M"), 0);
  assert.notEqual(standaloneLine("matte-evo", "M"), coatBase("cancoat-evo"));
  assert.equal(standaloneLine("cancoat-evo-pro", "M"), 70000);
  assert.notEqual(standaloneLine("cancoat-evo-pro", "M"), 0);
});
