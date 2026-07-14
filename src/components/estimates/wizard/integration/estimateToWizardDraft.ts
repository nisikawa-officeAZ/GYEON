// Estimate Wizard Ver2.2 — EstimateEditor → Wizard hydration adapter (Phase 8-B1E).
//
// PURE. Computes nothing, persists nothing, calls nothing. No React, no FormData, no Server Action,
// no Supabase, no pricing, no randomness, no clock, no identifier generation, no casts.
//
// ── THE OPAQUE CONSTRUCTION BOUNDARY ────────────────────────────────────────────
// `HydratedWizardDraft` is a MODULE-PRIVATE implementation class. It is exported only as a TYPE.
// The class itself is never exported, and it carries a `private` witness field.
//
// TypeScript compares types with `private` members NOMINALLY, not structurally. That defeats both
// forgery routes at once:
//
//   1. Object literal — missing the private witness ⇒ not assignable. Compile error.
//        const fake: HydratedWizardDraft = { draft, integration };            // ✗
//
//   2. Spread copy — a spread of a class instance produces a PLAIN OBJECT, which has no private
//      member and is therefore not assignable either. This is the route an unexported `unique
//      symbol` would NOT have closed, because the symbol key survives a spread.
//        const fake: HydratedWizardDraft = { ...valid, integration: { ...tampered } };  // ✗
//
// The only ways in are `estimateToWizardDraft()` and `newEstimateWizardDraft()`. Bypassing them now
// requires an unsafe assertion (`as unknown as`), which this project forbids outright.
//
// The witness is `declare private readonly … : void`, so it exists purely in the type system and
// emits NO runtime field. No cast is used anywhere in this file.
//
// ── SAVE PATH (Architect Ruling 1) ──────────────────────────────────────────────
// The canonical save owner is EstimateEditor's existing create/update submit path
// (EstimateEditor.tsx:511 startTransition → createEstimate / updateEstimate, "use server").
// `saveEstimateFromWizardAction` → RPC `save_estimate_from_wizard` remains
// SECONDARY SAVE PATH — NOT AUTHORIZED FOR WIZARD INTEGRATION.
// This module calls NEITHER, and builds no payload and no FormData.
//
// ── estimate_items IS NOT A SOURCE OF TRUTH (Architect Ruling 3) ────────────────
// Screen-4 selections are NEVER inferred from item_name, price, quantity, category, or any display
// text. No heuristic reconstruction exists here, by design.

import type { EstimateCategory } from "@/lib/estimates/estimate-types";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { EstimateWizardDraftV22, WizardServiceCategory } from "../draft/wizard-draft-types";
import { initialEstimateWizardDraftV22 } from "../draft/wizard-draft-state";
import {
  INTEGRATION_ISSUE_CODES,
  type EstimateHydrationInput,
  type EstimateWizardIntegrationState,
  type IntegrationIssue,
  type ReconstructionStatus,
} from "./estimateWizardIntegrationContract";

// ── Runtime immutability ─────────────────────────────────────────────────────────
/**
 * Deep-freeze the integration state — the safety-critical half of the draft.
 *
 * `readonly` is a TYPE-level guarantee only: `Object.assign` is typed as
 * `assign<T, U>(target: T, source: U): T & U`, so TypeScript raises NO error on
 * `Object.assign(validDraft.integration, { unresolvedItemIds: [] })`. That mutation was measured to
 * flip a correctly-blocked legacy estimate to `canPersist: true` (Phase 8-B1F). Freezing closes it:
 * modules run in strict mode, so writing to a frozen object throws `TypeError` instead of silently
 * succeeding.
 *
 * The arrays are frozen too, because `unresolvedItemIds.length = 0` needs no cast either.
 *
 * The `draft` is deliberately NOT frozen: it is Wizard-owned presentation state that the existing
 * immutable reducers replace wholesale, and `initialEstimateWizardDraftV22` is a shared module const
 * used elsewhere. Freezing it would reach outside this boundary. The blockers are what must be
 * immutable, and they are.
 */
function freezeIntegrationState(
  state: EstimateWizardIntegrationState,
): EstimateWizardIntegrationState {
  for (const issue of state.issues) Object.freeze(issue);
  Object.freeze(state.issues);
  Object.freeze(state.unresolvedItemIds);
  return Object.freeze(state);
}

