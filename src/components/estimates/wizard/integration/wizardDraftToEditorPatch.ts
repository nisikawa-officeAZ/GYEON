// Estimate Wizard Ver2.2 — Wizard → EstimateEditor APPLY PLAN builder (Phase 8-B2B).
//
// PURE. No React, no state, no server action, no DB, no API, no FormData, no randomness, no clock,
// no identifier generation, no `any`, no cast, no unsafe assertion.
//
// ── WHAT THIS IS ────────────────────────────────────────────────────────────────
// A plan, not a mutation. It computes EVERYTHING the editor would need — the scalar patch and the
// canonical line items — and validates the whole thing BEFORE any editor state is touched. The
// caller either receives a complete, already-checked `"ready"` plan, or a `"blocked"` plan carrying
// the reasons and NO items at all. There is no partially-applied state, because nothing is applied
// here.
//
// ── ARCHITECT RULINGS THIS FILE IMPLEMENTS (Phase 8-B2B) ────────────────────────
//   1. `WizardOwnedFieldPatch` stays SCALAR-ONLY and unchanged. This file maps its seven fields and
//      nothing else. It is imported, never redeclared, never widened.
//   2. Items are derived SEPARATELY, through the existing canonical path only:
//         draft → buildWizardPricingInput(draft).services → buildLineItems(services, catalog)
//      No pricing is computed here. No line is composed here. No price is read, rounded, summed, or
//      adjusted here. This module never touches money — it only forwards what the production engine
//      returns.
//   3. Runtime apply is limited to NEW estimates. See "THE EXISTING-ESTIMATE GATE" below.
//   4. Existing estimates with unresolved legacy items stay BLOCKED, with the reason preserved
//      verbatim from the validator — never summarized, never downgraded, never dropped.
//   5. Structured-config persistence is deferred, so Screen-4 reconstruction is NOT attempted here.
//      Unresolved legacy items are never rebuilt, never merged, and never overwritten.
//
// ── THE ORDER MATTERS ───────────────────────────────────────────────────────────
// The integration validator runs FIRST, before the pricing input is even built. A blocked draft
// therefore never reaches `buildLineItems`, so a draft that must not be applied cannot produce
// items — not even discarded ones. That is a control-flow guarantee, not a convention: the `"blocked"`
// variant of the returned union has no `items` field to hold them.
//
// ── THE CREATE-MODE GATE (Phase 8-B2B-H) ────────────────────────────────────────
// Ruling 3 limits apply to NEW estimates. That is now enforced HERE, at the planner, by a REQUIRED
// `mode` parameter — not merely by where the container happens to be mounted. `"edit"` is refused
// unconditionally and FIRST, before the validator and before any pricing.
//
// The blocking reason lives in this module's LOCAL `ApplyPlanBlockedReason` union, NOT in
// `INTEGRATION_ISSUE_CODES`. The opaque contract (Ruling 1) and every opaque type are untouched:
// "the editor surface is unsupported" is a fact about the CALLER, not a defect in the draft, so it
// has no business in the draft's issue vocabulary.
//
// Defence in depth — the two gates are independent, and either alone would hold:
//   • Mode gate: `"edit"` never plans, full stop.
//   • Data gate: even if the mode gate were removed, `estimateToWizardDraft` records EVERY persisted
//     item in `unresolvedItemIds` (estimateToWizardDraft.ts:295–301), so any existing estimate with
//     even one line item is already blocked by `UNRESOLVED_LEGACY_ITEMS` +
//     `SERVICE_CONFIGURATION_NOT_RECONSTRUCTED`.
// An `"edit"` call is now blocked by mode BEFORE the data gate is even consulted, so a persisted
// estimate can never be reconstructed, merged, or overwritten from a wizard draft.
//
// ── PRICING-OWNED CONTEXT ───────────────────────────────────────────────────────
// `isDealer`, `dealerRate` and `taxRate` are absent from `WizardOwnedFieldPatch` and are absent from
// this module. They are never read, never written, never defaulted, and never inferred. Applying a
// plan built here cannot disturb the EstimateEditor / Pricing-owned context — that is guaranteed by
// the patch type, which this file does not extend.

import { buildLineItems, type PricedLineItem } from "@/lib/pricing/pricing-engine";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import { buildWizardPricingInput } from "../pricing/wizard-pricing-input-adapter";
import type { WizardPricingIssue } from "../pricing/wizard-pricing-types";
import type { HydratedWizardDraft } from "./estimateToWizardDraft";
import { validateWizardDraftForEstimateEditorIntegration } from "./validateWizardDraftForEstimateEditorIntegration";
import type { IntegrationIssue, WizardOwnedFieldPatch } from "./estimateWizardIntegrationContract";

