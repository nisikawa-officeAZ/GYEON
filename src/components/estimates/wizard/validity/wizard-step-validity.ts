// EST-WIZ-REQ-F1 — Pure navigation-validity contract for the Estimate Wizard.
//
// ONE module owns the seven-step validity matrix and the transition resolvers that
// next()/jumpTo() consume. Pure and deterministic: no React, no fetch, no storage,
// no side effects — every decision is a function of the canonical draft plus the
// server-supplied reference arrays, so the whole contract is provable under
// `node --test` without a DOM.
//
// ── WHY THE STEP-2 DISCRIMINATOR MIRRORS THE SAVE MAPPER ────────────────────
// The save mapper decides the vehicle persistence mode from EXACTLY
// (vehicle.sourceMode === "existing" && vehicle.vehicleId) — see
// save/estimate-save-mapper-from-config.ts. Navigation reads the SAME two fields
// and applies the effectiveness oracle on the existing branch only. Reading the
// same fields is what makes a navigation/save disagreement unrepresentable: any
// draft the mapper would persist as an EXISTING vehicle is exactly the draft
// navigation refuses unless the id still resolves under the effective owner, and
// any draft the mapper would persist as NEW is gated on the required model text.
// effectiveExistingVehicle is the validity ORACLE, never the discriminator.

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
import {
  effectiveExistingCustomer,
  effectiveExistingVehicle,
} from "../steps/existing-entity-selection";
import { WIZARD_STEPS, type StepId } from "../wizard-types";

export interface WizardNavigationReferences {
  readonly customers: readonly WizardExistingCustomerReference[];
  readonly vehicles: readonly WizardExistingVehicleReference[];
}

/** Fail-closed default: with no references an existing selection can never be
 *  effective, so navigation BLOCKS rather than trusting an unverifiable id. */
export const EMPTY_NAVIGATION_REFERENCES: WizardNavigationReferences = {
  customers: [],
  vehicles: [],
};

export interface WizardStepValidityInputs extends WizardNavigationReferences {
  readonly draft: EstimateWizardDraftV22;
}

const MIN_STEP: StepId = 1;
const MAX_STEP = WIZARD_STEPS.length as StepId;

function clampToStep(n: number): StepId {
  if (!Number.isFinite(n) || n < MIN_STEP) return MIN_STEP;
  if (n > MAX_STEP) return MAX_STEP;
  return Math.trunc(n) as StepId;
}

/** The vehicle persistence mode the save mapper would choose — same fields, same TRUTHY
 *  test (estimate-save-mapper-from-config.ts: `sourceMode === "existing" && v.vehicleId`).
 *  An EMPTY-STRING vehicleId therefore falls to the new-vehicle branch here exactly as it
 *  does in the mapper — a `!== null` check would split the two on that input. */
export function willSaveExistingVehicle(draft: EstimateWizardDraftV22): boolean {
  return draft.vehicle.sourceMode === "existing" && !!draft.vehicle.vehicleId;
}

export function step1Valid(i: WizardStepValidityInputs): boolean {
  const c = i.draft.customer;
  if (c.registrationMethod === "search") {
    // A stale, absent or ambiguous id is NOT a selection — stale newCustomer.name
    // text must never stand in for one.
    return effectiveExistingCustomer(i.customers, c.registrationMethod, c.customerId) !== null;
  }
  // "new" and "ocr" both produce a new-customer draft; the name is the only requirement.
  return c.newCustomer.name.trim().length > 0;
}

export function step2Valid(i: WizardStepValidityInputs): boolean {
  if (willSaveExistingVehicle(i.draft)) {
    // Existing branch: the id must still resolve uniquely UNDER THE EFFECTIVE OWNER.
    // Stale newVehicle.model text can never satisfy this branch.
    const owner = effectiveExistingCustomer(
      i.customers,
      i.draft.customer.registrationMethod,
      i.draft.customer.customerId,
    );
    return effectiveExistingVehicle(
      i.vehicles,
      owner === null ? null : owner.id,
      i.draft.vehicle.vehicleId,
    ) !== null;
  }
  // New branch: 車名 is required for navigation. OCR may prefill it from 車名 when the
  // certificate carries one, but this check does not distinguish an OCR-prefilled value
  // from a hand-typed one — maker/plate alone (without a model, OCR-applied or typed)
  // remain insufficient.
  return i.draft.vehicle.newVehicle.model.trim().length > 0;
}

