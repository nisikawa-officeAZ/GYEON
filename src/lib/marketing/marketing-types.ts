// DealerOS — Marketing Domain Types
//
// Sprint 11A Phase A: canonical marketing business domain.
// This module contains all pure type definitions for the marketing platform.
// No imports from @/lib/media or external modules — types only.
//
// Security:
//   dealer_id is always from getCurrentDealer() in every server action.
//   It is never derived from client input, URL parameters, or campaign payloads.
//   MarketingPolicy.requires_media_consent = true by default — all campaigns
//   require verified customer consent before publishing customer media.

// ─── Channel identity ─────────────────────────────────────────────────────────

/**
 * Canonical identifier for all supported marketing distribution channels.
 * All 10 channels are defined upfront; availability is gated by available_now
 * in the channel registry (marketing-channel.ts) until API integration is complete.
 */
export type MarketingChannelId =
  | "instagram_feed"
  | "instagram_reels"
  | "instagram_stories"
  | "facebook"
  | "tiktok"
  | "youtube_shorts"
  | "x"
  | "google_business_profile"
  | "line_voom"
  | "website_news";

// ─── Campaign types ───────────────────────────────────────────────────────────

export type MarketingCampaignStatus =
  | "draft"               // Being composed — not yet submitted for review
  | "pending_approval"    // Submitted to dealer for approval
  | "approved"            // Dealer approved — ready to schedule
  | "scheduled"           // Publish time set — awaiting trigger
  | "publishing"          // Publishing in progress (one or more channel API calls active)
  | "published"           // Successfully published to all target channels
  | "partially_published" // Published to some channels; others failed
  | "paused"              // Temporarily halted
  | "completed"           // Campaign lifecycle complete
  | "archived"            // Retained for history but not actively served
  | "cancelled";          // Stopped before completion; never published

export type MarketingCampaignType =
  | "before_after_showcase"     // Vehicle condition comparison — before and after service
  | "service_highlight"         // Highlight a specific technique or service
  | "completion_showcase"       // Show finished work quality
  | "seasonal_promotion"        // Seasonal or event-based promotion
  | "customer_testimonial"      // Real customer review or feedback
  | "brand_awareness"           // General dealer brand building
  | "new_service_announcement"  // Announce a new or expanded service offering
  | "ai_generated_content";     // AI-generated promotional content (future — requires approval)

// ─── Asset types ──────────────────────────────────────────────────────────────

/**
 * The content type of a marketing asset.
 * Each type maps to specific media requirements and channel compatibility.
 */
export type MarketingAssetType =
  | "before_after_comparison"  // Side-by-side or swipe comparison of before/after photos
  | "work_progress_photo"      // Static photo captured during active work
  | "work_progress_video"      // Video captured during active work
  | "water_beading_video"      // Water beading test — signature proof of coating quality
  | "completion_photo"         // High-quality photo of finished vehicle
  | "completion_video"         // Cinematic video of finished vehicle
  | "ai_generated_image"       // Image produced by an AI generation pipeline
  | "ai_generated_video"       // Short-form video produced by AI (reel, short, VOOM)
  | "customer_testimonial"     // Customer-facing testimonial — photo or video
  | "review_highlight";        // Highlighted review excerpt — text + optional media

export type MarketingAssetStatus =
  | "draft"             // Initial state — asset record created, not yet submitted
  | "pending_review"    // Submitted to AI agent for quality / compliance review
  | "ai_reviewed"       // AI agent review complete — awaiting dealer decision
  | "pending_approval"  // Forwarded to dealer for manual approval
  | "approved"          // Dealer approved — eligible for scheduling
  | "scheduled"         // Publish time confirmed for at least one channel
  | "publishing"        // Actively being published to channels
  | "published"         // Published to all target channels
  | "failed"            // Publishing failed on at least one channel
  | "archived";         // Lifecycle complete — retained for audit

export type MarketingApprovalStatus =
  | "not_required"  // Policy does not require dealer approval for this asset type
  | "pending"       // Approval request sent to dealer — awaiting response
  | "approved"      // Dealer has explicitly approved this asset
  | "rejected";     // Dealer rejected — asset must be revised or discarded

/**
 * Record of a single publish event to a specific channel.
 * One MarketingAsset may have multiple publish records (one per channel, per attempt).
 */
export interface MarketingPublishRecord {
  channel:          MarketingChannelId;
  published_at:     string;             // ISO 8601
  external_post_id: string | null;      // Platform-assigned post ID (populated post-publish)
  external_url:     string | null;      // Public URL to the published post
  status:           "published" | "failed" | "deleted";
  failure_reason:   string | null;      // Non-null when status = "failed"
}

// ─── Audience ─────────────────────────────────────────────────────────────────

export type MarketingAudienceType =
  | "all_followers"            // Broadcast to all followers on the channel
  | "existing_customers"       // Target known dealer customers
  | "new_customer_acquisition" // Optimize for new customer discovery
  | "vehicle_type_segment"     // Target by vehicle make, type, or class
  | "service_interest_segment" // Target by expressed service interest
  | "geographic_segment";      // Target by geographic area

export type CustomerSegmentType =
  | "ceramic_coating_customers"  // Prior ceramic coating service history
  | "ppf_customers"              // Prior paint protection film history
  | "maintenance_customers"      // Maintenance plan subscribers
  | "detailing_customers"        // Detailing-only customers
  | "high_value_customers"       // Top revenue quartile
  | "lapsed_customers";          // No service in > 12 months

