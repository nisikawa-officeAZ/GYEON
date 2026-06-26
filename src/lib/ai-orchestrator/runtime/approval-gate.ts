// DealerOS — AI Orchestration Engine: Dealer Approval Gate (Sprint 11K Phase D)
//
// Models the dealer approval gate — the pause point in the orchestration pipeline
// where customer-facing AI output must be reviewed before dispatch.
//
// In dry-run mode, gates are detected and reported but not persisted.
// Gate state changes (approve/reject) are pure in-memory operations.
//
// Gate lifecycle:
//   Step has requires_dealer_approval: true
//         │
//         ▼
//   approval_required_before_next_step
//         │
//   Dealer reviews output
//         │
//   dealer.approve() ──→ approval_approved ──→ plan continues
//   dealer.reject()  ──→ approval_rejected ──→ plan stops
//
// No persistence — gate state lives in the server action session in Sprint 11K.
// Sprint 11L: gate state persisted in dealer_ai_execution_log.
//
// Pure — no "use server", no async, no DB calls.

import type { AIExecutionStep }             from "../orchestrator-types";
import type { AIExecutionPolicy }           from "../orchestrator-types";
import type { AIOrchestratorRuntimeContext } from "./orchestrator-runtime-types";

// ─── Approval gate status ─────────────────────────────────────────────────────

export type AIApprovalGateStatus =
  | "not_required"                     // Step does not need dealer approval
  | "approval_pending"                 // Gate is open — dealer has not yet acted
  | "approval_required_before_next_step" // Plan is paused; downstream steps blocked
  | "approval_approved"                // Dealer approved — plan may continue
  | "approval_rejected"                // Dealer rejected — plan is stopped
  | "approval_timed_out";              // approval_gate_timeout_ms elapsed with no action

// ─── Approval gate decision ───────────────────────────────────────────────────

export type AIApprovalGateDecision = "approved" | "rejected";

// ─── Approval gate state ──────────────────────────────────────────────────────

/**
 * AIApprovalGateState — current state of a single dealer approval gate.
 *
 * One gate exists per step with requires_dealer_approval: true.
 * dealer_id must always come from getCurrentDealer() at the server action layer.
 */
export interface AIApprovalGateState {
  step_id:             string;
  plan_id:             string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  status:              AIApprovalGateStatus;
  /** The AI-generated output the dealer is asked to review. null in dry-run. */
  output_to_review:    Record<string, unknown> | null;
  /** Identifier of the dealer user who made the decision. null until decided. */
  decided_by:          string | null;
  /** ISO 8601 timestamp of the decision. null until decided. */
  decided_at:          string | null;
  /** Optional dealer notes attached to the decision. */
  notes:               string | null;
  /** ISO 8601 timestamp when the gate was opened. */
  gate_opened_at:      string;
  /** True — no persistence in Sprint 11K. */
  persisted:           false;
}

// ─── Factory: pending gate ────────────────────────────────────────────────────

/**
 * buildPendingApprovalGate — creates a gate in the approval_pending state.
 * dealer_id must come from getCurrentDealer().
 */
export function buildPendingApprovalGate(
  step:      AIExecutionStep,
  plan_id:   string,
  dealer_id: string,
  now:       string,
): AIApprovalGateState {
  return {
    step_id:          step.step_id,
    plan_id,
    dealer_id,
    status:           "approval_required_before_next_step",
    output_to_review: null,
    decided_by:       null,
    decided_at:       null,
    notes:            null,
    gate_opened_at:   now,
    persisted:        false,
  };
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * evaluateApprovalGate — checks whether a step requires an approval gate.
 *
 * A gate is required when:
 *   1. step.requires_dealer_approval is true, OR
 *   2. step.is_customer_facing is true AND policy.pause_on_customer_facing_output is true
 */
export function evaluateApprovalGate(
  step:    AIExecutionStep,
  policy:  AIExecutionPolicy,
): AIApprovalGateStatus {
  const needs_explicit = step.requires_dealer_approval;
  const needs_policy   = step.is_customer_facing && policy.pause_on_customer_facing_output;

  if (needs_explicit || needs_policy) {
    return "approval_required_before_next_step";
  }
  return "not_required";
}

/**
 * requiresApprovalGate — convenience helper returning a boolean.
 */
export function requiresApprovalGate(
  step:    AIExecutionStep,
  policy:  AIExecutionPolicy,
): boolean {
  return evaluateApprovalGate(step, policy) !== "not_required";
}

// ─── Decision application ─────────────────────────────────────────────────────

/**
 * applyApprovalGateDecision — returns an updated gate with the dealer's decision.
 * Pure function — does not mutate the input gate.
 */
export function applyApprovalGateDecision(
  gate:        AIApprovalGateState,
  decision:    AIApprovalGateDecision,
  decided_by:  string,
  notes:       string | null,
  now:         string,
): AIApprovalGateState {
  return {
    ...gate,
    status:     decision === "approved" ? "approval_approved" : "approval_rejected",
    decided_by,
    decided_at: now,
    notes,
  };
}

// ─── State helpers ────────────────────────────────────────────────────────────

/** True if the gate is in a state that blocks the downstream pipeline. */
export function isGateBlocking(gate: AIApprovalGateState): boolean {
  return (
    gate.status === "approval_required_before_next_step" ||
    gate.status === "approval_pending" ||
    gate.status === "approval_rejected"
  );
}

/** True if the gate allows the pipeline to continue. */
export function isGateCleared(gate: AIApprovalGateState): boolean {
  return gate.status === "approval_approved" || gate.status === "not_required";
}

/** True if the gate is still waiting for a decision. */
export function isGatePending(gate: AIApprovalGateState): boolean {
  return (
    gate.status === "approval_pending" ||
    gate.status === "approval_required_before_next_step"
  );
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

/**
 * getBlockingGates — returns all gates that would block the plan from continuing.
 */
export function getBlockingGates(
  gates: AIApprovalGateState[],
): AIApprovalGateState[] {
  return gates.filter(isGateBlocking);
}

/**
 * getAllGatesFromContext — builds gate states for all approval steps in the plan.
 * Returns only gates that are relevant (requires_dealer_approval or customer-facing).
 */
export function buildGatesForPlan(
  steps:   AIExecutionStep[],
  context: AIOrchestratorRuntimeContext,
  now:     string,
): AIApprovalGateState[] {
  return steps
    .filter((s) => requiresApprovalGate(s, context.policy))
    .map((s) => buildPendingApprovalGate(s, context.plan.plan_id, context.dealer_id, now));
}
