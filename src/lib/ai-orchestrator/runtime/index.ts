// DealerOS — AI Orchestration Engine: Runtime Public API (Sprint 11K + 11L)
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

// Sprint 11L: Live Runtime Bridge types
export type {
  AIExecutionBridgeState,
  AIExecutionBridgeContext,
  AIExecutionBridgePolicy,
  AICapabilitySummary,
  AIExecutionNextAction,
  AIExecutionBridgeResult,
  AIStepBridgeResult,
  AIApprovalPauseRecord,
  AIOrchestratorLiveBridgeResult,
  AILiveRuntimeRequest,
  AIRuntimeBridgeCapabilityId,
  AIRuntimeBridgeCapability,
  AIOrchestratorRuntimeBridge,
} from "./bridge-types";
export {
  DEFAULT_BRIDGE_POLICY,
  RUNTIME_BRIDGE_CAPABILITIES,
  AI_ORCHESTRATOR_RUNTIME_BRIDGE,
} from "./bridge-types";

// Sprint 11L: Agent instance registry (Phase B)
export {
  getAgentInstance,
  isConcreteAgent,
  isPlannedAgentStub,
} from "./agent-instance-registry";

// Sprint 11L: Runtime state model (Phase C)
export type {
  AIRuntimeExecutionRecord,
  AIRuntimePlanState,
} from "./runtime-state";
export {
  buildInitialExecutionRecord,
  buildInitialPlanState,
  transitionStepState,
  transitionPlanState,
  recordStepResult,
  isTerminalState,
  isBlockingState,
  isPauseState,
  computeOverallPlanState,
  getCompletedStepIds,
} from "./runtime-state";

// Sprint 11L: Step bridge executor (Phase B + D)
export {
  runStepBridgeLifecycle,
} from "./step-bridge";

// Sprint 11L: Approval pause handler (Phase E)
export {
  buildApprovalPauseRecord,
  isApprovalPaused,
  isApprovalApproved,
  isApprovalRejected,
  resolveApprovalPause,
  computePendingStepIds,
} from "./approval-pause-handler";

// Sprint 11L: Plan bridge runner (Phase A)
export {
  runPlanLiveBridge,
} from "./plan-bridge";
