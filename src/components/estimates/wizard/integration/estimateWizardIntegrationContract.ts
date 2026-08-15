// Estimate Wizard Ver2.2 — EstimateEditor ⇄ Wizard integration contract (Phase 8-B1E).
//
// TYPES AND PURE GUARDS ONLY. No React, no server module, no DB, no API, no FormData, no pricing,
// no randomness, no clock, no identifier generation, no casts.
//
// ── WHERE THE OPAQUE TYPE LIVES ─────────────────────────────────────────────────
// This file deliberately does NOT declare `HydratedWizardDraft`. That type is a module-private
// implementation class in `estimateToWizardDraft.ts`, so it cannot be constructed — by literal or
// by spread — anywhere else. This file owns only the plain data that goes INSIDE it.
//
// ── DEFECT HISTORY ──────────────────────────────────────────────────────────────
// 8-B1A: hydration blockers were returned BESIDE the draft, so `const { draft } = …` dropped them
//        and the validator (which took a bare draft) approved a legacy estimate with an EMPTY
//        serviceConfiguration. A reverse adapter would have overwritten real persisted items with
//        nothing. Critical.
// 8-B1C: blockers moved into an envelope; the validator now accepts only the envelope. That closed
//        the accidental-drop path — but the envelope was a plain interface, so ordinary cast-free
//        code could still forge one.
// 8-B1E: the envelope becomes a module-private class with a private witness field. TypeScript
//        treats private members NOMINALLY, so neither an object literal nor a spread copy is
//        assignable to it. Forgery now requires an unsafe assertion, which the project forbids.

import type { EstimateItemDB } from "@/lib/estimates/estimate-types";

// ── Hydration input boundary ─────────────────────────────────────────────────────
/**
 * The persisted estimate, narrowed to the fields hydration is permitted to read.
 *
 * Declared STRUCTURALLY rather than as `Pick<EstimateDB, …>` on purpose: `EstimateDB`'s nested
 * `customers` / `vehicles` currently carry uncommitted, unscoped changes (PDF-driven), and Phase 8
 * must not depend on frozen work. Every field below exists in the COMMITTED `EstimateDB`, and an
 * `EstimateDB` value is structurally assignable here, so the frozen additions are unreachable.
 */
export interface EstimateHydrationInput {
  id:              string;
  customer_id:     string;
  vehicle_id:      string;
  discount_amount: number;
  notes:           string | null;
  internal_memo:   string | null;
  vehicles?: {
    body_size: string | null;
  } | null;
  estimate_items?: EstimateItemDB[];
}

// ── Integration issues ───────────────────────────────────────────────────────────
/** Stable machine codes. Never rendered raw to an operator. */
export const INTEGRATION_ISSUE_CODES = {
  /** Screen-5 percent discount has no persisted column. Cannot round-trip. BLOCKING. */
  UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE: "UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE",
  /** Screen-5 coupon selection has no persisted column. Cannot round-trip. BLOCKING. */
  UNSUPPORTED_COUPON_PERSISTENCE: "UNSUPPORTED_COUPON_PERSISTENCE",
  /** Persisted estimate_items rows have no structured Screen-4 counterpart. BLOCKING. */
  UNRESOLVED_LEGACY_ITEMS: "UNRESOLVED_LEGACY_ITEMS",
  /** Screen-4 configuration could not be reconstructed from the persisted row. BLOCKING. */
  SERVICE_CONFIGURATION_NOT_RECONSTRUCTED: "SERVICE_CONFIGURATION_NOT_RECONSTRUCTED",
  /** An existing estimate arrived without a usable id — it cannot be written back. BLOCKING. */
  INVALID_SOURCE_ESTIMATE_ID: "INVALID_SOURCE_ESTIMATE_ID",
  /** A persisted item category has no Screen-3 counterpart (e.g. 'interior', 'glass'). */
  UNMAPPED_ITEM_CATEGORY: "UNMAPPED_ITEM_CATEGORY",
  /** The persisted yen discount was read as-is; the Wizard never recalculates it. */
  DISCOUNT_AMOUNT_NOT_RECALCULATED: "DISCOUNT_AMOUNT_NOT_RECALCULATED",
} as const;

export type IntegrationIssueCode =
  (typeof INTEGRATION_ISSUE_CODES)[keyof typeof INTEGRATION_ISSUE_CODES];

/** `blocking` forbids apply AND persist. `warning` / `info` are advisory only. */
export type IntegrationIssueSeverity = "info" | "warning" | "blocking";

export interface IntegrationIssue {
  readonly code:     IntegrationIssueCode;
  /** Dot-path into the persisted row or the Wizard draft. NEVER a value, NEVER note content, NEVER PII. */
  readonly field:    string;
  readonly severity: IntegrationIssueSeverity;
  /** Operator-facing Japanese text. Contains no persisted values. */
  readonly message:  string;
}

