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
import { Step4Estimate, attachedPartialPpfPatch, repairedDedicatedMenuQuantity, type PpfPricingReadiness } from "./Step4Estimate";

// GDA-ESTIMATE-SAVE-PRICING-GUARD-R1 — the host-derived PPF pricing readiness is a REQUIRED Step-4
// input. Every pre-existing render passes "ready" so it keeps exercising the surface it always did.
const PPF_READY: PpfPricingReadiness = { ready: true };
import {
  createStep4Bindings,
  dedicatedMenuBoundsValid,
  dedicatedMenuDraftOf,
  dedicatedMenuPriceValid,
  initialDedicatedMenuQuantity,
  isQuantityWithinMenuBounds,
  DEDICATED_MENU_INITIAL_QUANTITY,
  OTHER_COATING_INITIAL_QUANTITY,
  initialOtherCoatingQuantity,
  isOtherCoatingFixedOne,
  otherCoatingDraftOf,
  toOtherCoatingMenuRef,
  type DedicatedMenuRef,
  type OtherCoatingMenuRef,
  type Step4UpdateStore,
} from "./step4-bindings";
import { initialCanonicalDraft, projectStore, applyStorePatch, type WizardStorePatch } from "../bridge/ew-ui1-controller";
import { initialWizardStore, type WizardStore } from "../wizard-types";
import type { WizardServiceConfigurationDraft } from "../draft/wizard-draft-types";
import type { WizardRowIdCryptoSource } from "../contract/wizard-row-id";
import type { WizardScreenConfiguration } from "../contract/wizard-runtime-inputs";
import { reconcilePartialPpfReviewOverrides, type EstimateWizardApi } from "../useEstimateWizard";
import { PpfPartialPartsSelector } from "../screens/PpfPartialPartsSelector";
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
  // Window film readiness is decided by the authoritative `isWindowFilmV1RuntimeReady` predicate:
  // a valid (non-disabled, coefficient-bearing) film AND an active priced/duration area or package
  // in the V1 settings. A genuinely configured dealer carries both.
  filmTypes:          [{ id: "ft1", label: "ZZFILMTYPE", installationCoefficientBp: 12_500 }],
  windowAreas:        [{ id: "front-windshield", label: "ZZWINDOWAREA" }],
  windowFilmSettings: {
    contractVersion: "1.0", revision: 1,
    areas: {
      "front-windshield":  { priceYen: 30_000, durationMinutes: 60, isActive: true },
      "front-door-glass":  { priceYen: null, durationMinutes: null, isActive: false },
      "rear-door-glass":   { priceYen: null, durationMinutes: null, isActive: false },
      "triangular-window": { priceYen: null, durationMinutes: null, isActive: false },
      "quarter-glass":     { priceYen: null, durationMinutes: null, isActive: false },
      "rear-glass":        { priceYen: null, durationMinutes: null, isActive: false },
      sunroof:             { priceYen: null, durationMinutes: null, isActive: false },
    },
    packages: [],
    options: [],
  },
  maintenanceMenus:   [{ id: "mm1", name: "ZZMAINTMENU", defaultPrice: 5000 }],
  washMenus:          [{ id: "cw1", name: "ZZWASHMENU", defaultPrice: 3000 }],
  roomMenus:          [{ id: "rc1", name: "ZZROOMMENU", defaultPrice: 4000 }],
  // B5b2 — dealer-authored dedicated menus (EXPLICIT arrays, as the runtime resolver supplies them).
  // The wheel menu carries a configured price and no maximum; the glass menu deliberately has NO
  // configured price and a maximum, so both branches of the prefill/bounds rules are exercised.
  wheelMenus:         [{ kind: "wheel_menu", id: "wm1", name: "ZZWHEELMENU", defaultUnitPrice: 8000, quantityRequired: true, minQty: 1, maxQty: null }],
  glassMenus:         [{ kind: "glass_menu", id: "gm1", name: "ZZGLASSMENU", defaultUnitPrice: null, quantityRequired: true, minQty: 1, maxQty: 6 }],
  // GDA-OTHER-COATINGS-R1 (C3) — dealer-authored other-coating items (C2 projection). One FIXED-ONE
  // item with a positive configured price, one QUANTITY-BEARING item with bounds and NO configured price.
  otherCoatingMenus:  [
    { kind: "other_coating_menu", id: "oc_fixed", name: "ZZOCFIXED", defaultUnitPrice: 15000, quantityRequired: false },
    { kind: "other_coating_menu", id: "oc_qty",   name: "ZZOCQTY",   defaultUnitPrice: null,  quantityRequired: true, minQty: 2, maxQty: 5 },
  ],
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
    // B5b2 — the two dedicated sections are section-scoped exactly like the eight above.
    [() => b.wheel.onMenuToggle({ id: "wm1", defaultUnitPrice: 8000, minQty: 1, maxQty: null }), "wheel"],
    [() => b.wheel.onUnitPriceChange("wm1", "1"), "wheel"],
    [() => b.glass.onMenuToggle({ id: "gm1", defaultUnitPrice: null, minQty: 1, maxQty: 6 }), "glass"],
    [() => b.glass.onQuantityChange({ id: "gm1", defaultUnitPrice: null, minQty: 1, maxQty: 6 }, 2), "glass"],
    // C3 — the distinct other-coating section is section-scoped exactly like the ten above.
    [() => b.otherCoating.onMenuToggle({ id: "oc_fixed", defaultUnitPrice: 15000, quantityRequired: false }), "otherCoating"],
    [() => b.otherCoating.onUnitPriceChange("oc_fixed", "1"), "otherCoating"],
    [() => b.otherCoating.onQuantityChange({ id: "oc_qty", defaultUnitPrice: null, quantityRequired: true, minQty: 2, maxQty: 5 }, 3), "otherCoating"],
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
  wheel: "ZZWHEELMENU",   // B5b2 dedicated section
  glass: "ZZGLASSMENU",   // B5b2 dedicated section
  other_coating: "ZZOCFIXED", // C3 distinct other-coating section
  other: "ZZOTHERPRESET",
};

for (const [cat, marker] of Object.entries(SECTION_MARKER)) {
  test(`category "${cat}" renders its controlled selector section`, () => {
    const { api } = makeApi([cat]);
    const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
    assert.ok(html.includes(marker), `expected marker ${marker} for ${cat}`);
  });
}

test("coating upper-layer choices enforce the current shop rank in the rendered UI", () => {
  const services = fresh();
  services.coating = { ...services.coating, layerCount: 2, layer1Id: "one-evo" };

  const detailer = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(detailer.includes("Q² CANCOAT PRO EVO"), false, "detailer must not see certified-only CANCOAT PRO EVO");

  const certified = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"], services).api} shopRank="certified" screenConfig={SC} />);
  assert.ok(certified.includes("Q² CANCOAT PRO EVO"), "certified shop keeps the approved CANCOAT PRO EVO option");
});

test("only the selected categories appear in the section navigation", () => {
  const { api } = makeApi(["maintenance"]);
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ボディ定期メンテナンス"), "selected category label present");
  assert.ok(!html.includes("ウィンドウフィルム"), "unselected category label absent");
  assert.ok(!html.includes("その他作業"), "unselected category label absent");
});

test("store-global options render as the eighth cross-category section", () => {
  const { api } = makeApi(["coating"]);
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ZZGLOBALOPT"), "global option rendered though it is not a Screen-3 category");
});

test("no categories selected → placeholder, no selector/global section", () => {
  const { api } = makeApi([]);
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
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
  const ppf = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["ppf"]).api} shopRank="shop" screenConfig={SC} />);
  assert.ok(ppf.includes("ZZPPFMETHOD"), "shop rank can select PPF methods when opted in and configured");
  assert.equal(
    ppf.includes("GYEONショップランクでは PPF は施工できません。"), false,
    "the retired rank-based PPF lock must not reappear",
  );

  const win = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank="shop" screenConfig={SC} />);
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
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["ppf"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("施工範囲を選択"), "coverage selector is visible");
  assert.ok(html.includes("フロントフル"), "front-full choice is visible");
  assert.ok(html.includes("フルボディ"), "full-body choice is visible");
  assert.ok(html.includes("車格係数（通常車は1.0）"), "vehicle coefficient is visible");
  assert.ok(html.includes("施工範囲の価格 × PPF施工係数 × 車格係数"), "formal calculation is explained");
  assert.equal(html.includes("単価を上書き"), false, "manual unit-price override is absent");
  assert.equal(html.includes("999999"), false, "legacy manual value is not rendered");
});

test("ppf_installer rank locks coating", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"]).api} shopRank="ppf_installer" screenConfig={SC} />);
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
    const win = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank={rank} screenConfig={optedOut} />);
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
    const maint = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["maintenance"]).api} shopRank={rank} screenConfig={optedOut} />);
    assert.ok(maint.includes("ZZMAINTMENU"), `${rank}: maintenance fully usable while opted out`);
  }
});

