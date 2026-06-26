// DealerOS — Video Pipeline Domain Types
//
// Sprint 11B Phase A: canonical AI Video Pipeline business domain.
//
// This module contains all pure type definitions — no imports from @/lib/media
// or any other DealerOS module. All media-dependent types are in dedicated files.
//
// Relationship to @/lib/media/media-video.ts:
//   media-video.ts   — infrastructure-level: upload config, HLS streaming,
//                      retention periods, infra prerequisites (Sprint 10J/10K)
//   video-types.ts   — pipeline business domain: scenes, templates, timelines,
//                      output specs, AI provider registry (Sprint 11B)
//
// Security:
//   dealer_id must always come from getCurrentDealer() in every server action.
//   VideoPolicy.requires_dealer_approval = true by default.
//   VideoPolicy.requires_media_consent = true by default.

// ─── Project lifecycle ────────────────────────────────────────────────────────

export type VideoProjectStatus =
  | "draft"                  // Being composed — sources selected, no storyboard yet
  | "pending_storyboard"     // Sources finalized — AI storyboard generation requested
  | "storyboard_ready"       // Storyboard generated — awaiting generation approval
  | "pending_generation"     // Storyboard approved — AI video generation requested
  | "generating"             // AI provider is generating the video
  | "generation_complete"    // Raw video generated — awaiting quality review
  | "pending_approval"       // Generated video submitted to dealer for review
  | "approved"               // Dealer approved — ready for publishing
  | "publishing"             // Publishing in progress
  | "published"              // Successfully published to one or more profiles
  | "failed"                 // Generation or publishing failed
  | "archived"               // Lifecycle complete — retained for audit
  | "deleted";               // Output deleted — deletion record retained

// ─── Scene types ──────────────────────────────────────────────────────────────

/**
 * The 10 canonical scene types for AI-generated marketing videos.
 * Each scene type maps to a specific narrative purpose in the video.
 */
export type VideoSceneType =
  | "intro"             // Opening hook — 2–3 seconds, brand identity
  | "branding"          // Dealer logo, name, tagline
  | "vehicle_before"    // Vehicle condition before service began
  | "work_process"      // Active work — coating application, PPF installation, etc.
  | "product_highlight" // Product used — ceramic coating bottle, PPF roll, etc.
  | "water_beading"     // Water beading test — signature proof of coating quality
  | "vehicle_after"     // Finished vehicle — high-quality reveal
  | "customer_review"   // Customer testimonial or review excerpt
  | "call_to_action"    // CTA — contact info, booking prompt, hashtag
  | "outro";            // Closing — logo, contact, music fade

// ─── Source types (Phase B) ───────────────────────────────────────────────────

/**
 * The type of real-world source material that feeds a video pipeline.
 * Each source type maps to specific scene types and has distinct consent rules.
 */
export type VideoSourceType =
  | "before_photo"            // Vehicle photo before service
  | "after_photo"             // Vehicle photo after service
  | "work_progress_photo"     // Static photo during active work
  | "work_progress_video"     // Video clip during active work
  | "water_beading_video"     // Water beading test video
  | "completion_photo"        // Final high-quality vehicle photo
  | "completion_video"        // Final cinematic vehicle video
  | "dealer_logo"             // Dealer logo image for branding scenes
  | "customer_review"         // Customer review text or testimonial photo/video
  | "product_photo"           // Product (coating/PPF) photo
  | "product_video"           // Product demonstration video
  | "ai_generated_media";     // Previously AI-generated image or video used as source

export type VideoSourceRole =
  | "primary"               // The main focal subject of this scene
  | "supplementary"         // Supports the primary — additional detail
  | "background"            // Environmental/atmospheric context
  | "overlay"               // Overlaid on another source (logo, watermark)
  | "thumbnail_candidate";  // This frame should be considered for the thumbnail

// ─── Timeline geometry ────────────────────────────────────────────────────────

/**
 * Supported aspect ratios across all publishing profiles.
 * Profiles define which aspect ratios they require.
 */
export type VideoAspectRatio =
  | "9:16"    // Vertical — Instagram Reels, TikTok, YouTube Shorts
  | "16:9"    // Horizontal — Website hero, YouTube standard
  | "1:1"     // Square — LINE VOOM, legacy Instagram feed
  | "4:3"     // Near-horizontal — Google Business Profile
  | "4:5";    // Portrait feed — Instagram Feed

