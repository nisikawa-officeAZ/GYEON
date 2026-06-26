// DealerOS — Marketing Channel Registry
//
// Sprint 11A Phase C: centralized registry of all future marketing channels.
//
// All 10 channels are defined up-front with full capability metadata.
// available_now = false for all channels — no API integrations are implemented.
// Channel integration follows a per-channel activation process (Phase 11B+).
//
// Channel IDs are defined in marketing-types.ts as MarketingChannelId.
// This module provides the full capability registry for consumers.

import type { MarketingChannelId } from "./marketing-types";

// ─── Content formats ──────────────────────────────────────────────────────────

/**
 * The type of content a channel can receive.
 * Channels may support multiple formats simultaneously.
 */
export type MarketingContentFormat =
  | "static_image"      // Single static photo
  | "image_carousel"    // Multiple photos in a swipeable carousel
  | "short_video"       // Short-form vertical video (≤ 60s)
  | "long_video"        // Longer video (> 60s)
  | "text_only"         // Text post without media
  | "link_post"         // Post with a URL preview card
  | "story"             // Ephemeral story format (24h)
  | "reel"              // Short-form algorithmic video feed
  | "live_stream"       // Live broadcast (future)
  | "article";          // Long-form editorial content

// ─── Platform identity ────────────────────────────────────────────────────────

export type MarketingPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "x"
  | "google"
  | "line"
  | "owned_website";

// ─── Channel entry ────────────────────────────────────────────────────────────

export interface MarketingChannelEntry {
  id:                  MarketingChannelId;
  label:               string;
  platform:            MarketingPlatform;
  content_formats:     MarketingContentFormat[];
  max_media_per_post:  number;               // Maximum media items per single post
  supports_video:      boolean;
  supports_text:       boolean;
  supports_hashtags:   boolean;
  supports_links:      boolean;
  character_limit:     number | null;        // null = no platform-enforced limit
  recommended_aspect_ratio: string | null;   // e.g., "9:16", "1:1", "4:5"
  max_video_duration_seconds: number | null; // null = no limit
  /** True when the channel API integration is implemented and active. */
  available_now:       boolean;
  /** Reason this channel is not yet available (when available_now = false). */
  blocked_by?:         string;
  notes?:              string;
}

// ─── Channel registry ─────────────────────────────────────────────────────────

/**
 * MARKETING_CHANNEL_REGISTRY — canonical registry of all future channels.
 *
 * All 10 channels are defined with full capability metadata.
 * No channel is available now — API integration required for each.
 * Phase 11B: implement Instagram + Google Business Profile first.
 */
