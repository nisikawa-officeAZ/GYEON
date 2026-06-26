// DealerOS — AI Orchestration Engine: Failure Strategy (Sprint 11J Phase E)
//
// Models for all failure, retry, timeout, cancellation, and partial completion policies.
//
// These types are used by the orchestrator to decide what to do when an agent
// step fails, times out, or is cancelled. They are pure configuration — the
// runtime enforcement is deferred to Sprint 11K when execution is wired.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }          from "@/lib/ai/types";
import type { AIOrchestrationWorkflowId } from "./orchestrator-types";

// ─── Retry policy ─────────────────────────────────────────────────────────────

/**
 * AIRetryPolicy — controls how the orchestrator retries a failed step.
 *
 * Applied per step. Retries use exponential backoff with jitter.
 */
export interface AIRetryPolicy {
  /** Maximum number of retry attempts (not counting the initial attempt). */
  max_attempts:         number;
  /** Delay before the first retry in milliseconds. */
  initial_delay_ms:     number;
  /** Multiplier applied to the delay after each failure. 2.0 = double each time. */
  backoff_multiplier:   number;
  /** Cap on retry delay in milliseconds regardless of backoff calculation. */
  max_delay_ms:         number;
  /** Whether jitter (randomization) is added to prevent thundering herd. */
  jitter:               boolean;
  /**
   * Error categories that are eligible for retry.
   * Errors NOT in this list result in immediate failure (no retry).
   */
  retryable_categories: AIRetryableErrorCategory[];
}

/**
 * AIRetryableErrorCategory — categories of errors that warrant an automatic retry.
 */
export type AIRetryableErrorCategory =
  | "provider_rate_limit"       // 429 — provider is throttling requests
  | "provider_server_error"     // 5xx — transient provider infrastructure error
  | "provider_timeout"          // Provider did not respond within step_timeout_ms
  | "gateway_unavailable"       // AI Gateway is temporarily unreachable
  | "network_error"             // TCP/TLS connectivity failure
  | "model_overloaded";         // Provider reports the model is at capacity

// ─── Timeout policy ───────────────────────────────────────────────────────────

/**
 * AITimeoutPolicy — controls how long the orchestrator waits at various checkpoints.
 */