test("OPTED IN but INCOMPLETE: only window film is locked; the wizard is never blocked", () => {
  // Each variant removes the AUTHORITATIVE readiness field it claims to test (see the SC comment):
  // no valid film at all, or no active priced/duration area (and no package) in the V1 settings.
  const noFilmTypes: WizardScreenConfiguration = { ...SC, filmTypes: [] };   // opted in via SC
  const noAreas: WizardScreenConfiguration = {                               // opted in via SC
    ...SC,
    windowAreas: [],
    windowFilmSettings: {
      ...SC.windowFilmSettings!,
      areas: Object.fromEntries(
        Object.entries(SC.windowFilmSettings!.areas).map(([code, area]) => [code, { ...area, isActive: false }]),
      ) as NonNullable<WizardScreenConfiguration["windowFilmSettings"]>["areas"],
      packages: [],
    },
  };

  for (const rank of ALL_RANKS) {
    const win = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank={rank} screenConfig={noFilmTypes} />);
    assert.ok(win.includes(FILM_SETUP_REQUIRED), `${rank}: setup-required state shown`);
    assert.equal(win.includes("ZZWINDOWAREA"), false, `${rank}: no selectable area while locked`);
    assert.ok(win.includes("ZZGLOBALOPT"), `${rank}: wizard still mounted, not unavailable`);

    // Missing AREAS is a distinct state: films exist, but no active priced/duration area or set
    // resolves from the dealer's window-film settings. The reason names THAT destination, and must
    // not claim film types are missing.
    const areas = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank={rank} screenConfig={noAreas} />);
    assert.ok(areas.includes("ウィンドウフィルム設定で、提供する部位またはセットの金額と所要時間を登録してください。"),
      `${rank}: areas-unavailable state shown`);
    assert.equal(areas.includes(FILM_SETUP_REQUIRED), false, `${rank}: must not claim film types are missing`);

    // Incomplete film setup never blocks a non-film estimate.
    const maint = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["maintenance"]).api} shopRank={rank} screenConfig={noFilmTypes} />);
    assert.ok(maint.includes("ZZMAINTMENU"), `${rank}: maintenance fully usable despite incomplete film setup`);
  }
});

test("OPTED IN and configured: window film is fully usable by every rank", () => {
  for (const rank of ALL_RANKS) {
    const win = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank={rank} screenConfig={SC} />);
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
      const on = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi([category]).api} shopRank={rank} screenConfig={SC} />);
      assert.ok(on.includes(marker), `${family}/${rank}: content renders when offered and configured`);

      // OPTED OUT → absent, and NOT merely empty: its marker is gone…
      const offConfig: WizardScreenConfiguration = {
        ...SC,
        serviceOfferings: { ...SC.serviceOfferings, [family]: false },
      };
      const off = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi([category]).api} shopRank={rank} screenConfig={offConfig} />);
      assert.equal(off.includes(marker), false, `${family}/${rank}: content absent when not offered`);
      // …while EVERY OTHER family is untouched by that one switch.
      for (const other of FAMILY_CASES) {
        if (other.family === family) continue;
        const still = render(
          <Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi([other.category]).api} shopRank={rank} screenConfig={offConfig} />,
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
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["window"]).api} shopRank="detailer" screenConfig={optedOut} />);
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
    const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["ppf"]).api} shopRank={rank} screenConfig={noPpf} />);
    assert.ok(html.includes("管理者にお問い合わせください"), `${rank}: administrator-directed message`);
    assert.equal(html.includes("見積ウィザード設定"), false, `${rank}: must not point at dealer settings`);
  }
});

// ── 8c2. GDA-ESTIMATE-SAVE-PRICING-GUARD-R1 — PPF pricing readiness locks the section ──────
//
// Global PPF rows (methods/parts/groups) alone once made the section "ready". A dealer with PPF
// offered but no authoritative R1 price table, or a selectable PPF product without an install
// coefficient, could then select PPF and reach Step 7, where save failed closed. The section must
// stay VISIBLE (offered) but LOCKED, with a reason naming the dealer-fixable settings destination.
//
// The production messages contain a literal ">" (settings breadcrumb). `renderToStaticMarkup`
// escapes text-node ">" as "&gt;", so the assertions compare against the ESCAPED form of the exact
// message — the message itself is not weakened, and production is not altered to suit the markup.
const escapeMarkupText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PPF_PRICE_TABLE_REASON = escapeMarkupText("PPFを利用するには、設定 > PPF種類・施工係数 でPPFの基準価格表を保存してください。");
const PPF_COEFFICIENT_REASON = escapeMarkupText("PPFを利用するには、設定 > PPF種類・施工係数 ですべてのPPF種類の施工係数を登録してください。");

test("PPF offered + catalog rows present + price table missing → locked with the settings reason", () => {
  const notReady: PpfPricingReadiness = { ready: false, reason: "price-table-missing" };
  for (const rank of ALL_RANKS) {
    const html = render(<Step4Estimate ppfPricingReadiness={notReady} api={makeApi(["ppf"]).api} shopRank={rank} screenConfig={SC} />);
    assert.ok(html.includes("PPF（ペイント プロテクション フィルム）"), `${rank}: section still visible (offered)`);
    assert.ok(html.includes(PPF_PRICE_TABLE_REASON), `${rank}: actionable settings reason shown`);
    assert.equal(html.includes("ZZPPFMETHOD"), false, `${rank}: no selectable PPF method while locked`);
    assert.equal(html.includes("管理者にお問い合わせください"), false, `${rank}: not misdirected to an administrator`);
    // A locked family never blocks a service the dealer HAS configured.
    const maint = render(<Step4Estimate ppfPricingReadiness={notReady} api={makeApi(["maintenance"]).api} shopRank={rank} screenConfig={SC} />);
    assert.ok(maint.includes("ZZMAINTMENU"), `${rank}: maintenance unaffected`);
  }
});

