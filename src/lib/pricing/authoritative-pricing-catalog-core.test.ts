// EW-UI-4A2-1 — Strict authoritative PricingCatalog core tests (pure, DB-free, DI).
//
// Exercises every operational failure branch, the valid-null semantics, malformed rejection, valid
// override behavior, legacy pricing parity, input immutability, and type/security guards. The
// server wrapper is NEVER runtime-imported here (it is `server-only`); only its TYPE is referenced
// via `typeof import(...)`, which is erased at runtime, plus a source-text read for guards.
//
// Run: node --import tsx --test src/lib/pricing/authoritative-pricing-catalog-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveAuthoritativePricingCatalog,
  type PricingCatalogResolution,
  type PricingSettingsReadResult,
  type PricingCatalogResolverDeps,
} from "./authoritative-pricing-catalog-core";
import {
  DEFAULT_PRICING_CATALOG,
  makePricingCatalog,
  dealerSettingsToPricingCatalog,
  type PricingCatalog,
} from "./pricing-catalog";
import type { ServicePriceSettings, PpfPriceTables } from "@/lib/dealer-settings/dealer-settings-types";
import { DEFAULT_SERVICE_PRICE_SETTINGS, DEFAULT_PPF_PRICE_TABLES } from "@/lib/dealer-settings/dealer-settings-defaults";

// ── DI helpers ───────────────────────────────────────────────────────────────────

const DEALER = "dealer-1";

function deps(over: Partial<PricingCatalogResolverDeps>): PricingCatalogResolverDeps {
  return {
    getDealerId: async () => DEALER,
    readPricingSettings: async () => ({ ok: true, row: null }),
    ...over,
  };
}
function rowDeps(spc: unknown, ppf: unknown): PricingCatalogResolverDeps {
  return deps({ readPricingSettings: async (): Promise<PricingSettingsReadResult> => ({ ok: true, row: { service_price_settings: spc, ppf_price_tables: ppf } }) });
}
const resolveRow = (spc: unknown, ppf: unknown) => resolveAuthoritativePricingCatalog(rowDeps(spc, ppf));

// ── valid representative fixtures (subset overrides of real catalog ids) ─────────

const VALID_SPC = {
  coating: {
    products: [{ id: "one-evo", name: "ONE EVO", grade: "エントリー", base_price_m: 47000, certified_only: false, active: true }],
    size_multipliers: { M: 1.05 },
    topcoat_prices: { "one-evo": 16000 },
    option_prices: { polish: 31000 },
    option_names: { polish: "ハードポリッシュ" }, // extra label map — ignored
  },
  ppf: { active: true, plan_labels: { "full-body": "フルボディ" } },
  window_film: { base_prices: { "wf-all": 81000 }, grade_coeff: { premium: 1.35 } },
  maintenance: { menus: [{ id: "A", name: "メンテA", price: 5500 }] },
  carwash: { menus: [{ id: "cw-hand", name: "手洗い", price: 3100 }] },
  room_cleaning: { base_prices: { "rc-full": 46000 }, condition_coeff: { dirty: 1.35 } },
};
const VALID_PPF = {
  plan_prices: { "front-half_M": 175000 },
  film_coeff: { matte: 1.35 },
  rank_coeff: { premium: 1.35 },
  glass_prices: { ppf: 82000 },
  parts_prices: { "sp-headlight": 26000 },
};
const VALID_PPF_R1 = {
  contractVersion: "1.0",
  frontFullPricesBySize: { SS: 100000, S: 110000, M: 120000, ML: 130000, L: 140000, LL: 150000, XL: null },
  fullBodyPricesBySize: { SS: 400000, S: 450000, M: 500000, ML: 550000, L: 600000, LL: 650000, XL: 700000 },
  partialPartPrices: { bonnet: 40000, "front-bumper": 50000, "door-mirror": 0 },
};

// deep clones for mutation-based malformed fixtures (JSON drops undefined / cannot hold NaN — those
// cases are built inline).
const cloneSpc = () => JSON.parse(JSON.stringify(VALID_SPC));
const clonePpf = () => JSON.parse(JSON.stringify(VALID_PPF));

