// DealerOS — AI Orchestration Engine: Live Runtime Bridge Types (Sprint 11L Phase A)
//
// Types for the Live Runtime Bridge — the first production-ready execution layer.
//
// Sprint 11L delivers:
//   - Agent lifecycle initialization (agent.initialize()) for all 7 registered agents
//   - Gateway readiness checks per step
//   - Capability discovery and next-action derivation
//   - In-memory approval gate pausing (no persistence)
//
// Sprint 11M delivers:
//   - Real AI provider execution (agent.execute() via AI Gateway)
//   - Execution history persistence (dealer_ai_execution_log — CTO approval required)
//
// Security rules (non-negotiable):
//   - dealer_id ALWAYS from getCurrentDealer() — never from client input
//   - AIAgentContext pre-built by the calling server action before entering the bridge
//   - The bridge never imports any AI provider SDK
//   - No API key fields anywhere in these types
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AppFeature }                    from "@/lib/plans/plan-types";
import type { AIAgentId, AIAgentContext }      from "@/lib/ai/agents/types";
import type { AITaskType }                     from "@/lib/ai/types";
import type { AICapability }                   from "@/lib/ai/capabilities";
import type {
  AIOrchestrationWorkflowId,
  AIExecutionPolicy,
}                                              from "../orchestrator-types";
import type { AIProviderExecutionGuardResult } from "../provider-execution/execution-readiness-types";

// ─── Bridge execution state ───────────────────────────────────────────────────

/**
 * AIExecutionBridgeState — lifecycle state of one step as it moves through the bridge.
 *
 * Unlike AIExecutionStepStatus (orchestrator layer), this state tracks the
 * lifecycle preparation sequence for the live bridge.
 */
export type AIExecutionBridgeState =
  | "pending"             // Step not yet started in the bridge
  | "preparing"           // agent.initialize() is running
  | "ready"               // initialize() succeeded; validation passed; no approval gate
  | "awaiting_approval"   // Stopped at dealer approval gate — plan must not continue
  | "completed"           // All bridge preparation done (Sprint 11M: execute() complete)
  | "failed"              // initialize() failed or validation blocked
  | "cancelled";          // Cancelled before bridge reached this step

// ─── Bridge context ───────────────────────────────────────────────────────────

/**
 * AIExecutionBridgeContext — scope for one step's bridge execution.
 *
 * Assembled by the plan bridge runner from the live runtime request.
 * agent_context must be pre-built by the calling server action.
 */
export interface AIExecutionBridgeContext {
  execution_id:   string;
  /** Always from getCurrentDealer(). */
  dealer_id:      string;
  plan_id:        string;
  step_id:        string;
  workflow_id:    AIOrchestrationWorkflowId;
  trace_id:       string;
  execution_mode: "live";
  /** Pre-built by the calling server action — never constructed in the bridge. */
  agent_context:  AIAgentContext;
  /** Step input data resolved from plan step_outputs (null in Sprint 11L). */
  input_payload:  Record<string, unknown>;
  /**
   * Active AppFeatures for this dealer — pre-loaded from DB by the calling server action.
   * Used by the provider execution guard (Sprint 11M) to verify feature gates.
   * Mirrors AILiveRuntimeRequest.active_features.
   */
  active_features: AppFeature[];
}

// ─── Bridge policy ────────────────────────────────────────────────────────────

/**
 * AIExecutionBridgePolicy — controls what the bridge does for each step.
 *
 * run_validate and run_execute are both false in Sprint 11L — the bridge
 * performs lifecycle initialization only. AI execution is Sprint 11M+.
 */
export interface AIExecutionBridgePolicy {
  /** Whether to call agent.initialize(). Should always be true. */
  run_initialize:             boolean;
  /**
   * Always false in Sprint 11L — validation requires real task input data.
   * Set to true in Sprint 11M when real trigger payloads are available.
   */
  run_validate:               false;
  /**
   * Always false in Sprint 11L — provider execution is Sprint 11M+.
   * Prevents accidental AI inference from being wired in.
   */
  run_execute:                false;
  /** Whether to stop the plan chain when a step requires dealer approval. */
  pause_on_approval_required: boolean;
}

export const DEFAULT_BRIDGE_POLICY: AIExecutionBridgePolicy = {
  run_initialize:             true,
  run_validate:               false,
  run_execute:                false,
  pause_on_approval_required: true,
};

// ─── Capability summary ───────────────────────────────────────────────────────