test("PPF price table present but a selectable product coefficient missing → locked", () => {
  const notReady: PpfPricingReadiness = { ready: false, reason: "coefficient-missing" };
  const html = render(<Step4Estimate ppfPricingReadiness={notReady} api={makeApi(["ppf"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes(PPF_COEFFICIENT_REASON), "coefficient reason shown");
  assert.equal(html.includes("ZZPPFMETHOD"), false, "no selectable PPF method while locked");
  // The attached partial-PPF action is disabled with the same reason, never hidden as opt-out.
  const coating = render(<Step4Estimate ppfPricingReadiness={notReady} api={makeApi(["coating"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(coating.includes("部分PPFを追加"), "attached action still rendered");
  assert.ok(coating.includes(PPF_COEFFICIENT_REASON), "attached action carries the pricing reason");
});

test("PPF price table + all coefficients present → the existing selection flow stays enabled", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["ppf"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ZZPPFMETHOD"), "PPF methods selectable");
  assert.equal(html.includes(PPF_PRICE_TABLE_REASON), false);
  assert.equal(html.includes(PPF_COEFFICIENT_REASON), false);
});

test("missing GLOBAL rows still take precedence over the dealer pricing reason", () => {
  const noPpf: WizardScreenConfiguration = { ...SC, ppfMethods: [], ppfParts: [], ppfTypeGroups: [] };
  const notReady: PpfPricingReadiness = { ready: false, reason: "price-table-missing" };
  const html = render(<Step4Estimate ppfPricingReadiness={notReady} api={makeApi(["ppf"]).api} shopRank="detailer" screenConfig={noPpf} />);
  assert.ok(html.includes("管理者にお問い合わせください"), "administrator reason when the dealer cannot fix it");
  assert.equal(html.includes(PPF_PRICE_TABLE_REASON), false, "settings reason must not be broader than its condition");
});

// ── 8d. GDA-ESTIMATE-PPF-OFFERING-R1-A — attached partial PPF from coating-only selection ──

const ATTACHED_PARTIAL_PPF_LABEL = "部分PPFを追加";

test("attachedPartialPpfPatch: appends ppf, preserves existing category order, sets only installationMethod=partial", () => {
  assert.deepEqual(attachedPartialPpfPatch(["coating"]), {
    categories: ["coating", "ppf"],
    services: { ppf: { installationMethod: "partial" } },
  });
  assert.deepEqual(attachedPartialPpfPatch(["window", "coating"]), {
    categories: ["window", "coating", "ppf"],
    services: { ppf: { installationMethod: "partial" } },
  });
});

test("attachedPartialPpfPatch: does not duplicate an already-present ppf category", () => {
  const patch = attachedPartialPpfPatch(["coating", "ppf"]);
  assert.deepEqual(patch.categories, ["coating", "ppf"]);
  assert.equal((patch.categories ?? []).filter((c) => c === "ppf").length, 1);
});

test("coating-only + PPF offered and configured renders the attached partial-PPF action", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes(ATTACHED_PARTIAL_PPF_LABEL), "attached action rendered");
  assert.ok(html.includes("Q² ONE EVO"), "existing coating section content still renders alongside it");
});

test("PPF not offered: coating-only selection shows no attached action", () => {
  const offConfig: WizardScreenConfiguration = { ...SC, serviceOfferings: { ...SC.serviceOfferings, ppf: false } };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"]).api} shopRank="detailer" screenConfig={offConfig} />);
  assert.equal(html.includes(ATTACHED_PARTIAL_PPF_LABEL), false, "no attached action when PPF is not offered");
});

test("PPF already selected: no attached action; the existing PPF tab remains authoritative", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating", "ppf"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(html.includes(ATTACHED_PARTIAL_PPF_LABEL), false, "no attached action once main PPF is already selected");
});

test("attached action absent for a non-coating selection even when PPF is offered", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["maintenance"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(html.includes(ATTACHED_PARTIAL_PPF_LABEL), false, "no attached action without coating selected");
});

test("PPF offered but prerequisites incomplete: attached action renders disabled with the existing administrator reason", () => {
  const noPpf: WizardScreenConfiguration = { ...SC, ppfMethods: [], ppfParts: [], ppfTypeGroups: [] };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["coating"]).api} shopRank="detailer" screenConfig={noPpf} />);
  assert.ok(html.includes(ATTACHED_PARTIAL_PPF_LABEL), "attached action still rendered, not hidden as opt-out");
  assert.ok(html.includes("管理者にお問い合わせください"), "existing administrator-directed setup reason shown");
  assert.equal(html.includes("見積ウィザード設定"), false, "must not mislabel this as dealer opt-out");
  assert.match(
    readFileSync(STEP_SRC, "utf8"),
    /disabled=\{!attachedPartialPpfComplete\}/,
    "the attached action is disabled, not hidden, when incomplete",
  );
});

test("activating the attached action applies exactly one canonical patch through api.updateStore and opens the PPF section", () => {
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.match(
    raw,
    /api\.updateStore\(attachedPartialPpfPatch\(categories\)\)/,
    "the enabled action applies the pure canonical patch through the single api.updateStore route",
  );
  assert.match(raw, /setActiveSection\(["']ppf["']\)/, "activating the action opens the existing PPF section");
  assert.match(
    raw,
    /onClick=\{attachedPartialPpfComplete \? onAttachPartialPpf : undefined\}/,
    "the canonical patch is reachable only while PPF prerequisites are complete",
  );
});

test("selecting main PPF still exposes both full and partial installation methods", () => {
  const scWithBothMethods: WizardScreenConfiguration = {
    ...SC,
    ppfMethods: [
      { id: "full", label: "ZZFULLMETHOD" },
      { id: "partial", label: "ZZPARTIALMETHOD" },
    ],
  };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["ppf"]).api} shopRank="detailer" screenConfig={scWithBothMethods} />);
  assert.ok(html.includes("ZZFULLMETHOD"), "full method selectable");
  assert.ok(html.includes("ZZPARTIALMETHOD"), "partial method selectable");
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
    /<Step4Estimate\s+api=\{api\}\s+shopRank=\{shopRank\}\s+screenConfig=\{screenConfig\}\s+ppfPricingReadiness=\{ppfPricingReadiness\}\s*\/>/,
    "Step4Estimate receives both runtime inputs plus ONLY the derived PPF pricing readiness",
  );
  assert.equal(/<Step4Estimate[^>]*\b(catalog|pricingConfig)=/.test(raw), false, "Step4 never receives catalog/pricingConfig");
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

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — Step 4 keeps its patch shape; the hook reconciles review buffers ──

test("Stage B: Step-4 PPF quantity/type/method callbacks still emit the SAME store-patch shape (no review key, no pricing)", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings({ ...fresh(), ppf: { ...fresh().ppf, quantitiesByPart: { bonnet: 2 } } }, updateStore);
  b.ppf.onQuantityChange("bonnet", 3);
  assert.deepEqual(patches.at(-1), { services: { ppf: { quantitiesByPart: { bonnet: 3 } } } });
  b.ppf.onPpfTypeChange("t2");
  assert.deepEqual(patches.at(-1), { services: { ppf: { ppfTypeId: "t2" } } });
  for (const p of patches) assert.equal("review" in p, false, "Step 4 never writes review state");
  for (const src of [BIND_SRC, STEP_SRC]) {
    const code = codeOf(src);
    assert.equal(/quantityInputsByLine|unitPriceInputsByLine|reconcilePartialPpf|applyServiceLineAdjustment|\.review\b/.test(code), false, `${src}: never reads or writes review state`);
  }
});

test("Stage B: a validated Step-4 quantity patch followed by the hook reducer clears that part's review buffer (Step 4 → Step 7 write-through)", () => {
  const seeded = initialCanonicalDraft({ categories: ["ppf"], services: { ppf: { installationMethod: "partial", ppfTypeId: "t1", selectedPartIds: ["bonnet", "fender"], quantitiesByPart: { bonnet: 2 } } } });
  assert.equal(seeded.serviceConfiguration.ppf.ppfTypeId, "t1", "PRECONDITION: initial patch accepted");
  const withBuffers = { ...seeded, review: { ...seeded.review, quantityInputsByLine: { "manual:ppf:ppf_r1_partial_t1_bonnet": "2", "manual:ppf:ppf_r1_partial_t1_fender": "abc" } } };
  const patched = applyStorePatch(withBuffers, { services: { ppf: { quantitiesByPart: { bonnet: 3 } } } });
  assert.equal(patched.ok, true);
  if (!patched.ok) return;
  const next = reconcilePartialPpfReviewOverrides(withBuffers, patched.draft);
  assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.bonnet, 3);
  assert.deepEqual(next.review.quantityInputsByLine, { "manual:ppf:ppf_r1_partial_t1_fender": "abc" }, "only the edited part's buffer is cleared; the invalid fender text stays visible");
  const typeChanged = applyStorePatch(next, { services: { ppf: { ppfTypeId: "t2" } } });
  assert.equal(typeChanged.ok, true);
  if (!typeChanged.ok) return;
  assert.deepEqual(reconcilePartialPpfReviewOverrides(next, typeChanged.draft).review.quantityInputsByLine, {}, "type change clears every partial buffer");
});

test("Stage B: the partial-parts selector shows a quantity stepper for EVERY selected, enabled part (bounds from the part, default 1)", () => {
  const html = renderToStaticMarkup(
    <PpfPartialPartsSelector
      parts={[{ id: "bonnet", label: "ZZBONNET", quantityRequired: true, minQty: 1, maxQty: 4 }, { id: "fender", label: "ZZFENDER" }, { id: "roof", label: "ZZROOF", disabled: true, disabledReason: "x" }, { id: "hood", label: "ZZHOOD" }]}
      selectedIds={["bonnet", "fender", "roof"]}
      quantitiesByPart={{ bonnet: 3 }}
      onToggle={() => undefined}
      onQuantityChange={() => undefined}
    />,
  );
  assert.equal((html.match(/数量/g) ?? []).length, 2, "bonnet + fender steppers; disabled roof and unselected hood have none");
  assert.match(html, /tabular-nums">3</, "bonnet shows its draft quantity");
  assert.match(html, /tabular-nums">1</, "fender defaults to 1 without a quantity rule");
  assert.match(html, /（最大4）/);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5b2) — dedicated wheel / glass Step-4 sections ──────────
//
// `wheel` and `glass` are independent Screen-3 categories with NO offering family: the dealer-authored
// menu row is the availability authority. Step 4 must (a) present each as its own section with its
// dealer menus, (b) let the operator select SEVERAL menus keyed by stable id, each with its own
// tax-exclusive unit-price text and bounded positive-integer quantity, (c) start wheel at 4 and
// glass at 1 — clamped to the configured bounds, never inventing a maximum or a min of 4 — and (d)
// fail closed on an absent runtime collection, an empty one, malformed bounds/price, or a null
// configured price (never coerced to "0"). Every write is one section-scoped api.updateStore patch.

const WHEEL_MENU: DedicatedMenuRef = { id: "wm1", defaultUnitPrice: 8000, minQty: 1, maxQty: null };
const GLASS_MENU: DedicatedMenuRef = { id: "gm1", defaultUnitPrice: null, minQty: 1, maxQty: 6 };

test("B5b2: selecting a wheel menu initialises quantity 4 and prefills the configured price as text, in ONE wheel-scoped patch", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  assert.deepEqual(b.wheel.onMenuToggle(WHEEL_MENU), { ok: true });
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0], {
    services: { wheel: { selectedMenuIds: ["wm1"], quantitiesByMenu: { wm1: 4 }, unitPricesByMenu: { wm1: "8000" } } },
  });
});

test("B5b2: selecting a glass menu initialises quantity 1; a NULL configured price leaves the price text ABSENT (never \"0\")", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  assert.deepEqual(b.glass.onMenuToggle(GLASS_MENU), { ok: true });
  assert.deepEqual(patches[0], { services: { glass: { selectedMenuIds: ["gm1"], quantitiesByMenu: { gm1: 1 } } } });
  assert.equal("unitPricesByMenu" in patches[0].services!.glass!, false, "no price key at all for an unconfigured price");
});

test("B5b2: multiple menus per section, keyed by stable id, each with its own price and quantity", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    wheel: { selectedMenuIds: ["wm1"], unitPricesByMenu: { wm1: "8000" }, quantitiesByMenu: { wm1: 4 } },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  const second: DedicatedMenuRef = { id: "wm2", defaultUnitPrice: 12000, minQty: 2, maxQty: 8 };
  b.wheel.onMenuToggle(second);
  assert.deepEqual(patches.at(-1), {
    services: { wheel: {
      selectedMenuIds: ["wm1", "wm2"],
      quantitiesByMenu: { wm1: 4, wm2: 4 },
      unitPricesByMenu: { wm1: "8000", wm2: "12000" },
    } },
  });
  b.wheel.onUnitPriceChange("wm2", "11500");
  assert.deepEqual(patches.at(-1), { services: { wheel: { unitPricesByMenu: { wm1: "8000", wm2: "11500" } } } });
  b.wheel.onQuantityChange(second, 3);
  assert.deepEqual(patches.at(-1), { services: { wheel: { quantitiesByMenu: { wm1: 4, wm2: 3 } } } });
});

test("B5b2: an existing VALID quantity and price are preserved on re-select — never silently replaced", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    wheel: { selectedMenuIds: [], unitPricesByMenu: { wm1: "7500" }, quantitiesByMenu: { wm1: 2 } },
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  b.wheel.onMenuToggle(WHEEL_MENU);
  // Only the selection changes: the operator's earlier 2 × ¥7,500 comes back exactly as left.
  assert.deepEqual(patches.at(-1), { services: { wheel: { selectedMenuIds: ["wm1"] } } });
});

