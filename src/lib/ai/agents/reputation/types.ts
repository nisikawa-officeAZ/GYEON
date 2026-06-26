// DealerOS — AI Reputation Agent: Types
//
// Complete type model for the reputation management workflow.
// Covers review platforms, review model, analysis, dashboard, and
// the discovery feedback loop to the Marketing Agent.
//
// No AI inference types here — those live in the AIAgent interface.
// All types are safe for server-side use; no client-side secrets.

import type { AIAgentRequest, AIAgentResponse } from "../types";
import type { AITaskType }                      from "../../types";

// ─── Review platforms ─────────────────────────────────────────────────────────

export type ReviewPlatform =
  | "google"           // Google Business Profile — primary MEO target
  | "instagram"        // Instagram post / story / highlight
  | "facebook"         // Facebook page review
  | "website"          // Dealer's own website testimonial section
  | "trip_advisor"     // Future: TripAdvisor (auto detailing category)
  | "custom";          // Dealer-specified external platform

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google:      "Google ビジネスプロフィール",
  instagram:   "Instagram",
  facebook:    "Facebook",
  website:     "自社ウェブサイト",
  trip_advisor:"TripAdvisor",
  custom:      "カスタムプラットフォーム",
};

export interface ReviewPlatformConfig {
  platform:    ReviewPlatform;
  review_url:  string;    // Direct link to the review / testimonial submission page
  enabled:     boolean;
  /** Display name overriding the default label (e.g., "当店ホームページ"). */
  label?:      string;
}

// ─── Reputation capabilities ──────────────────────────────────────────────────

export type ReputationCapability =
  | "generate_review_request"     // Draft a LINE message asking for a review
  | "draft_review_response"       // Draft a GBP/platform review response
  | "analyze_reputation"          // Aggregate review data into scored insights
  | "extract_seo_signals"         // Extract MEO/AEO keywords from review corpus
  | "generate_marketing_feed";    // Produce MarketingAgentFeed for cross-agent use

// ─── Agent context (dealer reputation configuration) ─────────────────────────

export interface ReputationContext {
  /** Dealer identifier — always from getCurrentDealer(). */
  dealer_id:        string;
  shop_name:        string;
  /** Per-platform URLs and enable flags — loaded from dealer settings. */
  platform_config:  Partial<Record<ReviewPlatform, ReviewPlatformConfig>>;
  default_platform: ReviewPlatform;
  response_tone:    "formal" | "friendly" | "professional";
  /** Compliance: dealer must approve every outbound review request. */
  require_approval: true;  // Locked — cannot be disabled in any version
}

export const DEFAULT_REPUTATION_CONTEXT: Omit<ReputationContext, "dealer_id" | "shop_name"> = {
  platform_config:  {},
  default_platform: "google",
  response_tone:    "friendly",
  require_approval: true,
};

// ─── Customer review model ────────────────────────────────────────────────────

export interface CustomerReview {
  review_id:      string;
  dealer_id:      string;
  platform:       ReviewPlatform;
  /** Optional: linked work order that triggered the review request. */
  job_id?:        string;
  reviewer_name:  string;
  rating:         1 | 2 | 3 | 4 | 5;
  text:           string;
  /** Direct URL to the posted review — for dealer reference. */
  review_url:     string;
  posted_at:      string;  // ISO 8601
  response_draft? :string; // Dealer-editable response draft (populated by agent)
}

// ─── Review request model ─────────────────────────────────────────────────────

export interface ReviewRequestPayload {
  customer_id:    string;
  customer_name:  string;
  /** Work order or completion report ID that triggered this request. */
  job_id:         string;
  platform:       ReviewPlatform;
  review_url:     string;
  /** Optional job summary — used by AI to personalize the message. */
  job_summary?:   string;
}

export interface ReviewRequestOutput {
  message_text:   string;   // AI-generated LINE message (dealer must approve)
  platform:       ReviewPlatform;
  review_url:     string;
  character_count:number;
  /** Compliance: always false until dealer presses "送信" — never auto-sent. */
  sent:           false;
}

// ─── Review response drafting model ──────────────────────────────────────────

export interface ReviewResponsePayload {
  review:         CustomerReview;
  tone?:          "formal" | "friendly" | "professional";
}

export interface ReviewResponseOutput {
  draft_text:     string;   // AI response draft — dealer edits before posting
  character_count:number;
  /** Compliance: always false — dealer posts manually, never auto-submitted. */
  auto_posted:    false;
}

// ─── Reputation analysis model ────────────────────────────────────────────────

export type ReviewSentimentType = "positive" | "neutral" | "negative";

export interface ReviewSentiment {
  type:  ReviewSentimentType;
  /** Confidence score: 0.0 (low confidence) – 1.0 (high confidence). */
  score: number;
}