// ── V3.4 coating fixture (GDA_COATING_V3_4_C2_5_R2) ───────────────────────────────
//
// The authoritative resolver now accepts ONLY V34_READY coating data (see
// authoritative-pricing-catalog-core.ts). VALID_SPC.coating above is deliberately kept in its
// original LEGACY shape — every malformed-rejection test above mutates that exact shape, and all
// of them still correctly expect `{ ok: false, reason: "malformed" }` under the new contract (a
// well-formed legacy payload is now ALSO not V34_READY, so it fails closed too). Only the tests
// that expect a SUCCESSFUL resolution (2c, 3k, 4a, 4b, 4c, 4d) need a real V3.4 coating payload,
// built here, so they exercise the accepted seven-size direct-price contract: SS/S/M/ML/L/LL/XL;
// base/layer2/layer3 fully independent; null = unavailable; 0 = a valid confirmed-free price.
const V34_SEVEN_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"] as const;

function v34SizeMap(m: Partial<Record<(typeof V34_SEVEN_SIZES)[number], number | null>>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const s of V34_SEVEN_SIZES) out[s] = s in m ? (m[s] as number | null) : null;
  return out;
}

const VALID_COATING_V34 = {
  contractVersion: "3.4",
  baseProducts: [
    {
      productId: "one-evo",
      active: true,
      pricesBySize: v34SizeMap({ SS: 40000, S: 43000, M: 47000, ML: 51000, L: 55000, LL: 60000, XL: 66000 }),
    },
  ],
  layer2Products: [
    {
      productId: "one-evo",
      active: true,
      layer2PricesBySize: v34SizeMap({ SS: 12000, S: 13000, M: 16000, ML: 18000, L: 20000, LL: 22000, XL: 24000 }),
    },
  ],
  layer3Products: [],
  option_prices: { polish: 31000 },
  option_names: { polish: "ハードポリッシュ" },
};

const EMPTY_COATING_V34 = {
  contractVersion: "3.4",
  baseProducts: [],
  layer2Products: [],
  layer3Products: [],
  option_prices: {},
  option_names: {},
};

function withCoatingV34(spc: typeof VALID_SPC, coating: unknown = VALID_COATING_V34) {
  return { ...spc, coating };
}

const okCatalog = (r: PricingCatalogResolution): PricingCatalog => {
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("unreachable");
  return r.catalog;
};

// ── 1. Operational failure branches ───────────────────────────────────────────────

test("1. operational failures map to the exact reason and carry no catalog", async () => {
  const noDealer = await resolveAuthoritativePricingCatalog(deps({ getDealerId: async () => null }));
  const blank = await resolveAuthoritativePricingCatalog(deps({ getDealerId: async () => "   " }));
  const dealerThrows = await resolveAuthoritativePricingCatalog(deps({ getDealerId: async () => { throw new Error("x"); } }));
  const readFalse = await resolveAuthoritativePricingCatalog(deps({ readPricingSettings: async () => ({ ok: false }) }));
  const readThrows = await resolveAuthoritativePricingCatalog(deps({ readPricingSettings: async () => { throw new Error("x"); } }));
  const rowNull = await resolveAuthoritativePricingCatalog(deps({ readPricingSettings: async () => ({ ok: true, row: null }) }));

  assert.deepEqual(noDealer, { ok: false, reason: "no-dealer" });
  assert.deepEqual(blank, { ok: false, reason: "no-dealer" });
  assert.deepEqual(dealerThrows, { ok: false, reason: "read-failed" });
  assert.deepEqual(readFalse, { ok: false, reason: "read-failed" });
  assert.deepEqual(readThrows, { ok: false, reason: "read-failed" });
  assert.deepEqual(rowNull, { ok: false, reason: "no-row" });
  for (const r of [noDealer, blank, dealerThrows, readFalse, readThrows, rowNull]) {
    assert.equal("catalog" in r, false, "failure carries no catalog");
  }
});

