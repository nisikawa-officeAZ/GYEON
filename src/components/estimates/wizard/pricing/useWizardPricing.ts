"use client";

// Estimate Wizard Ver2.2 — Read-only pricing hook (Phase 10D).
//
// Runs the PRODUCTION pricing engine over the canonical draft and returns a WizardPricingResult.
// READ-ONLY and side-effect free: it calls only `calculateEstimate` (pure) with the DEFAULT catalog
// — no save/create/update, no API/DB/server-action, no Supabase, no PDF/LINE/OCR. It recalculates
// ONLY when pricing-relevant inputs change (services, service configuration, body size, discount
// intent, business/dealer flags) — NOT for notes, internal memo, address, phone, email, LINE, or
// the current step.

import { useMemo } from "react";
import { calculateEstimate, DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import { buildWizardPricingInput } from "./wizard-pricing-input-adapter";
import { mapProductionResultToWizard } from "./wizard-pricing-result-adapter";
import { WIZARD_PRICING_ERRORS, type WizardPricingResult } from "./wizard-pricing-types";

/** Pure computation: draft → production engine → WizardPricingResult. Exported for tests/preview.
 *  `shopRank` is the AUTHORITATIVE dealer rank (server-derived, passed from the trusted container
 *  boundary). It is optional only so the isolated preview harness may omit it; when omitted, upper
 *  coating layers are not priced and MULTI_LAYER_NOT_MAPPED is surfaced (never a silent partial).
 *  A mounted-runtime caller MUST pass it (EstimateWizardContainer does). */
export function computeWizardPricing(draft: EstimateWizardDraftV22, shopRank?: ShopRank): WizardPricingResult {
  const bundle = buildWizardPricingInput(draft, shopRank);
  try {
    const result = calculateEstimate(bundle.services, bundle.discounts, bundle.taxRate, DEFAULT_PRICING_CATALOG);
    const mapped = mapProductionResultToWizard(result, bundle);
    if (bundle.hasSelection && bundle.services.length === 0 && mapped.errors.length === 0) {
      mapped.errors.push({ code: WIZARD_PRICING_ERRORS.NO_SERVICE_SELECTED, category: null, sourceId: null, message: "計算可能なサービスがありません。" });
    }
    return mapped;
  } catch {
    return {
      status: "error", completeness: "error", currency: "JPY", lines: [], unresolvedItems: [],
      subtotal: null, discountTotal: null, couponTotal: 0, taxableSubtotal: null, taxTotal: null, grandTotal: null,
      warnings: bundle.warnings,
      errors: [...bundle.errors, { code: WIZARD_PRICING_ERRORS.PRODUCTION_PRICING_ERROR, category: null, sourceId: null, message: "価格計算に失敗しました。" }],
      couponState: bundle.couponState, discountIntent: bundle.discountIntent,
    };
  }
}

export function useWizardPricing(draft: EstimateWizardDraftV22, shopRank?: ShopRank): WizardPricingResult {
  const { serviceSelection, serviceConfiguration, discountAndCoupon } = draft;
  const bodySizeKey = draft.vehicle.bodySizeKey;
  const isBusiness = draft.customer.newCustomer.isBusiness;
  const tradeRate = draft.customer.newCustomer.tradeRate;
  // Recalculate only on pricing-relevant inputs (immutable per-section refs make this precise);
  // notes / memo / address / phone / email / LINE / step do not appear here, so they never trigger.
  // shopRank is authoritative and rank affects coating eligibility/upper-layer pricing, so it is a dep.
  return useMemo(
    () => computeWizardPricing(draft, shopRank),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceSelection, serviceConfiguration, bodySizeKey, discountAndCoupon, isBusiness, tradeRate, shopRank],
  );
}
