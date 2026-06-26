// DealerOS — Review Request Workflow
//
// Sprint 11C Phase B: review request preparation and dry-run validation.
//
// This module handles:
//   1. ReviewRequest — the canonical domain object for a single review request
//   2. ReviewRequestContext — pre-fetched data bag for pure validation
//   3. validateReviewRequestReadiness() — pure validator (no DB calls, no async)
//   4. prepareReviewRequest() — constructs a ReviewRequest from validated context
//
// The async orchestration (DB lookups + CE engine calls) is in reputation-engagement.ts.
// This module is pure: it validates and constructs, but does not fetch or send.
//
// Compliance rules (non-negotiable):
//   - Reviews must be voluntary — no pressure language.
//   - No star rating suggestions — never ask for "a 5-star review".
//   - No incentives — no discounts or gifts for leaving reviews.
//   - No auto-sending — dealer must approve every request.
//   - No selective targeting — all customers treated equally (not just positive).
//
// Security:
//   dealer_id must come from getCurrentDealer() in all server actions.
//   ReviewRequest.dealer_id is NEVER accepted from client input.

import type { ReviewPlatform }      from "@/lib/ai/agents/reputation/types";
import type {
  ReviewRequestStatus,
  ReviewDestination,
  ReviewRequestReadinessCheckName,
  ReviewRequestReadinessCheck,
  ReviewRequestReadinessStatus,
} from "./reputation-types";
import type { ReputationPolicy }    from "./reputation-profile";

// ─── ReviewRequest ────────────────────────────────────────────────────────────

/**
 * ReviewRequest — a single review request event in the reputation pipeline.
 *
 * Tracks the full lifecycle from preparation through review receipt.
 * Created by prepareReviewRequest() — never constructed manually.
 *
 * Compliance invariants (enforced at construction):
 *   - sent = false at creation (dealer must approve and trigger send)
 *   - prepared_message must pass validateDraftCompliance() before approval
 */
export interface ReviewRequest {
  id:                   string;
  /** Always from getCurrentDealer() — never from client form input. */
  dealer_id:            string;
  customer_id:          string;
  /** Work order or completion report that triggered this request. */
  job_id:               string;
  destination:          ReviewDestination;
  status:               ReviewRequestStatus;
  /**
   * The message that will be sent via LINE.
   * Null until prepared (draft status) or AI-generated.
   * Must be approved by dealer before sending.
   */
  prepared_message:     string | null;
  /**
   * Who prepared the message — "ai" (AI-generated) or "dealer" (manually written).
   * Null until prepared.
   */
  prepared_by:          "ai" | "dealer" | null;
  /**
   * When the dealer approved the message for sending.
   * Null until status = "approved".
   */
  approved_at:          string | null;
  approved_by:          string | null;
  /**
   * When the LINE message was dispatched.
   * Null until status = "sent".
   */
  sent_at:              string | null;
  sent_by:              string | null;
  /**
   * ISO 8601 date/time when the customer posted a review on the target platform.
   * Must be confirmed manually by the dealer (or via future webhook).
   * Null until status = "review_received".
   */
  review_received_at:   string | null;
  /** Cancellation reason — present when status = "cancelled". */
  cancellation_reason:  string | null;
  created_at:           string;   // ISO 8601
  updated_at:           string;   // ISO 8601
}

// ─── ReviewRequestContext ─────────────────────────────────────────────────────

/**
 * Pre-fetched data bag for pure readiness validation.
 * The async orchestrator (reputation-engagement.ts) fetches all required data
 * and provides it here. This allows validateReviewRequestReadiness() to be
 * a pure synchronous function — no DB calls inside the validator.
 */
export interface ReviewRequestContext {
  /** Always from getCurrentDealer() */
  dealer_id:                    string;
  customer_id:                  string;
  job_id:                       string;
  /** True if the customer has a linked LINE user ID. */
  customer_has_line:            boolean;
  /**
   * The customer's LINE messaging consent status.
   * "denied" blocks the request regardless of other conditions.
   */
  customer_consent_status:      "approved" | "pending" | "denied" | "not_required";
  /** True if dealer_settings has reputation fields initialized. */
  dealer_settings_available:    boolean;
  /** True if the dealer's plan includes the reputation feature. */
  feature_enabled:              boolean;
  /** The primary destination to use — null if none configured. */
  destination:                  ReviewDestination | null;
  policy:                       ReputationPolicy;
  /**
   * ISO 8601 timestamp of the most recent review request to this customer.
   * Null if no previous request exists.
   */
  last_request_to_customer_at:  string | null;
  /**
   * ISO 8601 timestamp when the triggering job was completed.
   * Used to enforce policy.min_hours_after_completion.
   */
  job_completed_at:             string;
}