test("B5b2: an existing quantity that is INVALID for the configured bounds is re-initialised; the price text is still kept", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    glass: { selectedMenuIds: [], unitPricesByMenu: { gm1: "abc" }, quantitiesByMenu: { gm1: 9 } }, // 9 > max 6
  };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  b.glass.onMenuToggle(GLASS_MENU);
  assert.deepEqual(patches.at(-1), { services: { glass: { selectedMenuIds: ["gm1"], quantitiesByMenu: { gm1: 1 } } } });
});

test("B5b2: unselect drops ONLY the id (no line can follow); price and quantity are left untouched for a return", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    wheel: { selectedMenuIds: ["wm1", "wm2"], unitPricesByMenu: { wm1: "8000", wm2: "9000" }, quantitiesByMenu: { wm1: 4, wm2: 2 } },
  };
  const snapshot = JSON.stringify(seeded);
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  assert.deepEqual(b.wheel.onMenuToggle(WHEEL_MENU), { ok: true });
  assert.deepEqual(patches.at(-1), { services: { wheel: { selectedMenuIds: ["wm2"] } } });
  assert.equal(JSON.stringify(seeded), snapshot, "supplied projection unchanged");
});

test("B5b2: initial quantity is the nominal (wheel 4 / glass 1) clamped to the NEAREST configured bound; no maximum is invented", () => {
  assert.deepEqual(DEDICATED_MENU_INITIAL_QUANTITY, { wheel: 4, glass: 1 });
  // Nominal inside bounds → nominal.
  assert.equal(initialDedicatedMenuQuantity("wheel", { minQty: 1, maxQty: null }), 4);
  assert.equal(initialDedicatedMenuQuantity("glass", { minQty: 1, maxQty: 6 }), 1);
  // Nominal below the configured minimum → the minimum (initial and minimum are distinct: min is NOT forced to 4).
  assert.equal(initialDedicatedMenuQuantity("wheel", { minQty: 5, maxQty: null }), 5);
  assert.equal(initialDedicatedMenuQuantity("glass", { minQty: 2, maxQty: 4 }), 2);
  // Nominal above the configured maximum → the maximum.
  assert.equal(initialDedicatedMenuQuantity("wheel", { minQty: 1, maxQty: 2 }), 2);
  // A wheel menu with min 1 keeps min 1: the operator may go down to 1 wheel.
  assert.equal(isQuantityWithinMenuBounds(1, { minQty: 1, maxQty: null }), true);
  // Malformed bounds → null (caller fails closed).
  assert.equal(initialDedicatedMenuQuantity("wheel", { minQty: 0, maxQty: null }), null);
  assert.equal(initialDedicatedMenuQuantity("wheel", { minQty: 3, maxQty: 2 }), null);
  assert.equal(initialDedicatedMenuQuantity("glass", { minQty: 1.5, maxQty: null }), null);
});

test("B5b2: the toggle applies the clamped initial through the patch (edge: nominal outside configured bounds)", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  b.wheel.onMenuToggle({ id: "wmax2", defaultUnitPrice: 5000, minQty: 1, maxQty: 2 });
  assert.deepEqual(patches.at(-1)!.services!.wheel!.quantitiesByMenu, { wmax2: 2 }, "wheel nominal 4 > max 2 → 2");
  b.glass.onMenuToggle({ id: "gmin3", defaultUnitPrice: 5000, minQty: 3, maxQty: null });
  assert.deepEqual(patches.at(-1)!.services!.glass!.quantitiesByMenu, { gmin3: 3 }, "glass nominal 1 < min 3 → 3");
});

test("B5b2: malformed bounds or a malformed configured price FAIL CLOSED — no patch, explicit failure", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  const cases: DedicatedMenuRef[] = [
    { id: "b0", defaultUnitPrice: 1000, minQty: 0, maxQty: null },      // min < 1
    { id: "b1", defaultUnitPrice: 1000, minQty: 3, maxQty: 2 },         // max < min
    { id: "b2", defaultUnitPrice: 1000, minQty: 1, maxQty: 2.5 },       // non-integer max
    { id: "p0", defaultUnitPrice: -1, minQty: 1, maxQty: null },        // negative price
    { id: "p1", defaultUnitPrice: 12.5, minQty: 1, maxQty: null },      // non-integer yen
    { id: "d0", defaultUnitPrice: 1000, minQty: 1, maxQty: null, disabled: true },
  ];
  for (const menu of cases) {
    assert.deepEqual(b.wheel.onMenuToggle(menu), { ok: false, reason: "menu-invalid" }, `${menu.id}: toggle fails closed`);
    assert.deepEqual(b.wheel.onQuantityChange(menu, 1), { ok: false, reason: "menu-invalid" }, `${menu.id}: quantity fails closed`);
  }
  assert.equal(patches.length, 0, "nothing reached updateStore");
  assert.equal(dedicatedMenuBoundsValid({ minQty: 1, maxQty: null }), true);
  assert.equal(dedicatedMenuPriceValid(null), true, "null price is a valid 'not configured' state, not an error");
  assert.equal(dedicatedMenuPriceValid(0), true);
  assert.equal(dedicatedMenuPriceValid(-1), false);
});

test("B5b2: quantity edits must be positive integers within the configured bounds; anything else emits NO patch", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  for (const bad of [0, -1, 7, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(b.glass.onQuantityChange(GLASS_MENU, bad), { ok: false, reason: "quantity-out-of-bounds" }, `qty ${bad} rejected`);
  }
  assert.equal(patches.length, 0);
  assert.deepEqual(b.glass.onQuantityChange(GLASS_MENU, 6), { ok: true });
  assert.deepEqual(patches.at(-1), { services: { glass: { quantitiesByMenu: { gm1: 6 } } } });
  // No configured maximum → any positive integer ≥ min is accepted (no maximum is invented).
  assert.deepEqual(b.wheel.onQuantityChange(WHEEL_MENU, 5), { ok: true });
  assert.deepEqual(patches.at(-1), { services: { wheel: { quantitiesByMenu: { wm1: 5 } } } });
});

test("B5b2: unit-price text is kept verbatim (no parsing, no rounding, no pricing math here)", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  b.wheel.onUnitPriceChange("wm1", "12,000");
  assert.deepEqual(patches.at(-1), { services: { wheel: { unitPricesByMenu: { wm1: "12,000" } } } });
  b.glass.onUnitPriceChange("gm1", "");
  assert.deepEqual(patches.at(-1), { services: { glass: { unitPricesByMenu: { gm1: "" } } } });
});

test("B5b2: a legacy draft WITHOUT the optional sections reads as empty and the first patch completes it via the REAL canonical route", () => {
  const s = fresh();
  const legacy: WizardServiceConfigurationDraft = { ...s };
  delete legacy.wheel;
  delete legacy.glass;
  assert.deepEqual(dedicatedMenuDraftOf(legacy, "wheel"), { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} });
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(legacy, updateStore);
  b.wheel.onMenuToggle(WHEEL_MENU);
  const patch = patches.at(-1)!;
  assert.deepEqual(patch.services!.wheel!.selectedMenuIds, ["wm1"]);

  // Apply through the real adapter onto a draft lacking the sections.
  const base = initialCanonicalDraft();
  const { wheel: _w, glass: _g, ...rest } = base.serviceConfiguration;
  void _w; void _g;
  const legacyDraft = { ...base, serviceConfiguration: rest as WizardServiceConfigurationDraft };
  const applied = applyStorePatch(legacyDraft, patch);
  assert.equal(applied.ok, true, "legacy draft accepts the first wheel patch");
  if (!applied.ok) return;
  assert.deepEqual(applied.draft.serviceConfiguration.wheel, {
    selectedMenuIds: ["wm1"], quantitiesByMenu: { wm1: 4 }, unitPricesByMenu: { wm1: "8000" },
  });
  assert.equal(applied.draft.serviceConfiguration.glass, undefined, "the untouched sibling section is not fabricated");
  assert.equal(JSON.stringify(applied.draft.serviceConfiguration.coating), JSON.stringify(base.serviceConfiguration.coating), "coating sibling unchanged");
});

test("B5b2: wheel and glass render as independent sections with their DEALER menus (not as store-global options)", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel", "glass"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ホイール"), "wheel tab present");
  assert.ok(html.includes("ガラス"), "glass tab present");
  assert.ok(html.includes("ZZWHEELMENU"), "wheel is the first ordered selection → its dealer menu renders");
  assert.ok(html.includes("8,000"), "configured tax-exclusive price is displayed");
  const glass = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(glass.includes("ZZGLASSMENU"));
  assert.ok(glass.includes("単価未設定"), "null configured price is shown as not configured, never as ¥0");
  assert.equal(glass.includes("¥0"), false);
  // The dedicated menus are NOT rendered by the store-global selector.
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.equal((raw.match(/<StoreGlobalOptionsSelector/g) ?? []).length, 1, "store-global selector is used once, for the global slot only");
  assert.equal(/globalOptions=\{screenConfig\.(wheelMenus|glassMenus)/.test(raw), false, "wheel/glass menus never feed the store-global selector");
});

