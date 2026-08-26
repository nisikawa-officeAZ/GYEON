// EW-UI-3C — Step-4 canonical binding tests.
//
// Verifies that the controlled Step-4 host binds all eight serviceConfiguration sections through the
// single canonical write route (api.updateStore → applyStorePatch → updateServiceConfiguration), that
// the pure binding layer is immutable and section-scoped, that row creation uses the Web-Crypto
// row-ID authority (unique across BOTH row collections, fail-closed on null), and that trusted
// runtime inputs (shopRank + screenConfig) are required and threaded — with source-level guards
// rejecting preview/example/default data, pricing/save/OCR/route/DB, and prohibited ID sources.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsconfig uses `jsx: preserve`, so under tsx the screen components (which rely on the automatic JSX
// runtime and do not import React) compile to classic `React.createElement`. Exposing React globally
// before any render satisfies that reference. This is a TEST-ONLY shim; production uses Next's runtime.
(globalThis as unknown as { React: typeof React }).React = React;

import EstimateWizard from "../EstimateWizard";
import { Step4Estimate } from "./Step4Estimate";
import { createStep4Bindings, type Step4UpdateStore } from "./step4-bindings";
import { initialCanonicalDraft, projectStore, applyStorePatch, type WizardStorePatch } from "../bridge/ew-ui1-controller";
import { initialWizardStore, type WizardStore } from "../wizard-types";
import type { WizardServiceConfigurationDraft } from "../draft/wizard-draft-types";
import type { WizardRowIdCryptoSource } from "../contract/wizard-row-id";
import type { WizardScreenConfiguration } from "../contract/wizard-runtime-inputs";
import type { EstimateWizardApi } from "../useEstimateWizard";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";

// ── helpers ───────────────────────────────────────────────────────────────────────

const fresh = (): WizardServiceConfigurationDraft => initialWizardStore().services;

function cap(): { updateStore: Step4UpdateStore; patches: WizardStorePatch[] } {
  const patches: WizardStorePatch[] = [];
  return { updateStore: (p) => patches.push(p), patches };
}

// A dealer-configured screenConfig with distinctive labels (trusted runtime input, NOT a fixture the
// host imports). ZZ-prefixed strings make section rendering unambiguous in the static markup.
const SC: WizardScreenConfiguration = {
  // B2-E2G — a fully opted-in, fully configured dealer, so every pre-existing assertion keeps
  // exercising the same surface it always did.
  serviceOfferings:   { window_film: true, ppf: true, maintenance: true, room_cleaning: true, car_wash: true },
  filmTypes:          [{ id: "ft1", label: "ZZFILMTYPE" }],
  windowAreas:        [{ id: "wa1", label: "ZZWINDOWAREA" }],
  maintenanceMenus:   [{ id: "mm1", name: "ZZMAINTMENU", defaultPrice: 5000 }],
  washMenus:          [{ id: "cw1", name: "ZZWASHMENU", defaultPrice: 3000 }],
  roomMenus:          [{ id: "rc1", name: "ZZROOMMENU", defaultPrice: 4000 }],
  otherWorkPresets:   [{ id: "op1", name: "ZZOTHERPRESET", defaultPrice: 2000 }],
  storeGlobalOptions: [{ id: "go1", name: "ZZGLOBALOPT", defaultPrice: 1000, appliesToAllCategories: true }],
  coupons:            [{ id: "cp1", name: "ZZCOUPON", discountType: "amount", discountValue: 0 }],
  ppfMethods:         [{ id: "full", label: "ZZPPFMETHOD" }],
  ppfParts:           [{ id: "pp1", label: "ZZPPFPART" }],
  ppfTypeGroups:      [{ id: "gg1", label: "ZZPPFGROUP", products: [{ id: "pt1", label: "ZZPPFTYPE" }] }],
};

function makeApi(categories: string[], servicesOverride?: WizardServiceConfigurationDraft): {
  api: EstimateWizardApi;
  patches: WizardStorePatch[];
} {
  const draft = initialCanonicalDraft();
  const base = projectStore(draft);
  const patches: WizardStorePatch[] = [];
  const store: WizardStore = { ...base, categories, services: servicesOverride ?? base.services };
  const api = {
    step: 4, store, draft,
    updateStore: (p: WizardStorePatch) => patches.push(p),
    jumpTo: () => {}, next: () => {}, back: () => {},
    isFirst: false, isLast: false, completed: new Set<never>() as EstimateWizardApi["completed"],
  } as unknown as EstimateWizardApi;
  return { api, patches };
}

