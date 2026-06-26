// DealerOS — Reputation Agent Runtime: Compliance Guard (Phase D)
//
// Sprint 11D Phase D: workflow-level compliance guard for the reputation runtime.
//
// This module enforces the 8 permanent compliance rules at the workflow level.
// It complements the text-pattern check in review-draft.ts (which checks message
// content) by checking the workflow *context* — whether the overall intent and
// configuration violates compliance before any message is generated.
//
// The 8 rules (permanent — cannot be weakened without explicit ethical review):
//   1. no_fake_reviews        — Never generate or simulate reviews on behalf of customers
//   2. no_posting_on_behalf   — Never auto-post a review to any platform
//   3. no_selective_targeting — Never limit requests to positive-sentiment customers only
//   4. no_pressure_language   — Never use urgency, guilt, or follow-up pressure
//   5. no_incentive_offer     — Never offer rewards in exchange for reviews
//   6. voluntary_and_authentic — Reviews must be voluntary and customer-authored
//   7. customer_owns_content   — Customer is the sole author of any posted review
//   8. dealer_approval_required — No dispatch without explicit dealer confirmation
//
// Relation to review-draft.ts:
//   - review-draft.ts: text-pattern check on the generated message (post-generation)
//   - compliance-guard.ts: workflow context check (pre-generation, at the runtime layer)
//   Both layers must pass before a ReviewDraft can be approved.

import type {
  ReputationComplianceGuardResult,
  ReputationComplianceCheckItem,
  ComplianceViolation,
} from "./runtime-types";

// ─── Permanent compliance checklist ──────────────────────────────────────────

/**
 * REPUTATION_COMPLIANCE_CHECKLIST — machine-readable list of all 8 enforcement rules.
 *
 * All rules are permanently "enforced" — this checklist documents the invariants
 * rather than listing things that might be toggled off.
 *
 * Included in every ReputationActionPlan so the dealer can see what guarantees
 * the system provides before approving a review request.
 */
export const REPUTATION_COMPLIANCE_CHECKLIST: readonly ReputationComplianceCheckItem[] = [
  {
    rule:        "no_fake_reviews",
    description: "The system never generates, submits, or simulates reviews on behalf of customers.",
    status:      "enforced",
  },
  {
    rule:        "no_posting_on_behalf",
    description: "The system never auto-posts a review to any platform on behalf of a customer.",
    status:      "enforced",
  },
  {
    rule:        "no_selective_targeting",
    description: "Review requests are not limited to positive-sentiment customers only.",
    status:      "enforced",
  },
  {
    rule:        "no_pressure_language",
    description: "Review request messages must never use urgency, guilt, or follow-up pressure.",
    status:      "enforced",
  },
  {
    rule:        "no_incentive_offer",
    description: "Review requests must never offer rewards, discounts, or gifts in exchange for a review.",
    status:      "enforced",
  },
  {
    rule:        "voluntary_and_authentic",
    description: "Reviews must remain voluntary. Customers must be free to write their honest opinion.",
    status:      "enforced",
  },
  {
    rule:        "customer_owns_content",
    description: "The customer is the sole author of any review. The system only provides an invitation.",
    status:      "enforced",
  },
  {
    rule:        "dealer_approval_required",
    description: "No review request message may be dispatched without explicit dealer approval.",
    status:      "enforced",
  },
] as const;

// ─── Workflow compliance context ──────────────────────────────────────────────

/**
 * ReputationWorkflowComplianceContext — runtime state describing the workflow's
 * intent. Each boolean maps to a specific compliance rule.
 *
 * In the GYEON baseline, all booleans are false and dealer_approval_present is true.
 * These values would only change if a feature implementation violated the rules.
 *
 * Use buildCleanComplianceContext() to create the standard baseline context.
 */
export interface ReputationWorkflowComplianceContext {
  /** True if the workflow is configured to target only positive-sentiment customers. */
  is_selective_targeting:  boolean;
  /** True if the workflow is offering a reward in exchange for a review. */
  has_incentive_offer:     boolean;
  /** True if the workflow would auto-post a review on the customer's behalf. */
  is_auto_posting:         boolean;
  /** True if pressure language was found in the workflow configuration or context. */
  has_pressure_language:   boolean;
  /** True if a dealer approval gate is present in the workflow path. */
  dealer_approval_present: boolean;
}

// ─── Guard implementation ─────────────────────────────────────────────────────

/**
 * checkReputationCompliance — validates the workflow compliance context.
 *
 * Checks for violations of the 5 workflow-level rules (the remaining 3 rules —
 * no_fake_reviews, no_posting_on_behalf, customer_owns_content — are enforced
 * architecturally and are not re-checked here).
 *
 * Returns a ReputationComplianceGuardResult with the full 8-rule checklist.
 */
export function checkReputationCompliance(
  ctx: ReputationWorkflowComplianceContext,
  now: string,
): ReputationComplianceGuardResult {
  const violations: ComplianceViolation[] = [];

  if (ctx.is_selective_targeting) {
    violations.push({
      rule:        "no_selective_targeting",
      description: "Workflow is configured to target only positive-sentiment customers.",
      blocking:    true,
    });
  }

  if (ctx.has_incentive_offer) {
    violations.push({
      rule:        "no_incentive_offer",
      description: "An incentive or reward is present in the review request workflow context.",
      blocking:    true,
    });
  }

  if (ctx.is_auto_posting) {
    violations.push({
      rule:        "no_posting_on_behalf",
      description: "Auto-posting to a review platform on the customer's behalf was detected.",
      blocking:    true,
    });
  }

  if (ctx.has_pressure_language) {
    violations.push({
      rule:        "no_pressure_language",
      description: "Pressure language was detected in the workflow configuration.",
      blocking:    true,
    });
  }

  if (!ctx.dealer_approval_present) {
    violations.push({
      rule:        "dealer_approval_required",
      description: "Dealer approval gate is missing from this workflow path.",
      blocking:    true,
    });
  }

  const blockingCount = violations.filter((v) => v.blocking).length;

  return {
    passed:         blockingCount === 0,
    violations,
    blocking_count: blockingCount,
    checklist:      REPUTATION_COMPLIANCE_CHECKLIST as ReputationComplianceCheckItem[],
    checked_at:     now,
  };
}

/**
 * buildCleanComplianceContext — returns the standard GYEON baseline context.
 *
 * In normal operation all violation conditions are false and dealer_approval_present
 * is true. This function creates that baseline for the runtime.
 */
export function buildCleanComplianceContext(): ReputationWorkflowComplianceContext {
  return {
    is_selective_targeting:  false,
    has_incentive_offer:     false,
    is_auto_posting:         false,
    has_pressure_language:   false,
    dealer_approval_present: true,
  };
}

/**
 * formatComplianceResult — returns a one-line summary for logging.
 * Does not include sensitive data.
 */
export function formatComplianceResult(result: ReputationComplianceGuardResult): string {
  if (result.passed) return "compliance=passed";
  const names = result.violations.map((v) => v.rule).join(",");
  return `compliance=failed violations=${names}`;
}