export type ReviewServiceCategory =
  | "gyeon_coating"    // GYEON ceramic / paint protection coating
  | "ppf"              // Paint Protection Film
  | "window_tint"      // Window tinting / solar film
  | "detailing"        // Hand wash, polish, detail package
  | "maintenance"      // Scheduled maintenance, annual check
  | "consultation"     // Pre-job consultation
  | "other";

export interface ReviewKeyword {
  term:     string;
  count:    number;
  /** True if this keyword has value for local SEO / MEO purposes. */
  seo_relevant: boolean;
}

/**
 * LLMOMetadata — signals that help the dealer appear in LLM-generated responses.
 * Phase G: populated when AI analysis runs; empty in Sprint 10E.
 */
export interface LLMOMetadata {
  brand_mentions:    string[];   // "GYEON", "セラミックコーティング" etc.
  product_mentions:  string[];   // "Mohs+", "Light" etc.
  location_signals:  string[];   // City/area references in review text
  expertise_signals: string[];   // "プロ", "認定", "専門" etc.
  /** ISO date when this metadata was last extracted. */
  extracted_at?:     string;
}

export interface ReviewAnalysisResult {
  dealer_id:             string;
  period_start:          string;
  period_end:            string;
  review_count:          number;
  average_rating:        number;   // 1.0–5.0
  sentiment_breakdown:   Record<ReviewSentimentType, number>;  // counts per type
  top_keywords:          ReviewKeyword[];
  service_categories:    Partial<Record<ReviewServiceCategory, number>>;
  customer_satisfaction: number;   // Aggregated 1.0–5.0
  recommendation_score:  number;   // NPS-style 0–10
  local_seo_keywords:    string[];
  llmo_metadata:         LLMOMetadata;
  rating_distribution:   Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
  analyzed_at:           string;
}

// ─── Reputation analysis payload ──────────────────────────────────────────────

export interface ReputationAnalysisPayload {
  reviews:      CustomerReview[];
  period_start: string;   // ISO 8601 date "YYYY-MM-DD"
  period_end:   string;   // ISO 8601 date "YYYY-MM-DD"
}

// ─── Reputation dashboard (aggregated for dealer UI) ─────────────────────────

export interface ReputationDashboard {
  dealer_id:           string;
  period:              string;    // "YYYY-MM"
  analysis:            ReviewAnalysisResult;
  reviews_by_platform: Partial<Record<ReviewPlatform, number>>;
  trend:               "improving" | "stable" | "declining";
  /** Suggested action items based on analysis. Populated by agent (Phase G). */
  recommendations:     string[];
  generated_at:        string;
}

// ─── Marketing Agent feed (Phase F — discovery feedback loop) ─────────────────
// Reputation signals exported to the Marketing Agent for MEO/AEO/LLMO/AIO/SEO.
// See AI_REPUTATION_AGENT_ROADMAP.md §Principles: "Discovery feedback loop."

export interface MarketingAgentFeed {
  source:               "reputation_agent";
  dealer_id:            string;
  period:               string;
  top_keywords:         string[];
  local_seo_keywords:   string[];
  llmo_metadata:        LLMOMetadata;
  sentiment_signal:     ReviewSentimentType;
  service_strengths:    ReviewServiceCategory[];
  review_volume:        number;
  average_rating:       number;
  recommendation_score: number;
  /** Topics the Marketing Agent should prioritize based on review data. */
  suggested_content_topics: string[];
  generated_at:         string;
}

// ─── Agent request / response ─────────────────────────────────────────────────

interface BaseReputationRequest extends AIAgentRequest {
  agent_id: "reputation_agent";
}

export interface ReviewRequestGenerationRequest extends BaseReputationRequest {
  task_type: "review_request_generation";
  payload:   ReviewRequestPayload;
}

export interface ReviewResponseDraftingRequest extends BaseReputationRequest {
  task_type: "review_response_drafting";
  payload:   ReviewResponsePayload;
}

export interface ReputationAnalysisRequest extends BaseReputationRequest {
  task_type: "reputation_analysis";
  payload:   ReputationAnalysisPayload;
}

/** Discriminated union — narrowed by task_type in agent validate() and execute(). */
export type ReputationAgentRequest =
  | ReviewRequestGenerationRequest
  | ReviewResponseDraftingRequest
  | ReputationAnalysisRequest;

export interface ReputationAgentResponse extends AIAgentResponse {
  agent_id:         "reputation_agent";
  task_type:        AITaskType;
  /** Review request message draft — set when task_type = "review_request_generation". */
  review_request?:  ReviewRequestOutput;
  /** GBP response draft — set when task_type = "review_response_drafting". */
  review_response?: ReviewResponseOutput;
  /** Reputation analysis result — set when task_type = "reputation_analysis". */
  analysis?:        ReviewAnalysisResult;
  /** Marketing feed — set when analysis is complete and marketing integration enabled. */
  marketing_feed?:  MarketingAgentFeed;
}
