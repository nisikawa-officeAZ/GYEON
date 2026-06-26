// DealerOS — AI Orchestration Engine: Provider Execution Readiness Types (Sprint 11M Phase A)
//
// Type definitions for the AI provider execution readiness layer.
//
// This layer validates whether a given agent step MAY execute through a provider.
// It enforces all dealer billing, feature gate, and configuration checks before
// any AI inference is ever allowed to proceed.
//
// Architecture:
//   AIProviderExecutionGuard evaluates AIProviderExecutionContext
//     → returns AIProviderExecutionGuardResult (allow / deny / needs_configuration)
//     → no inference executes without an "allow" result
//
// Security rules (non-negotiable):
//   - dealer_id ALWAYS from getCurrentDealer() — never from client
//   - No raw API keys in any type here or downstream
//   - run_execute must be explicitly true — preventing accidental execution
//   - "deny" and "needs_configuration" are both non-execution outcomes
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AppFeature }           from "@/lib/plans/plan-types";
import type { AIAgentId }            from "@/lib/ai/agents/types";
import type { AITaskType, AIProviderId } from "@/lib/ai/types";
import type { AICapability }         from "@/lib/ai/capabilities";
import type { AIGatewayStatus }      from "@/lib/ai/ai-settings-types";
import type { AIUsagePolicy }        from "@/lib/ai/usage-policy";
import type { AIBudgetGuardState }   from "./budget-guard";

// ─── Guard check identifiers ──────────────────────────────────────────────────

/**
 * AIProviderExecutionCheckId — the 12 ordered checks the execution guard runs.
 *
 * Checks are evaluated in declaration order. The first required check that
 * fails determines the guard decision (deny or needs_configuration).
 */
export type AIProviderExecutionCheckId =
  | "run_execute_flag"                  // 1.  run_execute must be explicitly true
  | "dealer_pro_plus_access"            // 2.  ai_gateway AppFeature must be in active_features
  | "ai_gateway_feature_enabled"        // 3.  gateway.status must not be "not_configured" or "not_pro_plus"
  | "target_agent_feature_enabled"      // 4.  agent's requiredFeature must be in active_features
  | "provider_configured"               // 5.  gateway.provider must be non-null
  | "provider_enabled"                  // 6.  gateway.status must not be "disabled"
  | "encrypted_key_exists"              // 7.  gateway.status must not be "no_key"
  | "capability_supported_by_provider"  // 8.  provider must support all required capabilities
  | "usage_policy_allows"               // 9.  usage policy allows execution (limit not hard-stopped)
  | "monthly_limit_not_exceeded"        // 10. current spend must be below monthly_limit_usd
  | "dealer_billing_acknowledged"       // 11. dealer acknowledges they own the AI billing costs
  | "no_key_exposure_risk";             // 12. structural: no raw API key in the execution context

// ─── Guard decision ───────────────────────────────────────────────────────────

/**
 * AIProviderExecutionDecision — the outcome of the execution guard evaluation.
 */
export type AIProviderExecutionDecision =
  | "allow"                 // All required checks passed — execution is permitted
  | "deny"                  // A blocking check failed — execution must not proceed
  | "needs_configuration";  // A configuration step is required before execution

// ─── Individual check result ──────────────────────────────────────────────────

/**
 * AIProviderExecutionCheckResult — outcome of one guard check evaluation.
 */
export interface AIProviderExecutionCheckResult {
  check_id:  AIProviderExecutionCheckId;
  passed:    boolean;
  /**
   * True if failure of this check blocks execution (decision: deny or needs_configuration).
   * False if failure is a non-blocking warning — execution can proceed with caution.
   */
  required:  boolean;
  /** English description of what was checked and what was found. */
  message:   string;
  /** Additional structured context for diagnostics. No API key data. */
  details:   Record<string, unknown>;
}

// ─── Full guard result ────────────────────────────────────────────────────────

/**
 * AIProviderExecutionGuardResult — outcome of the full 12-check guard evaluation.
 *
 * Returned by checkProviderExecutionReadiness(). Callers must inspect `decision`
 * and not proceed with AI execution unless decision === "allow".
 */
export interface AIProviderExecutionGuardResult {
  decision:                  AIProviderExecutionDecision;
  checks:                    AIProviderExecutionCheckResult[];
  /** ID of the first check that failed (if decision !== "allow"). */
  failed_check:              AIProviderExecutionCheckId | null;
  /** English explanation of why execution was denied. null when decision === "allow". */
  denial_reason:             string | null;
  /**
   * What the dealer needs to do to resolve a "needs_configuration" decision.
   * null when decision !== "needs_configuration".
   */
  configuration_step:        string | null;
  evaluated_at:              string;
}

