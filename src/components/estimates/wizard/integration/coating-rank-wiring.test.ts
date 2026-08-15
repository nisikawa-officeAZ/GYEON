// C2B3B2-R1 — caller-level proof that ONE authoritative shopRank threads identically through the
// three Wizard pricing paths (live pricing, save mapping, editor-patch) and fails closed on
// missing/invalid rank. Coating totals are tax-exclusive.
// Run: node --import tsx --test src/components/estimates/wizard/integration/coating-rank-wiring.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeWizardPricing } from "../pricing/useWizardPricing";
import { mapDraftToEstimateSaveRequest } from "../save/estimate-save-mapper";
import { buildEstimateEditorApplyPlan } from "./wizardDraftToEditorPatch";
import { newEstimateWizardDraft, type HydratedWizardDraft } from "./estimateToWizardDraft";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import type { ShopRank } from "../screens/step-types";

const EMPTY_CONFIG = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
} as const;

/** A NEW hydrated draft carrying a coating selection (no rank stored anywhere in the draft). */
function hydratedCoating(l1: string, l2: string | null, l3: string | null, size = "M"): HydratedWizardDraft {
  const h = newEstimateWizardDraft();
  h.draft.serviceSelection = { selectedCategories: ["coating"] };
  h.draft.vehicle = { ...h.draft.vehicle, bodySizeKey: size };
  h.draft.serviceConfiguration.coating.layer1Id = l1;
  h.draft.serviceConfiguration.coating.layer2Id = l2;
  h.draft.serviceConfiguration.coating.layer3Id = l3;
  return h;
}

// ── Per-path coating totals (tax-exclusive) ───────────────────────────────────
function livePricingTotal(h: HydratedWizardDraft, rank: ShopRank): number | null {
  return computeWizardPricing(h.draft, rank).subtotal;
}
function saveMapTotal(h: HydratedWizardDraft, rank: ShopRank): number | null {
  const pricingResult = computeWizardPricing(h.draft, rank);
  const req = mapDraftToEstimateSaveRequest({ draft: h.draft, pricingResult, shopRank: rank });
  return req.pricing.subtotal;
}
function editorPatchTotal(h: HydratedWizardDraft, rank: ShopRank): number {
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, EMPTY_CONFIG, rank);
  assert.equal(plan.status, "ready", "editor plan should be ready for a valid multi-layer selection");
  if (plan.status !== "ready") throw new Error("unreachable");
  return plan.items
    .filter((i: { category: string }) => i.category === "coating")
    .reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);
}

// ── 1. useWizardPricing caller proof ──────────────────────────────────────────
test("useWizardPricing: eligible rank + accepted 2-layer returns the complete total, no MULTI_LAYER_NOT_MAPPED", () => {
  const h = hydratedCoating("one-evo", "cancoat-evo", null);
  const r = computeWizardPricing(h.draft, "detailer");
  assert.equal(r.subtotal, 63000);
  assert.ok(!r.warnings.some((w) => w.code === "MULTI_LAYER_NOT_MAPPED"));
  assert.ok(!r.errors.some((e) => e.category === "coating"));
});
test("useWizardPricing: eligible rank + accepted 3-layer returns the complete total", () => {
  assert.equal(livePricingTotal(hydratedCoating("infinite-base-1", "infinite-topcoat-1", "infinite-topcoat-2"), "certified"), 220000);
});
test("useWizardPricing: missing rank fails closed for multi-layer (MULTI_LAYER_NOT_MAPPED present)", () => {
  const r = computeWizardPricing(hydratedCoating("one-evo", "cancoat-evo", null).draft); // no rank
  assert.ok(r.warnings.some((w) => w.code === "MULTI_LAYER_NOT_MAPPED"));
});
test("useWizardPricing: invalid rank fails closed (coating error, no complete multi-layer total)", () => {
  const r = computeWizardPricing(hydratedCoating("one-evo", "cancoat-pro-evo", null).draft, "detailer"); // pro is certified-only
  assert.ok(r.errors.some((e) => e.category === "coating"));
});