test("B5b2: a selected menu shows its editable price text, its quantity and the configured bounds", () => {
  const services = fresh();
  services.wheel = { selectedMenuIds: ["wm1"], unitPricesByMenu: { wm1: "8000" }, quantitiesByMenu: { wm1: 4 } };
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: {}, quantitiesByMenu: { gm1: 1 } };
  const wheel = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.match(wheel, /value="8000"/, "prefilled price text is the editable value");
  assert.match(wheel, /tabular-nums">4</, "wheel quantity 4 displayed");
  assert.ok(wheel.includes("（最小1）"), "no maximum is invented when none is configured");
  assert.ok(wheel.includes("税抜単価"), "price is labelled tax-exclusive");
  const glass = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.match(glass, /tabular-nums">1</, "glass quantity 1 displayed");
  assert.ok(glass.includes("（最小1・最大6）"), "configured bounds displayed");
  assert.ok(glass.includes("単価が未設定です"), "empty price text is flagged, not priced");
  // Unselected → no price/quantity controls at all.
  const none = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(none.includes("数量を減らす"), false, "no stepper without a selection");
});

test("B5b2: ABSENT runtime collection fails closed (locked, nothing selectable, not described as 'no menus'); EMPTY shows the settings-required text", () => {
  const absent: WizardScreenConfiguration = { ...SC };
  delete absent.wheelMenus;
  const lockedWheel = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"]).api} shopRank="detailer" screenConfig={absent} />);
  assert.equal(lockedWheel.includes("ZZWHEELMENU"), false, "no selectable menu while the collection is absent");
  assert.ok(lockedWheel.includes("ホイールメニューの情報を取得できませんでした"), "wiring/legacy state explained");
  assert.equal(lockedWheel.includes("見積ウィザード設定"), false, "absent is NOT presented as a settings prompt");
  assert.match(lockedWheel, /<button[^>]*disabled=""[^>]*><span[^>]*>ホイール</, "the section tab is disabled");

  const empty: WizardScreenConfiguration = { ...SC, glassMenus: [] };
  const lockedGlass = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"]).api} shopRank="detailer" screenConfig={empty} />);
  assert.equal(lockedGlass.includes("ZZGLASSMENU"), false);
  assert.ok(lockedGlass.includes("ガラスを利用するには、見積設定（見積ウィザード設定）でガラスメニューを登録してください。"), "settings destination named in text");

  // Neither state touches any other section, and the wizard stays mounted.
  for (const cfg of [absent, empty]) {
    const maint = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["maintenance", "wheel", "glass"]).api} shopRank="detailer" screenConfig={cfg} />);
    assert.ok(maint.includes("ZZMAINTMENU"), "maintenance fully usable");
    assert.ok(maint.includes("ZZGLOBALOPT"), "wizard still mounted");
  }
});

test("B5b2: a malformed dealer row renders disabled with a reason and is never selectable", () => {
  const badRow: WizardScreenConfiguration = {
    ...SC,
    wheelMenus: [
      { kind: "wheel_menu", id: "wbad", name: "ZZBADWHEEL", defaultUnitPrice: 8000, quantityRequired: true, minQty: 3, maxQty: 2 },
      { kind: "wheel_menu", id: "wok", name: "ZZOKWHEEL", defaultUnitPrice: 8000, quantityRequired: true, minQty: 1, maxQty: null },
    ],
  };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"]).api} shopRank="detailer" screenConfig={badRow} />);
  assert.ok(html.includes("ZZBADWHEEL"), "the row is shown, not hidden");
  assert.ok(html.includes("数量範囲または単価の設定が不正"), "reason shown");
  assert.match(html, /<button[^>]*disabled=""[^>]*>[^<]*<span[^>]*>ZZBADWHEEL/, "malformed row's toggle is disabled");
  assert.ok(html.includes("ZZOKWHEEL"), "the well-formed sibling stays selectable");
});

test("B5b2: no offering-family opt-in was added for wheel/glass, and the host reads only the two runtime collections", () => {
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.equal(/serviceOfferings\.(wheel|glass)/.test(raw), false, "no invented opt-in key");
  assert.equal(/offerings\[\s*["'](wheel|glass)/.test(raw), false, "no invented opt-in lookup");
  for (const src of [BIND_SRC, STEP_SRC]) {
    const code = codeOf(src);
    assert.equal(/subtotal|taxRate|\*\s*(qty|quantity)|(qty|quantity)\s*\*/.test(code), false, `${src}: no pricing math`);
  }
});

// ── GDA-OTHER-COATINGS-R1 (C3) — the distinct `other_coating` Step-4 section ──────────────────────
//
// `other_coating` is its OWN Screen-3 category with its OWN draft section (`services.otherCoating`,
// the dedicated-menu shape) and its OWN runtime collection (`screenConfig.otherCoatingMenus`). It
// must (a) render only its dealer items, (b) treat a fixed-one item as EXACTLY quantity 1 with no
// editable quantity control, (c) start a quantity-bearing item at 1 or its configured lower bound
// with positive-integer bounds, (d) prefill only a POSITIVE configured price — null / 0 / absent is
// left empty for manual positive entry and is NEVER "0" — and (e) leave every B5b2 wheel/glass
// behaviour byte-identical. Every write is one `otherCoating`-scoped api.updateStore patch. No line.

const OC_FIXED: OtherCoatingMenuRef = { id: "oc_fixed", defaultUnitPrice: 15000, quantityRequired: false };
const OC_QTY: OtherCoatingMenuRef = { id: "oc_qty", defaultUnitPrice: null, quantityRequired: true, minQty: 2, maxQty: 5 };

test("C3: the row normalisation is TOTAL — fixed-one → bounds {1,1}; quantity-bearing → configured/natural bounds; price 0 → null", () => {
  assert.equal(isOtherCoatingFixedOne(OC_FIXED), true);
  assert.equal(isOtherCoatingFixedOne(OC_QTY), false);
  assert.deepEqual(toOtherCoatingMenuRef(OC_FIXED), { id: "oc_fixed", defaultUnitPrice: 15000, minQty: 1, maxQty: 1 });
  assert.deepEqual(toOtherCoatingMenuRef(OC_QTY), { id: "oc_qty", defaultUnitPrice: null, minQty: 2, maxQty: 5 });
  // Absent bounds on a quantity-bearing item = the natural bounds (min 1, no maximum). No maximum is invented.
  assert.deepEqual(toOtherCoatingMenuRef({ id: "x", defaultUnitPrice: 100, quantityRequired: true }), { id: "x", defaultUnitPrice: 100, minQty: 1, maxQty: null });
  // A configured 0 is "not configured", never a ¥0 prefill.
  assert.equal(toOtherCoatingMenuRef({ ...OC_FIXED, defaultUnitPrice: 0 }).defaultUnitPrice, null);
  // A fixed-one item ignores any stray bounds: its effective quantity is exactly 1.
  assert.deepEqual(toOtherCoatingMenuRef({ id: "f", defaultUnitPrice: 100, quantityRequired: false, minQty: 3, maxQty: 9 }), { id: "f", defaultUnitPrice: 100, minQty: 1, maxQty: 1 });
  // Disabled passes through so the shared usability rule fails it closed.
  assert.equal(toOtherCoatingMenuRef({ ...OC_FIXED, disabled: true }).disabled, true);
});

test("C3: initial quantity is 1 or the configured lower bound; a fixed-one item is exactly 1; malformed bounds → null", () => {
  assert.equal(OTHER_COATING_INITIAL_QUANTITY, 1);
  assert.equal(initialOtherCoatingQuantity(toOtherCoatingMenuRef(OC_FIXED)), 1);
  assert.equal(initialOtherCoatingQuantity({ minQty: 1, maxQty: null }), 1);
  assert.equal(initialOtherCoatingQuantity({ minQty: 2, maxQty: 5 }), 2, "nominal 1 < min 2 → the lower bound");
  assert.equal(initialOtherCoatingQuantity({ minQty: 1, maxQty: 1 }), 1);
  assert.equal(initialOtherCoatingQuantity({ minQty: 0, maxQty: null }), null);
  assert.equal(initialOtherCoatingQuantity({ minQty: 3, maxQty: 2 }), null);
  assert.equal(initialOtherCoatingQuantity({ minQty: 1.5, maxQty: null }), null);
});

test("C3: selecting a FIXED-ONE item initialises quantity EXACTLY 1 and prefills the positive configured price, in ONE otherCoating-scoped patch", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  assert.deepEqual(b.otherCoating.onMenuToggle(OC_FIXED), { ok: true });
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0], {
    services: { otherCoating: { selectedMenuIds: ["oc_fixed"], quantitiesByMenu: { oc_fixed: 1 }, unitPricesByMenu: { oc_fixed: "15000" } } },
  });
  // A fixed-one item has NO editable quantity: only 1 is ever accepted; anything else emits NO patch.
  for (const bad of [0, 2, 4, -1, 1.5]) {
    assert.deepEqual(b.otherCoating.onQuantityChange(OC_FIXED, bad), { ok: false, reason: "quantity-out-of-bounds" }, `fixed-one rejects ${bad}`);
  }
  assert.equal(patches.length, 1, "no quantity patch for a fixed-one item");
});