export function stepIsValid(step: StepId, i: WizardStepValidityInputs): boolean {
  switch (step) {
    case 1: return step1Valid(i);
    case 2: return step2Valid(i);
    // Step 3 mirrors the save boundary's SERVICE_REQUIRED — no new business rule.
    case 3: return i.draft.serviceSelection.selectedCategories.length > 0;
    // Steps 4–6 stay navigation-valid without invented requirements. Step 7 is a
    // terminal review surface: ENTRY gating comes from the preceding steps via
    // maxEnterableStep, never from a validity of its own.
    default: return true;
  }
}

/** The lowest invalid step, or null when all seven are valid. */
export function firstUnmetStep(i: WizardStepValidityInputs): StepId | null {
  for (let s: number = MIN_STEP; s <= MAX_STEP; s++) {
    if (!stepIsValid(s as StepId, i)) return s as StepId;
  }
  return null;
}

/**
 * The highest step the operator may ENTER: a forward target is enterable only when
 * every PRECEDING step is valid, so the operator may stand ON the first unmet step
 * (its predecessors are all valid) but never beyond it.
 */
export function maxEnterableStep(i: WizardStepValidityInputs): StepId {
  const unmet = firstUnmetStep(i);
  return unmet === null ? MAX_STEP : unmet;
}

/**
 * Resolve a jump. Backward (or same-step) is always allowed; a blocked forward
 * target leaves the current step UNCHANGED — never a partial advance to the
 * nearest allowed step, which would move the operator somewhere they did not
 * ask to go.
 */
export function resolveJump(current: StepId, target: number, i: WizardStepValidityInputs): StepId {
  const t = clampToStep(target);
  if (t <= current) return t;
  return t <= maxEnterableStep(i) ? t : current;
}

/** Resolve Next: fail closed on the current step (and on every earlier one). */
export function resolveNext(current: StepId, i: WizardStepValidityInputs): StepId {
  return resolveJump(current, current + 1, i);
}

/**
 * Whether Next would actually move: resolveNext(current) !== current. This is the
 * SINGLE authority the Next button pairs with — deliberately NOT current-step
 * validity alone, so an EARLIER prerequisite invalidated while the operator stands
 * on a later step blocks the button exactly as the resolver blocks the move.
 */
export function canAdvanceFrom(current: StepId, i: WizardStepValidityInputs): boolean {
  return resolveNext(current, i) !== current;
}

/**
 * Operator-facing reason (Japanese, matching the existing save-boundary wording)
 * for a blocked Next. Null when Next can advance and on the terminal step 7. When
 * blocked, the reason names the FIRST unmet prerequisite — which may be an earlier
 * step than the one the operator is standing on.
 */
export function blockedReasonJa(current: StepId, i: WizardStepValidityInputs): string | null {
  if (current >= MAX_STEP) return null;
  if (canAdvanceFrom(current, i)) return null;
  const unmet = firstUnmetStep(i);
  if (unmet === null) return null; // defensive: unreachable while canAdvanceFrom is false below step 7
  switch (unmet) {
    case 1:
      return i.draft.customer.registrationMethod === "search"
        ? "お客様が選択されていません。"
        : "お客様名が未入力です。";
    case 2:
      return willSaveExistingVehicle(i.draft)
        ? "車両が選択されていません。"
        : "車名が未入力です。";
    case 3:
      return "サービスが1件も選択されていません。";
    default:
      return null; // steps 4–7 carry no own requirement and can never be the first unmet step
  }
}

/** A restored later step is normalized to its first unmet prerequisite. */
export function normalizeRestoredStep(restored: number, i: WizardStepValidityInputs): StepId {
  const t = clampToStep(restored);
  const unmet = firstUnmetStep(i);
  return unmet === null ? t : (Math.min(t, unmet) as StepId);
}
