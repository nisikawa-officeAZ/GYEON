// DealerOS — AI Orchestration Engine: Failure Strategy Integration (Sprint 11K Phase E)
//
// Wires Sprint 11J failure strategy models into the runtime dry-run.
//
// In dry-run mode, failure strategy is validated structurally:
//   - Retry policy: are max_attempts and delays reasonable?
//   - Timeout policy: are timeouts > 0 and consistent?
//   - Cancellation: is the token in a valid pre-run state?
//   - Fallback: if configured, is the fallback provider distinct?
//   - Partial completion: is the policy self-consistent?
//
// No actual retries, no timeouts, no real provider fallback in Sprint 11K.
// All events are simulated (dry_run: true).
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AIRetryPolicy,
  AITimeoutPolicy,
  AICancellationToken,
  AIFallbackProviderSpec,
  AIPartialCompletionPolicy,
  AIFailureStrategyBundle,
  AIRetryableErrorCategory,
}                                       from "../failure-strategy";
import { isRetryable, computeRetryDelay } from "../failure-strategy";
import type {
  AIOrchestratorStepResult,
  AIFailureStrategyEvent,
  AIFailureStrategyEventType,
}                                       from "./orchestrator-runtime-types";

// ─── Retry decision ───────────────────────────────────────────────────────────

export interface AIRetryDecision {
  should_retry:   boolean;
  next_attempt:   number;
  delay_ms:       number;
  /** Reason retry is skipped (non-retryable error, attempts exhausted, etc.). */
  skip_reason:    string | null;
}

/**
 * evaluateRetryDecision — determines whether a failed step should be retried.
 * Dry-run: returns what WOULD happen; does not actually schedule a retry.
 */
export function evaluateRetryDecision(
  error_category: AIRetryableErrorCategory | "non_retryable" | "unknown",
  attempt:        number,
  policy:         AIRetryPolicy,
): AIRetryDecision {
  if (!isRetryable(error_category, policy)) {
    return {
      should_retry: false,
      next_attempt: attempt,
      delay_ms:     0,
      skip_reason:  `Error category "${error_category}" is not retryable per policy`,
    };
  }
  if (attempt >= policy.max_attempts) {
    return {
      should_retry: false,
      next_attempt: attempt,
      delay_ms:     0,
      skip_reason:  `Max attempts (${policy.max_attempts}) exhausted`,
    };
  }
  return {
    should_retry:  true,
    next_attempt:  attempt + 1,
    delay_ms:      computeRetryDelay(attempt + 1, policy),
    skip_reason:   null,
  };
}

// ─── Timeout validation ───────────────────────────────────────────────────────

export interface AITimeoutValidationResult {
  is_valid:   boolean;
  warnings:   string[];
  errors:     string[];
}

/**
 * validateTimeoutPolicy — checks that timeout values are reasonable.
 */
export function validateTimeoutPolicy(
  policy: AITimeoutPolicy,
): AITimeoutValidationResult {
  const warnings: string[] = [];
  const errors:   string[] = [];

  if (policy.step_timeout_ms <= 0) {
    errors.push("step_timeout_ms must be greater than 0");
  }
  if (policy.plan_timeout_ms <= 0) {
    errors.push("plan_timeout_ms must be greater than 0");
  }
  if (policy.gateway_handshake_timeout_ms <= 0) {
    errors.push("gateway_handshake_timeout_ms must be greater than 0");
  }
  if (policy.step_timeout_ms > policy.plan_timeout_ms) {
    warnings.push("step_timeout_ms exceeds plan_timeout_ms — some steps could never complete within the plan budget");
  }
  if (policy.step_timeout_ms < 5_000) {
    warnings.push("step_timeout_ms < 5s — AI provider calls typically require at least 5–10s");
  }
  if (policy.plan_timeout_ms < policy.step_timeout_ms * 2) {
    warnings.push("plan_timeout_ms is less than 2× step_timeout_ms — multi-step plans may time out before all steps run");
  }

  return { is_valid: errors.length === 0, warnings, errors };
}

