// DealerOS — AI Agent Media Compatibility Layer
//
// Sprint 10J: canonical interface between DealerMedia and AI agents.
// All AI agents (marketing_agent, reputation_agent, growth_agent) must consume
// media through this layer — never via raw file URLs or arbitrary DealerMedia fields.
//
// No AI provider execution. No external API calls.
// This module provides: types, gate validation, and aggregate helpers.
//
// Security:
//   - dealer_id is verified in every gate function (cross-dealer access is forbidden)
//   - consent_status = "denied" always blocks AI access
//   - is_ai_training_excluded blocks AI training workflows permanently
//   - marketing use requires all three gates: visibility + is_marketing_approved + consent = approved

import type { DealerMedia, MediaType, MediaForMarketing } from "./media-types";
import { getMarketingApprovedMedia } from "./media-types";
import type { AIAgentId } from "@/lib/ai/agents/types";

// ─── AI capability request ────────────────────────────────────────────────────

/**
 * The category of AI operation being requested.
 * Each type has different permission requirements.
 */
export type MediaAICapabilityType =
  | "ai_analysis"    // Quality scoring, defect detection, scene understanding
  | "ai_marketing";  // Content generation — captions, hashtags, platform posts

export interface MediaAICapabilityRequest {
  capability: MediaAICapabilityType;
  media:      DealerMedia;
  agent_id:   AIAgentId;
  /** Must match media.dealer_id. Verified inside checkMediaAICapability(). */
  dealer_id:  string;
}

// ─── Gate result ──────────────────────────────────────────────────────────────

export type MediaAIGateResult =
  | { allowed: true;  media_for_ai: MediaForAI;  agent_id: AIAgentId }
  | { allowed: false; reason: string;             agent_id: AIAgentId };

// ─── Canonical AI media interface ─────────────────────────────────────────────

/**
 * Minimal media representation for passing to AI agents.
 * All AI agents must accept MediaForAI rather than full DealerMedia.
 *
 * Rules before constructing this object:
 *   1. dealer_id verified by gate function.
 *   2. consent_status != "denied".
 *   3. For ai_marketing: all three marketing gates passed.
 *   4. For ai_analysis: visibility >= customer_visible.
 *   5. file_url must not expose unblurred license plates or faces (Phase 10J: enforce in pipeline).
 */
export interface MediaForAI {
  id:                      string;
  dealer_id:               string;
  media_type:              MediaType;
  file_url:                string | null;
  mime_type:               string | null;
  width:                   number | null;   // null until Phase 10J metadata extraction
  height:                  number | null;
  duration_seconds:        number | null;   // null until Phase 10J extraction
  is_ai_training_excluded: boolean;
  is_marketing_approved:   boolean;
}

// ─── Agent-specific media interfaces ─────────────────────────────────────────

/**
 * Media consumed by marketing_agent.
 * Must come from getMarketingApprovedMedia() — do not construct directly.
 */
export type MediaForMarketingAgent = MediaForMarketing;

/**
 * Media consumed by reputation_agent for quality review workflows.
 * Operates on internal media — no consent required for internal quality scoring.
 * Must not be passed to external AI providers without additional consent checks.
 */
export interface MediaForReputationAgent {
  id:         string;
  dealer_id:  string;
  media_type: MediaType;
  file_url:   string | null;
  mime_type:  string | null;
}

/**
 * Aggregate media statistics consumed by growth_agent.
 * Raw media URLs are never exposed — aggregate counts only.
 */
export interface MediaForGrowthAgent {
  dealer_id:               string;
  total_photos:            number;
  total_videos:            number;
  marketing_approved_count: number;
  consent_pending_count:   number;
}

// ─── Gate function ────────────────────────────────────────────────────────────