test("1b. no-dealer short-circuits before readPricingSettings is called", async () => {
  let called = false;
  const r = await resolveAuthoritativePricingCatalog({
    getDealerId: async () => "",
    readPricingSettings: async () => { called = true; return { ok: true, row: null }; },
  });
  assert.deepEqual(r, { ok: false, reason: "no-dealer" });
  assert.equal(called, false, "read must not run without a dealer");
});

// ── 2. Valid null semantics ────────────────────────────────────────────────────────

test("2a. both columns null → exact canonical default catalog", async () => {
  const cat = okCatalog(await resolveRow(null, null));
  assert.deepEqual(cat, DEFAULT_PRICING_CATALOG);
});

test("2b. service null + valid PPF → default service pricing plus PPF overrides", async () => {
  const cat = okCatalog(await resolveRow(null, VALID_PPF));
  assert.deepEqual(cat.coatings, DEFAULT_PRICING_CATALOG.coatings, "coating stays default");
  assert.deepEqual(cat.maintenanceMenus, DEFAULT_PRICING_CATALOG.maintenanceMenus, "menus stay default");
  assert.equal(cat.ppfFrontGlass.find((g) => g.id === "ppf")?.price, 82000, "ppf glass overridden");
  assert.deepEqual(cat, makePricingCatalog(dealerSettingsToPricingCatalog(null, VALID_PPF as PpfPriceTables)));
});

test("2c. valid service + PPF null → service overrides plus default PPF", async () => {
  const spc = withCoatingV34(VALID_SPC);
  const cat = okCatalog(await resolveRow(spc, null));
  assert.deepEqual(cat.ppfPlanPrices, DEFAULT_PRICING_CATALOG.ppfPlanPrices, "ppf tables stay default");
  assert.deepEqual(cat.coatingV34, VALID_COATING_V34, "coating is sourced from the V3.4 direct-price contract");
  const legacy = makePricingCatalog(dealerSettingsToPricingCatalog(spc as unknown as ServicePriceSettings, null));
  assert.deepEqual({ ...cat, coatingV34: null }, legacy, "every other family still matches the legacy overlay exactly");
});

test("2d. versioned PPF R1 resolves into its dedicated authority without legacy fallback", async () => {
  const cat = okCatalog(await resolveRow(null, VALID_PPF_R1));
  assert.deepEqual(cat.ppfR1, VALID_PPF_R1);
  assert.deepEqual(cat.ppfPlanPrices, DEFAULT_PRICING_CATALOG.ppfPlanPrices);
  assert.equal(cat.ppfR1?.frontFullPricesBySize.M, 120000);
  assert.equal(cat.ppfR1?.fullBodyPricesBySize.M, 500000);
  assert.equal(cat.ppfR1?.partialPartPrices["front-bumper"], 50000);
});

// ── 3. Malformed rejection ─────────────────────────────────────────────────────────

async function assertMalformed(spc: unknown, ppf: unknown, label: string) {
  const r = await resolveRow(spc, ppf);
  assert.deepEqual(r, { ok: false, reason: "malformed" }, label);
}

