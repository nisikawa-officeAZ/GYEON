// DealerOS — AI Orchestration Engine: Provider Execution Readiness (Sprint 11M)
//
// Barrel export for the provider-execution layer.
//
// This layer provides:
//   - 12-check execution guard (Phase B)
//   - Agent/task → provider capability routing (Phase C)
//   - Usage budget guard (Phase D)
//   - Provider adapter contract types (Phase E)
//
// Import from "@/lib/ai-orchestrator/provider-execution" for all execution
// readiness types and helpers.

// Phase A + B: Readiness types and guard
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
} from "./execution-readiness-types";
export {
  DEFAULT_PROVIDER_EXECUTION_POLICY,
  AI_PROVIDER_EXECUTION_READINESS,
} from "./execution-readiness-types";

// Phase B: Execution guard
export {
  checkProviderExecutionReadiness,
  PROVIDER_EXECUTION_GUARD,
} from "./execution-guard";

// Phase C: Capability routing
export {
  TASK_TO_PROVIDER_CAPS,
  CAPABILITY_GROUP_LABEL,
  getRequiredCapsForAgent,
  getRequiredCapsForTask,
  resolveRequiredCaps,
  isCapabilitySupportedByProvider,
  getMissingCapabilities,
  getCapabilityGroups,
} from "./capability-routing";

// Phase D: Budget guard
export type {
  AIBudgetGuardDecision,
  AIBudgetGuardState,
} from "./budget-guard";
export {
  evaluateBudgetGuard,
  isBudgetBlocking,
  shouldWarnAboutBudget,
  formatRemainingBudget,
} from "./budget-guard";

// Phase E: Provider adapter contract
export type {
  AIProviderAdapterCapability,
  AIProviderAdapterRequest,
  AIProviderAdapterResponse,
  AIProviderAdapterHealthCheck,
  AIProviderAdapterErrorCategory,
  AIProviderAdapterError,
  AIProviderAdapterContract,
} from "./provider-adapter-contract";