// ── 2. estimate-save-mapper caller proof ─────────────────────────────────────
test("save-mapper: accepted multi-layer serializes the complete coating amount using the supplied rank", () => {
  assert.equal(saveMapTotal(hydratedCoating("matte-evo", "matte-evo", null), "detailer"), 175000);
});
test("save-mapper: rank comes from the input param, not the draft (draft has no rank to override)", () => {
  const h = hydratedCoating("one-evo", "cancoat-pro-evo", null); // certified-only upper
  // certified → serializes; detailer/undefined → fails closed. Same draft, only the param differs.
  assert.equal(saveMapTotal(h, "certified"), 70000);
  assert.throws(() => saveMapTotal(h, "detailer"));
});
test("save-mapper: missing rank fails closed (no partial multi-layer total saved)", () => {
  const h = hydratedCoating("one-evo", "cancoat-evo", null);
  const pricingResult = computeWizardPricing(h.draft); // no rank
  assert.throws(() => mapDraftToEstimateSaveRequest({ draft: h.draft, pricingResult, shopRank: undefined }));
});

// ── 3. wizardDraftToEditorPatch caller proof ─────────────────────────────────
test("editor-patch: accepted multi-layer produces the complete coating amount using the supplied rank", () => {
  assert.equal(editorPatchTotal(hydratedCoating("one-evo", "cancoat-evo", "cancoat-evo"), "detailer"), 81000);
});
test("editor-patch: missing rank fails closed (plan blocked, not single-layer output)", () => {
  const plan = buildEstimateEditorApplyPlan(hydratedCoating("one-evo", "cancoat-evo", null), "create", DEFAULT_PRICING_CATALOG, EMPTY_CONFIG);
  assert.equal(plan.status, "blocked");
});
test("editor-patch: invalid rank fails closed (plan blocked)", () => {
  const plan = buildEstimateEditorApplyPlan(hydratedCoating("one-evo", "cancoat-pro-evo", null), "create", DEFAULT_PRICING_CATALOG, EMPTY_CONFIG, "detailer");
  assert.equal(plan.status, "blocked");
});

// ── 4. Cross-path parity ─────────────────────────────────────────────────────
const PARITY: [string, ShopRank, string, string | null, string | null, number][] = [
  ["2-layer ONE+CANCOAT EVO", "detailer", "one-evo", "cancoat-evo", null, 63000],
  ["3-layer INFINITE", "certified", "infinite-base-1", "infinite-topcoat-1", "infinite-topcoat-2", 220000],
  ["optional MOHS over SYNCRO", "detailer", "syncro-evo", "mohs-evo", null, 135000],
  ["rank-restricted certified ONE+CANCOAT PRO", "certified", "one-evo", "cancoat-pro-evo", null, 70000],
];
for (const [label, rank, l1, l2, l3, expected] of PARITY) {
  test(`parity: ${label} — live == save == editor == ${expected}`, () => {
    const h = hydratedCoating(l1, l2, l3);
    const live = livePricingTotal(h, rank);
    const save = saveMapTotal(h, rank);
    const patch = editorPatchTotal(h, rank);
    assert.equal(live, expected);
    assert.equal(save, expected);
    assert.equal(patch, expected);
    assert.equal(live, save);
    assert.equal(save, patch);
  });
}

// ── 5. Regression (standalone + SYNCRO base, tax-exclusive) ───────────────────
test("regression: standalone MATTE 150000 / CANCOAT PRO 70000 / SYNCRO base 110000 (tax-exclusive)", () => {
  // layer1Id is the CANONICAL wizard id; the adapter translates cancoat-pro-evo → cancoat-evo-pro.
  assert.equal(livePricingTotal(hydratedCoating("matte-evo", null, null), "detailer"), 150000);
  assert.equal(livePricingTotal(hydratedCoating("cancoat-pro-evo", null, null), "certified"), 70000);
  assert.equal(livePricingTotal(hydratedCoating("syncro-evo", null, null), "detailer"), 110000);
  // SYNCRO alone does not add the optional MOHS layer (standalone → no upper-layer warning).
  assert.ok(!computeWizardPricing(hydratedCoating("syncro-evo", null, null).draft, "detailer").warnings.some((w) => w.code === "MULTI_LAYER_NOT_MAPPED"));
});
