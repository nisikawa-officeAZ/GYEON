// DealerOS — AI Orchestration Engine: Runtime Domain Types (Sprint 11K Phase A)
//
// Domain types for the AI Orchestrator dry-run runtime.
//
// Sprint 11K delivers:
//   - Dry-run execution: all plan steps validated, bridge requests built, no AI inference
//   - Sequential and parallel step grouping
//   - Dealer approval gate detection
//   - Failure strategy integration (structural validation)
//   - In-memory cross-agent feed mapping
//
// Sprint 11L delivers:
//   - Live execution (execution_mode: "live")
//   - Real gateway bridge calls to AI provider adapters
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AppFeature }             from "@/lib/plans/plan-types";
import type { AIAgentId }              from "@/lib/ai/agents/types";
import type { AITaskType }             from "@/lib/ai/types";
import type {
  AIOrchestrationWorkflowId,
  AIExecutionPlan,
  AIExecutionPolicy,
  AIExecutionStatus,
}                                      from "../orchestrator-types";
import type { AIFailureStrategyBundle } from "../failure-strategy";
import type { AIGatewayBridgeRequest, AIGatewayBridgeResponse } from "../provider-bridge";

// ─── Execution mode ───────────────────────────────────────────────────────────

export type AIRuntimeExecutionMode = "dry_run" | "live";

// ─── Runtime capabilities ─────────────────────────────────────────────────────

export type AIRuntimeCapabilityId =
  | "sequential_validation"       // Validate steps in dependency order (Sprint 11K)
  | "parallel_grouping"           // Group parallel-eligible steps (Sprint 11K)
  | "approval_gate_detection"     // Detect and report dealer approval gates (Sprint 11K)
  | "failure_strategy_validation" // Validate failure strategy structurally (Sprint 11K)
  | "cross_agent_feed_mapping"    // Map in-memory cross-agent data exchanges (Sprint 11K)
  | "live_execution"              // Execute real AI provider calls (Sprint 11L)
  | "usage_tracking"              // Record per-step token usage (Sprint 11K — requires migration)
  | "execution_history";          // Persist execution results (Sprint 11L)

export interface AIRuntimeCapability {
  id:               AIRuntimeCapabilityId;
  label:            string;
  available:        boolean;
  available_since:  string | null;
  deferred_until:   string | null;
}

// ─── AIOrchestratorRuntime descriptor ────────────────────────────────────────

export interface AIOrchestratorRuntime {
  version:                       string;
  capabilities:                  AIRuntimeCapability[];
  available_execution_modes:     AIRuntimeExecutionMode[];
  /** True in Sprint 11K — dry-run is now usable. */
  dry_run_available:             true;
  /** True — live execution requires Phase 11L. */
  live_execution_deferred:       true;
  live_execution_target_sprint:  string;
}

export const RUNTIME_CAPABILITIES: AIRuntimeCapability[] = [
  { id: "sequential_validation",       label: "Sequential Step Validation",       available: true,  available_since: "Sprint 11K", deferred_until: null },
  { id: "parallel_grouping",           label: "Parallel Step Grouping",           available: true,  available_since: "Sprint 11K", deferred_until: null },
  { id: "approval_gate_detection",     label: "Dealer Approval Gate Detection",   available: true,  available_since: "Sprint 11K", deferred_until: null },
  { id: "failure_strategy_validation", label: "Failure Strategy Validation",      available: true,  available_since: "Sprint 11K", deferred_until: null },
  { id: "cross_agent_feed_mapping",    label: "Cross-Agent Feed Mapping",         available: true,  available_since: "Sprint 11K", deferred_until: null },
  { id: "live_execution",              label: "Live AI Provider Execution",       available: false, available_since: null,          deferred_until: "Sprint 11L" },
  { id: "usage_tracking",              label: "Per-Step Usage Tracking",          available: false, available_since: null,          deferred_until: "Sprint 11K (requires migration)" },
  { id: "execution_history",           label: "Execution History Persistence",    available: false, available_since: null,          deferred_until: "Sprint 11L" },
];

