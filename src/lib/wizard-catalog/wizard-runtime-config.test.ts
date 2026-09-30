// C2C2 — DI unit tests for the pure Wizard runtime config resolver (no database).
// Run: node --import tsx --test src/lib/wizard-catalog/wizard-runtime-config.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { resolveWizardRuntimeConfig, resolveWizardRuntimeConfigForDealer, type WizardCatalogRow, type WizardConfigReaders, type WizardDealerBoundConfigReaders, type WizardLifecycleRow } from "./wizard-runtime-config";
import { DEFAULT_PRICING_CATALOG, makePricingCatalog } from "@/lib/pricing/canonical-pricing-engine";
import type { PricingCatalogResolution } from "@/lib/pricing/authoritative-pricing-catalog-core";
import { buildWizardPricingInputFromConfig } from "@/components/estimates/wizard/pricing/wizard-pricing-input-adapter-config";
import { initialEstimateWizardDraftV22, resetWizardDraft } from "@/components/estimates/wizard/draft/wizard-draft-state";
import type { ShopRank, OtherCoatingMenu } from "@/components/estimates/wizard/screens/step-types";
import type { WizardScreenConfiguration } from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import type { ProductionOtherCoatingMenuOption } from "@/components/estimates/wizard/pricing/wizard-manual-pricing-config";

const DEALER = "d0000000-0000-0000-0000-000000000001";
const ALL: ShopRank[] = ["shop", "detailer", "ppf_installer", "certified"];
const PPF_RANKS: ShopRank[] = ["detailer", "ppf_installer", "certified"];
const WIN_RANKS: ShopRank[] = ["detailer", "certified"];

function row(p: Partial<WizardCatalogRow> & Pick<WizardCatalogRow, "kind" | "code" | "owner_scope">): WizardCatalogRow {
  return {
    id: `${p.kind}:${p.code}`, market: "jp", product_mode: "gyeon", dealer_id: p.owner_scope === "dealer" ? DEALER : null,
    label_ja: p.code, display_order: 0, is_active: true, default_unit_price: null, priceable: true,
    quantity_required: false, min_quantity: 1, max_quantity: null, ppf_type_group_id: null, duration_minutes: null,
    deleted_at: null, presentation: {}, ranks: ALL, categories: [], ...p,
  };
}
function globals(): WizardCatalogRow[] {
  const win = ["front-windshield", "front-door-glass", "rear-door-glass", "triangular-window", "quarter-glass", "rear-glass", "sunroof"]
    .map((c) => row({ kind: "window_area", code: c, owner_scope: "global", ranks: WIN_RANKS, categories: ["window"] }));
  const meth = ["full", "partial", "windshield", "sunroof", "interior"]
    .map((c) => row({ kind: "ppf_method", code: c, owner_scope: "global", ranks: PPF_RANKS, categories: ["ppf"] }));
  const part = Array.from({ length: 16 }, (_, i) => row({ kind: "ppf_part", code: `part-${i}`, owner_scope: "global", ranks: PPF_RANKS, categories: ["ppf"] }));
  const parents = ["group-gloss", "group-matte", "group-color"].map((c) => row({ kind: "ppf_type_group", code: c, owner_scope: "global", ranks: PPF_RANKS, categories: ["ppf"], id: `g:${c}` }));
  const prods = Array.from({ length: 8 }, (_, i) => row({
    kind: "ppf_type_group", code: `prod-${i}`, owner_scope: "global", ranks: PPF_RANKS,
    categories: ["ppf"], ppf_type_group_id: "g:group-gloss",
    install_coefficient_bp: i === 0 ? 12_500 : null,
  }));
  return [...win, ...meth, ...part, ...parents, ...prods]; // 7+5+16+3+8 = 39
}
function menus(): WizardCatalogRow[] {
  return [
    row({ kind: "maintenance_menu", code: "maint-a", owner_scope: "dealer", label_ja: "メンテA", default_unit_price: 5000, categories: ["maintenance"], presentation: { legacyId: "A" } }),
    row({ kind: "maintenance_menu", code: "maint-b", owner_scope: "dealer", label_ja: "メンテA", default_unit_price: 8000, categories: ["maintenance"], presentation: { legacyId: "B" } }), // duplicate label
    row({ kind: "wash_menu", code: "cw-hand", owner_scope: "dealer", label_ja: "手洗い", default_unit_price: 0, categories: ["carwash"] }),
  ];
}
const REVIEWED: WizardLifecycleRow = { state: "CATALOG_REVIEWED", current_configuration_revision: 3, reviewed_configuration_revision: 3, reviewed_at: "t" };

function readers(over: Partial<{ dealer: { dealer_id: string } | null; rank: ShopRank | null; lifecycle: { ok: boolean; row: WizardLifecycleRow | null }; rows: WizardCatalogRow[]; catalog: PricingCatalogResolution | (() => Promise<PricingCatalogResolution>); offerings: { ok: boolean; enabled?: boolean } }>): WizardConfigReaders {
  return {
    getDealer: async () => (over.dealer !== undefined ? over.dealer : { dealer_id: DEALER }),
    getRank: async () => (over.rank === null ? { ok: false, reason: "missing" } : { ok: true, rank: over.rank ?? "shop" }),
    // The strict provider returns a discriminated result; default is a successful DEFAULT catalog.
    getCatalog: async () => {
      const c = over.catalog;
      if (c === undefined) return { ok: true, catalog: DEFAULT_PRICING_CATALOG };
      return typeof c === "function" ? c() : c;
    },
    getLifecycle: async () => (over.lifecycle ? (over.lifecycle.ok ? { ok: true, row: over.lifecycle.row } : { ok: false }) : { ok: true, row: REVIEWED }),
    getCatalogRows: async () => ({ ok: true, rows: over.rows ?? [...globals(), ...menus()] }),
    // B2-E2G — the service-offering map. Defaults to ALL FAMILIES ON so the pre-existing assertions
    // keep exercising the same catalog projection they always did; the opt-in is varied explicitly
    // only where it is the thing under test.
    getServiceOfferings: async () => {
      if (over.offerings && !over.offerings.ok) return { ok: false };
      const on = over.offerings?.enabled ?? true;
      return {
        ok: true,
        offerings: { window_film: on, ppf: on, maintenance: on, room_cleaning: on, car_wash: on },
      };
    },
  };
}

/** Wrap readers so getCatalog calls can be counted (proves earlier gates short-circuit before it). */
function withCatalogSpy(base: WizardConfigReaders, spy: { calls: number }): WizardConfigReaders {
  return { ...base, getCatalog: async () => { spy.calls += 1; return base.getCatalog(); } };
}

const PRICING_FAILED = { ok: false, reason: "pricing-catalog-failed" } as const;

// ── Trust boundary + top-level failures ──────────────────────────────────────
test("resolver takes only readers (no dealer id / rank / config argument)", () => {
  assert.equal(resolveWizardRuntimeConfig.length, 1);
});
test("no dealer → no-dealer", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ dealer: null })), { ok: false, reason: "no-dealer" }));
test("rank failure → rank-unavailable", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: null })), { ok: false, reason: "rank-unavailable" }));
test("lifecycle read failure → lifecycle-read-failed", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: false, row: null } })), { ok: false, reason: "lifecycle-read-failed" }));
test("lifecycle missing → lifecycle-missing", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: true, row: null } })), { ok: false, reason: "lifecycle-missing" }));

// ── Lifecycle enforcement ────────────────────────────────────────────────────
const lc = (o: Partial<WizardLifecycleRow>): WizardLifecycleRow => ({ ...REVIEWED, ...o });
test("MIGRATED_UNREVIEWED → review-required", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: true, row: lc({ state: "MIGRATED_UNREVIEWED", reviewed_configuration_revision: null, reviewed_at: null }) } })), { ok: false, reason: "review-required" }));
test("LEGACY → review-required", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: true, row: lc({ state: "LEGACY", reviewed_configuration_revision: null, reviewed_at: null }) } })), { ok: false, reason: "review-required" }));
test("missing reviewed_at → review-required", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: true, row: lc({ reviewed_at: null }) } })), { ok: false, reason: "review-required" }));
test("revision mismatch → revision-mismatch", async () => assert.deepEqual(await resolveWizardRuntimeConfig(readers({ lifecycle: { ok: true, row: lc({ reviewed_configuration_revision: 2 }) } })), { ok: false, reason: "revision-mismatch" }));
test("CATALOG_ACTIVE + equal revisions → ok", async () => assert.equal((await resolveWizardRuntimeConfig(readers({ rank: "shop", lifecycle: { ok: true, row: lc({ state: "CATALOG_ACTIVE" }) } }))).ok, true));

