"use client";

// Unified Estimate Wizard — SINGLE canonical-draft state model (EW-UI-2A → EST-WIZ-REQ-F1).
//
// The hook stores EXACTLY ONE business-state object: EstimateWizardDraftV22. WizardStore is a
// read-only PROJECTION of that draft (never independently stored), and `step` is derived from
// `draft.metadata.currentStep`. Screens keep reading `store` and writing via `updateStore`, but
// every write flows through the validated, fail-closed canonical patch adapter. No pricing/OCR/save.
//
// GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — Step-4 ↔ final-review partial PPF quantity sync lives
// HERE as pure reducers (no effect, no ref, no second state): a valid review edit writes through to
// the canonical part quantity; a later Step-4 change clears the stale review buffer.
// GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1) — the SAME pattern for the dedicated wheel /
// glass menu quantities (`quantitiesByMenu`, one section per kind): ONE canonical quantity per menu.
// GDA-OTHER-COATINGS-R1 (C4) — the SAME pattern, third kind `other_coating` → `services.otherCoating`
// (only a QUANTITY-BEARING row is ever annotated editable; a fixed-one row never reaches a sync).
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
import type { EstimateWizardDraftV22, WizardDedicatedMenuDraft, WizardReviewDraft } from "./draft/wizard-draft-types";
import type { WizardReviewDedicatedMenuKind } from "./pricing/wizard-pricing-types";
import { setCurrentStep, updateReview } from "./draft/wizard-draft-state";
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
  setServiceLineOrder: (lineIds: readonly string[]) => void;
  /** GDA-ESTIMATE-PR133 P2-2: updates ONLY the review field(s) the caller explicitly supplies. */
  setServiceLineAdjustment: (lineId: string, patch: ServiceLineAdjustmentPatch) => void;
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

/**
 * A final-review line edit. Each key is OPTIONAL and independent: a quantity edit carries only
 * `quantityInput`, a unit-price edit only `unitPriceInput`. An explicitly supplied empty string is a
 * legitimate in-progress value and is stored as-is.
 */
export type ServiceLineAdjustmentPatch = {
  readonly quantityInput?: string;
  readonly unitPriceInput?: string;
  /**
   * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — supplied ONLY by a partial PPF PART line's quantity
   * input (from the line's server-annotated policy). When present with `quantityInput`, a VALID edit
   * (plain positive safe integer within these bounds, on exactly the selected part's line id under
   * the current PPF type) is written through to the canonical Step-4 `quantitiesByPart` via the
   * validated store-patch adapter; the review buffer keeps the identical text. Invalid / out-of-bounds
   * / mismatched text updates ONLY the review buffer (visible, and it blocks save).
   */
  readonly ppfPartSync?: {
    readonly partCode: string;
    readonly minQuantity: number;
    readonly maxQuantity: number | null;
  };
  /**
   * GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1) — supplied ONLY by a DEDICATED wheel / glass
   * menu line's quantity input (from the line's server-annotated policy). When present with
   * `quantityInput`, a VALID edit (plain positive safe integer within these bounds, on exactly the
   * stable line id `manual:<kind>:<menuCode>` of a menu currently selected in that section) is
   * written through to the canonical Step-4 `quantitiesByMenu` of that ONE section via the validated
   * store-patch adapter; the review buffer keeps the identical text. Invalid / out-of-bounds /
   * mismatched text updates ONLY the review buffer (visible, and it blocks save). Never both syncs.
   * GDA-OTHER-COATINGS-R1 (C4): kind `other_coating` writes through to `services.otherCoating`.
   */
  readonly dedicatedMenuSync?: {
    readonly kind: WizardReviewDedicatedMenuKind;
    readonly menuCode: string;
    readonly minQuantity: number;
    readonly maxQuantity: number | null;
  };
};

/** B5c2 — stable dedicated wheel / glass menu review line id — drift-pinned by tests against `wizardPricingLineId`. */
export function dedicatedMenuReviewLineId(kind: WizardReviewDedicatedMenuKind, menuCode: string): string {
  return `manual:${kind}:${menuCode}`;
}

const DEDICATED_MENU_KINDS: readonly WizardReviewDedicatedMenuKind[] = ["wheel", "glass", "other_coating"];

/**
 * GDA-OTHER-COATINGS-R1 (C4) — the canonical Step-4 section key of each dedicated-menu kind. Wheel /
 * glass keep key = kind (B5b2); the `other_coating` category lives under `services.otherCoating`
 * (C1/C3). Explicit map — the key is never computed from the kind string.
 */
const DEDICATED_MENU_SECTION_KEYS = {
  wheel: "wheel",
  glass: "glass",
  other_coating: "otherCoating",
} as const satisfies Record<WizardReviewDedicatedMenuKind, "wheel" | "glass" | "otherCoating">;