export const AI_ORCHESTRATOR_RUNTIME: AIOrchestratorRuntime = {
  version:                      "1.0.0-dry-run",
  capabilities:                 RUNTIME_CAPABILITIES,
  available_execution_modes:    ["dry_run"],
  dry_run_available:            true,
  live_execution_deferred:      true,
  live_execution_target_sprint: "Sprint 11L",
};

// ─── Step dry-run status ──────────────────────────────────────────────────────

/**
 * AIStepDryRunStatus — outcome of validating a single step in dry-run mode.
 */
export type AIStepDryRunStatus =
  | "validated"               // Step is structurally valid and ready to execute
  | "blocked_approval"        // Paused — requires dealer sign-off before proceeding
  | "blocked_dependency"      // A required depends_on step failed or was blocked
  | "blocked_feature_gate"    // Dealer does not have the required AppFeature active
  | "blocked_cancelled"       // The cancellation token was triggered before this step
  | "blocked_gateway"         // AI Gateway structural validation failed
  | "skipped_optional"        // Step is optional (is_optional: true) and was skipped
  | "deferred";               // Step requires Sprint 11L+ capability

// ─── Step result ──────────────────────────────────────────────────────────────

/**
 * AIOrchestratorStepResult — dry-run outcome for one execution step.
 *
 * Created by AIOrchestratorStepRunner for each step in the plan.
 */
export interface AIOrchestratorStepResult {
  step_id:                  string;
  agent_id:                 AIAgentId;
  task_type:                AITaskType;
  label:                    string;
  dry_run_status:           AIStepDryRunStatus;
  /** Bridge request that would be sent if this step ran. null if blocked before build. */
  bridge_request:           AIGatewayBridgeRequest | null;
  /** Deferred response placeholder. null if step was blocked. */
  bridge_response:          AIGatewayBridgeResponse | null;
  /** Human-readable issues found during validation. */
  validation_errors:        string[];
  /** True if this step triggered a dealer approval gate. */
  approval_gate_triggered:  boolean;
  /** parallel group this step belongs to. null if sequential. */
  parallel_group_id:        string | null;
  /** True — no actual AI inference in Sprint 11K. */
  execution_deferred:       true;
  validated_at:             string;
}

// ─── Parallel step group ──────────────────────────────────────────────────────

/**
 * AIParallelStepGroup — a set of steps that can run concurrently.
 *
 * Built by the plan runner using topological depth analysis.
 * Steps at the same depth with no cross-dependencies form a group.
 */
export interface AIParallelStepGroup {
  group_id:              string;
  /** step_ids of steps that can run concurrently in this group. */
  step_ids:              string[];
  /** group_ids that must complete before this group may start. */
  depends_on_group_ids:  string[];
  /** Depth in the dependency graph (0 = no dependencies). */
  depth:                 number;
  /** True if at least one step in this group has is_parallel: true. */
  can_execute_parallel:  boolean;
  /** Respects the plan's max_parallel_steps policy. */
  effective_parallelism: number;
}

// ─── Failure strategy event ───────────────────────────────────────────────────

export type AIFailureStrategyEventType =
  | "retry_would_trigger"           // A step failure would schedule a retry
  | "retry_would_exhaust"           // All retries would be exhausted — step would fail
  | "timeout_would_trigger"         // Step would exceed step_timeout_ms
  | "plan_timeout_would_trigger"    // Plan would exceed plan_timeout_ms
  | "fallback_would_activate"       // Primary provider failure would trigger fallback
  | "partial_completion_accepted"   // Optional step failure — plan can still succeed
  | "cancellation_would_stop"       // Cancellation token would halt this step
  | "approval_gate_timeout_would_trigger"; // Approval gate would time out

/**
 * AIFailureStrategyEvent — simulated failure event from dry-run validation.
 *
 * These represent HYPOTHETICAL events, not actual failures.
 */
export interface AIFailureStrategyEvent {
  event_type:    AIFailureStrategyEventType;
  step_id:       string | null;
  plan_id:       string;
  /** Contextual data explaining the simulated event. */
  details:       Record<string, unknown>;
  /** Always true — these are simulated events, not actual failures. */
  dry_run:       true;
  occurred_at:   string;
}

