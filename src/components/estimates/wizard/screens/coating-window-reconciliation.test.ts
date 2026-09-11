// C2B2A — focused tests: canonical coating identities, rank/layer matrices, the single pricing-id
// adapter (matte-evo fail-closed), and the seven canonical window identities.
//
// Run: node --import tsx --test src/components/estimates/wizard/screens/coating-window-reconciliation.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  firstLayerOptions,
  secondLayerOptions,
  thirdLayerOptions,
  isCoatingAvailableForRank,
  COATING_PRODUCT_LABELS,
} from "./coating-matrix";
import { DEFAULT_WINDOW_AREAS } from "./window-film-config";
import type { ShopRank } from "./step-types";
import {
  CANONICAL_COATING_IDS,
  LEGACY_PRICING_COATING_IDS,
  CANONICAL_TO_PRICING_COATING_ID,
  toPricingCatalogCoatingId,
} from "@/lib/pricing/wizard-coating-id-adapter";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/pricing-catalog";
import { buildWizardPricingInput } from "../pricing/wizard-pricing-input-adapter";
import { initialEstimateWizardDraftV22 } from "../draft/wizard-draft-state";
import { mapWizardDraftToPreview } from "../integration/previewMapper";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";

const RANKS: ShopRank[] = ["shop", "detailer", "certified", "ppf_installer"];
const SIX_PRO_BASES = ["one-evo", "pure-evo", "mohs-evo", "syncro-evo", "infinite-base-1", "infinite-base-2"];

function allEmittedCoatingIds(): Set<string> {
  const ids = new Set<string>();
  for (const r of RANKS) firstLayerOptions(r).forEach((o) => ids.add(o.id));
  for (const first of [...CANONICAL_COATING_IDS]) {
    secondLayerOptions(first).forEach((o) => ids.add(o.id));
    thirdLayerOptions(first).forEach((o) => ids.add(o.id));
  }
  return ids;
}

function draft(mut: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const d = structuredClone(initialEstimateWizardDraftV22);
  mut(d);
  return d;
}

// ── Coating identities ─────────────────────────────────────────────────────────
test("every canonical coating ID is unique and there are exactly 11", () => {
  assert.equal(CANONICAL_COATING_IDS.length, 11);
  assert.equal(new Set(CANONICAL_COATING_IDS).size, 11);
});

test("every displayed coating has a canonical ID and its exact label", () => {
  const emitted = allEmittedCoatingIds();
  for (const id of emitted) {
    assert.ok(CANONICAL_COATING_IDS.includes(id as never), `emitted non-canonical id: ${id}`);
    assert.ok(COATING_PRODUCT_LABELS[id] && COATING_PRODUCT_LABELS[id].trim() !== "", `missing label: ${id}`);
  }
  assert.equal(COATING_PRODUCT_LABELS["cancoat-pro-evo"], "Q² CANCOAT PRO EVO");
  assert.equal(COATING_PRODUCT_LABELS["infinite-topcoat-1"], "Q² INFINITE TOPCOAT TYPE 1");
});

test("the Wizard never emits a legacy Pricing ID", () => {
  const emitted = allEmittedCoatingIds();
  for (const legacy of LEGACY_PRICING_COATING_IDS) {
    assert.ok(!emitted.has(legacy), `Wizard emitted legacy pricing id: ${legacy}`);
  }
});

test("the single pricing adapter maps every canonical ID exactly", () => {
  assert.deepEqual(CANONICAL_TO_PRICING_COATING_ID, {
    "one-evo": "one-evo",
    "cancoat-evo": "cancoat-evo",
    "pure-evo": "pure-evo",
    "mohs-evo": "mohs-evo",
    "syncro-evo": "syncro-evo",
    "matte-evo": "matte-evo",
    "infinite-base-1": "infinit1",
    "infinite-base-2": "infinit2",
    "infinite-topcoat-1": "infinit-t1",
    "infinite-topcoat-2": "infinit-t2",
    "cancoat-pro-evo": "cancoat-evo-pro",
  });
  assert.equal(toPricingCatalogCoatingId("infinite-base-1"), "infinit1");
  assert.equal(toPricingCatalogCoatingId("cancoat-pro-evo"), "cancoat-evo-pro");
  assert.equal(toPricingCatalogCoatingId("totally-unknown"), null);
});

