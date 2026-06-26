// DealerOS — AI Reputation Platform Public API
//
// Sprint 11C: canonical public exports for the reputation platform module.
//
// Import from "@/lib/reputation" for all reputation domain types and helpers.
//
// Module structure:
//   reputation-types.ts       — Phase A: pure type definitions + re-exports from agent types
//   reputation-profile.ts     — Phase A: ReputationProfile, ReputationPolicy, ReputationSummary
//   review-request.ts         — Phase B: ReviewRequest, dry-run readiness validator
//   review-draft.ts           — Phase C: ReviewDraft, compliance model, REVIEW_COMPLIANCE_RULES
//   review-signal.ts          — Phase D: ReviewSignal, signal collection, signal helpers
//   reputation-optimization.ts — Phase E: MEO/AEO/LLMO/AIO optimization metadata
//   reputation-engagement.ts  — Phase F: Customer Engagement integration (async)
//
// Dependency chain (no circular imports):
//   reputation-types        → @/lib/ai/agents/reputation/types
//   reputation-profile      → reputation-types, @/lib/ai/agents/reputation/types
//   review-request          → reputation-types, reputation-profile
//   review-draft            → reputation-types, @/lib/ai/agents/reputation/types
//   review-signal           → reputation-types, @/lib/ai/agents/reputation/types
//   reputation-optimization → reputation-types, @/lib/marketing/marketing-optimization
//   reputation-engagement   → reputation-types, reputation-profile, review-request,
//                             @/lib/customer-engagement, @/lib/customer-engagement/engine/*

// ─── Phase A: Core domain types (re-exported from agent foundation) ───────────

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
  ReviewKeyword,
  ReviewServiceCategory,
  LLMOMetadata,
  ReviewAnalysisResult,
  ReputationAnalysisPayload,
  ReputationDashboard,
  MarketingAgentFeed,
  ReputationAgentRequest,
  ReputationAgentResponse,
} from "./reputation-types";

export {
  REVIEW_PLATFORM_LABELS,
  DEFAULT_REPUTATION_CONTEXT,
} from "./reputation-types";

export type {
  ReviewRequestStatus,
  ReviewDestination,
  ReputationProfileStatus,
  ReputationTrendDirection,
  ReviewComplianceFlag,
  ReviewSignalSource,
  ReviewSignalType,
  ReputationInsightType,
  ReviewRequestReadinessCheckName,
  ReviewRequestReadinessCheck,
  ReviewRequestReadinessStatus,
} from "./reputation-types";

// ─── Phase A: Reputation Profile ─────────────────────────────────────────────

export type {
  ReputationPolicy,
  ReputationSummary,
  ReputationInsight,
  ReputationProfile,
} from "./reputation-profile";

export {
  DEFAULT_REPUTATION_POLICY,
  getEligibleDestinations,
  getPrimaryDestination,
  deriveProfileStatus,
  validateReputationPolicy,
  buildDefaultReputationProfile,
  buildReviewDestination,
} from "./reputation-profile";

// ─── Phase B: Review Request Workflow ────────────────────────────────────────

export type {
  ReviewRequest,
  ReviewRequestContext,
  ReviewRequestReadinessResult,
} from "./review-request";

export {
  validateReviewRequestReadiness,
  prepareReviewRequest,
  REVIEW_REQUEST_TRANSITIONS,
  canTransitionReviewRequest,
  isReviewRequestTerminal,
} from "./review-request";

// ─── Phase C: Review Draft Compliance Model ───────────────────────────────────

export type {
  ReviewDraft,
  ReviewComplianceRule,
  DraftComplianceResult,
  ReviewComplianceRequirement,
} from "./review-draft";

export {
  REVIEW_COMPLIANCE_RULES,
  REQUIRED_MESSAGE_ELEMENTS,
  validateDraftCompliance,
  checkRequiredElements,
  buildEmptyReviewDraft,
  updateDraftMessage,
} from "./review-draft";

// ─── Phase D: Reputation Signal Model ────────────────────────────────────────

export type {
  ReviewSignal,
  ReviewSignalCollection,
  SignalAnalysisDimensions,
} from "./review-signal";

export {
  getTextSignals,
  getSignalsByPlatform,
  getSignalsBySource,
  getAnalyzedSignals,
  getPendingAnalysisSignals,
  computeAverageRating,
  computeRatingDistribution,
  aggregateKeywords,
  getLocalSeoSignals,
  getAEOCandidateSignals,
  buildReviewSignal,
} from "./review-signal";

// ─── Phase E: MEO / AEO / LLMO / AIO Optimization Model ──────────────────────

export type {
  ReputationLocalKeywords,
  ReputationServiceKeywords,
  ReputationVehicleKeywords,
  ReputationFAQCandidate,
  ReputationAEOProfile,
  ReputationLLMOProfile,
  ReputationStructuredSummary,
  ReputationAIOProfile,
  ReputationOptimizationProfile,
} from "./reputation-optimization";

export {
  buildEmptyReputationOptimizationProfile,
} from "./reputation-optimization";

// ─── Phase F: Customer Engagement Integration ─────────────────────────────────

export type {
  ReputationEngagementReadiness,
  WorkCompletedReputationPlan,
  ReputationEngagementInput,
} from "./reputation-engagement";

export {
  prepareWorkCompletedReputationPlan,
  summarizePlan,
  isPlanReadyForApproval,
} from "./reputation-engagement";
