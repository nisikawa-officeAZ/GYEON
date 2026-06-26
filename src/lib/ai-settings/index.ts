// DealerOS — AI Settings Platform: Public API (Sprint 11O)
//
// Single barrel export for the AI Settings Platform.
// Import from "@/lib/ai-settings" for all settings types and helpers.
//
// Phase A: Settings profile domain
// Phase B: Provider selection model
// Phase C: Capability assignment
// Phase D: Budget policy
// Phase E: Settings view models
// Phase F: Orchestrator integration

// Phase A — Settings profile domain
export type {
  AIProviderHealthStatus,
  AIProviderHealth,
  AIProviderHealthMap,
  AIExecutionPreferenceMode,
  AIExecutionPreference,
  AIProviderConfiguration,
  AIProviderPriority,
  AISettingsProfile,
  AISettingsPlatformDescriptor,
} from "./settings-profile-types";
export {
  DEFAULT_EXECUTION_PREFERENCE,
  AI_SETTINGS_PLATFORM,
} from "./settings-profile-types";

// Phase B — Provider selection model
export type {
  AIProviderSelectionRule,
  AIProviderSelectionConfig,
} from "./provider-selection";
export {
  DEFAULT_PROVIDER_SELECTION,
  buildDefaultProviderSelection,
  getProviderForCapability,
  getOrderedProviders,
  isProviderSelectionConfigured,
} from "./provider-selection";

// Phase C — Capability assignment
export type {
  AICapabilityAssignmentStatus,
  AICapabilityAssignment,
  AICapabilityAssignmentMap,
} from "./capability-assignment";
export {
  DEFAULT_CAPABILITY_ASSIGNMENTS,
  buildDefaultCapabilityAssignments,
  getAssignmentForCapability,
  isCapabilityEnabled,
  getEnabledCapabilities,
  getDisabledCapabilities,
} from "./capability-assignment";

// Phase D — Budget policy
export type {
  AIBudgetStrategy,
  AIBudgetPolicyConfig,
  AIBudgetPolicyEvaluation,
} from "./budget-policy";
export {
  DEFAULT_BUDGET_POLICY,
  evaluateBudgetPolicy,
  isBudgetPolicyBlocking,
  buildUsagePolicyFromBudgetPolicy,
} from "./budget-policy";

// Phase E — Settings view models
export type {
  AIProviderStatusCard,
  AICapabilityAssignmentCard,
  AIBudgetCard,
  AIHealthCard,
  AISettingsPlatformView,
} from "./settings-view-models";
export {
  buildProviderStatusCards,
  buildCapabilityAssignmentCards,
  buildBudgetCard,
  buildHealthCards,
  buildSettingsPlatformView,
} from "./settings-view-models";

// Phase F — Orchestrator integration
export type {
  AISettingsConsultDecision,
  AISettingsConsultResult,
  AISettingsExecutionContext,
  AISettingsIntegrationStatus,
} from "./orchestrator-integration";
export {
  AI_SETTINGS_INTEGRATION,
  consultAISettingsForExecution,
  buildExecutionContextFromSettings,
  getSettingsIntegrationStatus,
} from "./orchestrator-integration";

// Re-export AIUsagePolicy from gateway layer for convenience
export type { AIUsagePolicy } from "@/lib/ai/usage-policy";