// ── Global catalog validation ────────────────────────────────────────────────
test("exact 7/5/16/11 globals accepted (shop)", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop" }));
  assert.equal(r.ok, true);
});
test("missing a required global → missing-required-globals", async () => {
  const rows = [...globals().filter((g) => g.code !== "sunroof" || g.kind !== "window_area"), ...menus()];
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "shop", rows })), { ok: false, reason: "missing-required-globals" });
});
test("duplicate code → duplicate-code", async () => {
  const rows = [...globals(), ...menus(), row({ kind: "maintenance_menu", code: "maint-a", owner_scope: "dealer", categories: ["maintenance"] })];
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "shop", rows })), { ok: false, reason: "duplicate-code" });
});
test("malformed row (inactive) → malformed-catalog-row", async () => {
  const rows = [...globals(), ...menus().map((m, i) => (i === 0 ? { ...m, is_active: false } : m))];
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "shop", rows })), { ok: false, reason: "malformed-catalog-row" });
});
test("invalid rank/category (>1 category) → invalid-rank-category", async () => {
  const rows = [...globals(), ...menus().map((m, i) => (i === 0 ? { ...m, categories: ["maintenance", "coating"] } : m))];
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "shop", rows })), { ok: false, reason: "invalid-rank-category" });
});

// ── Dealer families + configuration output ──────────────────────────────────
test("shop success: maintenance/wash resolved by immutable code; label change does not move identity; coupons empty", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop" }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const m = r.screenConfig.maintenanceMenus;
  assert.deepEqual(m.map((x) => x.id).sort(), ["maint-a", "maint-b"]); // stable codes, not labels
  assert.ok(m.every((x) => x.name === "メンテA")); // duplicate labels tolerated, distinct ids
  assert.equal(r.screenConfig.washMenus[0]?.id, "cw-hand");
  assert.deepEqual(r.screenConfig.coupons, []); // coupons unsupported
  assert.deepEqual(r.screenConfig.filmTypes, []); // no dealer film types
  assert.deepEqual(r.screenConfig.windowAreas, []); // shop cannot sell window film → rank-filtered
});
test("changed label keeps the same identity", async () => {
  const rows = [...globals(), ...menus().map((m) => ({ ...m, label_ja: "RENAMED" }))];
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", rows }));
  assert.ok(r.ok && r.screenConfig.maintenanceMenus.some((x) => x.id === "maint-a"));
});
test("dealer work presets and store options reach the estimate runtime; store options default to every category", async () => {
  const rows = [
    ...globals(),
    ...menus(),
    row({ kind: "other_work_preset", code: "other-polish", owner_scope: "dealer", label_ja: "ハードポリッシュ", categories: ["other"] }),
    row({ kind: "store_global_option", code: "store-trip", owner_scope: "dealer", label_ja: "出張費", default_unit_price: 15000, categories: [] }),
  ];
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", rows }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherWorkPresets.map((x) => x.name), ["ハードポリッシュ"]);
  assert.deepEqual(r.screenConfig.storeGlobalOptions, [{
    id: "store-trip",
    name: "出張費",
    defaultPrice: 15000,
    editableUnitPrice: false,
    quantityRequired: false,
    minQty: 1,
    maxQty: undefined,
    appliesToAllCategories: true,
    displayOrder: 0,
  }]);
});
// B2-E2B — this test previously asserted the OPPOSITE: that an eligible rank with window areas but
// no registered film types failed the ENTIRE wizard. That behaviour is removed. An absent optional
// product line is a configuration state, not a defect, so the runtime now succeeds and window film
// alone becomes unavailable, gated in the live Step-4 host.
test("certified with window areas but no film types SUCCEEDS with an empty film list", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "certified" }));
  assert.ok(r.ok, "an absent optional product line must not fail the whole wizard");
  assert.deepEqual(r.screenConfig.filmTypes, [], "carried through empty — never defaulted, never seeded");
  assert.ok(r.screenConfig.windowAreas.length > 0, "window areas still resolve");
});

// ── B2-E2E: the window-film opt-in ───────────────────────────────────────────
test("the service-offering map is carried through verbatim, and RANK never affects it", async () => {
  for (const rank of ["shop", "detailer", "ppf_installer", "certified"] as const) {
    const on = await resolveWizardRuntimeConfig(readers({ rank, offerings: { ok: true, enabled: true } }));
    assert.ok(on.ok, `${rank}: opted-in dealer resolves`);
    assert.deepEqual(
      on.screenConfig.serviceOfferings,
      { window_film: true, ppf: true, maintenance: true, room_cleaning: true, car_wash: true },
      `${rank}: opted-in map carried through unchanged`,
    );

    const off = await resolveWizardRuntimeConfig(readers({ rank, offerings: { ok: true, enabled: false } }));
    assert.ok(off.ok, `${rank}: opted-OUT dealer still resolves — opting out never fails the wizard`);
    assert.deepEqual(
      off.screenConfig.serviceOfferings,
      { window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
      `${rank}: opted-out map carried through unchanged`,
    );
  }
});

test("an UNREADABLE service-offering map fails closed and is never coerced to all-OFF", async () => {
  // The distinction that matters: every family `false` is a dealer's choice and resolves ok; a
  // failed READ is not a choice, and reporting it as "opted out" would hide every configured
  // service behind what looks like a deliberate setting, with nothing anywhere to surface it.
  assert.deepEqual(
    await resolveWizardRuntimeConfig(readers({ rank: "detailer", offerings: { ok: false } })),
    { ok: false, reason: "service-offerings-read-failed" },
  );
});
test("malformed film presentation → malformed-catalog-row", async () => {
  const film = row({ kind: "film_type", code: "film-x", owner_scope: "dealer", ranks: WIN_RANKS, categories: ["window"], presentation: { vlt: 15 } }); // number, not string
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "certified", rows: [...globals(), ...menus(), film] })), { ok: false, reason: "malformed-catalog-row" });
});
test("certified with a valid film type succeeds; PPF groups build parent→product graph", async () => {
  const film = row({ kind: "film_type", code: "film-x", owner_scope: "dealer", ranks: WIN_RANKS, categories: ["window"], presentation: { brand: "GYEON", vlt: "15%" } });
  const r = await resolveWizardRuntimeConfig(readers({ rank: "certified", rows: [...globals(), ...menus(), film] }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.screenConfig.filmTypes[0]?.id, "film-x");
  assert.equal(r.screenConfig.filmTypes[0]?.brand, "GYEON");
  assert.equal(r.screenConfig.windowAreas.length, 7);
  assert.equal(r.screenConfig.ppfMethods.length, 5);
  const gloss = r.screenConfig.ppfTypeGroups.find((g) => g.id === "group-gloss");
  assert.equal(gloss?.products.length, 8); // all 8 products parented to gloss in this fixture
  assert.equal(gloss?.products.find((p) => p.id === "prod-0")?.coefficientDisplay, "×1.25");
  assert.deepEqual(r.pricingConfig.ppfTypes?.find((p) => p.code === "prod-0"), { code: "prod-0", label: "prod-0" });
  assert.equal(r.pricingConfig.installCoefficientBpByCode?.["prod-0"], 12_500);
});

// ── Config accepted by the production pricing adapter ────────────────────────
test("resolved pricingConfig is accepted by buildWizardPricingInputFromConfig (manual maintenance line)", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop" }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const d = structuredClone(initialEstimateWizardDraftV22);
  d.serviceSelection = { selectedCategories: ["maintenance"] };
  d.serviceConfiguration.bodyMaintenance = { menuId: "maint-a", unitPriceInput: "5000" };
  const out = buildWizardPricingInputFromConfig(d, r.pricingConfig, r.catalog, r.shopRank);
  assert.ok(!out.errors.some((e) => e.code === "UNKNOWN_CONFIGURED_ITEM"), "maint-a resolves via the resolved pricingConfig");
});

// ── EW-UI-4A2-2: fail-closed authoritative pricing catalog wiring ────────────────

test("every strict provider failure reason collapses to pricing-catalog-failed (no internal reason leaked)", async () => {
  for (const reason of ["no-dealer", "read-failed", "no-row", "malformed"] as const) {
    const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", catalog: { ok: false, reason } }));
    assert.deepEqual(r, PRICING_FAILED, `provider ${reason} → pricing-catalog-failed`);
  }
});

test("a thrown getCatalog reader returns pricing-catalog-failed", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", catalog: () => { throw new Error("boom"); } }));
  assert.deepEqual(r, PRICING_FAILED);
});

test("a pricing-catalog failure carries no catalog / screenConfig / pricingConfig", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", catalog: { ok: false, reason: "read-failed" } }));
  assert.equal(r.ok, false);
  assert.equal("catalog" in r, false);
  assert.equal("screenConfig" in r, false);
  assert.equal("pricingConfig" in r, false);
});

test("catalog failure short-circuits BEFORE buildConfigs (a would-be build failure is not reached)", async () => {
  // B2-E2B: the former probe (certified + no film types) no longer fails, so this uses a MALFORMED
  // film presentation instead — the remaining build-time failure, still raised only inside
  // buildConfigs and therefore still able to prove the ordering.
  const film = row({ kind: "film_type", code: "film-x", owner_scope: "dealer", ranks: WIN_RANKS, categories: ["window"], presentation: { vlt: 15 } }); // number, not string
  const rows = [...globals(), ...menus(), film];
  const buildFailure = await resolveWizardRuntimeConfig(readers({ rank: "certified", rows }));
  assert.deepEqual(buildFailure, { ok: false, reason: "malformed-catalog-row" }, "build-time failure visible on catalog success");
  // …but a catalog failure returns first, so pricing-catalog-failed wins.
  const catFailure = await resolveWizardRuntimeConfig(readers({ rank: "certified", rows, catalog: { ok: false, reason: "malformed" } }));
  assert.deepEqual(catFailure, PRICING_FAILED, "catalog failure returns before buildConfigs");
});

