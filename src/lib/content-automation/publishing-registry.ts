// DealerOS — AI Content Automation Platform: Publishing Registry (Sprint 11I Phase C)
//
// Centralized registry of all social media and web publishing destinations.
//
// 9 destinations:
//   1. instagram_feed          — Instagram in-feed static image or carousel
//   2. instagram_reels         — Instagram Reels short-form video
//   3. instagram_stories       — Instagram Stories (ephemeral, 24h)
//   4. facebook                — Facebook post (image, video, or text)
//   5. tiktok                  — TikTok short-form vertical video
//   6. youtube_shorts          — YouTube Shorts (≤ 60s vertical video)
//   7. google_business_profile — Google Business Profile photo/update post
//   8. line_voom               — LINE VOOM (LINE's social feed)
//   9. website_news            — Dealer's own website news/blog section
//
// All destinations have api_available: false in Sprint 11I.
// Social platform API integration requires Phase 11J+.
//
// Relationship to AI Marketing Platform:
//   ContentPublishingDestinationId maps 1:1 to MarketingChannelId from @/lib/marketing.
//   The publishing registry provides Content Automation-specific metadata
//   (consent requirements, optimization applicability) without duplicating
//   the channel capability registry.
//
// Pure — no "use server", no external calls.

import type { MarketingChannelId, MarketingContentFormat } from "@/lib/marketing";
import type { OptimizationTarget } from "@/lib/marketing";

// ─── Destination identifier ────────────────────────────────────────────────────

/**
 * ContentPublishingDestinationId — canonical destination identifiers.
 * Maps 1:1 to MarketingChannelId — use whichever fits the context.
 */
export type ContentPublishingDestinationId =
  | "instagram_feed"
  | "instagram_reels"
  | "instagram_stories"
  | "facebook"
  | "tiktok"
  | "youtube_shorts"
  | "google_business_profile"
  | "line_voom"
  | "website_news";

// ─── Destination descriptor ────────────────────────────────────────────────────

/**
 * ContentPublishingDestination — full descriptor for a single publishing destination.
 */
export interface ContentPublishingDestination {
  id:                         ContentPublishingDestinationId;
  /** Equivalent MarketingChannelId for cross-platform lookup. */
  marketing_channel_id:       MarketingChannelId;
  label:                      string;
  platform_name:              string;
  content_formats:            MarketingContentFormat[];
  max_media_per_post:         number;
  supports_video:             boolean;
  supports_captions:          boolean;
  supports_hashtags:          boolean;
  supports_links:             boolean;
  /** null = no platform-enforced limit. */
  caption_char_limit:         number | null;
  /** null = no limit. */
  max_video_duration_seconds: number | null;
  recommended_aspect_ratio:   string;
  /** Which optimization paradigms apply to content published here. */
  applicable_optimizations:   OptimizationTarget[];
  /** True when posting requires explicit customer media consent. */
  requires_customer_consent:  boolean;
  /** True when this destination is eligible for hashtag optimization. */
  hashtag_optimizable:        boolean;
  /**
   * True when the SEO/MEO metadata in the content is indexed by Google.
   * Only true for website_news and google_business_profile.
   */
  is_indexed_by_google:       boolean;
  /**
   * True when social API integration is implemented and active.
   * All false in Sprint 11I — integration requires Phase 11J+.
   */
  api_available:              false;
  api_blocked_reason:         string;
  implementation_sprint:      string;
}

// ─── PUBLISHING_DESTINATION_REGISTRY ──────────────────────────────────────────

/**
 * PUBLISHING_DESTINATION_REGISTRY — all 9 publishing destinations.
 *
 * api_available is always false — social API integration is Phase 11J+.
 * Destinations are ordered by expected implementation priority.
 */