/**
 * Validates whether a media asset may be passed to an AI agent for the given capability.
 *
 * Permission matrix:
 *   ai_analysis:  visibility >= customer_visible, consent != denied
 *   ai_marketing: visibility = marketing_approved, consent = approved, is_marketing_approved = true
 *
 * Returns MediaForAI on success — a safe, minimal view of the asset.
 * Returns a denial reason string on failure.
 */
export function checkMediaAICapability(
  request: MediaAICapabilityRequest,
): MediaAIGateResult {
  const { capability, media, agent_id, dealer_id } = request;

  // Dealer isolation — never allow cross-dealer media access
  if (media.dealer_id !== dealer_id) {
    return {
      allowed:  false,
      reason:   "Media dealer_id does not match request dealer_id. Cross-dealer access is forbidden.",
      agent_id,
    };
  }

  // Denied consent blocks all AI access
  if (media.consent_status === "denied") {
    return {
      allowed:  false,
      reason:   "Customer has denied consent. This media cannot be used by AI agents.",
      agent_id,
    };
  }

  if (capability === "ai_marketing") {
    if (
      media.visibility            !== "marketing_approved" ||
      media.is_marketing_approved !== true               ||
      media.consent_status        !== "approved"
    ) {
      return {
        allowed:  false,
        reason:
          "AI marketing requires: visibility = marketing_approved, " +
          "is_marketing_approved = true, and consent_status = approved.",
        agent_id,
      };
    }
  }

  if (capability === "ai_analysis") {
    if (media.visibility === "internal_only") {
      return {
        allowed:  false,
        reason:   "AI analysis requires visibility >= customer_visible.",
        agent_id,
      };
    }
  }

  const mediaForAI: MediaForAI = {
    id:                      media.id,
    dealer_id:               media.dealer_id,
    media_type:              media.media_type,
    file_url:                media.file_url,
    mime_type:               media.mime_type,
    width:                   media.width,
    height:                  media.height,
    duration_seconds:        media.duration_seconds,
    is_ai_training_excluded: media.is_ai_training_excluded,
    is_marketing_approved:   media.is_marketing_approved,
  };

  return { allowed: true, media_for_ai: mediaForAI, agent_id };
}

// ─── Agent-specific builders ──────────────────────────────────────────────────

/**
 * Filters a DealerMedia list to marketing-approved assets for marketing_agent.
 * Wrapper around getMarketingApprovedMedia() — provides agent-specific typing.
 */
export function getMediaForMarketingAgent(
  media:    DealerMedia[],
  dealerId: string,
): MediaForMarketingAgent[] {
  return getMarketingApprovedMedia(media.filter((m) => m.dealer_id === dealerId));
}

/**
 * Extracts reputation_agent-safe media for internal quality review.
 * Returns only assets with visibility >= customer_visible and consent != denied.
 */
export function getMediaForReputationAgent(
  media:    DealerMedia[],
  dealerId: string,
): MediaForReputationAgent[] {
  return media
    .filter(
      (m) =>
        m.dealer_id      === dealerId &&
        m.consent_status !== "denied" &&
        m.visibility     !== "internal_only",
    )
    .map((m) => ({
      id:         m.id,
      dealer_id:  m.dealer_id,
      media_type: m.media_type,
      file_url:   m.file_url,
      mime_type:  m.mime_type,
    }));
}

/**
 * Builds aggregate statistics for growth_agent.
 * Exposes counts only — raw media URLs are never included.
 */
export function buildMediaForGrowthAgent(
  media:    DealerMedia[],
  dealerId: string,
): MediaForGrowthAgent {
  const ownMedia = media.filter((m) => m.dealer_id === dealerId);
  return {
    dealer_id:               dealerId,
    total_photos:            ownMedia.filter((m) => m.media_type === "photo").length,
    total_videos:            ownMedia.filter((m) => m.media_type === "video").length,
    marketing_approved_count: getMarketingApprovedMedia(ownMedia).length,
    consent_pending_count:   ownMedia.filter((m) => m.consent_status === "pending").length,
  };
}
