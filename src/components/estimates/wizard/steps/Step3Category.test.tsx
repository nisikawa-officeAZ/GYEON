// GDA-ESTIMATE-SERVICE-OFFERING-GRID-R1 — Step-3 service-offering authority tests.
//
// Step 3 receives the dealer's complete authoritative offering map. Each of the five managed
// controls remains in the nine-category grid but becomes disabled/gray when not offered, shows its
// store-setting reason, and emits no canonical patch — even when the store carries a stale selection.
//
// B5b1 (plan §24.1) adds the two dedicated categories ホイール / ガラス plus the optional canonical
// wheel/glass draft sections; their Screen-3, draft-state, bridge-projection and patch-adapter
// contracts are covered at the end of this file.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/Step3Category.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Same TEST-ONLY shim as Step4Estimate.binding.test.tsx: tsx compiles this file's JSX to classic
// `React.createElement`, which needs a global `React` reference before any render call executes.
(globalThis as unknown as { React: typeof React }).React = React;

import { Step3Category, PPF_NOT_OFFERED_REASON, serviceNotOfferedReason } from "./Step3Category";
import { initialCanonicalDraft, projectStore } from "../bridge/ew-ui1-controller";
import { applyEwUi1StorePatch, type WizardStorePatch } from "../bridge/ew-ui1-to-draft";
import { draftToEwUi1Store } from "../bridge/draft-to-ew-ui1";
import { resetWizardDraft, updateServiceConfiguration } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardStore } from "../wizard-types";
import type { EstimateWizardApi } from "../useEstimateWizard";
import {
  SERVICE_CATEGORY_IDS, SERVICE_FAMILIES, isServiceCategoryId, serviceCategoryLabel,
  serviceFamilyForCategory, type ServiceOfferings,
} from "@/lib/estimates/service-categories";

// ── helpers ───────────────────────────────────────────────────────────────────────

function makeApi(categories: string[]): { api: EstimateWizardApi; patches: WizardStorePatch[] } {
  const draft = initialCanonicalDraft();
  const base = projectStore(draft);
  const patches: WizardStorePatch[] = [];
  const store: WizardStore = { ...base, categories };
  const api = {
    step: 3, store, draft,
    updateStore: (p: WizardStorePatch) => patches.push(p),
    jumpTo: () => {}, next: () => {}, back: () => {},
    isFirst: false, isLast: false, completed: new Set<never>() as EstimateWizardApi["completed"],
  } as unknown as EstimateWizardApi;
  return { api, patches };
}

const render = (node: React.ReactElement): string => renderToStaticMarkup(node);

const ALL_OFFERED: ServiceOfferings = {
  window_film: true,
  ppf: true,
  maintenance: true,
  room_cleaning: true,
  car_wash: true,
};

const offerings = (overrides: Partial<ServiceOfferings> = {}): ServiceOfferings => ({
  ...ALL_OFFERED,
  ...overrides,
});

/** Walks the raw element tree Step3Category returns (no DOM) to find the SelectButton by its key. */
type ReactEl = { key?: string | null; props?: { className?: string; disabled?: boolean; selected?: boolean; onClick?: () => void; children?: unknown } };

function findByKey(node: unknown, key: string): ReactEl | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByKey(child, key);
      if (found) return found;
    }
    return null;
  }
  const el = node as ReactEl;
  if (el.key === key) return el;
  if (el.props && "children" in el.props) return findByKey(el.props.children, key);
  return null;
}

const MANAGED_CATEGORIES = [
  ["ppf", "ppf", "PPF"],
  ["window", "window_film", "ウィンドウフィルム"],
  ["maintenance", "maintenance", "ボディ定期メンテナンス"],
  ["carwash", "car_wash", "洗車"],
  ["roomclean", "room_cleaning", "ルームクリーニング"],
] as const;

// ── 1. PPF offered: enabled, selectable, selected state reflects the store ─────────

test("PPF offered: control is enabled and clickable, and selected state reflects the store", () => {
  const off = findByKey(Step3Category({ api: makeApi([]).api, serviceOfferings: ALL_OFFERED }), "ppf")!;
  assert.equal(off.props!.disabled, false, "not disabled while offered");
  assert.equal(off.props!.selected, false, "not selected when absent from the store");
  assert.equal(typeof off.props!.onClick, "function", "clickable while offered");

  const on = findByKey(Step3Category({ api: makeApi(["ppf"]).api, serviceOfferings: ALL_OFFERED }), "ppf")!;
  assert.equal(on.props!.selected, true, "selected reflects the store while offered");
});

// ── 2. PPF offered: exactly one category patch on click ────────────────────────────