test("C3: selecting a QUANTITY-BEARING item starts at its configured lower bound; edits are positive integers within bounds", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  assert.deepEqual(b.otherCoating.onMenuToggle(OC_QTY), { ok: true });
  assert.deepEqual(patches[0], { services: { otherCoating: { selectedMenuIds: ["oc_qty"], quantitiesByMenu: { oc_qty: 2 } } } });
  for (const bad of [0, 1, 6, 2.5, Number.NaN, -3]) {
    assert.deepEqual(b.otherCoating.onQuantityChange(OC_QTY, bad), { ok: false, reason: "quantity-out-of-bounds" }, `qty ${bad} rejected`);
  }
  assert.equal(patches.length, 1);
  assert.deepEqual(b.otherCoating.onQuantityChange(OC_QTY, 5), { ok: true });
  assert.deepEqual(patches.at(-1), { services: { otherCoating: { quantitiesByMenu: { oc_qty: 5 } } } });
  // min 1 and no configured maximum → starts at 1 and accepts any positive integer (no maximum invented).
  const open: OtherCoatingMenuRef = { id: "oc_open", defaultUnitPrice: 3000, quantityRequired: true };
  b.otherCoating.onMenuToggle(open);
  assert.deepEqual(patches.at(-1), { services: { otherCoating: { selectedMenuIds: ["oc_open"], quantitiesByMenu: { oc_open: 1 }, unitPricesByMenu: { oc_open: "3000" } } } });
  assert.deepEqual(b.otherCoating.onQuantityChange(open, 40), { ok: true });
  assert.deepEqual(patches.at(-1)!.services!.otherCoating!.quantitiesByMenu, { oc_open: 40 });
});

test("C3: an UNCONFIGURED price (null / 0 / absent) is never coerced to \"0\" — no price key at all; operator text is kept verbatim", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  b.otherCoating.onMenuToggle(OC_QTY); // null
  assert.equal("unitPricesByMenu" in patches.at(-1)!.services!.otherCoating!, false, "null price → no price key");
  b.otherCoating.onMenuToggle({ ...OC_FIXED, id: "oc_zero", defaultUnitPrice: 0 }); // zero
  const zero = patches.at(-1)!.services!.otherCoating!;
  assert.equal("unitPricesByMenu" in zero, false, "zero price → no price key (never \"0\")");
  assert.deepEqual(zero.quantitiesByMenu, { oc_zero: 1 }, "fixed-one still initialises quantity 1");
  for (const p of patches) assert.equal(JSON.stringify(p).includes('"0"'), false, "no \"0\" price text anywhere");
  // The operator may type a positive price afterwards; the text is kept verbatim (validated downstream).
  b.otherCoating.onUnitPriceChange("oc_qty", "12,000");
  assert.deepEqual(patches.at(-1), { services: { otherCoating: { unitPricesByMenu: { oc_qty: "12,000" } } } });
});

test("C3: malformed bounds, a negative / non-integer price, or a disabled row FAIL CLOSED — no patch", () => {
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  const cases: OtherCoatingMenuRef[] = [
    { id: "b0", defaultUnitPrice: 1000, quantityRequired: true, minQty: 0 },
    { id: "b1", defaultUnitPrice: 1000, quantityRequired: true, minQty: 3, maxQty: 2 },
    { id: "b2", defaultUnitPrice: 1000, quantityRequired: true, minQty: 1, maxQty: 2.5 },
    { id: "p0", defaultUnitPrice: -1, quantityRequired: false },
    { id: "p1", defaultUnitPrice: 12.5, quantityRequired: true, minQty: 1 },
    { id: "d0", defaultUnitPrice: 1000, quantityRequired: false, disabled: true },
  ];
  for (const menu of cases) {
    assert.deepEqual(b.otherCoating.onMenuToggle(menu), { ok: false, reason: "menu-invalid" }, `${menu.id}: toggle fails closed`);
    assert.deepEqual(b.otherCoating.onQuantityChange(menu, 1), { ok: false, reason: "menu-invalid" }, `${menu.id}: quantity fails closed`);
  }
  assert.equal(patches.length, 0, "nothing reached updateStore");
});

test("C3: re-select keeps a still-valid quantity/price; unselect drops ONLY the id; the projection is never mutated", () => {
  const s = fresh();
  const seeded: WizardServiceConfigurationDraft = {
    ...s,
    otherCoating: { selectedMenuIds: ["oc_qty"], unitPricesByMenu: { oc_qty: "9000", oc_fixed: "14000" }, quantitiesByMenu: { oc_qty: 4, oc_fixed: 3 } },
  };
  const snapshot = JSON.stringify(seeded);
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(seeded, updateStore);
  b.otherCoating.onMenuToggle(OC_QTY); // selected → unselect
  assert.deepEqual(patches.at(-1), { services: { otherCoating: { selectedMenuIds: [] } } });
  // Re-selecting the fixed-one item: its stale quantity 3 is INVALID for {1,1} → re-initialised to 1; price text kept.
  b.otherCoating.onMenuToggle(OC_FIXED);
  assert.deepEqual(patches.at(-1), { services: { otherCoating: { selectedMenuIds: ["oc_qty", "oc_fixed"], quantitiesByMenu: { oc_qty: 4, oc_fixed: 1 } } } });
  assert.equal(JSON.stringify(seeded), snapshot, "supplied projection unchanged");
});

test("C3: a legacy draft WITHOUT `otherCoating` reads as empty and the first patch completes it via the REAL canonical route (siblings untouched)", () => {
  const s = fresh();
  const legacy: WizardServiceConfigurationDraft = { ...s };
  delete legacy.otherCoating;
  assert.deepEqual(otherCoatingDraftOf(legacy), { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} });
  const { updateStore, patches } = cap();
  createStep4Bindings(legacy, updateStore).otherCoating.onMenuToggle(OC_FIXED);
  const base = initialCanonicalDraft();
  const { otherCoating: _oc, ...rest } = base.serviceConfiguration;
  void _oc;
  const applied = applyStorePatch({ ...base, serviceConfiguration: rest as WizardServiceConfigurationDraft }, patches.at(-1)!);
  assert.equal(applied.ok, true, "legacy draft accepts the first otherCoating patch");
  if (!applied.ok) return;
  assert.deepEqual(applied.draft.serviceConfiguration.otherCoating, {
    selectedMenuIds: ["oc_fixed"], quantitiesByMenu: { oc_fixed: 1 }, unitPricesByMenu: { oc_fixed: "15000" },
  });
  assert.equal(JSON.stringify(applied.draft.serviceConfiguration.wheel), JSON.stringify(base.serviceConfiguration.wheel), "wheel sibling unchanged");
  assert.equal(JSON.stringify(applied.draft.serviceConfiguration.glass), JSON.stringify(base.serviceConfiguration.glass), "glass sibling unchanged");
  assert.equal(JSON.stringify(applied.draft.serviceConfiguration.coating), JSON.stringify(base.serviceConfiguration.coating), "coating sibling unchanged");
});

test("C3 UI: the other-coating section renders its DEALER items with the positive configured price shown and null shown as not configured (never ¥0)", () => {
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"]).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("その他コーティングメニュー"), "section title");
  assert.ok(html.includes("ZZOCFIXED") && html.includes("ZZOCQTY"), "both dealer items render");
  assert.ok(html.includes("15,000"), "positive configured price displayed");
  assert.ok(html.includes("単価未設定"), "null price shown as not configured");
  assert.equal(html.includes("¥0"), false, "never a ¥0");
  assert.equal(html.includes("ZZWHEELMENU") || html.includes("ZZGLASSMENU") || html.includes("ZZOTHERPRESET"), false, "no other section's menus leak in");
  // Unselected → no price/quantity controls at all.
  assert.equal(html.includes("数量を増やす"), false);
  assert.equal(html.includes("数量：1（固定）"), false);
  // Dealer items never feed the store-global selector.
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.equal(/globalOptions=\{screenConfig\.otherCoatingMenus/.test(raw), false);
});

test("C3 UI: a selected FIXED-ONE item shows quantity 1 as fixed text with NO editable quantity control, and its prefilled price", () => {
  const services = fresh();
  services.otherCoating = { selectedMenuIds: ["oc_fixed"], unitPricesByMenu: { oc_fixed: "15000" }, quantitiesByMenu: { oc_fixed: 1 } };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("数量：1（固定）"), "fixed quantity 1 displayed");
  assert.equal(html.includes("ZZOCFIXED 数量を増やす"), false, "no increment control for a fixed-one item");
  assert.equal(html.includes("ZZOCFIXED 数量を減らす"), false, "no decrement control for a fixed-one item");
  assert.equal(html.includes("（最小1・最大1）"), false, "no bounds label is shown for a fixed-one item");
  assert.match(html, /value="15000"/, "prefilled positive price is the editable value");
  assert.ok(html.includes("税抜単価"), "price is labelled tax-exclusive");
  assert.equal(html.includes("単価が未設定です"), false, "a configured price is not flagged");
  assert.equal(html.includes("ZZOCQTY 数量を増やす"), false, "the unselected quantity-bearing sibling shows no stepper");
});

