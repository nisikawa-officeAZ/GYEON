// DealerOS — AI Content Automation Platform: Public API (Sprint 11I)
//
// Single barrel export for the entire AI Content Automation Platform.
// Import from "@/lib/content-automation" for all platform types and helpers.

// Phase A: Core domain types
export type {
  ContentProjectStatus,
  ContentSource,
  StoryboardScene,
  StoryboardPlan,
  CaptionVariant,
  CaptionPlan,
  HashtagSet,
  HashtagPlan,
  PublishingTarget,
  PublishingPlan,
  ApprovalDecision,
  ApprovalWorkflow,
  PublishingSchedule,
  AutomationPolicy,
  ContentProject,
} from "./content-automation-types";

// Phase B: Content pipeline
export type {
  ContentPipelineStage,
  ContentPipelineStepStatus,
  ContentPipelineStep,
  ContentPipelineStageMeta,
  ContentPipelineExecutionPlan,
} from "./content-pipeline";
export {
  PIPELINE_STAGE_REGISTRY,
  buildPipelineExecutionPlan,
  getPipelineStageMeta,
  getAvailableStages,
  getAIStages,
  getAPIStages,
} from "./content-pipeline";

// Phase C: Publishing registry
export type {
  ContentPublishingDestinationId,
  ContentPublishingDestination,
} from "./publishing-registry";
export {
  PUBLISHING_DESTINATION_REGISTRY,
  getPublishingDestination,
  getDestinationsForOptimization,
  getVideoDestinations,
  getGoogleIndexedDestinations,
  getHashtagOptimizableDestinations,
  destinationToChannelId,
} from "./publishing-registry";

// Phase D: Optimization model
export type {
  ContentOptimizationStageStatus,
  ContentOptimizationStatus,
  ContentOptimizationBundle,
  ContentSeoHints,
  ContentMeoHints,
  // Re-exported from @/lib/marketing for consumer convenience
  OptimizationTarget,
  ContentOptimizationProfile,
  SeoMetadata,
  MeoMetadata,
  AeoMetadata,
  LlmoMetadata,
  AioMetadata,
} from "./optimization-model";
export {
  buildEmptyOptimizationBundle,
  getApplicableTargets,
  isOptimizationComplete,
} from "./optimization-model";

// Phase E: AI compatibility
export type {
  ContentAITaskConfig,
  ContentAgentCrossFeed,
  ContentStageAISpec,
  ContentAIExecutionPlan,
} from "./content-automation-ai";
export {
  CONTENT_AI_STAGE_REGISTRY,
  CONTENT_AI_AGENT_ROLES,
  buildContentAIExecutionPlan,
  buildGrowthAgentFeed,
} from "./content-automation-ai";

// Phase F: Approval workflow
export type {
  ContentApprovalMode,
  ContentApprovalGate,
  ApprovalTransition,
} from "./approval-workflow";
export {
  DEFAULT_AUTOMATION_POLICY,
  evaluateApprovalGate,
  buildApprovalWorkflow,
  validateApprovalTransition,
  applyApprovalDecision,
  requiresDealerAction,
  isAutoPublishMode,
  isBlockingMode,
} from "./approval-workflow";
