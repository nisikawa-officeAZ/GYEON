"use client";

// Estimate Wizard Ver2.2 — Canonical draft → EstimateEditor preview bridge (Phase 9).
//
// Demonstrates the read-only integration path: canonical EstimateWizardDraftV22 → adapter →
// EstimateEditor (rendered in "wizard-preview" mode). The ONLY place the wizard side touches
// EstimateEditor, and it does so downward (correct dependency direction). Empty customers/vehicles
// are passed because EstimateEditor short-circuits to the read-only preview before using them, and
// mounts NO production action. Passing wizardPreview = null (adapter removed) makes EstimateEditor
// render its normal production UI — the preview disappears.

import EstimateEditor from "@/components/estimates/EstimateEditor";
import { wizardToEstimatePreviewAdapter, type PreviewContext } from "./wizardToEstimateAdapter";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";

export function WizardEstimatePreviewBridge({
  draft,
  context,
}: {
  draft: EstimateWizardDraftV22;
  context: PreviewContext;
}) {
  const preview = wizardToEstimatePreviewAdapter(draft, context);
  return <EstimateEditor mode="create" customers={[]} vehicles={[]} wizardPreview={preview} />;
}