const render = (node: React.ReactElement): string => renderToStaticMarkup(node);

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const BIND_SRC = "src/components/estimates/wizard/steps/step4-bindings.ts";
const STEP_SRC = "src/components/estimates/wizard/steps/Step4Estimate.tsx";
// B7-2A — required existing-entity inputs. Minimal references only; the host now
// requires both arrays, so every mount must supply them.
const CUSTOMER_REFS = [
  { id: "c-1", displayName: "山田太郎", phone: "090-0000-0001" },
] as const;
const VEHICLE_REFS = [
  { id: "v-1", customerId: "c-1", displayName: "TOYOTA CROWN", plateNumber: "滋賀 330 に 1234", bodySize: "M" },
] as const;

const WIZARD_SRC = "src/components/estimates/wizard/EstimateWizard.tsx";

// ── 1. Section-scoped patches: every callback emits exactly one section key ─────────

test("every binding callback emits exactly one section-scoped services patch", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  const calls: Array<[() => void, string]> = [
    [() => b.coating.onLayerCountChange(2), "coating"],
    [() => b.coating.onLayer1Change("x"), "coating"],
    [() => b.ppf.onInstallationMethodChange("full"), "ppf"],
    [() => b.ppf.onFullCoverageChange("front_full"), "ppf"],
    [() => b.ppf.onPartialPartToggle("p"), "ppf"],
    [() => b.ppf.onUnitPriceChange("100"), "ppf"],
    [() => b.ppf.onVehicleCoefficientChange("1.25"), "ppf"],
    [() => b.windowFilm.onAreaToggle("a"), "windowFilm"],
    [() => b.windowFilm.onFilmTypeChange("f"), "windowFilm"],
    [() => b.bodyMaintenance.onMenuChange("m"), "bodyMaintenance"],
    [() => b.carWash.onMenuChange("w"), "carWash"],
    [() => b.roomCleaning.onMenuToggle("r"), "roomCleaning"],
    [() => b.otherWork.onPresetToggle("o"), "otherWork"],
    [() => b.storeGlobalOptions.onOptionToggle("g"), "storeGlobalOptions"],
  ];
  for (const [run, section] of calls) {
    patches.length = 0;
    run();
    assert.equal(patches.length, 1, `${section}: exactly one patch`);
    const services = patches[0].services!;
    assert.deepEqual(Object.keys(services), [section], `${section}: only that section key present`);
  }
});

test("exact patch payloads for representative callbacks", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  b.coating.onLayerCountChange(3);
  assert.deepEqual(patches.at(-1), { services: { coating: { layerCount: 3 } } });
  b.coating.onLayer1Change("one-evo");
  assert.deepEqual(patches.at(-1), { services: { coating: { layer1Id: "one-evo", layer2Id: null, layer3Id: null } } });
  b.ppf.onFullCoverageChange("full_body");
  assert.deepEqual(patches.at(-1), { services: { ppf: { fullCoverage: "full_body" } } });
  b.ppf.onVehicleCoefficientChange("1.15");
  assert.deepEqual(patches.at(-1), { services: { ppf: { vehicleCoefficientInput: "1.15" } } });
  b.bodyMaintenance.onMenuChange("mm1");
  assert.deepEqual(patches.at(-1), { services: { bodyMaintenance: { menuId: "mm1" } } });
  b.roomCleaning.onUnitPriceChange("rc1", "999");
  assert.deepEqual(patches.at(-1), { services: { roomCleaning: { unitPricesByMenu: { rc1: "999" } } } });
});

// ── 2. Read from the canonical projection (toggles/records build on the supplied state) ──

