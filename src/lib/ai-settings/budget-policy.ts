// DealerOS — AI Settings Platform: Budget Policy (Sprint 11O Phase D)
//
// Dealer-owned billing policy for AI inference spend.
//
// Distinct from:
//   AIUsagePolicy        (tracks actual usage, gateway layer)
//   AIBudgetGuardState   (evaluates a single request, orchestrator layer)
//
// AIBudgetPolicyConfig governs monthly limits, warning thresholds, emergency stops,
// and the dealer's preferred cost/quality strategy for all AI executions.
//
// No billing integration. No external calls. Pure evaluation only.

import type { AIUsagePolicy } from "@/lib/ai/usage-policy";

// ─── Budget strategy ──────────────────────────────────────────────────────────

export type AIBudgetStrategy =
  | "preferred_cost"  // Minimize cost; accept good quality (Gemini / OpenRouter)
  | "quality"         // Maximize quality regardless of cost (Anthropic / GPT-4)
  | "balanced";       // Balance cost, quality, and speed per request

// ─── Budget policy config ─────────────────────────────────────────────────────

export interface AIBudgetPolicyConfig {
  /** Monthly spend cap in USD. 0 = no limit configured. */
  monthly_limit_usd:   number;
  /** Fraction of monthly_limit_usd at which to emit a warning (0.0–1.0). */
  warning_threshold:   number;
  /** Hard stop at this USD amount regardless of monthly_limit_usd. null = no emergency stop. */
  emergency_stop_usd:  number | null;
  budget_strategy:     AIBudgetStrategy;
  /** Automatically pause new executions when monthly_limit_usd is reached. */
  auto_pause_on_limit: boolean;
  /** Emit a dealer alert when spending crosses warning_threshold. */
  alert_on_warning:    boolean;
  /**
   * Day of month on which the budget counter resets (1–28).
   * Capped at 28 to work safely across all calendar months.
   */
  reset_day:           number;
}

export const DEFAULT_BUDGET_POLICY: AIBudgetPolicyConfig = {
  monthly_limit_usd:   0,
  warning_threshold:   0.8,
  emergency_stop_usd:  null,
  budget_strategy:     "balanced",
  auto_pause_on_limit: false,
  alert_on_warning:    true,
  reset_day:           1,
};

// ─── Budget policy evaluation ─────────────────────────────────────────────────

export interface AIBudgetPolicyEvaluation {
  monthly_limit_usd:   number;
  warning_threshold:   number;
  emergency_stop_usd:  number | null;
  strategy:            AIBudgetStrategy;
  /** True if execution is allowed to proceed under this policy. */
  should_proceed:      boolean;
  /** English explanation of why execution was blocked. null if should_proceed is true. */
  blocking_reason:     string | null;
  /** English soft warning message. null if not near the warning threshold. */
  warning_message:     string | null;
}

// ─── Evaluation functions ─────────────────────────────────────────────────────

/**
 * evaluateBudgetPolicy — evaluates whether a new AI request should proceed
 * given the dealer's budget policy and current month spend.
 *
 * Pure evaluation — does not modify any state.
 */
export function evaluateBudgetPolicy(
  policy:             AIBudgetPolicyConfig,
  current_month_usd:  number,
  estimated_cost_usd: number,
): AIBudgetPolicyEvaluation {
  const projected = current_month_usd + estimated_cost_usd;

  // Emergency stop check (highest priority — overrides monthly limit)
  if (policy.emergency_stop_usd !== null && projected > policy.emergency_stop_usd) {
    return {
      monthly_limit_usd:  policy.monthly_limit_usd,
      warning_threshold:  policy.warning_threshold,
      emergency_stop_usd: policy.emergency_stop_usd,
      strategy:           policy.budget_strategy,
      should_proceed:     false,
      blocking_reason:    `Emergency stop: projected $${projected.toFixed(4)} exceeds emergency cap $${policy.emergency_stop_usd.toFixed(2)}`,
      warning_message:    null,
    };
  }

  // Monthly limit check
  if (policy.monthly_limit_usd > 0 && projected > policy.monthly_limit_usd) {
    return {
      monthly_limit_usd:  policy.monthly_limit_usd,
      warning_threshold:  policy.warning_threshold,
      emergency_stop_usd: policy.emergency_stop_usd,
      strategy:           policy.budget_strategy,
      should_proceed:     !policy.auto_pause_on_limit,
      blocking_reason:    policy.auto_pause_on_limit
        ? `Monthly limit $${policy.monthly_limit_usd.toFixed(2)} reached — execution paused (auto_pause_on_limit)`
        : null,
      warning_message: !policy.auto_pause_on_limit
        ? `Monthly limit $${policy.monthly_limit_usd.toFixed(2)} reached — proceeding with warning`
        : null,
    };
  }

  // Warning threshold check
  const warning_amount = policy.monthly_limit_usd > 0
    ? policy.monthly_limit_usd * policy.warning_threshold
    : null;

  const warning_message = (warning_amount !== null && projected > warning_amount)
    ? `Spending at ${(projected / policy.monthly_limit_usd * 100).toFixed(1)}% of monthly limit $${policy.monthly_limit_usd.toFixed(2)}`
    : null;

  return {
    monthly_limit_usd:  policy.monthly_limit_usd,
    warning_threshold:  policy.warning_threshold,
    emergency_stop_usd: policy.emergency_stop_usd,
    strategy:           policy.budget_strategy,
    should_proceed:     true,
    blocking_reason:    null,
    warning_message,
  };
}

/** isBudgetPolicyBlocking — true if evaluateBudgetPolicy would block execution. */
export function isBudgetPolicyBlocking(
  policy:             AIBudgetPolicyConfig,
  current_month_usd:  number,
  estimated_cost_usd: number,
): boolean {
  return !evaluateBudgetPolicy(policy, current_month_usd, estimated_cost_usd).should_proceed;
}

/**
 * buildUsagePolicyFromBudgetPolicy — converts AIBudgetPolicyConfig to AIUsagePolicy
 * for compatibility with the existing execution guard's budget checks.
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 */
export function buildUsagePolicyFromBudgetPolicy(
  dealer_id:          string,
  policy:             AIBudgetPolicyConfig,
  current_month_usd:  number,
): AIUsagePolicy {
  const limit_reached =
    policy.monthly_limit_usd > 0 && current_month_usd >= policy.monthly_limit_usd;
  return {
    dealer_id,
    monthly_limit_usd: policy.monthly_limit_usd,
    hard_limit:        policy.auto_pause_on_limit,
    current_month_usd,
    limit_reached,
  };
}
