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
// EW-UI-3C: the host now REQUIRES the shared trusted runtime inputs (shopRank + screenConfig). They
// are threaded to Step4Estimate ONLY — never stored in WizardStore, the canonical draft, or hook
// state (the hook stays business-state-only), and never passed to any other step. There is no
// default rank and no fixture screenConfig fallback: a caller that cannot supply real dealer inputs
// cannot mount the wizard.

import { useEstimateWizard } from "./useEstimateWizard";
import { WizardShell } from "./WizardShell";
import type { WizardRuntimeInputs } from "./contract/wizard-runtime-inputs";
import { Step1Customer } from "./steps/Step1Customer";
import { Step2Vehicle } from "./steps/Step2Vehicle";
import { Step3Category } from "./steps/Step3Category";
import { Step4Estimate } from "./steps/Step4Estimate";
import { Step5Discount } from "./steps/Step5Discount";
import { Step6Notes } from "./steps/Step6Notes";
import { Step7Review } from "./steps/Step7Review";

export interface EstimateWizardProps extends WizardRuntimeInputs {
  mode?: "create" | "edit";
}

export default function EstimateWizard({ mode = "create", shopRank, screenConfig }: EstimateWizardProps) {
  const api = useEstimateWizard();
  const title = mode === "edit" ? "見積編集" : "新規見積";

  return (
    <WizardShell api={api} title={title}>
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