/** Stable partial PPF PART review line id — drift-pinned by tests against `wizardPricingLineId`. */
export const PARTIAL_PPF_REVIEW_LINE_ID_PREFIX = "manual:ppf:ppf_r1_partial_" as const;
export function partialPpfReviewLineId(typeId: string, partCode: string): string {
  return `${PARTIAL_PPF_REVIEW_LINE_ID_PREFIX}${typeId}_${partCode}`;
}

/** Same rule as the pricing route's review quantity parser (plain positive safe integer) — drift-pinned. */
export function parseReviewQuantityText(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * PURE. Apply a `ServiceLineAdjustmentPatch` to the review draft, touching ONLY the record(s) whose
 * key the caller explicitly provided (GDA-ESTIMATE-PR133 P2-2). Editing the quantity therefore never
 * writes `unitPriceInputsByLine`, and editing the unit price never writes `quantityInputsByLine` — so
 * an untouched field keeps following the authoritative pricing result instead of being frozen at
 * the value displayed when the other field was edited. An empty patch returns the input unchanged.
 */
export function applyServiceLineAdjustmentPatch(
  review: WizardReviewDraft,
  lineId: string,
  patch: ServiceLineAdjustmentPatch,
): WizardReviewDraft {
  if (lineId.trim() === "") return review;
  const hasQuantity = patch.quantityInput !== undefined;
  const hasUnitPrice = patch.unitPriceInput !== undefined;
  if (!hasQuantity && !hasUnitPrice) return review;
  return {
    ...review,
    ...(hasQuantity
      ? { quantityInputsByLine: { ...review.quantityInputsByLine, [lineId]: patch.quantityInput as string } }
      : {}),
    ...(hasUnitPrice
      ? { unitPriceInputsByLine: { ...review.unitPriceInputsByLine, [lineId]: patch.unitPriceInput as string } }
      : {}),
    previewConfirmed: false,
  };
}

/**
 * PURE. Apply a final-review line edit to the WHOLE draft (GDA-ESTIMATE-QUANTITY-POLICY-R1 Stage B):
 * the review buffer update of `applyServiceLineAdjustmentPatch`, plus — for a partial PPF PART line
 * whose new text is a valid in-bounds quantity — the write-through of that quantity to the canonical
 * Step-4 `quantitiesByPart` through the SAME validated store-patch adapter Step 4 uses. Guards are
 * fail-closed: partial method, a selected PPF type, the exact part line id, a currently selected
 * part, well-formed bounds, and a parseable in-bounds integer. Any failed guard leaves the base
 * untouched (last valid value) while the buffer still shows the operator's text. Unit-price buffers
 * are never touched here.
 */
export function applyServiceLineAdjustment(
  draft: EstimateWizardDraftV22,
  lineId: string,
  patch: ServiceLineAdjustmentPatch,
): EstimateWizardDraftV22 {
  const review = applyServiceLineAdjustmentPatch(draft.review, lineId, patch);
  const next = review === draft.review ? draft : updateReview(draft, review);
  if (patch.quantityInput === undefined || review === draft.review) return next;
  // B5c2: a patch naming BOTH syncs is malformed — buffer only, no canonical write of either kind.
  if (patch.ppfPartSync !== undefined && patch.dedicatedMenuSync !== undefined) return next;
  if (patch.dedicatedMenuSync !== undefined) {
    return applyDedicatedMenuQuantitySync(next, lineId, patch.quantityInput, patch.dedicatedMenuSync);
  }
  const sync = patch.ppfPartSync;
  if (sync === undefined) return next;

  const ppf = next.serviceConfiguration.ppf;
  if (ppf.installationMethod !== "partial" || ppf.ppfTypeId === null) return next;
  if (lineId !== partialPpfReviewLineId(ppf.ppfTypeId, sync.partCode)) return next;
  if (!ppf.selectedPartIds.includes(sync.partCode)) return next;
  const { minQuantity, maxQuantity } = sync;
  if (!Number.isSafeInteger(minQuantity) || minQuantity < 1) return next;
  if (maxQuantity !== null && (!Number.isSafeInteger(maxQuantity) || maxQuantity < minQuantity)) return next;
  const quantity = parseReviewQuantityText(patch.quantityInput);
  if (quantity === null || quantity < minQuantity || (maxQuantity !== null && quantity > maxQuantity)) return next;
  if (ppf.quantitiesByPart[sync.partCode] === quantity) return next;

  const result = applyStorePatch(next, {
    services: { ppf: { quantitiesByPart: { ...ppf.quantitiesByPart, [sync.partCode]: quantity } } },
  });
  return result.ok ? result.draft : next;
}

/**
 * PURE (B5c2, plan §24.1). Write a VALID dedicated wheel / glass review quantity through to the
 * canonical Step-4 `quantitiesByMenu` of exactly ONE section, through the SAME validated store-patch
 * adapter Step 4 uses. Guards are fail-closed and every failed guard returns `next` untouched (the
 * last valid canonical value survives; the buffer still shows the operator's text):
 *   • a known section kind whose draft section EXISTS (legacy drafts without it never gain one here);
 *   • the exact stable line id `manual:<kind>:<menuCode>` of the hinted kind + code (never a label);
 *   • the menu is CURRENTLY selected in that section (a deselected / foreign code never writes);
 *   • well-formed bounds and a plain positive safe integer within them;
 *   • an identity write (same canonical value) is a no-op.
 * Never touches unit-price buffers, the other section, or any other menu's quantity.
 */
function applyDedicatedMenuQuantitySync(
  next: EstimateWizardDraftV22,
  lineId: string,
  quantityInput: string,
  sync: NonNullable<ServiceLineAdjustmentPatch["dedicatedMenuSync"]>,
): EstimateWizardDraftV22 {
  if (!DEDICATED_MENU_KINDS.includes(sync.kind)) return next;
  if (typeof sync.menuCode !== "string" || sync.menuCode.trim() === "") return next;
  const section: WizardDedicatedMenuDraft | undefined = next.serviceConfiguration[DEDICATED_MENU_SECTION_KEYS[sync.kind]];
  if (section === undefined) return next;
  if (lineId !== dedicatedMenuReviewLineId(sync.kind, sync.menuCode)) return next;
  if (!section.selectedMenuIds.includes(sync.menuCode)) return next;
  const { minQuantity, maxQuantity } = sync;
  if (!Number.isSafeInteger(minQuantity) || minQuantity < 1) return next;
  if (maxQuantity !== null && (!Number.isSafeInteger(maxQuantity) || maxQuantity < minQuantity)) return next;
  const quantity = parseReviewQuantityText(quantityInput);
  if (quantity === null || quantity < minQuantity || (maxQuantity !== null && quantity > maxQuantity)) return next;
  if (section.quantitiesByMenu[sync.menuCode] === quantity) return next;

  const sectionPatch: Partial<WizardDedicatedMenuDraft> = {
    quantitiesByMenu: { ...section.quantitiesByMenu, [sync.menuCode]: quantity },
  };
  // Each patch names exactly ITS OWN section key (B5b2 / C3 contract) — never two, never a computed key.
  const result = applyStorePatch(next, sync.kind === "wheel"
    ? { services: { wheel: sectionPatch } }
    : sync.kind === "glass"
      ? { services: { glass: sectionPatch } }
      : { services: { otherCoating: sectionPatch } });
  return result.ok ? result.draft : next;
}

/**
 * PURE (B5c2). After a validated store patch, drop the dedicated wheel / glass review quantity
 * buffers the patch made stale: a changed Step-4 canonical quantity clears ONLY that menu's buffer
 * (the review then follows the new canonical quantity); a menu DESELECTED at Step 4 clears its
 * buffer so a later reselect never resurrects stale review text over the canonical value; a section
 * that disappears clears every buffer of that kind. Never writes a value INTO a buffer, never touches
 * unit-price buffers or the partial-PPF / store-option buffers, and returns `next` itself when
 * nothing is stale. Selecting a menu or editing its unit price alone changes no buffer.
 */
export function reconcileDedicatedMenuReviewOverrides(
  prev: EstimateWizardDraftV22,
  next: EstimateWizardDraftV22,
): EstimateWizardDraftV22 {
  const buffers = next.review.quantityInputsByLine;
  const stale = new Set<string>();
  for (const kind of DEDICATED_MENU_KINDS) {
    const before = prev.serviceConfiguration[DEDICATED_MENU_SECTION_KEYS[kind]];
    const after = next.serviceConfiguration[DEDICATED_MENU_SECTION_KEYS[kind]];
    if (before === after) continue;
    if (after === undefined) {
      const prefix = dedicatedMenuReviewLineId(kind, "");
      for (const id of Object.keys(buffers)) if (id.startsWith(prefix)) stale.add(id);
      continue;
    }
    const beforeSelected = before?.selectedMenuIds ?? [];
    const beforeQuantities = before?.quantitiesByMenu ?? {};
    const codes = new Set([
      ...beforeSelected, ...after.selectedMenuIds,
      ...Object.keys(beforeQuantities), ...Object.keys(after.quantitiesByMenu),
    ]);
    for (const code of codes) {
      const deselected = beforeSelected.includes(code) && !after.selectedMenuIds.includes(code);
      const changed = beforeQuantities[code] !== after.quantitiesByMenu[code];
      if (!deselected && !changed) continue;
      const id = dedicatedMenuReviewLineId(kind, code);
      if (Object.prototype.hasOwnProperty.call(buffers, id)) stale.add(id);
    }
  }
  if (stale.size === 0) return next;
  const quantityInputsByLine = Object.fromEntries(Object.entries(buffers).filter(([id]) => !stale.has(id)));
  return updateReview(next, { quantityInputsByLine, previewConfirmed: false });
}

/**
 * PURE. After a validated store patch, drop the partial PPF PART review quantity buffers the patch
 * made stale (GDA-ESTIMATE-QUANTITY-POLICY-R1 Stage B): a changed Step-4 quantity clears ONLY that
 * part's buffer (the review then follows the new canonical quantity); a PPF type or installation-
 * method change clears EVERY partial-part buffer (those lines cease to exist and must not resurrect
 * a value on a later switch back). Never writes a value INTO a buffer, never touches unit-price
 * buffers, and returns `next` itself when nothing is stale. Part toggles alone change no buffer.
 */
export function reconcilePartialPpfReviewOverrides(
  prev: EstimateWizardDraftV22,
  next: EstimateWizardDraftV22,
): EstimateWizardDraftV22 {
  const before = prev.serviceConfiguration.ppf;
  const after = next.serviceConfiguration.ppf;
  const buffers = next.review.quantityInputsByLine;
  const stale = new Set<string>();
  if (before.ppfTypeId !== after.ppfTypeId || before.installationMethod !== after.installationMethod) {
    for (const id of Object.keys(buffers)) {
      if (id.startsWith(PARTIAL_PPF_REVIEW_LINE_ID_PREFIX)) stale.add(id);
    }
  } else if (after.ppfTypeId !== null && before.quantitiesByPart !== after.quantitiesByPart) {
    const parts = new Set([...Object.keys(before.quantitiesByPart), ...Object.keys(after.quantitiesByPart)]);
    for (const partCode of parts) {
      if (before.quantitiesByPart[partCode] === after.quantitiesByPart[partCode]) continue;
      const id = partialPpfReviewLineId(after.ppfTypeId, partCode);
      if (Object.prototype.hasOwnProperty.call(buffers, id)) stale.add(id);
    }
  }
  if (stale.size === 0) return next;
  const quantityInputsByLine = Object.fromEntries(Object.entries(buffers).filter(([id]) => !stale.has(id)));
  return updateReview(next, { quantityInputsByLine, previewConfirmed: false });
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
  initialDraft?: Readonly<EstimateWizardDraftV22>,
): EstimateWizardApi {
  const { customers, vehicles } = references;

  // ONE state object — the canonical draft. Initial partial store folds through the SAME adapter,
  // and a restored later step is normalized to its first unmet prerequisite before first render.
  const [draft, setDraft] = useState<EstimateWizardDraftV22>(() => {
    // A revision source has already crossed the server validator and is the exact
    // immutable snapshot of its predecessor. It takes precedence over query/prefill
    // patches; mixing both would silently overwrite history during hydration.
    const d = initialDraft === undefined
      ? initialCanonicalDraft(initial)
      : setCurrentStep(initialDraft, 1);
    return setCurrentStep(d, normalizeRestoredStep(d.metadata.currentStep, { draft: d, customers, vehicles }));
  });

  const store = useMemo(() => projectStore(draft), [draft]);
  const step = clampStep(draft.metadata.currentStep);

  // updateStore validates synchronously and fails CLOSED before scheduling any invalid update.
  const updateStore = useCallback((patch: WizardStorePatch) => {
    const result = applyStorePatch(draft, patch);
    // valid patch only → update the single canonical draft, then drop review buffers it made stale
    // (partial PPF parts — Stage B; dedicated wheel / glass menus — B5c2). Each reconciler only
    // removes ITS OWN stale buffers, so the composition is order-independent.
    if (result.ok) setDraft(reconcileDedicatedMenuReviewOverrides(draft, reconcilePartialPpfReviewOverrides(draft, result.draft)));
    // invalid/unsupported patch → no state change (fail closed); the current UI never sends these.
  }, [draft]);

  const setServiceLineOrder = useCallback((lineIds: readonly string[]) => {
    const unique = [...new Set(lineIds.filter((id): id is string => typeof id === "string" && id !== ""))];
    setDraft((d) => updateReview(d, { serviceLineOrder: unique, previewConfirmed: false }));
  }, []);

  const setServiceLineAdjustment = useCallback((lineId: string, patch: ServiceLineAdjustmentPatch) => {
    setDraft((d) => applyServiceLineAdjustment(d, lineId, patch));
  }, []);

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
    setServiceLineOrder,
    setServiceLineAdjustment,
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
