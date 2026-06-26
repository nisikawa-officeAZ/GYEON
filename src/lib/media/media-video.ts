// DealerOS — Future Video Architecture
//
// Sprint 10J: architecture types and configuration constants for future video workflows.
// This module contains NO runtime processing — architecture definitions only.
//
// All items in this file represent Phase 10K+ work. Nothing here is active.
// Do not implement any of these constants until VIDEO_INFRA_REQUIREMENTS are met
// and CTO approval is obtained for the relevant prerequisite.
//
// Activating video upload requires completing all VIDEO_INFRA_REQUIREMENTS first.

// ─── Upload architecture ──────────────────────────────────────────────────────

/**
 * Upload strategy for large video files.
 * - single_part:   current approach (limited to 20 MB by Vercel body size)
 * - multipart:     split into parts, upload in parallel, reassemble server-side
 * - resumable_tus: Tus protocol (Supabase Storage supports tus) — best for mobile
 */
export type VideoUploadStrategy = "single_part" | "multipart" | "resumable_tus";

export interface VideoUploadConfig {
  strategy:            VideoUploadStrategy;
  max_file_size_bytes: number;
  accepted_mime_types: string[];
  /** Chunk size for multipart/resumable strategies. */
  chunk_size_bytes?:   number;
  /** Number of concurrent part uploads. Always 1 for mobile reliability. */
  concurrent_uploads:  number;
  retry_on_failure:    boolean;
  progress_reporting:  boolean;
}

/**
 * Target configuration for Phase 10K video upload.
 * NOT ACTIVE — activate only after VIDEO_INFRA_REQUIREMENTS are met.
 */
export const FUTURE_VIDEO_UPLOAD_CONFIG: VideoUploadConfig = {
  strategy:            "resumable_tus",
  max_file_size_bytes: 500 * 1024 * 1024,  // 500 MB
  accepted_mime_types: ["video/mp4", "video/quicktime", "video/webm"],
  chunk_size_bytes:    6 * 1024 * 1024,    // 6 MB chunks
  concurrent_uploads:  1,
  retry_on_failure:    true,
  progress_reporting:  true,
};

// ─── Processing pipeline ──────────────────────────────────────────────────────

/**
 * Ordered processing steps applied server-side after a video upload.
 * Privacy steps (license_plate_blur, face_blur) run before any external service.
 */
export type VideoProcessingStep =
  | "format_validation"      // Verify codec and container are supported
  | "metadata_extraction"    // Duration, resolution, codec — populates DealerMedia fields
  | "thumbnail_generation"   // First-frame JPEG — stored at thumbnails/{media_id}.jpg
  | "license_plate_blur"     // Required before any external AI processing
  | "face_blur"              // Required before any external AI processing
  | "hls_segmentation"       // Adaptive bitrate encoding — requires CDN
  | "dealer_watermark"       // Dealer logo overlay (configurable in dealer settings)
  | "ai_scene_selection"     // AI-powered marketing highlight extraction (Phase 71+)
  | "ai_content_generation"; // Caption, hashtag, platform post generation (Phase 71+)

export interface VideoProcessingPipeline {
  steps:                    VideoProcessingStep[];
  /** All processing runs server-side. No client-side video processing. */
  run_server_side:          true;
  /** These steps must complete before the file is stored in Supabase Storage. */
  required_before_storage:  VideoProcessingStep[];
  available_now:            boolean;
  phase:                    string;
}

/**
 * Target video processing pipeline for Phase 10J+.
 * Privacy steps run first and are mandatory before storage.
 */
export const FUTURE_VIDEO_PROCESSING_PIPELINE: VideoProcessingPipeline = {
  steps: [
    "format_validation",
    "metadata_extraction",
    "license_plate_blur",
    "face_blur",
    "thumbnail_generation",
    "dealer_watermark",
  ],
  run_server_side:         true,
  required_before_storage: ["format_validation", "license_plate_blur", "face_blur"],
  available_now:           false,
  phase:                   "Phase 10J+",
};

// ─── Streaming architecture ───────────────────────────────────────────────────

export type VideoStreamingProtocol = "hls" | "dash" | "progressive_mp4";

export interface VideoBitrateLevel {
  resolution:   "360p" | "540p" | "720p" | "1080p";
  bitrate_kbps: number;
  codec:        "h264" | "h265" | "av1";
}

export interface VideoStreamingConfig {
  protocol:            VideoStreamingProtocol;
  /** Duration of each HLS segment in seconds. */
  segment_duration_s:  number;
  /** Bitrate ladder — client selects quality tier based on connection speed. */
  bitrate_ladder:      VideoBitrateLevel[];
  /** CDN required for segment delivery. */
  cdn_required:        boolean;
  /** TTL for signed private video URLs in seconds. */
  signed_url_ttl_s:    number;
}