test("all eight sections read from the supplied services projection", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    ppf: { ...s.ppf, selectedPartIds: ["a"], quantitiesByPart: { a: 1 } },
    windowFilm: { ...s.windowFilm, selectedAreaIds: ["w1"] },
    roomCleaning: { ...s.roomCleaning, selectedMenuIds: ["m1"], unitPricesByMenu: { m1: "1" } },
    otherWork: { ...s.otherWork, selectedPresetIds: ["o1"], unitPricesByItem: { o1: "1" } },
    storeGlobalOptions: { ...s.storeGlobalOptions, selectedOptionIds: ["g1"], quantitiesByOption: { g1: 2 } },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);

  b.ppf.onPartialPartToggle("b");
  assert.deepEqual(patches.at(-1)!.services!.ppf!.selectedPartIds, ["a", "b"]);
  b.ppf.onQuantityChange("c", 4);
  assert.deepEqual(patches.at(-1)!.services!.ppf!.quantitiesByPart, { a: 1, c: 4 });
  b.windowFilm.onAreaToggle("w1"); // already present → toggled OFF
  assert.deepEqual(patches.at(-1)!.services!.windowFilm!.selectedAreaIds, []);
  b.roomCleaning.onMenuToggle("m2");
  assert.deepEqual(patches.at(-1)!.services!.roomCleaning!.selectedMenuIds, ["m1", "m2"]);
  b.otherWork.onUnitPriceChange("o2", "5");
  assert.deepEqual(patches.at(-1)!.services!.otherWork!.unitPricesByItem, { o1: "1", o2: "5" });
  b.storeGlobalOptions.onQuantityChange("g1", 9);
  assert.deepEqual(patches.at(-1)!.services!.storeGlobalOptions!.quantitiesByOption, { g1: 9 });
});

// ── 3. Immutability: the supplied projection is never mutated; replacements are new refs ──

test("callbacks never mutate the supplied projection and produce new array/record refs", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    ppf: { ...s.ppf, selectedPartIds: ["a"], quantitiesByPart: { a: 1 } },
  };
  const snapshot = JSON.stringify(seeded);
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);

  b.ppf.onPartialPartToggle("b");
  const emittedArr = patches.at(-1)!.services!.ppf!.selectedPartIds!;
  assert.notEqual(emittedArr, seeded.ppf.selectedPartIds, "new array reference");
  b.ppf.onQuantityChange("z", 2);
  const emittedRec = patches.at(-1)!.services!.ppf!.quantitiesByPart!;
  assert.notEqual(emittedRec, seeded.ppf.quantitiesByPart, "new record reference");

  assert.equal(JSON.stringify(seeded), snapshot, "supplied projection unchanged after all calls");
});

// ── 4. Row update/delete preserves unaffected row IDs; row objects rebuilt immutably ──

test("PPF interior row update/delete preserves unaffected row IDs", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    ppf: { ...s.ppf, interiorRows: [
      { id: "ppf-A", location: "L1", amount: "1" },
      { id: "ppf-B", location: "L2", amount: "2" },
    ] },
  };
  const snapshot = JSON.stringify(seeded);
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);

  b.ppf.onInteriorRowUpdate("ppf-A", { location: "L1x" });
  const afterUpd = patches.at(-1)!.services!.ppf!.interiorRows!;
  assert.deepEqual(afterUpd.map((r) => r.id), ["ppf-A", "ppf-B"], "ids preserved on update");
  assert.equal(afterUpd[0].location, "L1x");
  assert.equal(afterUpd[1], seeded.ppf.interiorRows[1], "untouched row kept by reference");
  assert.notEqual(afterUpd[0], seeded.ppf.interiorRows[0], "changed row is a new object");

  b.ppf.onInteriorRowDelete("ppf-A");
  const afterDel = patches.at(-1)!.services!.ppf!.interiorRows!;
  assert.deepEqual(afterDel.map((r) => r.id), ["ppf-B"], "remaining id preserved on delete");

  assert.equal(JSON.stringify(seeded), snapshot, "supplied rows unchanged");
});