// ─── Retry policy validation ──────────────────────────────────────────────────

/**
 * validateRetryPolicy — checks that retry policy settings are self-consistent.
 */
export function validateRetryPolicy(
  policy: AIRetryPolicy,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (policy.max_attempts <= 0) {
    warnings.push("max_attempts is 0 — retries are disabled for this policy");
  }
  if (policy.initial_delay_ms <= 0) {
    warnings.push("initial_delay_ms should be > 0 to avoid tight retry loops");
  }
  if (policy.backoff_multiplier < 1.0) {
    warnings.push("backoff_multiplier < 1.0 — delay will shrink on each retry, causing aggressive retries");
  }
  if (policy.max_delay_ms < policy.initial_delay_ms) {
    warnings.push("max_delay_ms < initial_delay_ms — cap has no effect");
  }
  if (policy.retryable_categories.length === 0) {
    warnings.push("retryable_categories is empty — no errors will trigger a retry");
  }

  return { valid: true, warnings };
}

// ─── Cancellation check ───────────────────────────────────────────────────────

export interface AICancellationCheckResult {
  should_cancel: boolean;
  reason:        string | null;
}

/**
 * checkCancellationToken — returns whether the plan should halt at this step.
 */
export function checkCancellationToken(
  token:   AICancellationToken,
  step_id: string,
): AICancellationCheckResult {
  if (!token.cancelled) {
    return { should_cancel: false, reason: null };
  }
  return {
    should_cancel: true,
    reason:        `Step "${step_id}" cancelled: ${token.reason ?? "unknown reason"} (by ${token.cancelled_by ?? "unknown"} at ${token.cancelled_at ?? "unknown"})`,
  };
}

// ─── Fallback validation ──────────────────────────────────────────────────────

/**
 * validateFallbackSpec — checks that fallback configuration is valid.
 */
export function validateFallbackSpec(
  spec: AIFallbackProviderSpec | null,
): { valid: boolean; warnings: string[] } {
  if (!spec) return { valid: true, warnings: [] };

  const warnings: string[] = [];

  if (spec.primary_provider === spec.fallback_provider) {
    warnings.push(`Fallback provider "${spec.fallback_provider}" is the same as the primary — fallback has no effect`);
  }
  if (spec.max_fallback_attempts <= 0) {
    warnings.push("max_fallback_attempts is 0 — fallback provider would never be tried");
  }
  if (spec.trigger_on_categories.length === 0) {
    warnings.push("trigger_on_categories is empty — fallback would never activate");
  }

  return { valid: true, warnings };
}

// ─── Partial completion evaluation ───────────────────────────────────────────

export interface AIPartialCompletionEvaluation {
  acceptable:     boolean;
  required_met:   boolean;
  customer_met:   boolean;
  approval_met:   boolean;
  reason:         string;
}

/**
 * evaluatePartialCompletion — checks whether the current step results satisfy
 * the partial completion policy.
 */
export function evaluatePartialCompletion(
  step_results: AIOrchestratorStepResult[],
  policy:       AIPartialCompletionPolicy,
): AIPartialCompletionEvaluation {
  if (!policy.allowed) {
    const all_validated = step_results.every((r) => r.dry_run_status === "validated" || r.dry_run_status === "skipped_optional");
    return {
      acceptable:   all_validated,
      required_met: all_validated,
      customer_met: true,
      approval_met: true,
      reason:       all_validated ? "All steps validated" : "Partial completion not allowed by policy",
    };
  }

  const customer_facing_blocked = step_results.some(
    (r) => policy.customer_facing_steps_must_complete && r.approval_gate_triggered && r.dry_run_status !== "validated",
  );

  const required_blocked = step_results.some(
    (r) => !r.execution_deferred && r.dry_run_status === "blocked_feature_gate",
  );

  const min_ok = policy.min_steps_required === null ||
    step_results.filter((r) => r.dry_run_status === "validated").length >= policy.min_steps_required;

  const acceptable = !required_blocked && !customer_facing_blocked && min_ok;

  return {
    acceptable,
    required_met:  !required_blocked,
    customer_met:  !customer_facing_blocked,
    approval_met:  !customer_facing_blocked,
    reason:        acceptable
      ? "Partial completion acceptable under current policy"
      : [
          required_blocked        ? "Required steps have feature gate failures" : null,
          customer_facing_blocked ? "Customer-facing steps must complete per policy" : null,
          !min_ok                 ? `Fewer than min_steps_required (${policy.min_steps_required}) validated` : null,
        ].filter(Boolean).join("; "),
  };
}

