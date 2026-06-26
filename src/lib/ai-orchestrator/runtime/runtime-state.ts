// DealerOS — AI Orchestration Engine: Runtime State Model (Sprint 11L Phase C)
//
// In-memory execution state for the live runtime bridge.
//
// States per step:
//   pending → preparing → ready (no approval gate)
//   pending → preparing → awaiting_approval (approval gate hit — plan stops)
//   pending → preparing → failed (initialize() threw)
//   pending → cancelled (plan cancelled before reaching this step)
//
// Rules:
//   - No persistence — all state is in-memory for the request lifecycle
//   - dealer_id always from getCurrentDealer()
//   - State transitions are pure — no side effects
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }               from "@/lib/ai/agents/types";
import type { AITaskType }              from "@/lib/ai/types";
import type { AIOrchestrationWorkflowId } from "../orchestrator-types";
import type { AIExecutionBridgeState }  from "./bridge-types";

// ─── Step execution record ────────────────────────────────────────────────────

/**
 * AIRuntimeExecutionRecord — in-memory state for one step in a live plan run.
 *
 * No persistence — lives only for the current server request.
 */
export interface AIRuntimeExecutionRecord {
  execution_id:        string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  plan_id:             string;
  step_id:             string;
  agent_id:            AIAgentId;
  task_type:           AITaskType;
  state:               AIExecutionBridgeState;
  initialize_attempted: boolean;
  initialize_succeeded: boolean;
  approval_required:   boolean;
  provider_ready:      boolean;
  error_message:       string | null;
  started_at:          string | null;
  completed_at:        string | null;
  /** True — no AI execution in Sprint 11L. */
  execution_deferred:  true;
}

// ─── Plan state ───────────────────────────────────────────────────────────────

/**
 * AIRuntimePlanState — in-memory state for an entire live plan run.
 *
 * Tracks all step records and the overall plan state.
 * No persistence — lives only for the current server request.
 */
export interface AIRuntimePlanState {
  plan_id:           string;
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  workflow_id:       AIOrchestrationWorkflowId;
  overall_state:     AIExecutionBridgeState;
  step_records:      Map<string, AIRuntimeExecutionRecord>;
  /** step_id where the plan was paused. null if no pause. */
  paused_at_step:    string | null;
  /** step_ids that were not reached due to approval pause or failure. */
  pending_step_ids:  string[];
  created_at:        string;
  updated_at:        string;
  /** True — no persistence in Sprint 11L. */
  in_memory_only:    true;
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * buildInitialExecutionRecord — creates a pending record for a step about to run.
 */
export function buildInitialExecutionRecord(
  dealer_id:   string,
  plan_id:     string,
  step_id:     string,
  agent_id:    AIAgentId,
  task_type:   AITaskType,
  now:         string,
): AIRuntimeExecutionRecord {
  return {
    execution_id:         `exec_${plan_id.slice(0, 8)}_${step_id}`,
    dealer_id,
    plan_id,
    step_id,
    agent_id,
    task_type,
    state:                "pending",
    initialize_attempted: false,
    initialize_succeeded: false,
    approval_required:    false,
    provider_ready:       false,
    error_message:        null,
    started_at:           now,
    completed_at:         null,
    execution_deferred:   true,
  };
}

/**
 * buildInitialPlanState — creates the initial in-memory state for a new live plan run.
 */
export function buildInitialPlanState(
  plan_id:    string,
  dealer_id:  string,
  workflow_id: AIOrchestrationWorkflowId,
  now:        string,
): AIRuntimePlanState {
  return {
    plan_id,
    dealer_id,
    workflow_id,
    overall_state:    "pending",
    step_records:     new Map(),
    paused_at_step:   null,
    pending_step_ids: [],
    created_at:       now,
    updated_at:       now,
    in_memory_only:   true,
  };
}

// ─── State transitions ────────────────────────────────────────────────────────

/**
 * transitionStepState — advances a step record to a new state.
 * Returns a new record — does not mutate the input.
 */
export function transitionStepState(
  record:    AIRuntimeExecutionRecord,
  new_state: AIExecutionBridgeState,
  now:       string,
  updates:   Partial<Omit<AIRuntimeExecutionRecord, "execution_id" | "dealer_id" | "plan_id" | "step_id" | "agent_id" | "task_type" | "execution_deferred">> = {},
): AIRuntimeExecutionRecord {
  const completed_at = isTerminalState(new_state) ? now : record.completed_at;
  return {
    ...record,
    ...updates,
    state:        new_state,
    completed_at,
  };
}

/**
 * transitionPlanState — updates the plan's overall state and updated_at.
 * Returns a new plan state — does not mutate the input.
 */
export function transitionPlanState(
  plan:      AIRuntimePlanState,
  new_state: AIExecutionBridgeState,
  now:       string,
  updates:   Partial<Pick<AIRuntimePlanState, "paused_at_step" | "pending_step_ids">> = {},
): AIRuntimePlanState {
  return {
    ...plan,
    ...updates,
    overall_state: new_state,
    updated_at:    now,
  };
}

/**
 * recordStepResult — writes a step record into the plan state.
 * Returns a new plan state with the record inserted — does not mutate.
 */
export function recordStepResult(
  plan:   AIRuntimePlanState,
  record: AIRuntimeExecutionRecord,
  now:    string,
): AIRuntimePlanState {
  const new_records = new Map(plan.step_records);
  new_records.set(record.step_id, record);
  return { ...plan, step_records: new_records, updated_at: now };
}

// ─── State query helpers ──────────────────────────────────────────────────────

export function isTerminalState(state: AIExecutionBridgeState): boolean {
  return (
    state === "ready"             ||
    state === "awaiting_approval" ||
    state === "completed"         ||
    state === "failed"            ||
    state === "cancelled"
  );
}

export function isBlockingState(state: AIExecutionBridgeState): boolean {
  return state === "failed" || state === "cancelled";
}

export function isPauseState(state: AIExecutionBridgeState): boolean {
  return state === "awaiting_approval";
}

/**
 * computeOverallPlanState — derives plan-level state from all step records.
 *
 * Priority order:
 *   1. Any step is "failed"            → plan is "failed"
 *   2. Any step is "cancelled"         → plan is "cancelled"
 *   3. Any step is "awaiting_approval" → plan is "awaiting_approval"
 *   4. All steps are "ready"           → plan is "ready"
 *   5. Otherwise                        → plan is "preparing"
 */
export function computeOverallPlanState(
  records: Map<string, AIRuntimeExecutionRecord>,
): AIExecutionBridgeState {
  const states = Array.from(records.values()).map((r) => r.state);

  if (states.some((s) => s === "failed"))              return "failed";
  if (states.some((s) => s === "cancelled"))           return "cancelled";
  if (states.some((s) => s === "awaiting_approval"))   return "awaiting_approval";
  if (states.length > 0 && states.every((s) => s === "ready" || s === "completed")) {
    return "ready";
  }
  return "preparing";
}

/**
 * getCompletedStepIds — returns the step_ids of all steps that finished
 * preparation (ready or completed) from the plan state.
 */
export function getCompletedStepIds(plan: AIRuntimePlanState): Set<string> {
  const ids = new Set<string>();
  for (const [step_id, record] of plan.step_records) {
    if (record.state === "ready" || record.state === "completed") {
      ids.add(step_id);
    }
  }
  return ids;
}