test("3. malformed stored values are rejected (never coerced to defaults)", async () => {
  const clone = () => JSON.parse(JSON.stringify(VALID_SPC));
  // undefined selected column
  await assertMalformed(undefined, VALID_PPF, "undefined service column");
  await assertMalformed(VALID_SPC, undefined, "undefined ppf column");
  // array / non-object columns
  await assertMalformed([], VALID_PPF, "array service column");
  await assertMalformed("x", VALID_PPF, "string service column");
  await assertMalformed(VALID_SPC, 5, "number ppf column");
  // missing required section / container
  { const s = clone(); delete s.room_cleaning; await assertMalformed(s, VALID_PPF, "missing room_cleaning section"); }
  { const s = clone(); delete s.coating.products; await assertMalformed(s, VALID_PPF, "missing coating.products container"); }
  { const p = JSON.parse(JSON.stringify(VALID_PPF)); delete p.parts_prices; await assertMalformed(VALID_SPC, p, "missing ppf container"); }
  // wrong nested type
  { const s = clone(); s.coating.size_multipliers = [1, 2]; await assertMalformed(s, VALID_PPF, "array in map position"); }
  // numeric string
  { const s = clone(); s.coating.products[0].base_price_m = "47000"; await assertMalformed(s, VALID_PPF, "numeric string price"); }
  // boolean
  { const s = clone(); s.coating.products[0].base_price_m = true; await assertMalformed(s, VALID_PPF, "boolean price"); }
  // NaN / Infinity (survive as raw values, not via JSON)
  { const s = clone(); s.coating.products[0].base_price_m = NaN; await assertMalformed(s, VALID_PPF, "NaN price"); }
  { const s = clone(); s.coating.products[0].base_price_m = Infinity; await assertMalformed(s, VALID_PPF, "Infinity price"); }
  // negative price
  { const s = clone(); s.coating.products[0].base_price_m = -1; await assertMalformed(s, VALID_PPF, "negative price"); }
  // zero / negative coefficient
  { const s = clone(); s.coating.size_multipliers = { M: 0 }; await assertMalformed(s, VALID_PPF, "zero coefficient"); }
  { const s = clone(); s.coating.size_multipliers = { M: -1 }; await assertMalformed(s, VALID_PPF, "negative coefficient"); }
  // duplicate item ids (products + menus)
  { const s = clone(); s.coating.products.push({ id: "one-evo", base_price_m: 1 }); await assertMalformed(s, VALID_PPF, "duplicate product id"); }
  { const s = clone(); s.maintenance.menus.push({ id: "A", price: 1 }); await assertMalformed(s, VALID_PPF, "duplicate menu id"); }
});

test("3b. a hostile throwing getter returns malformed, never throws, never defaults", async () => {
  const hostileRow = {
    ppf_price_tables: VALID_PPF,
    get service_price_settings(): unknown { throw new Error("boom"); },
  };
  let r!: PricingCatalogResolution;
  await assert.doesNotReject(async () => {
    r = await resolveAuthoritativePricingCatalog(deps({
      readPricingSettings: async () => ({ ok: true, row: hostileRow }),
    }));
  });
  assert.deepEqual(r, { ok: false, reason: "malformed" });
});

// ── 3c. The five independently reproduced false-success cases (R40B-F1) ──────────

test("3c. the five reproduced false-success cases now resolve to malformed", async () => {
  const c1 = cloneSpc(); delete c1.coating.products[0].active;
  await assertMalformed(c1, VALID_PPF, "missing product.active");

  const c2 = cloneSpc(); c2.maintenance.menus = [{ id: "A" }];
  await assertMalformed(c2, VALID_PPF, "maintenance menu with only { id }");

  const c3 = cloneSpc(); delete c3.coating.option_names;
  await assertMalformed(c3, VALID_PPF, "missing coating.option_names");

  const c4 = cloneSpc(); c4.ppf.active = "yes";
  await assertMalformed(c4, VALID_PPF, "ppf.active = \"yes\"");

  const p5 = clonePpf(); p5.plan_prices = { "front-half_": 175000 };
  await assertMalformed(VALID_SPC, p5, "plan_prices key \"front-half_\"");
});

// ── 3d. Complete stored schema — products, menus, labels, maps ────────────────────

test("3d. product schema is required in full (name/grade/certified_only/active)", async () => {
  const missName = cloneSpc(); delete missName.coating.products[0].name;
  await assertMalformed(missName, VALID_PPF, "missing product.name");
  const badGrade = cloneSpc(); badGrade.coating.products[0].grade = 5;
  await assertMalformed(badGrade, VALID_PPF, "wrong product.grade type");
  const badCert = cloneSpc(); badCert.coating.products[0].certified_only = "no";
  await assertMalformed(badCert, VALID_PPF, "wrong product.certified_only type");
  const missCert = cloneSpc(); delete missCert.coating.products[0].certified_only;
  await assertMalformed(missCert, VALID_PPF, "missing product.certified_only");
});

