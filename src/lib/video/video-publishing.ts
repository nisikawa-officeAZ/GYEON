// DealerOS — Video Publishing Profile Registry
//
// Sprint 11B Phase D: publishing profiles for the AI Video Pipeline.
//
// This module defines the VIDEO_PUBLISHING_PROFILE_REGISTRY — a read-only
// registry of all 9 supported publishing destinations with their full
// technical specifications.
//
// Each profile specifies:
//   - aspect_ratio, resolution, frame_rate: output geometry
//   - target/max/min duration: temporal constraints
//   - subtitle_policy: whether subtitles are required/recommended
//   - logo_policy: whether the dealer logo must appear
//   - watermark_policy: whether a watermark must be burned in
//   - thumbnail_policy: whether an explicit thumbnail must be set
//   - available_now: all currently false — no publishing infrastructure yet
//
// No API integrations. No publishing logic. Registry only.
//
// Relationship to @/lib/marketing/marketing-channel.ts:
//   marketing-channel.ts defines MarketingChannelEntry for text/image content.
//   video-publishing.ts defines VideoPublishingProfile for VIDEO content.
//   They share VideoPublishingProfileId for cross-referencing.

import type {
  VideoPublishingProfileId,
  VideoAspectRatio,
  VideoResolution,
  VideoFrameRate,
  VideoSubtitlePolicy,
  VideoLogoPolicy,
  VideoWatermarkPolicy,
  VideoThumbnailPolicy,
} from "./video-types";

// ─── VideoPublishingProfile ───────────────────────────────────────────────────

/**
 * VideoPublishingProfile — technical specification for a publishing destination.
 *
 * Defines all constraints the AI generation pipeline must respect when
 * producing video output for a specific platform and format.
 */
