// DealerOS — AI Content Automation Platform: Core Domain Types (Sprint 11I Phase A)
//
// Canonical type definitions for the AI Content Automation Platform.
//
// The Content Automation Platform orchestrates the complete journey from a completed
// work order to dealer-approved social media publishing. It is the canonical
// social publishing subsystem for GYEON Detailer Agent.
//
// Eight core domain objects:
//   ContentProject     — the top-level container for one publishing run
//   ContentSource      — the originating work order and its media assets
//   StoryboardPlan     — the visual narrative plan (which media, in what order)
//   CaptionPlan        — the text content plan (caption, hashtags, alt text)
//   HashtagPlan        — hashtag strategy per channel
//   PublishingPlan     — the final approved plan ready for dispatch
//   ApprovalWorkflow   — the dealer approval state machine
//   PublishingSchedule — when and how often to publish
//   AutomationPolicy   — per-dealer governance rules
//
// Design principles:
//   - dealer_id always from getCurrentDealer() in every server-side consumer
//   - execution_deferred: true throughout — no publishing in Sprint 11I
//   - No social platform API calls — publishing is Phase 11J+
//   - No AI provider execution — content generation is Phase 11J+
//   - Provider-agnostic: agents are referenced by AIAgentId, not provider name
//
// Consumed by:
//   - Customer Engagement Platform (WORK_COMPLETED trigger source)
//   - Media Platform (source media assets)
//   - AI Marketing Platform (channel and campaign compatibility)
//   - AI Growth Platform (content performance signals)
//   - marketing_agent, video_agent, growth_agent via AI Gateway (Phase 11J+)
//
// Pure — no "use server", no external calls, no DB queries.

import type { AIAgentId }            from "@/lib/ai/agents/types";
import type { AppFeature }           from "@/lib/plans/plan-types";
import type { MarketingChannelId }   from "@/lib/marketing";
import type { MediaAsset }           from "@/lib/media";

// ─── Content project status ────────────────────────────────────────────────────

/**
 * ContentProjectStatus — lifecycle state of a content automation project.
 */
export type ContentProjectStatus =
  | "draft"              // Initial state — source selected, plans not yet generated
  | "planning"           // Pipeline is computing storyboard + caption plans
  | "ai_review"          // AI agent is reviewing generated plans (Phase 11J+)
  | "pending_approval"   // Dealer has been notified — awaiting approval decision
  | "approved"           // Dealer approved — publishing plan is locked
  | "scheduled"          // Publish time is set — awaiting trigger
  | "publishing"         // Publishing in progress (one or more channel dispatches active)
  | "published"          // Successfully published to all target channels
  | "partially_published"// Published to some channels; others failed or skipped
  | "rejected"           // Dealer rejected — requires revision or cancellation
  | "cancelled"          // Stopped before publishing — no external posts made
  | "archived";          // Lifecycle complete — retained for analytics

// ─── ContentSource ────────────────────────────────────────────────────────────

/**
 * ContentSource — the originating work order and its validated media assets.
 *
 * A ContentProject always starts from a completed work order.
 * dealer_id and work_order_id are the authoritative keys — never derived from media.
 */
export interface ContentSource {
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  work_order_id:      string;
  customer_id:        string | null;
  vehicle_id:         string | null;
  /** Service label for caption context (e.g., "GYEON QUARTZ coating"). */
  service_summary:    string;
  /** Selected media assets that passed the publishing permission gate. */
  approved_media:     MediaAsset[];
  /** Total available media — approved_media is a subset. */
  total_media_count:  number;
  /** True when the customer has consented to marketing use of their media. */
  consent_verified:   boolean;
  /** ISO 8601 timestamp of work order completion. */
  work_completed_at:  string;
  prepared_at:        string;
}

// ─── StoryboardPlan ───────────────────────────────────────────────────────────

/**
 * StoryboardScene — a single scene in the visual narrative.
 */
export interface StoryboardScene {
  sequence:         number;
  media_asset_id:   string;
  scene_type:       "before" | "during" | "after" | "detail" | "product" | "reveal";
  /** AI-generated scene description. null until Phase 11J+. */
  scene_description:string | null;
  /** Duration in seconds for video projects. null for static images. */
  duration_seconds: number | null;
  /** Suggested overlay text for the scene. null until Phase 11J+. */
  overlay_text:     string | null;
}

/**
 * StoryboardPlan — the visual narrative plan for a ContentProject.
 *
 * Defines which media assets appear, in what sequence, and what the visual
 * story arc is (before → during → after → reveal).
 * AI selects and sequences media in Phase 11J+.
 */
