"use client";

// Estimate Wizard Ver2.2 — canonical draft → canonical read-only preview.
//
// The legacy EstimateEditor is deliberately not part of this path. Keeping the preview inside the
// Ver2.2 tree prevents an old editor implementation from becoming reachable again through a
// seemingly harmless preview button.

import { wizardToEstimatePreviewAdapter, type PreviewContext } from "./wizardToEstimateAdapter";
import { WizardPreviewPanel } from "./WizardPreviewPanel";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";

export function WizardEstimatePreviewBridge({
  draft,
  context,
}: {
  draft: EstimateWizardDraftV22;
  context: PreviewContext;
}) {
  const preview = wizardToEstimatePreviewAdapter(draft, context);
  return <WizardPreviewPanel data={preview} />;
}
