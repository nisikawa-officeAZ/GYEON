// EW-UI-5A1-B1 — Server-safe pricing core + stable catalog line-identity tests.
//
// Proves: raw pricing-engine coating lines carry the correct base/topcoat2/topcoat3 catalog ids; the
// mapped Wizard catalog lines carry the SAME ids; all three are distinct; a display-label change does
// not change identity; manual lines have null pricingReferenceId; no label/index/order fallback; the
// pure core has no client boundary; the hook delegates to the core; totals + fail-closed behavior are
// unchanged.
//
// Run: node --import tsx --test src/components/estimates/wizard/pricing/compute-wizard-pricing-from-config.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { computeWizardPricingFromConfig } from "./compute-wizard-pricing-from-config";
import {
  calculateEstimate, DEFAULT_PRICING_CATALOG, makePricingCatalog,
  type ServiceInput, type DiscountInput,
} from "@/lib/pricing/canonical-pricing-engine";
import { mapProductionResultToWizard } from "./wizard-pricing-result-adapter";
import type { ConfigPricingInputBundle } from "./wizard-pricing-input-adapter-config";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";

const RANK: ShopRank = "detailer";
const NO_DISCOUNT: DiscountInput = { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 };

// A 3-layer coating input using distinct authoritative catalog ids (all present in DEFAULT topcoatBase).
const COATING: ServiceInput = {
  type: "coating", coatingId: "one-evo", sizeKey: "M",
  topcoat2: "cancoat-evo", topcoat3: "cancoat-evo-pro", optionIds: [],
};

function bundleFor(services: ServiceInput[], manualLines: ConfigPricingInputBundle["manualLines"] = []): ConfigPricingInputBundle {
  return {
    services, manualLines, catalogResolved: services.some((s) => s.type === "coating"),
    discounts: NO_DISCOUNT, taxRate: 10, warnings: [], errors: [],
    couponState: { status: "none" }, discountIntent: { mode: "none" }, hasSelection: true,
  };
}

// ── raw engine: coating lines carry base/topcoat2/topcoat3 catalog ids ────────────

test("raw pricing-engine coating lines carry the correct base/topcoat2/topcoat3 ids (never the label)", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const lines = result.services[0].lineItems;
  assert.equal(lines.length, 3, "base + 2 topcoats");
  assert.equal(lines[0].pricing_reference_id, "one-evo", "base → coatingId");
  assert.equal(lines[1].pricing_reference_id, "cancoat-evo", "second → topcoat2");
  assert.equal(lines[2].pricing_reference_id, "cancoat-evo-pro", "third → topcoat3");
  // never derived from the visible label
  for (const l of lines) assert.notEqual(l.pricing_reference_id, l.item_name, "id is not the label");
});

test("the three layer ids are distinct", () => {
  const lines = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG).services[0].lineItems;
  const ids = lines.map((l) => l.pricing_reference_id);
  assert.equal(new Set(ids).size, 3, "all three ids distinct");
});

// ── mapped Wizard catalog lines carry the same ids ────────────────────────────────

test("mapped catalog lines carry the same pricingReferenceId as the engine lines", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const mapped = mapProductionResultToWizard(result, bundleFor([COATING]));
  const cat = mapped.lines.filter((l) => l.kind === "catalog");
  assert.deepEqual(cat.map((l) => l.pricingReferenceId), ["one-evo", "cancoat-evo", "cancoat-evo-pro"]);
  // never the label / sourceId
  for (const l of cat) {
    assert.notEqual(l.pricingReferenceId, l.label, "id is not the label");
    assert.notEqual(l.pricingReferenceId, l.sourceId, "id is not the sourceId");
  }
});

// ── label change does not change identity ─────────────────────────────────────────

test("changing a display label does NOT change pricingReferenceId", () => {
  const renamed = makePricingCatalog({
    coatings: DEFAULT_PRICING_CATALOG.coatings.map((c) => (c.id === "one-evo" ? { ...c, name: "RENAMED-LABEL" } : c)),
  });
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, renamed);
  const base = result.services[0].lineItems[0];
  assert.equal(base.item_name, "RENAMED-LABEL", "label changed");
  assert.equal(base.pricing_reference_id, "one-evo", "identity unchanged");
  const mapped = mapProductionResultToWizard(result, bundleFor([COATING]));
  const mBase = mapped.lines.find((l) => l.kind === "catalog");
  assert.equal(mBase?.label, "RENAMED-LABEL");
  assert.equal(mBase?.pricingReferenceId, "one-evo");
});

// ── fail-closed: a projected catalog line with an invalid id → WHOLE-RESULT error ──