export interface StoryboardPlan {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  scenes:             StoryboardScene[];
  /** Primary narrative structure. */
  narrative_arc:      "before_after" | "process_story" | "product_showcase" | "reveal" | "custom";
  /** Suggested music or audio treatment. null until Phase 11J+. */
  audio_suggestion:   string | null;
  total_duration_s:   number | null;
  /** True when scenes were AI-selected. false = dealer-selected manually. */
  ai_curated:         boolean;
  ai_agent_id:        AIAgentId | null;
  created_at:         string;
  execution_deferred: true;
}

// ─── CaptionPlan ──────────────────────────────────────────────────────────────

/**
 * CaptionVariant — caption tailored for a specific channel.
 * Each channel has its own character limit and tone conventions.
 */
export interface CaptionVariant {
  channel_id:       MarketingChannelId;
  caption_text:     string | null;   // null until Phase 11J+
  char_count:       number;
  /** True when caption fits within the channel's character limit. */
  within_limit:     boolean;
  /** Tone applied: informative, aspirational, technical, casual. */
  tone:             "informative" | "aspirational" | "technical" | "casual";
  includes_cta:     boolean;
  cta_text:         string | null;
}

/**
 * CaptionPlan — the text content plan for a ContentProject.
 *
 * Variants allow the same content to be adapted per channel
 * (e.g., Instagram gets a short punchy caption; Google Business Profile gets a keyword-rich description).
 */
export interface CaptionPlan {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  /** Base caption before channel-specific adaptation. null until Phase 11J+. */
  base_caption:       string | null;
  /** Per-channel caption variants. */
  variants:           CaptionVariant[];
  /** Language the caption is written in. */
  language:           "ja" | "en";
  /** True when caption includes legal disclosures or consent indicators. */
  has_legal_note:     boolean;
  ai_agent_id:        AIAgentId | null;
  created_at:         string;
  execution_deferred: true;
}

// ─── HashtagPlan ──────────────────────────────────────────────────────────────

/**
 * HashtagSet — hashtags for a specific channel and purpose.
 */
export interface HashtagSet {
  channel_id:       MarketingChannelId;
  brand_tags:       string[];    // GYEON-specific brand hashtags
  service_tags:     string[];    // Service category hashtags (e.g., #ceramiccoating)
  location_tags:    string[];    // Local/regional hashtags
  seasonal_tags:    string[];    // Time-sensitive tags (e.g., #summer2026)
  trending_tags:    string[];    // AI-identified trending tags (Phase 11J+)
  total_count:      number;
  /** Recommended max for this channel (Instagram: 30, TikTok: 5–10). */
  channel_max:      number;
}

/**
 * HashtagPlan — hashtag strategy for all target channels in a ContentProject.
 */
export interface HashtagPlan {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  sets:               HashtagSet[];
  /** Master tag list — union of all brand + service tags. */
  master_tags:        string[];
  ai_agent_id:        AIAgentId | null;
  created_at:         string;
  execution_deferred: true;
}

// ─── PublishingPlan ───────────────────────────────────────────────────────────

/**
 * PublishingTarget — what to publish, where, and when for a single channel.
 */
export interface PublishingTarget {
  channel_id:         MarketingChannelId;
  /** Status for this specific channel within the plan. */
  status:             "pending" | "approved" | "skipped" | "published" | "failed";
  /** Resolved caption for this channel. null until plan is approved. */
  resolved_caption:   string | null;
  /** Resolved hashtags for this channel. */
  resolved_hashtags:  string[];
  /** Media asset IDs to include in this channel's post. */
  media_asset_ids:    string[];
  /** True when this channel requires a separate API call (not batch-publishable). */
  requires_individual_call: boolean;
  skipped_reason:     string | null;
}

/**
 * PublishingPlan — the final, dealer-approved plan ready for dispatch.
 *
 * This is the terminal output of the content automation pipeline.
 * dispatch_deferred: true — LINE/social API dispatch requires Phase 11J+.
 */
export interface PublishingPlan {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  targets:            PublishingTarget[];
  approved_by:        "dealer" | "system" | null;
  approved_at:        string | null;
  scheduled_at:       string | null;
  /** True when a dealer has reviewed and signed off on this plan. */
  dealer_confirmed:   boolean;
  /** Always true in Sprint 11I — social publishing requires Phase 11J+ */
  dispatch_deferred:  true;
  created_at:         string;
}

