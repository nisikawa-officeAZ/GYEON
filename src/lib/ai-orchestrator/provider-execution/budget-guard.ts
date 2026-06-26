// DealerOS — AI Orchestration Engine: Usage Budget Guard (Sprint 11M Phase D)
//
// Evaluates the dealer's AI spending budget before any provider call is allowed.
//
// Budget model:
//   monthly_limit_usd === 0  → no limit configured → always "allow"
//   usage_tracking_available === false → "usage_unknown" (tracking needs migration)
//   usage_policy.limit_reached === true → "hard_stop" (dealer set a hard limit)
//   current_month_usd + estimated_cost_usd > monthly_limit_usd → "hard_stop"
//   current_month_usd / monthly_limit_usd >= warning_threshold → "soft_warning"
//   otherwise → "allow"
//
// Office AZ billing principle (non-negotiable):
//   AI inference costs are ALWAYS billed to the dealer's own API key.
//   Office AZ never pays inference costs. This is enforced in the adapter layer.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIUsagePolicy } from "@/lib/ai/usage-policy";

// ─── Budget decision ──────────────────────────────────────────────────────────

/**
 * AIBudgetGuardDecision — outcome of the budget guard evaluation.
 */
export type AIBudgetGuardDecision =
  | "allow"          // Budget check passed — execution is within budget
  | "soft_warning"   // Approaching limit — execution allowed but dealer should be alerted
  | "hard_stop"      // Limit exceeded or would be exceeded — execution blocked
  | "usage_unknown"; // Cannot evaluate — usage tracking not yet available (no DB table yet)

// ─── Budget state ─────────────────────────────────────────────────────────────

/**
 * AIBudgetGuardState — the full picture of a dealer's spending position.
 *
 * Returned by evaluateBudgetGuard(). Includes both the raw numbers and
 * the derived `budget_decision` so callers don't need to re-implement logic.
 */
export interface AIBudgetGuardState {
  /** Always from getCurrentDealer(). */
  dealer_id:                string;
  /** Configured monthly cap in USD. 0 = no limit. */
  monthly_limit_usd:        number;
  /** Estimated cost of the proposed request. */
  estimated_cost_usd:       number;
  /** Current month spend from usage_policy. 0 until tracking migration exists. */
  current_month_usd:        number;
  /** Monthly limit minus current usage. null if monthly_limit_usd === 0 (no limit). */
  remaining_budget_usd:     number | null;
  /** Fraction of monthly_limit_usd at which a soft warning is issued (0.0–1.0). */
  warning_threshold:        number;
  budget_decision:          AIBudgetGuardDecision;
  /**
   * True if dealer_ai_usage_log table exists and usage data is available.
   * False in Sprint 11M — tracking requires a future CTO-approved migration.
   */
  usage_tracking_available: boolean;
}

// ─── Budget evaluation ────────────────────────────────────────────────────────

/**
 * evaluateBudgetGuard — derives the AIBudgetGuardState for a proposed request.
 *
 * dealer_id must come from getCurrentDealer() — passed in via usage_policy.
 * Does not make any DB calls or external calls.
 */
export function evaluateBudgetGuard(
  usage_policy:        AIUsagePolicy,
  estimated_cost_usd:  number,
  warning_threshold:   number,
): AIBudgetGuardState {
  const {
    dealer_id,
    monthly_limit_usd,
    hard_limit,
    current_month_usd,
    limit_reached,
  } = usage_policy;

  // Usage tracking is not yet available — dealer_ai_usage_log table not migrated.
  // current_month_usd is always 0 until that migration exists.
  // We can detect this by checking if current_month_usd is the sentinel value.
  const usage_tracking_available = false; // Sprint 11M: always false until migration

  // No monthly limit configured
  if (monthly_limit_usd === 0) {
    return {
      dealer_id,
      monthly_limit_usd,
      estimated_cost_usd,
      current_month_usd,
      remaining_budget_usd:     null,
      warning_threshold,
      budget_decision:          "allow",
      usage_tracking_available,
    };
  }

  const remaining_budget_usd = Math.max(0, monthly_limit_usd - current_month_usd);

  // If usage tracking is unavailable, we cannot make an accurate budget decision.
  if (!usage_tracking_available) {
    return {
      dealer_id,
      monthly_limit_usd,
      estimated_cost_usd,
      current_month_usd,
      remaining_budget_usd,
      warning_threshold,
      budget_decision:          "usage_unknown",
      usage_tracking_available,
    };
  }

  // Policy already computed limit_reached — respect it
  if (hard_limit && limit_reached) {
    return {
      dealer_id,
      monthly_limit_usd,
      estimated_cost_usd,
      current_month_usd,
      remaining_budget_usd:     0,
      warning_threshold,
      budget_decision:          "hard_stop",
      usage_tracking_available,
    };
  }

  // Would this request push spend over the limit?
  if (current_month_usd + estimated_cost_usd > monthly_limit_usd) {
    return {
      dealer_id,
      monthly_limit_usd,
      estimated_cost_usd,
      current_month_usd,
      remaining_budget_usd,
      warning_threshold,
      budget_decision:          "hard_stop",
      usage_tracking_available,
    };
  }

  // Within limit but approaching the warning threshold?
  const spend_fraction = monthly_limit_usd > 0 ? current_month_usd / monthly_limit_usd : 0;
  if (spend_fraction >= warning_threshold) {
    return {
      dealer_id,
      monthly_limit_usd,
      estimated_cost_usd,
      current_month_usd,
      remaining_budget_usd,
      warning_threshold,
      budget_decision:          "soft_warning",
      usage_tracking_available,
    };
  }

  return {
    dealer_id,
    monthly_limit_usd,
    estimated_cost_usd,
    current_month_usd,
    remaining_budget_usd,
    warning_threshold,
    budget_decision:            "allow",
    usage_tracking_available,
  };
}

// ─── Budget helpers ───────────────────────────────────────────────────────────

/**
 * isBudgetBlocking — true if the budget decision should prevent execution.
 *
 * "usage_unknown" is non-blocking — we allow execution when we can't measure it.
 * "soft_warning" is non-blocking — execution allowed but UI should warn the dealer.
 * "hard_stop" is blocking — execution must not proceed.
 */
export function isBudgetBlocking(state: AIBudgetGuardState): boolean {
  return state.budget_decision === "hard_stop";
}

/**
 * shouldWarnAboutBudget — true if the UI should display a budget warning.
 */
export function shouldWarnAboutBudget(state: AIBudgetGuardState): boolean {
  return (
    state.budget_decision === "soft_warning" ||
    state.budget_decision === "usage_unknown"
  );
}

/**
 * formatRemainingBudget — returns a human-readable remaining budget string.
 * Returns "No limit set" if monthly_limit_usd is 0.
 * Returns "Unknown" if usage_tracking_available is false.
 */
export function formatRemainingBudget(state: AIBudgetGuardState): string {
  if (state.monthly_limit_usd === 0) return "No limit set";
  if (!state.usage_tracking_available) return "Unknown (tracking not yet available)";
  if (state.remaining_budget_usd === null) return "No limit set";
  return `$${state.remaining_budget_usd.toFixed(2)} of $${state.monthly_limit_usd.toFixed(2)}`;
}
