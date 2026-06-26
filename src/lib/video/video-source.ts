// DealerOS — Video Source Media Model
//
// Sprint 11B Phase B: source media model for the AI Video Pipeline.
//
// VideoSource wraps a canonical MediaAsset with pipeline-specific context:
//   - source_type: what role this media plays in the video (before photo, logo, etc.)
//   - role_in_project: how it is used visually (primary, overlay, etc.)
//   - display_duration_seconds: how long this clip/photo appears in the scene
//   - ai_scene_description: human-readable description fed to AI generation prompt
//
// Rule: the pipeline MUST consume MediaAsset objects.
//       Raw file paths are never used directly in the video pipeline.
//       Every source is a first-class domain object with privacy gates attached.
//
// Privacy:
//   sourceRequiresConsent() returns true for customer-visible media.
//   customer_review sources always require consent regardless of policy.
//   dealer_logo never requires customer consent.

import type { MediaAsset }                from "@/lib/media";
import { checkMediaPermission }            from "@/lib/media";
import type {
  VideoSourceType,
  VideoSourceRole,
  VideoTransition,
} from "./video-types";
import { DEFAULT_VIDEO_TRANSITION as DVT } from "./video-types";

// ─── VideoSource ──────────────────────────────────────────────────────────────

/**
 * VideoSource — a single source media asset in the video pipeline.
 *
 * Wraps a canonical MediaAsset with pipeline-specific context.
 * One VideoProject may have many VideoSource objects — each maps to one MediaAsset.
 *
 * order determines the position in the source list when building the storyboard.
 * Multiple sources can share the same scene type (e.g., 3 work_progress_photos).
 */
export interface VideoSource {
  id:                      string;
  /** Always from getCurrentDealer(). Matches media_asset.dealer_id. */
  dealer_id:               string;
  source_type:             VideoSourceType;
  /** Canonical media domain object — never a raw file path. */
  media_asset:             MediaAsset;
  role_in_project:         VideoSourceRole;
  /**
   * How long this source should appear on screen (seconds).
   * Null = use template default for this scene type.
   */
  display_duration_seconds: number | null;
  /** Transition applied after this source ends and the next scene begins. */
  transition_after:        VideoTransition;
  /**
   * Override the generated caption for this specific source.
   * Null = use AI-generated caption.
   */
  caption_override:        string | null;
  /**
   * A human-readable description of this source for the AI storyboard/generation prompt.
   * e.g., "Close-up of water beading off the hood after ceramic coating application"
   */
  ai_scene_description:    string | null;
  /** Zero-indexed position in the source list. Lower order = appears earlier. */
  order:                   number;
}

// ─── Source helpers ───────────────────────────────────────────────────────────

/**
 * Returns all sources of the given type from a source list.
 */
export function getSourcesByType(
  sources:    VideoSource[],
  sourceType: VideoSourceType,
): VideoSource[] {
  return sources.filter((s) => s.source_type === sourceType);
}

/**
 * Returns the first source marked as "primary" role, or the first source overall.
 * Returns null if the sources list is empty.
 */
export function getPrimarySource(sources: VideoSource[]): VideoSource | null {
  return sources.find((s) => s.role_in_project === "primary") ?? sources[0] ?? null;
}

/**
 * Returns all sources eligible as thumbnail candidates.
 */
export function getThumbnailCandidates(sources: VideoSource[]): VideoSource[] {
  return sources.filter(
    (s) =>
      s.role_in_project === "thumbnail_candidate" ||
      s.source_type     === "completion_photo"    ||
      s.source_type     === "after_photo",
  );
}

/**
 * Returns true if the source type produces video output (not a static image).
 */
export function isVideoSourceType(type: VideoSourceType): boolean {
  return (
    type === "work_progress_video" ||
    type === "water_beading_video" ||
    type === "completion_video"    ||
    type === "product_video"       ||
    type === "ai_generated_media"
  );
}

/**
 * Returns true if the source type includes customer-identifiable content
 * that always requires explicit consent before use.
 *
 * customer_review: always requires consent (customer's voice/image/words).
 * Any source where the media_asset.consent_status != "approved" also requires
 * review — checked separately via checkMediaPermission().
 */
export function sourceRequiresConsent(source: VideoSource): boolean {
  if (source.source_type === "dealer_logo")    return false;
  if (source.source_type === "product_photo")  return false;
  if (source.source_type === "product_video")  return false;
  if (source.source_type === "customer_review") return true;
  return source.media_asset.consent_status !== "not_required";
}

/**
 * Validates that a VideoSource's media_asset passes the marketing permission gate.
 * Returns true if the source can be used in AI-generated marketing video.
 */
export function isSourcePermittedForMarketing(source: VideoSource): boolean {
  const gate = checkMediaPermission(source.media_asset);
  return gate.can_use_for_marketing;
}

/**
 * Returns true if all sources in the list are permitted for marketing use.
 */
export function allSourcesPermittedForMarketing(sources: VideoSource[]): boolean {
  return sources.every(isSourcePermittedForMarketing);
}

/**
 * Returns sources that do NOT pass the marketing permission gate.
 * Use this to identify blocking sources before attempting generation.
 */
export function getBlockedSources(sources: VideoSource[]): VideoSource[] {
  return sources.filter((s) => !isSourcePermittedForMarketing(s));
}

// ─── Source creation helper ───────────────────────────────────────────────────

/**
 * Constructs a minimal VideoSource from a MediaAsset.
 * The source_type must be explicitly specified — it cannot be derived automatically.
 *
 * @param asset      The source MediaAsset (must already exist in the media domain).
 * @param sourceType The role of this asset in the video pipeline.
 * @param order      Position in the source list (0-indexed).
 */
export function buildVideoSource(
  asset:      MediaAsset,
  sourceType: VideoSourceType,
  order:      number,
  overrides?: Partial<Omit<VideoSource, "id" | "dealer_id" | "source_type" | "media_asset" | "order">>,
): Omit<VideoSource, "id"> {
  return {
    dealer_id:               asset.dealer_id,
    source_type:             sourceType,
    media_asset:             asset,
    role_in_project:         overrides?.role_in_project         ?? "primary",
    display_duration_seconds: overrides?.display_duration_seconds ?? null,
    transition_after:        overrides?.transition_after         ?? DVT,
    caption_override:        overrides?.caption_override         ?? null,
    ai_scene_description:    overrides?.ai_scene_description     ?? null,
    order,
  };
}
