// DealerOS — LINE Automation Platform: Public API (Sprint 11G)
//
// Single barrel export for the entire LINE Automation Platform.
//
// Import from "@/lib/line-automation" for all platform types and helpers.
// Do not import individual modules directly outside of this package.

// Phase A: Core domain types
export type {
  LineAutomationWorkflowId,
  LineAutomationTriggerType,
  LineAutomationActionType,
  LineAutomationExecutionState,
  LineAutomationTrigger,
  LineAutomationAction,
  LineAutomationContext,
  LineAutomationResult,
  LineAutomationSchedule,
  LineAutomationApproval,
  LineAutomationMediaRef,
  LineAutomationExecutionPlan,
} from "./line-automation-types";

// Phase B: Workflow registry
export type { LineAutomationWorkflowEntry } from "./workflow-registry";
export {
  WORKFLOW_REGISTRY,
  getWorkflowEntry,
  getWorkflowsByStatus,
  getEnabledWorkflows,
  getWorkflowsForFeature,
  getWorkflowEntriesForTrigger,
} from "./workflow-registry";

// Phase C: Trigger model
export type { LineAutomationTriggerMeta } from "./trigger-model";
export {
  CE_EVENT_TO_TRIGGER,
  TRIGGER_REGISTRY,
  LINE_TRIGGER_WORKFLOW_MAP,
  lineAutomationTriggerFromCEEvent,
  getWorkflowsForTrigger,
  getTriggerMeta,
  getAvailableTriggers,
} from "./trigger-model";

// Phase D: Policy and approval model
export type {
  LineAutomationApprovalMode,
  LineAutomationPolicy,
  LineAutomationApprovalGate,
} from "./line-automation-policy";
export {
  DEFAULT_WORKFLOW_POLICIES,
  buildApprovalGate,
  getDefaultPolicy,
  requiresHumanApproval,
} from "./line-automation-policy";

// Phase E: AI integration
export type {
  LineAutomationAITaskConfig,
  LineAutomationAIIntegrationSpec,
  LineAutomationAIPlan,
} from "./ai-integration";
export {
  LINE_AI_INTEGRATION_REGISTRY,
  buildAIPlan,
  getAIIntegrationSpec,
} from "./ai-integration";

// Phase F: Rich Menu compatibility
export type {
  LineAutomationRichMenuButtonType,
  LineAutomationRichMenuButton,
} from "./rich-menu-compat";
export {
  RICH_MENU_BUTTON_REGISTRY,
  getRichMenuButton,
  getRichMenuButtonsForWorkflow,
  getRichMenuButtonsByStatus,
} from "./rich-menu-compat";
