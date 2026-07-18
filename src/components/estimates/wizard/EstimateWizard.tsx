"use client";

// Unified Estimate Wizard — root (Phase 1).
//
// ONE component tree for PC / Tablet / Smartphone: one state model
// (useEstimateWizard), one responsive shell (WizardShell, Back/Next only — no swipe),
// rendering the active step. Business logic (pricing / OCR apply / save) is wired to
// the existing DealerOS modules in Phase 2 — this root does not embed any pricing math.
//
// NOTE: not yet mounted on the /estimates routes; the current EstimateEditor stays in
// place until Phase 2 parity is confirmed (cutover is a separate approved step).
//
// EW-UI-3C: the host REQUIRES the shared trusted selector inputs (shopRank + screenConfig), threaded
// to Step4Estimate ONLY.
//
// EW-UI-4A3: the host additionally REQUIRES the authoritative pricing inputs (catalog + pricingConfig)
// and now displays READ-ONLY pricing. It runs the SAME config-driven route the apply planner uses via
// useWizardPricingFromConfig, and projects the WizardPricingResult DIRECTLY into WizardShell totals —
// no arithmetic, no `?? 0`, no second calculation, null preserved. None of the four inputs (nor the
// pricing result) is ever stored in WizardStore, EstimateWizardDraftV22, or hook state; catalog and
// pricingConfig are consumed only by the pricing hook and never passed into any step. No save/apply.

import { useEstimateWizard } from "./useEstimateWizard";
import { WizardShell, type WizardTotals } from "./WizardShell";
import type { WizardHostRuntimeInputs } from "./contract/wizard-pricing-runtime-inputs";
import { useWizardPricingFromConfig } from "./pricing/useWizardPricingFromConfig";
import { Step1Customer } from "./steps/Step1Customer";
import { Step2Vehicle } from "./steps/Step2Vehicle";
import { Step3Category } from "./steps/Step3Category";
import { Step4Estimate } from "./steps/Step4Estimate";
import { Step5Discount } from "./steps/Step5Discount";
import { Step6Notes } from "./steps/Step6Notes";
import { Step7Review } from "./steps/Step7Review";

export interface EstimateWizardProps extends WizardHostRuntimeInputs {
  mode?: "create" | "edit";
}

export default function EstimateWizard({ mode = "create", shopRank, screenConfig, catalog, pricingConfig }: EstimateWizardProps) {
  const api = useEstimateWizard();
  const title = mode === "edit" ? "見積編集" : "新規見積";

  // Read-only authoritative pricing over the canonical draft (same config-driven route as apply).
  const pricing = useWizardPricingFromConfig(api.draft, pricingConfig, catalog, shopRank);
  // Project the result DIRECTLY into the shell — values pass through untouched (null stays null).
  const totals: WizardTotals = {
    subtotal: pricing.subtotal,
    discount: pricing.discountTotal,
    tax: pricing.taxTotal,
    total: pricing.grandTotal,
    state: pricing.completeness,
  };

  return (
    <WizardShell api={api} title={title} totals={totals}>
      {api.step === 1 && <Step1Customer api={api} />}
      {api.step === 2 && <Step2Vehicle api={api} />}
      {api.step === 3 && <Step3Category api={api} />}
      {api.step === 4 && <Step4Estimate api={api} shopRank={shopRank} screenConfig={screenConfig} />}
      {api.step === 5 && <Step5Discount api={api} />}
      {api.step === 6 && <Step6Notes api={api} />}
      {api.step === 7 && <Step7Review api={api} />}
    </WizardShell>
  );
}
