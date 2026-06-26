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
