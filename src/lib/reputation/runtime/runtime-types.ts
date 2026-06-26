// DealerOS — Reputation Agent Runtime: Type Definitions
//
// Sprint 11D Phase A: all domain types for the Reputation Agent runtime layer.
//
// These types describe the runtime execution model without referencing
// server-side utilities. Safe to import from both server and shared modules.
//
// Dependency chain (no circular imports):
//   runtime-types → @/lib/ai/agents/types, @/lib/ai/types,
//                    @/lib/ai/ai-settings-types,
//                    @/lib/reputation/reputation-types,
//                    @/lib/reputation/reputation-profile

import type { AIAgentContext }             from "@/lib/ai/agents/types";
import type { AIProviderId, AITaskType }    from "@/lib/ai/types";
import type { AIGatewayStatus }             from "@/lib/ai/ai-settings-types";
import type { ReviewDestination }           from "@/lib/reputation/reputation-types";
import type { ReputationPolicy }            from "@/lib/reputation/reputation-profile";

// ─── Execution context ────────────────────────────────────────────────────────

/**
 * ReputationExecutionContext — wraps AIAgentContext with reputation-specific state.
 *
 * Built by ReputationRuntime.create() in reputation-runtime.ts.
 * dealer_id is always mirrored from agent_context, which is populated by
 * createAgentContext() → getCurrentDealer() — never from client input.
 */
export interface ReputationExecutionContext {
  agent_context:               AIAgentContext;
  /** Mirrored from agent_context.dealer_id for ergonomic access. */
  dealer_id:                   string;
  feature_access: {
    ai_gateway:    boolean;
    ai_reputation: boolean;
  };
  /** True if the dealer has initialized reputation settings and at least one destination. */
  reputation_profile_available: boolean;
  /** Primary review destination — null if not yet configured by the dealer. */
  primary_destination:          ReviewDestination | null;
  reputation_policy:            ReputationPolicy;
  /** UUID per runtime invocation. Linked to agent_context.trace_id. */
  runtime_trace_id:             string;
  prepared_at:                  string;  // ISO 8601
}

// ─── Execution request ────────────────────────────────────────────────────────

/**
 * ReputationExecutionRequest — caller-provided input for a single dry-run.
 *
 * dealer_id is intentionally absent — always injected via execution context.
 */
export interface ReputationExecutionRequest {
  task_type:             AITaskType;
  customer_id:           string;
  vehicle_id?:           string;
  work_order_id:         string;
  completion_report_id?: string;
  service_summary:       string;
  destination:           ReviewDestination;
  language_preference:   "ja" | "en";
  trace_id?:             string;
}

// ─── Execution result ─────────────────────────────────────────────────────────

/**
 * Overall execution state returned by ReputationRuntime.execute().
 *
 * "ready"              — All checks passed; action plan built; awaiting dealer approval
 * "not_ready"          — One or more required workflow checks failed
 * "blocked_compliance" — Compliance guard raised a blocking violation
 * "blocked_gateway"    — AI Gateway not ready for this dealer
 * "dry_run"            — Execution deferred as designed (Sprint 11D baseline)
 */
export type ReputationExecutionState =
  | "ready"
  | "not_ready"
  | "blocked_compliance"
  | "blocked_gateway"
  | "dry_run";

/**
 * ReputationExecutionResult — full output of a reputation runtime dry-run.
 *
 * dealer_approval_required and execution_deferred are permanently typed as
 * literal `true` — they cannot be overridden in any future version without
 * explicit architectural review.
 */
export interface ReputationExecutionResult {
  state:                    ReputationExecutionState;
  /** Always from getCurrentDealer() via execution context. */
  dealer_id:                string;
  task_type:                AITaskType;
  readiness_checks:         ReputationReadinessCheck[];
  all_checks_passed:        boolean;
  action_plan:              ReputationActionPlan | null;
  blocking_reasons:         string[];
  warnings:                 string[];
  /** Permanently true — no action proceeds without dealer approval. */
  dealer_approval_required: true;
  /** Always true in Sprint 11D — AI execution deferred to Phase 11E+. */
  execution_deferred:       true;
  prepared_at:              string;  // ISO 8601
}