// ─── Full strategy validation ─────────────────────────────────────────────────

export interface AIFailureStrategyValidationResult {
  is_valid:  boolean;
  warnings:  string[];
  errors:    string[];
}

/**
 * validateFailureStrategy — validates all components of the failure strategy bundle.
 * Returns a combined result with all warnings and errors.
 */
export function validateFailureStrategy(
  strategy: AIFailureStrategyBundle,
): AIFailureStrategyValidationResult {
  const allWarnings: string[] = [];
  const allErrors:   string[] = [];

  const timeoutResult  = validateTimeoutPolicy(strategy.timeout);
  const retryResult    = validateRetryPolicy(strategy.retry);
  const fallbackResult = validateFallbackSpec(strategy.fallback);

  allErrors.push(...timeoutResult.errors);
  allWarnings.push(...timeoutResult.warnings, ...retryResult.warnings, ...fallbackResult.warnings);

  if (strategy.cancellation.cancelled) {
    allWarnings.push(`Cancellation token is already triggered (reason: ${strategy.cancellation.reason}) — plan would not start`);
  }
  if (strategy.partial_completion.min_steps_required !== null &&
      strategy.partial_completion.min_steps_required <= 0) {
    allWarnings.push("min_steps_required <= 0 has no practical effect");
  }

  return {
    is_valid: allErrors.length === 0,
    warnings: allWarnings,
    errors:   allErrors,
  };
}

// ─── Failure event builder ────────────────────────────────────────────────────

/**
 * buildDryRunFailureEvent — creates a simulated failure event for the dry-run report.
 */
export function buildDryRunFailureEvent(
  event_type: AIFailureStrategyEventType,
  step_id:    string | null,
  plan_id:    string,
  details:    Record<string, unknown>,
  now:        string,
): AIFailureStrategyEvent {
  return {
    event_type,
    step_id,
    plan_id,
    details,
    dry_run:     true,
    occurred_at: now,
  };
}

/**
 * simulateFailureStrategyEvents — generates hypothetical failure events for a step.
 * Used to show the dealer what would happen if the step encountered a transient error.
 */
export function simulateFailureStrategyEvents(
  step_id:  string,
  plan_id:  string,
  strategy: AIFailureStrategyBundle,
  now:      string,
): AIFailureStrategyEvent[] {
  const events: AIFailureStrategyEvent[] = [];

  if (strategy.retry.max_attempts > 0) {
    events.push(buildDryRunFailureEvent(
      "retry_would_trigger",
      step_id,
      plan_id,
      {
        max_attempts:      strategy.retry.max_attempts,
        initial_delay_ms:  strategy.retry.initial_delay_ms,
        backoff_multiplier: strategy.retry.backoff_multiplier,
      },
      now,
    ));
  }

  if (strategy.fallback !== null) {
    events.push(buildDryRunFailureEvent(
      "fallback_would_activate",
      step_id,
      plan_id,
      {
        primary_provider:  strategy.fallback.primary_provider,
        fallback_provider: strategy.fallback.fallback_provider,
        fallback_model:    strategy.fallback.fallback_model,
      },
      now,
    ));
  }

  return events;
}