test("C3 UI: a selected QUANTITY-BEARING item shows its bounds and an editable stepper; an unconfigured price is flagged, not priced", () => {
  const services = fresh();
  services.otherCoating = { selectedMenuIds: ["oc_qty"], unitPricesByMenu: {}, quantitiesByMenu: { oc_qty: 2 } };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("ZZOCQTY 数量を増やす") && html.includes("ZZOCQTY 数量を減らす"), "stepper present");
  assert.ok(html.includes("（最小2・最大5）"), "configured bounds displayed");
  assert.match(html, /tabular-nums">2</, "initial quantity = configured lower bound displayed");
  assert.match(html, /aria-label="ZZOCQTY 数量を減らす" disabled=""/, "cannot go below the lower bound");
  assert.match(html, /value=""/, "price text is EMPTY for manual positive entry");
  assert.equal(/value="0"/.test(html), false, "never prefilled with 0");
  assert.ok(html.includes("単価が未設定です"), "empty price text is flagged");
  assert.equal(html.includes("数量：1（固定）"), false, "no fixed-one text for a quantity-bearing item");
  // A stale draft quantity outside the bounds is shown as unset, never as a number the bounds reject.
  services.otherCoating = { selectedMenuIds: ["oc_qty"], unitPricesByMenu: {}, quantitiesByMenu: { oc_qty: 9 } };
  const stale = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(stale.includes("数量が未設定です"), "out-of-bounds draft quantity is flagged as unset");
  assert.equal(/tabular-nums">9</.test(stale), false);
});

test("C3 UI: ABSENT runtime collection fails closed (locked, not a settings prompt); EMPTY names the settings destination; other sections unaffected", () => {
  const absent: WizardScreenConfiguration = { ...SC };
  delete absent.otherCoatingMenus;
  const locked = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"]).api} shopRank="detailer" screenConfig={absent} />);
  assert.equal(locked.includes("ZZOCFIXED") || locked.includes("ZZOCQTY"), false, "no selectable item while the collection is absent");
  assert.ok(locked.includes("その他コーティングメニューの情報を取得できませんでした"), "wiring/legacy state explained");
  assert.equal(locked.includes("見積ウィザード設定"), false, "absent is NOT presented as a settings prompt");
  assert.match(locked, /<button[^>]*disabled=""[^>]*><span[^>]*>その他コーティング</, "the section tab is disabled");

  const empty: WizardScreenConfiguration = { ...SC, otherCoatingMenus: [] };
  const setup = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"]).api} shopRank="detailer" screenConfig={empty} />);
  assert.equal(setup.includes("ZZOCFIXED"), false);
  assert.ok(setup.includes("その他コーティングを利用するには、見積設定（見積ウィザード設定）でその他コーティングメニューを登録してください。"), "settings destination named in text");

  for (const cfg of [absent, empty]) {
    // Mirrors the B5b2 case: maintenance is the first ORDERED selection, so its content opens.
    const others = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["maintenance", "wheel", "other_coating"]).api} shopRank="detailer" screenConfig={cfg} />);
    assert.ok(others.includes("ZZMAINTMENU"), "maintenance fully usable");
    assert.ok(others.includes("ZZGLOBALOPT"), "wizard still mounted");
    assert.ok(others.includes("ホイール") && others.includes("その他コーティング"), "both tabs still present");
  }
});

test("C3 UI: a malformed dealer item renders disabled with a reason; the well-formed sibling stays selectable", () => {
  const badRow: WizardScreenConfiguration = {
    ...SC,
    otherCoatingMenus: [
      { kind: "other_coating_menu", id: "ocbad", name: "ZZBADOC", defaultUnitPrice: 1000, quantityRequired: true, minQty: 3, maxQty: 2 },
      { kind: "other_coating_menu", id: "ocok", name: "ZZOKOC", defaultUnitPrice: 1000, quantityRequired: false },
    ],
  };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"]).api} shopRank="detailer" screenConfig={badRow} />);
  assert.ok(html.includes("ZZBADOC"), "the row is shown, not hidden");
  assert.ok(html.includes("数量範囲または単価の設定が不正"), "reason shown");
  assert.match(html, /<button[^>]*disabled=""[^>]*>[^<]*<span[^>]*>ZZBADOC/, "malformed row's toggle is disabled");
  assert.ok(html.includes("ZZOKOC"));
  assert.equal(/<button[^>]*disabled=""[^>]*>[^<]*<span[^>]*>ZZOKOC/.test(html), false, "well-formed sibling is enabled");
});

test("C3 B5 REGRESSION: wheel/glass bindings, initials and rendering are byte-identical with and without the other-coating collection", () => {
  // Bindings: the exact B5b2 patches still come out, and nothing in the wheel/glass surface changed.
  assert.deepEqual(DEDICATED_MENU_INITIAL_QUANTITY, { wheel: 4, glass: 1 });
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(fresh(), updateStore);
  b.wheel.onMenuToggle(WHEEL_MENU);
  assert.deepEqual(patches.at(-1), { services: { wheel: { selectedMenuIds: ["wm1"], quantitiesByMenu: { wm1: 4 }, unitPricesByMenu: { wm1: "8000" } } } });
  b.glass.onMenuToggle(GLASS_MENU);
  assert.deepEqual(patches.at(-1), { services: { glass: { selectedMenuIds: ["gm1"], quantitiesByMenu: { gm1: 1 } } } });
  b.wheel.onMenuToggle({ id: "wmax2", defaultUnitPrice: 5000, minQty: 1, maxQty: 2 });
  assert.deepEqual(patches.at(-1)!.services!.wheel!.quantitiesByMenu, { wmax2: 2 }, "wheel nominal 4 > max 2 → 2 (unchanged)");
  // An other-coating event never touches wheel/glass keys, and vice versa.
  b.otherCoating.onMenuToggle(OC_FIXED);
  assert.deepEqual(Object.keys(patches.at(-1)!.services!), ["otherCoating"]);
  for (const p of patches) assert.equal("otherCoating" in p.services! && ("wheel" in p.services! || "glass" in p.services!), false);

  // Rendering: the wheel and glass sections are identical whether or not other-coating menus exist.
  const without: WizardScreenConfiguration = { ...SC };
  delete without.otherCoatingMenus;
  const services = fresh();
  services.wheel = { selectedMenuIds: ["wm1"], unitPricesByMenu: { wm1: "8000" }, quantitiesByMenu: { wm1: 4 } };
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: {}, quantitiesByMenu: { gm1: 1 } };
  for (const cat of ["wheel", "glass"]) {
    const a = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi([cat], services).api} shopRank="detailer" screenConfig={SC} />);
    const c = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi([cat], services).api} shopRank="detailer" screenConfig={without} />);
    assert.equal(a, c, `${cat}: render byte-identical regardless of the other-coating collection`);
  }
  // The wheel/glass copy and the kind-scoped initial-quantity policy are untouched at source level.
  const raw = readFileSync(BIND_SRC, "utf8");
  assert.match(raw, /export type DedicatedMenuKind = "wheel" \| "glass";/, "kind union unchanged (other coating is NOT a third kind)");
  assert.match(raw, /DEDICATED_MENU_INITIAL_QUANTITY[^=]*= \{ wheel: 4, glass: 1 \};/, "nominal initials unchanged");
});