test("3e. menu items require id, non-blank name, and a numeric price", async () => {
  const missId = cloneSpc(); missId.maintenance.menus = [{ name: "X", price: 1 }];
  await assertMalformed(missId, VALID_PPF, "missing menu id");
  const missName = cloneSpc(); missName.carwash.menus = [{ id: "cw-hand", price: 1 }];
  await assertMalformed(missName, VALID_PPF, "missing menu name");
  const missPrice = cloneSpc(); missPrice.maintenance.menus = [{ id: "A", name: "X" }];
  await assertMalformed(missPrice, VALID_PPF, "missing menu price");
  const strPrice = cloneSpc(); strPrice.maintenance.menus = [{ id: "A", name: "X", price: "5" }];
  await assertMalformed(strPrice, VALID_PPF, "string menu price");
});

test("3f. whitespace-only ids and names are malformed", async () => {
  const wsProdId = cloneSpc(); wsProdId.coating.products[0].id = "   ";
  await assertMalformed(wsProdId, VALID_PPF, "whitespace product id");
  const wsMenuId = cloneSpc(); wsMenuId.maintenance.menus = [{ id: "  ", name: "X", price: 1 }];
  await assertMalformed(wsMenuId, VALID_PPF, "whitespace menu id");
  const wsMenuName = cloneSpc(); wsMenuName.maintenance.menus = [{ id: "A", name: "  ", price: 1 }];
  await assertMalformed(wsMenuName, VALID_PPF, "whitespace menu name");
});

test("3g. coating.option_names and ppf labels are required string maps", async () => {
  const missNames = cloneSpc(); delete missNames.coating.option_names;
  await assertMalformed(missNames, VALID_PPF, "missing option_names");
  const numName = cloneSpc(); numName.coating.option_names = { polish: 5 };
  await assertMalformed(numName, VALID_PPF, "non-string option_names value");
  const numLabel = cloneSpc(); numLabel.ppf.plan_labels = { "full-body": 5 };
  await assertMalformed(numLabel, VALID_PPF, "non-string plan_labels value");
  const missActive = cloneSpc(); delete missActive.ppf.active;
  await assertMalformed(missActive, VALID_PPF, "missing ppf.active");
});

test("3h. invalid values under UNKNOWN ids are rejected in every map class", async () => {
  const svcCoeff = cloneSpc(); svcCoeff.coating.size_multipliers = { M: 1.05, "future-size": -1 };
  await assertMalformed(svcCoeff, VALID_PPF, "unknown-id negative coefficient (service)");
  const svcPrice = cloneSpc(); svcPrice.coating.topcoat_prices = { "one-evo": 16000, "future-tc": -5 };
  await assertMalformed(svcPrice, VALID_PPF, "unknown-id negative price (service)");
  const winGrade = cloneSpc(); winGrade.window_film.grade_coeff = { premium: 1.3, "future-grade": 0 };
  await assertMalformed(winGrade, VALID_PPF, "unknown-id zero coefficient (window)");
  const ppfPrice = clonePpf(); ppfPrice.parts_prices = { "sp-headlight": 26000, "future-part": -1 };
  await assertMalformed(VALID_SPC, ppfPrice, "unknown-id negative price (ppf)");
  const ppfCoeff = clonePpf(); ppfCoeff.film_coeff = { matte: 1.35, "future-film": 0 };
  await assertMalformed(VALID_SPC, ppfCoeff, "unknown-id zero coefficient (ppf)");
});

test("3i. an explicit undefined value inside a stored map is malformed", async () => {
  const spc = cloneSpc(); spc.coating.topcoat_prices = { "one-evo": undefined };
  await assertMalformed(spc, VALID_PPF, "undefined map value");
});

test("3j. invalid PPF plan_prices keys are rejected", async () => {
  for (const key of ["front-half_", "_M", "front-half"]) {
    const p = clonePpf(); p.plan_prices = { [key]: 175000 };
    await assertMalformed(VALID_SPC, p, `plan key "${key}"`);
  }
});

// ── 3k. The canonical stored defaults are themselves valid ────────────────────────

