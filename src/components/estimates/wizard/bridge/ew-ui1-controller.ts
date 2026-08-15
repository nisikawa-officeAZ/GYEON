// EW-UI-2A — Controller façade binding EW-UI-1 presentation to the SINGLE canonical
// EstimateWizardDraftV22. PURE: it holds no state (the hook owns the one draft). It exposes the
// read-only projection and the validated, fail-closed patch adapter as one surface, plus a helper
// to fold an initial Partial<WizardStore> through the SAME validated adapter.
//
// No pricing/OCR/save/route/PDF. No mutation of the input draft. No throwing for validation failures.

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { WizardStore } from "../wizard-types";
import { draftToEwUi1Store } from "./draft-to-ew-ui1";
import { applyEwUi1StorePatch, type EwUi1ApplyResult, type WizardStorePatch } from "./ew-ui1-to-draft";

export { draftToEwUi1Store } from "./draft-to-ew-ui1";
export {
  applyEwUi1StorePatch,
  type EwUi1ApplyResult,
  type EwUi1PatchError,
  type EwUi1PatchErrorCode,
  type WizardStorePatch,
} from "./ew-ui1-to-draft";

/** Project the canonical draft to the read-only WizardStore view. */
export function projectStore(draft: EstimateWizardDraftV22): WizardStore {
  return draftToEwUi1Store(draft);
}

/** Validate + apply a WizardStore patch onto the canonical draft (fail-closed structured result). */
export function applyStorePatch(draft: EstimateWizardDraftV22, patch: WizardStorePatch): EwUi1ApplyResult {
  return applyEwUi1StorePatch(draft, patch);
}

/**
 * Build the initial canonical draft, folding an optional initial store patch through the SAME
 * validated adapter (requirement 21). An invalid initial patch fails closed → the plain canonical
 * initial draft is returned (nothing is invented, no throw).
 */
export function initialCanonicalDraft(initial?: WizardStorePatch): EstimateWizardDraftV22 {
  const base = resetWizardDraft();
  if (!initial) return base;
  const r = applyEwUi1StorePatch(base, initial);
  return r.ok ? r.draft : base;
}