// ── Module-private opaque implementation ─────────────────────────────────────────
/**
 * NOT EXPORTED. Two independent protections:
 *
 *   • NOMINAL TYPE — the `private` witness means TypeScript compares this class nominally, so
 *     neither an object literal nor a spread copy is assignable to it (both fail with TS2741).
 *   • FROZEN AT RUNTIME — the instance and its integration state are frozen in the constructor, so
 *     `Object.assign` against either throws `TypeError` rather than erasing the blockers.
 *
 * Fields are assigned explicitly rather than declared as constructor parameter properties: Node's
 * strip-only TypeScript mode rejects parameter properties
 * (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter property is not supported`), which
 * would make this module untestable under `node:test` without adding a transpiler. Explicit fields
 * are erasable, so the zero-dependency test path stays open.
 */
class HydratedWizardDraftImplementation {
  declare private readonly __hydratedWizardDraftWitness: void;

  readonly draft: EstimateWizardDraftV22;
  readonly integration: EstimateWizardIntegrationState;

  constructor(draft: EstimateWizardDraftV22, integration: EstimateWizardIntegrationState) {
    this.draft = draft;
    this.integration = freezeIntegrationState(integration);
    Object.freeze(this);
  }
}

/**
 * A Wizard draft together with the integration state that qualifies it.
 *
 * Exported as a TYPE ONLY. Values of this type can be produced solely by `estimateToWizardDraft()`
 * or `newEstimateWizardDraft()`. Read `.draft` and `.integration` freely — but you cannot
 * manufacture one, and you cannot spread one into a tampered copy.
 */
export type HydratedWizardDraft = HydratedWizardDraftImplementation;

// ── Category mapping ─────────────────────────────────────────────────────────────
/**
 * `EstimateCategory` (persisted, 9 values) → `ServiceCategoryId` (Screen 3, 7 values).
 * 'interior' and 'glass' exist ONLY in the persisted taxonomy and have no Screen-3 counterpart.
 * They map to `null` and are reported — never coerced into 'other'.
 */
const CATEGORY_TO_SCREEN3: Record<EstimateCategory, ServiceCategoryId | null> = {
  coating:     "coating",
  ppf:         "ppf",
  window:      "window",
  maintenance: "maintenance",
  carwash:     "carwash",
  roomclean:   "roomclean",
  other:       "other",
  interior:    null, // persisted-only taxonomy — no Screen-3 category
  glass:       null, // persisted-only taxonomy — no Screen-3 category
};

// ── New estimate ─────────────────────────────────────────────────────────────────
/**
 * A blank Wizard draft for a brand-new estimate. There is nothing to reconstruct, so the state is
 * `sourceKind: "new"` / `"not-applicable"` with no source id and no unresolved items — the only
 * combination other than a fully reconstructed estimate that the validator lets through.
 */
export function newEstimateWizardDraft(): HydratedWizardDraft {
  const integration: EstimateWizardIntegrationState = {
    sourceKind: "new",
    sourceEstimateId: null,
    reconstructionStatus: "not-applicable",
    unresolvedItemIds: [],
    issues: [],
  };
  return new HydratedWizardDraftImplementation(cloneWizardDraft(initialEstimateWizardDraftV22), integration);
}

// ── Explicit typed deep clone ────────────────────────────────────────────────────
/**
 * Produce a fully independent editable draft.
 *
 * A shallow `{ ...initialEstimateWizardDraftV22 }` copies only the top level: every nested object
 * and array — `notes`, `discountAndCoupon`, `serviceConfiguration`, `customer.newCustomer`, … —
 * would still be SHARED BY REFERENCE with that module const, which `ScreensPreview` also reads.
 * A single `blank.draft.notes.internalMemo = "x"` would then leak into every future blank draft.
 *
 * Written out field by field, on purpose:
 *   • `JSON.parse(JSON.stringify(…))` is forbidden (and would silently drop `undefined`/`Date`);
 *   • `structuredClone` is not proven across this repo's runtime targets;
 *   • a generic recursive clone would need `any` or an unsafe cast.
 *
 * The explicit form is verbose but exhaustively type-checked: adding a field to
 * `EstimateWizardDraftV22` without cloning it here is a compile error, not a latent aliasing bug.
 *
 * The result is intentionally NOT frozen — `draft` is Wizard-owned state that Screens 1–7 edit.
 * Only `integration` (the safety-critical provenance) is frozen.
 */
