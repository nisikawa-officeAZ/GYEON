"use client";

// Unified Estimate Wizard — SINGLE canonical-draft state model (EW-UI-2A).
//
// The hook stores EXACTLY ONE business-state object: EstimateWizardDraftV22. WizardStore is a
// read-only PROJECTION of that draft (never independently stored), and `step` is derived from
// `draft.metadata.currentStep`. Screens keep reading `store` and writing via `updateStore`, but
// every write flows through the validated, fail-closed canonical patch adapter. No pricing/OCR/save.
//
// Explicitly NOT used: useState<WizardStore>, useReducer<WizardStore>, a second mutable WizardStore
// ref, JSON cloning, localStorage/sessionStorage, generated IDs, or pricing/save/OCR side effects.

import { useCallback, useMemo, useState } from "react";
import { WIZARD_STEPS, type StepId, type WizardStore } from "./wizard-types";
import type { EstimateWizardDraftV22 } from "./draft/wizard-draft-types";
import { setCurrentStep } from "./draft/wizard-draft-state";
import { projectStore, applyStorePatch, initialCanonicalDraft } from "./bridge/ew-ui1-controller";

const MIN_STEP = 1 as const;
const MAX_STEP = WIZARD_STEPS.length as StepId;

export interface EstimateWizardApi {
  step:        StepId;
  store:       WizardStore;                 // read-only projection of the canonical draft
  draft:       EstimateWizardDraftV22;       // the single authoritative business state (readonly to callers)
  updateStore: (patch: Partial<WizardStore>) => void;
  jumpTo:      (n: number) => void;
  next:        () => void;
  back:        () => void;
  isFirst:     boolean;
  isLast:      boolean;
  completed:   Set<StepId>; // display-only (checkmarks); does NOT gate free-jump
}

function clampStep(n: number): StepId {
  if (!Number.isFinite(n) || n < MIN_STEP) return MIN_STEP;
  if (n > MAX_STEP) return MAX_STEP;
  return Math.trunc(n) as StepId;
}

export function useEstimateWizard(initial?: Partial<WizardStore>): EstimateWizardApi {
  // ONE state object — the canonical draft. Initial partial store folds through the SAME adapter.
  const [draft, setDraft] = useState<EstimateWizardDraftV22>(() => initialCanonicalDraft(initial));

  const store = useMemo(() => projectStore(draft), [draft]);
  const step = clampStep(draft.metadata.currentStep);

  // updateStore validates synchronously and fails CLOSED before scheduling any invalid update.
  const updateStore = useCallback((patch: Partial<WizardStore>) => {
    const result = applyStorePatch(draft, patch);
    if (result.ok) setDraft(result.draft); // valid patch only → update the single canonical draft
    // invalid/unsupported patch → no state change (fail closed); the current UI never sends these.
  }, [draft]);

  // Navigation is backed by canonical metadata.currentStep (no separate step state).
  const jumpTo = useCallback((n: number) => setDraft((d) => setCurrentStep(d, clampStep(n))), []);
  const next = useCallback(() => setDraft((d) => setCurrentStep(d, clampStep(d.metadata.currentStep + 1))), []);
  const back = useCallback(() => setDraft((d) => setCurrentStep(d, clampStep(d.metadata.currentStep - 1))), []);

  // Lightweight completion heuristic for stepper checkmarks (display only) — from the projection.
  const completed = useMemo(() => {
    const done = new Set<StepId>();
    if (store.customer.name.trim() || store.customer.existingId) done.add(1);
    if (store.vehicle.model.trim() || store.vehicle.existingId) done.add(2);
    if (store.categories.length > 0) done.add(3);
    if (store.notesCustomer.trim() || store.notesInternal.trim()) done.add(6);
    return done;
  }, [store]);

  return {
    step,
    store,
    draft,
    updateStore,
    jumpTo,
    next,
    back,
    isFirst: step === MIN_STEP,
    isLast: step === MAX_STEP,
    completed,
  };
}
