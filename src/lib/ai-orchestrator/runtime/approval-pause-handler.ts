// DealerOS — AI Orchestration Engine: Approval Pause Handler (Sprint 11L Phase E)
//
// When a step requires dealer approval, the live bridge must:
//   1. Stop executing further steps in the plan chain
//   2. Capture the paused state in memory
//   3. Return the plan in "awaiting_approval" state
//   4. NOT continue automatically — the dealer must act
//
// In Sprint 11L, the pause record is in-memory only (no persistence).
// Sprint 11M will persist this to dealer_ai_execution_log (CTO approval required).
//
// The approval flow:
//   Step triggers approval gate
//         ↓
//   buildApprovalPauseRecord() — captures context
//         ↓
//   Plan runner stops processing further steps
//         ↓
//   Caller returns paused result to the server action
//         ↓  (Sprint 11M: UI shows bridge result → dealer reviews output)
//   resolveApprovalPause(record, "approved" | "rejected") — dealer acts
//         ↓
//   "approved" → plan continues from next step (Sprint 11M live execution)
//   "rejected" → plan is cancelled
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }                from "@/lib/ai/agents/types";
import type {
  AIApprovalPauseRecord,
  AIExecutionBridgeResult,
}                                        from "./bridge-types";

// ─── Pause record factory ─────────────────────────────────────────────────────

/**
 * buildApprovalPauseRecord — creates an in-memory pause record for a stopped plan.
 *
 * dealer_id must always come from getCurrentDealer() — it arrives here via
 * bridge_result.agent_id and the plan-level dealer_id from the request.
 */
export function buildApprovalPauseRecord(
  plan_id:          string,
  dealer_id:        string,
  paused_at_step:   string,
  agent_id:         AIAgentId,
  pending_step_ids: string[],
  bridge_result:    AIExecutionBridgeResult,
  now:              string,
): AIApprovalPauseRecord {
  return {
    plan_id,
    dealer_id,
    paused_at_step,
    agent_id,
    pending_step_ids: [...pending_step_ids],
    bridge_result,
    resolved:         false,
    resolution:       null,
    resolved_by:      null,
    paused_at:        now,
    resolved_at:      null,
    in_memory_only:   true,
  };
}

// ─── Pause state queries ──────────────────────────────────────────────────────

/**
 * isApprovalPaused — returns true if the pause record is active (not yet resolved).
 */
export function isApprovalPaused(record: AIApprovalPauseRecord): boolean {
  return !record.resolved;
}

/**
 * isApprovalApproved — true if the dealer approved the paused step.
 */
export function isApprovalApproved(record: AIApprovalPauseRecord): boolean {
  return record.resolved && record.resolution === "approved";
}

/**
 * isApprovalRejected — true if the dealer rejected the paused step.
 */
export function isApprovalRejected(record: AIApprovalPauseRecord): boolean {
  return record.resolved && record.resolution === "rejected";
}

// ─── Pause resolution ─────────────────────────────────────────────────────────

/**
 * resolveApprovalPause — records the dealer's decision on a paused plan.
 *
 * Returns a new record — does not mutate the input.
 *
 * "approved" → plan may continue from the step after paused_at_step (Sprint 11M).
 * "rejected" → plan is cancelled; pending_step_ids remain unexecuted.
 *
 * resolved_by should be the dealer's user identifier (not dealer_id).
 */
export function resolveApprovalPause(
  record:      AIApprovalPauseRecord,
  resolution:  "approved" | "rejected",
  resolved_by: string,
  now:         string,
): AIApprovalPauseRecord {
  return {
    ...record,
    resolved:     true,
    resolution,
    resolved_by,
    resolved_at:  now,
  };
}

// ─── Pending step computation ─────────────────────────────────────────────────

/**
 * computePendingStepIds — returns the step_ids that were NOT reached in the plan
 * because execution stopped at the approval gate.
 *
 * A step is "pending" if it comes after the paused step in topological order.
 * Parallel siblings of the paused step are also considered pending since the
 * plan must stop the entire depth level when a gate triggers.
 */
export function computePendingStepIds(
  all_step_ids:     string[],
  processed_step_ids: Set<string>,
  paused_step_id:   string,
): string[] {
  const pending: string[] = [];
  for (const id of all_step_ids) {
    // Pending = not processed AND not the step that triggered the pause
    if (!processed_step_ids.has(id) && id !== paused_step_id) {
      pending.push(id);
    }
  }
  return pending;
}
