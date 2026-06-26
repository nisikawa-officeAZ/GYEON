// DealerOS — Video Project Domain Object
//
// Sprint 11B Phase A (continued): VideoProject — the top-level orchestration object.
//
// VideoProject is the primary unit of work in the AI Video Pipeline.
// It aggregates all sources, timeline, output, policy, and retention into
// a single coherent domain object that flows through the pipeline stages.
//
// Security:
//   dealer_id must always come from getCurrentDealer() in server actions.
//   VideoProject.dealer_id is never derived from client input.
//   marketing_asset_id is a string reference — @/lib/marketing is NOT imported here.
//   This avoids cross-module circular dependencies.

import type {
  VideoProjectStatus,
  VideoPolicy,
  VideoRetention,
  VideoOutput,
  VideoAnalytics,
  VideoPublishingProfileId,
  VideoAIProviderId,
} from "./video-types";
import { DEFAULT_VIDEO_POLICY as DVP, DEFAULT_VIDEO_RETENTION as DVR } from "./video-types";
import type { VideoSource }   from "./video-source";
import type { VideoTimeline } from "./video-timeline";

// ─── VideoProject ─────────────────────────────────────────────────────────────

/**
 * VideoProject — the primary orchestration object for the AI Video Pipeline.
 *
 * A single VideoProject flows through all pipeline stages:
 *   draft → storyboard → generation → approval → publishing → analytics
 *
 * Key relationships:
 * - sources:     All MediaAsset-backed VideoSource objects (Phase B)
 * - timeline:    The sequenced narrative (Phase C) — null until storyboard is built
 * - output:      The generated video artifact — null until generation completes
 * - policy:      Governance rules for this project
 * - retention:   When to delete source media and generated video
 * - marketing_asset_id: Optional link to MarketingAsset — stored as string ID only
 */
export interface VideoProject {
  id:                  string;
  /** Always from getCurrentDealer() — never from client form input or URL params. */
  dealer_id:           string;
  name:                string;
  description:         string | null;
  status:              VideoProjectStatus;
  /** The template used to structure scenes and style. Null if manually composed. */
  template_id:         string | null;
  /** All source media for this project. Order controlled by VideoSource.order. */
  sources:             VideoSource[];
  /**
   * The sequenced narrative. Null until storyboard generation has been triggered.
   * Present once status >= "storyboard_ready".
   */
  timeline:            VideoTimeline | null;
  /**
   * The generated video artifact. Null until generation is complete.
   * Present once status >= "generation_complete".
   */
  output:              VideoOutput | null;
  policy:              VideoPolicy;
  retention:           VideoRetention;
  /** Target publishing destinations for the generated video. */
  publishing_profiles: VideoPublishingProfileId[];
  /** Analytics data from published channels. Null until publishing is complete. */
  analytics:           VideoAnalytics | null;
  /** ID of the AI provider used for generation (set when generation is triggered). */
  ai_provider_id:      VideoAIProviderId | null;
  /** External request ID from the AI provider (for status polling, audit). */
  ai_request_id:       string | null;
  /**
   * Optional cross-reference to a MarketingAsset that owns this project.
   * Stored as a string ID to avoid circular dependency with @/lib/marketing.
   */
  marketing_asset_id:  string | null;
  created_at:          string;   // ISO 8601
  updated_at:          string;   // ISO 8601
  created_by:          string | null;
}

// ─── VideoProjectSummary ──────────────────────────────────────────────────────

/**
 * VideoProjectSummary — lightweight read-only projection for list views and APIs.
 * Does not include full sources, timeline, or output details.
 */
export interface VideoProjectSummary {
  id:                      string;
  dealer_id:               string;
  name:                    string;
  status:                  VideoProjectStatus;
  template_id:             string | null;
  source_count:            number;
  scene_count:             number;
  total_duration_seconds:  number;
  output_available:        boolean;
  publishing_profiles:     VideoPublishingProfileId[];
  marketing_asset_id:      string | null;
  created_at:              string;
  updated_at:              string;
}

// ─── VideoProjectForStoryboard ────────────────────────────────────────────────

/**
 * A minimal projection sent to the storyboard generation stage.
 * Does not include MediaAsset details — only descriptions and source types.
 * Used to construct the AI generation prompt without exposing raw media URLs.
 */