/** Output resolution. Always listed as width×height. */
export type VideoResolution =
  | "1080x1920"   // Full HD vertical (9:16)
  | "1920x1080"   // Full HD horizontal (16:9)
  | "1080x1080"   // Square HD (1:1)
  | "1440x1800"   // Portrait HD (4:5)
  | "1440x1080"   // 4:3 HD
  | "720x1280"    // HD vertical (9:16 — lower)
  | "3840x2160";  // 4K (16:9 — future)

export type VideoFrameRate = 24 | 25 | 30 | 60;

// ─── Transitions ──────────────────────────────────────────────────────────────

export type VideoTransitionType =
  | "cut"        // Instant cut — no transition effect
  | "fade"       // Fade to black and back
  | "dissolve"   // Cross-dissolve between scenes
  | "wipe"       // Directional wipe
  | "slide"      // Slide in from a direction
  | "zoom";      // Zoom in or out

export interface VideoTransition {
  type:             VideoTransitionType;
  duration_seconds: number;   // Transition overlap duration (typically 0.3–1.0s)
}

// ─── Text overlays ────────────────────────────────────────────────────────────

export type VideoTextPosition =
  | "top_center"    | "top_left"    | "top_right"
  | "middle_center"
  | "bottom_center" | "bottom_left" | "bottom_right";

export type VideoTextStyle =
  | "title"           // Large prominent heading
  | "subtitle"        // Medium informational text
  | "overlay"         // Text on a translucent background strip
  | "caption"         // Small descriptive caption
  | "call_to_action"; // Highlighted CTA button-style text