export interface VideoPublishingProfile {
  id:                       VideoPublishingProfileId;
  label:                    string;
  platform:                 string;
  aspect_ratio:             VideoAspectRatio;
  resolution:               VideoResolution;
  frame_rate:               VideoFrameRate;
  target_duration_seconds:  number;   // Ideal duration for best platform performance
  max_duration_seconds:     number;   // Hard platform limit
  min_duration_seconds:     number;   // Below this, the platform may reject
  subtitle_policy:          VideoSubtitlePolicy;
  logo_policy:              VideoLogoPolicy;
  watermark_policy:         VideoWatermarkPolicy;
  thumbnail_policy:         VideoThumbnailPolicy;
  available_now:            boolean;
  blocked_by?:              string;
  notes?:                   string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * VIDEO_PUBLISHING_PROFILE_REGISTRY — canonical specifications for all 9 destinations.
 *
 * All profiles have available_now = false.
 * Publishing infrastructure (API credentials, queue, delivery pipeline)
 * requires separate CTO approval and Phase 11C+ implementation.
 */
export const VIDEO_PUBLISHING_PROFILE_REGISTRY: ReadonlyArray<VideoPublishingProfile> = [
  {
    id:                      "instagram_reels",
    label:                   "Instagram Reels",
    platform:                "instagram",
    aspect_ratio:            "9:16",
    resolution:              "1080x1920",
    frame_rate:              30,
    target_duration_seconds: 30,
    max_duration_seconds:    90,
    min_duration_seconds:    3,
    subtitle_policy:         "recommended",   // 85% of Instagram video is watched without sound
    logo_policy:             "optional",      // Organic posts penalized by algorithm for heavy branding
    watermark_policy:        "optional",
    thumbnail_policy:        "recommended",
    available_now:           false,
    blocked_by:              "Instagram Graph API credentials and business account not yet configured",
    notes:                   "Target 15–30s for highest completion rate. Auto-captions available natively after posting.",
  },
  {
    id:                      "instagram_stories",
    label:                   "Instagram Stories",
    platform:                "instagram",
    aspect_ratio:            "9:16",
    resolution:              "1080x1920",
    frame_rate:              30,
    target_duration_seconds: 10,
    max_duration_seconds:    15,
    min_duration_seconds:    1,
    subtitle_policy:         "recommended",
    logo_policy:             "optional",
    watermark_policy:        "not_allowed",   // Stories reject watermarks in organic API posts
    thumbnail_policy:        "not_applicable", // Stories have no thumbnail — auto-play only
    available_now:           false,
    blocked_by:              "Instagram Graph API credentials and business account not yet configured",
    notes:                   "Ephemeral content — expires 24h. Clips > 15s are auto-split by platform.",
  },
  {
    id:                      "tiktok",
    label:                   "TikTok",
    platform:                "tiktok",
    aspect_ratio:            "9:16",
    resolution:              "1080x1920",
    frame_rate:              30,
    target_duration_seconds: 45,
    max_duration_seconds:    600,   // 10 minutes for verified accounts
    min_duration_seconds:    3,
    subtitle_policy:         "recommended",   // TikTok auto-captions have high engagement signal
    logo_policy:             "optional",
    watermark_policy:        "optional",
    thumbnail_policy:        "recommended",
    available_now:           false,
    blocked_by:              "TikTok for Business API application and approval required",
    notes:                   "15–60s performs best for automotive content. TikTok re-encodes at 1080p regardless of source.",
  },
  {
    id:                      "youtube_shorts",
    label:                   "YouTube Shorts",
    platform:                "youtube",
    aspect_ratio:            "9:16",
    resolution:              "1080x1920",
    frame_rate:              30,
    target_duration_seconds: 40,
    max_duration_seconds:    60,
    min_duration_seconds:    15,
    subtitle_policy:         "optional",      // YouTube has auto-captions; burned subtitles are double
    logo_policy:             "optional",
    watermark_policy:        "optional",
    thumbnail_policy:        "recommended",
    available_now:           false,
    blocked_by:              "YouTube Data API v3 OAuth2 credentials and channel not yet configured",
    notes:                   "Must be 9:16 and ≤ 60s to qualify as Shorts. Title ≤ 100 chars.",
  },
  {
    id:                      "facebook_reels",
    label:                   "Facebook Reels",
    platform:                "facebook",
    aspect_ratio:            "9:16",
    resolution:              "1080x1920",
    frame_rate:              30,
    target_duration_seconds: 30,
    max_duration_seconds:    90,
    min_duration_seconds:    3,
    subtitle_policy:         "recommended",
    logo_policy:             "optional",
    watermark_policy:        "optional",
    thumbnail_policy:        "recommended",
    available_now:           false,
    blocked_by:              "Facebook Graph API credentials and business page not yet configured",
    notes:                   "Shares the Instagram Graph API surface. Same credentials as instagram_reels once configured.",
  },
  {
    id:                      "google_business_profile",
    label:                   "Google Business Profile",
    platform:                "google",
    aspect_ratio:            "16:9",
    resolution:              "1920x1080",
    frame_rate:              30,
    target_duration_seconds: 20,
    max_duration_seconds:    30,
    min_duration_seconds:    5,
    subtitle_policy:         "not_applicable",   // GBP video posts do not surface subtitles prominently
    logo_policy:             "required",         // GBP is a dealer-brand touchpoint — logo must appear
    watermark_policy:        "required",
    thumbnail_policy:        "not_applicable",
    available_now:           false,
    blocked_by:              "Google Business Profile API (v4.9) OAuth2 and business location not yet configured",
    notes:                   "GBP posts expire after 7 days unless promoted. Video limit: 75 MB, ≤ 30s, 720p+.",
  },
  {
    id:                      "line_voom",
    label:                   "LINE VOOM",
    platform:                "line",
    aspect_ratio:            "1:1",
    resolution:              "1080x1080",
    frame_rate:              30,
    target_duration_seconds: 30,
    max_duration_seconds:    300,   // 5 minutes
    min_duration_seconds:    3,
    subtitle_policy:         "optional",
    logo_policy:             "optional",
    watermark_policy:        "optional",
    thumbnail_policy:        "recommended",
    available_now:           false,
    blocked_by:              "LINE Messaging API channel and VOOM post permission not yet configured",
    notes:                   "VOOM is LINE's short-video feed. 1:1 and 9:16 both supported; 1:1 preferred for feed compatibility.",
  },
  {
    id:                      "website_hero",
    label:                   "Dealer Website Hero Video",
    platform:                "owned_website",
    aspect_ratio:            "16:9",
    resolution:              "1920x1080",
    frame_rate:              30,
    target_duration_seconds: 45,
    max_duration_seconds:    120,
    min_duration_seconds:    10,
    subtitle_policy:         "optional",
    logo_policy:             "required",    // Hero videos are high-brand moments
    watermark_policy:        "required",
    thumbnail_policy:        "required",    // Must have a static fallback for slow connections
    available_now:           false,
    blocked_by:              "Dealer website integration and media hosting infrastructure not yet configured",
    notes:                   "Auto-plays muted above the fold. Must loop gracefully. Keep under 10 MB for web performance.",
  },
  {
    id:                      "dealer_website_gallery",
    label:                   "Dealer Website Gallery",
    platform:                "owned_website",
    aspect_ratio:            "4:3",
    resolution:              "1440x1080",
    frame_rate:              30,
    target_duration_seconds: 60,
    max_duration_seconds:    300,
    min_duration_seconds:    10,
    subtitle_policy:         "optional",
    logo_policy:             "optional",
    watermark_policy:        "optional",
    thumbnail_policy:        "required",
    available_now:           false,
    blocked_by:              "Dealer website integration and media hosting infrastructure not yet configured",
    notes:                   "Gallery context — user-initiated playback. Longer format acceptable. 4:3 matches standard vehicle documentation aspect ratio.",
  },
] as const;

// ─── Registry helpers ─────────────────────────────────────────────────────────

/**
 * Returns the profile entry for the given id, or undefined if not registered.
 */
export function getPublishingProfile(
  id: VideoPublishingProfileId,
): VideoPublishingProfile | undefined {
  return VIDEO_PUBLISHING_PROFILE_REGISTRY.find((p) => p.id === id);
}

/**
 * Returns all profiles that are currently available for publishing.
 * Returns an empty array until publishing infrastructure is integrated.
 */
export function getAvailablePublishingProfiles(): VideoPublishingProfile[] {
  return VIDEO_PUBLISHING_PROFILE_REGISTRY.filter((p) => p.available_now);
}

/**
 * Returns all profiles that are currently blocked.
 */
export function getBlockedPublishingProfiles(): VideoPublishingProfile[] {
  return VIDEO_PUBLISHING_PROFILE_REGISTRY.filter((p) => !p.available_now);
}

/**
 * Returns profiles filtered to those matching the given aspect ratio.
 * Useful for finding all vertical (9:16) profiles in one call.
 */
export function getProfilesByAspectRatio(
  ratio: VideoPublishingProfile["aspect_ratio"],
): VideoPublishingProfile[] {
  return VIDEO_PUBLISHING_PROFILE_REGISTRY.filter((p) => p.aspect_ratio === ratio);
}

/**
 * Returns profiles filtered to those matching the given platform.
 */
export function getProfilesByPlatform(
  platform: string,
): VideoPublishingProfile[] {
  return VIDEO_PUBLISHING_PROFILE_REGISTRY.filter((p) => p.platform === platform);
}

/**
 * Returns true if the given duration (seconds) is within the valid range
 * for the specified publishing profile.
 */
export function isDurationValidForProfile(
  profileId:       VideoPublishingProfileId,
  durationSeconds: number,
): boolean {
  const profile = getPublishingProfile(profileId);
  if (!profile) return false;
  return (
    durationSeconds >= profile.min_duration_seconds &&
    durationSeconds <= profile.max_duration_seconds
  );
}

/**
 * Validates a set of publishing profile IDs against the registry.
 * Returns only the IDs that match registered profiles.
 */
export function filterValidPublishingProfiles(
  profileIds: string[],
): VideoPublishingProfileId[] {
  const validIds = new Set(
    VIDEO_PUBLISHING_PROFILE_REGISTRY.map((p) => p.id),
  );
  return profileIds.filter((id): id is VideoPublishingProfileId =>
    validIds.has(id as VideoPublishingProfileId),
  );
}
