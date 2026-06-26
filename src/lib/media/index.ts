// DealerOS — Media Runtime Public API
//
// Sprint 10J: canonical entry point for all media module consumers.
// Import from "@/lib/media" rather than from individual sub-modules.

// ─── Core types (Sprint 10I) ──────────────────────────────────────────────────

export type {
  MediaType,
  MediaUsage,
  MediaConsentStatus,
  MediaVisibility,
  DealerMedia,
  MediaForMarketing,
  MediaFileInput,
  MediaMetadata,
  PhotoMimeType,
  VideoMimeType,
  // Retention
  MediaDeletionReason,
  MediaDeletionRecord,
} from "./media-types";

export {
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  CURRENT_MAX_UPLOAD_BYTES,
  VIDEO_TARGET_MAX_UPLOAD_BYTES,
  workOrderFileToDealerMedia,
  getMarketingApprovedMedia,
  // Retention
  DEFAULT_RETENTION_DAYS,
} from "./media-types";

// ─── Context (Sprint 10J) ─────────────────────────────────────────────────────

export type { MediaContext } from "./media-context";
export { createMediaContext } from "./media-context";

// ─── Validation (Sprint 10J) ──────────────────────────────────────────────────

export type {
  MediaUploadPolicy,
  MediaValidationResult,
  MediaValidationError,
  MediaValidationErrorCode,
} from "./media-validation";

export {
  CURRENT_UPLOAD_POLICY,
  CURRENT_PHOTO_UPLOAD_POLICY,
  FUTURE_VIDEO_UPLOAD_POLICY,
  validateMediaFile,
  isPhotoMimeType,
  isVideoMimeType,
  isMediaMimeType,
} from "./media-validation";

// ─── Permission (Sprint 10J) ──────────────────────────────────────────────────

export type {
  MediaPermissionScope,
  MediaPermissionGate,
} from "./media-permission";

export {
  resolvePermissionScope,
  checkMediaPermission,
} from "./media-permission";

// ─── Capability registry (Sprint 10J) ────────────────────────────────────────

export type {
  MediaCapabilityId,
  MediaCapabilityEntry,
} from "./media-capability";

export {
  MEDIA_CAPABILITY_REGISTRY,
  getMediaCapability,
  getCapabilitiesForType,
  getAvailableCapabilities,
  getBlockedCapabilities,
} from "./media-capability";

// ─── Future video architecture (Sprint 10J) ───────────────────────────────────

export type {
  VideoUploadStrategy,
  VideoUploadConfig,
  VideoProcessingStep,
  VideoProcessingPipeline,
  VideoStreamingProtocol,
  VideoStreamingConfig,
  VideoBitrateLevel,
  VideoInfraPrerequisite,
  VideoInfraRequirement,
  // Retention
  VideoRetentionPeriod,
  VideoSourceRetentionConfig,
  VideoGeneratedRetentionConfig,
  VideoRetentionPolicy,
  DealerVideoRetentionPreference,
} from "./media-video";

export {
  FUTURE_VIDEO_UPLOAD_CONFIG,
  FUTURE_VIDEO_PROCESSING_PIPELINE,
  FUTURE_HLS_CONFIG,
  VIDEO_INFRA_REQUIREMENTS,
  areVideoInfraRequirementsMet,
  // Retention
  SUPPORTED_VIDEO_RETENTION_PERIODS,
  NINETY_DAY_RETENTION_REQUIRES_PRO_PLUS,
  DEFAULT_VIDEO_RETENTION_POLICY,
  DEFAULT_DEALER_VIDEO_RETENTION_PREFERENCE,
} from "./media-video";

// ─── AI compatibility (Sprint 10J) ───────────────────────────────────────────

export type {
  MediaAICapabilityType,
  MediaAICapabilityRequest,
  MediaAIGateResult,
  MediaForAI,
  MediaForMarketingAgent,
  MediaForReputationAgent,
  MediaForGrowthAgent,
} from "./media-ai";

export {
  checkMediaAICapability,
  getMediaForMarketingAgent,
  getMediaForReputationAgent,
  buildMediaForGrowthAgent,
} from "./media-ai";

// ─── Runtime orchestrator (Sprint 10J) ───────────────────────────────────────

export { MediaRuntime } from "./media-runtime";