/**
 * AICapabilitySummary — what a specific agent offers for a specific task.
 *
 * Derived from AI_AGENT_REGISTRY at bridge execution time.
 */
export interface AICapabilitySummary {
  agent_id:               AIAgentId;
  agent_name:             string;
  task_type:              AITaskType;
  required_feature:       AppFeature;
  /** Provider-level capabilities the agent requires to function. */
  required_provider_caps: AICapability[];
  /** All task types this agent supports. */
  supported_task_types:   AITaskType[];
}

// ─── Next actions ─────────────────────────────────────────────────────────────

/**
 * AIExecutionNextAction — what should happen after this step result.
 *
 * Multiple next actions may apply simultaneously (e.g., approval + no_provider).
 */
export type AIExecutionNextAction =
  | "submit_for_approval"            // Dealer must review and approve this step
  | "await_provider_configuration"   // Dealer has no AI provider configured
  | "ready_for_dispatch"             // Step is ready to execute in Phase 11M+
  | "retry_with_different_input"     // Initialization failed — caller should retry
  | "check_feature_activation";      // Required AppFeature is not active for this dealer

// ─── Bridge result (Phase D payload) ─────────────────────────────────────────

/**
 * AIExecutionBridgeResult — the canonical output payload for one step's bridge execution.
 *
 * Contains everything needed to determine what happens next in the plan.
 * No raw API keys, no provider internals.
 */
export interface AIExecutionBridgeResult {
  /** Unique identifier for this bridge execution attempt. */
  execution_id:          string;
  agent_id:              AIAgentId;
  execution_state:       AIExecutionBridgeState;
  capability_summary:    AICapabilitySummary;
  next_actions:          AIExecutionNextAction[];
  /** True if dealer must approve this step's output before the plan continues. */
  approval_required:     boolean;
  /** True if the dealer has an AI provider configured and gateway is ready. */
  provider_ready:        boolean;
  /** True if agent.initialize() completed without error. */
  initialize_succeeded:  boolean;
  /**
   * User-readable error message (Japanese). Set when execution_state === "failed".
   * Never includes internal error details, stack traces, or API key fragments.
   */
  error_message:         string | null;
  /** ISO 8601 timestamp when this bridge result was built. */
  execution_timestamp:   string;
  /**
   * Provider execution readiness check result (Sprint 11M).
   * null for skipped or structurally blocked steps that never reach the guard.
   * Present on all lifecycle-prepared steps — decision is "deny" in Sprint 11M
   * (run_execute is false) and "allow" once Sprint 11N+ wires real execution.
   */
  readiness_check:       AIProviderExecutionGuardResult | null;
}

// ─── Per-step live bridge result ──────────────────────────────────────────────

/**
 * AIStepBridgeResult — combined result for one step in a live plan run.
 *
 * Wraps `AIExecutionBridgeResult` with orchestration context (parallel group,
 * step metadata).
 */
export interface AIStepBridgeResult {
  step_id:           string;
  agent_id:          AIAgentId;
  task_type:         AITaskType;
  label:             string;
  bridge_result:     AIExecutionBridgeResult;
  execution_state:   AIExecutionBridgeState;
  parallel_group_id: string | null;
  processed_at:      string;
}

// ─── Approval pause record ────────────────────────────────────────────────────

/**
 * AIApprovalPauseRecord — in-memory snapshot of a paused plan at an approval gate.
 *
 * No persistence — the record exists only for the lifetime of the server request.
 * Sprint 11M will persist this to dealer_ai_execution_log (CTO approval required).
 */
export interface AIApprovalPauseRecord {
  plan_id:          string;
  /** Always from getCurrentDealer(). */
  dealer_id:        string;
  /** step_id where the pause was triggered. */
  paused_at_step:   string;
  agent_id:         AIAgentId;
  /** Step IDs that were NOT reached because the plan stopped here. */
  pending_step_ids: string[];
  bridge_result:    AIExecutionBridgeResult;
  /** False — dealer approval not yet received. */
  resolved:         boolean;
  resolution:       "approved" | "rejected" | null;
  resolved_by:      string | null;
  paused_at:        string;   // ISO 8601
  resolved_at:      string | null;
  /** True — no persistence in Sprint 11L. */
  in_memory_only:   true;
}

// ─── Live plan bridge result ──────────────────────────────────────────────────

/**
 * AIOrchestratorLiveBridgeResult — complete output from one live bridge plan run.
 *
 * Analogous to AIOrchestratorRuntimeResult but for the live execution path.
 */