test("a successful catalog is transported losslessly (exact reference + value)", async () => {
  const DISTINCT = makePricingCatalog({
    coatings: DEFAULT_PRICING_CATALOG.coatings.map((c) => (c.id === "one-evo" ? { ...c, base: 123456 } : c)),
  });
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop", catalog: { ok: true, catalog: DISTINCT } }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.catalog, DISTINCT, "exact same object reference — never cloned/rebuilt/defaulted");
  assert.equal(r.catalog.coatings.find((c) => c.id === "one-evo")?.base, 123456, "distinctive value unchanged");
});

test("getCatalog is NOT called when an earlier gate fails; called exactly once on success", async () => {
  const missingGlobals = [...globals().filter((g) => !(g.code === "sunroof" && g.kind === "window_area")), ...menus()];
  const earlyFailures: Parameters<typeof readers>[0][] = [
    { dealer: null },                                   // no dealer
    { rank: null },                                     // rank failure
    { lifecycle: { ok: false, row: null } },            // lifecycle failure
    { rank: "shop", rows: missingGlobals },             // global-validation failure
  ];
  for (const over of earlyFailures) {
    const spy = { calls: 0 };
    await resolveWizardRuntimeConfig(withCatalogSpy(readers(over), spy));
    assert.equal(spy.calls, 0, `getCatalog must not run for ${JSON.stringify(over)}`);
  }
  const spy = { calls: 0 };
  const r = await resolveWizardRuntimeConfig(withCatalogSpy(readers({ rank: "shop" }), spy));
  assert.equal(r.ok, true);
  assert.equal(spy.calls, 1, "read exactly once on the success path");
});

// ── Source guards: strict wiring in the server wrapper; legacy fail-open consumers unchanged ──
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("server wrapper wires the strict provider only (no fail-open provider / default / service-role)", () => {
  const code = codeOf("src/lib/wizard-catalog/get-authoritative-wizard-runtime-config.ts");
  assert.match(code, /import\s*\{\s*getAuthoritativeDealerPricingCatalog\s*\}\s*from\s*["']@\/lib\/pricing\/get-authoritative-dealer-pricing-catalog["']/, "imports the strict provider");
  assert.match(code, /getCatalog:\s*getAuthoritativeDealerPricingCatalog/, "wires the strict provider");
  assert.equal(/getDealerPricingCatalog/.test(code), false, "no fail-open provider reference");
  assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, "no default catalog");
  assert.equal(/service_role|SERVICE_ROLE/.test(code), false, "no service-role client");
});

test("the remaining legacy fail-open consumers still reference getDealerPricingCatalog", () => {
  for (const p of [
    "src/lib/pricing/get-dealer-pricing-catalog.ts",
    "src/lib/wizard-catalog/get-estimate-wizard-settings-view.ts",
  ]) {
    assert.match(readFileSync(p, "utf8"), /getDealerPricingCatalog/, `${p} keeps its fail-open provider`);
  }
});

// ── EW-UI-5A1-B3-P0: dealer identity in the result + the dealer-bound resolver ──

const OTHER_DEALER = "d0000000-0000-0000-0000-0000000000ff";

test("a success carries the EXACT dealer id the resolver used", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ rank: "shop" }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.dealerId, DEALER, "the dealer every read was scoped to");
});

test("the success dealerId tracks the injected dealer, never a constant", async () => {
  const base = readers({ rank: "shop" });
  const rows = [...globals(), ...menus().map((m) => ({ ...m, dealer_id: OTHER_DEALER }))];
  const r = await resolveWizardRuntimeConfig({
    ...base,
    getDealer: async () => ({ dealer_id: OTHER_DEALER }),
    getCatalogRows: async () => ({ ok: true, rows }),
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.dealerId, OTHER_DEALER);
});

test("a failure carries no dealerId", async () => {
  const r = await resolveWizardRuntimeConfig(readers({ dealer: null }));
  assert.equal(r.ok, false);
  assert.equal("dealerId" in r, false);
});

/** Dealer-bound readers that record the tenant each one received. */
function boundReaders(
  over: Partial<{ rank: ShopRank | null; lifecycle: { ok: boolean; row: WizardLifecycleRow | null }; rows: WizardCatalogRow[]; catalog: PricingCatalogResolution }>,
  seen: { rank: string[]; catalog: string[]; lifecycle: string[]; rows: string[]; offerings: string[] },
): WizardDealerBoundConfigReaders {
  return {
    getRank: async (d) => { seen.rank.push(d); return over.rank === null ? { ok: false, reason: "missing" } : { ok: true, rank: over.rank ?? "shop" }; },
    getCatalog: async (d) => { seen.catalog.push(d); return over.catalog ?? { ok: true, catalog: DEFAULT_PRICING_CATALOG }; },
    getLifecycle: async (d) => { seen.lifecycle.push(d); return over.lifecycle ? (over.lifecycle.ok ? { ok: true, row: over.lifecycle.row } : { ok: false }) : { ok: true, row: REVIEWED }; },
    getCatalogRows: async (d) => { seen.rows.push(d); return { ok: true, rows: over.rows ?? [...globals(), ...menus()] }; },
    // B2-E2H1-F — the offerings reader was missing here, which made every dealer-bound test resolve
    // `service-offerings-read-failed`. It is RECORDED in `seen` like every other reader, not merely
    // supplied: these tests exist to prove one constant tenant reaches EVERY reader, and a reader
    // absent from that proof is exactly how this gap survived being written.
    getServiceOfferings: async (d) => {
      seen.offerings.push(d);
      return {
        ok: true,
        offerings: { window_film: true, ppf: true, maintenance: true, room_cleaning: true, car_wash: true },
      };
    },
  };
}
const newSeen = () => ({
  rank: [] as string[], catalog: [] as string[], lifecycle: [] as string[],
  rows: [] as string[], offerings: [] as string[],
});

test("resolveWizardRuntimeConfigForDealer takes the tenant explicitly (dealerId, readers)", () => {
  assert.equal(resolveWizardRuntimeConfigForDealer.length, 2);
});

test("ONE constant dealerId reaches rank, catalog, lifecycle, catalog-row AND offerings readers", async () => {
  const seen = newSeen();
  const r = await resolveWizardRuntimeConfigForDealer(DEALER, boundReaders({ rank: "shop" }, seen));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.dealerId, DEALER, "the result reports the bound tenant");
  assert.deepEqual(seen.rank, [DEALER], "rank read for the bound tenant only");
  assert.deepEqual(seen.catalog, [DEALER], "pricing catalog read for the bound tenant only");
  assert.deepEqual(seen.lifecycle, [DEALER], "lifecycle read for the bound tenant only");
  assert.deepEqual(seen.rows, [DEALER], "catalog rows read for the bound tenant only");
  assert.deepEqual(seen.offerings, [DEALER], "service offerings read for the bound tenant only");
  const every = [...seen.rank, ...seen.catalog, ...seen.lifecycle, ...seen.rows, ...seen.offerings];
  assert.equal(new Set(every).size, 1, "exactly one distinct tenant across every reader");
});

test("a different bound dealer propagates to every reader", async () => {
  const seen = newSeen();
  const rows = [...globals(), ...menus().map((m) => ({ ...m, dealer_id: OTHER_DEALER }))];
  const r = await resolveWizardRuntimeConfigForDealer(OTHER_DEALER, boundReaders({ rank: "shop", rows }, seen));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.dealerId, OTHER_DEALER);
  assert.equal(new Set([...seen.rank, ...seen.catalog, ...seen.lifecycle, ...seen.rows, ...seen.offerings]).size, 1);
  assert.deepEqual(seen.rows, [OTHER_DEALER]);
});

test("a row owned by ANOTHER dealer fails closed (malformed-catalog-row)", async () => {
  const seen = newSeen();
  // Resolving for DEALER, but one dealer-owned row belongs to OTHER_DEALER.
  const rows = [...globals(), ...menus(), row({ kind: "maintenance_menu", code: "foreign", owner_scope: "dealer", dealer_id: OTHER_DEALER, categories: ["maintenance"] })];
  const r = await resolveWizardRuntimeConfigForDealer(DEALER, boundReaders({ rank: "shop", rows }, seen));
  assert.deepEqual(r, { ok: false, reason: "malformed-catalog-row" }, "a foreign row is never admitted");
});

test("a global row bearing a dealer_id fails closed", async () => {
  const seen = newSeen();
  const rows = [...globals().map((g, i) => (i === 0 ? { ...g, dealer_id: OTHER_DEALER } : g)), ...menus()];
  const r = await resolveWizardRuntimeConfigForDealer(DEALER, boundReaders({ rank: "shop", rows }, seen));
  assert.deepEqual(r, { ok: false, reason: "malformed-catalog-row" });
});

test("a blank/whitespace/non-string dealerId fails closed as no-dealer, before ANY reader runs", async () => {
  for (const bad of ["", "   ", "\t"]) {
    const seen = newSeen();
    const r = await resolveWizardRuntimeConfigForDealer(bad, boundReaders({ rank: "shop" }, seen));
    assert.deepEqual(r, { ok: false, reason: "no-dealer" }, `blank id ${JSON.stringify(bad)} → no-dealer`);
    assert.deepEqual([...seen.rank, ...seen.catalog, ...seen.lifecycle, ...seen.rows], [], "no reader may run without a tenant");
  }
});