// ─── Readiness checks ─────────────────────────────────────────────────────────

/**
 * All check names used across Phase A (runtime) and Phase B (gateway).
 *
 * Gateway checks (Phase B): ai_gateway_feature … feature_capability_support
 * Workflow checks (Phase A/C): destination_configured, customer_eligible, compliance_guard_passed
 */
export type ReputationReadinessCheckName =
  | "ai_gateway_feature"
  | "ai_reputation_feature"
  | "provider_configured"
  | "provider_enabled"
  | "api_key_configured"
  | "dealer_provider_policy"
  | "usage_policy_available"
  | "feature_capability_support"
  | "destination_configured"
  | "customer_eligible"
  | "compliance_guard_passed";

export type ReputationReadinessCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "skipped";

export interface ReputationReadinessCheck {
  name:     ReputationReadinessCheckName;
  status:   ReputationReadinessCheckStatus;
  blocking: boolean;
  message:  string;
}

// ─── Action plan ──────────────────────────────────────────────────────────────

/**
 * Metadata describing the prompt that WOULD be sent to the AI provider.
 * No actual prompt content is generated in Sprint 11D.
 * Populated by Phase 11E+ when the AI provider adapter is built.
 */
export interface ReputationPromptMetadata {
  task_type:               AITaskType;
  /** Provider selected by the dealer's gateway routing config. Null until Phase 11E+. */
  recommended_provider:    AIProviderId | null;
  /** Conservative token estimate for planning purposes. */
  estimated_tokens:        number;
  /** Template ID used by the provider adapter to construct the actual system prompt. */
  system_prompt_template:  string;
  /** Context fields required before the prompt can be built. */
  required_context_fields: string[];
  language:                "ja" | "en";
}

export type ReputationActionStepStatus = "ready" | "missing" | "deferred";

export interface ReputationActionStep {
  step:        string;
  description: string;
  status:      ReputationActionStepStatus;
  blocking:    boolean;
}

export interface ReputationComplianceCheckItem {
  rule:        string;
  description: string;
  status:      "enforced" | "pending_review";
}

/**
 * ReputationActionPlan — documents what would happen when dealer approves and
 * the AI provider adapter is available (Phase 11E+).
 *
 * Contains no AI-generated output.
 * dealer_approval_required and execution_deferred are permanently true.
 */
export interface ReputationActionPlan {
  /** Always from getCurrentDealer() via execution context. */
  dealer_id:                string;
  task_type:                AITaskType;
  /** UUID per action plan invocation. */
  action_id:                string;
  estimated_ready:          boolean;
  steps:                    ReputationActionStep[];
  prompt_metadata:          ReputationPromptMetadata;
  compliance_checklist:     ReputationComplianceCheckItem[];
  /** Settings the dealer must configure before execution is possible. */
  missing_settings:         string[];
  dealer_approval_required: true;
  execution_deferred:       true;
}

// ─── Gateway readiness ────────────────────────────────────────────────────────

/**
 * ReputationGatewayReadiness — typed result from checkReputationGatewayReadiness() (Phase B).
 * Wraps the 8 structured gateway checks.
 */
export interface ReputationGatewayReadiness {
  overall:        "ready" | "not_ready";
  gateway_status: AIGatewayStatus;
  provider:       AIProviderId | null;
  checks:         ReputationReadinessCheck[];
  blocking_count: number;
  checked_at:     string;  // ISO 8601
}

// ─── Compliance guard ─────────────────────────────────────────────────────────

export interface ComplianceViolation {
  rule:        string;
  description: string;
  blocking:    boolean;
}

/**
 * ReputationComplianceGuardResult — full compliance check result for the runtime.
 *
 * Extends the text-pattern check in review-draft.ts to cover workflow-level
 * compliance invariants (selective targeting, incentives, auto-posting, etc.).
 */
export interface ReputationComplianceGuardResult {
  passed:         boolean;
  violations:     ComplianceViolation[];
  blocking_count: number;
  checklist:      ReputationComplianceCheckItem[];
  checked_at:     string;  // ISO 8601
}
