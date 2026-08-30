// GDA-ESTIMATE-PPF-OFFERING-R1-A — Step-3 PPF-offering authority tests.
//
// Step 3 receives the dealer's authoritative PPF offering as one boolean prop. Offered: the PPF
// control behaves exactly like the other six categories. Not offered: PPF stays in the seven-category
// grid, disabled/gray, shows the exact store-setting reason, and emits no canonical patch — even when
// the supplied store already carries a stale selected "ppf" id.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/Step3Category.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Same TEST-ONLY shim as Step4Estimate.binding.test.tsx: tsx compiles this file's JSX to classic
// `React.createElement`, which needs a global `React` reference before any render call executes.
(globalThis as unknown as { React: typeof React }).React = React;

import { Step3Category, PPF_NOT_OFFERED_REASON } from "./Step3Category";
import { initialCanonicalDraft, projectStore } from "../bridge/ew-ui1-controller";
import type { WizardStorePatch } from "../bridge/ew-ui1-to-draft";
import type { WizardStore } from "../wizard-types";
import type { EstimateWizardApi } from "../useEstimateWizard";

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

/** Walks the raw element tree Step3Category returns (no DOM) to find the SelectButton by its key. */
type ReactEl = { key?: string | null; props?: { disabled?: boolean; selected?: boolean; onClick?: () => void; children?: unknown } };

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

const OTHER_CATEGORY_IDS = ["coating", "window", "maintenance", "carwash", "roomclean", "other"];

// ── 1. PPF offered: enabled, selectable, selected state reflects the store ─────────

test("PPF offered: control is enabled and clickable, and selected state reflects the store", () => {
  const off = findByKey(Step3Category({ api: makeApi([]).api, ppfOffered: true }), "ppf")!;
  assert.equal(off.props!.disabled, false, "not disabled while offered");
  assert.equal(off.props!.selected, false, "not selected when absent from the store");
  assert.equal(typeof off.props!.onClick, "function", "clickable while offered");

  const on = findByKey(Step3Category({ api: makeApi(["ppf"]).api, ppfOffered: true }), "ppf")!;
  assert.equal(on.props!.selected, true, "selected reflects the store while offered");
});

// ── 2. PPF offered: exactly one category patch on click ────────────────────────────

test("PPF offered: clicking invokes exactly one category patch", () => {
  const { api, patches } = makeApi([]);
  const el = findByKey(Step3Category({ api, ppfOffered: true }), "ppf")!;
  el.props!.onClick!();
  assert.equal(patches.length, 1, "exactly one patch");
  assert.deepEqual(patches[0], { categories: ["ppf"] });
});

// ── 3. PPF not offered: visible, disabled, gray, exact reason ──────────────────────

test("PPF not offered: control remains visible, disabled, and shows the exact reason", () => {
  const { api } = makeApi([]);
  const el = findByKey(Step3Category({ api, ppfOffered: false }), "ppf")!;
  assert.equal(el.props!.disabled, true, "disabled while not offered");
  assert.equal(el.props!.onClick, undefined, "no click handler while not offered");

  const html = render(<Step3Category api={makeApi([]).api} ppfOffered={false} />);
  assert.ok(html.includes("PPF"), "PPF control is still rendered, not hidden");
  assert.ok(html.includes(PPF_NOT_OFFERED_REASON), "exact store-setting reason shown");
});

// ── 4. PPF not offered: zero patches, even with a stale selected id ────────────────

test("PPF not offered: emits zero patches, including with a stale selected ppf id in the store", () => {
  const { api, patches } = makeApi(["ppf"]);
  const el = findByKey(Step3Category({ api, ppfOffered: false }), "ppf")!;
  assert.equal(el.props!.selected, false, "a stale selection never renders as active while offering is off");
  assert.equal(el.props!.onClick, undefined, "no click handler to invoke");
  assert.equal(patches.length, 0, "no patch emitted");

  const staleOnlyHtml = render(<Step3Category api={api} ppfOffered={false} />);
  assert.equal(staleOnlyHtml.includes("選択中:"), false, "stale unavailable PPF is not counted as selected");

  const oneEffectiveHtml = render(<Step3Category api={makeApi(["coating", "ppf"]).api} ppfOffered={false} />);
  assert.ok(oneEffectiveHtml.includes("選択中: 1 カテゴリ"), "only the still-available category is counted");
  assert.equal(oneEffectiveHtml.includes("選択中: 2 カテゴリ"), false, "stale PPF never inflates the count");
});

// ── 5. The other six controls stay enabled and behave exactly as before ────────────

test("the other six category controls remain enabled and preserve their current behavior", () => {
  for (const ppfOffered of [true, false]) {
    const { api, patches } = makeApi([]);
    const tree = Step3Category({ api, ppfOffered });
    for (const id of OTHER_CATEGORY_IDS) {
      const el = findByKey(tree, id)!;
      assert.equal(el.props!.disabled, false, `${id}: enabled regardless of ppfOffered=${ppfOffered}`);
      assert.equal(typeof el.props!.onClick, "function", `${id}: clickable`);
      patches.length = 0;
      el.props!.onClick!();
      assert.equal(patches.length, 1, `${id}: exactly one patch on click`);
      assert.deepEqual(patches[0], { categories: [id] });
    }
  }
});