test("matte-evo now resolves to its authoritative base (C2B3B1) — no longer fail-closed", () => {
  assert.equal(toPricingCatalogCoatingId("matte-evo"), "matte-evo");
  assert.ok(DEFAULT_PRICING_CATALOG.coatings.some((c) => c.id === "matte-evo"));
  const d = draft((x) => {
    x.serviceSelection = { selectedCategories: ["coating"] };
    x.vehicle = { ...x.vehicle, bodySizeKey: "M" };
    x.serviceConfiguration.coating = { ...x.serviceConfiguration.coating, layerCount: 1, layer1Id: "matte-evo" };
  });
  const out = buildWizardPricingInput(d);
  assert.equal(out.catalogResolved, true);
  const coat = out.services.find((s) => s.type === "coating") as { coatingId: string } | undefined;
  assert.equal(coat?.coatingId, "matte-evo"); // canonical == pricing key
  assert.ok(!out.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"));
});

test("a genuinely unknown coating id still fails closed", () => {
  assert.equal(toPricingCatalogCoatingId("no-such-coating"), null);
  const d = draft((x) => {
    x.serviceSelection = { selectedCategories: ["coating"] };
    x.serviceConfiguration.coating = { ...x.serviceConfiguration.coating, layerCount: 1, layer1Id: "no-such-coating" };
  });
  const out = buildWizardPricingInput(d);
  assert.equal(out.catalogResolved, false);
  assert.ok(out.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"));
});

test("infinite-base-1 now resolves through the adapter to its PricingCatalog id", () => {
  const d = draft((x) => {
    x.serviceSelection = { selectedCategories: ["coating"] };
    x.vehicle = { ...x.vehicle, bodySizeKey: "M" };
    x.serviceConfiguration.coating = { ...x.serviceConfiguration.coating, layerCount: 1, layer1Id: "infinite-base-1" };
  });
  const out = buildWizardPricingInput(d);
  assert.equal(out.catalogResolved, true);
  const coat = out.services.find((s) => s.type === "coating") as { coatingId: string } | undefined;
  assert.equal(coat?.coatingId, "infinit1"); // translated, not the canonical id
});

// ── Rank matrix ──────────────────────────────────────────────────────────────
test("CANCOAT EVO is standalone for shop, detailer, and certified", () => {
  for (const r of ["shop", "detailer", "certified"] as ShopRank[]) {
    assert.ok(firstLayerOptions(r).some((o) => o.id === "cancoat-evo"), `cancoat-evo missing as first layer for ${r}`);
  }
});

test("coating is unavailable for ppf_installer", () => {
  assert.equal(isCoatingAvailableForRank("ppf_installer"), false);
  assert.deepEqual(firstLayerOptions("ppf_installer"), []);
});

test("INFINITE BASE and CANCOAT PRO EVO are certified-only", () => {
  for (const id of ["infinite-base-1", "infinite-base-2", "cancoat-pro-evo"]) {
    assert.ok(firstLayerOptions("certified").some((o) => o.id === id), `${id} missing for certified`);
    assert.ok(!firstLayerOptions("shop").some((o) => o.id === id), `${id} leaked to shop`);
    assert.ok(!firstLayerOptions("detailer").some((o) => o.id === id), `${id} leaked to detailer`);
  }
});

// ── Layer matrix ─────────────────────────────────────────────────────────────
const l2 = (first: string, rank?: ShopRank) => secondLayerOptions(first, rank).map((o) => o.id);
const l3 = (first: string) => thirdLayerOptions(first).map((o) => o.id);

test("CANCOAT EVO upper-layer positives are preserved for ONE/PURE/MOHS", () => {
  for (const base of ["one-evo", "pure-evo", "mohs-evo"]) {
    assert.ok(l2(base).includes("cancoat-evo"), `${base} L2 lost cancoat-evo`);
    assert.ok(l3(base).includes("cancoat-evo"), `${base} L3 lost cancoat-evo`);
  }
});

test("CANCOAT EVO as first/standalone fabricates no further layers", () => {
  assert.deepEqual(l2("cancoat-evo"), []);
  assert.deepEqual(l3("cancoat-evo"), []);
});

test("CANCOAT PRO EVO standalone (certified) fabricates no invented 2nd/3rd layer", () => {
  assert.ok(firstLayerOptions("certified").some((o) => o.id === "cancoat-pro-evo"));
  assert.deepEqual(l2("cancoat-pro-evo"), []);
  assert.deepEqual(l3("cancoat-pro-evo"), []);
});

test("CANCOAT PRO EVO is an allowed upper layer over exactly the six approved bases, for certified rank", () => {
  for (const base of SIX_PRO_BASES) {
    assert.ok(l2(base, "certified").includes("cancoat-pro-evo"), `cancoat-pro-evo not allowed over ${base} for certified`);
  }
});

test("CANCOAT PRO EVO is rejected above MATTE and above CANCOAT EVO, even for certified rank", () => {
  assert.ok(!l2("matte-evo", "certified").includes("cancoat-pro-evo"));
  assert.ok(!l3("matte-evo").includes("cancoat-pro-evo"));
  assert.ok(!l2("cancoat-evo", "certified").includes("cancoat-pro-evo")); // cancoat-evo standalone has empty layers
});

// ── GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1: second-layer CANCOAT PRO EVO is rank-aware ────
test("CANCOAT PRO EVO is absent from second-layer options for shop, detailer, and ppf_installer", () => {
  const NON_CERTIFIED: ShopRank[] = ["shop", "detailer", "ppf_installer"];
  for (const rank of NON_CERTIFIED) {
    for (const base of SIX_PRO_BASES) {
      assert.ok(!l2(base, rank).includes("cancoat-pro-evo"), `cancoat-pro-evo leaked to ${rank} over ${base}`);
    }
  }
});

test("CANCOAT PRO EVO is excluded from second-layer options when the shop rank is omitted (fail closed)", () => {
  for (const base of SIX_PRO_BASES) {
    assert.ok(!l2(base).includes("cancoat-pro-evo"), `cancoat-pro-evo leaked with no rank supplied over ${base}`);
  }
});

test("non-CANCOAT-PRO second-layer options are unaffected by shop rank", () => {
  for (const rank of RANKS) {
    assert.ok(l2("one-evo", rank).includes("cancoat-evo"), `cancoat-evo missing for one-evo at ${rank}`);
  }
  assert.deepEqual(l2("matte-evo", "certified"), ["matte-evo"]);
  assert.deepEqual(l2("syncro-evo", "shop"), ["mohs-evo"], "shop keeps the MOHS upper layer, loses only CANCOAT PRO");
});

test("INFINITE TOPCOAT is never a standalone/first-layer option", () => {
  for (const r of RANKS) {
    const ids = firstLayerOptions(r).map((o) => o.id);
    assert.ok(!ids.includes("infinite-topcoat-1"));
    assert.ok(!ids.includes("infinite-topcoat-2"));
  }
  // …and only appears above INFINITE BASE 1/2
  assert.ok(l2("infinite-base-1").includes("infinite-topcoat-1"));
  assert.ok(l3("infinite-base-2").includes("infinite-topcoat-2"));
});

test("MATTE exclusions — MATTE-only repeated layer, no CANCOAT of any kind", () => {
  assert.deepEqual(l2("matte-evo"), ["matte-evo"]);
  assert.deepEqual(l3("matte-evo"), []);
  assert.ok(!l2("matte-evo").includes("cancoat-evo"));
});

test("no unintended extra second/third-layer options (exact SYNCRO behaviour, certified rank)", () => {
  // SYNCRO keeps MOHS (existing) and gains CANCOAT PRO (one of the six bases) — nothing else.
  assert.deepEqual(l2("syncro-evo", "certified"), ["mohs-evo", "cancoat-pro-evo"]);
  assert.deepEqual(l3("syncro-evo"), []);
});

// ── GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1_R2: previewMapper threads the authoritative shopRank ──
test("preview mapper resolves the certified-only second-layer label only when ctx.shopRank is certified", () => {
  const d = draft((x) => {
    x.serviceSelection = { selectedCategories: ["coating"] };
    x.serviceConfiguration.coating = { ...x.serviceConfiguration.coating, layerCount: 2, layer1Id: "one-evo", layer2Id: "cancoat-pro-evo" };
  });
  const certifiedPreview = mapWizardDraftToPreview(d, { shopRank: "certified", priceSummary: { note: "" } });
  const certifiedLine = certifiedPreview.serviceLines.find((l) => l.name.includes("層コーティング"));
  assert.ok(certifiedLine?.detail?.includes("Q² CANCOAT PRO EVO"), "certified preview must show the CANCOAT PRO EVO label");

  const detailerPreview = mapWizardDraftToPreview(d, { shopRank: "detailer", priceSummary: { note: "" } });
  const detailerLine = detailerPreview.serviceLines.find((l) => l.name.includes("層コーティング"));
  assert.equal(detailerLine?.detail?.includes("Q² CANCOAT PRO EVO") ?? false, false,
    "non-certified preview must not show the certified-only label");
});

// ── Window identities ────────────────────────────────────────────────────────
const CANON_WINDOWS: [string, string][] = [
  ["front-windshield", "フロントガラス"],
  ["front-door-glass", "フロントドアガラス"],
  ["rear-door-glass", "リアドアガラス"],
  ["triangular-window", "三角窓"],
  ["quarter-glass", "クォーターガラス"],
  ["rear-glass", "リアガラス（リアハッチ）"],
  ["sunroof", "サンルーフ"],
];

test("exactly seven canonical window identities with the exact labels", () => {
  assert.equal(DEFAULT_WINDOW_AREAS.length, 7);
  assert.deepEqual(DEFAULT_WINDOW_AREAS.map((a) => [a.id, a.label]), CANON_WINDOWS);
});

test("triangular-window and quarter-glass are distinct", () => {
  const ids = DEFAULT_WINDOW_AREAS.map((a) => a.id);
  assert.ok(ids.includes("triangular-window"));
  assert.ok(ids.includes("quarter-glass"));
  assert.notEqual("triangular-window", "quarter-glass");
});

test("rejected legacy window aliases are not emitted", () => {
  const ids = new Set(DEFAULT_WINDOW_AREAS.map((a) => a.id));
  for (const legacy of ["front-side", "rear-side", "rear-window", "quarter", "full", "other"]) {
    assert.ok(!ids.has(legacy), `legacy window alias emitted: ${legacy}`);
  }
});

test("all seven canonical window areas survive state → preview conversion", () => {
  const d = draft((x) => {
    x.serviceSelection = { selectedCategories: ["window"] };
    x.serviceConfiguration.windowFilm = {
      ...x.serviceConfiguration.windowFilm,
      selectedAreaIds: CANON_WINDOWS.map(([id]) => id),
      filmTypeId: "standard",
      unitPriceInput: "30000",
    };
  });
  const preview = mapWizardDraftToPreview(d, { shopRank: "detailer", priceSummary: { note: "" } });
  const windowLine = preview.serviceLines.find((l) => l.detail?.includes("エリア"));
  assert.ok(windowLine, "no window service line produced");
  for (const [, label] of CANON_WINDOWS) {
    assert.ok(windowLine!.detail!.includes(label), `preview dropped window label: ${label}`);
  }
  // apply-plan path: the canonical window state is consumed and a manual line is produced.
  const bundle = buildWizardPricingInput(d);
  assert.ok(bundle.manualLines.length >= 1, "window state produced no manual line");
  assert.ok(!bundle.errors.some((e) => e.category === "window" && e.code === "UNKNOWN_PRICING_REFERENCE"));
});
