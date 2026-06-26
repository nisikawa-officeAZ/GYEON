// DealerOS — Customer Engagement Platform: Public API
//
// Import server-side utilities directly when needed:
//   import { createEngagementContext, createEngagementEvent } from "@/lib/customer-engagement/context"
//   import { checkTriggerEligibility } from "@/lib/customer-engagement/check-engagement-eligibility"

// Events
export type {
  EngagementEventType,
  EngagementEvent,
  EngagementEventPayloadMap,
  CustomerCreatedEvent,
  VehicleRegisteredEvent,
  EstimateApprovedEvent,
  WorkStartedEvent,
  WorkCompletedEvent,
  PaymentCompletedEvent,
  ReviewRequestedEvent,
  ReviewReceivedEvent,
  MaintenanceDueEvent,
  CampaignSentEvent,
  CustomerCreatedPayload,
  VehicleRegisteredPayload,
  EstimateApprovedPayload,
  WorkStartedPayload,
  WorkCompletedPayload,
  PaymentCompletedPayload,
  ReviewRequestedPayload,
  ReviewReceivedPayload,
  MaintenanceDuePayload,
  CampaignSentPayload,
  EngagementEventMeta,
} from "./events";

export {
  ENGAGEMENT_EVENT_REGISTRY,
  getEventMeta,
} from "./events";

// Core types
export type {
  EngagementContext,
  EngagementActionType,
  EngagementActionId,
  EngagementActionConfig,
  EngagementAction,
  EngagementConditionType,
  EngagementCondition,
  EngagementWorkflowId,
  EngagementWorkflow,
  EngagementHistoryStatus,
  EngagementHistoryEntry,
  EngagementHistory,
} from "./types";

// Workflows
export type { } from "./workflow";
export {
  ENGAGEMENT_WORKFLOWS,
  getWorkflow,
  getWorkflowsByTrigger,
  getEnabledWorkflows,
  getWorkflowsByFeature,
} from "./workflow";

// Triggers
export type {
  EngagementTriggerId,
  EngagementTrigger,
  TriggerEligibilityResult,
} from "./triggers";

export {
  ENGAGEMENT_TRIGGER_REGISTRY,
  getTrigger,
  getTriggersForEvent,
  getAgentSubscribers,
  getTriggersByAgent,
  getEnabledTriggers,
} from "./triggers";
