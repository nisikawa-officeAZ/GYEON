// EW-UI-5A1-B1 — Authoritative, config-driven pricing computation — PURE SERVER-SAFE CORE.
//
// Extracted from `useWizardPricingFromConfig.ts` so the SAME authoritative computation can run on the
// server (the future save/repricing path) as well as in the client hook. This module has NO
// "use client", NO React import/hook, NO browser API, NO fixture/default catalog, and NO persistence/
// DB/Supabase/route dependency — it is importable without crossing the client boundary.
//
// It runs the SAME input-building contract the apply planner uses (`buildWizardPricingInputFromConfig`),
// so displayed pricing and `buildEstimateEditorApplyPlan` can never diverge. Every number originates
// from the production engine — this module performs NO subtotal/discount/tax/rounding/quantity-
// extension/grand-total arithmetic.
//
// Authoritative route (and ONLY this route):
//   draft
//   → buildWizardPricingInputFromConfig(draft, pricingConfig, catalog, shopRank)   // authoritative labels
//   → calculateEstimate(bundle.services, bundle.discounts, bundle.taxRate, catalog) // catalog is MANDATORY
//   → mapProductionResultToWizard(result, bundle)                                   // stable catalog ids
//   → fail-closed aggregate-total normalization (null totals for unavailable/error)
//   → WizardPricingResult
//
// FORBIDDEN here (and enforced by the tests' source guards): DEFAULT_PRICING_CATALOG,
// buildWizardPricingInput (fixture), useWizardPricing, FIXTURE_PRESENTATION_METADATA,
// wizard-catalog-fixtures, wizard-manual-pricing (fixture), ScreensPreview,
// production/EstimateWizardContainer, raw-id label fallback, example/default/preview config.
//
// PURE + READ-ONLY: no React state/effects, no API/server-action/save/apply/DB/Supabase/PDF/OCR/route,
// no randomness, no clock, no identifier generation. Inputs are never mutated and never enter
// WizardStore or EstimateWizardDraftV22.

import { calculateEstimate } from "@/lib/pricing/canonical-pricing-engine";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import { buildWizardPricingInputFromConfig } from "./wizard-pricing-input-adapter-config";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";
import { mapProductionResultToWizard } from "./wizard-pricing-result-adapter";
import { WIZARD_PRICING_ERRORS, type WizardPricingResult } from "./wizard-pricing-types";

/**
 * Fresh fail-closed result. Built anew on every call so no imported constant is ever mutated and no
 * two callers share a reference. Every meaningful total is null — never zero — so failed/unavailable
 * pricing can never be mistaken for a real ¥0 total. `couponTotal` is 0 by the contract's own
 * definition (coupons are always deferred), not a disguised amount.
 */
function productionErrorResult(): WizardPricingResult {
  return {
    status: "error",
    completeness: "error",
    currency: "JPY",
    lines: [],
    unresolvedItems: [],
    subtotal: null,
    discountTotal: null,
    couponTotal: 0,
    taxableSubtotal: null,
    taxTotal: null,
    grandTotal: null,
    warnings: [],
    errors: [{
      code: WIZARD_PRICING_ERRORS.PRODUCTION_PRICING_ERROR,
      category: null,
      sourceId: null,
      message: "価格計算に失敗しました。",
    }],
    couponState: { status: "none" },
    discountIntent: { mode: "none" },
  };
}

/**
 * Fail-closed aggregate-total normalization (pure). Unavailable or failed pricing must NEVER surface
 * as a genuine ¥0 estimate, so every aggregate total is nulled when `completeness` is `"unavailable"`
 * or `"error"`. `"partial"` keeps the engine's priced-subset totals (a later UI candidate labels them
 * provisional); `"complete"` keeps every engine total unchanged.
 *
 * This performs NO arithmetic and does NOT redefine completeness — it only replaces already-computed
 * aggregate numbers with null. `couponTotal` stays 0 (contractually always 0 / deferred, not a
 * disguised amount), and every diagnostic (`status`, `lines`, `unresolvedItems`, `warnings`, `errors`,
 * `couponState`, `discountIntent`) is preserved. Returns a fresh object; the input is never mutated.
 */
function normalizeAggregateTotals(result: WizardPricingResult): WizardPricingResult {
  if (result.completeness !== "unavailable" && result.completeness !== "error") return result;
  return {
    ...result,
    subtotal: null,
    discountTotal: null,
    taxableSubtotal: null,
    taxTotal: null,
    grandTotal: null,
  };
}

/**
 * Compute the read-only production pricing for the canonical draft, using ONLY the authoritative
 * config-driven route. All four inputs are required — there is no default catalog, no fixture
 * fallback, no empty-config fallback, and no inferred rank.
 *
 * The complete build → calculate → map route is wrapped so no exception can leak: any throw fails
 * closed to a `PRODUCTION_PRICING_ERROR` result with null totals and no operator-visible internals.
 */
export function computeWizardPricingFromConfig(
  draft: EstimateWizardDraftV22,
  pricingConfig: ProductionPricingConfiguration,
  catalog: PricingCatalog,
  shopRank: ShopRank,
): WizardPricingResult {
  try {
    const bundle = buildWizardPricingInputFromConfig(draft, pricingConfig, catalog, shopRank);
    const result = calculateEstimate(bundle.services, bundle.discounts, bundle.taxRate, catalog);
    const mapped = mapProductionResultToWizard(result, bundle);

    // A selection exists but resolved to no priceable service, and nothing more specific was raised:
    // surface NO_SERVICE_SELECTED. Build a fresh result — never mutate the bundle or `mapped` in place.
    const refined =
      bundle.hasSelection && bundle.services.length === 0 && mapped.errors.length === 0
        ? {
            ...mapped,
            errors: [
              ...mapped.errors,
              {
                code: WIZARD_PRICING_ERRORS.NO_SERVICE_SELECTED,
                category: null,
                sourceId: null,
                message: "計算可能なサービスがありません。",
              },
            ],
          }
        : mapped;

    // Fail-closed: null the aggregate totals for unavailable/error completeness so unresolved or
    // failed pricing never appears as a genuine ¥0 estimate. Partial/complete totals are untouched.
    return normalizeAggregateTotals(refined);
  } catch {
    // No stack trace or internal exception text is exposed — only an operator-safe error.
    return productionErrorResult();
  }
}