/** Stable identity for deduplication: the same code on the same field is the same issue. */
export function integrationIssueKey(issue: IntegrationIssue): string {
  return `${issue.code}::${issue.field}`;
}

// ── Integration state ────────────────────────────────────────────────────────────
/**
 * Where the draft came from.
 *
 *   "new"      — a brand-new estimate. Nothing to reconstruct. No source row.
 *   "existing" — hydrated from a persisted estimate. A source id is REQUIRED.
 */
export type EstimateWizardSourceKind = "new" | "existing";

/**
 * How completely the persisted estimate's Screen-4 configuration was rebuilt.
 *
 *   "not-applicable" — new estimate; there was nothing to reconstruct.
 *   "none"           — the estimate HAS persisted line items but NO structured configuration
 *                      exists to rebuild them from. Screen 4 is empty and MUST NOT be applied.
 *   "partial"        — some configuration was rebuilt; unresolved items remain.
 *   "complete"       — every persisted item is represented in the Wizard configuration.
 *
 * Exhaustive by construction. There is no "unknown" and no default: an unrepresentable estimate is
 * `"none"`, loudly, rather than an empty draft that merely looks finished.
 */
export type ReconstructionStatus = "not-applicable" | "none" | "partial" | "complete";

/**
 * Everything that qualifies a Wizard draft. Travels INSIDE the opaque draft — never beside it.
 * Plain, serializable data; the nominal guarantee lives on the wrapper, not here.
 */
export interface EstimateWizardIntegrationState {
  readonly sourceKind: EstimateWizardSourceKind;
  /** The persisted estimate this draft belongs to. `null` iff `sourceKind === "new"`. */
  readonly sourceEstimateId: string | null;
  readonly reconstructionStatus: ReconstructionStatus;
  /**
   * Real `estimate_items.id` values that could NOT be rebuilt into structured Screen-4 state.
   * Copied verbatim, never regenerated, never invented. Non-empty ⇒ apply and persist are blocked.
   */
  readonly unresolvedItemIds: readonly string[];
  /** Every issue raised during hydration. Exhaustive; never truncated, never downgraded. */
  readonly issues: readonly IntegrationIssue[];
}

// ── Validation result ────────────────────────────────────────────────────────────
export interface IntegrationValidationResult {
  /** True only when NO blocking issue exists. */
  readonly canApplyToEstimateEditor: boolean;
  /** True only when NO blocking issue exists. Apply and persist share one gate, by design. */
  readonly canPersist: boolean;
  /** Hydration issues + validation issues, deduplicated by (code, field). */
  readonly issues: readonly IntegrationIssue[];
  readonly blockingIssues: readonly IntegrationIssue[];
}

// ── Future reverse-adapter boundary (types only — NOTHING implements this yet) ────
/**
 * The shape a FUTURE Wizard → EstimateEditor reverse adapter must return (Architect Ruling 9).
 *
 * A PATCH of Wizard-owned fields — never a full EstimateEditor replacement. `isDealer`,
 * `dealerRate` and `taxRate` are deliberately ABSENT, so applying this patch cannot overwrite the
 * EstimateEditor / Pricing-owned context. That is a type-level guarantee, not a review convention.
 */
export interface WizardOwnedFieldPatch {
  readonly sourceEstimateId: string | null;
  readonly customerId: string | null;
  readonly vehicleId: string | null;
  readonly bodySizeKey: string;
  readonly customerNotes: string;
  /** Staff-only. NEVER merged with customerNotes, NEVER customer-facing. */
  readonly internalMemo: string;
  /** Yen amount. The only adjustment with a persisted column. */
  readonly discountAmount: string;
}

// ── Pure guards ──────────────────────────────────────────────────────────────────
/** The estimate holds persisted items that hydration could not rebuild. */
export function hasUnresolvedLegacyItems(state: EstimateWizardIntegrationState): boolean {
  return state.unresolvedItemIds.length > 0;
}

/** An existing estimate must carry a usable id, or it cannot be written back. */
export function hasValidSourceEstimateId(state: EstimateWizardIntegrationState): boolean {
  if (state.sourceKind === "new") return state.sourceEstimateId === null;
  return state.sourceEstimateId !== null && state.sourceEstimateId.trim() !== "";
}

/**
 * Screen-4 configuration is trustworthy only when reconstruction is complete, or when there was
 * nothing to reconstruct because this is a new estimate. `"none"` and `"partial"` are never safe.
 */
export function isServiceConfigurationTrustworthy(state: EstimateWizardIntegrationState): boolean {
  const statusOk =
    state.reconstructionStatus === "complete" || state.reconstructionStatus === "not-applicable";
  return statusOk && !hasUnresolvedLegacyItems(state);
}
