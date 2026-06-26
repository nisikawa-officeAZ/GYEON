// DealerOS — AI Marketing Platform Public API
//
// Sprint 11A: canonical entry point for all marketing module consumers.
// Import from "@/lib/marketing" rather than from individual sub-modules.
//
// Module map:
//   marketing-types.ts        → Campaign, Asset, Schedule, Policy, Audience, Analytics types
//   marketing-asset.ts        → MarketingAsset domain object + validation helpers
//   marketing-channel.ts      → Channel registry (10 channels, 0 available now)
//   marketing-workflow.ts     → Publishing workflow state machine (9 stages)
//   marketing-optimization.ts → SEO / MEO / AEO / LLMO / AIO metadata models
//   marketing-ai.ts           → AI agent compatibility layer

// ─── Core domain types (Phase A) ─────────────────────────────────────────────

export type {
  MarketingChannelId,
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingAssetType,
  MarketingAssetStatus,
  MarketingApprovalStatus,
  MarketingPublishRecord,
  MarketingAudienceType,
  CustomerSegmentType,
  MarketingAudience,
  MarketingScheduleStatus,
  MarketingRepeatFrequency,
  MarketingRepeatPolicy,
  MarketingSchedule,
  MarketingCampaignAnalytics,
  HashtagPolicy,
  MarketingPolicy,
  MarketingCampaign,
} from "./marketing-types";

export {
  DEFAULT_HASHTAG_POLICY,
  DEFAULT_MARKETING_POLICY,
  DEFAULT_MARKETING_AUDIENCE,
  DEFAULT_MARKETING_SCHEDULE,
} from "./marketing-types";

// ─── Marketing asset (Phase B) ────────────────────────────────────────────────

export type {
  MarketingAsset,
  MarketingAssetSummary,
  MediaPermissionCheckResult,
} from "./marketing-asset";

export {
  checkMarketingAssetMediaPermissions,
  isAssetPublishable,
  getApprovedAssets,
  getAssetsForChannel,
  getAssetsPendingApproval,
  toMarketingAssetSummary,
  isVideoAssetType,
  isAIGeneratedAssetType,
  requiresCustomerConsent,
} from "./marketing-asset";

// ─── Channel registry (Phase C) ───────────────────────────────────────────────

export type {
  MarketingContentFormat,
  MarketingPlatform,
  MarketingChannelEntry,
} from "./marketing-channel";

export {
  MARKETING_CHANNEL_REGISTRY,
  getChannel,
  getChannelsByPlatform,
  getAvailableChannels,
  getBlockedChannels,
  channelSupportsFormat,
  getSupportedFormats,
  filterValidChannels,
} from "./marketing-channel";

// ─── Publishing workflow (Phase D) ────────────────────────────────────────────

export type {
  MarketingWorkflowStage,
  MarketingWorkflowStepStatus,
  MarketingWorkflowStep,
  MarketingWorkflow,
} from "./marketing-workflow";

export {
  WORKFLOW_STAGES,
  WORKFLOW_TRANSITIONS,
  deriveWorkflowStage,
  getNextStages,
  canAdvanceWorkflow,
  getStageIndex,
  isStageBeforeStage,
  createPendingStep,
  createInitialWorkflowSteps,
} from "./marketing-workflow";

// ─── Optimization models (Phase E) ────────────────────────────────────────────

export type {
  OptimizationTarget,
  SeoStructuredDataType,
  SeoMetadata,
  MeoMetadata,
  AeoFaqItem,
  AeoHowToStep,
  AeoMetadata,
  LlmoMetadata,
  AioMetadata,
  ContentOptimizationProfile,
} from "./marketing-optimization";

export {
  DEFAULT_SEO_METADATA,
  DEFAULT_MEO_METADATA,
  DEFAULT_AEO_METADATA,
  DEFAULT_LLMO_METADATA,
  DEFAULT_AIO_METADATA,
  OPTIMIZATION_TARGET_LABELS,
  buildEmptyOptimizationProfile,
} from "./marketing-optimization";

// ─── AI compatibility (Phase F) ───────────────────────────────────────────────

export type {
  MarketingAICapability,
  MarketingAssetForAgent,
  MarketingWorkflowContext,
  MarketingAIRequest,
  MarketingAIGateResult,
} from "./marketing-ai";

export {
  toMarketingAssetForAgent,
  buildMarketingAIRequest,
  AGENT_MARKETING_CAPABILITIES,
  agentHasMarketingCapability,
} from "./marketing-ai";