/**
 * Target HLS streaming configuration for Phase 10K.
 * CDN provider and segment storage must be decided before implementing.
 */
export const FUTURE_HLS_CONFIG: VideoStreamingConfig = {
  protocol:           "hls",
  segment_duration_s: 6,
  bitrate_ladder: [
    { resolution: "360p",  bitrate_kbps: 800,  codec: "h264" },
    { resolution: "720p",  bitrate_kbps: 2500, codec: "h264" },
    { resolution: "1080p", bitrate_kbps: 5000, codec: "h264" },
  ],
  cdn_required:     true,
  signed_url_ttl_s: 3600,  // 1 hour
};

// ─── Infrastructure prerequisites ────────────────────────────────────────────

export type VideoInfraPrerequisite =
  | "supabase_storage_plan"    // Storage capacity and egress cost review
  | "vercel_function_body"     // Vercel Pro body size limit verification (4.5 GB max)
  | "cdn_streaming_strategy"   // HLS vs. progressive download decision
  | "thumbnail_service"        // Server-side first-frame extraction implementation
  | "mobile_upload_ux"         // Upload progress + retry-on-failure for large files
  | "hls_transcoding_service"; // Cloudflare Stream or equivalent deployment

export interface VideoInfraRequirement {
  prerequisite:  VideoInfraPrerequisite;
  description:   string;
  status:        "pending" | "approved" | "implemented";
  requires_approval_from: "cto" | "ops";
}

/**
 * All infrastructure requirements that must be met before activating video upload.
 * Every item must reach "approved" or "implemented" status before FUTURE_VIDEO_UPLOAD_POLICY
 * can replace CURRENT_UPLOAD_POLICY in production.
 */
export const VIDEO_INFRA_REQUIREMENTS: VideoInfraRequirement[] = [
  {
    prerequisite:           "supabase_storage_plan",
    description:            "Verify Supabase Storage plan capacity and egress pricing for 500 MB video files at production scale.",
    status:                 "pending",
    requires_approval_from: "cto",
  },
  {
    prerequisite:           "vercel_function_body",
    description:            "Confirm Vercel Pro plan supports the 500 MB function body size for video upload routes.",
    status:                 "pending",
    requires_approval_from: "ops",
  },
  {
    prerequisite:           "cdn_streaming_strategy",
    description:            "Decide between HLS segmentation and progressive download. Evaluate Cloudflare Stream vs. Supabase CDN.",
    status:                 "pending",
    requires_approval_from: "cto",
  },
  {
    prerequisite:           "thumbnail_service",
    description:            "Implement server-side video first-frame extraction and thumbnail storage at {dealer_id}/thumbnails/{media_id}.jpg.",
    status:                 "pending",
    requires_approval_from: "ops",
  },
  {
    prerequisite:           "mobile_upload_ux",
    description:            "Add upload progress indication and retry-on-failure UI for large video files on mobile devices.",
    status:                 "pending",
    requires_approval_from: "ops",
  },
  {
    prerequisite:           "hls_transcoding_service",
    description:            "Deploy HLS transcoding pipeline (Cloudflare Stream or equivalent). Required before streaming capability is available.",
    status:                 "pending",
    requires_approval_from: "cto",
  },
];

/** Returns true only when all infrastructure requirements are approved or implemented. */
export function areVideoInfraRequirementsMet(): boolean {
  return VIDEO_INFRA_REQUIREMENTS.every(
    (r) => r.status === "approved" || r.status === "implemented",
  );
}

// ─── Video retention policy ───────────────────────────────────────────────────
//
// Videos are NOT stored permanently by default.
// Default retention: 30 days for all video categories.
// Do not implement deletion runtime until VIDEO_INFRA_REQUIREMENTS are met
// and the retention enforcement service is designed and CTO-approved.

/**
 * Retention period options for video assets.
 *
 * - "after_ai_processing": source video deleted immediately after AI processing completes.
 * - "after_download":      AI-generated video deleted after dealer download is confirmed.
 * - 7 / 30 / 90:          fixed day windows.
 *
 * 90-day retention requires Pro+ plan. See NINETY_DAY_RETENTION_REQUIRES_PRO_PLUS.
 */
export type VideoRetentionPeriod =
  | "after_ai_processing"  // Source video: delete immediately after AI processing
  | "after_download"       // Generated video: delete after confirmed download
  | 7                      // 7-day fixed window
  | 30                     // 30-day fixed window (default)
  | 90;                    // 90-day fixed window — Pro+ plan required