test("dealer-bound rank / catalog / lifecycle / row failures all remain fail-closed", async () => {
  const cases: Array<[string, Parameters<typeof boundReaders>[0], string]> = [
    ["rank", { rank: null }, "rank-unavailable"],
    ["lifecycle read", { rank: "shop", lifecycle: { ok: false, row: null } }, "lifecycle-read-failed"],
    ["lifecycle missing", { rank: "shop", lifecycle: { ok: true, row: null } }, "lifecycle-missing"],
    ["pricing catalog", { rank: "shop", catalog: { ok: false, reason: "malformed" } }, "pricing-catalog-failed"],
  ];
  for (const [name, over, reason] of cases) {
    const seen = newSeen();
    const r = await resolveWizardRuntimeConfigForDealer(DEALER, boundReaders(over, seen));
    assert.deepEqual(r, { ok: false, reason }, `${name} failure → ${reason}`);
    assert.equal("catalog" in r, false, `${name} failure carries no catalog`);
    assert.equal("dealerId" in r, false, `${name} failure carries no dealerId`);
  }
});

test("a catalog-row read failure is fail-closed", async () => {
  const seen = newSeen();
  const base = boundReaders({ rank: "shop" }, seen);
  const r = await resolveWizardRuntimeConfigForDealer(DEALER, { ...base, getCatalogRows: async () => ({ ok: false }) });
  assert.deepEqual(r, { ok: false, reason: "catalog-read-failed" });
});

test("the pure resolver holds no default/fixture/client tenant or catalog", () => {
  const code = codeOf("src/lib/wizard-catalog/wizard-runtime-config.ts");
  assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, "no default catalog");
  assert.equal(/EXAMPLE_|FIXTURE|fixture|makePricingCatalog/.test(code), false, "no fixture/catalog construction");
  assert.equal(/service_role|SERVICE_ROLE/.test(code), false, "no service-role client");
  assert.equal(/@\/lib\/supabase|createClient/.test(code), false, "the core stays database-free");
});

// ── Source guard: the dealer-bound server wrapper ────────────────────────────
const BOUND_WRAPPER_SRC = "src/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer.ts";