export interface VideoTextOverlay {
  text:            string;
  position:        VideoTextPosition;
  style:           VideoTextStyle;
  start_seconds:   number;
  end_seconds:     number;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

export type VideoMusicStyle =
  | "upbeat"
  | "calm"
  | "cinematic"
  | "corporate"
  | "none";

export interface VideoAudioConfig {
  background_music:        boolean;
  background_music_style?: VideoMusicStyle;
  narration:               boolean;
  sound_effects:           boolean;
  muted_by_default:        boolean;
  /** 0.0 = silent, 1.0 = full volume for background music track. */
  volume_level:            number;
}

// ─── Output format ────────────────────────────────────────────────────────────

export type VideoOutputFormat = "mp4" | "webm" | "mov" | "m4v";

/**
 * VideoOutput — the generated video artifact.
 *
 * file_path and file_url are populated after generation completes.
 * The generated video is subsequently wrapped in a MediaAsset (via media-types.ts)
 * to become a first-class citizen in the media domain.
 */
export interface VideoOutput {
  file_path:               string | null;
  file_url:                string | null;
  thumbnail_path:          string | null;
  duration_seconds:        number | null;
  aspect_ratio:            VideoAspectRatio;
  resolution:              VideoResolution;
  format:                  VideoOutputFormat;
  file_size_bytes:         number | null;
  frame_rate:              VideoFrameRate;
  generated_at:            string | null;    // ISO 8601
  provider_id:             VideoAIProviderId | null;
  provider_request_id:     string | null;
  provider_generation_seconds: number | null; // How long generation took
}

// ─── Policy ───────────────────────────────────────────────────────────────────

/**
 * VideoPolicy — governance layer for a video project.
 *
 * Critical defaults that must not be weakened:
 *   requires_dealer_approval = true
 *   requires_media_consent = true
 *   ai_content_allowed = false (explicit dealer opt-in required)
 */
export interface VideoPolicy {
  requires_dealer_approval:            boolean;
  requires_media_consent:              boolean;
  watermark_required:                  boolean;
  logo_required:                       boolean;
  ai_content_allowed:                  boolean;
  max_generation_attempts:             number;
  auto_delete_source_after_generation: boolean;
}

// ─── Retention ────────────────────────────────────────────────────────────────

/**
 * VideoRetention — project-level retention configuration.
 *
 * Note: this is the pipeline-level retention policy (days + flags).
 * The lower-level VideoRetentionPeriod type in @/lib/media/media-video.ts
 * governs individual MediaAsset records and is a distinct abstraction.
 */
export interface VideoRetention {
  /** Days to retain source media after generation completes. Default: 30. */
  source_media_retention_days:    number;
  /** Days to retain generated video after creation. Default: 30. */
  generated_video_retention_days: number;
  /** Delete generated video when dealer confirms download. */
  delete_after_download:          boolean;
  /** Delete generated video when all target publishes complete. */
  delete_after_publishing:        boolean;
  /** Dealer explicitly opted in to long-term retention (overrides defaults). */
  dealer_retained:                boolean;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface VideoAnalytics {
  project_id:    string;
  dealer_id:     string;
  views:         number;
  completions:   number;
  shares:        number;
  clicks:        number;
  collected_at:  string;   // ISO 8601
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type VideoStylePreset =
  | "modern_minimal"    // Clean, white-space, smooth transitions
  | "dynamic_energy"    // Fast cuts, bold colors, energetic pacing
  | "premium_luxury"    // Slow pans, deep colors, elegant typography
  | "automotive_tech"   // Technical overlays, precision focus, detail shots
  | "testimonial"       // Warm tones, interview-style, human-centered
  | "showcase_reel"     // Composite of multiple styles
  | "custom";           // Dealer-defined

export type VideoTemplateCategory =
  | "before_after"         // Vehicle condition comparison
  | "service_showcase"     // Highlight a specific service
  | "completion_showcase"  // Show finished work
  | "water_beading_proof"  // Water beading demonstration
  | "product_highlight"    // Feature a product
  | "brand_awareness"      // General brand building
  | "customer_testimonial"; // Real customer review

export interface VideoSceneTemplate {
  scene_type:              VideoSceneType;
  default_duration_seconds: number;
  min_duration_seconds:    number;
  max_duration_seconds:    number;
  required_source_types:   VideoSourceType[];
  optional_source_types:   VideoSourceType[];
  default_transition_in:   VideoTransition;
}

/**
 * VideoTemplate — a reusable blueprint for a specific video format.
 * Defines scene sequence, durations, style, and compatible publishing profiles.
 */
export interface VideoTemplate {
  id:                       string;
  name:                     string;
  description:              string;
  category:                 VideoTemplateCategory;
  scene_templates:          VideoSceneTemplate[];
  style_preset:             VideoStylePreset;
  compatible_profiles:      VideoPublishingProfileId[];
  default_aspect_ratio:     VideoAspectRatio;
  target_duration_seconds:  number;
  min_sources_required:     number;
  available_now:            boolean;
  blocked_by?:              string;
}

// ─── AI providers (Phase E) ───────────────────────────────────────────────────

/**
 * All future AI providers for video generation and analysis.
 * Must integrate through the AI Gateway (AI_GATEWAY_SPEC.md) — never directly.
 */
export type VideoAIProviderId =
  | "openai_sora"       // OpenAI Sora — text/image to video (future)
  | "google_veo"        // Google Veo 2 — high-fidelity video generation (future)
  | "anthropic"         // Anthropic Claude — scripting, storyboard analysis
  | "runway_gen3"       // Runway Gen-3 Alpha — image/video to video
  | "pika_labs"         // Pika 2.0 — short-form video generation
  | "kling_ai"          // Kling AI — high-quality character video
  | "azure_openai"      // Azure OpenAI — proxied generation
  | "openrouter"        // OpenRouter gateway — multi-provider access
  | "custom";           // Extensible slot for future providers

export type VideoAICapabilityType =
  | "storyboard_generation"   // Scene-by-scene storyboard from source media descriptions
  | "video_generation"        // Full video from storyboard + source media
  | "scene_assembly"          // Assemble scenes from individual source clips
  | "caption_generation"      // Generate subtitles or on-screen text from script
  | "voiceover_generation"    // Generate narration audio from script text
  | "music_selection"         // Select or generate background music for mood
  | "thumbnail_selection"     // Identify the best thumbnail frame
  | "quality_review"          // Review generated video for quality and compliance
  | "license_plate_blur"      // Automatically blur license plates in video frames
  | "face_blur";              // Automatically blur non-consenting faces in video frames

// ─── Publishing profile identity (Phase D) ────────────────────────────────────

/**
 * The 9 canonical video publishing destinations.
 * Full profiles with specs are in video-publishing.ts.
 */
export type VideoPublishingProfileId =
  | "instagram_reels"
  | "instagram_stories"
  | "tiktok"
  | "youtube_shorts"
  | "facebook_reels"
  | "google_business_profile"
  | "line_voom"
  | "website_hero"
  | "dealer_website_gallery";

// ─── Publishing output policies ───────────────────────────────────────────────

export type VideoSubtitlePolicy =
  | "required"          // Subtitles must be burned into the video
  | "recommended"       // Subtitles strongly recommended for platform
  | "optional"          // Subtitles may be added at dealer discretion
  | "not_applicable";   // Platform does not surface subtitle data this way

export type VideoLogoPolicy =
  | "required"           // Dealer logo must appear in this profile
  | "optional"           // Logo may appear at dealer discretion
  | "not_recommended";   // Logo placement reduces organic performance on this platform

export type VideoWatermarkPolicy =
  | "required"      // Watermark must be burned in per dealer policy
  | "optional"      // Watermark is dealer's choice
  | "not_allowed";  // Platform terms prohibit branded watermarks

export type VideoThumbnailPolicy =
  | "required"          // An explicit thumbnail must be set before publishing
  | "auto_first_frame"  // Platform auto-selects the first frame if none set
  | "recommended"       // Explicitly setting a thumbnail is strongly recommended
  | "not_applicable";   // Platform does not use static thumbnails

// ─── Default constants ────────────────────────────────────────────────────────

export const DEFAULT_VIDEO_POLICY: VideoPolicy = {
  requires_dealer_approval:            true,
  requires_media_consent:              true,
  watermark_required:                  true,
  logo_required:                       false,
  ai_content_allowed:                  false,   // Must be explicitly enabled
  max_generation_attempts:             3,
  auto_delete_source_after_generation: false,
};

export const DEFAULT_VIDEO_RETENTION: VideoRetention = {
  source_media_retention_days:    30,    // Matches DEFAULT_RETENTION_DAYS["video"]
  generated_video_retention_days: 30,
  delete_after_download:          false,
  delete_after_publishing:        false,
  dealer_retained:                false,
};

export const DEFAULT_VIDEO_TRANSITION: VideoTransition = {
  type:             "dissolve",
  duration_seconds: 0.5,
};

export const DEFAULT_VIDEO_AUDIO_CONFIG: VideoAudioConfig = {
  background_music:       true,
  background_music_style: "calm",
  narration:              false,
  sound_effects:          false,
  muted_by_default:       true,   // Most social platforms auto-mute
  volume_level:           0.4,
};

// ─── Preset templates ─────────────────────────────────────────────────────────

const CUT_FAST: VideoTransition = { type: "cut", duration_seconds: 0 };
const DISSOLVE: VideoTransition = { type: "dissolve", duration_seconds: 0.5 };
const FADE:     VideoTransition = { type: "fade", duration_seconds: 0.8 };

export const PRESET_VIDEO_TEMPLATES: ReadonlyArray<VideoTemplate> = [
  {
    id:                      "before_after_30s",
    name:                    "Before & After — 30s Reel",
    description:             "Classic vehicle transformation reveal for Instagram Reels and TikTok",
    category:                "before_after",
    default_aspect_ratio:    "9:16",
    target_duration_seconds: 30,
    min_sources_required:    2,
    style_preset:            "premium_luxury",
    compatible_profiles:     ["instagram_reels", "tiktok", "youtube_shorts"],
    available_now:           false,
    blocked_by:              "Video generation providers not yet integrated",
    scene_templates: [
      { scene_type: "intro",          default_duration_seconds: 2,  min_duration_seconds: 1,  max_duration_seconds: 3,  required_source_types: ["dealer_logo"],      optional_source_types: [], default_transition_in: FADE },
      { scene_type: "vehicle_before", default_duration_seconds: 5,  min_duration_seconds: 3,  max_duration_seconds: 8,  required_source_types: ["before_photo"],     optional_source_types: ["work_progress_photo"], default_transition_in: DISSOLVE },
      { scene_type: "work_process",   default_duration_seconds: 8,  min_duration_seconds: 5,  max_duration_seconds: 12, required_source_types: ["work_progress_video", "work_progress_photo"], optional_source_types: ["product_photo"], default_transition_in: CUT_FAST },
      { scene_type: "vehicle_after",  default_duration_seconds: 8,  min_duration_seconds: 5,  max_duration_seconds: 12, required_source_types: ["after_photo", "completion_photo"],            optional_source_types: ["completion_video"], default_transition_in: DISSOLVE },
      { scene_type: "call_to_action", default_duration_seconds: 5,  min_duration_seconds: 3,  max_duration_seconds: 7,  required_source_types: [],                  optional_source_types: [], default_transition_in: FADE },
      { scene_type: "outro",          default_duration_seconds: 2,  min_duration_seconds: 1,  max_duration_seconds: 3,  required_source_types: ["dealer_logo"],      optional_source_types: [], default_transition_in: FADE },
    ],
  },
  {
    id:                      "water_beading_15s",
    name:                    "Water Beading — 15s Story",
    description:             "Signature water beading proof for Instagram Stories and TikTok",
    category:                "water_beading_proof",
    default_aspect_ratio:    "9:16",
    target_duration_seconds: 15,
    min_sources_required:    1,
    style_preset:            "dynamic_energy",
    compatible_profiles:     ["instagram_stories", "tiktok"],
    available_now:           false,
    blocked_by:              "Video generation providers not yet integrated",
    scene_templates: [
      { scene_type: "branding",       default_duration_seconds: 2,  min_duration_seconds: 1,  max_duration_seconds: 3,  required_source_types: ["dealer_logo"],        optional_source_types: [], default_transition_in: FADE },
      { scene_type: "water_beading",  default_duration_seconds: 10, min_duration_seconds: 5,  max_duration_seconds: 12, required_source_types: ["water_beading_video"], optional_source_types: [], default_transition_in: CUT_FAST },
      { scene_type: "call_to_action", default_duration_seconds: 3,  min_duration_seconds: 2,  max_duration_seconds: 5,  required_source_types: [],                     optional_source_types: [], default_transition_in: DISSOLVE },
    ],
  },
  {
    id:                      "completion_showcase_60s",
    name:                    "Completion Showcase — 60s Full Reel",
    description:             "Full-length service completion showcase for YouTube Shorts and TikTok",
    category:                "completion_showcase",
    default_aspect_ratio:    "9:16",
    target_duration_seconds: 60,
    min_sources_required:    3,
    style_preset:            "premium_luxury",
    compatible_profiles:     ["youtube_shorts", "tiktok", "instagram_reels"],
    available_now:           false,
    blocked_by:              "Video generation providers not yet integrated",
    scene_templates: [
      { scene_type: "intro",            default_duration_seconds: 3,  min_duration_seconds: 2,  max_duration_seconds: 5,  required_source_types: ["dealer_logo"],         optional_source_types: [], default_transition_in: FADE },
      { scene_type: "vehicle_before",   default_duration_seconds: 8,  min_duration_seconds: 5,  max_duration_seconds: 12, required_source_types: ["before_photo"],        optional_source_types: [], default_transition_in: DISSOLVE },
      { scene_type: "work_process",     default_duration_seconds: 15, min_duration_seconds: 10, max_duration_seconds: 20, required_source_types: ["work_progress_video"],  optional_source_types: ["work_progress_photo", "product_video"], default_transition_in: CUT_FAST },
      { scene_type: "water_beading",    default_duration_seconds: 8,  min_duration_seconds: 5,  max_duration_seconds: 12, required_source_types: ["water_beading_video"],  optional_source_types: [], default_transition_in: CUT_FAST },
      { scene_type: "vehicle_after",    default_duration_seconds: 12, min_duration_seconds: 8,  max_duration_seconds: 15, required_source_types: ["completion_photo"],     optional_source_types: ["completion_video", "after_photo"], default_transition_in: DISSOLVE },
      { scene_type: "customer_review",  default_duration_seconds: 7,  min_duration_seconds: 4,  max_duration_seconds: 10, required_source_types: [],                      optional_source_types: ["customer_review"], default_transition_in: FADE },
      { scene_type: "call_to_action",   default_duration_seconds: 5,  min_duration_seconds: 3,  max_duration_seconds: 7,  required_source_types: [],                      optional_source_types: [], default_transition_in: DISSOLVE },
      { scene_type: "outro",            default_duration_seconds: 2,  min_duration_seconds: 1,  max_duration_seconds: 3,  required_source_types: ["dealer_logo"],          optional_source_types: [], default_transition_in: FADE },
    ],
  },
];