// ─── Execution context ────────────────────────────────────────────────────────

/**
 * AIProviderExecutionContext — all pre-loaded data the guard needs to evaluate.
 *
 * Assembled by the server action or plan bridge from already-loaded state.
 * The guard itself makes no DB calls or external API calls.
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 */
export interface AIProviderExecutionContext {
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  agent_id:          AIAgentId;
  task_type:         AITaskType;
  /** Resolved from capability-routing.ts for this step's agent + task type. */
  required_caps:     AICapability[];
  /** Active AppFeatures for this dealer — pre-loaded from DB by server action. */
  active_features:   AppFeature[];
  gateway_status:    AIGatewayStatus;
  gateway_provider:  AIProviderId | null;
  usage_policy:      AIUsagePolicy;
  /**
   * Must be explicitly set to true by the calling code before execution is allowed.
   * False in Sprint 11M — no real execution yet.
   * Set to true only when concrete provider adapters are implemented (Sprint 11N+).
   */
  run_execute:       boolean;
}

// ─── Execution request ────────────────────────────────────────────────────────

/**
 * AIProviderExecutionRequest — input to the execution guard.
 */
export interface AIProviderExecutionRequest {
  context:             AIProviderExecutionContext;
  /** Estimated cost for this request — used by budget guard (Phase D). */
  estimated_cost_usd:  number;
}

// ─── Combined execution result ────────────────────────────────────────────────

/**
 * AIProviderExecutionResult — full result including guard and budget state.
 */
export interface AIProviderExecutionResult {
  request:       AIProviderExecutionRequest;
  guard_result:  AIProviderExecutionGuardResult;
  budget_state:  AIBudgetGuardState;
}

// ─── Execution policy ─────────────────────────────────────────────────────────

/**
 * AIProviderExecutionPolicy — governs what conditions the guard enforces.
 *
 * Must be explicitly configured by the calling code. The defaults here
 * are the strictest possible (everything blocked until explicitly unlocked).
 */
export interface AIProviderExecutionPolicy {
  /**
   * Must be explicitly true before any AI provider call is allowed.
   * False in Sprint 11M — prevents any path from accidentally triggering execution.
   */
  run_execute:                      boolean;
  /** Whether to hard-stop on monthly limit reached. */
  enforce_hard_limit:               boolean;
  /** Soft warning threshold (0.0–1.0 fraction of monthly_limit_usd). */
  budget_warning_threshold:         number;
  /**
   * Whether to block execution when the provider's adapter is not yet implemented.
   * False in Sprint 11M — adapters not available.
   */
  require_adapter_available:        boolean;
  /**
   * True when the dealer has explicitly acknowledged that AI inference is billed
   * to their own provider key — not to Office AZ.
   * Confirmed at dealer account setup time.
   */
  dealer_billing_policy_confirmed:  boolean;
}

export const DEFAULT_PROVIDER_EXECUTION_POLICY: AIProviderExecutionPolicy = {
  run_execute:                      false,   // Locked false — must be set to true explicitly
  enforce_hard_limit:               true,
  budget_warning_threshold:         0.8,     // Warn at 80% of monthly limit
  require_adapter_available:        false,   // Adapters not yet implemented
  dealer_billing_policy_confirmed:  true,    // Confirmed at account setup
};

// ─── Readiness descriptor ─────────────────────────────────────────────────────

/**
 * AIProviderExecutionReadiness — static descriptor for the readiness layer.
 */
export interface AIProviderExecutionReadiness {
  version:                 string;
  /** Always false in Sprint 11M — no real execution. */
  execution_available:     false;
  execution_target_sprint: string;
  guard_checks_count:      number;
  all_checks_implemented:  true;
}

export const AI_PROVIDER_EXECUTION_READINESS: AIProviderExecutionReadiness = {
  version:                 "1.0.0-readiness",
  execution_available:     false,
  execution_target_sprint: "Sprint 11N+",
  guard_checks_count:      12,
  all_checks_implemented:  true,
};

// ─── Guard interface ──────────────────────────────────────────────────────────

/**
 * AIProviderExecutionGuard — interface for the guard evaluation function.
 *
 * Callers use this interface to decouple from the concrete implementation.
 */
export interface AIProviderExecutionGuard {
  evaluate(
    request:  AIProviderExecutionRequest,
    policy:   AIProviderExecutionPolicy,
    now:      string,
  ): AIProviderExecutionGuardResult;
}
