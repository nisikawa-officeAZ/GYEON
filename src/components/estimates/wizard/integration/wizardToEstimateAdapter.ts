// Estimate Wizard Ver2.2 — Canonical draft → EstimateEditor preview adapter (Phase 9).
//
// Single entry point the wizard side calls to obtain a read-only EstimateEditor preview payload
// from the canonical EstimateWizardDraftV22. Thin & deterministic: it delegates id→label
// translation to the mapper and stamps the neutral preview shape. READ-ONLY — no save, no
// production action, no pricing import, no side effects. Dependency direction: Wizard → Adapter →
// EstimateEditor; EstimateEditor never imports this. The adapter consumes ONLY the canonical draft
// plus a small non-draft PreviewContext (dealer rank + mock display values).

import { mapWizardDraftToPreview, type PreviewContext } from "./previewMapper";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { EstimateEditorPreviewData } from "./previewTypes";

export type { PreviewContext };

export function wizardToEstimatePreviewAdapter(
  draft: EstimateWizardDraftV22,
  context: PreviewContext,
): EstimateEditorPreviewData {
  return mapWizardDraftToPreview(draft, context);
}
