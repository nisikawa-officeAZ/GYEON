// DealerOS — AI Reputation Platform Domain Types
//
// Sprint 11C Phase A: canonical business domain types for the Reputation Platform.
//
// This module defines the new business domain layer for reputation management.
// It re-exports foundation types from the existing AI reputation agent
// (src/lib/ai/agents/reputation/types.ts) and adds the higher-level
// business objects: ReputationProfile, ReviewRequest, ReviewDestination,
// ReviewDraft, ReviewResponse, ReviewSignal, ReputationInsight,
// ReputationPolicy, ReputationWorkflow.
//
// Dependency:
//   This module imports FROM @/lib/ai/agents/reputation/types (one-way).
//   @/lib/ai/agents/reputation/ does NOT import from this module.
//
// Security:
//   dealer_id must always come from getCurrentDealer() in all server actions.
//   ReputationPolicy.require_dealer_approval is permanently locked to true.
//   No review may be sent without explicit dealer approval.

// ─── Re-exports from the AI reputation agent foundation ──────────────────────
// These are the canonical reputation primitive types defined in Sprint 10E.

export type {
  ReviewPlatform,
  ReviewPlatformConfig,
  ReputationCapability,
  ReputationContext,
  CustomerReview,
  ReviewRequestPayload,
  ReviewRequestOutput,
  ReviewResponsePayload,
  ReviewResponseOutput,
  ReviewSentimentType,
  ReviewSentiment,
  ReviewKeyword,
  ReviewServiceCategory,
  LLMOMetadata,
  ReviewAnalysisResult,
  ReputationAnalysisPayload,
  ReputationDashboard,
  MarketingAgentFeed,
  ReputationAgentRequest,
  ReputationAgentResponse,
} from "@/lib/ai/agents/reputation/types";

export {
  REVIEW_PLATFORM_LABELS,
  DEFAULT_REPUTATION_CONTEXT,
} from "@/lib/ai/agents/reputation/types";

// ─── Review request lifecycle ─────────────────────────────────────────────────

/**
 * Status of a single review request from preparation to completion.
 *
 * draft → pending_approval → approved → sent → review_received
 *                          ↘ rejected
 *                    ↘ cancelled (dealer cancelled before sending)
 * sent → no_response (if no review received within the policy window)
 */
export type ReviewRequestStatus =
  | "draft"             // Being prepared — message not yet shown to dealer
  | "pending_approval"  // Draft ready — dealer must review before sending
  | "approved"          // Dealer approved — ready to dispatch via LINE
  | "sent"              // LINE message delivered to customer
  | "cancelled"         // Dealer cancelled before sending
  | "review_received"   // Customer posted a review on the target platform
  | "no_response";      // Sent but no review received within window_days

// ─── Review destinations ──────────────────────────────────────────────────────

/**
 * ReviewDestination — a specific platform/URL target where a review can be posted.
 *
 * One dealer may have multiple destinations across platforms.
 * Only enabled destinations are shown to customers.
 */
export interface ReviewDestination {
  id:             string;
  dealer_id:      string;
  platform:       import("@/lib/ai/agents/reputation/types").ReviewPlatform;
  label:          string;           // Display name e.g. "Google ビジネスプロフィール"
  /**
   * Direct link to the review submission page.
   * Null until dealer configures it in settings.
   */
  review_url:     string | null;
  enabled:        boolean;
  /**
   * False when the platform integration is not yet available.
   * Currently all platforms require manual URL configuration.
   */
  available_now:  boolean;
  /**
   * Present when available_now = false — explains what must be set up first.
   */
  blocked_by?:    string;
}

// ─── Reputation profile status ────────────────────────────────────────────────

export type ReputationProfileStatus =
  | "active"             // Profile is configured and operational
  | "pending_setup"      // No review destinations configured yet
  | "insufficient_data"  // Fewer than 5 reviews — metrics not meaningful
  | "suspended";         // Temporarily suspended by dealer

// ─── Reputation trend direction ───────────────────────────────────────────────

export type ReputationTrendDirection =
  | "improving"          // Average rating or volume improving over last 30d
  | "stable"             // No significant change
  | "declining"          // Average rating or volume declining over last 30d
  | "insufficient_data"; // Not enough data to determine trend

// ─── Compliance flags ─────────────────────────────────────────────────────────

