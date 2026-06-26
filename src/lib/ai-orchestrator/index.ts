// DealerOS — AI Orchestration Engine: Public API (Sprint 11J + 11K)
//
// Single barrel export for the AI Orchestration Engine.
// Import from "@/lib/ai-orchestrator" for all orchestration types and helpers.
// Import from "@/lib/ai-orchestrator/runtime" for runtime-specific exports.

// Phase A: Core domain types
export type {
  AIOrchestrationWorkflowId,
  AIExecutionStepStatus,
  AIExecutionStatus,
  AIExecutionStep,
  AIExecutionPlan,
  AIExecutionContext,
  AIExecutionPolicy,
  AIExecutionResult,
  AIExecutionHistoryEntry,
  AIExecutionHistory,
  AIExecutionCapabilityId,
  AIExecutionCapability,
  AIOrchestrator,
} from "./orchestrator-types";
export {
  AI_ORCHESTRATOR,
  ORCHESTRATOR_CAPABILITY_REGISTRY,
  DEFAULT_EXECUTION_POLICY,
  buildExecutionStep,
  buildExecutionPlan,
  buildExecutionResult,
  buildEmptyHistory,
} from "./orchestrator-types";

// Phase B: Agent coordination
export type {
  AgentCoordinationMode,
  AgentCoordinationStep,
  AgentCoordinationPattern,
  AgentOrchestrationRole,
} from "./agent-coordination";
export {
  AGENT_ORCHESTRATION_ROLES,
  AGENT_COORDINATION_PATTERNS,
  getCoordinationPattern,
  getPatternsForWorkflow,
  getAgentRole,
  getAgentsByWorkflow,
} from "./agent-coordination";

// Phase C: Workflow registry
export type {
  AIWorkflowTriggerType,
  AIWorkflowTrigger,
  AIOrchestrationWorkflowStatus,
  AIOrchestrationWorkflowSpec,
} from "./workflow-registry";
export {
  ORCHESTRATION_WORKFLOW_REGISTRY,
  getWorkflowSpec,
  getWorkflowsForCEEvent,
  getWorkflowsForFeature,
  getWorkflowsForAgent,
  getScheduledWorkflows,
  resolveWorkflowPolicy,
} from "./workflow-registry";

// Phase D: Provider bridge
export type {
  AIGatewayBridgeRequest,
  AIGatewayBridgeResponse,
  AIGatewayBridgeConstraints,
  AIGatewayBridgeReadiness,
  AIGatewayBridgeStatusResult,
  AIOrchestrationBridgeState,
} from "./provider-bridge";
export {
  GATEWAY_BRIDGE_CONSTRAINTS,
  buildBridgeRequest,
  buildDeferredBridgeResponse,
  buildInitialBridgeState,
} from "./provider-bridge";

// Phase E: Failure strategy
export type {
  AIRetryPolicy,
  AIRetryableErrorCategory,
  AITimeoutPolicy,
  AICancellationReason,
  AICancellationToken,
  AIFallbackProviderSpec,
  AIPartialCompletionPolicy,
  AIFailureStrategyBundle,
  AIExecutionErrorRecord,
} from "./failure-strategy";
export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUT_POLICY,
  DEFAULT_PARTIAL_COMPLETION_POLICY,
  INITIAL_CANCELLATION_TOKEN,
  buildDefaultFailureStrategy,
  buildCancellationToken,
  isRetryable,
  computeRetryDelay,
} from "./failure-strategy";

// Sprint 11K Runtime: dry-run execution layer
export type {
  AIRuntimeExecutionMode,
  AIOrchestratorRuntime,
  AIStepDryRunStatus,
  AIOrchestratorStepResult,
  AIParallelStepGroup,
  AIFailureStrategyEventType,
  AIFailureStrategyEvent,
  AIOrchestratorRuntimeContext,
  AIOrchestratorRuntimeRequest,
  AIOrchestratorRuntimeResult,
  AICrossAgentFeedExchange,
  AIApprovalGateStatus,
  AIApprovalGateState,
} from "./runtime";
export {
  AI_ORCHESTRATOR_RUNTIME,
  RUNTIME_CAPABILITIES,
  runPlanDryRun,
  createPlanRunner,
  createStepRunner,
  buildRuntimeContext,
  buildParallelGroups,
  buildGatesForPlan,
  buildCrossAgentFeedExchanges,
  validateFailureStrategy,
} from "./runtime";

// Sprint 11M: Provider Execution Readiness
export type {
  AIProviderExecutionCheckId,
  AIProviderExecutionDecision,
  AIProviderExecutionCheckResult,
  AIProviderExecutionGuardResult,
  AIProviderExecutionContext,
  AIProviderExecutionRequest,
  AIProviderExecutionResult,
  AIProviderExecutionPolicy,
  AIProviderExecutionReadiness,
  AIProviderExecutionGuard,
  AIBudgetGuardDecision,
  AIBudgetGuardState,
  AIProviderAdapterCapability,
  AIProviderAdapterRequest,
  AIProviderAdapterResponse,
  AIProviderAdapterHealthCheck,
  AIProviderAdapterErrorCategory,
  AIProviderAdapterError,
  AIProviderAdapterContract,
} from "./provider-execution";
export {
  DEFAULT_PROVIDER_EXECUTION_POLICY,
  AI_PROVIDER_EXECUTION_READINESS,
  checkProviderExecutionReadiness,
  PROVIDER_EXECUTION_GUARD,
  TASK_TO_PROVIDER_CAPS,
  CAPABILITY_GROUP_LABEL,
  getRequiredCapsForAgent,
  getRequiredCapsForTask,
  resolveRequiredCaps,
  isCapabilitySupportedByProvider,
  getMissingCapabilities,
  getCapabilityGroups,
  evaluateBudgetGuard,
  isBudgetBlocking,
  shouldWarnAboutBudget,
  formatRemainingBudget,
} from "./provider-execution";

// Sprint 11L: Live Runtime Bridge
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
  AIOrchestratorRuntimeBridge,
} from "./runtime";
export {
  AI_ORCHESTRATOR_RUNTIME_BRIDGE,
  RUNTIME_BRIDGE_CAPABILITIES,
  DEFAULT_BRIDGE_POLICY,
  runPlanLiveBridge,
  runStepBridgeLifecycle,
  getAgentInstance,
  isConcreteAgent,
  buildApprovalPauseRecord,
  resolveApprovalPause,
  isApprovalPaused,
} from "./runtime";