test("C3: no offering-family opt-in was added for other_coating; no pricing math or line generation entered the host/bindings", () => {
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.equal(/serviceOfferings\.(other_coating|otherCoating)/.test(raw), false, "no invented opt-in key");
  assert.equal(/offerings\[\s*["'](other_coating|otherCoating)/.test(raw), false, "no invented opt-in lookup");
  assert.match(raw, /disabledSections\.add\("other_coating"\)/, "absent/empty collection locks the section");
  for (const src of [BIND_SRC, STEP_SRC]) {
    const code = codeOf(src);
    assert.equal(/subtotal|taxRate|\*\s*(qty|quantity)|(qty|quantity)\s*\*/.test(code), false, `${src}: no pricing math`);
    assert.equal(/lineId|EstimateLine|buildLine|createLine|manual:other/.test(code), false, `${src}: no line generation`);
  }
});

// ── GDA-OTHER-COATINGS-R1 (C5 F1) — stale draft quantity on a selected FIXED-ONE row ───────────────

test("C5 F1: a selected FIXED-ONE row with a stale draft quantity ≠ 1 shows the contradiction and a one-click reset; nothing is normalised on mount; the static fixed label is not shown", () => {
  const services = fresh();
  // Restored draft: the dealer item was quantity-bearing (qty 3) and has since been made fixed-one.
  services.otherCoating = { selectedMenuIds: ["oc_fixed"], unitPricesByMenu: { oc_fixed: "15000" }, quantitiesByMenu: { oc_fixed: 3 } };
  const { api, patches } = makeApi(["other_coating"], services);
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("下書きに残った数量「3」は使用できません。この項目の数量は1（固定）です。"), "the stale value is exposed, not hidden");
  assert.match(html, /data-testid="other-coating-fixed-one-stale-notice"/);
  assert.match(html, /<button[^>]*data-testid="other-coating-fixed-one-stale-reset"[^>]*aria-label="ZZOCFIXED 数量を1に戻す"/, "labelled one-click reset");
  assert.equal(html.includes("数量：1（固定）"), false, "the static fixed label must not mask the contradiction");
  assert.equal(html.includes("ZZOCFIXED 数量を増やす") || html.includes("ZZOCFIXED 数量を減らす"), false, "still no stepper on a fixed-one row");
  assert.equal(/tabular-nums">3</.test(html), false, "the stale 3 is never displayed as the effective quantity");
  assert.match(html, /value="15000"/, "the price text is untouched");
  assert.equal(patches.length, 0, "rendering emits NO patch — the draft is never silently normalised on mount");
});

test("C5 F1: the reset writes EXACTLY quantity 1 through the existing otherCoating binding (one section-scoped patch); other stale values stay refused", () => {
  const services = fresh();
  services.otherCoating = { selectedMenuIds: ["oc_fixed"], unitPricesByMenu: { oc_fixed: "15000" }, quantitiesByMenu: { oc_fixed: 3 } };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(services, updateStore);
  assert.deepEqual(b.otherCoating.onQuantityChange(OC_FIXED, 1), { ok: true });
  assert.deepEqual(patches, [{ services: { otherCoating: { quantitiesByMenu: { oc_fixed: 1 } } } }], "exactly one otherCoating-scoped patch, quantity 1, nothing else touched");
  for (const bad of [0, 2, 3]) {
    assert.deepEqual(b.otherCoating.onQuantityChange(OC_FIXED, bad), { ok: false, reason: "quantity-out-of-bounds" }, `fixed-one still refuses ${bad}`);
  }
  assert.equal(patches.length, 1, "refused values emit no patch");
  // The host wires the reset to that SAME binding with the literal 1 — no new route, no local normalisation.
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.match(raw, /data-testid="other-coating-fixed-one-stale-reset"[\s\S]{0,200}onClick=\{\(\) => onResult\(bindings\.onQuantityChange\(menu, 1\)\)\}/, "reset → bindings.onQuantityChange(menu, 1)");
  assert.equal(/useEffect/.test(codeOf(STEP_SRC)), false, "no mount-time effect normalises the draft");
});

test("C5 F1: a fixed-one row holding 1, an UNSELECTED fixed-one row, and a quantity-bearing row are unaffected (no notice, no reset)", () => {
  const services = fresh();
  services.otherCoating = { selectedMenuIds: ["oc_fixed"], unitPricesByMenu: { oc_fixed: "15000" }, quantitiesByMenu: { oc_fixed: 1 } };
  const valid = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(valid.includes("数量：1（固定）"), "valid 1 keeps the fixed label");
  assert.equal(valid.includes("other-coating-fixed-one-stale"), false, "no notice / reset for a valid 1");
  // Stale 3 on an UNSELECTED fixed-one row: no line can follow, so nothing to repair is offered.
  services.otherCoating = { selectedMenuIds: [], unitPricesByMenu: { oc_fixed: "15000" }, quantitiesByMenu: { oc_fixed: 3 } };
  const unselected = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(unselected.includes("other-coating-fixed-one-stale"), false, "unselected: no notice / reset");
  // Quantity-bearing row with an out-of-bounds draft keeps the C3 behaviour (flagged unset; no fixed-one reset).
  services.otherCoating = { selectedMenuIds: ["oc_qty"], unitPricesByMenu: {}, quantitiesByMenu: { oc_qty: 9 } };
  const qb = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["other_coating"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(qb.includes("数量が未設定です"), "quantity-bearing out-of-bounds still flagged as unset");
  assert.equal(qb.includes("数量を1に戻す"), false, "no fixed-one reset on a quantity-bearing row");
  assert.ok(qb.includes("ZZOCQTY 数量を増やす"), "stepper still present");
});

// ── GDA-PR143-R2 — stale wheel / glass quantity outside CHANGED catalogue bounds ─────────────────

test("PR143-R2: a selected glass row with a stale out-of-bounds draft quantity shows the ACTUAL stale value and an explicit repair to the nearest bound; nothing is clamped or cleared on mount", () => {
  const services = fresh();
  // Restored draft: gm1 held 9 when its maximum was higher; the dealer has since set max 6.
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 9 } };
  const { api, patches } = makeApi(["glass"], services);
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(html.includes("下書きに残った数量「9」は現在の数量範囲（最小1・最大6）外のため使用できません。"), "the stale 9 is exposed, not hidden behind 'unset'");
  assert.match(html, /data-testid="dedicated-menu-stale-quantity-notice"/);
  assert.match(html, /<button[^>]*data-testid="dedicated-menu-stale-quantity-repair"[^>]*aria-label="ZZGLASSMENU 数量を6に修正"/, "labelled one-click repair to the nearest bound (max 6)");
  assert.equal(html.includes("数量が未設定です"), false, "a stale quantity is not described as unset");
  assert.equal(/tabular-nums">9</.test(html), false, "the stale 9 is never displayed as the effective quantity");
  assert.match(html, /value="12000"/, "the price text is untouched");
  assert.ok(html.includes("ZZGLASSMENU 数量を増やす") && html.includes("ZZGLASSMENU 数量を減らす"), "the stepper is still present");
  assert.equal(patches.length, 0, "rendering emits NO patch — the draft is never silently normalised on mount");
  // Below the minimum: a wheel row (min 1, no max) holding a stale 0 offers a repair to the minimum.
  services.wheel = { selectedMenuIds: ["wm1"], unitPricesByMenu: { wm1: "8000" }, quantitiesByMenu: { wm1: 0 } };
  const wheel = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(wheel.includes("下書きに残った数量「0」は現在の数量範囲（最小1）外のため使用できません。"));
  assert.match(wheel, /aria-label="ZZWHEELMENU 数量を1に修正"/);
});

test("PR143-R2: the repair writes the nearest bound through the EXISTING glass binding (one section-scoped patch), and the repaired draft renders in-bounds with no notice", () => {
  const services = fresh();
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 9 } };
  const { updateStore, patches } = cap();
  const b = createStep4Bindings(services, updateStore);
  assert.deepEqual(b.glass.onQuantityChange(GLASS_MENU, 6), { ok: true });
  assert.deepEqual(patches, [{ services: { glass: { quantitiesByMenu: { gm1: 6 } } } }], "exactly one glass-scoped patch, quantity 6, nothing else touched");
  // The stale value itself is still refused by the binding — only the explicit repair value passes.
  assert.deepEqual(b.glass.onQuantityChange(GLASS_MENU, 9), { ok: false, reason: "quantity-out-of-bounds" });
  assert.equal(patches.length, 1);
  // Repaired path: the SAME draft after the repair renders 6 as the effective quantity, no notice, no repair.
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 6 } };
  const repaired = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.match(repaired, /tabular-nums">6</, "repaired quantity is the effective quantity");
  assert.equal(repaired.includes("dedicated-menu-stale-quantity"), false, "no notice / repair once in bounds");
  assert.match(repaired, /aria-label="ZZGLASSMENU 数量を増やす" disabled=""/, "at the maximum the increment is disabled (existing rule)");
  // The host wires the repair to that SAME binding with the computed target — no new route, no local normalisation.
  const raw = readFileSync(STEP_SRC, "utf8");
  assert.match(raw, /data-testid="dedicated-menu-stale-quantity-repair"[\s\S]{0,200}onClick=\{\(\) => onResult\(bindings\.onQuantityChange\(menu, repairTarget\)\)\}/, "repair → bindings.onQuantityChange(menu, repairTarget)");
  assert.equal(/useEffect/.test(codeOf(STEP_SRC)), false, "no mount-time effect normalises the draft");
});

test("PR143-R2: known-in-bounds and never-set quantities keep their existing behaviour; an UNSELECTED stale row offers nothing", () => {
  const services = fresh();
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 3 } };
  const inBounds = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.match(inBounds, /tabular-nums">3</);
  assert.equal(inBounds.includes("dedicated-menu-stale-quantity"), false, "in-bounds: no notice / repair");
  assert.equal(inBounds.includes("数量が未設定です"), false);
  services.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: {}, quantitiesByMenu: {} };
  const unset = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.ok(unset.includes("数量が未設定です"), "never-set quantity keeps the existing 'unset' hint");
  assert.equal(unset.includes("dedicated-menu-stale-quantity"), false, "never-set is not stale");
  services.glass = { selectedMenuIds: [], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 9 } };
  const unselected = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["glass"], services).api} shopRank="detailer" screenConfig={SC} />);
  assert.equal(unselected.includes("dedicated-menu-stale-quantity"), false, "unselected: no line can follow, nothing to repair");
});

test("PR143-R2: repairedDedicatedMenuQuantity is pure and total — nearest bound for a stale value, null when valid or when the bounds are malformed", () => {
  assert.equal(repairedDedicatedMenuQuantity(9, { minQty: 1, maxQty: 6 }), 6);
  assert.equal(repairedDedicatedMenuQuantity(0, { minQty: 1, maxQty: null }), 1);
  assert.equal(repairedDedicatedMenuQuantity(1, { minQty: 2, maxQty: 4 }), 2);
  assert.equal(repairedDedicatedMenuQuantity(2.5, { minQty: 1, maxQty: 6 }), 3, "non-integer inside the range is rounded");
  assert.equal(repairedDedicatedMenuQuantity(Number.NaN, { minQty: 2, maxQty: 4 }), 2);
  assert.equal(repairedDedicatedMenuQuantity(3, { minQty: 1, maxQty: 6 }), null, "valid: nothing to repair");
  assert.equal(repairedDedicatedMenuQuantity(9, { minQty: 0, maxQty: 6 }), null, "malformed min: nothing can be offered");
  assert.equal(repairedDedicatedMenuQuantity(9, { minQty: 3, maxQty: 2 }), null, "malformed max");
});

test("PR143-R2: a wheel / glass menu handed over with a ¥0 configured price reads as 単価未設定 — never a ¥0 label", () => {
  const sc: WizardScreenConfiguration = {
    ...SC,
    wheelMenus: [{ kind: "wheel_menu", id: "wm0", name: "ZZWHEELZERO", defaultUnitPrice: 0, quantityRequired: true, minQty: 1, maxQty: null }],
  };
  const html = render(<Step4Estimate ppfPricingReadiness={PPF_READY} api={makeApi(["wheel"]).api} shopRank="detailer" screenConfig={sc} />);
  assert.ok(html.includes("ZZWHEELZERO"));
  assert.ok(html.includes("単価未設定"), "a persisted 0 is not a configured price");
  assert.equal(html.includes("¥0"), false, "never a ¥0");
});
