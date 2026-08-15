// EW-UI-4A3 — Trusted PRICING runtime-input contract for the canonical Estimate Wizard host.
//
// A SEPARATE, type-only contract from WizardRuntimeInputs (shopRank + screenConfig, the Screen-4
// selector inputs). It adds the two authoritative pricing inputs the host needs to run the
// config-driven pricing route: the dealer's PricingCatalog and ProductionPricingConfiguration.
//
// These are trusted, server-derived inputs — NEVER business state. They must not live in WizardStore,
// EstimateWizardDraftV22, or useEstimateWizard's state. There is no default and no fixture fallback,
// and this module holds NO runtime logic (type-only imports, type-only exports). The existing
// WizardRuntimeInputs contract is neither widened nor modified — it is intersected.

import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";
import type { WizardRuntimeInputs } from "./wizard-runtime-inputs";

/**
 * The authoritative pricing inputs a canonical host receives as props. Both required — no default,
 * no fixture fallback. `catalog` is the dealer's real PricingCatalog; `pricingConfig` supplies the
 * authoritative manual labels. A caller that cannot supply real dealer pricing cannot mount the host.
 */
export interface WizardPricingRuntimeInputs {
  catalog: PricingCatalog;
  pricingConfig: ProductionPricingConfiguration;
}

/**
 * The complete canonical-host runtime inputs: the selector inputs (shopRank + screenConfig) AND the
 * pricing inputs (catalog + pricingConfig). All FOUR remain required; none is optional or defaulted.
 */
export type WizardHostRuntimeInputs = WizardRuntimeInputs & WizardPricingRuntimeInputs;
