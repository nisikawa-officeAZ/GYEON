// DealerOS — AI Video Pipeline Public API
//
// Sprint 11B: canonical public exports for the video pipeline module.
//
// Import from "@/lib/video" for all video pipeline types and helpers.
//
// Module structure:
//   video-types.ts      — Phase A: pure type definitions (no external imports)
//   video-source.ts     — Phase B: VideoSource wrapping MediaAsset
//   video-timeline.ts   — Phase C: VideoScene and VideoTimeline
//   video-project.ts    — Phase A: VideoProject, VideoProjectSummary, helpers
//   video-publishing.ts — Phase D: VIDEO_PUBLISHING_PROFILE_REGISTRY (9 profiles)
//   video-ai.ts         — Phase E: provider-agnostic AI compatibility layer
//   video-privacy.ts    — Phase F: privacy model, consent, retention, download tracking
//
// Dependency chain (no circular imports):
//   video-types → (none)
//   video-source → video-types, @/lib/media
//   video-timeline → video-types, video-source
//   video-project → video-types, video-source, video-timeline
//   video-publishing → video-types
//   video-ai → video-types, video-source, video-project, @/lib/media
//   video-privacy → video-types

// ─── Phase A: Core domain types ───────────────────────────────────────────────

export type {
  VideoProjectStatus,
  VideoSceneType,
  VideoSourceType,
  VideoSourceRole,
  VideoTransitionType,
  VideoAspectRatio,
  VideoResolution,
  VideoFrameRate,
  VideoOutputFormat,
  VideoStylePreset,
  VideoTemplateCategory,
  VideoMusicStyle,
  VideoTextPosition,
  VideoTextStyle,
  VideoSubtitlePolicy,
  VideoLogoPolicy,
  VideoWatermarkPolicy,
  VideoThumbnailPolicy,
  VideoPublishingProfileId,
  VideoAIProviderId,
  VideoAICapabilityType,
  VideoTransition,
  VideoPolicy,
  VideoRetention,
  VideoOutput,
  VideoAnalytics,
  VideoAudioConfig,
  VideoTextOverlay,
  VideoTemplate,
  VideoSceneTemplate,
} from "./video-types";

export {
  DEFAULT_VIDEO_POLICY,
  DEFAULT_VIDEO_RETENTION,
  DEFAULT_VIDEO_TRANSITION,
  DEFAULT_VIDEO_AUDIO_CONFIG,
  PRESET_VIDEO_TEMPLATES,
} from "./video-types";

// ─── Phase B: Source media model ──────────────────────────────────────────────

export type { VideoSource } from "./video-source";
export {
  getSourcesByType,
  getPrimarySource,
  getThumbnailCandidates,
  isVideoSourceType,
  sourceRequiresConsent,
  isSourcePermittedForMarketing,
  allSourcesPermittedForMarketing,
  getBlockedSources,
  buildVideoSource,
} from "./video-source";

// ─── Phase C: Timeline model ──────────────────────────────────────────────────

export type {
  VideoScene,
  VideoTimeline,
  VideoTimelineValidationResult,
  VideoTimelineValidationError,
} from "./video-timeline";
export {
  computeTimelineDuration,
  getScenesInOrder,
  getSceneByType,
  getAllScenesByType,
  getSceneAtTime,
  validateTimeline,
  createEmptyTimeline,
  buildVideoScene,
  reindexScenes,
  syncTimelineDuration,
} from "./video-timeline";

// ─── Phase A (continued): VideoProject ────────────────────────────────────────

export type {
  VideoProject,
  VideoProjectSummary,
  VideoProjectForStoryboard,
  VideoSourceDescription,
} from "./video-project";
export {
  toVideoProjectSummary,
  toVideoProjectForStoryboard,
  isGenerationEligible,
  isReadyForDealerReview,
  isReadyForPublishing,
  buildVideoProject,
} from "./video-project";

// ─── Phase D: Publishing profiles ─────────────────────────────────────────────

export type { VideoPublishingProfile } from "./video-publishing";
export {
  VIDEO_PUBLISHING_PROFILE_REGISTRY,
  getPublishingProfile,
  getAvailablePublishingProfiles,
  getBlockedPublishingProfiles,
  getProfilesByAspectRatio,
  getProfilesByPlatform,
  isDurationValidForProfile,
  filterValidPublishingProfiles,
} from "./video-publishing";

// ─── Phase E: AI compatibility layer ─────────────────────────────────────────

export type {
  VideoAIProviderCapability,
  VideoProjectForAI,
  VideoSceneDescriptionForAI,
  VideoAIRequest,
  VideoAIResponse,
  VideoAIGateResult,
  VideoAIAgentCapability,
} from "./video-ai";
export {
  VIDEO_AI_PROVIDER_REGISTRY,
  AGENT_VIDEO_CAPABILITIES,
  toVideoProjectForAI,
  buildVideoAIRequest,
  getProvidersForCapability,
  getAvailableProviders,
  agentHasVideoCapability,
} from "./video-ai";

// ─── Phase F: Privacy model ───────────────────────────────────────────────────

export type {
  VideoConsentRequirement,
  VideoFacesPolicy,
  VideoLicensePlatePolicy,
  VideoPrivacyConfig,
  VideoDownloadReason,
  VideoDownloadRecord,
  VideoDeletionReason,
  VideoDeletionRecord,
} from "./video-privacy";
export {
  DEFAULT_VIDEO_PRIVACY_CONFIG,
  resolveStrictestConsentRequirement,
  isAIGenerationBlocked,
  isExternalPublishingAllowed,
  buildDownloadRecord,
  buildDeletionRecord,
} from "./video-privacy";
