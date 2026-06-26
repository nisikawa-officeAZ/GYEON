// GYEON Business Hub — Automation Center: Package Barrel (Sprint 12C)
//
// Public API for the Automation Center module.
//
// Dependency direction (non-negotiable):
//   automation → platform-core, communication, subscription, analytics, customer-engagement
//   Never import from automation in those modules.
//
// Relationship to line-automation:
//   src/lib/line-automation/ is a LINE-channel-specific implementation.
//   It does NOT import from this module in Sprint 12C.
//   In Sprint 13, line-automation channel adapters will forward to Automation Center.

// Core types
export type {
  AutomationWorkflowId,
  AutomationTriggerId,
  AutomationActionId,
  AutomationConditionType,
  AutomationDelayUnit,
  AutomationDelayType,
  AutomationDelay,
  AutomationCondition,
  AutomationStepType,
  AutomationStep,
  AutomationTriggerDescriptor,
  AutomationWorkflowStatus,
  AutomationWorkflowCategory,
  AutomationWorkflow,
  AutomationContext,
  AutomationExecutionResult,
  CommunicationChannelId,
  PlatformApplicationId,
  AIEntitlementId,
  AnalyticsMetricGroupId,
} from "./automation-types";

export { TRIGGER_TO_CE_EVENT } from "./automation-types";

// Trigger registry
export {
  AUTOMATION_TRIGGER_REGISTRY,
  getTriggerMeta,
  getAvailableTriggers,
  getPlannedTriggers,
  getTriggersBySource,
  getTriggerIds,
} from "./trigger-registry";
export type { AutomationTriggerSource, AutomationTriggerMeta } from "./trigger-registry";

// Action registry
export {
  AUTOMATION_ACTION_REGISTRY,
  getActionMeta,
  getAvailableActions,
  getActionsByCategory,
  getAIActions,
  getActionsForChannel,
  getActionIds,
} from "./action-registry";
export type { AutomationActionCategory, AutomationActionMeta } from "./action-registry";

// Workflow templates
export {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  getWorkflowsByCategory,
  getAIWorkflows,
  getWorkflowsForTrigger,
  getWorkflowIds,
} from "./workflow-templates";

// Policies
export {
  AUTOMATION_POLICIES,
  getAutomationPolicy,
  getStrictAutomationPolicies,
  getAdvisoryAutomationPolicies,
  getPoliciesFor,
} from "./automation-policy";
export type { AutomationPolicyEnforcement, AutomationPolicy } from "./automation-policy";

// Platform Core bridge
export {
  APPLICATION_AUTOMATION_MAP,
  ACTION_CHANNEL_MAP,
  ACTION_AI_ENTITLEMENT_MAP,
  WORKFLOW_CATEGORY_ENTITLEMENT,
  AUTOMATION_ANALYTICS_IMPACT,
  AUTOMATION_MODULE_MANIFEST,
  getApplicationAutomationProfile,
  getChannelForAction,
  getEntitlementForAction,
} from "./platform-core-bridge";
export type { ApplicationAutomationProfile } from "./platform-core-bridge";

// AI Gateway Bridge (Sprint 12D)
export type {
  AutomationAIActionTypeId,
  AutomationAIActionCategory,
  AutomationAIRequest,
  AutomationAIGatewayPayload,
  AutomationAIReadinessStatus,
  AutomationAIReadiness,
  AutomationAIResult,
  AutomationAIActionDescriptor,
  AutomationAIApprovalProfile,
  CommunicationFlowStepType,
  CommunicationFlowStep,
  AutomationCommunicationFlowType,
  AutomationCommunicationFlow,
} from "./ai";
export {
  AUTOMATION_AI_ACTION_REGISTRY,
  getAIActionDescriptor,
  getAIActionsByCategory,
  getAIActionsForAgent,
  getCustomerFacingAIActions,
  getActionsRequiringApproval,
  getAIActionTypeIds,
  getRequiredAgentForAction,
  getRequiredTaskTypeForAction,
  validateAIActionContext,
  buildGatewayPayload,
  checkAIActionReadiness,
  dryRunAIAction,
  AI_ACTION_TO_AUTOMATION_ACTION,
  AUTOMATION_AI_APPROVAL_POLICIES,
  getApprovalProfile,
  getActionsRequiringApprovalPolicy,
  getCustomerFacingApprovalProfiles,
  getSensitiveDataActions,
  getReviewComplianceActions,
  COMMUNICATION_FLOW_TEMPLATES,
  getFlowForActionType,
  getFlowsByChannel,
  getFlowsRequiringApproval,
  getFlowsRequiringConsent,
} from "./ai";