/**
 * ReviewComplianceFlag — a compliance violation detected in a review draft.
 *
 * Critical rules (non-negotiable — see REVIEW_COMPLIANCE_RULES):
 *   - Never generate fake reviews
 *   - Never suggest a specific star rating
 *   - Never use pressure language
 *   - Never offer incentives for reviews
 *   - Never target only positive-sentiment customers
 *   - Never auto-post on behalf of customers
 */
export type ReviewComplianceFlag =
  | "fake_review_attempt"      // Draft simulates or fabricates a customer review
  | "star_rating_suggestion"   // Draft suggests, requests, or implies a star rating
  | "pressure_language"        // Draft contains urgency, guilt, or pressure tactics
  | "incentive_offer"          // Draft offers discount, gift, or reward for a review
  | "selective_request_signal" // Logic routes request only to high-sentiment customers
  | "auto_post_attempt";       // Draft or code attempts to submit a review automatically

// ─── Signal model ─────────────────────────────────────────────────────────────

/**
 * Source of a reputation signal.
 * A signal is any piece of data that can inform reputation analysis.
 */
export type ReviewSignalSource =
  | "google_review"         // Review posted on Google Business Profile
  | "line_survey"           // Response to a LINE-delivered survey or question
  | "customer_feedback"     // In-app or form-based customer feedback
  | "website_testimonial"   // Testimonial submitted on dealer website
  | "sns_comment"           // Comment or mention on Instagram, Facebook, X, etc.
  | "completion_report"     // Dealer-entered observations in the completion report
  | "manual_input";         // Dealer manually entered feedback (verbal, in-person)

/**
 * Type of signal data.
 * Each type has different analysis applicability.
 */
export type ReviewSignalType =
  | "star_rating"           // Numeric rating (1–5 or 1–10)
  | "text_review"           // Free-form text review
  | "survey_response"       // Structured survey answer (e.g., NPS question)
  | "testimonial"           // Extended testimonial or case study
  | "sns_mention"           // Social media mention (may be positive or negative)
  | "verbal_feedback";      // Dealer-recorded verbal feedback from customer

// ─── Insight model ────────────────────────────────────────────────────────────

/**
 * Type of reputation insight derived from aggregated signals.
 * No AI analysis in Sprint 11C — these types define the schema for Phase 11D+.
 */
export type ReputationInsightType =
  | "sentiment_trend"           // Overall sentiment direction over time
  | "service_quality_signal"    // Signals about work quality or craftsmanship
  | "response_time_signal"      // Signals about appointment and turnaround speed
  | "pricing_perception"        // Signals about value for money
  | "customer_satisfaction"     // Aggregate satisfaction score
  | "repeat_visit_likelihood"   // Signals indicating likelihood to return
  | "local_seo_impact"          // SEO/MEO keywords found in review text
  | "aeo_faq_candidate"         // Q&A structure found that could become schema.org FAQ
  | "llmo_entity_signal"        // Signals strengthening dealer's LLM entity representation
  | "aio_discoverability";      // Signals improving AI search engine discoverability

// ─── Readiness check types (Phase B) ─────────────────────────────────────────

/**
 * Individual readiness check within a review request validation.
 * Each check is independently named and has a typed pass/fail result.
 */
export type ReviewRequestReadinessCheckName =
  | "destination_configured"    // At least one ReviewDestination is enabled with a URL
  | "customer_eligible"         // Customer has not been requested recently (policy window)
  | "customer_has_line"         // Customer has a linked LINE user ID
  | "dealer_settings_available" // Dealer reputation settings are initialized
  | "consent_verified"          // Customer has not denied LINE messaging consent
  | "policy_window_passed"      // min_hours_after_completion has elapsed
  | "feature_enabled";          // Dealer has reputation feature (plan check)

export interface ReviewRequestReadinessCheck {
  check_name: ReviewRequestReadinessCheckName;
  passed:     boolean;
  reason:     string | null;
}

/**
 * Overall status of a review request readiness validation.
 */
export type ReviewRequestReadinessStatus =
  | "ready"                       // All checks passed — request can be prepared
  | "not_ready_no_destination"    // No enabled ReviewDestination configured
  | "not_ready_customer_no_line"  // Customer not LINE-linked
  | "not_ready_dealer_settings"   // Dealer reputation settings not initialized
  | "not_ready_no_consent"        // Customer denied LINE messaging consent
  | "not_ready_policy_violation"  // Policy window not satisfied
  | "not_ready_feature_disabled"; // Dealer plan does not include reputation feature