test("other-work custom row update/delete preserves unaffected row IDs", () => {
  const s = fresh();
  const row = (id: string) => ({ id, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" });
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    otherWork: { ...s.otherWork, customRows: [row("ow-A"), row("ow-B")] },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  b.otherWork.onCustomRowUpdate("ow-B", { name: "hello" });
  const upd = patches.at(-1)!.services!.otherWork!.customRows!;
  assert.deepEqual(upd.map((r) => r.id), ["ow-A", "ow-B"]);
  assert.equal(upd[1].name, "hello");
  b.otherWork.onCustomRowDelete("ow-B");
  assert.deepEqual(patches.at(-1)!.services!.otherWork!.customRows!.map((r) => r.id), ["ow-A"]);
});

// ── 5. Row creation via the Web-Crypto authority: unique across BOTH collections ────

test("row creation appends exactly one blank row with a unique prefixed id (real crypto)", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    ppf: { ...s.ppf, interiorRows: [{ id: "ppf-existing", location: "", amount: "" }] },
    otherWork: { ...s.otherWork, customRows: [{ id: "ow-existing", name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" }] },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);

  const r1 = b.ppf.onInteriorRowAdd();
  assert.equal(r1.ok, true);
  const ppfRows = patches.at(-1)!.services!.ppf!.interiorRows!;
  assert.equal(ppfRows.length, 2, "appended exactly one row");
  const ppfNew = ppfRows[1];
  assert.ok(ppfNew.id.startsWith("ppf-"), "ppf- prefix");
  assert.equal(ppfNew.location, "");
  assert.equal(ppfNew.amount, "");
  assert.notEqual(ppfNew.id, "ppf-existing");
  assert.notEqual(ppfNew.id, "ow-existing");

  const r2 = b.otherWork.onCustomRowAdd();
  assert.equal(r2.ok, true);
  const owRows = patches.at(-1)!.services!.otherWork!.customRows!;
  const owNew = owRows[1];
  assert.ok(owNew.id.startsWith("ow-"), "ow- prefix");
  assert.notEqual(owNew.id, ppfNew.id, "distinct ids across the two families");
});

test("existing-ID set spans BOTH collections (an other-work id blocks a colliding ppf id)", () => {
  const FIXED = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // valid v4
  const fixedSource: WizardRowIdCryptoSource = { randomUUID: () => FIXED };
  const s = fresh();
  // Seed other-work with the EXACT id a ppfInterior add would produce → forces collision → exhausts.
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    otherWork: { ...s.otherWork, customRows: [{ id: `ppf-${FIXED}`, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" }] },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore, fixedSource);
  const r = b.ppf.onInteriorRowAdd();
  assert.equal(r.ok, false, "collision across collections → fail closed");
  assert.equal(patches.length, 0, "no patch emitted on row-id failure");
});

test("row-ID generation failure (no secure source) emits no patch", () => {
  const noCrypto: WizardRowIdCryptoSource = {}; // neither randomUUID nor getRandomValues
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore, noCrypto);
  assert.deepEqual(b.ppf.onInteriorRowAdd(), { ok: false, reason: "row-id-unavailable" });
  assert.deepEqual(b.otherWork.onCustomRowAdd(), { ok: false, reason: "row-id-unavailable" });
  assert.equal(patches.length, 0);
});

// ── 6. Sibling sections + deselection preservation via the REAL canonical adapter ──

test("applying a section patch leaves sibling sections byte-identical (real adapter)", () => {
  let draft = initialCanonicalDraft();
  // set coating + ppf config first
  const r1 = applyStorePatch(draft, { services: { coating: { layerCount: 2, layer1Id: "one-evo" } } });
  assert.ok(r1.ok); draft = r1.draft;
  const r2 = applyStorePatch(draft, { services: { ppf: { unitPriceInput: "500" } } });
  assert.ok(r2.ok); draft = r2.draft;
  const coatingBefore = JSON.stringify(draft.serviceConfiguration.coating);
  // now a windowFilm patch — coating + ppf must be untouched
  const r3 = applyStorePatch(draft, { services: { windowFilm: { filmTypeId: "ft1" } } });
  assert.ok(r3.ok); draft = r3.draft;
  assert.equal(JSON.stringify(draft.serviceConfiguration.coating), coatingBefore, "coating sibling unchanged");
  assert.equal(draft.serviceConfiguration.ppf.unitPriceInput, "500", "ppf sibling unchanged");
  assert.equal(draft.serviceConfiguration.windowFilm.filmTypeId, "ft1");
});

test("category deselection preserves every section's saved configuration (canonical route)", () => {
  let draft = initialCanonicalDraft();
  const seed = applyStorePatch(draft, {
    categories: ["coating", "ppf"],
    services: { coating: { layerCount: 2, layer1Id: "one-evo" }, ppf: { unitPriceInput: "700" } },
  });
  assert.ok(seed.ok); draft = seed.draft;
  // deselect BOTH categories — config must survive (selection and configuration are separate fields)
  const deselect = applyStorePatch(draft, { categories: [] });
  assert.ok(deselect.ok); draft = deselect.draft;
  assert.deepEqual(draft.serviceSelection.selectedCategories, []);
  assert.equal(draft.serviceConfiguration.coating.layerCount, 2, "coating config preserved");
  assert.equal(draft.serviceConfiguration.coating.layer1Id, "one-evo");
  assert.equal(draft.serviceConfiguration.ppf.unitPriceInput, "700", "ppf config preserved");
});

// ── 7. Rendering: only selected categories appear; each selector section renders ────

const SECTION_MARKER: Record<string, string> = {
  coating: "Q² ONE EVO",   // from the coating matrix for a detailer rank
  ppf: "ZZPPFMETHOD",
  window: "ZZFILMTYPE",
  maintenance: "ZZMAINTMENU",
  carwash: "ZZWASHMENU",
  roomclean: "ZZROOMMENU",
  other: "ZZOTHERPRESET",
};

for (const [cat, marker] of Object.entries(SECTION_MARKER)) {
  test(`category "${cat}" renders its controlled selector section`, () => {
    const { api } = makeApi([cat]);
    const html = render(<Step4Estimate api={api} shopRank="detailer" screenConfig={SC} />);
    assert.ok(html.includes(marker), `expected marker ${marker} for ${cat}`);
  });
}

test("only the selected categories appear in the section navigation", () => {
  const { api } = makeApi(["maintenance"]);
  const html = render(<Step4Estimate api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ボディ定期メンテナンス"), "selected category label present");
  assert.ok(!html.includes("ウィンドウフィルム"), "unselected category label absent");
  assert.ok(!html.includes("その他作業"), "unselected category label absent");
});

test("store-global options render as the eighth cross-category section", () => {
  const { api } = makeApi(["coating"]);
  const html = render(<Step4Estimate api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ZZGLOBALOPT"), "global option rendered though it is not a Screen-3 category");
});

test("no categories selected → placeholder, no selector/global section", () => {
  const { api } = makeApi([]);
  const html = render(<Step4Estimate api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(!html.includes("ZZGLOBALOPT"), "global options hidden when nothing selected");
});

// ── 8. Rank locks enforced ──────────────────────────────────────────────────────

// B2-E2H1-F — this test has now shed BOTH of its original rank locks, in two steps.
//
// It once asserted that `shop` could sell neither PPF nor window film. B2-E2G-R made both of them
// managed service families, so rank decides neither: the dealer's explicit opt-in does. The window
// half was inverted then; the PPF half was missed and kept asserting a message the source no longer
// produces, which is what B2-E2H1 caught. Both halves are now inverted, which is the sharpest
// available proof that rank has left this decision entirely.
//
// `shop` is deliberately the rank under test — it is the rank that was previously excluded from both
// families, so if any rank rule survived anywhere, this is where it would still show.
test("shop rank can use BOTH PPF and window film once the dealer opts in", () => {
  const ppf = render(<Step4Estimate api={makeApi(["ppf"]).api} shopRank="shop" screenConfig={SC} />);
  assert.ok(ppf.includes("ZZPPFMETHOD"), "shop rank can select PPF methods when opted in and configured");
  assert.equal(
    ppf.includes("GYEONショップランクでは PPF は施工できません。"), false,
    "the retired rank-based PPF lock must not reappear",
  );

  const win = render(<Step4Estimate api={makeApi(["window"]).api} shopRank="shop" screenConfig={SC} />);
  assert.ok(win.includes("ZZFILMTYPE"), "shop rank can select film types when opted in and configured");
  assert.equal(
    win.includes("GYEONショップランクではウィンドウフィルムは選択できません。"), false,
    "the retired rank-based window-film lock must not reappear",
  );
});

test("full PPF renders the formal coverage and vehicle-coefficient controls without a manual price field", () => {
  const services = fresh();
  services.ppf = {
    ...services.ppf,
    installationMethod: "full",
    fullCoverage: "front_full",
    ppfTypeId: "pt1",
    unitPriceInput: "999999",
    vehicleCoefficientInput: "1.2",
  };
  const html = render(<Step4Estimate api={makeApi(["ppf"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("施工範囲を選択"), "coverage selector is visible");
  assert.ok(html.includes("フロントフル"), "front-full choice is visible");
  assert.ok(html.includes("フルボディ"), "full-body choice is visible");
  assert.ok(html.includes("車格係数（通常車は1.0）"), "vehicle coefficient is visible");
  assert.ok(html.includes("施工範囲の価格 × PPF施工係数 × 車格係数"), "formal calculation is explained");
  assert.equal(html.includes("単価を上書き"), false, "manual unit-price override is absent");
  assert.equal(html.includes("999999"), false, "legacy manual value is not rendered");
});

test("ppf_installer rank locks coating", () => {
  const html = render(<Step4Estimate api={makeApi(["coating"]).api} shopRank="ppf_installer" screenConfig={SC} />);
  assert.ok(html.includes("GYEON PPFインストーラーはコーティングを施工できません。"), "coating lock reason shown");
});

// ── 8b. B2-E2E — window film is an ALL-RANKS, dealer-owned OPT-IN ───────────────
//
// Rank no longer participates in this decision at any layer. The runtime resolver's rank list is
// gone, and so is this host's `shop` lock. What remains is the dealer's explicit opt-in, plus the
// question of whether they have actually finished configuring it.
//
// Each case below sweeps ALL FOUR ranks deliberately. A single-rank assertion would still pass if
// someone reintroduced a rank rule for the other three, which is exactly the regression this
// contract exists to prevent — and exactly the bug that shipped when two rank rules disagreed.
const ALL_RANKS = ["shop", "detailer", "ppf_installer", "certified"] as const;
const FILM_SETUP_REQUIRED = "ウィンドウフィルムを利用するには、見積設定（見積ウィザード設定）でフィルム種類を登録してください。";

test("OPTED OUT: the window-film section is absent for every rank, and nothing else is affected", () => {
  const optedOut: WizardScreenConfiguration = {
    ...SC,
    serviceOfferings: { ...SC.serviceOfferings, window_film: false },
  };

  for (const rank of ALL_RANKS) {
    const win = render(<Step4Estimate api={makeApi(["window"]).api} shopRank={rank} screenConfig={optedOut} />);
    // ABSENT, not merely locked: no film types, no areas, and no setup prompt either. A dealer who
    // does not sell window film has nothing to fix and must never be nagged to configure it.
    assert.equal(win.includes("ZZFILMTYPE"), false, `${rank}: no film types offered`);
    assert.equal(win.includes("ZZWINDOWAREA"), false, `${rank}: no installation areas offered`);
    assert.equal(win.includes(FILM_SETUP_REQUIRED), false, `${rank}: opted out is not "incomplete"`);
    // FIXED BEHAVIOUR (B2-E2H1-F): when the only selected category belongs to an opted-out family
    // there is nothing left to open, so Step 4 renders its existing NO-SELECTION PLACEHOLDER. It
    // must not silently open some other category the operator never chose, and the cross-category
    // store-global section does not render either — that section belongs to a selection, and there
    // is none. This assertion previously claimed the opposite; the contradiction is what B2-E2H1
    // surfaced. The wizard being alive is proven below on a render that HAS a visible selection.
    assert.equal(win.includes("ZZGLOBALOPT"), false, `${rank}: no cross-category section without a selection`);

    // Non-film categories are untouched — an opted-out dealer estimates normally.
    const maint = render(<Step4Estimate api={makeApi(["maintenance"]).api} shopRank={rank} screenConfig={optedOut} />);
    assert.ok(maint.includes("ZZMAINTMENU"), `${rank}: maintenance fully usable while opted out`);
  }
});

test("OPTED IN but INCOMPLETE: only window film is locked; the wizard is never blocked", () => {
  const noFilmTypes: WizardScreenConfiguration = { ...SC, filmTypes: [] };   // opted in via SC
  const noAreas: WizardScreenConfiguration = { ...SC, windowAreas: [] };     // opted in via SC

  for (const rank of ALL_RANKS) {
    const win = render(<Step4Estimate api={makeApi(["window"]).api} shopRank={rank} screenConfig={noFilmTypes} />);
    assert.ok(win.includes(FILM_SETUP_REQUIRED), `${rank}: setup-required state shown`);
    assert.equal(win.includes("ZZWINDOWAREA"), false, `${rank}: no selectable area while locked`);
    assert.ok(win.includes("ZZGLOBALOPT"), `${rank}: wizard still mounted, not unavailable`);

    // Missing AREAS is a distinct state: areas are global catalog rows, so the dealer cannot
    // register them and must not be told to go and do so.
    const areas = render(<Step4Estimate api={makeApi(["window"]).api} shopRank={rank} screenConfig={noAreas} />);
    assert.ok(areas.includes("ウィンドウフィルムの施工部位が利用できません。管理者にお問い合わせください。"),
      `${rank}: areas-unavailable state shown`);
    assert.equal(areas.includes(FILM_SETUP_REQUIRED), false, `${rank}: must not claim film types are missing`);

    // Incomplete film setup never blocks a non-film estimate.
    const maint = render(<Step4Estimate api={makeApi(["maintenance"]).api} shopRank={rank} screenConfig={noFilmTypes} />);
    assert.ok(maint.includes("ZZMAINTMENU"), `${rank}: maintenance fully usable despite incomplete film setup`);
  }
});

test("OPTED IN and configured: window film is fully usable by every rank", () => {
  for (const rank of ALL_RANKS) {
    const win = render(<Step4Estimate api={makeApi(["window"]).api} shopRank={rank} screenConfig={SC} />);
    assert.ok(win.includes("ZZFILMTYPE"), `${rank}: film types selectable`);
    assert.ok(win.includes("ZZWINDOWAREA"), `${rank}: installation areas selectable`);
    assert.equal(win.includes(FILM_SETUP_REQUIRED), false, `${rank}: no setup prompt when configured`);
  }
});

// ── 8c. B2-E2G — the SAME rules hold for all five managed families ─────────────
//
// Sweeping every family and every rank together is the point. A per-family test would still pass if
// someone reintroduced a rank rule for one service, and a per-rank test would still pass if one
// family were wired to the wrong offering key. Only the full cross-product catches both.
const FAMILY_CASES = [
  { family: "window_film",   category: "window",      marker: "ZZFILMTYPE" },
  { family: "ppf",           category: "ppf",         marker: "ZZPPFMETHOD" },
  { family: "maintenance",   category: "maintenance", marker: "ZZMAINTMENU" },
  { family: "car_wash",      category: "carwash",     marker: "ZZWASHMENU" },
  { family: "room_cleaning", category: "roomclean",   marker: "ZZROOMMENU" },
] as const;

test("every managed family: OFF hides only itself, ON+configured shows it, for every rank", () => {
  for (const { family, category, marker } of FAMILY_CASES) {
    for (const rank of ALL_RANKS) {
      // OPTED IN + configured → the family's own content renders.
      const on = render(<Step4Estimate api={makeApi([category]).api} shopRank={rank} screenConfig={SC} />);
      assert.ok(on.includes(marker), `${family}/${rank}: content renders when offered and configured`);

      // OPTED OUT → absent, and NOT merely empty: its marker is gone…
      const offConfig: WizardScreenConfiguration = {
        ...SC,
        serviceOfferings: { ...SC.serviceOfferings, [family]: false },
      };
      const off = render(<Step4Estimate api={makeApi([category]).api} shopRank={rank} screenConfig={offConfig} />);
      assert.equal(off.includes(marker), false, `${family}/${rank}: content absent when not offered`);
      // …while EVERY OTHER family is untouched by that one switch.
      for (const other of FAMILY_CASES) {
        if (other.family === family) continue;
        const still = render(
          <Step4Estimate api={makeApi([other.category]).api} shopRank={rank} screenConfig={offConfig} />,
        );
        assert.ok(still.includes(other.marker),
          `${family} OFF must not affect ${other.family} (${rank})`);
      }
    }
  }
});

test("no-selection fallback: the only selected family being OFF opens nothing", () => {
  // The canonical draft still holds "window"; the screen simply presents no section, rather than
  // silently opening a category the operator never chose.
  const optedOut: WizardScreenConfiguration = {
    ...SC,
    serviceOfferings: { ...SC.serviceOfferings, window_film: false },
  };
  const html = render(<Step4Estimate api={makeApi(["window"]).api} shopRank="detailer" screenConfig={optedOut} />);
  for (const { marker } of FAMILY_CASES) {
    assert.equal(html.includes(marker), false, `no family content may render (${marker})`);
  }
  assert.equal(html.includes("ZZGLOBALOPT"), false, "no cross-category section when nothing is selectable");
});

test("PPF incomplete directs the operator to an ADMINISTRATOR, never to dealer settings", () => {
  // PPF prerequisites are GLOBAL rows the dealer cannot author, so a settings prompt would send
  // them somewhere that cannot help — the message must not be broader than the condition it names.
  const noPpf: WizardScreenConfiguration = { ...SC, ppfMethods: [], ppfParts: [], ppfTypeGroups: [] };
  for (const rank of ALL_RANKS) {
    const html = render(<Step4Estimate api={makeApi(["ppf"]).api} shopRank={rank} screenConfig={noPpf} />);
    assert.ok(html.includes("管理者にお問い合わせください"), `${rank}: administrator-directed message`);
    assert.equal(html.includes("見積ウィザード設定"), false, `${rank}: must not point at dealer settings`);
  }
});

// ── 9. EstimateWizard requires and threads shopRank + screenConfig ─────────────────

// Authoritative-shape empty test pricing config (labels only; no fixture/default values).
const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};

test("EstimateWizard mounts with the required runtime inputs", () => {
  const html = render(
    <EstimateWizard shopRank="detailer" screenConfig={SC} catalog={makePricingCatalog()} pricingConfig={PC}
      customers={CUSTOMER_REFS} vehicles={VEHICLE_REFS} />,
  );
  assert.ok(html.length > 0, "root wizard renders with runtime inputs supplied");
});

test("EstimateWizard threads shopRank + screenConfig ONLY to Step4Estimate (source guard)", () => {
  const raw = readFileSync(WIZARD_SRC, "utf8");
  assert.match(
    raw,
    /<Step4Estimate\s+api=\{api\}\s+shopRank=\{shopRank\}\s+screenConfig=\{screenConfig\}\s*\/>/,
    "Step4Estimate receives both runtime inputs",
  );
  assert.equal((raw.match(/shopRank=\{shopRank\}/g) ?? []).length, 1, "shopRank passed exactly once");
  assert.equal((raw.match(/screenConfig=\{screenConfig\}/g) ?? []).length, 1, "screenConfig passed exactly once");
  const code = codeOf(WIZARD_SRC);
  assert.equal(
    /(?:useState|useReducer)[^;\n]*(?:shopRank|screenConfig)|(?:shopRank|screenConfig)[^;\n]*(?:useState|useReducer)/.test(code),
    false,
    "runtime inputs are not stored in host state",
  );
});

// ── 10. Source-level guards: no forbidden systems / data enter the canonical host ──

test("binding + step sources reject prohibited imports, data, and ID sources", () => {
  for (const src of [BIND_SRC, STEP_SRC]) {
    const code = codeOf(src);
    assert.equal(/ScreensPreview/.test(code), false, `${src}: no ScreensPreview`);
    assert.equal(/EstimateWizardContainer|production\//.test(code), false, `${src}: no production container`);
    assert.equal(/EXAMPLE_|DEFAULT_|PREVIEW_/.test(code), false, `${src}: no preview/example/default data`);
    assert.equal(/useWizardPricing/.test(code), false, `${src}: no pricing hook`);
    assert.equal(/safe-random-uuid/.test(code), false, `${src}: no safe-random-uuid`);
    assert.equal(/Math\.random/.test(code), false, `${src}: no Math.random`);
    assert.equal(/Date\.now|new Date/.test(code), false, `${src}: not time-based`);
    assert.equal(/from ["'][^"']*\/(pricing|save|integration)\//.test(code), false, `${src}: no pricing/save/integration dep`);
    assert.equal(/supabase|next\/(navigation|router|image)/.test(code), false, `${src}: no route/db dep`);
    assert.equal(/api\.draft/.test(code), false, `${src}: no direct api.draft access`);
  }
});

test("binding module is pure (imports no React) and uses the row-ID authority", () => {
  const code = codeOf(BIND_SRC);
  assert.equal(/from ["']react["']|React\./.test(code), false, "no React in the pure binding layer");
  assert.equal(/createWizardRowId/.test(code), true, "uses the Web-Crypto row-ID authority");
  // no counter/length/index-based ID fabrication
  assert.equal(/\.length\s*\+|\+\+|Seq|counter/.test(code), false, "no counter/length-based ids");
});

test("PPF price + coefficient placeholders stay null/omitted; no example price literal", () => {
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.match(raw, /displayedUnitPrice=\{null\}/, "PPF displayedUnitPrice null");
  assert.match(raw, /coefficientDisplay=\{null\}/, "PPF coefficientDisplay null");
  assert.match(raw, /combinedServiceAdjustment=\{null\}/, "PPF combinedServiceAdjustment null");
  assert.equal(/180000/.test(raw), false, "no 180000 example price literal");
});
