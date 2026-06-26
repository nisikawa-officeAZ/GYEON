// GYEON Business Hub — Automation AI Gateway Bridge: Sub-module Barrel (Sprint 12D)
//
// Public API for src/lib/automation/ai/.
//
// Dependency direction (non-negotiable):
//   automation/ai/ → lib/ai, lib/ai-orchestrator, lib/communication, lib/subscription
//   None of those modules may import from automation/ai/.
//
// Sprint 12D: Foundation bridge only — no AI execution, no provider calls.

// Core types
export type {
  AutomationAIActionTypeId,
  AutomationAIActionCategory,
  AutomationAIRequest,
  AutomationAIGatewayPayload,
  AutomationAIReadinessStatus,
  AutomationAIReadiness,
  AutomationAIResult,
} from "./ai-action-types";

// Re-exported gateway types (convenience — avoid importing from multiple modules)
export type {
  AIAgentId, AITaskType, AIGatewayStatus, AIEntitlementId,
} from "./ai-action-types";

// Action registry
export {
  AUTOMATION_AI_ACTION_REGISTRY,
  getAIActionDescriptor,
  getAIActionsByCategory,
  getAIActionsForAgent,
  getCustomerFacingAIActions,
  getActionsRequiringApproval,
  getAIActionTypeIds,
} from "./ai-action-registry";
export type { AutomationAIActionDescriptor } from "./ai-action-registry";

// Bridge functions
export {
  getRequiredAgentForAction,
  getRequiredTaskTypeForAction,
  validateAIActionContext,
  buildGatewayPayload,
  checkAIActionReadiness,
  dryRunAIAction,
  AI_ACTION_TO_AUTOMATION_ACTION,
} from "./ai-gateway-bridge";

// Approval policy
export {
  AUTOMATION_AI_APPROVAL_POLICIES,
  getApprovalProfile,
  getActionsRequiringApprovalPolicy,
  getCustomerFacingApprovalProfiles,
  getSensitiveDataActions,
  getReviewComplianceActions,
} from "./approval-policy";
export type { AutomationAIApprovalProfile } from "./approval-policy";

// Communication flow
export {
  COMMUNICATION_FLOW_TEMPLATES,
  getFlowForActionType,
  getFlowsByChannel,
  getFlowsRequiringApproval,
  getFlowsRequiringConsent,
} from "./communication-flow";
export type {
  CommunicationFlowStepType,
  CommunicationFlowStep,
  AutomationCommunicationFlowType,
  AutomationCommunicationFlow,
} from "./communication-flow";
