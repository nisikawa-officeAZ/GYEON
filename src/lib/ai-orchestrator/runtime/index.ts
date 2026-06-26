// DealerOS — AI Orchestration Engine: Runtime Public API (Sprint 11K)
//
// Import from "@/lib/ai-orchestrator/runtime" for all runtime types and functions.
// For the full orchestrator (types + runtime), import from "@/lib/ai-orchestrator".

// Phase A: Runtime domain types
export type {
  AIRuntimeExecutionMode,
  AIRuntimeCapabilityId,
  AIRuntimeCapability,
  AIOrchestratorRuntime,
  AIStepDryRunStatus,
  AIOrchestratorStepResult,
  AIParallelStepGroup,
  AIFailureStrategyEventType,
  AIFailureStrategyEvent,
  AIOrchestratorRuntimeContext,
  AIOrchestratorRuntimeRequest,
  AIOrchestratorStepRunner,
  AIOrchestratorPlanRunner,
  AIOrchestratorRuntimeResult,
} from "./orchestrator-runtime-types";
export {
  RUNTIME_CAPABILITIES,
  AI_ORCHESTRATOR_RUNTIME,
} from "./orchestrator-runtime-types";

// Phase A: Plan runner
export {
  buildRuntimeContext,
  runPlanDryRun,
  createPlanRunner,
} from "./plan-runner";

// Phase B + C: Step runner
export {
  runStepDryRun,
  buildParallelGroups,
  buildGroupIdForStep,
  createStepRunner,
} from "./step-runner";

// Phase D: Approval gate
export type {
  AIApprovalGateStatus,
  AIApprovalGateDecision,
  AIApprovalGateState,
} from "./approval-gate";
export {
  buildPendingApprovalGate,
  evaluateApprovalGate,
  requiresApprovalGate,
  applyApprovalGateDecision,
  isGateBlocking,
  isGateCleared,
  isGatePending,
  getBlockingGates,
  buildGatesForPlan,
} from "./approval-gate";

// Phase E: Failure strategy integration
export type {
  AIRetryDecision,
  AITimeoutValidationResult,
  AICancellationCheckResult,
  AIPartialCompletionEvaluation,
  AIFailureStrategyValidationResult,
} from "./failure-integration";
export {
  evaluateRetryDecision,
  validateTimeoutPolicy,
  validateRetryPolicy,
  checkCancellationToken,
  validateFallbackSpec,
  evaluatePartialCompletion,
  validateFailureStrategy,
  buildDryRunFailureEvent,
  simulateFailureStrategyEvents,
} from "./failure-integration";

// Phase F: Cross-agent feed
export type {
  AICrossAgentFeedExchange,
  AICrossAgentFeedPlan,
  AICrossAgentFeedCompatibility,
} from "./cross-agent-feed";
export {
  detectFeedBetweenSteps,
  buildCrossAgentFeedExchanges,
  resolveFeedPayloadKeys,
  writeFeedOutputKeys,
  validateFeedCompatibility,
  getExchangesForStep,
  getExchangesBetweenAgents,
  buildFeedPlan,
  summarizeFeedExchanges,
} from "./cross-agent-feed";