test("PPF offered: clicking invokes exactly one category patch", () => {
  const { api, patches } = makeApi([]);
  const el = findByKey(Step3Category({ api, serviceOfferings: ALL_OFFERED }), "ppf")!;
  el.props!.onClick!();
  assert.equal(patches.length, 1, "exactly one patch");
  assert.deepEqual(patches[0], { categories: ["ppf"] });
});

// ── 3. PPF not offered: visible, disabled, gray, exact reason ──────────────────────

test("PPF not offered: control remains visible, disabled, and shows the exact reason", () => {
  const { api } = makeApi([]);
  const ppfOff = offerings({ ppf: false });
  const el = findByKey(Step3Category({ api, serviceOfferings: ppfOff }), "ppf")!;
  assert.equal(el.props!.disabled, true, "disabled while not offered");
  assert.equal(el.props!.onClick, undefined, "no click handler while not offered");

  const html = render(<Step3Category api={makeApi([]).api} serviceOfferings={ppfOff} />);
  assert.ok(html.includes("PPF"), "PPF control is still rendered, not hidden");
  assert.ok(html.includes(PPF_NOT_OFFERED_REASON), "exact store-setting reason shown");
});

// ── 4. PPF not offered: zero patches, even with a stale selected id ────────────────

test("PPF not offered: emits zero patches, including with a stale selected ppf id in the store", () => {
  const { api, patches } = makeApi(["ppf"]);
  const ppfOff = offerings({ ppf: false });
  const el = findByKey(Step3Category({ api, serviceOfferings: ppfOff }), "ppf")!;
  assert.equal(el.props!.selected, false, "a stale selection never renders as active while offering is off");
  assert.equal(el.props!.onClick, undefined, "no click handler to invoke");
  assert.equal(patches.length, 0, "no patch emitted");

  const staleOnlyHtml = render(<Step3Category api={api} serviceOfferings={ppfOff} />);
  assert.equal(staleOnlyHtml.includes("選択中:"), false, "stale unavailable PPF is not counted as selected");

  const oneEffectiveHtml = render(<Step3Category api={makeApi(["coating", "ppf"]).api} serviceOfferings={ppfOff} />);
  assert.ok(oneEffectiveHtml.includes("選択中: 1 カテゴリ"), "only the still-available category is counted");
  assert.equal(oneEffectiveHtml.includes("選択中: 2 カテゴリ"), false, "stale PPF never inflates the count");
});

// ── 5. Every managed category follows its matching store offering ─────────────────

test("all five managed category controls are disabled by their matching store setting", () => {
  for (const [categoryId, offeringKey, label] of MANAGED_CATEGORIES) {
    const { api, patches } = makeApi([categoryId]);
    const tree = Step3Category({ api, serviceOfferings: offerings({ [offeringKey]: false }) });
    const el = findByKey(tree, categoryId)!;
    assert.equal(el.props!.disabled, true, `${categoryId}: disabled`);
    assert.equal(el.props!.selected, false, `${categoryId}: stale selection suppressed`);
    assert.equal(el.props!.onClick, undefined, `${categoryId}: not clickable`);
    assert.equal(patches.length, 0, `${categoryId}: no patch emitted`);

    const html = render(tree);
    assert.ok(html.includes(serviceNotOfferedReason(label)), `${categoryId}: reason shown`);
    assert.equal(html.includes("選択中:"), false, `${categoryId}: stale selection not counted`);
  }
});

// ── 6. Unmanaged categories stay enabled ─────────────────────────────────────────

test("coating and other stay enabled because store offering switches do not govern them", () => {
  const allOff = offerings({
    ppf: false,
    window_film: false,
    maintenance: false,
    car_wash: false,
    room_cleaning: false,
  });
  for (const id of ["coating", "other"]) {
    const { api, patches } = makeApi([]);
    const el = findByKey(Step3Category({ api, serviceOfferings: allOff }), id)!;
    assert.equal(el.props!.disabled, false, `${id}: enabled`);
    assert.equal(typeof el.props!.onClick, "function", `${id}: clickable`);
    el.props!.onClick!();
    assert.deepEqual(patches, [{ categories: [id] }]);
  }
});

// ── 7. Every button has one local fixed height ────────────────────────────────────