/**
 * The EstimateEditor mode the plan is being built for. REQUIRED and never defaulted — see
 * `buildEstimateEditorApplyPlan`. A default here would be the whole bug: an omitted argument would
 * silently become "create" and let an edit-mode caller through.
 */
export type EstimateEditorMode = "create" | "edit";

/** Why a plan cannot be applied. Discriminated so a caller cannot confuse the cases. */
export type ApplyPlanBlockedReason =
  /**
   * The editor is in a mode that Phase 8-B2 does not support (Architect Ruling 3: apply is limited
   * to NEW estimates). Checked FIRST, before anything else.
   */
  | "unsupported-editor-mode"
  /**
   * PROVENANCE HOLE (Phase 8-B2C-A). The editor is creating a NEW estimate, but the draft was
   * hydrated from a PERSISTED one — it carries a real `sourceEstimateId`. Applying it would pour an
   * existing estimate's identity and content into a brand-new row. The mode gate alone does not
   * catch this: an existing estimate with ZERO persisted items validates cleanly and would sail
   * through `"create"`. Checked before pricing, so nothing is computed for such a draft.
   */
  | "source-estimate-not-allowed-in-create"
  /** The integration validator raised at least one blocking issue. */
  | "integration-blocked"
  /** The draft's own pricing input is invalid (e.g. a named manual row with no amount). */
  | "pricing-invalid";

/**
 * The result of planning an apply. A discriminated union: `"ready"` is the ONLY variant that carries
 * a patch or items, so a blocked plan cannot be applied even by mistake — the fields do not exist.
 */
export type EstimateEditorApplyPlan =
  | {
      readonly status: "blocked";
      readonly reason: ApplyPlanBlockedReason;
      /** Verbatim from the validator. Operator-facing Japanese; never summarized. */
      readonly blockingIssues: readonly IntegrationIssue[];
      /** Pricing errors, if the draft priced invalidly. Empty when `reason` is integration-blocked. */
      readonly pricingErrors: readonly WizardPricingIssue[];
      /** Every integration issue, blocking or not. */
      readonly issues: readonly IntegrationIssue[];
    }
  | {
      readonly status: "ready";
      /** Exactly the seven contract fields. Scalar-only. No items, no pricing context. */
      readonly patch: WizardOwnedFieldPatch;
      /**
       * Canonical priced lines, straight from `buildLineItems`. NOT `EditorItem[]`: `EditorItem.key`
       * is an editor-owned row identity, and inventing identifiers in a pure module is exactly what
       * Phase 8-B1 forbids. The editor assigns keys with its own `nextKey()` when it applies.
       */
      readonly items: readonly PricedLineItem[];
      readonly issues: readonly IntegrationIssue[];
      /** Advisory only — a ready plan may still carry pricing warnings. */
      readonly pricingWarnings: readonly WizardPricingIssue[];
    };

/**
 * Map the Wizard-owned scalar fields. Exactly the seven fields of `WizardOwnedFieldPatch` — the
 * return type is the contract type itself, so adding an eighth field here would not compile, and
 * omitting one would not compile either.
 *
 * `sourceEstimateId` comes from the opaque draft's `integration` provenance, never from the mutable
 * `draft` body — provenance is the one thing the operator must not be able to type over.
 *
 * `customerNotes` and `internalMemo` are copied INDEPENDENTLY from their two distinct draft fields.
 * They are never concatenated, never merged, never cross-assigned. `internalMemo` is staff-only.
 *
 * `discountAmount` is the yen input — the only adjustment with a persisted column. Percent and
 * coupon are not read here at all: the validator has already blocked any draft that carries them,
 * so this line is only ever reached when they are absent.
 */
function mapWizardOwnedFields(hydrated: HydratedWizardDraft): WizardOwnedFieldPatch {
  const { draft, integration } = hydrated;
  return {
    sourceEstimateId: integration.sourceEstimateId,
    customerId:       draft.customer.customerId,
    vehicleId:        draft.vehicle.vehicleId,
    bodySizeKey:      draft.vehicle.bodySizeKey,
    customerNotes:    draft.notes.customerNotes,
    internalMemo:     draft.notes.internalMemo,
    discountAmount:   draft.discountAndCoupon.amountInput,
  };
}

