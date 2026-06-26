// DealerOS — AI Orchestration Engine: Core Domain Types (Sprint 11J Phase A)
//
// Canonical type layer for the AI Orchestration Engine.
// The orchestrator is the single coordination layer for all AI agents in the system.
//
// Design rules (non-negotiable):
//   - dealer_id ALWAYS comes from getCurrentDealer() in server-side consumers
//   - The orchestrator never performs AI inference directly
//   - All agent calls route through the AI Gateway — no direct provider access
//   - execution_deferred: true is a literal type — prevents accidental execution bypass
//   - requires_gateway: true is a literal type — prevents direct agent coupling
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }  from "@/lib/ai/agents/types";
import type { AITaskType } from "@/lib/ai/types";

// ─── Orchestration workflow identifiers ───────────────────────────────────────

/**
 * AIOrchestrationWorkflowId — canonical identifiers for all multi-agent workflows.
 *
 * Each workflow defines a coordinated sequence of agent tasks.
 * Triggered by CE events, manual dealer action, or scheduled timers.
 */
export type AIOrchestrationWorkflowId =
  | "work_to_social_content"     // WORK_COMPLETED → content project → AI enrichment → publish
  | "work_to_review_request"     // WORK_COMPLETED → LINE review request via review_agent + line_agent
  | "work_to_reputation_report"  // WORK_COMPLETED → reputation impact analysis
  | "periodic_growth_analysis"   // Scheduled: growth_agent analyzes KPIs and generates recommendations
  | "periodic_reputation_scan"   // Scheduled: reputation_agent scans and scores all reviews
  | "line_workflow_execution"    // LINE automation trigger → line_agent message generation
  | "monthly_business_report"    // Scheduled: comprehensive monthly BI report across all agents
  | "seo_batch_optimization";    // Scheduled: seo_agent refreshes SEO/MEO content metadata

// ─── Step and plan status ─────────────────────────────────────────────────────

/**
 * AIExecutionStepStatus — lifecycle state of a single orchestration step.
 */
export type AIExecutionStepStatus =
  | "pending"               // Not yet started
  | "awaiting_dependency"   // Blocked until a depends_on step completes
  | "running"               // Currently executing via AI Gateway
  | "complete"              // Finished successfully
  | "failed"                // Finished with an error
  | "skipped"               // Skipped due to policy or optional flag
  | "cancelled"             // Cancelled mid-run
  | "deferred";             // Requires a future phase capability

/**
 * AIExecutionStatus — lifecycle state of an entire execution plan.
 */
export type AIExecutionStatus =
  | "pending"                    // Plan created, not started
  | "planning"                   // Orchestrator is resolving the step graph
  | "running"                    // At least one step is running
  | "paused_awaiting_approval"   // Stopped at a dealer approval gate
  | "complete"                   // All required steps finished successfully
  | "partially_complete"         // Some optional steps failed; required steps passed
  | "failed"                     // A required step failed and retries exhausted
  | "cancelled";                 // Cancelled by dealer or system

// ─── Execution step ───────────────────────────────────────────────────────────

/**
 * AIExecutionStep — one atomic unit of work within an execution plan.
 *
 * Each step maps to one agent task. Dependency ordering is explicit via depends_on.
 * Parallel steps have identical depends_on sets.
 */
export interface AIExecutionStep {
  step_id:                    string;
  /** Agent responsible for this step. Always a valid AIAgentId. */
  agent_id:                   AIAgentId;
  task_type:                  AITaskType;
  label:                      string;
  /** step_ids that must reach "complete" before this step may run. */
  depends_on:                 string[];
  /** True if this step can run concurrently with its sibling depends_on steps. */
  is_parallel:                boolean;
  /** True if failure does not block downstream steps — pipeline continues. */
  is_optional:                boolean;
  /** True if the dealer must review this step's output before the next step runs. */
  requires_dealer_approval:   boolean;
  /** True if this step produces content visible to the end customer. */
  is_customer_facing:         boolean;
  /** Override the plan-level timeout for this step. null = use plan default. */
  timeout_override_ms:        number | null;
  status:                     AIExecutionStepStatus;
  /** Input variable names consumed from the execution context. */
  input_keys:                 string[];
  /** Output variable names this step writes to the execution context. */
  output_keys:                string[];
  /** Always true in Sprint 11J — no AI inference triggered. */
  execution_deferred:         true;
}