test("all nine category buttons use the same fixed height", () => {
  const tree = Step3Category({ api: makeApi([]).api, serviceOfferings: ALL_OFFERED });
  for (const id of ["coating", "ppf", "window", "maintenance", "carwash", "roomclean", "wheel", "glass", "other_coating", "other"]) {
    const el = findByKey(tree, id)!;
    assert.ok(el, `${id}: button present`);
    assert.equal(el.props!.className, "h-[72px]", `${id}: uniform local height`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════
// B5b1 — dedicated ホイール / ガラス categories and their optional canonical sections
// ═════════════════════════════════════════════════════════════════════════════════

const EMPTY_MENU_SECTION = () => ({ selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} });

/** An older 2.2 draft that predates the optional sections (built by omission — never a fixture).
 *  C1: also omits `otherCoating`, so every optional section is exercised as absent. */
function legacyDraft(): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  const { wheel: _wheel, glass: _glass, otherCoating: _otherCoating, ...eightSections } = d.serviceConfiguration;
  return { ...d, serviceConfiguration: eightSections };
}

const asPatch = (p: unknown): WizardStorePatch => p as WizardStorePatch;

// ── 8. Canonical category authority ───────────────────────────────────────────────

test("wheel and glass are canonical category ids with the exact labels, unmanaged by any offering family", () => {
  assert.equal(isServiceCategoryId("wheel"), true);
  assert.equal(isServiceCategoryId("glass"), true);
  assert.equal(serviceCategoryLabel("wheel"), "ホイール");
  assert.equal(serviceCategoryLabel("glass"), "ガラス");
  assert.deepEqual(
    SERVICE_CATEGORY_IDS,
    ["coating", "ppf", "window", "maintenance", "carwash", "roomclean", "wheel", "glass", "other_coating", "other"],
    "canonical order: dedicated categories (and C1 other_coating) precede other",
  );
  assert.equal(serviceFamilyForCategory("wheel"), null, "not governed by a store offering family");
  assert.equal(serviceFamilyForCategory("glass"), null);
  assert.equal(SERVICE_FAMILIES.length, 5, "no new service-offering family was invented");
  assert.equal(isServiceCategoryId("wheel_menu"), false, "a catalogue KIND is not a category id");
  assert.equal(isServiceCategoryId("tire"), false);
});

// ── 9. Screen-3 buttons ───────────────────────────────────────────────────────────

test("ホイール / ガラス render, stay enabled under every offering state, and emit exactly one category patch", () => {
  const allOff = offerings({ ppf: false, window_film: false, maintenance: false, car_wash: false, room_cleaning: false });
  for (const [id, label] of [["wheel", "ホイール"], ["glass", "ガラス"]] as const) {
    for (const so of [ALL_OFFERED, allOff]) {
      const { api, patches } = makeApi([]);
      const tree = Step3Category({ api, serviceOfferings: so });
      const el = findByKey(tree, id)!;
      assert.ok(el, `${id}: button present`);
      assert.equal(el.props!.disabled, false, `${id}: never disabled by a store offering switch`);
      assert.equal(el.props!.selected, false, `${id}: not selected when absent from the store`);
      assert.equal(typeof el.props!.onClick, "function", `${id}: clickable`);
      el.props!.onClick!();
      assert.deepEqual(patches, [{ categories: [id] }], `${id}: exactly one category patch`);
      const html = render(tree);
      assert.ok(html.includes(label), `${id}: label ${label} rendered`);
      assert.equal(html.includes(serviceNotOfferedReason(label)), false, `${id}: no store-setting reason`);
    }
  }
});

test("a stored wheel/glass selection renders as selected and is counted, while old-category semantics are unchanged", () => {
  const ppfOff = offerings({ ppf: false });
  const { api } = makeApi(["wheel", "glass", "ppf"]);
  const tree = Step3Category({ api, serviceOfferings: ppfOff });
  assert.equal(findByKey(tree, "wheel")!.props!.selected, true);
  assert.equal(findByKey(tree, "glass")!.props!.selected, true);
  assert.equal(findByKey(tree, "ppf")!.props!.selected, false, "stale unavailable PPF still suppressed");
  const html = render(tree);
  assert.ok(html.includes("選択中: 2 カテゴリ"), "only wheel and glass are counted");
  assert.ok(html.includes(PPF_NOT_OFFERED_REASON), "PPF reason still shown");
});

test("toggling wheel off from a stored selection removes only wheel", () => {
  const { api, patches } = makeApi(["coating", "wheel"]);
  findByKey(Step3Category({ api, serviceOfferings: ALL_OFFERED }), "wheel")!.props!.onClick!();
  assert.deepEqual(patches, [{ categories: ["coating"] }]);
});

// ── 10. Canonical draft state ─────────────────────────────────────────────────────

test("a NEW canonical draft initialises EMPTY wheel/glass sections — nothing selected, fresh objects per reset", () => {
  const a = resetWizardDraft();
  const b = resetWizardDraft();
  assert.deepEqual(a.serviceConfiguration.wheel, EMPTY_MENU_SECTION());
  assert.deepEqual(a.serviceConfiguration.glass, EMPTY_MENU_SECTION());
  assert.notEqual(a.serviceConfiguration.wheel, b.serviceConfiguration.wheel, "no shared section object");
  assert.notEqual(a.serviceConfiguration.wheel!.quantitiesByMenu, b.serviceConfiguration.wheel!.quantitiesByMenu, "no shared record");
  assert.deepEqual(a.serviceSelection.selectedCategories, [], "no category implied by the empty sections");
  assert.deepEqual(initialCanonicalDraft().serviceConfiguration.glass, EMPTY_MENU_SECTION(), "controller entry point agrees");
});

test("updateServiceConfiguration on an OLD draft lacking the section merges onto a fresh complete section", () => {
  const old = legacyDraft();
  assert.equal("wheel" in old.serviceConfiguration, false);
  const next = updateServiceConfiguration(old, "wheel", { selectedMenuIds: ["wm-1"] });
  assert.deepEqual(next.serviceConfiguration.wheel, { selectedMenuIds: ["wm-1"], unitPricesByMenu: {}, quantitiesByMenu: {} }, "never a partial section");
  assert.equal("glass" in next.serviceConfiguration, false, "the untouched optional section stays absent");
  assert.equal("wheel" in old.serviceConfiguration, false, "previous draft not mutated");
  assert.deepEqual(next.serviceConfiguration.roomCleaning, old.serviceConfiguration.roomCleaning, "eight sections carried over");
});

// ── 11. Bridge projection (draft → store) ─────────────────────────────────────────

test("projection deep-clones the wheel/glass sections: mutating the store can never reach the draft", () => {
  let draft = resetWizardDraft();
  draft = updateServiceConfiguration(draft, "wheel", { selectedMenuIds: ["wm-1"], unitPricesByMenu: { "wm-1": "12000" }, quantitiesByMenu: { "wm-1": 4 } });
  const store = draftToEwUi1Store(draft);
  assert.deepEqual(store.services.wheel, draft.serviceConfiguration.wheel, "lossless");
  assert.notEqual(store.services.wheel, draft.serviceConfiguration.wheel, "section object copied");
  assert.notEqual(store.services.wheel!.selectedMenuIds, draft.serviceConfiguration.wheel!.selectedMenuIds, "array copied");
  assert.notEqual(store.services.wheel!.unitPricesByMenu, draft.serviceConfiguration.wheel!.unitPricesByMenu, "record copied");
  assert.notEqual(store.services.wheel!.quantitiesByMenu, draft.serviceConfiguration.wheel!.quantitiesByMenu, "record copied");
  store.services.wheel!.selectedMenuIds.push("late");
  store.services.wheel!.quantitiesByMenu["wm-1"] = 99;
  store.services.glass!.selectedMenuIds.push("gm-x");
  assert.deepEqual(draft.serviceConfiguration.wheel!.selectedMenuIds, ["wm-1"], "draft untouched");
  assert.equal(draft.serviceConfiguration.wheel!.quantitiesByMenu["wm-1"], 4, "draft untouched");
  assert.deepEqual(draft.serviceConfiguration.glass!.selectedMenuIds, [], "draft untouched");
  assert.deepEqual(projectStore(draft).services.wheel, draft.serviceConfiguration.wheel, "controller projection agrees");
});

test("an OLD draft WITHOUT wheel/glass sections projects WITHOUT them — no section or selection is fabricated", () => {
  const old = legacyDraft();
  const store = draftToEwUi1Store(old);
  assert.equal("wheel" in store.services, false, "no wheel section fabricated");
  assert.equal("glass" in store.services, false, "no glass section fabricated");
  assert.deepEqual(store.categories, [], "no category implied");
  assert.deepEqual(store.services.roomCleaning, old.serviceConfiguration.roomCleaning, "eight sections still projected");
  assert.deepEqual(store.services.storeGlobalOptions, old.serviceConfiguration.storeGlobalOptions);
});

// ── 12. Patch adapter (store → draft) ─────────────────────────────────────────────

test("the patch adapter accepts the three safe fields, copies them on apply, and leaves the previous draft untouched", () => {
  const ids = ["wm-1", "wm-2"];
  const prices = { "wm-1": "12000", "wm-2": "8000" };
  const qty = { "wm-1": 4, "wm-2": 0 };
  const before = resetWizardDraft();
  const r = applyEwUi1StorePatch(before, {
    categories: ["wheel", "glass"],
    services: {
      wheel: { selectedMenuIds: ids, unitPricesByMenu: prices, quantitiesByMenu: qty },
      glass: { selectedMenuIds: ["gm-1"], quantitiesByMenu: { "gm-1": 1 } },
    },
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const w = r.draft.serviceConfiguration.wheel!;
  assert.deepEqual(w, { selectedMenuIds: ids, unitPricesByMenu: prices, quantitiesByMenu: qty });
  assert.notEqual(w.selectedMenuIds, ids, "array copied");
  assert.notEqual(w.unitPricesByMenu, prices, "record copied");
  assert.notEqual(w.quantitiesByMenu, qty, "record copied");
  ids.push("late"); prices["wm-1"] = "0"; qty["wm-1"] = 99;
  assert.deepEqual(w.selectedMenuIds, ["wm-1", "wm-2"], "copy-on-apply: caller mutation cannot reach canonical state");
  assert.equal(w.unitPricesByMenu["wm-1"], "12000");
  assert.equal(w.quantitiesByMenu["wm-1"], 4);
  assert.deepEqual(r.draft.serviceConfiguration.glass, { selectedMenuIds: ["gm-1"], unitPricesByMenu: {}, quantitiesByMenu: { "gm-1": 1 } }, "partial glass patch merged onto the empty section");
  assert.deepEqual(r.draft.serviceSelection.selectedCategories, ["wheel", "glass"], "categories accepted as canonical ids");
  assert.deepEqual(before.serviceConfiguration.wheel, EMPTY_MENU_SECTION(), "previous draft not mutated");
});

test("patching wheel on an OLD draft lacking the section yields a complete section and leaves glass absent", () => {
  const r = applyEwUi1StorePatch(legacyDraft(), { services: { wheel: { selectedMenuIds: ["wm-1"] } } });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.draft.serviceConfiguration.wheel, { selectedMenuIds: ["wm-1"], unitPricesByMenu: {}, quantitiesByMenu: {} });
  assert.equal("glass" in r.draft.serviceConfiguration, false);
});

test("deselecting the wheel category never erases the wheel configuration (separate fields)", () => {
  let draft = resetWizardDraft();
  const seeded = applyEwUi1StorePatch(draft, { categories: ["wheel"], services: { wheel: { selectedMenuIds: ["wm-1"], quantitiesByMenu: { "wm-1": 4 } } } });
  assert.equal(seeded.ok, true);
  if (!seeded.ok) return;
  draft = seeded.draft;
  const r = applyEwUi1StorePatch(draft, { categories: [] });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.draft.serviceSelection.selectedCategories, []);
  assert.deepEqual(r.draft.serviceConfiguration.wheel!.selectedMenuIds, ["wm-1"], "Screen-4 intent preserved");
});

test("malformed wheel/glass patches fail closed with exact schema-derived field paths", () => {
  const cases: Array<[string, unknown, string]> = [
    ["fractional quantity", { quantitiesByMenu: { m: 1.5 } }, "quantitiesByMenu"],
    ["negative quantity", { quantitiesByMenu: { m: -1 } }, "quantitiesByMenu"],
    ["NaN quantity", { quantitiesByMenu: { m: Number.NaN } }, "quantitiesByMenu"],
    ["Infinity quantity", { quantitiesByMenu: { m: Number.POSITIVE_INFINITY } }, "quantitiesByMenu"],
    ["string quantity", { quantitiesByMenu: { m: "4" } }, "quantitiesByMenu"],
    ["boolean quantity", { quantitiesByMenu: { m: true } }, "quantitiesByMenu"],
    ["array quantities", { quantitiesByMenu: [4] }, "quantitiesByMenu"],
    ["null quantities", { quantitiesByMenu: null }, "quantitiesByMenu"],
    ["numeric unit price", { unitPricesByMenu: { m: 12000 } }, "unitPricesByMenu"],
    ["null unit price", { unitPricesByMenu: { m: null } }, "unitPricesByMenu"],
    ["non-string menu id", { selectedMenuIds: [1] }, "selectedMenuIds"],
    ["null menu id", { selectedMenuIds: [null] }, "selectedMenuIds"],
    ["object menu ids", { selectedMenuIds: {} }, "selectedMenuIds"],
    ["unknown field", { selectedMenuIds: [], durationMinutes: 30 }, "*"],
    ["smuggled price field", { selectedMenuIds: [], unitPrice: 1 }, "*"],
    ["prototype-pollution key", JSON.parse('{"__proto__":{"x":1}}'), "*"],
  ];
  for (const section of ["wheel", "glass"] as const) {
    for (const [label, bad, field] of cases) {
      const before = resetWizardDraft();
      const r = applyEwUi1StorePatch(before, asPatch({ categories: [section], services: { [section]: bad } }));
      assert.equal(r.ok, false, `${section} ${label}: rejected`);
      if (r.ok) continue;
      assert.equal(r.error.code, "EW_UI_INVALID_PATCH", `${section} ${label}: code`);
      assert.deepEqual(r.error.fieldPaths, [`services.${section}.${field}`], `${section} ${label}: exact path`);
      assert.equal(JSON.stringify(r.error).includes("durationMinutes"), false, "caller key text never echoed");
      assert.deepEqual(before.serviceConfiguration[section], EMPTY_MENU_SECTION(), `${section} ${label}: nothing applied`);
    }
    for (const notObject of [null, "wheel", 4, []]) {
      const r = applyEwUi1StorePatch(resetWizardDraft(), asPatch({ services: { [section]: notObject } }));
      assert.equal(r.ok, false, `${section} non-object ${String(notObject)}: rejected`);
      if (r.ok) continue;
      assert.deepEqual(r.error.fieldPaths, [`services.${section}`]);
    }
  }
  const probe: Record<string, unknown> = {};
  assert.equal(probe.x, undefined, "Object.prototype was not polluted");
});

test("an invalid wheel patch rejects the WHOLE patch — a valid category change in the same patch is not applied", () => {
  const r = applyEwUi1StorePatch(resetWizardDraft(), asPatch({ categories: ["coating"], services: { wheel: { quantitiesByMenu: { m: -1 } } } }));
  assert.equal(r.ok, false);
});

// ═════════════════════════════════════════════════════════════════════════════════
// GDA-OTHER-COATINGS-R1 (C1) — その他コーティング category + optional `otherCoating` draft section
// ═════════════════════════════════════════════════════════════════════════════════
// Non-body coatings (resin trim / seat / engine room / future dealer-added items) are a DISTINCT
// Screen-3 category: not body `coating`, not the B5 `wheel` / `glass` menus, not `other`. C1 is the
// category/draft contract ONLY — no pricing, no row selection — so these tests pin identity, ordering,
// Screen-3 behaviour, draft-state initialisation, old-snapshot compatibility and the bridges.

test("C1: other_coating is a canonical category id with the exact label, ordered after glass and before other, unmanaged by any family", () => {
  assert.equal(isServiceCategoryId("other_coating"), true);
  assert.equal(serviceCategoryLabel("other_coating"), "その他コーティング");
  assert.equal(SERVICE_CATEGORY_IDS.indexOf("other_coating"), SERVICE_CATEGORY_IDS.indexOf("glass") + 1, "directly after glass");
  assert.equal(SERVICE_CATEGORY_IDS.indexOf("other_coating"), SERVICE_CATEGORY_IDS.indexOf("other") - 1, "directly before other");
  assert.equal(serviceFamilyForCategory("other_coating"), null, "not governed by a store offering family");
  assert.equal(SERVICE_FAMILIES.length, 5, "no new service-offering family was invented");
  // Distinct from every neighbouring concept — none of these spellings is a category id.
  for (const notId of ["otherCoating", "other-coating", "coating_other", "trim", "seat", "engine_room", "resin_trim"]) {
    assert.equal(isServiceCategoryId(notId), false, `${notId} is not a category id`);
  }
  // Existing category labels are untouched.
  assert.equal(serviceCategoryLabel("coating"), "ボディコーティング");
  assert.equal(serviceCategoryLabel("wheel"), "ホイール");
  assert.equal(serviceCategoryLabel("glass"), "ガラス");
  assert.equal(serviceCategoryLabel("other"), "その他作業");
});

test("C1: その他コーティング renders, stays enabled under every offering state, and emits exactly one category patch", () => {
  const allOff = offerings({ ppf: false, window_film: false, maintenance: false, car_wash: false, room_cleaning: false });
  for (const so of [ALL_OFFERED, allOff]) {
    const { api, patches } = makeApi([]);
    const tree = Step3Category({ api, serviceOfferings: so });
    const el = findByKey(tree, "other_coating")!;
    assert.ok(el, "button present");
    assert.equal(el.props!.disabled, false, "never disabled by a store offering switch");
    assert.equal(el.props!.selected, false, "not selected when absent from the store");
    assert.equal(typeof el.props!.onClick, "function", "clickable");
    el.props!.onClick!();
    assert.deepEqual(patches, [{ categories: ["other_coating"] }], "exactly one category patch");
    const html = render(tree);
    assert.ok(html.includes("その他コーティング"), "label rendered");
    assert.equal(html.includes(serviceNotOfferedReason("その他コーティング")), false, "no store-setting reason");
  }
});

test("C1: selecting other_coating never selects or deselects coating / other / wheel / glass", () => {
  const { api, patches } = makeApi(["coating", "other"]);
  findByKey(Step3Category({ api, serviceOfferings: ALL_OFFERED }), "other_coating")!.props!.onClick!();
  assert.deepEqual(patches, [{ categories: ["coating", "other", "other_coating"] }]);
  const stored = makeApi(["other_coating", "wheel"]);
  const tree = Step3Category({ api: stored.api, serviceOfferings: ALL_OFFERED });
  assert.equal(findByKey(tree, "other_coating")!.props!.selected, true);
  assert.equal(findByKey(tree, "coating")!.props!.selected, false, "body coating not implied");
  assert.equal(findByKey(tree, "other")!.props!.selected, false, "other work not implied");
  assert.ok(render(tree).includes("選択中: 2 カテゴリ"));
  findByKey(tree, "other_coating")!.props!.onClick!();
  assert.deepEqual(stored.patches, [{ categories: ["wheel"] }], "toggling off removes only other_coating");
});

test("C1: a NEW canonical draft initialises an EMPTY otherCoating section — fresh objects per reset, nothing implied", () => {
  const a = resetWizardDraft();
  const b = resetWizardDraft();
  assert.deepEqual(a.serviceConfiguration.otherCoating, EMPTY_MENU_SECTION());
  assert.notEqual(a.serviceConfiguration.otherCoating, b.serviceConfiguration.otherCoating, "no shared section object");
  assert.notEqual(a.serviceConfiguration.otherCoating!.quantitiesByMenu, b.serviceConfiguration.otherCoating!.quantitiesByMenu, "no shared record");
  assert.notEqual(a.serviceConfiguration.otherCoating, a.serviceConfiguration.wheel, "not aliased to the wheel section");
  assert.notEqual(a.serviceConfiguration.otherCoating, a.serviceConfiguration.glass, "not aliased to the glass section");
  assert.deepEqual(a.serviceSelection.selectedCategories, [], "no category implied by the empty section");
  assert.deepEqual(initialCanonicalDraft().serviceConfiguration.otherCoating, EMPTY_MENU_SECTION(), "controller entry point agrees");
  // Body coating and other-work sections are untouched by the new section.
  assert.deepEqual(a.serviceConfiguration.coating, { layerCount: null, layer1Id: null, layer2Id: null, layer3Id: null });
  assert.deepEqual(a.serviceConfiguration.otherWork, { selectedPresetIds: [], unitPricesByItem: {}, quantitiesByItem: {}, customRows: [] });
});

test("C1: an OLD draft WITHOUT otherCoating is valid; a patch merges onto a fresh complete section and touches no other section", () => {
  const old = legacyDraft();
  assert.equal("otherCoating" in old.serviceConfiguration, false);
  const next = updateServiceConfiguration(old, "otherCoating", { selectedMenuIds: ["oc-trim"] });
  assert.deepEqual(next.serviceConfiguration.otherCoating, { selectedMenuIds: ["oc-trim"], unitPricesByMenu: {}, quantitiesByMenu: {} }, "never a partial section");
  assert.equal("wheel" in next.serviceConfiguration, false, "untouched optional wheel stays absent");
  assert.equal("glass" in next.serviceConfiguration, false, "untouched optional glass stays absent");
  assert.equal("otherCoating" in old.serviceConfiguration, false, "previous draft not mutated");
  assert.deepEqual(next.serviceConfiguration.coating, old.serviceConfiguration.coating, "body coating untouched");
  assert.deepEqual(next.serviceConfiguration.otherWork, old.serviceConfiguration.otherWork, "other work untouched");
  // Conversely a wheel patch on the old draft still leaves otherCoating absent (no fabrication).
  const w = updateServiceConfiguration(old, "wheel", { selectedMenuIds: ["wm-1"] });
  assert.equal("otherCoating" in w.serviceConfiguration, false);
});

test("C1: projection deep-clones otherCoating; an OLD draft without it projects without it", () => {
  let draft = resetWizardDraft();
  draft = updateServiceConfiguration(draft, "otherCoating", { selectedMenuIds: ["oc-trim"], unitPricesByMenu: { "oc-trim": "15000" }, quantitiesByMenu: { "oc-trim": 1 } });
  const store = draftToEwUi1Store(draft);
  assert.deepEqual(store.services.otherCoating, draft.serviceConfiguration.otherCoating, "lossless");
  assert.notEqual(store.services.otherCoating, draft.serviceConfiguration.otherCoating, "section object copied");
  assert.notEqual(store.services.otherCoating!.selectedMenuIds, draft.serviceConfiguration.otherCoating!.selectedMenuIds, "array copied");
  assert.notEqual(store.services.otherCoating!.unitPricesByMenu, draft.serviceConfiguration.otherCoating!.unitPricesByMenu, "record copied");
  assert.notEqual(store.services.otherCoating!.quantitiesByMenu, draft.serviceConfiguration.otherCoating!.quantitiesByMenu, "record copied");
  store.services.otherCoating!.selectedMenuIds.push("late");
  store.services.otherCoating!.quantitiesByMenu["oc-trim"] = 99;
  assert.deepEqual(draft.serviceConfiguration.otherCoating!.selectedMenuIds, ["oc-trim"], "draft untouched");
  assert.equal(draft.serviceConfiguration.otherCoating!.quantitiesByMenu["oc-trim"], 1, "draft untouched");
  assert.deepEqual(projectStore(draft).services.otherCoating, draft.serviceConfiguration.otherCoating, "controller projection agrees");

  const old = draftToEwUi1Store(legacyDraft());
  assert.equal("otherCoating" in old.services, false, "no otherCoating section fabricated");
  assert.equal("wheel" in old.services, false);
  assert.equal("glass" in old.services, false);
  assert.deepEqual(old.categories, [], "no category implied");
});

test("C1: the patch adapter accepts the three safe otherCoating fields, copies them on apply, and rejects everything else at the exact path", () => {
  const ids = ["oc-trim", "oc-seat"];
  const prices = { "oc-trim": "15000", "oc-seat": "20000" };
  const qty = { "oc-trim": 1, "oc-seat": 2 };
  const before = resetWizardDraft();
  const r = applyEwUi1StorePatch(before, {
    categories: ["other_coating"],
    services: { otherCoating: { selectedMenuIds: ids, unitPricesByMenu: prices, quantitiesByMenu: qty } },
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const oc = r.draft.serviceConfiguration.otherCoating!;
  assert.deepEqual(oc, { selectedMenuIds: ids, unitPricesByMenu: prices, quantitiesByMenu: qty });
  assert.notEqual(oc.selectedMenuIds, ids, "array copied");
  assert.notEqual(oc.unitPricesByMenu, prices, "record copied");
  assert.notEqual(oc.quantitiesByMenu, qty, "record copied");
  ids.push("late"); prices["oc-trim"] = "0"; qty["oc-trim"] = 99;
  assert.deepEqual(oc.selectedMenuIds, ["oc-trim", "oc-seat"], "copy-on-apply: caller mutation cannot reach canonical state");
  assert.equal(oc.unitPricesByMenu["oc-trim"], "15000");
  assert.equal(oc.quantitiesByMenu["oc-trim"], 1);
  assert.deepEqual(r.draft.serviceSelection.selectedCategories, ["other_coating"]);
  assert.deepEqual(before.serviceConfiguration.otherCoating, EMPTY_MENU_SECTION(), "previous draft untouched");
  assert.deepEqual(r.draft.serviceConfiguration.wheel, EMPTY_MENU_SECTION(), "wheel untouched");
  assert.deepEqual(r.draft.serviceConfiguration.glass, EMPTY_MENU_SECTION(), "glass untouched");

  const cases: Array<[string, unknown, string]> = [
    ["negative quantity", { quantitiesByMenu: { m: -1 } }, "quantitiesByMenu"],
    ["fractional quantity", { quantitiesByMenu: { m: 1.5 } }, "quantitiesByMenu"],
    ["numeric unit price", { unitPricesByMenu: { m: 15000 } }, "unitPricesByMenu"],
    ["non-string menu id", { selectedMenuIds: [1] }, "selectedMenuIds"],
    ["unknown field", { selectedMenuIds: [], fixedOne: true }, "*"],
    ["smuggled price field", { selectedMenuIds: [], unitPrice: 1 }, "*"],
    ["prototype-pollution key", JSON.parse('{"__proto__":{"x":1}}'), "*"],
  ];
  for (const [label, bad, field] of cases) {
    const fresh = resetWizardDraft();
    const bad1 = applyEwUi1StorePatch(fresh, asPatch({ categories: ["other_coating"], services: { otherCoating: bad } }));
    assert.equal(bad1.ok, false, `${label}: rejected`);
    if (bad1.ok) continue;
    assert.equal(bad1.error.code, "EW_UI_INVALID_PATCH", `${label}: code`);
    assert.deepEqual(bad1.error.fieldPaths, [`services.otherCoating.${field}`], `${label}: exact path`);
    assert.equal(JSON.stringify(bad1.error).includes("fixedOne"), false, "caller key text never echoed");
    assert.deepEqual(fresh.serviceConfiguration.otherCoating, EMPTY_MENU_SECTION(), `${label}: nothing applied`);
  }
  for (const notObject of [null, "other_coating", 4, []]) {
    const bad2 = applyEwUi1StorePatch(resetWizardDraft(), asPatch({ services: { otherCoating: notObject } }));
    assert.equal(bad2.ok, false, `non-object ${String(notObject)}: rejected`);
    if (bad2.ok) continue;
    assert.deepEqual(bad2.error.fieldPaths, ["services.otherCoating"]);
  }
  // An invalid otherCoating patch rejects the WHOLE patch — a valid wheel change alongside is not applied.
  const whole = applyEwUi1StorePatch(resetWizardDraft(), asPatch({ services: { wheel: { selectedMenuIds: ["wm-1"] }, otherCoating: { quantitiesByMenu: { m: -1 } } } }));
  assert.equal(whole.ok, false);
  const probe: Record<string, unknown> = {};
  assert.equal(probe.x, undefined, "Object.prototype was not polluted");
});