// ─── Readiness result ─────────────────────────────────────────────────────────

export interface ReviewRequestReadinessResult {
  status:           ReviewRequestReadinessStatus;
  checks:           ReviewRequestReadinessCheck[];
  /**
   * A fully-constructed ReviewRequest (status = "pending_approval").
   * Present only when overall status = "ready".
   */
  prepared_request: ReviewRequest | null;
  /** First blocking reason — null if all checks passed. */
  blocking_reason:  string | null;
}

// ─── Pure readiness validator ─────────────────────────────────────────────────

/**
 * Validates all preconditions for preparing a review request.
 *
 * Pure synchronous function — no DB calls, no async, no side effects.
 * Requires a pre-populated ReviewRequestContext from the async orchestrator.
 *
 * Returns a typed ReadinessResult with:
 *   - status: overall pass/fail with a specific failure reason
 *   - checks: per-check pass/fail details for debugging/audit
 *   - prepared_request: populated only when status = "ready"
 */
export function validateReviewRequestReadiness(
  context: ReviewRequestContext,
  requestId: string,
  now: string,
): ReviewRequestReadinessResult {
  const checks: ReviewRequestReadinessCheck[] = [];
  let firstBlockingReason: string | null = null;
  let overallStatus: ReviewRequestReadinessStatus = "ready";

  // ── Check 1: Feature enabled ───────────────────────────────────────────
  const featureCheck = context.feature_enabled;
  checks.push({
    check_name: "feature_enabled",
    passed:     featureCheck,
    reason:     featureCheck ? null : "Reputation feature is not enabled on the dealer plan.",
  });
  if (!featureCheck && !firstBlockingReason) {
    firstBlockingReason = "The reputation feature is not available on this dealer plan.";
    overallStatus       = "not_ready_feature_disabled";
  }

  // ── Check 2: Destination configured ───────────────────────────────────
  const hasDestination = context.destination !== null && context.destination.review_url !== null;
  checks.push({
    check_name: "destination_configured",
    passed:     hasDestination,
    reason:     hasDestination ? null : "No enabled review destination with a review URL configured.",
  });
  if (!hasDestination && !firstBlockingReason) {
    firstBlockingReason = "No review destination is configured. Set up a review URL in Settings > Reputation.";
    overallStatus       = "not_ready_no_destination";
  }

  // ── Check 3: Dealer settings available ────────────────────────────────
  checks.push({
    check_name: "dealer_settings_available",
    passed:     context.dealer_settings_available,
    reason:     context.dealer_settings_available
      ? null
      : "Dealer reputation settings have not been initialized.",
  });
  if (!context.dealer_settings_available && !firstBlockingReason) {
    firstBlockingReason = "Dealer reputation settings are not initialized. Complete onboarding in Settings > Reputation.";
    overallStatus       = "not_ready_dealer_settings";
  }

  // ── Check 4: Customer has LINE ─────────────────────────────────────────
  checks.push({
    check_name: "customer_has_line",
    passed:     context.customer_has_line,
    reason:     context.customer_has_line
      ? null
      : "Customer does not have a linked LINE account.",
  });
  if (!context.customer_has_line && !firstBlockingReason) {
    firstBlockingReason = "Customer is not linked to LINE. A LINE connection is required to send review requests.";
    overallStatus       = "not_ready_customer_no_line";
  }

  // ── Check 5: Customer consent ──────────────────────────────────────────
  const consentOk = context.customer_consent_status !== "denied";
  checks.push({
    check_name: "consent_verified",
    passed:     consentOk,
    reason:     consentOk ? null : "Customer has denied LINE messaging consent.",
  });
  if (!consentOk && !firstBlockingReason) {
    firstBlockingReason = "Customer has denied LINE messaging consent. Review requests cannot be sent.";
    overallStatus       = "not_ready_no_consent";
  }

  // ── Check 6: Policy window (min hours after completion) ────────────────
  const completedAt         = new Date(context.job_completed_at);
  const nowDate             = new Date(now);
  const elapsedHours        = (nowDate.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
  const policyWindowPassed  = elapsedHours >= context.policy.min_hours_after_completion;
  checks.push({
    check_name: "policy_window_passed",
    passed:     policyWindowPassed,
    reason:     policyWindowPassed
      ? null
      : `Policy requires ${context.policy.min_hours_after_completion}h after completion. Only ${Math.floor(elapsedHours)}h have elapsed.`,
  });
  if (!policyWindowPassed && !firstBlockingReason) {
    firstBlockingReason = `Review request cannot be sent until ${context.policy.min_hours_after_completion} hours after job completion.`;
    overallStatus       = "not_ready_policy_violation";
  }

  // ── Check 7: Customer request frequency (30-day rolling window) ────────
  let requestFrequencyOk = true;
  if (context.last_request_to_customer_at !== null) {
    const lastRequest    = new Date(context.last_request_to_customer_at);
    const daysSinceLast  = (nowDate.getTime() - lastRequest.getTime()) / (1000 * 60 * 60 * 24);
    requestFrequencyOk   = daysSinceLast >= 30;
  }
  checks.push({
    check_name: "customer_eligible",
    passed:     requestFrequencyOk,
    reason:     requestFrequencyOk
      ? null
      : "A review request was sent to this customer within the last 30 days.",
  });
  if (!requestFrequencyOk && !firstBlockingReason) {
    firstBlockingReason = "A review request was already sent to this customer within the last 30 days.";
    overallStatus       = "not_ready_policy_violation";
  }

  // ── Assemble result ────────────────────────────────────────────────────
  if (overallStatus !== "ready" || !context.destination) {
    return {
      status:           overallStatus,
      checks,
      prepared_request: null,
      blocking_reason:  firstBlockingReason,
    };
  }

  const preparedRequest = prepareReviewRequest(requestId, context, now);

  return {
    status:           "ready",
    checks,
    prepared_request: preparedRequest,
    blocking_reason:  null,
  };
}

// ─── Request construction ─────────────────────────────────────────────────────

/**
 * Constructs a ReviewRequest from a validated context.
 * Only call this after validateReviewRequestReadiness() returns status = "ready".
 *
 * The request is created with status = "pending_approval" — it must be
 * reviewed and explicitly approved by the dealer before sending.
 *
 * No message is generated here — message preparation requires a separate
 * AI or manual drafting step (Phase 11D: reputation_agent integration).
 */
export function prepareReviewRequest(
  id:      string,
  context: ReviewRequestContext,
  now:     string,
): ReviewRequest {
  return {
    id,
    dealer_id:           context.dealer_id,
    customer_id:         context.customer_id,
    job_id:              context.job_id,
    destination:         context.destination!,
    status:              "pending_approval",
    prepared_message:    null,    // Set after AI/manual drafting step
    prepared_by:         null,
    approved_at:         null,
    approved_by:         null,
    sent_at:             null,
    sent_by:             null,
    review_received_at:  null,
    cancellation_reason: null,
    created_at:          now,
    updated_at:          now,
  };
}

// ─── Status transition helpers ────────────────────────────────────────────────

/**
 * Valid status transitions for a ReviewRequest.
 * Enforces the review request lifecycle state machine.
 */
export const REVIEW_REQUEST_TRANSITIONS: Record<ReviewRequestStatus, ReviewRequestStatus[]> = {
  draft:            ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved:         ["sent", "cancelled"],
  sent:             ["review_received", "no_response", "cancelled"],
  cancelled:        [],
  review_received:  [],
  no_response:      [],
};

/**
 * Returns true if a transition from `from` to `to` is valid.
 */
export function canTransitionReviewRequest(
  from: ReviewRequestStatus,
  to:   ReviewRequestStatus,
): boolean {
  return REVIEW_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns true if the request is in a terminal state (no further transitions).
 */
export function isReviewRequestTerminal(status: ReviewRequestStatus): boolean {
  return REVIEW_REQUEST_TRANSITIONS[status].length === 0;
}
