"use client";

// EW-UI-4A1 — Authoritative, config-driven pricing computation (read-only) — CLIENT HOOK.
//
// The pure computation (`computeWizardPricingFromConfig` + its fail-closed helpers) lives in the
// server-safe core module `compute-wizard-pricing-from-config.ts` (no "use client", no React), so the
// SAME authoritative route runs on the server (future save/repricing) and in this client hook. This
// module is ONLY the memoized React hook plus a compatibility re-export of the pure core.
//
// PURE + READ-ONLY: no React state, no effects, no API/server-action/save/apply/DB/Supabase/PDF/OCR/
// route, no randomness, no clock, no identifier generation. Inputs are never mutated and never enter
// WizardStore or EstimateWizardDraftV22.

import { useMemo } from "react";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";
import type { WizardPricingResult } from "./wizard-pricing-types";
import { computeWizardPricingFromConfig } from "./compute-wizard-pricing-from-config";

// Compatibility re-export: existing importers keep importing `computeWizardPricingFromConfig` from here.
export { computeWizardPricingFromConfig } from "./compute-wizard-pricing-from-config";

/**
 * Memoized read-only hook wrapper. Recomputes ONLY on pricing-relevant inputs; notes, internal memo,
 * contact fields, and the current step never trigger recomputation. Holds no state and runs no effect.
 * Delegates entirely to the pure server-safe core.
 */
export function useWizardPricingFromConfig(
  draft: EstimateWizardDraftV22,
  pricingConfig: ProductionPricingConfiguration,
  catalog: PricingCatalog,
  shopRank: ShopRank,
): WizardPricingResult {
  const { serviceSelection, serviceConfiguration, discountAndCoupon } = draft;
  const bodySizeKey = draft.vehicle.bodySizeKey;
  const isBusiness = draft.customer.newCustomer.isBusiness;
  const tradeRate = draft.customer.newCustomer.tradeRate;
  return useMemo(
    () => computeWizardPricingFromConfig(draft, pricingConfig, catalog, shopRank),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceSelection, serviceConfiguration, bodySizeKey, discountAndCoupon, isBusiness, tradeRate, shopRank, catalog, pricingConfig],
  );
}