function cloneWizardDraft(source: EstimateWizardDraftV22): EstimateWizardDraftV22 {
  const cfg = source.serviceConfiguration;

  return {
    version: source.version,
    customer: {
      sourceMode: source.customer.sourceMode,
      customerId: source.customer.customerId,
      newCustomer: { ...source.customer.newCustomer },
    },
    vehicle: {
      sourceMode: source.vehicle.sourceMode,
      vehicleId: source.vehicle.vehicleId,
      newVehicle: { ...source.vehicle.newVehicle },
      bodySizeKey: source.vehicle.bodySizeKey,
    },
    serviceSelection: {
      selectedCategories: [...source.serviceSelection.selectedCategories],
    },
    serviceConfiguration: {
      coating: { ...cfg.coating },
      ppf: {
        installationMethod: cfg.ppf.installationMethod,
        selectedPartIds: [...cfg.ppf.selectedPartIds],
        quantitiesByPart: { ...cfg.ppf.quantitiesByPart },
        ppfTypeId: cfg.ppf.ppfTypeId,
        unitPriceInput: cfg.ppf.unitPriceInput,
        interiorRows: cfg.ppf.interiorRows.map((row) => ({ ...row })),
      },
      windowFilm: {
        selectedAreaIds: [...cfg.windowFilm.selectedAreaIds],
        filmTypeId: cfg.windowFilm.filmTypeId,
        unitPriceInput: cfg.windowFilm.unitPriceInput,
      },
      bodyMaintenance: { ...cfg.bodyMaintenance },
      carWash: { ...cfg.carWash },
      roomCleaning: {
        selectedMenuIds: [...cfg.roomCleaning.selectedMenuIds],
        unitPricesByMenu: { ...cfg.roomCleaning.unitPricesByMenu },
      },
      otherWork: {
        selectedPresetIds: [...cfg.otherWork.selectedPresetIds],
        unitPricesByItem: { ...cfg.otherWork.unitPricesByItem },
        quantitiesByItem: { ...cfg.otherWork.quantitiesByItem },
        customRows: cfg.otherWork.customRows.map((row) => ({ ...row })),
      },
      storeGlobalOptions: {
        selectedOptionIds: [...cfg.storeGlobalOptions.selectedOptionIds],
        unitPricesByOption: { ...cfg.storeGlobalOptions.unitPricesByOption },
        quantitiesByOption: { ...cfg.storeGlobalOptions.quantitiesByOption },
      },
    },
    discountAndCoupon: {
      mode: source.discountAndCoupon.mode,
      percentInput: source.discountAndCoupon.percentInput,
      amountInput: source.discountAndCoupon.amountInput,
      selectedCouponIds: [...source.discountAndCoupon.selectedCouponIds],
      adjustmentReason: source.discountAndCoupon.adjustmentReason,
    },
    notes: { ...source.notes },
    review: { ...source.review },
    metadata: { ...source.metadata },
  };
}

// ── Hydration ────────────────────────────────────────────────────────────────────
/**
 * Build one isolated Wizard draft from one persisted estimate.
 *
 * HYDRATED
 *   id                        → integration.sourceEstimateId (the row this draft belongs to)
 *   customer_id / vehicle_id  → existing-selection ids (sourceMode becomes "existing")
 *   vehicles.body_size        → bodySizeKey
 *   estimate_items[].category → Screen-3 selected categories (deduped, first-seen order)
 *   discount_amount           → Screen-5 amountInput (mode "amount")
 *   notes                     → customerNotes
 *   internal_memo             → internalMemo   (NEVER merged with customerNotes)
 *
 * NOT HYDRATED — AND WHY
 *   Screen-4 structured configuration cannot be rebuilt. `estimate_items` is a FLAT priced
 *   projection (item_name / quantity / unit_price); the selections that produced it — coating layer
 *   ids, PPF part ids and install method, film type, menu ids, option ids, custom rows — are not
 *   persisted anywhere in the current schema. Reconstructing them would mean guessing, which is
 *   silent data invention. So every persisted item is recorded in `unresolvedItemIds`,
 *   `reconstructionStatus` becomes `"none"`, and the validator BLOCKS apply and persist. Screen 3
 *   still shows which categories the estimate contains, so the operator sees the shape of the work.
 *
 *   Percent discount and coupon selection have NO persisted column. They stay at their initial
 *   values (`percentInput: ""`, `selectedCouponIds: []`) — nothing is invented, and nothing real is
 *   defaulted away, because no real value can exist in the row.
 *
 * Pure: `estimate` is never mutated; the draft is built by spread from the canonical initial draft.
 */
