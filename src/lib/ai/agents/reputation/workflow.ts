// DealerOS — AI Reputation Agent: Review Workflow Model
//
// Complete workflow from job completion to marketing feedback loop.
// Defines every stage, the event that triggers it, and what it enables.
//
// Phase B specification: no inference, no DB operations — types and transitions only.

import type { ReviewPlatform, ReviewSentimentType } from "./types";

// ─── Workflow stages ──────────────────────────────────────────────────────────

/**
 * Ordered pipeline:
 *
 *   CompletionReport
 *     ↓
 *   ReviewRequestSent  (LINE message delivered to customer)
 *     ↓
 *   ReviewPosted       (customer posts on platform)
 *     ↓
 *   ReviewAnalyzed     (AI extracts signals — Phase G)
 *     ↓
 *   DashboardUpdated   (dealer sees updated reputation score)
 *     ↓
 *   MarketingIntegrated (signals fed to AI Marketing Agent — future cross-agent)
 */
export type ReputationWorkflowStage =
  | "completion_report"     // Job completed — potential trigger for review request
  | "review_request_sent"   // Dealer approved and sent LINE message
  | "review_posted"         // Customer posted a review on the target platform
  | "review_analyzed"       // AI analysis completed (Phase G)
  | "dashboard_updated"     // Dealer dashboard metrics refreshed
  | "marketing_integrated"; // Signals exported to AI Marketing Agent (future)

// ─── Workflow event ───────────────────────────────────────────────────────────

export interface ReputationWorkflowEvent {
  stage:       ReputationWorkflowStage;
  dealer_id:   string;    // Always from server-side context — never from client
  job_id?:     string;
  occurred_at: string;    // ISO 8601
  metadata?:   Record<string, string | number | boolean>;
}

// ─── Stage transitions ────────────────────────────────────────────────────────

export interface WorkflowTransition {
  from:    ReputationWorkflowStage;
  to:      ReputationWorkflowStage;
  /** Human-readable trigger description (Japanese). */
  trigger: string;
  /** Action required to advance. */
  action:  string;
  /** Pro+ only. */
  gated:   boolean;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  {
    from:    "completion_report",
    to:      "review_request_sent",
    trigger: "施工完了・ディーラーが送信を承認",
    action:  "dealer_approves_send",
    gated:   true,
  },
  {
    from:    "review_request_sent",
    to:      "review_posted",
    trigger: "お客様がレビューを投稿",
    action:  "customer_posts_review",
    gated:   false,
  },
  {
    from:    "review_posted",
    to:      "review_analyzed",
    trigger: "AIがレビューを分析（Phase G）",
    action:  "agent_runs_analysis",
    gated:   true,
  },
  {
    from:    "review_analyzed",
    to:      "dashboard_updated",
    trigger: "ダッシュボードのメトリクスを更新",
    action:  "update_reputation_dashboard",
    gated:   false,
  },
  {
    from:    "dashboard_updated",
    to:      "marketing_integrated",
    trigger: "AIマーケティングエージェントにシグナルを送信（未来機能）",
    action:  "export_marketing_feed",
    gated:   true,
  },
];

// ─── Review request rate limiting ─────────────────────────────────────────────
// Compliance: one request per customer per job. No follow-ups in v1.0.

export interface ReviewRequestThrottle {
  /** Each customer/job pair is throttled to exactly one request. */
  max_requests_per_job:     1;
  /** Minimum hours between review requests to the same customer. */
  min_interval_hours:       72;
  /** No automated follow-up reminders in v1.0. */
  allow_followup_reminders: false;
}

export const REVIEW_REQUEST_THROTTLE: ReviewRequestThrottle = {
  max_requests_per_job:     1,
  min_interval_hours:       72,
  allow_followup_reminders: false,
};

// ─── Platform priority ordering ───────────────────────────────────────────────
// Google is the most impactful for MEO; order determines default suggestion.

export const PLATFORM_PRIORITY: ReviewPlatform[] = [
  "google",
  "instagram",
  "facebook",
  "website",
  "trip_advisor",
  "custom",
];

// ─── Compliance rules ─────────────────────────────────────────────────────────
// These rules cannot be relaxed in any sprint or version without explicit
// legal and ethical review. See AI_REPUTATION_AGENT_ROADMAP.md §Principles.

export interface ReputationComplianceRules {
  /** Never generate or submit reviews on behalf of the customer. */
  no_fake_reviews:                  true;
  /** Never instruct customers on which star rating to choose. */
  no_star_rating_suggestion:        true;
  /** Never include incentives (discounts, points) in review requests. */
  no_incentives:                    true;
  /** Every review request message must be explicitly approved by the dealer. */
  dealer_approval_required:         true;
  /** Responses to reviews are drafts — dealer posts manually, never auto-posted. */
  manual_review_response_posting:   true;
}

export const REPUTATION_COMPLIANCE: ReputationComplianceRules = {
  no_fake_reviews:                  true,
  no_star_rating_suggestion:        true,
  no_incentives:                    true,
  dealer_approval_required:         true,
  manual_review_response_posting:   true,
};

// ─── Sentiment signal thresholds (for dashboard trend calculation) ─────────────

export const SENTIMENT_THRESHOLDS = {
  /** Minimum positive sentiment ratio to declare trend "improving". */
  improving_positive_ratio: 0.7,
  /** Minimum neutral range (neither improving nor declining). */
  stable_positive_ratio:    0.5,
  /** If positive_ratio < stable, trend is "declining". */
} as const;

/** Derive trend from a sentiment breakdown record. */
export function computeTrend(
  breakdown: Record<ReviewSentimentType, number>,
): "improving" | "stable" | "declining" {
  const total = breakdown.positive + breakdown.neutral + breakdown.negative;
  if (total === 0) return "stable";
  const ratio = breakdown.positive / total;
  if (ratio >= SENTIMENT_THRESHOLDS.improving_positive_ratio) return "improving";
  if (ratio >= SENTIMENT_THRESHOLDS.stable_positive_ratio)    return "stable";
  return "declining";
}