test("the dealer-bound server wrapper is server-only and uses the supplied actor context", () => {
  const code = codeOf(BOUND_WRAPPER_SRC);
  assert.match(code, /^\s*import\s+["']server-only["']/, "must begin with import \"server-only\"");
  assert.match(code, /EstimateSaveActorContext/, "accepts the branded actor context");
  assert.match(code, /context\.dealerId/, "uses the actor context as the tenant authority");
  assert.match(code, /resolveWizardRuntimeConfigForDealer\s*\(/, "delegates to the dealer-bound pure resolver");
  assert.match(code, /runtime\.dealerId\s*!==\s*tenantId/, "asserts the resolved identity before succeeding");
});

test("the dealer-bound server wrapper never re-discovers a tenant", () => {
  const code = codeOf(BOUND_WRAPPER_SRC);
  assert.equal(/\bgetCurrentDealer\b/.test(code), false, "no current-dealer discovery");
  assert.equal(/\bgetCurrentStaff\b/.test(code), false, "no current-staff discovery");
  assert.equal(/\bgetAuthoritativeShopRank\b/.test(code), false, "no arg-less rank wrapper");
  assert.equal(/\bgetAuthoritativeDealerPricingCatalog\b/.test(code), false, "no arg-less catalog wrapper");
  assert.match(code, /resolveAuthoritativeShopRank\s*\(/, "calls the PURE rank core instead");
  assert.match(code, /resolveAuthoritativePricingCatalog\s*\(/, "calls the PURE pricing core instead");
});

test("the dealer-bound server wrapper uses no service-role/secret client and no default catalog", () => {
  const code = codeOf(BOUND_WRAPPER_SRC);
  assert.equal(/service_role|SERVICE_ROLE|serviceRole/.test(code), false, "no service-role client");
  assert.equal(/SUPABASE_SERVICE|SECRET_KEY|createAdminClient/.test(code), false, "no secret/admin client");
  assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, "no default catalog");
  assert.equal(/getDealerPricingCatalog/.test(code), false, "no fail-open provider");
  assert.match(code, /createClient\s*\(\s*\)/, "uses the normal authenticated client");
});

test("the dealer-bound server wrapper scopes every read to the bound tenant", () => {
  const code = codeOf(BOUND_WRAPPER_SRC);
  assert.match(code, /eq\(\s*["']dealer_id["']\s*,\s*dealerId\s*\)/, "lifecycle scoped by the bound tenant");
  assert.match(code, /dealer_id\.is\.null,dealer_id\.eq\.\$\{dealerId\}/, "catalog rows: required globals + this dealer only");
});

test("B1.1-B2: the production dealer-bound wrapper supplies the Japan business date", () => {
  const code = codeOf(BOUND_WRAPPER_SRC);
  assert.match(code, /Intl\.DateTimeFormat\(\s*["']en-CA["']/, "uses a deterministic ISO-style formatter");
  assert.match(code, /timeZone:\s*["']Asia\/Tokyo["']/, "coupon validity uses the Japan business day");
  assert.match(code, /getCalculationDate:\s*businessCalculationDate/, "threads that date into the authoritative runtime");
});

test("the arg-less server wrapper is UNCHANGED by this candidate", () => {
  const code = codeOf("src/lib/wizard-catalog/get-authoritative-wizard-runtime-config.ts");
  assert.match(code, /getDealer:\s*getCurrentDealer/, "still wires the current-dealer discovery");
  assert.match(code, /getRank:\s*getAuthoritativeShopRank/, "still wires the arg-less rank wrapper");
  assert.equal(/EstimateSaveActorContext/.test(code), false, "not migrated in this candidate");
});

// ── B1.1-B2: coupon / coefficient / adjustment projection ────────────────────

const ADJ = {
  id: "adj-1", dealer_id: DEALER, ppf_method_code: "full", coating_code: "pure-evo",
  adjustment_type: "amount", adjustment_value: 30_000, is_active: true, deleted_at: null,
};

function couponRow(over: Partial<WizardCatalogRow> = {}): WizardCatalogRow {
  return row({
    kind: "coupon", code: "coupon-a", owner_scope: "dealer", label_ja: "新規ご来店",
    coupon_discount_type: "amount", coupon_discount_value: 5000, coupon_combinable: true,
    coupon_valid_from: null, coupon_valid_to: null, ...over,
  });
}

/**
 * `readers()` defaults the dealer rank to "shop". PPF rows carry PPF_RANKS, which excludes "shop",
 * so a PPF fixture is rank-filtered out unless the reader's rank is one that may sell PPF. The
 * `rank` parameter exists for exactly that: without it the coefficient assertions below silently
 * exercised nothing.
 */
async function resolveWith(
  rows: WizardCatalogRow[],
  over: Partial<WizardConfigReaders> = {},
  rank: ShopRank = "shop",
) {
  return resolveWizardRuntimeConfig({ ...readers({ rows, rank }), ...over });
}

test("B1.1-B2: dealer coupons project into screenConfig and pricingConfig", async () => {
  const r = await resolveWith([...globals(), ...menus(), couponRow()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.screenConfig.coupons.length, 1);
  assert.equal(r.screenConfig.coupons[0].id, "coupon:coupon-a");
  assert.equal(r.pricingConfig.coupons?.length, 1);
  assert.equal(
    r.screenConfig.coupons[0].id,
    r.pricingConfig.coupons?.[0].couponId,
    "the selectable UI identity must exactly match the authoritative pricing identity",
  );
  assert.equal(r.pricingConfig.coupons?.[0].code, "coupon-a", "the editable code remains a separate snapshot field");
  assert.deepEqual(r.pricingConfig.coupons?.[0].value, { kind: "amount", amountYen: 5000 });
});

test("B1.1-B2: Step 5 exposes only coupons usable on the server business date", async () => {
  const rows = [
    ...globals(), ...menus(),
    couponRow({ id: "coupon:open", code: "coupon-open", coupon_valid_from: null, coupon_valid_to: null }),
    couponRow({ id: "coupon:current", code: "coupon-current", coupon_valid_from: "2026-07-26", coupon_valid_to: "2026-07-26" }),
    couponRow({ id: "coupon:expired", code: "coupon-expired", coupon_valid_from: "2026-07-01", coupon_valid_to: "2026-07-25" }),
    couponRow({ id: "coupon:future", code: "coupon-future", coupon_valid_from: "2026-07-27", coupon_valid_to: null }),
  ];
  const r = await resolveWith(rows, { getCalculationDate: () => "2026-07-26" });
  assert.equal(r.ok, true);
  if (!r.ok) return;

  assert.deepEqual(
    r.screenConfig.coupons.map((coupon) => coupon.id),
    ["coupon:current", "coupon:open"],
    "expired and future coupons must not be selectable in the estimate wizard",
  );
  assert.deepEqual(
    r.pricingConfig.coupons?.map((coupon) => coupon.couponId),
    ["coupon:current", "coupon:expired", "coupon:future", "coupon:open"],
    "the authoritative authored set remains available to pricing for validation and audit",
  );
});

test("B1.1-B2: without a valid business date only undated coupons are safe to expose", async () => {
  const rows = [
    ...globals(), ...menus(),
    couponRow({ id: "coupon:open", code: "coupon-open", coupon_valid_from: null, coupon_valid_to: null }),
    couponRow({ id: "coupon:bounded", code: "coupon-bounded", coupon_valid_from: "2026-07-01", coupon_valid_to: "2026-07-31" }),
  ];
  for (const calculationDate of ["", "not-a-date", "2026-02-30"]) {
    const r = await resolveWith(rows, { getCalculationDate: () => calculationDate });
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    assert.deepEqual(r.screenConfig.coupons.map((coupon) => coupon.id), ["coupon:open"]);
  }
});

test("B1.1-B2: a percent coupon is converted from 0–100 to BASIS POINTS exactly once", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    couponRow({ coupon_discount_type: "percent", coupon_discount_value: 10 }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // 10 (percent, as 103 stores it) → 1000bp for the pricing engine.
  assert.deepEqual(r.pricingConfig.coupons?.[0].value, { kind: "percent", basisPoints: 1000 });
  // The screen keeps the AUTHORED unit, so the operator sees 10%, not 1000.
  assert.equal(r.screenConfig.coupons[0].discountValue, 10);
});

test("B1.1-B2: a malformed or out-of-range coupon row fails closed", async () => {
  for (const bad of [
    { coupon_discount_type: null },
    { coupon_discount_type: "ratio" },
    { coupon_discount_value: null },
    { coupon_discount_value: -1 },
    { coupon_discount_value: 1.5 },
    { coupon_discount_type: "percent", coupon_discount_value: 101 },
    { coupon_valid_from: "2026-02-30" },
    { coupon_valid_to: "2027-02-29" },
    { coupon_valid_from: "2026-08-01", coupon_valid_to: "2026-07-01" },
  ] as Partial<WizardCatalogRow>[]) {
    const r = await resolveWith([...globals(), ...menus(), couponRow(bad)]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed-coupon-row");
  }
});

// Every assertion below runs at rank "ppf_installer" — the one rank that is eligible for PPF
// WITHOUT also being eligible for window film.
//
// The rank matters because at "shop" the PPF fixture row is rank-filtered away entirely and the
// assertions would silently exercise nothing. "ppf_installer" keeps the PPF projection isolated.
//
// B2-E2B: "detailer" would now ALSO work — the fixture carries no dealer film_type row, which used
// to make buildConfigs fail closed with `window-film-no-film-types` before any PPF assertion ran.
// That precondition is gone. The rank is left at "ppf_installer" because these assertions are about
// the PPF projection and changing them here would widen this phase beyond its scope.
const PPF_RANK: ShopRank = "ppf_installer";

test("B1.1-B2: a valid PPF install coefficient projects, keyed by CODE", async () => {
  const r = await resolveWith(
    [
      ...globals(), ...menus(),
      row({ kind: "ppf_type_group", code: "ppf-custom", owner_scope: "dealer", ranks: PPF_RANKS, categories: ["ppf"], install_coefficient_bp: 12_500 }),
    ],
    {},
    PPF_RANK,
  );
  assert.equal(r.ok, true, "the fixture must resolve, not be rank-filtered away");
  if (!r.ok) return;
  assert.equal(r.pricingConfig.installCoefficientBpByCode?.["ppf-custom"], 12_500);
});

test("B1.1-B2: a PPF row WITHOUT a coefficient contributes no key (absent, not zero)", async () => {
  const r = await resolveWith(
    [
      ...globals(), ...menus(),
      row({ kind: "ppf_type_group", code: "ppf-plain", owner_scope: "dealer", ranks: PPF_RANKS, categories: ["ppf"] }),
    ],
    {},
    PPF_RANK,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal("ppf-plain" in (r.pricingConfig.installCoefficientBpByCode ?? {}), false);
});

test("B1.1-B2: an invalid PPF install coefficient fails closed", async () => {
  for (const bad of [0, -1, 1.5]) {
    const r = await resolveWith(
      [
        ...globals(), ...menus(),
        row({ kind: "ppf_type_group", code: "ppf-bad", owner_scope: "dealer", ranks: PPF_RANKS, categories: ["ppf"], install_coefficient_bp: bad }),
      ],
      {},
      PPF_RANK,
    );
    assert.equal(r.ok, false, `coefficient ${bad} must be refused, not silently ignored`);
    if (!r.ok) assert.equal(r.reason, "malformed-catalog-row");
  }
});

test("B1.1-B2: adjustment rules project; an absent reader means simply no rules", async () => {
  const none = await resolveWith([...globals(), ...menus()]);
  assert.equal(none.ok, true);
  if (none.ok) assert.deepEqual(none.pricingConfig.ppfCoatingAdjustments, []);

  const some = await resolveWith([...globals(), ...menus()], {
    getPpfCoatingAdjustments: async () => ({ ok: true, rows: [ADJ] }),
  });
  assert.equal(some.ok, true);
  if (some.ok) {
    assert.equal(some.pricingConfig.ppfCoatingAdjustments?.length, 1);
    assert.equal(some.pricingConfig.ppfCoatingAdjustments?.[0].ruleId, "adj-1");
  }
});

test("B1.1-B2: a FAILED adjustment read is fail-closed, never treated as 'no rules'", async () => {
  const r = await resolveWith([...globals(), ...menus()], {
    getPpfCoatingAdjustments: async () => ({ ok: false }),
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "adjustments-read-failed");

  const thrown = await resolveWith([...globals(), ...menus()], {
    getPpfCoatingAdjustments: async () => { throw new Error("boom"); },
  });
  assert.equal(thrown.ok, false);
  if (!thrown.ok) assert.equal(thrown.reason, "adjustments-read-failed");
});

test("B1.1-B2: an adjustment row belonging to ANOTHER dealer is refused", async () => {
  const r = await resolveWith([...globals(), ...menus()], {
    getPpfCoatingAdjustments: async () => ({ ok: true, rows: [{ ...ADJ, dealer_id: "d0000000-0000-0000-0000-0000000000ff" }] }),
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "malformed-adjustment-row");
});

test("B1.1-B2: a malformed adjustment row is refused", async () => {
  for (const bad of [
    { adjustment_type: "ratio" },
    { adjustment_value: -1 },
    { adjustment_value: 1.5 },
    { ppf_method_code: "Full Coat" },
    { coating_code: "" },
  ]) {
    const r = await resolveWith([...globals(), ...menus()], {
      getPpfCoatingAdjustments: async () => ({ ok: true, rows: [{ ...ADJ, ...bad }] }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed-adjustment-row");
  }
});

test("B1.1-B2: the calculation date reaches pricingConfig (no clock is read in the core)", async () => {
  const r = await resolveWith([...globals(), ...menus()], {
    getCalculationDate: () => "2026-07-26",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.pricingConfig.calculationDate, "2026-07-26");
});

test("B1.1-B2: the dealer-bound entry binds the adjustment reader to the SAME tenant", async () => {
  const seen: string[] = [];
  const base = readers({ rows: [...globals(), ...menus()] });
  const bound: WizardDealerBoundConfigReaders = {
    getRank: () => base.getRank(),
    getCatalog: () => base.getCatalog(),
    getLifecycle: (d) => base.getLifecycle(d),
    getCatalogRows: (d) => base.getCatalogRows(d),
    // B2-E2H1-RF — the offerings reader was omitted here, so the dealer-bound entry called an
    // absent reader and this test never reached its adjustment proof. It is bound to the SAME
    // tenant `seen` records: asserting `d` inside the reader keeps offerings inside this test's
    // one-tenant proof without changing what the tracker below is expected to contain.
    getServiceOfferings: async (d) => {
      assert.equal(d, DEALER, "the offerings reader receives the SAME bound tenant");
      return base.getServiceOfferings(d);
    },
    getPpfCoatingAdjustments: async (d) => { seen.push(d); return { ok: true, rows: [ADJ] }; },
  };
  const r = await resolveWizardRuntimeConfigForDealer(DEALER, bound);
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [DEALER]);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — partial PPF part labels and bounds reach both configs ──

test("Stage B: EVERY global ppf_part projects label + bounds into pricingConfig.ppfParts and a quantity-bearing screenConfig part", async () => {
  const rows = [...globals(), ...menus()].map((r) => (r.kind === "ppf_part" && r.code === "part-1" ? { ...r, label_ja: "ボンネット", min_quantity: 2, max_quantity: 4 } : r));
  const r = await resolveWith(rows, {}, PPF_RANK);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.pricingConfig.ppfParts?.length, 16);
  assert.deepEqual(r.pricingConfig.ppfParts?.find((p) => p.code === "part-1"), { code: "part-1", label: "ボンネット", minQuantity: 2, maxQuantity: 4 });
  assert.deepEqual(r.pricingConfig.ppfParts?.find((p) => p.code === "part-0"), { code: "part-0", label: "part-0", minQuantity: 1, maxQuantity: null });
  assert.deepEqual(r.screenConfig.ppfParts.find((p) => p.id === "part-1"), { id: "part-1", label: "ボンネット", quantityRequired: true, minQty: 2, maxQty: 4 });
  assert.ok(r.screenConfig.ppfParts.every((p) => p.quantityRequired === true && p.minQty === (p.id === "part-1" ? 2 : 1)), "every part is quantity-bearing, not only quantity_required rows");
});

test("Stage B: malformed ppf_part bounds fail closed (malformed-catalog-row), never a silent default", async () => {
  for (const bad of [{ min_quantity: 0 }, { min_quantity: 1.5 }, { min_quantity: 3, max_quantity: 2 }, { max_quantity: 2.5 }]) {
    const rows = [...globals(), ...menus()].map((r) => (r.kind === "ppf_part" && r.code === "part-2" ? { ...r, ...bad } : r));
    const r = await resolveWith(rows, {}, PPF_RANK);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (!r.ok) assert.equal(r.reason, "malformed-catalog-row");
  }
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5a) — dedicated wheel / glass menu projection ─────────────

function wheelRow(over: Partial<WizardCatalogRow> = {}): WizardCatalogRow {
  return row({
    kind: "wheel_menu", code: "wheel-coat", owner_scope: "dealer", label_ja: "ホイールコーティング",
    default_unit_price: 8000, quantity_required: true, min_quantity: 1, max_quantity: 4, categories: ["wheel"], ...over,
  });
}
function glassRow(over: Partial<WizardCatalogRow> = {}): WizardCatalogRow {
  return row({
    kind: "glass_menu", code: "glass-coat", owner_scope: "dealer", label_ja: "ガラスコーティング",
    default_unit_price: null, quantity_required: true, min_quantity: 1, max_quantity: null, categories: ["glass"], ...over,
  });
}

test("B5a: dealer wheel/glass rows project into INDEPENDENT screenConfig collections keyed by stable code, with a NULLABLE per-unit price", async () => {
  const r = await resolveWith([...globals(), ...menus(), wheelRow(), glassRow()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.wheelMenus, [{
    kind: "wheel_menu", id: "wheel-coat", name: "ホイールコーティング",
    defaultUnitPrice: 8000, quantityRequired: true, minQty: 1, maxQty: 4, displayOrder: 0,
  }]);
  assert.deepEqual(r.screenConfig.glassMenus, [{
    kind: "glass_menu", id: "glass-coat", name: "ガラスコーティング",
    defaultUnitPrice: null, quantityRequired: true, minQty: 1, maxQty: null, displayOrder: 0,
  }]);
  assert.strictEqual(r.screenConfig.glassMenus?.[0]?.defaultUnitPrice, null, "null is 'not configured' and must never become 0");
  // Dedicated, not a widening of anything that already exists.
  assert.deepEqual(r.screenConfig.storeGlobalOptions, [], "never projected as a store-global option");
  assert.deepEqual(r.screenConfig.maintenanceMenus.map((m) => m.id).sort(), ["maint-a", "maint-b"], "existing menu kinds unchanged");
  assert.deepEqual(r.screenConfig.otherWorkPresets, []);
  // No offering family was invented for them.
  assert.deepEqual(Object.keys(r.screenConfig.serviceOfferings).sort(), ["car_wash", "maintenance", "ppf", "room_cleaning", "window_film"]);
});

test("B5a: with no wheel/glass rows both collections are EXPLICIT empty arrays from the resolver (never undefined)", async () => {
  const r = await resolveWith([...globals(), ...menus()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.wheelMenus, [], "explicit [] ⇒ the dealer authored none (a settings prompt, not a wiring fault)");
  assert.deepEqual(r.screenConfig.glassMenus, []);
  assert.equal("wheelMenus" in r.screenConfig, true);
  assert.equal("glassMenus" in r.screenConfig, true);
});

test("B5a / GDA-PR143-R2: a PERSISTED zero price is a valid row that projects as UNCONFIGURED (null, never 0); the row's quantity flag never lowers the by-kind requirement", async () => {
  const r = await resolveWith([...globals(), ...menus(), wheelRow({ default_unit_price: 0, quantity_required: false }), glassRow({ default_unit_price: 0 })]);
  assert.equal(r.ok, true, "an existing stored 0 is NOT a malformed row — nothing is rejected, rewritten or dropped");
  if (!r.ok) return;
  assert.strictEqual(r.screenConfig.wheelMenus?.[0]?.defaultUnitPrice, null, "wheel: 0 projects as not configured");
  assert.strictEqual(r.screenConfig.glassMenus?.[0]?.defaultUnitPrice, null, "glass: 0 projects as not configured");
  assert.equal(r.screenConfig.wheelMenus?.length, 1, "the row itself is still projected (never deleted)");
  assert.equal(r.screenConfig.wheelMenus?.[0]?.quantityRequired, true, "quantity-bearing by kind, exactly like every partial PPF part");
  // A negative / fractional stored price is still a defect (unchanged).
  assert.deepEqual(await resolveWith([...globals(), ...menus(), wheelRow({ default_unit_price: -1 })]), { ok: false, reason: "malformed-catalog-row" });
  assert.deepEqual(await resolveWith([...globals(), ...menus(), glassRow({ default_unit_price: 12.5 })]), { ok: false, reason: "malformed-catalog-row" });
});

test("B5a: wheel/glass sort by display_order then code, and a label change never moves identity", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    wheelRow({ code: "wheel-z", display_order: 2, label_ja: "AAA" }),
    wheelRow({ code: "wheel-a", display_order: 1, label_ja: "ZZZ" }),
    wheelRow({ code: "wheel-b", display_order: 1, label_ja: "MMM" }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.wheelMenus?.map((m) => m.id), ["wheel-a", "wheel-b", "wheel-z"]);
});

test("B5a: malformed wheel/glass bounds or price fail closed (malformed-catalog-row), never a silent default", async () => {
  for (const bad of [
    { min_quantity: 0 }, { min_quantity: 1.5 }, { min_quantity: 3, max_quantity: 2 }, { max_quantity: 2.5 }, { max_quantity: 0 },
    { default_unit_price: -1 }, { default_unit_price: 10.5 },
  ]) {
    const w = await resolveWith([...globals(), ...menus(), wheelRow(bad)]);
    assert.equal(w.ok, false, `wheel ${JSON.stringify(bad)}`);
    if (!w.ok) assert.equal(w.reason, "malformed-catalog-row");
    const g = await resolveWith([...globals(), ...menus(), glassRow(bad)]);
    assert.equal(g.ok, false, `glass ${JSON.stringify(bad)}`);
    if (!g.ok) assert.equal(g.reason, "malformed-catalog-row");
  }
});

test("B5a: a wheel/glass row owned by ANOTHER dealer is refused; only dealer-owned rows are admitted", async () => {
  const foreign = await resolveWith([...globals(), ...menus(), wheelRow({ dealer_id: OTHER_DEALER })]);
  assert.deepEqual(foreign, { ok: false, reason: "malformed-catalog-row" });
  const foreignGlass = await resolveWith([...globals(), ...menus(), glassRow({ dealer_id: OTHER_DEALER })]);
  assert.deepEqual(foreignGlass, { ok: false, reason: "malformed-catalog-row" });
  const duplicate = await resolveWith([...globals(), ...menus(), wheelRow(), wheelRow()]);
  assert.deepEqual(duplicate, { ok: false, reason: "duplicate-code" });
});

test("B5a: all-rank wheel/glass rows resolve at every rank (availability is the row, not a family or rank gate)", async () => {
  for (const rank of ALL) {
    const r = await resolveWith([...globals(), ...menus(), wheelRow(), glassRow()], {}, rank);
    assert.equal(r.ok, true, rank);
    if (!r.ok) continue;
    assert.equal(r.screenConfig.wheelMenus?.length, 1, rank);
    assert.equal(r.screenConfig.glassMenus?.length, 1, rank);
  }
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c1) — dedicated wheel / glass menu FACTS reach pricingConfig ──

test("B5c1: dealer wheel/glass rows project code, label, bounds and price PRESENCE (never the price value) into pricingConfig", async () => {
  const r = await resolveWith([...globals(), ...menus(), wheelRow(), glassRow()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.pricingConfig.wheelMenus, [
    { code: "wheel-coat", label: "ホイールコーティング", minQuantity: 1, maxQuantity: 4, unitPriceConfigured: true },
  ]);
  assert.deepEqual(r.pricingConfig.glassMenus, [
    { code: "glass-coat", label: "ガラスコーティング", minQuantity: 1, maxQuantity: null, unitPriceConfigured: false },
  ]);
  // The price VALUE is not a pricing-configuration fact: the operator's edited input is the priced amount.
  for (const m of [...(r.pricingConfig.wheelMenus ?? []), ...(r.pricingConfig.glassMenus ?? [])]) {
    assert.equal("defaultUnitPrice" in m, false);
    assert.equal("unitPrice" in m, false);
  }
  // Dedicated: never merged into any existing manual collection.
  assert.deepEqual(r.pricingConfig.storeGlobalOptions, []);
  assert.deepEqual(r.pricingConfig.maintenanceMenus.map((m) => m.code).sort(), ["maint-a", "maint-b"]);
  assert.deepEqual(r.pricingConfig.roomCleaningMenus, []);
});

test("B5c1 / GDA-PR143-R2: a PERSISTED ¥0 configured price is UNPRICEABLE (unitPriceConfigured false); pricing and screen views come from the SAME rows", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    wheelRow({ default_unit_price: 0 }),
    glassRow({ code: "glass-b", label_ja: "ガラスB", min_quantity: 2, max_quantity: 6 }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.pricingConfig.wheelMenus?.[0]?.unitPriceConfigured, false, "a stored ¥0 is not a price anyone decided — a settings prompt, never a ¥0 line");
  assert.strictEqual(r.screenConfig.wheelMenus?.[0]?.defaultUnitPrice, null, "the screen view agrees: nothing is prefilled");
  assert.deepEqual(r.pricingConfig.glassMenus?.[0], { code: "glass-b", label: "ガラスB", minQuantity: 2, maxQuantity: 6, unitPriceConfigured: false });
  assert.deepEqual(r.pricingConfig.wheelMenus?.map((m) => m.code), r.screenConfig.wheelMenus?.map((m) => m.id));
  assert.deepEqual(r.pricingConfig.glassMenus?.map((m) => m.code), r.screenConfig.glassMenus?.map((m) => m.id));
  assert.deepEqual(
    r.pricingConfig.glassMenus?.map((m) => [m.minQuantity, m.maxQuantity]),
    r.screenConfig.glassMenus?.map((m) => [m.minQty, m.maxQty]),
    "bounds identical in both views",
  );
});

test("B5c1: with no wheel/glass rows both pricingConfig collections are EXPLICIT empty arrays (never undefined)", async () => {
  const r = await resolveWith([...globals(), ...menus()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.pricingConfig.wheelMenus, []);
  assert.deepEqual(r.pricingConfig.glassMenus, []);
  assert.equal("wheelMenus" in r.pricingConfig, true);
  assert.equal("glassMenus" in r.pricingConfig, true);
});

test("B5c1: a label change never moves pricing identity; order follows display_order then code", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    wheelRow({ code: "wheel-z", display_order: 2, label_ja: "AAA" }),
    wheelRow({ code: "wheel-a", display_order: 1, label_ja: "ZZZ" }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.pricingConfig.wheelMenus?.map((m) => [m.code, m.label]), [["wheel-a", "ZZZ"], ["wheel-z", "AAA"]]);
});

test("B5c1: the resolved pricingConfig prices a selected wheel/glass draft through the EXISTING adapter (4 wheels × ¥8000; 1 pane × operator ¥12000)", async () => {
  const r = await resolveWith([...globals(), ...menus(), wheelRow(), glassRow()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const base = resetWizardDraft();
  const draft = {
    ...base,
    serviceSelection: { selectedCategories: ["wheel" as const, "glass" as const] },
    serviceConfiguration: {
      ...base.serviceConfiguration,
      wheel: { selectedMenuIds: ["wheel-coat"], unitPricesByMenu: { "wheel-coat": "8000" }, quantitiesByMenu: { "wheel-coat": 4 } },
      glass: { selectedMenuIds: ["glass-coat"], unitPricesByMenu: { "glass-coat": "12000" }, quantitiesByMenu: { "glass-coat": 1 } },
    },
  };
  const bundle = buildWizardPricingInputFromConfig(draft, r.pricingConfig, r.catalog, r.shopRank);
  assert.deepEqual(bundle.errors, []);
  assert.deepEqual(
    bundle.manualLines.map((l) => [l.sourceCategory, l.manualPricingIdentity, l.label, l.quantity, l.unitPrice]),
    [["wheel", "wheel-coat", "ホイールコーティング", 4, 8000], ["glass", "glass-coat", "ガラスコーティング", 1, 12000]],
  );
  // The engine receives unit × quantity per line; it owns subtotal/discount/tax from here.
  assert.deepEqual(bundle.services, [{ type: "other", items: [{ name: "ホイールコーティング", price: 32000 }, { name: "ガラスコーティング", price: 12000 }] }]);
});

// ── GDA-OTHER-COATINGS-R1 (C2) — dealer-authored other-coating menu projection (no selectable line yet) ──

function otherCoatingRow(over: Partial<WizardCatalogRow> = {}): WizardCatalogRow {
  return row({
    kind: "other_coating_menu", code: "oc-fixed", owner_scope: "dealer", label_ja: "ヘッドライトコーティング",
    default_unit_price: 6000, quantity_required: false, min_quantity: 1, max_quantity: null, categories: [], ...over,
  });
}

test("C2: a positive-price FIXED-ONE other-coating row projects quantityRequired:false with no bounds into screenConfig and pricingConfig", async () => {
  const r = await resolveWith([...globals(), ...menus(), otherCoatingRow()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherCoatingMenus, [{
    kind: "other_coating_menu", id: "oc-fixed", name: "ヘッドライトコーティング",
    defaultUnitPrice: 6000, quantityRequired: false, displayOrder: 0,
  }]);
  assert.equal("minQty" in (r.screenConfig.otherCoatingMenus?.[0] ?? {}), false, "a fixed-one item carries no bounds");
  assert.equal("maxQty" in (r.screenConfig.otherCoatingMenus?.[0] ?? {}), false);
  assert.deepEqual(r.pricingConfig.otherCoatingMenus, [{
    code: "oc-fixed", label: "ヘッドライトコーティング", quantityRequired: false,
    minQuantity: null, maxQuantity: null, unitPriceConfigured: true,
  }]);
  // The price VALUE is not a pricing-configuration fact (same discipline as wheel / glass).
  assert.equal("defaultUnitPrice" in (r.pricingConfig.otherCoatingMenus?.[0] ?? {}), false);
});

test("C2: a positive-price QUANTITY-BEARING other-coating row projects quantityRequired:true WITH its bounds, read from the row (not by kind)", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    otherCoatingRow({ code: "oc-qty", label_ja: "ホイールハウスコーティング", default_unit_price: 3500, quantity_required: true, min_quantity: 2, max_quantity: 6 }),
    otherCoatingRow({ code: "oc-qty-open", label_ja: "無上限", default_unit_price: 100, quantity_required: true, min_quantity: 1, max_quantity: null }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherCoatingMenus?.find((m) => m.id === "oc-qty"), {
    kind: "other_coating_menu", id: "oc-qty", name: "ホイールハウスコーティング",
    defaultUnitPrice: 3500, quantityRequired: true, minQty: 2, maxQty: 6, displayOrder: 0,
  });
  assert.deepEqual(r.screenConfig.otherCoatingMenus?.find((m) => m.id === "oc-qty-open"), {
    kind: "other_coating_menu", id: "oc-qty-open", name: "無上限",
    defaultUnitPrice: 100, quantityRequired: true, minQty: 1, displayOrder: 0,
  });
  assert.deepEqual(r.pricingConfig.otherCoatingMenus?.find((m) => m.code === "oc-qty"), {
    code: "oc-qty", label: "ホイールハウスコーティング", quantityRequired: true, minQuantity: 2, maxQuantity: 6, unitPriceConfigured: true,
  });
  assert.deepEqual(r.pricingConfig.otherCoatingMenus?.find((m) => m.code === "oc-qty-open"), {
    code: "oc-qty-open", label: "無上限", quantityRequired: true, minQuantity: 1, maxQuantity: null, unitPriceConfigured: true,
  });
  // Both views come from the SAME rows.
  assert.deepEqual(r.pricingConfig.otherCoatingMenus?.map((m) => m.code), r.screenConfig.otherCoatingMenus?.map((m) => m.id));
});

test("C2: an ABSENT, NULL or ZERO price is 'not configured' — projected as null / unitPriceConfigured:false, never converted to 0", async () => {
  const absent = { ...otherCoatingRow({ code: "oc-absent" }) } as Partial<WizardCatalogRow> as WizardCatalogRow;
  delete (absent as Partial<WizardCatalogRow>).default_unit_price;
  const r = await resolveWith([
    ...globals(), ...menus(),
    absent,
    otherCoatingRow({ code: "oc-null", default_unit_price: null }),
    otherCoatingRow({ code: "oc-zero", default_unit_price: 0 }),
    otherCoatingRow({ code: "oc-zero-qty", default_unit_price: 0, quantity_required: true, min_quantity: 1, max_quantity: 4 }),
  ]);
  assert.equal(r.ok, true, "an unconfigured price is a configuration state, not a defect");
  if (!r.ok) return;
  for (const code of ["oc-absent", "oc-null", "oc-zero", "oc-zero-qty"]) {
    // Explicit annotations: the assertion-signature calls below sit inside a loop back-edge, and
    // TypeScript (TS7022) refuses to infer these locals through that circular flow.
    const screen: OtherCoatingMenu | undefined = r.screenConfig.otherCoatingMenus?.find((m) => m.id === code);
    const pricing: ProductionOtherCoatingMenuOption | undefined = r.pricingConfig.otherCoatingMenus?.find((m) => m.code === code);
    if (!screen || !pricing) assert.fail(`${code} is still projected (settings prompt, not dropped)`);
    assert.strictEqual(screen.defaultUnitPrice, null, `${code}: null, never 0`);
    assert.notStrictEqual(screen.defaultUnitPrice, 0, `${code}: never coerced to ¥0`);
    assert.equal(pricing.unitPriceConfigured, false, `${code}: never 'configured'`);
  }
  // The quantity requirement is still read from the row even when the price is unconfigured.
  assert.equal(r.screenConfig.otherCoatingMenus?.find((m) => m.id === "oc-zero-qty")?.quantityRequired, true);
  assert.equal(r.screenConfig.otherCoatingMenus?.find((m) => m.id === "oc-zero")?.quantityRequired, false);
});

test("C2: a MALFORMED price or bounds fails closed (malformed-catalog-row) — never a silent default, never 0", async () => {
  for (const bad of [
    { default_unit_price: -1 }, { default_unit_price: 10.5 }, { default_unit_price: Number.NaN },
    { default_unit_price: "6000" as unknown as number },
    { quantity_required: true, min_quantity: 0 }, { quantity_required: true, min_quantity: 1.5 },
    { quantity_required: true, min_quantity: 3, max_quantity: 2 }, { quantity_required: true, max_quantity: 2.5 },
    { quantity_required: false, min_quantity: 0 }, // bounds are validated on every row, fixed-one included
    { quantity_required: "yes" as unknown as boolean },
  ] as Partial<WizardCatalogRow>[]) {
    const r = await resolveWith([...globals(), ...menus(), otherCoatingRow(bad)]);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (!r.ok) assert.equal(r.reason, "malformed-catalog-row");
  }
});

test("C2: an INACTIVE, deleted, foreign-owned or duplicate other-coating row is refused exactly like every other row", async () => {
  const inactive = await resolveWith([...globals(), ...menus(), otherCoatingRow({ is_active: false })]);
  assert.deepEqual(inactive, { ok: false, reason: "malformed-catalog-row" }, "the reader contract admits active rows only");
  const deleted = await resolveWith([...globals(), ...menus(), otherCoatingRow({ deleted_at: "2026-09-30T00:00:00Z" })]);
  assert.deepEqual(deleted, { ok: false, reason: "malformed-catalog-row" });
  const foreign = await resolveWith([...globals(), ...menus(), otherCoatingRow({ dealer_id: OTHER_DEALER })]);
  assert.deepEqual(foreign, { ok: false, reason: "malformed-catalog-row" });
  const duplicate = await resolveWith([...globals(), ...menus(), otherCoatingRow(), otherCoatingRow()]);
  assert.deepEqual(duplicate, { ok: false, reason: "duplicate-code" });
});

test("C2: a rank-ineligible other-coating row is filtered out (never fails), and rows sort by display_order then code", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    otherCoatingRow({ code: "oc-z", display_order: 2, label_ja: "AAA" }),
    otherCoatingRow({ code: "oc-a", display_order: 1, label_ja: "ZZZ" }),
    otherCoatingRow({ code: "oc-b", display_order: 1, label_ja: "MMM" }),
    otherCoatingRow({ code: "oc-cert-only", ranks: ["certified"] }),
  ], {}, "shop");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherCoatingMenus?.map((m) => m.id), ["oc-a", "oc-b", "oc-z"]);
  assert.deepEqual(r.pricingConfig.otherCoatingMenus?.map((m) => m.code), ["oc-a", "oc-b", "oc-z"]);
});

test("C2: NON-OTHER kinds are isolated — wheel / glass / maintenance / store rows never enter the other-coating collections and vice versa", async () => {
  const r = await resolveWith([
    ...globals(), ...menus(),
    wheelRow(), glassRow(),
    row({ kind: "store_global_option", code: "store-trip", owner_scope: "dealer", label_ja: "出張費", default_unit_price: 15000, categories: [] }),
    row({ kind: "other_work_preset", code: "other-polish", owner_scope: "dealer", label_ja: "ハードポリッシュ", categories: ["other"] }),
    otherCoatingRow({ code: "oc-x", quantity_required: true, min_quantity: 1, max_quantity: 2 }),
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherCoatingMenus?.map((m) => m.id), ["oc-x"]);
  assert.deepEqual(r.pricingConfig.otherCoatingMenus?.map((m) => m.code), ["oc-x"]);
  // B5 wheel / glass behaviour is byte-for-byte what it was: by-kind quantity, nullable price, ¥0 = configured.
  assert.deepEqual(r.screenConfig.wheelMenus, [{ kind: "wheel_menu", id: "wheel-coat", name: "ホイールコーティング", defaultUnitPrice: 8000, quantityRequired: true, minQty: 1, maxQty: 4, displayOrder: 0 }]);
  assert.deepEqual(r.screenConfig.glassMenus, [{ kind: "glass_menu", id: "glass-coat", name: "ガラスコーティング", defaultUnitPrice: null, quantityRequired: true, minQty: 1, maxQty: null, displayOrder: 0 }]);
  assert.deepEqual(r.pricingConfig.wheelMenus, [{ code: "wheel-coat", label: "ホイールコーティング", minQuantity: 1, maxQuantity: 4, unitPriceConfigured: true }]);
  assert.deepEqual(r.pricingConfig.glassMenus, [{ code: "glass-coat", label: "ガラスコーティング", minQuantity: 1, maxQuantity: null, unitPriceConfigured: false }]);
  assert.deepEqual(r.screenConfig.storeGlobalOptions.map((o) => o.id), ["store-trip"]);
  assert.deepEqual(r.screenConfig.otherWorkPresets.map((o) => o.id), ["other-polish"]);
  assert.deepEqual(r.pricingConfig.storeGlobalOptions.map((o) => o.code), ["store-trip"]);
  assert.deepEqual(r.screenConfig.maintenanceMenus.map((m) => m.id).sort(), ["maint-a", "maint-b"]);
  // No offering family was invented for other coatings.
  assert.deepEqual(Object.keys(r.screenConfig.serviceOfferings).sort(), ["car_wash", "maintenance", "ppf", "room_cleaning", "window_film"]);
});

test("C2: with no other-coating rows both collections are EXPLICIT empty arrays from the resolver (never undefined)", async () => {
  const r = await resolveWith([...globals(), ...menus()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.screenConfig.otherCoatingMenus, []);
  assert.deepEqual(r.pricingConfig.otherCoatingMenus, []);
  assert.equal("otherCoatingMenus" in r.screenConfig, true);
  assert.equal("otherCoatingMenus" in r.pricingConfig, true);
});

test("C2/C4: old-runtime config compatibility — unselected other-coating rows do not change wheel/glass pricing", async () => {
  const r = await resolveWith([...globals(), ...menus(), wheelRow(), glassRow(), otherCoatingRow(), otherCoatingRow({ code: "oc-qty", quantity_required: true, max_quantity: 3 })]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const base = resetWizardDraft();
  const draft = {
    ...base,
    serviceSelection: { selectedCategories: ["wheel" as const, "glass" as const] },
    serviceConfiguration: {
      ...base.serviceConfiguration,
      wheel: { selectedMenuIds: ["wheel-coat"], unitPricesByMenu: { "wheel-coat": "8000" }, quantitiesByMenu: { "wheel-coat": 4 } },
      glass: { selectedMenuIds: ["glass-coat"], unitPricesByMenu: { "glass-coat": "12000" }, quantitiesByMenu: { "glass-coat": 1 } },
    },
  };
  // (1) The optional type boundary: a pre-C2 shaped configuration is still a valid input.
  const { otherCoatingMenus: _omitted, ...legacyPricingConfig } = r.pricingConfig;
  void _omitted;
  const legacyScreenConfig: WizardScreenConfiguration = (({ otherCoatingMenus: _o, ...rest }) => { void _o; return rest; })(r.screenConfig);
  assert.equal("otherCoatingMenus" in legacyPricingConfig, false);
  assert.equal("otherCoatingMenus" in legacyScreenConfig, false);
  // (2) Pricing output is identical while other_coating is unselected, even
  // though C4 consumes those facts when the category is selected.
  const withC2 = buildWizardPricingInputFromConfig(draft, r.pricingConfig, r.catalog, r.shopRank);
  const withoutC2 = buildWizardPricingInputFromConfig(draft, legacyPricingConfig, r.catalog, r.shopRank);
  assert.deepEqual(withC2.errors, []);
  assert.deepEqual(withC2.errors, withoutC2.errors);
  assert.deepEqual(withC2.manualLines, withoutC2.manualLines);
  assert.deepEqual(withC2.services, withoutC2.services);
  assert.deepEqual(
    withC2.manualLines.map((l) => [l.sourceCategory, l.manualPricingIdentity, l.label, l.quantity, l.unitPrice]),
    [["wheel", "wheel-coat", "ホイールコーティング", 4, 8000], ["glass", "glass-coat", "ガラスコーティング", 1, 12000]],
    "B5 wheel / glass lines unchanged",
  );
  assert.ok(withC2.manualLines.every((l) => l.sourceCategory !== "other_coating"), "unselected other-coating rows are not priced");
  // (3) C4 now consumes the projected facts only for an explicit selection.
  const builder = codeOf("src/components/estimates/wizard/pricing/wizard-manual-pricing-config.ts");
  const bodyStart = builder.indexOf("export function buildManualPricingLinesFromConfig");
  assert.ok(bodyStart > 0);
  assert.equal(/otherCoatingMenus|other_coating/.test(builder.slice(bodyStart)), true, "C4 prices explicitly selected other-coating rows");
});
