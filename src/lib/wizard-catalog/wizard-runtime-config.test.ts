// C2C2 — DI unit tests for the pure Wizard runtime config resolver (no database).
// Run: node --import tsx --test src/lib/wizard-catalog/wizard-runtime-config.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveWizardRuntimeConfig, type WizardCatalogRow, type WizardConfigReaders, type WizardLifecycleRow } from "./wizard-runtime-config";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import { buildWizardPricingInputFromConfig } from "@/components/estimates/wizard/pricing/wizard-pricing-input-adapter-config";
import { initialEstimateWizardDraftV22 } from "@/components/estimates/wizard/draft/wizard-draft-state";
import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";

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
  const prods = Array.from({ length: 8 }, (_, i) => row({ kind: "ppf_type_group", code: `prod-${i}`, owner_scope: "global", ranks: PPF_RANKS, categories: ["ppf"], ppf_type_group_id: "g:group-gloss" }));
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

function readers(over: Partial<{ dealer: { dealer_id: string } | null; rank: ShopRank | null; lifecycle: { ok: boolean; row: WizardLifecycleRow | null }; rows: WizardCatalogRow[] }>): WizardConfigReaders {
  return {
    getDealer: async () => (over.dealer !== undefined ? over.dealer : { dealer_id: DEALER }),
    getRank: async () => (over.rank === null ? { ok: false, reason: "missing" } : { ok: true, rank: over.rank ?? "shop" }),
    getCatalog: async () => DEFAULT_PRICING_CATALOG,
    getLifecycle: async () => (over.lifecycle ? (over.lifecycle.ok ? { ok: true, row: over.lifecycle.row } : { ok: false }) : { ok: true, row: REVIEWED }),
    getCatalogRows: async () => ({ ok: true, rows: over.rows ?? [...globals(), ...menus()] }),
  };
}

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
test("certified with window areas but no film types → window-film-no-film-types", async () => {
  assert.deepEqual(await resolveWizardRuntimeConfig(readers({ rank: "certified" })), { ok: false, reason: "window-film-no-film-types" });
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
