// GDA-ESTIMATE-SERVICE-OFFERING-GRID-R1 — Step-3 service-offering authority tests.
//
// Step 3 receives the dealer's complete authoritative offering map. Each of the five managed
// controls remains in the seven-category grid but becomes disabled/gray when not offered, shows its
// store-setting reason, and emits no canonical patch — even when the store carries a stale selection.
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
import type { WizardStorePatch } from "../bridge/ew-ui1-to-draft";
import type { WizardStore } from "../wizard-types";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { ServiceOfferings } from "@/lib/estimates/service-categories";

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

test("all seven category buttons use the same fixed height", () => {
  const tree = Step3Category({ api: makeApi([]).api, serviceOfferings: ALL_OFFERED });
  for (const id of ["coating", "ppf", "window", "maintenance", "carwash", "roomclean", "other"]) {
    const el = findByKey(tree, id)!;
    assert.equal(el.props!.className, "h-[72px]", `${id}: uniform local height`);
  }
});