export interface MarketingAudience {
  type:                  MarketingAudienceType;
  geographic_area?:      string;               // City, prefecture, or region name
  customer_segments?:    CustomerSegmentType[];
  vehicle_types?:        string[];             // Vehicle make/type keys
  include_service_history?: boolean;           // Only include customers with confirmed service history
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type MarketingScheduleStatus =
  | "unscheduled"   // No publish time set
  | "scheduled"     // Publish time confirmed
  | "publishing"    // Currently publishing
  | "published"     // All channel publishes completed
  | "failed";       // At least one channel publish failed

export type MarketingRepeatFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly";

export interface MarketingRepeatPolicy {
  frequency:         MarketingRepeatFrequency;
  end_date?:         string;    // ISO 8601 — stop repeating after this date
  max_occurrences?:  number;    // Alternative to end_date
}

export interface MarketingSchedule {
  status:      MarketingScheduleStatus;
  publish_at:  string | null;   // ISO 8601 — null if unscheduled
  timezone:    string | null;   // IANA timezone (e.g., "Asia/Tokyo")
  repeat:      MarketingRepeatPolicy | null;
  expires_at:  string | null;   // ISO 8601 — content expires after this date
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Aggregate campaign performance data.
 * Never contains PII — counts only.
 * Populated by the future analytics collection runtime (Phase 11B+).
 */
export interface MarketingCampaignAnalytics {
  campaign_id:            string;
  dealer_id:              string;
  impressions:            number;
  reach:                  number;
  engagements:            number;
  clicks:                 number;
  conversions:            number;
  cost_per_engagement:    number | null;  // Null until cost tracking is implemented
  top_channel:            MarketingChannelId | null;
  collected_at:           string;   // ISO 8601 — when this snapshot was taken
}

// ─── Policy ───────────────────────────────────────────────────────────────────

export interface HashtagPolicy {
  max_hashtags:      number;
  required_hashtags: string[];   // Always included in every post from this campaign
  banned_hashtags:   string[];   // Never include these hashtags
  auto_generate:     boolean;    // Allow AI agent to add hashtags beyond required_hashtags
}

/**
 * MarketingPolicy — the governance layer for a campaign.
 *
 * Controls who must approve content, which channels are allowed,
 * posting frequency limits, and AI content rules.
 *
 * Default: requires_dealer_approval = true, requires_media_consent = true.
 * These defaults must not be weakened without explicit dealer configuration.
 */
export interface MarketingPolicy {
  requires_dealer_approval: boolean;   // Dealer must approve before publishing
  requires_media_consent:   boolean;   // Customer consent required for all source media
  allowed_channels:         MarketingChannelId[];  // Empty = no channels configured
  max_posts_per_day:        number | null;         // Rate limit per dealer per day
  min_hours_between_posts:  number | null;         // Cooldown between posts
  ai_content_allowed:       boolean;               // AI-generated content permitted
  watermark_required:       boolean;               // Dealer watermark on all published media
  hashtag_policy:           HashtagPolicy;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

/**
 * MarketingCampaign — the primary orchestration object for all marketing activity.
 *
 * A campaign coordinates multiple MarketingAssets published across one or more
 * channels to a defined audience on a defined schedule.
 *
 * Security: dealer_id is always from getCurrentDealer() in the creating server action.
 * asset_ids references MarketingAsset records owned by the same dealer.
 */
export interface MarketingCampaign {
  id:            string;
  /** Always from getCurrentDealer(). Never from client input. */
  dealer_id:     string;
  name:          string;
  description:   string | null;
  status:        MarketingCampaignStatus;
  campaign_type: MarketingCampaignType;
  channels:      MarketingChannelId[];
  audience:      MarketingAudience;
  schedule:      MarketingSchedule;
  /** IDs of MarketingAsset records associated with this campaign. */
  asset_ids:     string[];
  policy:        MarketingPolicy;
  analytics:     MarketingCampaignAnalytics | null;
  created_at:    string;
  updated_at:    string;
  /** UUID of the staff member who created this campaign. */
  created_by:    string | null;
}

// ─── Default policy ───────────────────────────────────────────────────────────

export const DEFAULT_HASHTAG_POLICY: HashtagPolicy = {
  max_hashtags:      30,   // Instagram platform limit
  required_hashtags: [],
  banned_hashtags:   [],
  auto_generate:     false,
};

/**
 * Default marketing policy — safe conservative baseline.
 *
 * Requires dealer approval and customer consent by default.
 * AI content and channel access must be explicitly enabled per campaign.
 * Never weaken requires_dealer_approval or requires_media_consent without
 * explicit dealer opt-in and consent.
 */
export const DEFAULT_MARKETING_POLICY: MarketingPolicy = {
  requires_dealer_approval: true,
  requires_media_consent:   true,
  allowed_channels:         [],    // Must be explicitly configured per campaign
  max_posts_per_day:        3,
  min_hours_between_posts:  4,
  ai_content_allowed:       false, // Must be explicitly enabled
  watermark_required:       true,
  hashtag_policy:           DEFAULT_HASHTAG_POLICY,
};

export const DEFAULT_MARKETING_AUDIENCE: MarketingAudience = {
  type: "all_followers",
};

export const DEFAULT_MARKETING_SCHEDULE: MarketingSchedule = {
  status:     "unscheduled",
  publish_at: null,
  timezone:   "Asia/Tokyo",
  repeat:     null,
  expires_at: null,
};