test("3k. DEFAULT_SERVICE_PRICE_SETTINGS + DEFAULT_PPF_PRICE_TABLES resolve successfully", async () => {
  const spc = { ...DEFAULT_SERVICE_PRICE_SETTINGS, coating: EMPTY_COATING_V34 };
  const cat = okCatalog(await resolveRow(spc, DEFAULT_PPF_PRICE_TABLES));
  assert.deepEqual(cat.coatingV34, EMPTY_COATING_V34, "coating is sourced from the V3.4 direct-price contract");
  const legacy = makePricingCatalog(
    dealerSettingsToPricingCatalog(spc as unknown as ServicePriceSettings, DEFAULT_PPF_PRICE_TABLES),
  );
  assert.deepEqual(
    { ...cat, coatingV34: null },
    legacy,
    "strict result matches legacy for the canonical defaults outside the V3.4 coating authority",
  );
});

// ── 4. Valid behavior ──────────────────────────────────────────────────────────────

test("4a. partial overrides keep every non-overridden canonical entry at its default", async () => {
  const spc = withCoatingV34(VALID_SPC);
  const cat = okCatalog(await resolveRow(spc, VALID_PPF));
  const otherOption = DEFAULT_PRICING_CATALOG.coatingOptions.find((o) => o.id !== "polish");
  assert.ok(otherOption, "fixture sanity: a second coating option exists");
  assert.equal(cat.coatingOptions.find((o) => o.id === "polish")?.price, VALID_COATING_V34.option_prices.polish, "overridden");
  assert.equal(
    cat.coatingOptions.find((o) => o.id === otherOption!.id)?.price,
    otherOption!.price,
    "non-overridden retains default",
  );
});

test("4b. an explicit zero price is valid", async () => {
  const zeroCoating = {
    ...VALID_COATING_V34,
    baseProducts: [
      {
        productId: "one-evo",
        active: true,
        pricesBySize: v34SizeMap({ SS: 40000, S: 43000, M: 0, ML: 51000, L: 55000, LL: 60000, XL: 66000 }),
      },
    ],
  };
  const spc = withCoatingV34(VALID_SPC, zeroCoating);
  const cat = okCatalog(await resolveRow(spc, VALID_PPF));
  assert.equal(
    cat.coatingV34?.baseProducts.find((p) => p.productId === "one-evo")?.pricesBySize.M,
    0,
    "an explicit zero is a valid, real price — never treated as unavailable",
  );
});

test("4c. every consumed pricing family is mapped exactly", async () => {
  const spc = withCoatingV34(VALID_SPC);
  const c = okCatalog(await resolveRow(spc, VALID_PPF));
  const base = c.coatingV34?.baseProducts.find((p) => p.productId === "one-evo");
  const layer2 = c.coatingV34?.layer2Products.find((p) => p.productId === "one-evo");
  assert.equal(base?.pricesBySize.M, 47000, "base price selected by exact size, no multiplier");
  assert.equal(layer2?.layer2PricesBySize.M, 16000, "layer2 price independent of base — no cross-layer sharing");
  assert.equal(c.coatingV34?.layer3Products.length, 0, "layer3 stays unconfigured — never falls back to layer2");
  assert.equal(c.coatingOptions.find((x) => x.id === "polish")?.price, 31000);
  assert.equal(c.windowParts.find((x) => x.id === "wf-all")?.basePrice, 81000);
  assert.equal(c.windowGrades.find((x) => x.id === "premium")?.coeff, 1.35);
  assert.equal(c.maintenanceMenus.find((x) => x.id === "A")?.price, 5500);
  assert.equal(c.maintenanceMenus.find((x) => x.id === "A")?.name, "メンテA");
  assert.equal(c.carwashMenus.find((x) => x.id === "cw-hand")?.price, 3100);
  assert.equal(c.roomCleanParts.find((x) => x.id === "rc-full")?.basePrice, 46000);
  assert.equal(c.roomCleanConditions.find((x) => x.id === "dirty")?.coeff, 1.35);
  assert.equal(c.ppfPlanPrices["front-half"]["M"], 175000);
  assert.equal(c.ppfFilmTypes.find((x) => x.id === "matte")?.coeff, 1.35);
  assert.equal(c.ppfVehicleRanks.find((x) => x.id === "premium")?.coeff, 1.35);
  assert.equal(c.ppfFrontGlass.find((x) => x.id === "ppf")?.price, 82000);
  assert.equal(c.ppfSingleParts.find((x) => x.id === "sp-headlight")?.price, 26000);
});

