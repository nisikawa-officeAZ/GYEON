// DealerOS — AI Reputation Agent: Public API
//
// Import run-reputation-task.ts directly when calling the server action:
//   import { runReputationTask } from "@/lib/ai/agents/reputation/run-reputation-task"
//
// Import workflow utilities directly when needed:
//   import { computeTrend, REPUTATION_COMPLIANCE } from "@/lib/ai/agents/reputation/workflow"

export { ReputationAgent } from "./reputation-agent";

export type {
  ReviewPlatform,
  ReviewPlatformConfig,
  ReputationCapability,
  ReputationContext,
  CustomerReview,
  ReviewRequestPayload,
  ReviewRequestOutput,
  ReviewResponsePayload,
  ReviewResponseOutput,
  ReviewSentimentType,
  ReviewSentiment,
  ReviewServiceCategory,
  ReviewKeyword,
  LLMOMetadata,
  ReviewAnalysisResult,
  ReputationAnalysisPayload,
  ReputationDashboard,
  MarketingAgentFeed,
  ReputationAgentRequest,
  ReputationAgentResponse,
  ReviewRequestGenerationRequest,
  ReviewResponseDraftingRequest,
  ReputationAnalysisRequest,
} from "./types";

export {
  REVIEW_PLATFORM_LABELS,
  DEFAULT_REPUTATION_CONTEXT,
} from "./types";

export type {
  ReputationWorkflowStage,
  ReputationWorkflowEvent,
  WorkflowTransition,
  ReviewRequestThrottle,
  ReputationComplianceRules,
} from "./workflow";

export {
  WORKFLOW_TRANSITIONS,
  REVIEW_REQUEST_THROTTLE,
  REPUTATION_COMPLIANCE,
  PLATFORM_PRIORITY,
  SENTIMENT_THRESHOLDS,
  computeTrend,
} from "./workflow";