test("a null / empty / whitespace catalog id fails the WHOLE result closed (never a null-id catalog line)", () => {
  const result = calculateEstimate([COATING], NO_DISCOUNT, 10, DEFAULT_PRICING_CATALOG);
  const svc = result.services[0];
  for (const badId of [null, "", "   "]) {
    const tampered = {
      ...result,
      services: [{ ...svc, lineItems: svc.lineItems.map((it, i) => (i === 0 ? { ...it, pricing_reference_id: badId } : it)) }],
    };
    const mapped = mapProductionResultToWizard(tampered, bundleFor([COATING]));
    assert.equal(mapped.status, "error", `${JSON.stringify(badId)}: status error`);
    assert.equal(mapped.completeness, "error", `${JSON.stringify(badId)}: completeness error`);
    assert.equal(mapped.lines.length, 0, `${JSON.stringify(badId)}: no lines emitted`);
    assert.equal(mapped.subtotal, null);
    assert.equal(mapped.discountTotal, null);
    assert.equal(mapped.taxableSubtotal, null);
    assert.equal(mapped.taxTotal, null);
    assert.equal(mapped.grandTotal, null);
    assert.equal(mapped.couponTotal, 0);
    assert.ok(mapped.errors.some((e) => e.code === "UNKNOWN_PRICING_REFERENCE"), `${JSON.stringify(badId)}: error present`);
    assert.ok(mapped.unresolvedItems.some((u) => u.code === "UNKNOWN_PRICING_REFERENCE"), `${JSON.stringify(badId)}: unresolved present`);
    // The type makes a null-id catalog line unconstructable; assert none exists at runtime either.
    assert.equal(mapped.lines.some((l) => l.kind === "catalog"), false, `${JSON.stringify(badId)}: no catalog line returned`);
  }
});

// ── manual lines have null identity (via the full config route) ───────────────────

const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [{ code: "mm1", label: "6ヶ月メンテナンス" }],
  washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};
function draftWith(categories: ServiceCategoryId[], cfg: Partial<WizardServiceConfigurationDraft> = {}): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  return { ...d, serviceSelection: { ...d.serviceSelection, selectedCategories: categories }, serviceConfiguration: { ...d.serviceConfiguration, ...cfg } };
}

test("manual Wizard lines have pricingReferenceId === null", () => {
  const draft = draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } });
  const r = computeWizardPricingFromConfig(draft, PC, makePricingCatalog(), RANK);
  const manual = r.lines.filter((l) => l.kind === "manual");
  assert.ok(manual.length > 0, "a manual maintenance line exists");
  for (const l of manual) assert.equal(l.pricingReferenceId, null, "manual line has null identity");
});

// ── totals + fail-closed behavior unchanged ───────────────────────────────────────

test("totals and fail-closed behavior are unchanged after extraction", () => {
  // complete → numeric totals
  const priced = computeWizardPricingFromConfig(
    draftWith(["maintenance"], { bodyMaintenance: { menuId: "mm1", unitPriceInput: "5000" } }),
    PC, makePricingCatalog(), RANK,
  );
  assert.equal(priced.completeness, "complete");
  assert.ok(typeof priced.grandTotal === "number" && priced.grandTotal > 0, "priced total numeric");
  // no selection → unavailable with null aggregates (fail-closed, never ¥0)
  const empty = computeWizardPricingFromConfig(draftWith([]), PC, makePricingCatalog(), RANK);
  assert.equal(empty.completeness, "unavailable");
  assert.equal(empty.subtotal, null);
  assert.equal(empty.grandTotal, null);
});

// ── core is server-safe; hook delegates to it ─────────────────────────────────────

const codeOf = (p: string): string => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CORE_SRC = "src/components/estimates/wizard/pricing/compute-wizard-pricing-from-config.ts";
const HOOK_SRC = "src/components/estimates/wizard/pricing/useWizardPricingFromConfig.ts";

test("the pure core crosses no client boundary and the hook delegates to it", () => {
  const core = codeOf(CORE_SRC);
  assert.equal(/use client/.test(core), false, "core has no \"use client\"");
  assert.equal(/from ["']react["']|useMemo|useState|useEffect|useRef/.test(core), false, "core imports no React/hook");
  assert.match(core, /export function computeWizardPricingFromConfig/, "core owns the pure compute");
  const hook = codeOf(HOOK_SRC);
  assert.match(hook, /^"use client";/, "hook declares the client boundary");
  assert.match(hook, /import \{ computeWizardPricingFromConfig \} from ["']\.\/compute-wizard-pricing-from-config["']/, "hook imports the core");
  assert.match(hook, /export \{ computeWizardPricingFromConfig \} from ["']\.\/compute-wizard-pricing-from-config["']/, "hook re-exports for compatibility");
  assert.match(hook, /useMemo\(/, "hook memoizes and delegates");
  // core function is genuinely importable + callable here (this file imported it, no client crash)
  assert.equal(typeof computeWizardPricingFromConfig, "function");
});