test("4d. a valid representative input matches legacy pricing output exactly", async () => {
  const spc = withCoatingV34(VALID_SPC);
  const strict = okCatalog(await resolveRow(spc, VALID_PPF));
  const legacy = makePricingCatalog(
    dealerSettingsToPricingCatalog(spc as unknown as ServicePriceSettings, VALID_PPF as unknown as PpfPriceTables),
  );
  assert.deepEqual(strict.coatingV34, VALID_COATING_V34, "coating is sourced from the V3.4 contract, not the legacy overlay");
  assert.deepEqual({ ...strict, coatingV34: null }, legacy, "every other family still matches the legacy overlay exactly");
});

test("4e. input objects are not mutated by resolution", async () => {
  const s = JSON.parse(JSON.stringify(VALID_SPC));
  const p = JSON.parse(JSON.stringify(VALID_PPF));
  const sSnap = JSON.stringify(s);
  const pSnap = JSON.stringify(p);
  await resolveRow(s, p);
  assert.equal(JSON.stringify(s), sSnap, "service input unchanged");
  assert.equal(JSON.stringify(p), pSnap, "ppf input unchanged");
});

// ── 5. Type / security guards ──────────────────────────────────────────────────────

// The wrapper's TYPE only — `typeof import(...)` is erased at runtime, so `server-only` never runs.
type WrapperFn = typeof import("./get-authoritative-dealer-pricing-catalog")["getAuthoritativeDealerPricingCatalog"];
const _wrapperTakesNoArgs: Parameters<WrapperFn> extends [] ? true : false = true;

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CORE_SRC = "src/lib/pricing/authoritative-pricing-catalog-core.ts";
const WRAPPER_SRC = "src/lib/pricing/get-authoritative-dealer-pricing-catalog.ts";

test("5a. the strict core references no prohibited legacy provider or service-role client", () => {
  const code = codeOf(CORE_SRC);
  assert.equal(/getCanonicalDealerSettings/.test(code), false, "no canonical settings");
  assert.equal(/getDealerPricingCatalog/.test(code), false, "no fail-open catalog provider");
  assert.equal(/dealerSettingsToPricingCatalog/.test(code), false, "no silent-fallback converter");
  assert.equal(/service_role|SERVICE_ROLE/.test(code), false, "no service-role client");
});

test("5b. the server wrapper is least-privilege (no select(*), no service-role, no dealer-id arg)", () => {
  assert.equal(_wrapperTakesNoArgs, true);
  const code = codeOf(WRAPPER_SRC);
  assert.equal(/select\(\s*["'`]\*/.test(code), false, "no select(*)");
  assert.equal(/service_role|SERVICE_ROLE/.test(code), false, "no service-role client");
  assert.match(code, /getAuthoritativeDealerPricingCatalog\(\s*\)\s*:/, "public function takes zero args");
  assert.match(code, /\.maybeSingle\(\)/, "uses maybeSingle");
  assert.match(code, /select\(\s*["'`]service_price_settings,\s*ppf_price_tables["'`]\s*\)/, "selects exactly the two columns");
  assert.match(code, /getCurrentDealer/, "derives dealer server-side");
  assert.equal(/getCanonicalDealerSettings|getDealerPricingCatalog|dealerSettingsToPricingCatalog/.test(code), false, "no fail-open provider");
});

test("5c. no failure resolution ever exposes a catalog field", async () => {
  const failures = [
    await resolveAuthoritativePricingCatalog(deps({ getDealerId: async () => null })),
    await resolveAuthoritativePricingCatalog(deps({ readPricingSettings: async () => ({ ok: false }) })),
    await resolveAuthoritativePricingCatalog(deps({ readPricingSettings: async () => ({ ok: true, row: null }) })),
    await resolveRow([], VALID_PPF),
  ];
  for (const r of failures) {
    assert.equal(r.ok, false);
    assert.equal("catalog" in r, false);
  }
});