export interface AITimeoutPolicy {
  /** Maximum time for a single agent step in milliseconds. */
  step_timeout_ms:            number;
  /** Maximum total time for the entire execution plan in milliseconds. */
  plan_timeout_ms:            number;
  /**
   * Maximum time to wait at a dealer approval gate before auto-cancelling.
   * null = wait indefinitely (dealer must explicitly approve or reject).
   */
  approval_gate_timeout_ms:   number | null;
  /**
   * Maximum time for the AI Gateway bridge handshake before treating as a failure.
   */
  gateway_handshake_timeout_ms: number;
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

/**
 * AICancellationReason — why an execution plan was cancelled.
 */
export type AICancellationReason =
  | "dealer_cancelled"           // Dealer explicitly stopped the plan via UI
  | "plan_timeout"               // Total plan duration exceeded plan_timeout_ms
  | "hard_limit_reached"         // Dealer's monthly AI spend cap reached
  | "gateway_unavailable"        // AI Gateway unreachable after all retries
  | "step_failed_no_retry"       // A required step failed with a non-retryable error
  | "approval_gate_timeout"      // Dealer did not act on an approval gate in time
  | "system_shutdown";           // Platform maintenance or emergency stop

/**
 * AICancellationToken — represents the cancellation state of a running plan.
 *
 * Checked by the orchestrator before starting each step.
 */
export interface AICancellationToken {
  cancelled:       boolean;
  reason:          AICancellationReason | null;
  /** ISO 8601 timestamp of cancellation. null if not yet cancelled. */
  cancelled_at:    string | null;
  /** Whether the cancellation was initiated by the dealer or the system. */
  cancelled_by:    "dealer" | "system" | null;
  /** True if in-flight steps should receive a stop signal. */
  interrupt_steps: boolean;
}

// ─── Fallback provider ────────────────────────────────────────────────────────

/**
 * AIFallbackProviderSpec — describes a fallback AI provider for a step or plan.
 *
 * When the primary provider fails with a retryable error and max_attempts
 * are exhausted, the orchestrator may switch to the fallback provider.
 *
 * The dealer must have a valid API key configured for both primary and fallback.
 */
export interface AIFallbackProviderSpec {
  primary_provider:       AIProviderId;
  fallback_provider:      AIProviderId;
  /** Model to use on the fallback provider. */
  fallback_model:         string;
  /**
   * Error categories that trigger fallback (rather than failing the step).
   * Subset of AIRetryableErrorCategory.
   */
  trigger_on_categories:  AIRetryableErrorCategory[];
  /** Maximum number of times to attempt the fallback provider. */
  max_fallback_attempts:  number;
}

// ─── Partial completion policy ────────────────────────────────────────────────

/**
 * AIPartialCompletionPolicy — whether a plan can succeed with some steps failed.
 *
 * Required steps (is_optional: false) must always complete.
 * Optional steps (is_optional: true) may fail without failing the plan if this policy allows.
 */
export interface AIPartialCompletionPolicy {
  /** If false, ALL steps (including optional) must complete for the plan to succeed. */
  allowed:                            boolean;
  /**
   * Minimum number of steps that must complete for partial completion to be accepted.
   * null = no minimum beyond required steps.
   */
  min_steps_required:                 number | null;
  /**
   * If true, all customer-facing steps must complete even if other optional steps fail.
   */
  customer_facing_steps_must_complete: boolean;
  /**
   * If true, dealer approval gate steps must complete before the plan can
   * be considered partially complete.
   */
  approval_gate_steps_must_complete:  boolean;
}

// ─── Failure strategy bundle ──────────────────────────────────────────────────

/**
 * AIFailureStrategyBundle — complete failure handling configuration for a plan.
 *
 * Built per-plan from the workflow spec and dealer's policy settings.
 */
export interface AIFailureStrategyBundle {
  workflow_id:       AIOrchestrationWorkflowId;
  retry:             AIRetryPolicy;
  timeout:           AITimeoutPolicy;
  cancellation:      AICancellationToken;
  /** null if the dealer has no fallback provider configured. */
  fallback:          AIFallbackProviderSpec | null;
  partial_completion: AIPartialCompletionPolicy;
}

// ─── Execution error record ───────────────────────────────────────────────────

/**
 * AIExecutionErrorRecord — structured error information from a failed step.
 */
export interface AIExecutionErrorRecord {
  step_id:              string;
  plan_id:              string;
  /** Always from getCurrentDealer(). */
  dealer_id:            string;
  error_category:       AIRetryableErrorCategory | "non_retryable" | "unknown";
  error_message:        string;
  retry_count:          number;
  fallback_attempted:   boolean;
  final_provider_tried: AIProviderId | null;
  occurred_at:          string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_RETRY_POLICY: AIRetryPolicy = {
  max_attempts:         2,
  initial_delay_ms:     1_000,
  backoff_multiplier:   2.0,
  max_delay_ms:         16_000,
  jitter:               true,
  retryable_categories: [
    "provider_rate_limit",
    "provider_server_error",
    "provider_timeout",
    "gateway_unavailable",
    "network_error",
  ],
};

export const DEFAULT_TIMEOUT_POLICY: AITimeoutPolicy = {
  step_timeout_ms:              30_000,  // 30 seconds per step
  plan_timeout_ms:              120_000, // 2 minutes total
  approval_gate_timeout_ms:     null,    // No timeout on dealer approval — wait indefinitely
  gateway_handshake_timeout_ms: 5_000,   // 5 seconds to establish gateway connection
};

export const DEFAULT_PARTIAL_COMPLETION_POLICY: AIPartialCompletionPolicy = {
  allowed:                             true,
  min_steps_required:                  null,
  customer_facing_steps_must_complete: true,
  approval_gate_steps_must_complete:   true,
};

export const INITIAL_CANCELLATION_TOKEN: AICancellationToken = {
  cancelled:       false,
  reason:          null,
  cancelled_at:    null,
  cancelled_by:    null,
  interrupt_steps: false,
};

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * buildDefaultFailureStrategy — creates the default failure strategy for a plan.
 * fallback is null unless the dealer has a second provider configured.
 */
export function buildDefaultFailureStrategy(
  workflow_id: AIOrchestrationWorkflowId,
): AIFailureStrategyBundle {
  return {
    workflow_id,
    retry:             DEFAULT_RETRY_POLICY,
    timeout:           DEFAULT_TIMEOUT_POLICY,
    cancellation:      { ...INITIAL_CANCELLATION_TOKEN },
    fallback:          null,
    partial_completion: DEFAULT_PARTIAL_COMPLETION_POLICY,
  };
}

/**
 * buildCancellationToken — creates a triggered cancellation token.
 * Used when the dealer or system stops a running plan.
 */
export function buildCancellationToken(
  reason:       AICancellationReason,
  cancelled_by: "dealer" | "system",
  now:          string,
  interrupt:    boolean = false,
): AICancellationToken {
  return {
    cancelled:       true,
    reason,
    cancelled_at:    now,
    cancelled_by,
    interrupt_steps: interrupt,
  };
}

/**
 * isRetryable — returns true if the error category should trigger a retry.
 */
export function isRetryable(
  category: AIRetryableErrorCategory | "non_retryable" | "unknown",
  policy:   AIRetryPolicy,
): boolean {
  if (category === "non_retryable" || category === "unknown") return false;
  return policy.retryable_categories.includes(category);
}

/**
 * computeRetryDelay — computes the delay before the nth retry attempt.
 * Applies exponential backoff with optional jitter.
 */
export function computeRetryDelay(
  attempt: number,
  policy:  AIRetryPolicy,
): number {
  const base   = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1);
  const capped = Math.min(base, policy.max_delay_ms);
  if (!policy.jitter) return capped;
  // Uniform jitter: ±25% of the computed delay
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}