// ─── Runtime context ──────────────────────────────────────────────────────────

/**
 * AIOrchestratorRuntimeContext — complete runtime scope for one plan execution.
 *
 * Assembled by the plan runner from the request + pre-validated dealer state.
 * dealer_id must come from getCurrentDealer() at the server action layer.
 */
export interface AIOrchestratorRuntimeContext {
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  plan:              AIExecutionPlan;
  policy:            AIExecutionPolicy;
  failure_strategy:  AIFailureStrategyBundle;
  execution_mode:    AIRuntimeExecutionMode;
  /** Active AppFeatures for this dealer, pre-loaded from DB by the server action. */
  active_features:   AppFeature[];
  /** In-memory key-value store for inter-step data exchange. */
  step_outputs:      Record<string, unknown>;
  trace_id:          string;
  created_at:        string;
}

// ─── Runtime request ──────────────────────────────────────────────────────────

/**
 * AIOrchestratorRuntimeRequest — input to the plan runner.
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 * active_features must be pre-loaded from the DB by the calling server action.
 */
export interface AIOrchestratorRuntimeRequest {
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  workflow_id:       AIOrchestrationWorkflowId;
  trigger_event:     string;
  trigger_payload:   Record<string, unknown>;
  /** Only "dry_run" is available in Sprint 11K. "live" is Sprint 11L. */
  execution_mode:    "dry_run";
  /** Active AppFeatures for this dealer — loaded by the calling server action. */
  active_features:   AppFeature[];
  policy_overrides?: Partial<AIExecutionPolicy>;
  /** Caller-provided trace ID for observability. */
  trace_id?:         string;
}

// ─── AIOrchestratorStepRunner interface ──────────────────────────────────────

/**
 * AIOrchestratorStepRunner — validates and processes a single plan step.
 */
export interface AIOrchestratorStepRunner {
  readonly execution_mode: AIRuntimeExecutionMode;

  /** Validate dependencies, feature gates, and build a bridge request for one step. */
  runStep(
    step:               import("../orchestrator-types").AIExecutionStep,
    context:            AIOrchestratorRuntimeContext,
    completed_step_ids: Set<string>,
    now:                string,
  ): AIOrchestratorStepResult;
}

// ─── AIOrchestratorPlanRunner interface ───────────────────────────────────────

/**
 * AIOrchestratorPlanRunner — orchestrates all steps in an execution plan.
 */
export interface AIOrchestratorPlanRunner {
  readonly execution_mode: AIRuntimeExecutionMode;

  /** Execute the full plan dry-run and return a complete result. */
  runPlan(
    request: AIOrchestratorRuntimeRequest,
    plan_id: string,
    now:     string,
  ): AIOrchestratorRuntimeResult;
}

// ─── Runtime result ───────────────────────────────────────────────────────────

/**
 * AIOrchestratorRuntimeResult — complete output from one plan dry-run.
 */
export interface AIOrchestratorRuntimeResult {
  plan_id:                    string;
  /** Always from getCurrentDealer(). */
  dealer_id:                  string;
  workflow_id:                AIOrchestrationWorkflowId;
  execution_mode:             AIRuntimeExecutionMode;
  overall_status:             AIExecutionStatus;
  step_results:               AIOrchestratorStepResult[];
  parallel_groups:            AIParallelStepGroup[];
  /** step_ids where dealer approval is required before continuing. */
  approval_gates_pending:     string[];
  /** In-memory cross-agent data exchanges that would occur. */
  cross_feed_exchanges:       import("./cross-agent-feed").AICrossAgentFeedExchange[];
  /** Simulated failure events from structural failure strategy validation. */
  failure_strategy_events:    AIFailureStrategyEvent[];
  steps_validated:            number;
  steps_blocked:              number;
  steps_skipped:              number;
  /** True — no real AI execution in Sprint 11K. */
  dry_run:                    true;
  plan_built_at:              string;
  completed_at:               string;
}