/**
 * Build a complete, validated apply plan from an opaque hydrated draft.
 *
 * `hydrated` is `HydratedWizardDraft` — the module-private nominal class from
 * `estimateToWizardDraft.ts`. A bare draft, an object literal, or a spread copy does not compile
 * here, so a plan can never be built from a forged or unvalidated draft.
 *
 * `catalog` is REQUIRED, not defaulted. The caller supplies the same `PricingCatalog` the editor
 * itself is using, so the plan's items are priced by the operator's real catalog rather than a
 * silent module fallback that could disagree with what the editor would have produced.
 *
 * Pure: mutates nothing, reads no clock, generates no identifier, performs no I/O.
 */
export function buildEstimateEditorApplyPlan(
  hydrated: HydratedWizardDraft,
  mode: EstimateEditorMode,
  catalog: PricingCatalog,
): EstimateEditorApplyPlan {
  // ── 1. Mode gate — FIRST. Before validation, before pricing, before anything. ──
  // Architect Ruling 3: B2 runtime apply is limited to NEW estimates. `"edit"` is refused here
  // unconditionally — not because the draft is bad, but because the SURFACE is unsupported. It is
  // rejected before the validator runs, so an edit-mode call performs no validation work, executes
  // no pricing, reads no catalog, and touches nothing. `mode` is a required parameter, so a caller
  // cannot reach this function without stating which surface it is applying to.
  if (mode !== "create") {
    return Object.freeze({
      status:         "blocked",
      reason:         "unsupported-editor-mode",
      blockingIssues: Object.freeze([]),
      pricingErrors:  Object.freeze([]),
      issues:         Object.freeze([]),
    });
  }

  // ── 2. Integration gate — before any pricing work happens. ─────────────────────
  // Unresolved legacy items, untrustworthy reconstruction, invalid source id, percent discount and
  // coupon selection are all decided here. A draft that fails returns with NO items computed.
  //
  // This runs BEFORE the provenance gate ON PURPOSE. Both would refuse an existing estimate that
  // carries legacy items, but only this one can say WHY in the operator's own terms. Ruling 4
  // requires that specific reason to survive, so the more informative gate speaks first.
  const validation = validateWizardDraftForEstimateEditorIntegration(hydrated);
  if (!validation.canApplyToEstimateEditor) {
    return Object.freeze({
      status:         "blocked",
      reason:         "integration-blocked",
      blockingIssues: Object.freeze([...validation.blockingIssues]),
      pricingErrors:  Object.freeze([]),
      issues:         Object.freeze([...validation.issues]),
    });
  }

  // ── 3. Provenance gate — a create-mode plan must have NO source estimate. ──────
  // The hole the mode gate does not close. `sourceKind`/`sourceEstimateId` live in the opaque
  // `integration` provenance, which the operator cannot type over. A `"create"` editor is filling an
  // EMPTY row: a draft that remembers a persisted estimate has no business there — and an existing
  // estimate with ZERO items validates cleanly, so it would otherwise reach `"ready"` and pour a
  // persisted estimate's identity and content into a brand-new one.
  //
  // Still strictly before pricing: no items are ever computed for such a draft.
  if (hydrated.integration.sourceKind !== "new" || hydrated.integration.sourceEstimateId !== null) {
    return Object.freeze({
      status:         "blocked",
      reason:         "source-estimate-not-allowed-in-create",
      blockingIssues: Object.freeze([]),
      pricingErrors:  Object.freeze([]),
      issues:         Object.freeze([...validation.issues]),
    });
  }

  // ── 4. Items — the canonical path, and only the canonical path. ────────────────
  // `buildWizardPricingInput` turns the Screen-4 configuration into production `ServiceInput[]`;
  // `buildLineItems` is the same authoritative function `EstimateEditor.appendService` calls. This
  // module composes nothing and prices nothing itself.
  const bundle = buildWizardPricingInput(hydrated.draft);

  // A draft whose own pricing input is invalid must not be applied either — half-priced items are a
  // silent data defect. Reported distinctly from an integration block so the operator sees the real
  // cause, and still with no items produced.
  if (bundle.errors.length > 0) {
    return Object.freeze({
      status:         "blocked",
      reason:         "pricing-invalid",
      blockingIssues: Object.freeze([]),
      pricingErrors:  Object.freeze([...bundle.errors]),
      issues:         Object.freeze([...validation.issues]),
    });
  }

  const items = buildLineItems(bundle.services, catalog);

  // ── 5. A complete, checked plan. Nothing has been applied; nothing has been mutated. ──
  return Object.freeze({
    status:          "ready",
    patch:           Object.freeze(mapWizardOwnedFields(hydrated)),
    items:           Object.freeze(items),
    issues:          Object.freeze([...validation.issues]),
    pricingWarnings: Object.freeze([...bundle.warnings]),
  });
}
