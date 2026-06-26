// DealerOS — AI Orchestration Engine: Public API (Sprint 11J)
//
// Single barrel export for the AI Orchestration Engine.
// Import from "@/lib/ai-orchestrator" for all orchestration types and helpers.

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
