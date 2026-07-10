// Estimate Wizard Ver2.2 — Wizard → EstimateEditor adapter (Phase 8).
//
// Single entry point the wizard side calls to obtain a read-only EstimateEditor preview payload.
// Thin by design: it delegates the id→label translation to the mapper and stamps the neutral
// preview shape. READ-ONLY — it never saves, calls production actions, or writes anything. The
// dependency direction is Wizard → Adapter → EstimateEditor; EstimateEditor never imports this.

import { mapWizardToPreview, type WizardPreviewInput } from "./previewMapper";
import type { EstimateEditorPreviewData } from "./previewTypes";

export type { WizardPreviewInput };

export function wizardToEstimatePreview(input: WizardPreviewInput): EstimateEditorPreviewData {
  return mapWizardToPreview(input);
}