export interface AIOrchestratorLiveBridgeResult {
  plan_id:                   string;
  /** Always from getCurrentDealer(). */
  dealer_id:                 string;
  workflow_id:               AIOrchestrationWorkflowId;
  execution_mode:            "live";
  overall_state:             AIExecutionBridgeState;
  step_results:              AIStepBridgeResult[];
  /** step_id where the plan was paused for approval. null if no pause occurred. */
  approval_paused_at:        string | null;
  approval_pause_record:     AIApprovalPauseRecord | null;
  steps_prepared:            number;
  steps_awaiting_approval:   number;
  steps_failed:              number;
  steps_skipped:             number;
  plan_built_at:             string;
  completed_at:              string;
}

// ─── Live runtime request ─────────────────────────────────────────────────────

/**
 * AILiveRuntimeRequest — input to the live plan bridge runner.
 *
 * Extends the conceptual structure of AIOrchestratorRuntimeRequest with:
 *   - execution_mode: "live" (not "dry_run")
 *   - agent_context: AIAgentContext pre-built by the calling server action
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 * agent_context must be built by createAgentContext() in the calling server action.
 */
export interface AILiveRuntimeRequest {
  /** Always from getCurrentDealer(). */
  dealer_id:        string;
  workflow_id:      AIOrchestrationWorkflowId;
  trigger_event:    string;
  trigger_payload:  Record<string, unknown>;
  execution_mode:   "live";
  active_features:  AppFeature[];
  /**
   * Pre-built AIAgentContext from createAgentContext() — the bridge reuses this
   * for all agent initialize() calls rather than rebuilding per step.
   */
  agent_context:    AIAgentContext;
  policy_overrides?: Partial<AIExecutionPolicy>;
  bridge_policy?:    Partial<AIExecutionBridgePolicy>;
  trace_id?:         string;
}

// ─── Runtime bridge descriptor ────────────────────────────────────────────────

export type AIRuntimeBridgeCapabilityId =
  | "lifecycle_initialization"       // Call agent.initialize() for all agents (Sprint 11L)
  | "capability_discovery"           // Build AICapabilitySummary per step (Sprint 11L)
  | "gateway_readiness_check"        // Check if provider is configured (Sprint 11L)
  | "approval_gate_pause"            // Pause plan at approval gate (Sprint 11L)
  | "live_ai_execution"              // Call agent.execute() via gateway (Sprint 11M+)
  | "execution_state_persistence";   // Persist AIRuntimeExecutionRecord (Sprint 11M+)

export interface AIRuntimeBridgeCapability {
  id:              AIRuntimeBridgeCapabilityId;
  label:           string;
  available:       boolean;
  available_since: string | null;
  deferred_until:  string | null;
}

export const RUNTIME_BRIDGE_CAPABILITIES: AIRuntimeBridgeCapability[] = [
  { id: "lifecycle_initialization",     label: "Agent Lifecycle Initialization",   available: true,  available_since: "Sprint 11L", deferred_until: null },
  { id: "capability_discovery",         label: "Agent Capability Discovery",        available: true,  available_since: "Sprint 11L", deferred_until: null },
  { id: "gateway_readiness_check",      label: "AI Gateway Readiness Check",        available: true,  available_since: "Sprint 11L", deferred_until: null },
  { id: "approval_gate_pause",          label: "Dealer Approval Gate Pause",        available: true,  available_since: "Sprint 11L", deferred_until: null },
  { id: "live_ai_execution",            label: "Live AI Provider Execution",        available: false, available_since: null,          deferred_until: "Sprint 11M+" },
  { id: "execution_state_persistence",  label: "Execution State Persistence",       available: false, available_since: null,          deferred_until: "Sprint 11M+" },
];

/**
 * AIOrchestratorRuntimeBridge — static descriptor of the live runtime bridge.
 */
export interface AIOrchestratorRuntimeBridge {
  /** Semantic version of the live bridge. */
  version:               string;
  mode:                  "live";
  capabilities:          AIRuntimeBridgeCapability[];
  /** False — AI provider execution is Sprint 11M+. */
  execute_available:     false;
  execute_target_sprint: string;
}

export const AI_ORCHESTRATOR_RUNTIME_BRIDGE: AIOrchestratorRuntimeBridge = {
  version:               "1.0.0-bridge",
  mode:                  "live",
  capabilities:          RUNTIME_BRIDGE_CAPABILITIES,
  execute_available:     false,
  execute_target_sprint: "Sprint 11M+",
};