export interface VideoProjectForStoryboard {
  project_id:          string;
  dealer_id:           string;
  template_id:         string | null;
  target_profiles:     VideoPublishingProfileId[];
  source_descriptions: VideoSourceDescription[];
  policy:              VideoPolicy;
}

export interface VideoSourceDescription {
  source_id:         string;
  source_type:       string;
  order:             number;
  /** Human-readable scene description for the AI generation prompt. */
  ai_scene_description: string | null;
  /** True if the source is a video clip (not a static photo). */
  is_video:          boolean;
  display_duration_seconds: number | null;
}

// ─── Project helpers ──────────────────────────────────────────────────────────

/**
 * Converts a VideoProject to a lightweight summary for list views.
 */
export function toVideoProjectSummary(project: VideoProject): VideoProjectSummary {
  const sceneCount     = project.timeline?.scenes.length ?? 0;
  const totalDuration  = project.timeline?.total_duration_seconds ?? 0;

  return {
    id:                     project.id,
    dealer_id:              project.dealer_id,
    name:                   project.name,
    status:                 project.status,
    template_id:            project.template_id,
    source_count:           project.sources.length,
    scene_count:            sceneCount,
    total_duration_seconds: totalDuration,
    output_available:       project.output?.file_url !== null && project.output !== null,
    publishing_profiles:    project.publishing_profiles,
    marketing_asset_id:     project.marketing_asset_id,
    created_at:             project.created_at,
    updated_at:             project.updated_at,
  };
}

/**
 * Converts a VideoProject to the storyboard input projection.
 * Strips all MediaAsset URLs — AI generation prompt uses descriptions only.
 */
export function toVideoProjectForStoryboard(
  project: VideoProject,
): VideoProjectForStoryboard {
  return {
    project_id:   project.id,
    dealer_id:    project.dealer_id,
    template_id:  project.template_id,
    target_profiles: project.publishing_profiles,
    policy:       project.policy,
    source_descriptions: project.sources.map((s) => ({
      source_id:               s.id,
      source_type:             s.source_type,
      order:                   s.order,
      ai_scene_description:    s.ai_scene_description,
      is_video:                s.media_asset.media_type === "video",
      display_duration_seconds: s.display_duration_seconds,
    })),
  };
}

/**
 * Returns true if the project is in a state where generation can be triggered.
 */
export function isGenerationEligible(project: VideoProject): boolean {
  return (
    project.status === "storyboard_ready" &&
    project.timeline !== null            &&
    project.sources.length > 0           &&
    project.policy.ai_content_allowed
  );
}

/**
 * Returns true if the project output is available for dealer review.
 */
export function isReadyForDealerReview(project: VideoProject): boolean {
  return (
    project.status          === "pending_approval" &&
    project.output          !== null               &&
    project.output.file_url !== null
  );
}

/**
 * Returns true if the project can be published (all approval gates passed).
 */
export function isReadyForPublishing(project: VideoProject): boolean {
  return (
    project.status               === "approved"             &&
    project.output               !== null                   &&
    project.output.file_url      !== null                   &&
    project.publishing_profiles.length > 0
  );
}

/**
 * Creates a new VideoProject with safe defaults.
 * The id must be generated by the caller (e.g., crypto.randomUUID()).
 * dealer_id must come from getCurrentDealer() in the server action.
 */
export function buildVideoProject(
  id:       string,
  dealerId: string,
  name:     string,
  now:      string,
  overrides?: Partial<Omit<VideoProject, "id" | "dealer_id" | "name" | "created_at" | "updated_at">>,
): VideoProject {
  return {
    id,
    dealer_id:           dealerId,
    name,
    description:         overrides?.description         ?? null,
    status:              overrides?.status              ?? "draft",
    template_id:         overrides?.template_id         ?? null,
    sources:             overrides?.sources             ?? [],
    timeline:            overrides?.timeline            ?? null,
    output:              overrides?.output              ?? null,
    policy:              overrides?.policy              ?? DVP,
    retention:           overrides?.retention           ?? DVR,
    publishing_profiles: overrides?.publishing_profiles ?? [],
    analytics:           overrides?.analytics           ?? null,
    ai_provider_id:      overrides?.ai_provider_id      ?? null,
    ai_request_id:       overrides?.ai_request_id       ?? null,
    marketing_asset_id:  overrides?.marketing_asset_id  ?? null,
    created_at:          now,
    updated_at:          now,
    created_by:          overrides?.created_by          ?? null,
  };
}