// ─── ApprovalWorkflow ─────────────────────────────────────────────────────────

/**
 * ApprovalDecision — a single dealer decision in the approval workflow.
 */
export type ApprovalDecision = "approved" | "rejected" | "revision_requested" | "skipped";

/**
 * ApprovalWorkflow — the dealer-facing approval state for a ContentProject.
 *
 * The dealer reviews the storyboard, caption, hashtags, and publishing targets.
 * They may approve the full plan, reject it, or request specific revisions.
 * Full approval model definitions are in approval-workflow.ts.
 */
export interface ApprovalWorkflow {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  mode:               "dealer_approval" | "scheduled" | "manual" | "draft_only" | "disabled";
  decision:           ApprovalDecision | null;
  decided_by:         string | null;
  decided_at:         string | null;
  /** Notes from the dealer (e.g., "change the caption on Instagram"). */
  dealer_notes:       string | null;
  revision_count:     number;
  max_revisions:      number;
  created_at:         string;
}

// ─── PublishingSchedule ───────────────────────────────────────────────────────

/**
 * PublishingSchedule — time-based publishing configuration for a ContentProject.
 *
 * Supports one-time scheduling and recurring campaigns.
 * AI suggests optimal publish times based on engagement data (Phase 11J+).
 */
export interface PublishingSchedule {
  content_project_id: string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  /** Target publish time. null = publish immediately after approval. */
  scheduled_at:       string | null;
  /** IANA timezone for the dealer's business location. */
  timezone:           string;
  /** Repeat policy: null = one-time publish. */
  repeat:             "none" | "daily" | "weekly" | "monthly" | null;
  /** How many times this schedule has been executed. */
  execution_count:    number;
  max_executions:     number | null;   // null = unlimited
  next_run_at:        string | null;
  /** AI-suggested optimal send time. null until Phase 11J+. */
  ai_suggested_time:  string | null;
  active:             boolean;
  execution_deferred: true;
}

// ─── AutomationPolicy ─────────────────────────────────────────────────────────

/**
 * AutomationPolicy — per-dealer governance rules for content automation.
 *
 * Controls which work orders trigger automation, what approval is required,
 * and which channels are included by default.
 *
 * Dealers may customize this policy (pending settings DB migration — CTO approval required).
 * DEFAULT_AUTOMATION_POLICY is the baseline for all new dealers.
 */
export interface AutomationPolicy {
  /** Always from getCurrentDealer(). */
  dealer_id:                   string;
  /** True when content automation runs automatically on WORK_COMPLETED. */
  auto_trigger_on_completion:  boolean;
  /** Minimum number of approved media assets required to start a project. */
  min_media_count:             number;
  approval_mode:               "dealer_approval" | "scheduled" | "manual" | "draft_only" | "disabled";
  /** Default channels to include in new projects. */
  default_channels:            MarketingChannelId[];
  /** True when hashtag AI optimization is enabled (Phase 11J+). */
  ai_hashtags_enabled:         boolean;
  /** True when caption AI generation is enabled (Phase 11J+). */
  ai_captions_enabled:         boolean;
  /** True when storyboard AI curation is enabled (Phase 11J+). */
  ai_storyboard_enabled:       boolean;
  required_features:           AppFeature[];
  enabled:                     boolean;
}

// ─── ContentProject ───────────────────────────────────────────────────────────

/**
 * ContentProject — the top-level container for one content automation run.
 *
 * A ContentProject is created when a work order is completed (via CE event) or
 * manually initiated by the dealer. It orchestrates the full pipeline from source
 * media to published social content.
 *
 * execution_deferred: true — no AI or social publishing in Sprint 11I.
 */
export interface ContentProject {
  id:                 string;
  /** Always from getCurrentDealer(). */
  dealer_id:          string;
  status:             ContentProjectStatus;
  source:             ContentSource;
  storyboard:         StoryboardPlan | null;
  caption:            CaptionPlan | null;
  hashtags:           HashtagPlan | null;
  publishing_plan:    PublishingPlan | null;
  approval:           ApprovalWorkflow;
  schedule:           PublishingSchedule | null;
  target_channels:    MarketingChannelId[];
  /** AI agents that will participate in this project (Phase 11J+). */
  ai_agents:          AIAgentId[];
  created_at:         string;
  updated_at:         string;
  /** True when this project was created from a WORK_COMPLETED CE event. */
  auto_triggered:     boolean;
  execution_deferred: true;
}