export function estimateToWizardDraft(estimate: EstimateHydrationInput): HydratedWizardDraft {
  const issues: IntegrationIssue[] = [];
  const unresolvedItemIds: string[] = [];

  const items = estimate.estimate_items ?? [];

  // An existing estimate MUST carry a usable id, or the draft can never be written back.
  const sourceEstimateId = estimate.id.trim() === "" ? null : estimate.id;
  if (sourceEstimateId === null) {
    issues.push({
      code:     INTEGRATION_ISSUE_CODES.INVALID_SOURCE_ESTIMATE_ID,
      field:    "integration.sourceEstimateId",
      severity: "blocking",
      message:  "元の見積を特定できないため、この内容は反映・保存できません。",
    });
  }

  // Screen 3 — categories present in the persisted rows, deduped, first-seen order preserved.
  const selectedCategories: WizardServiceCategory[] = [];
  for (const item of items) {
    const screen3 = CATEGORY_TO_SCREEN3[item.category] ?? null;
    if (screen3 === null) {
      issues.push({
        code:     INTEGRATION_ISSUE_CODES.UNMAPPED_ITEM_CATEGORY,
        field:    `estimate_items[${item.id}].category`,
        severity: "warning",
        message:  "この明細のカテゴリは見積ウィザードの作業カテゴリに存在しないため、ウィザードでは編集できません。",
      });
      continue;
    }
    if (!selectedCategories.includes(screen3)) selectedCategories.push(screen3);
  }

  // Screen 4 — NOT reconstructible from the flat persisted projection. Recorded, never guessed.
  for (const item of items) {
    unresolvedItemIds.push(item.id);
  }

  const reconstructionStatus: ReconstructionStatus =
    unresolvedItemIds.length === 0 ? "complete" : "none";

  if (unresolvedItemIds.length > 0) {
    issues.push({
      code:     INTEGRATION_ISSUE_CODES.SERVICE_CONFIGURATION_NOT_RECONSTRUCTED,
      field:    "serviceConfiguration",
      severity: "blocking",
      message:
        "既存の見積明細は保存済みの金額のみを保持しているため、ウィザードの施工内容として復元できません。" +
        "内容を編集する場合は施工内容を選び直してください。",
    });
  }

  // Screen 5 — the persisted document-level discount is a yen amount. Read as-is, never recalculated.
  const amountInput = estimate.discount_amount > 0 ? String(estimate.discount_amount) : "";
  if (estimate.discount_amount > 0) {
    issues.push({
      code:     INTEGRATION_ISSUE_CODES.DISCOUNT_AMOUNT_NOT_RECALCULATED,
      field:    "discount_amount",
      severity: "info",
      message:  "保存済みの値引き額を読み込みました。金額の再計算は既存の価格エンジンが行います。",
    });
  }

  // ── Draft body — DEEP-CLONED, never spread from the module const (Phase 8-B2C-S) ──
  //
  // DEFECT THIS FIXES. This used to be `const base = initialEstimateWizardDraftV22` followed by
  // `{ ...base, serviceConfiguration: base.serviceConfiguration, … }`. A top-level spread copies only
  // the top level, so `serviceConfiguration` (and `review`, and `customer.newCustomer`) stayed SHARED
  // BY REFERENCE with the module const. One `draft.serviceConfiguration.ppf.selectedPartIds.push(…)`
  // through a hydrated draft therefore corrupted `initialEstimateWizardDraftV22` itself — and with it
  // EVERY subsequent `newEstimateWizardDraft()`, for the whole life of the process. The create path
  // was already safe (it cloned); this path was not. Measured, not theorised.
  //
  // `cloneWizardDraft` is the same exhaustive, type-checked deep clone the new-estimate factory uses,
  // so both entry points now produce fully isolated drafts by construction.
  const base = cloneWizardDraft(initialEstimateWizardDraftV22);

  const draft: EstimateWizardDraftV22 = {
    ...base,
    customer: {
      ...base.customer,
      sourceMode: "existing",
      customerId: estimate.customer_id || null,
    },
    vehicle: {
      ...base.vehicle,
      sourceMode:  "existing",
      vehicleId:   estimate.vehicle_id || null,
      bodySizeKey: estimate.vehicles?.body_size ?? "",
    },
    serviceSelection: { selectedCategories },
    // Intentionally left at the initial (empty) SHAPE — see the doc comment above. It is now a
    // private clone, so "empty" cannot be mutated into something shared. This remains safe only
    // because `reconstructionStatus` and `unresolvedItemIds` travel INSIDE the opaque draft and the
    // validator blocks on them.
    serviceConfiguration: base.serviceConfiguration,
    discountAndCoupon: {
      ...base.discountAndCoupon,
      mode:              "amount", // persisted discount is a yen amount; percent has no column
      amountInput,
      percentInput:      "", // no persisted source — not invented
      selectedCouponIds: [], // no persisted source — not invented
    },
    notes: {
      // Strictly separate. NEVER merged, concatenated, or swapped.
      customerNotes: estimate.notes ?? "",
      internalMemo:  estimate.internal_memo ?? "",
    },
    metadata: { ...base.metadata, currentStep: 1 },
  };

  const integration: EstimateWizardIntegrationState = {
    sourceKind: "existing",
    sourceEstimateId,
    reconstructionStatus,
    unresolvedItemIds,
    issues,
  };

  return new HydratedWizardDraftImplementation(draft, integration);
}