// ─── Execution plan ───────────────────────────────────────────────────────────

/**
 * AIExecutionPlan — the full resolved step graph for one orchestration run.
 *
 * Plans are immutable once created. A new plan is created for each trigger event.
 * dealer_id must always come from getCurrentDealer() in server-side plan builders.
 */
export interface AIExecutionPlan {
  plan_id:               string;
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:             string;
  workflow_id:           AIOrchestrationWorkflowId;
  trigger_event:         string;
  trigger_payload:       Record<string, unknown>;
  steps:                 AIExecutionStep[];
  total_steps:           number;
  /** Literal true — all agent calls must go through AI Gateway, never direct. */
  requires_gateway:      true;
  /** Always true in Sprint 11J — no execution runs. */
  execution_deferred:    true;
  planned_at:            string;
}

// ─── Execution context ────────────────────────────────────────────────────────

/**
 * AIExecutionContext — runtime scope passed to every step during execution.
 *
 * dealer_id must always come from getCurrentDealer().
 * Separate from AIAgentContext — the orchestration context includes plan scope.
 */
export interface AIExecutionContext {
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  plan_id:            string;
  workflow_id:        AIOrchestrationWorkflowId;
  trace_id:           string;
  trigger_event:      string;
  trigger_payload:    Record<string, unknown>;
  /** Shared key-value store for inter-step data exchange within a plan. */
  step_outputs:       Record<string, unknown>;
  created_at:         string;
}

// ─── Execution policy ─────────────────────────────────────────────────────────

/**
 * AIExecutionPolicy — constraints applied to every orchestration run.
 *
 * Policies are dealer-scoped and stored with the dealer's AI settings.
 */
export interface AIExecutionPolicy {
  /** Maximum number of steps allowed to run in parallel. */
  max_parallel_steps:                       number;
  /** Per-step timeout in milliseconds. 0 = unlimited. */
  step_timeout_ms:                          number;
  /** Total plan timeout in milliseconds. 0 = unlimited. */
  plan_timeout_ms:                          number;
  /** Maximum retries per step on transient failure. */
  max_retries_per_step:                     number;
  /** Whether the plan may succeed with only required steps complete. */
  allow_partial_completion:                 boolean;
  /** Literal true — dealer approval is always required before any dispatch. */
  require_dealer_approval_before_dispatch:  true;
  /** Whether to pause the plan when a step produces customer-facing output. */
  pause_on_customer_facing_output:          boolean;
}

// ─── Execution result ─────────────────────────────────────────────────────────

/**
 * AIExecutionResult — outcome record for a completed or failed execution plan.
 *
 * Created when the plan reaches a terminal state (complete / failed / cancelled).
 */
export interface AIExecutionResult {
  plan_id:              string;
  /** Always from getCurrentDealer(). */
  dealer_id:            string;
  workflow_id:          AIOrchestrationWorkflowId;
  status:               AIExecutionStatus;
  steps_total:          number;
  steps_complete:       number;
  steps_failed:         number;
  steps_skipped:        number;
  error_step_ids:       string[];
  started_at:           string | null;
  completed_at:         string | null;
  duration_ms:          number | null;
  /** Always true in Sprint 11J — no real execution. */
  execution_deferred:   true;
}

// ─── Execution history ────────────────────────────────────────────────────────

/**
 * AIExecutionHistoryEntry — lightweight summary of one completed plan.
 */
export interface AIExecutionHistoryEntry {
  plan_id:          string;
  workflow_id:      AIOrchestrationWorkflowId;
  status:           AIExecutionStatus;
  steps_complete:   number;
  steps_total:      number;
  triggered_at:     string;
  completed_at:     string | null;
  duration_ms:      number | null;
}

/**
 * AIExecutionHistory — ordered log of all orchestration runs for a dealer.
 *
 * dealer_id must always come from getCurrentDealer().
 * Storage in dealer_ai_execution_log requires a future CTO-approved migration.
 */
