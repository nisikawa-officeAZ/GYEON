"use client";

// Estimate Wizard Ver2.2 — Wizard → EstimateEditor preview bridge (Phase 8).
//
// Demonstrates the read-only integration path: Wizard state → adapter → EstimateEditor (rendered
// in "wizard-preview" mode). This is the ONLY place the wizard side touches EstimateEditor, and
// it does so downward (correct dependency direction). It passes empty customers/vehicles because
// EstimateEditor short-circuits to the read-only preview before using them, and mounts NO
// production action. Removing the adapter (passing wizardPreview = null) makes EstimateEditor
// render its normal production UI — i.e. the preview disappears.

import EstimateEditor from "@/components/estimates/EstimateEditor";
import { wizardToEstimatePreview, type WizardPreviewInput } from "./wizardToEstimateAdapter";

export function WizardEstimatePreviewBridge({ input }: { input: WizardPreviewInput }) {
  const preview = wizardToEstimatePreview(input);
  return <EstimateEditor mode="create" customers={[]} vehicles={[]} wizardPreview={preview} />;
}
