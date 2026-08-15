"use client";

// Unified Estimate Wizard — SINGLE canonical-draft state model (EW-UI-2A → EST-WIZ-REQ-F1).
//
// The hook stores EXACTLY ONE business-state object: EstimateWizardDraftV22. WizardStore is a
// read-only PROJECTION of that draft (never independently stored), and `step` is derived from
// `draft.metadata.currentStep`. Screens keep reading `store` and writing via `updateStore`, but
// every write flows through the validated, fail-closed canonical patch adapter. No pricing/OCR/save.
//
// EST-WIZ-REQ-F1 — navigation is FAIL-CLOSED: next() and jumpTo() resolve through the pure
// transition resolvers in validity/wizard-step-validity (never a bare step increment), so a
// forward move the validity contract blocks leaves metadata.currentStep unchanged even when a
// caller bypasses the disabled button. Backward navigation is always allowed, and a restored
// later step is normalized to its first unmet prerequisite before the first render. Navigation
// writes ONLY metadata.currentStep — it never mutates customer or vehicle identity.
//
// Explicitly NOT used: useState<WizardStore>, useReducer<WizardStore>, a second mutable WizardStore
// ref, JSON cloning, localStorage/sessionStorage, generated IDs, or pricing/save/OCR side effects.

import { useCallback, useMemo, useState } from "react";
import { WIZARD_STEPS, type StepId, type WizardStore } from "./wizard-types";
import type { EstimateWizardDraftV22 } from "./draft/wizard-draft-types";
import { setCurrentStep } from "./draft/wizard-draft-state";
import { projectStore, applyStorePatch, initialCanonicalDraft, type WizardStorePatch } from "./bridge/ew-ui1-controller";
import {
  stepIsValid, maxEnterableStep, resolveNext, resolveJump, normalizeRestoredStep,
  canAdvanceFrom, blockedReasonJa,
  EMPTY_NAVIGATION_REFERENCES,
  type WizardNavigationReferences, type WizardStepValidityInputs,
} from "./validity/wizard-step-validity";

const MIN_STEP = 1 as const;
const MAX_STEP = WIZARD_STEPS.length as StepId;

export interface EstimateWizardApi {
  step:        StepId;
  store:       WizardStore;                 // read-only projection of the canonical draft
  draft:       EstimateWizardDraftV22;       // the single authoritative business state (readonly to callers)
  updateStore: (patch: WizardStorePatch) => void;
  jumpTo:      (n: number) => void;
  next:        () => void;
  back:        () => void;
  isFirst:     boolean;
  isLast:      boolean;
  /** Whether next() would actually move (resolveNext !== current). Drives the Next
   *  disabled state — NOT current-step validity alone, so an invalidated EARLIER
   *  prerequisite blocks the button even while the operator stands on a later step. */
  canAdvance: boolean;
  /** Operator-facing reason for a blocked Next (null when advancable or on step 7). */
  blockedReasonJa: string | null;
  /** Highest step the operator may ENTER — forward stepper targets beyond it are blocked. */
  maxEnterableStep: StepId;
  completed:   Set<StepId>; // display-only checkmarks, derived from the SAME validity contract
}

function clampStep(n: number): StepId {
  if (!Number.isFinite(n) || n < MIN_STEP) return MIN_STEP;
  if (n > MAX_STEP) return MAX_STEP;
  return Math.trunc(n) as StepId;
}

export function useEstimateWizard(
  initial?: WizardStorePatch,
  // Fail-closed default: without references an existing selection is never effective,
  // so navigation blocks rather than trusting an unverifiable id.
  references: WizardNavigationReferences = EMPTY_NAVIGATION_REFERENCES,
): EstimateWizardApi {
  const { customers, vehicles } = references;

  // ONE state object — the canonical draft. Initial partial store folds through the SAME adapter,
  // and a restored later step is normalized to its first unmet prerequisite before first render.
  const [draft, setDraft] = useState<EstimateWizardDraftV22>(() => {
    const d = initialCanonicalDraft(initial);
    return setCurrentStep(d, normalizeRestoredStep(d.metadata.currentStep, { draft: d, customers, vehicles }));
  });

  const store = useMemo(() => projectStore(draft), [draft]);
  const step = clampStep(draft.metadata.currentStep);

  // updateStore validates synchronously and fails CLOSED before scheduling any invalid update.
  const updateStore = useCallback((patch: WizardStorePatch) => {
    const result = applyStorePatch(draft, patch);
    if (result.ok) setDraft(result.draft); // valid patch only → update the single canonical draft
    // invalid/unsupported patch → no state change (fail closed); the current UI never sends these.
  }, [draft]);

  // Navigation is backed by canonical metadata.currentStep and resolved through the pure
  // fail-closed transition resolvers. A blocked forward move returns the CURRENT step, so
  // setCurrentStep rewrites the same value and the canonical step never advances.
  const jumpTo = useCallback((n: number) => setDraft((d) =>
    setCurrentStep(d, resolveJump(clampStep(d.metadata.currentStep), n, { draft: d, customers, vehicles }))
  ), [customers, vehicles]);
  const next = useCallback(() => setDraft((d) =>
    setCurrentStep(d, resolveNext(clampStep(d.metadata.currentStep), { draft: d, customers, vehicles }))
  ), [customers, vehicles]);
  const back = useCallback(() => setDraft((d) => setCurrentStep(d, clampStep(d.metadata.currentStep - 1))), []);

  const validity = useMemo<WizardStepValidityInputs>(
    () => ({ draft, customers, vehicles }),
    [draft, customers, vehicles],
  );

  // Checkmarks derive from the SAME validity contract as navigation: a step is
  // checked only when it lies BEHIND the operator AND stepIsValid confirms it, so a
  // stale or ineffective selection can never show a green step, and neither the
  // current nor any future step is ever marked complete.
  const completed = useMemo(() => {
    const done = new Set<StepId>();
    for (const s of WIZARD_STEPS) {
      if (s.id < step && stepIsValid(s.id, validity)) done.add(s.id);
    }
    return done;
  }, [validity, step]);

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
    canAdvance: canAdvanceFrom(step, validity),
    blockedReasonJa: blockedReasonJa(step, validity),
    maxEnterableStep: maxEnterableStep(validity),
    completed,
  };
}