export const MARKETING_CHANNEL_REGISTRY: ReadonlyArray<MarketingChannelEntry> = [
  {
    id:                       "instagram_feed",
    label:                    "Instagram Feed",
    platform:                 "instagram",
    content_formats:          ["static_image", "image_carousel", "short_video"],
    max_media_per_post:       10,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           false,   // No clickable links in caption
    character_limit:          2200,
    recommended_aspect_ratio: "4:5",
    max_video_duration_seconds: 60,
    available_now:            false,
    blocked_by:               "Instagram Graph API integration not yet implemented",
  },
  {
    id:                       "instagram_reels",
    label:                    "Instagram Reels",
    platform:                 "instagram",
    content_formats:          ["reel"],
    max_media_per_post:       1,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           false,
    character_limit:          2200,
    recommended_aspect_ratio: "9:16",
    max_video_duration_seconds: 90,
    available_now:            false,
    blocked_by:               "Instagram Graph API integration not yet implemented",
  },
  {
    id:                       "instagram_stories",
    label:                    "Instagram Stories",
    platform:                 "instagram",
    content_formats:          ["story", "static_image", "short_video"],
    max_media_per_post:       1,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           true,   // Link sticker available
    character_limit:          null,
    recommended_aspect_ratio: "9:16",
    max_video_duration_seconds: 15,
    available_now:            false,
    blocked_by:               "Instagram Graph API integration not yet implemented",
    notes:                    "Stories expire after 24 hours unless saved to Highlights",
  },
  {
    id:                       "facebook",
    label:                    "Facebook Page",
    platform:                 "facebook",
    content_formats:          ["static_image", "image_carousel", "short_video", "long_video", "text_only", "link_post"],
    max_media_per_post:       10,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           true,
    character_limit:          63206,
    recommended_aspect_ratio: "1:1",
    max_video_duration_seconds: 240 * 60,  // 4 hours
    available_now:            false,
    blocked_by:               "Facebook Graph API integration not yet implemented",
  },
  {
    id:                       "tiktok",
    label:                    "TikTok",
    platform:                 "tiktok",
    content_formats:          ["reel", "short_video", "long_video"],
    max_media_per_post:       1,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           false,
    character_limit:          2200,
    recommended_aspect_ratio: "9:16",
    max_video_duration_seconds: 10 * 60,  // 10 minutes
    available_now:            false,
    blocked_by:               "TikTok Content Posting API integration not yet implemented",
    notes:                    "TikTok API access requires business account and content moderation review",
  },
  {
    id:                       "youtube_shorts",
    label:                    "YouTube Shorts",
    platform:                 "youtube",
    content_formats:          ["reel", "short_video"],
    max_media_per_post:       1,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           false,
    character_limit:          100,   // Title limit
    recommended_aspect_ratio: "9:16",
    max_video_duration_seconds: 60,
    available_now:            false,
    blocked_by:               "YouTube Data API v3 integration not yet implemented",
  },
  {
    id:                       "x",
    label:                    "X (Twitter)",
    platform:                 "x",
    content_formats:          ["static_image", "short_video", "text_only"],
    max_media_per_post:       4,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           true,
    character_limit:          280,
    recommended_aspect_ratio: "16:9",
    max_video_duration_seconds: 2 * 60 + 20,  // 2 min 20 sec
    available_now:            false,
    blocked_by:               "X API v2 integration not yet implemented",
    notes:                    "X API access requires paid developer plan",
  },
  {
    id:                       "google_business_profile",
    label:                    "Google Business Profile",
    platform:                 "google",
    content_formats:          ["static_image", "short_video", "text_only"],
    max_media_per_post:       10,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        false,   // GBP does not support hashtags
    supports_links:           true,    // Call-to-action button with URL
    character_limit:          1500,
    recommended_aspect_ratio: "4:3",
    max_video_duration_seconds: 30,
    available_now:            false,
    blocked_by:               "Google Business Profile API integration not yet implemented",
    notes:                    "GBP posts expire after 7 days unless type is Event or Offer",
  },
  {
    id:                       "line_voom",
    label:                    "LINE VOOM",
    platform:                 "line",
    content_formats:          ["static_image", "image_carousel", "short_video", "long_video", "text_only"],
    max_media_per_post:       20,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           true,
    character_limit:          1000,
    recommended_aspect_ratio: "1:1",
    max_video_duration_seconds: 5 * 60,  // 5 minutes
    available_now:            false,
    blocked_by:               "LINE VOOM API integration not yet implemented",
    notes:                    "LINE VOOM is the public social feed for LINE Official Accounts",
  },
  {
    id:                       "website_news",
    label:                    "Website News",
    platform:                 "owned_website",
    content_formats:          ["article", "static_image", "image_carousel", "short_video", "long_video", "text_only"],
    max_media_per_post:       50,
    supports_video:           true,
    supports_text:            true,
    supports_hashtags:        true,
    supports_links:           true,
    character_limit:          null,
    recommended_aspect_ratio: "16:9",
    max_video_duration_seconds: null,
    available_now:            false,
    blocked_by:               "Dealer website CMS integration not yet implemented",
    notes:                    "Owned channel — no third-party API; requires dealer website CMS connection",
  },
] as const;

// ─── Registry query helpers ───────────────────────────────────────────────────

/**
 * Returns the channel entry for a given channel ID.
 * Returns undefined for unknown IDs.
 */
export function getChannel(id: MarketingChannelId): MarketingChannelEntry | undefined {
  return MARKETING_CHANNEL_REGISTRY.find((c) => c.id === id);
}

/**
 * Returns all channels on the given platform.
 */
export function getChannelsByPlatform(
  platform: MarketingPlatform,
): MarketingChannelEntry[] {
  return MARKETING_CHANNEL_REGISTRY.filter((c) => c.platform === platform);
}

/**
 * Returns all channels currently available for use.
 * In the current state, this always returns an empty array.
 * Phase 11B+ will flip individual channels to available_now = true.
 */
export function getAvailableChannels(): MarketingChannelEntry[] {
  return MARKETING_CHANNEL_REGISTRY.filter((c) => c.available_now);
}

/**
 * Returns all channels that are not yet available and their blockers.
 */
export function getBlockedChannels(): MarketingChannelEntry[] {
  return MARKETING_CHANNEL_REGISTRY.filter((c) => !c.available_now);
}

/**
 * Returns true if the given channel supports the given content format.
 */
export function channelSupportsFormat(
  channelId: MarketingChannelId,
  format:    MarketingContentFormat,
): boolean {
  const channel = getChannel(channelId);
  return channel?.content_formats.includes(format) ?? false;
}

/**
 * Returns all content formats supported by a specific channel.
 */
export function getSupportedFormats(
  channelId: MarketingChannelId,
): MarketingContentFormat[] {
  return getChannel(channelId)?.content_formats ?? [];
}

/**
 * Returns the subset of given channel IDs that are valid (registered) channels.
 */
export function filterValidChannels(channelIds: string[]): MarketingChannelId[] {
  const validIds = new Set(MARKETING_CHANNEL_REGISTRY.map((c) => c.id));
  return channelIds.filter((id): id is MarketingChannelId => validIds.has(id as MarketingChannelId));
}