export interface AIExecutionHistory {
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  entries:            AIExecutionHistoryEntry[];
  total_runs:         number;
  successful_runs:    number;
  failed_runs:        number;
  last_run_at:        string | null;
  /** Always true in Sprint 11J — no persistence layer yet. */
  execution_deferred: true;
}

// ─── Orchestrator capability ──────────────────────────────────────────────────

/**
 * AIExecutionCapabilityId — capabilities the orchestration engine declares.
 */
export type AIExecutionCapabilityId =
  | "sequential_execution"      // Run steps one after another based on depends_on order
  | "parallel_execution"        // Run independent steps concurrently
  | "conditional_branching"     // Skip or alter steps based on prior step output
  | "fan_out_fan_in"            // One trigger spawns multiple agent streams, then merges
  | "retry_with_backoff"        // Retry failed steps with exponential backoff
  | "fallback_provider"         // Retry on alternate AI provider when primary fails
  | "partial_completion"        // Succeed with subset of steps if required steps pass
  | "dealer_approval_gate"      // Pause plan at checkpoint requiring explicit dealer sign-off
  | "cross_agent_feed"          // Pass output from one agent as input to another via gateway
  | "usage_tracking";           // Record token usage and cost per step to dealer_ai_usage_log

/**
 * AIExecutionCapability — metadata for a single orchestrator capability.
 */
export interface AIExecutionCapability {
  id:               AIExecutionCapabilityId;
  label:            string;
  description:      string;
  /** True if the capability is usable in the current sprint. */
  available:        boolean;
  /** Sprint in which this capability became available. null if not yet available. */
  available_since:  string | null;
  /** Sprint in which this capability is planned. null if already available. */
  deferred_until:   string | null;
}

// ─── Orchestrator descriptor ──────────────────────────────────────────────────

/**
 * AIOrchestrator — static descriptor of the AI Orchestration Engine.
 *
 * Describes what the orchestrator supports, its constraints, and its identity.
 * This is a configuration object — not a runtime instance.
 */
export interface AIOrchestrator {
  /** Semantic version of the orchestration engine. */
  version:                   string;
  capabilities:              AIExecutionCapability[];
  registered_workflow_ids:   AIOrchestrationWorkflowId[];
  /** Maximum number of concurrent execution plans per dealer. */
  max_concurrent_plans:      number;
  /** Literal true — orchestrator only communicates via AI Gateway. */
  gateway_required:          true;
  /** Literal true — no execution in Sprint 11J. */
  execution_deferred:        true;
  /** Sprint in which real execution will be enabled. */
  execution_target_sprint:   string;
}

// ─── Orchestrator capability registry ────────────────────────────────────────

export const ORCHESTRATOR_CAPABILITY_REGISTRY: AIExecutionCapability[] = [
  {
    id:              "sequential_execution",
    label:           "Sequential Step Execution",
    description:     "Run steps in dependency order, one after another",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "parallel_execution",
    label:           "Parallel Step Execution",
    description:     "Run independent steps concurrently to minimize total plan time",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "conditional_branching",
    label:           "Conditional Branching",
    description:     "Skip or redirect steps based on prior step output or policy",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11L",
  },
  {
    id:              "fan_out_fan_in",
    label:           "Fan-out / Fan-in",
    description:     "Broadcast one trigger to multiple agents, then merge results",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11L",
  },
  {
    id:              "retry_with_backoff",
    label:           "Retry with Exponential Backoff",
    description:     "Automatically retry failed steps with increasing delay",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "fallback_provider",
    label:           "Fallback AI Provider",
    description:     "Switch to an alternate AI provider when the primary fails",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11L",
  },
  {
    id:              "partial_completion",
    label:           "Partial Plan Completion",
    description:     "Succeed when all required steps pass, even if optional steps fail",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "dealer_approval_gate",
    label:           "Dealer Approval Gate",
    description:     "Pause execution at checkpoints requiring explicit dealer sign-off",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "cross_agent_feed",
    label:           "Cross-Agent Data Feed",
    description:     "Pass structured output from one agent as input to the next via gateway",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K",
  },
  {
    id:              "usage_tracking",
    label:           "Per-Step Usage Tracking",
    description:     "Record token count and estimated cost per step to dealer_ai_usage_log",
    available:       false,
    available_since: null,
    deferred_until:  "Sprint 11K (requires CTO-approved migration)",
  },
];