export const PUBLISHING_DESTINATION_REGISTRY: readonly ContentPublishingDestination[] = [
  {
    id:                         "instagram_feed",
    marketing_channel_id:       "instagram_feed",
    label:                      "Instagram Feed",
    platform_name:              "Instagram",
    content_formats:            ["static_image", "image_carousel", "short_video"],
    max_media_per_post:         10,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          true,
    supports_links:             false,   // No clickable links in feed captions
    caption_char_limit:         2200,
    max_video_duration_seconds: 60,
    recommended_aspect_ratio:   "1:1",
    applicable_optimizations:   ["seo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        true,
    is_indexed_by_google:       false,
    api_available:              false,
    api_blocked_reason:         "Instagram Graph API integration deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "instagram_reels",
    marketing_channel_id:       "instagram_reels",
    label:                      "Instagram Reels",
    platform_name:              "Instagram",
    content_formats:            ["reel", "short_video"],
    max_media_per_post:         1,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          true,
    supports_links:             false,
    caption_char_limit:         2200,
    max_video_duration_seconds: 90,
    recommended_aspect_ratio:   "9:16",
    applicable_optimizations:   ["seo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        true,
    is_indexed_by_google:       false,
    api_available:              false,
    api_blocked_reason:         "Instagram Graph API (Reels publishing) deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "instagram_stories",
    marketing_channel_id:       "instagram_stories",
    label:                      "Instagram Stories",
    platform_name:              "Instagram",
    content_formats:            ["story", "static_image", "short_video"],
    max_media_per_post:         1,
    supports_video:             true,
    supports_captions:          false,  // Stories text is handled as overlay, not caption
    supports_hashtags:          true,
    supports_links:             true,   // Link sticker available
    caption_char_limit:         null,
    max_video_duration_seconds: 15,
    recommended_aspect_ratio:   "9:16",
    applicable_optimizations:   [],     // Stories are ephemeral — no SEO benefit
    requires_customer_consent:  true,
    hashtag_optimizable:        false,
    is_indexed_by_google:       false,
    api_available:              false,
    api_blocked_reason:         "Instagram Stories API deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "facebook",
    marketing_channel_id:       "facebook",
    label:                      "Facebook",
    platform_name:              "Facebook",
    content_formats:            ["static_image", "image_carousel", "short_video", "long_video", "link_post"],
    max_media_per_post:         10,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          true,
    supports_links:             true,
    caption_char_limit:         63206,
    max_video_duration_seconds: 14400,  // 4 hours
    recommended_aspect_ratio:   "1:1",
    applicable_optimizations:   ["seo", "meo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        false,  // Hashtags less impactful on Facebook
    is_indexed_by_google:       true,   // Facebook posts are partially indexed
    api_available:              false,
    api_blocked_reason:         "Meta Graph API integration deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "tiktok",
    marketing_channel_id:       "tiktok",
    label:                      "TikTok",
    platform_name:              "TikTok",
    content_formats:            ["reel", "short_video"],
    max_media_per_post:         1,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          true,
    supports_links:             false,  // No links in TikTok video captions
    caption_char_limit:         2200,
    max_video_duration_seconds: 600,    // 10 minutes
    recommended_aspect_ratio:   "9:16",
    applicable_optimizations:   ["llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        true,
    is_indexed_by_google:       false,
    api_available:              false,
    api_blocked_reason:         "TikTok Content Posting API deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "youtube_shorts",
    marketing_channel_id:       "youtube_shorts",
    label:                      "YouTube Shorts",
    platform_name:              "YouTube",
    content_formats:            ["reel", "short_video"],
    max_media_per_post:         1,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          true,
    supports_links:             false,
    caption_char_limit:         100,   // Shorts title limit
    max_video_duration_seconds: 60,
    recommended_aspect_ratio:   "9:16",
    applicable_optimizations:   ["seo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        true,
    is_indexed_by_google:       true,  // YouTube is Google-owned — fully indexed
    api_available:              false,
    api_blocked_reason:         "YouTube Data API v3 integration deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "google_business_profile",
    marketing_channel_id:       "google_business_profile",
    label:                      "Google Business Profile",
    platform_name:              "Google",
    content_formats:            ["static_image", "text_only", "link_post"],
    max_media_per_post:         10,
    supports_video:             false,
    supports_captions:          true,
    supports_hashtags:          false,
    supports_links:             true,
    caption_char_limit:         1500,
    max_video_duration_seconds: null,
    recommended_aspect_ratio:   "4:3",
    applicable_optimizations:   ["seo", "meo", "aeo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        false,
    is_indexed_by_google:       true,   // GBP posts appear directly in Google Search and Maps
    api_available:              false,
    api_blocked_reason:         "Google Business Profile API integration deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "line_voom",
    marketing_channel_id:       "line_voom",
    label:                      "LINE VOOM",
    platform_name:              "LINE",
    content_formats:            ["static_image", "short_video", "text_only"],
    max_media_per_post:         20,
    supports_video:             true,
    supports_captions:          true,
    supports_hashtags:          false,
    supports_links:             true,
    caption_char_limit:         10000,
    max_video_duration_seconds: 600,
    recommended_aspect_ratio:   "1:1",
    applicable_optimizations:   [],    // LINE VOOM is a closed ecosystem — no Google indexing
    requires_customer_consent:  true,
    hashtag_optimizable:        false,
    is_indexed_by_google:       false,
    api_available:              false,
    api_blocked_reason:         "LINE Messaging API (VOOM publishing) deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },

  {
    id:                         "website_news",
    marketing_channel_id:       "website_news",
    label:                      "Website News",
    platform_name:              "Dealer Website",
    content_formats:            ["static_image", "image_carousel", "article", "link_post"],
    max_media_per_post:         20,
    supports_video:             false,
    supports_captions:          true,
    supports_hashtags:          false,
    supports_links:             true,
    caption_char_limit:         null,
    max_video_duration_seconds: null,
    recommended_aspect_ratio:   "16:9",
    applicable_optimizations:   ["seo", "meo", "aeo", "llmo", "aio"],
    requires_customer_consent:  true,
    hashtag_optimizable:        false,
    is_indexed_by_google:       true,   // Dealer website is fully indexed
    api_available:              false,
    api_blocked_reason:         "Website CMS publishing deferred to Sprint 11J+",
    implementation_sprint:      "Sprint 11J",
  },
] as const;

// ─── Registry helpers ──────────────────────────────────────────────────────────

/** Returns the destination descriptor for a given ID. */
export function getPublishingDestination(
  id: ContentPublishingDestinationId,
): ContentPublishingDestination | undefined {
  return PUBLISHING_DESTINATION_REGISTRY.find((d) => d.id === id);
}

/** Returns all destinations that apply a given optimization target. */
export function getDestinationsForOptimization(
  target: OptimizationTarget,
): readonly ContentPublishingDestination[] {
  return PUBLISHING_DESTINATION_REGISTRY.filter((d) =>
    d.applicable_optimizations.includes(target),
  );
}

/** Returns all destinations that support video content. */
export function getVideoDestinations(): readonly ContentPublishingDestination[] {
  return PUBLISHING_DESTINATION_REGISTRY.filter((d) => d.supports_video);
}

/** Returns all destinations that are indexed by Google (SEO-relevant). */
export function getGoogleIndexedDestinations(): readonly ContentPublishingDestination[] {
  return PUBLISHING_DESTINATION_REGISTRY.filter((d) => d.is_indexed_by_google);
}

/** Returns all destinations that support hashtag optimization. */
export function getHashtagOptimizableDestinations(): readonly ContentPublishingDestination[] {
  return PUBLISHING_DESTINATION_REGISTRY.filter((d) => d.hashtag_optimizable);
}

/**
 * destinationToChannelId — maps a ContentPublishingDestinationId to MarketingChannelId.
 * All IDs are identical — this is a type bridge for consumers that hold MarketingChannelId.
 */
export function destinationToChannelId(
  id: ContentPublishingDestinationId,
): MarketingChannelId {
  return id as MarketingChannelId;
}