/** All supported retention period values, in order from shortest to longest. */
export const SUPPORTED_VIDEO_RETENTION_PERIODS: VideoRetentionPeriod[] = [
  "after_ai_processing",
  "after_download",
  7,
  30,
  90,
];

/**
 * 90-day video retention requires the dealer to be on the Pro+ plan.
 * Enforced server-side — never rely on client-side plan checks.
 */
export const NINETY_DAY_RETENTION_REQUIRES_PRO_PLUS = true as const;

// ─── Source video retention ───────────────────────────────────────────────────

/**
 * Retention configuration for dealer-uploaded source videos.
 *
 * Source videos are the raw files uploaded from a job — before, during, after.
 * They are distinct from AI-generated output videos.
 */
export interface VideoSourceRetentionConfig {
  /** How long to keep the source video file. Default: 30 days. */
  period:                   VideoRetentionPeriod;
  /**
   * If true, the source video is deleted immediately after AI processing completes.
   * The generated output (thumbnail, AI video) is kept separately.
   * Default: false — keep for the full period even after AI use.
   */
  delete_after_ai_processing: boolean;
  /**
   * If true, the dealer has explicitly opted into permanent retention.
   * Only allowed if the dealer's plan permits it.
   * Never set automatically — requires explicit dealer action.
   */
  dealer_retained:          boolean;
}

// ─── AI-generated video retention ────────────────────────────────────────────

/**
 * Retention configuration for AI-generated output videos.
 *
 * Generated videos are produced by the AI Video Generator (Phase 72).
 * They are distinct from the source footage uploaded by the dealer.
 */
export interface VideoGeneratedRetentionConfig {
  /** How long to keep the generated video file. Default: 30 days. */
  period:                   VideoRetentionPeriod;
  /**
   * If true, the generated video file is deleted immediately after the dealer
   * confirms a successful download.
   * Only the metadata (MediaDeletionRecord) and publishing record are kept.
   * Default: false — keep for the full period even after download.
   */
  delete_after_download:    boolean;
  /**
   * If true, the generated video is deleted after SNS publishing is confirmed.
   * Only the publishing record (platform, post_id, published_at) is kept.
   * Default: false.
   */
  delete_after_publishing:  boolean;
}

// ─── Combined retention policy ────────────────────────────────────────────────

export interface VideoRetentionPolicy {
  source_video:            VideoSourceRetentionConfig;
  generated_video:         VideoGeneratedRetentionConfig;
  /**
   * How long to keep MediaDeletionRecords after the file is deleted.
   * Must be longer than the video retention period.
   * Default: 3650 days (~10 years) for compliance.
   */
  metadata_retention_days: number;
}

/**
 * Default video retention policy — applied when no dealer configuration exists.
 * Conservative defaults: 30-day fixed window, no automatic early deletion.
 */
export const DEFAULT_VIDEO_RETENTION_POLICY: VideoRetentionPolicy = {
  source_video: {
    period:                    30,
    delete_after_ai_processing: false,
    dealer_retained:           false,
  },
  generated_video: {
    period:               30,
    delete_after_download:   false,
    delete_after_publishing: false,
  },
  metadata_retention_days: 3650,  // ~10 years — outlasts all video retention windows
};

// ─── Dealer retention preferences (Phase 10K+) ───────────────────────────────

/**
 * Dealer-configurable retention preferences.
 * Exposed via settings UI in Phase 10K — not yet implemented.
 *
 * The backend must validate:
 *   - 90-day retention requires Pro+ plan (NINETY_DAY_RETENTION_REQUIRES_PRO_PLUS)
 *   - delete_after_ai_processing and delete_after_download cannot both be false
 *     if period is "after_ai_processing" / "after_download"
 *   - dealer_retained requires explicit opt-in and policy approval
 */
export interface DealerVideoRetentionPreference {
  source_video_period:       VideoRetentionPeriod;
  delete_source_after_ai:    boolean;
  generated_video_period:    VideoRetentionPeriod;
  delete_generated_after_download:  boolean;
  delete_generated_after_publishing: boolean;
}

/** Default dealer preference — matches DEFAULT_VIDEO_RETENTION_POLICY. */
export const DEFAULT_DEALER_VIDEO_RETENTION_PREFERENCE: DealerVideoRetentionPreference = {
  source_video_period:                    30,
  delete_source_after_ai:                 false,
  generated_video_period:                 30,
  delete_generated_after_download:        false,
  delete_generated_after_publishing:      false,
};
