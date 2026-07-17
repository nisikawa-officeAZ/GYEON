"use client";

// Unified Estimate Wizard — single state model (Phase 1).
//
// One store object + one step index, mutated through one updateStore. This is the
// SINGLE source of truth shared by every breakpoint (PC/Tablet/Smartphone); screens
// read from `store` and write via `updateStore` — no per-screen local mirrors.
// No pricing/OCR/save logic here (Phase 2).

import { useCallback, useMemo, useState } from "react";
import {
  WIZARD_STEPS,
  initialWizardStore,
  type StepId,
  type WizardStore,
} from "./wizard-types";

const MIN_STEP = 1 as const;
const MAX_STEP = WIZARD_STEPS.length as StepId;

export interface EstimateWizardApi {
  step:        StepId;
  store:       WizardStore;
  updateStore: (patch: Partial<WizardStore>) => void;
  jumpTo:      (n: number) => void;
  next:        () => void;
  back:        () => void;
  isFirst:     boolean;
  isLast:      boolean;
  completed:   Set<StepId>; // display-only (checkmarks); does NOT gate free-jump
}

function clampStep(n: number): StepId {
  if (n < MIN_STEP) return MIN_STEP;
  if (n > MAX_STEP) return MAX_STEP;
  return n as StepId;
}

export function useEstimateWizard(initial?: Partial<WizardStore>): EstimateWizardApi {
  const [step, setStep] = useState<StepId>(1);
  const [store, setStore] = useState<WizardStore>(() => ({
    ...initialWizardStore(),
    ...(initial ?? {}),
  }));

  const updateStore = useCallback((patch: Partial<WizardStore>) => {
    setStore((s) => ({ ...s, ...patch }));
  }, []);

  const jumpTo = useCallback((n: number) => setStep(clampStep(n)), []);
  const next = useCallback(() => setStep((s) => clampStep(s + 1)), []);
  const back = useCallback(() => setStep((s) => clampStep(s - 1)), []);

  // Lightweight completion heuristic for stepper checkmarks (display only).
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
    updateStore,
    jumpTo,
    next,
    back,
    isFirst: step === MIN_STEP,
    isLast: step === MAX_STEP,
    completed,
  };
}