// ─── Orchestrator descriptor constant ─────────────────────────────────────────

export const AI_ORCHESTRATOR: AIOrchestrator = {
  version:                 "0.1.0-foundation",
  capabilities:            ORCHESTRATOR_CAPABILITY_REGISTRY,
  registered_workflow_ids: [
    "work_to_social_content",
    "work_to_review_request",
    "work_to_reputation_report",
    "periodic_growth_analysis",
    "periodic_reputation_scan",
    "line_workflow_execution",
    "monthly_business_report",
    "seo_batch_optimization",
  ],
  max_concurrent_plans:    3,
  gateway_required:        true,
  execution_deferred:      true,
  execution_target_sprint: "Sprint 11K",
};

// ─── Default execution policy ─────────────────────────────────────────────────

export const DEFAULT_EXECUTION_POLICY: AIExecutionPolicy = {
  max_parallel_steps:                       3,
  step_timeout_ms:                          30_000,
  plan_timeout_ms:                          120_000,
  max_retries_per_step:                     2,
  allow_partial_completion:                 true,
  require_dealer_approval_before_dispatch:  true,
  pause_on_customer_facing_output:          true,
};

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * buildExecutionStep — creates a single deferred execution step.
 * dealer_id is on the parent AIExecutionPlan — not repeated per step.
 */
export function buildExecutionStep(
  step_id:                  string,
  agent_id:                 AIAgentId,
  task_type:                AITaskType,
  label:                    string,
  options: {
    depends_on?:              string[];
    is_parallel?:             boolean;
    is_optional?:             boolean;
    requires_dealer_approval?: boolean;
    is_customer_facing?:      boolean;
    timeout_override_ms?:     number | null;
    input_keys?:              string[];
    output_keys?:             string[];
  } = {},
): AIExecutionStep {
  return {
    step_id,
    agent_id,
    task_type,
    label,
    depends_on:               options.depends_on                ?? [],
    is_parallel:              options.is_parallel               ?? false,
    is_optional:              options.is_optional               ?? false,
    requires_dealer_approval: options.requires_dealer_approval  ?? false,
    is_customer_facing:       options.is_customer_facing        ?? false,
    timeout_override_ms:      options.timeout_override_ms       ?? null,
    input_keys:               options.input_keys                ?? [],
    output_keys:              options.output_keys               ?? [],
    status:                   "deferred",
    execution_deferred:       true,
  };
}

/**
 * buildExecutionPlan — creates a deferred execution plan.
 * dealer_id must come from getCurrentDealer() — never pass from client input.
 */
export function buildExecutionPlan(
  plan_id:         string,
  dealer_id:       string,
  workflow_id:     AIOrchestrationWorkflowId,
  trigger_event:   string,
  trigger_payload: Record<string, unknown>,
  steps:           AIExecutionStep[],
  planned_at:      string,
): AIExecutionPlan {
  return {
    plan_id,
    dealer_id,
    workflow_id,
    trigger_event,
    trigger_payload,
    steps,
    total_steps:        steps.length,
    requires_gateway:   true,
    execution_deferred: true,
    planned_at,
  };
}

/**
 * buildExecutionResult — creates a deferred result record.
 * dealer_id must come from getCurrentDealer().
 */
export function buildExecutionResult(
  plan:    AIExecutionPlan,
): AIExecutionResult {
  return {
    plan_id:            plan.plan_id,
    dealer_id:          plan.dealer_id,
    workflow_id:        plan.workflow_id,
    status:             "pending",
    steps_total:        plan.total_steps,
    steps_complete:     0,
    steps_failed:       0,
    steps_skipped:      0,
    error_step_ids:     [],
    started_at:         null,
    completed_at:       null,
    duration_ms:        null,
    execution_deferred: true,
  };
}

/**
 * buildEmptyHistory — creates an empty execution history record.
 * dealer_id must come from getCurrentDealer().
 */
export function buildEmptyHistory(dealer_id: string): AIExecutionHistory {
  return {
    dealer_id,
    entries:            [],
    total_runs:         0,
    successful_runs:    0,
    failed_runs:        0,
    last_run_at:        null,
    execution_deferred: true,
  };
}
