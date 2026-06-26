// DealerOS — Customer Engagement Engine: Public API
//
// For the dry-run validators, import directly:
//   import { validateLineActionReadiness }  from "@/lib/customer-engagement/engine/line-dry-run"
//   import { validateAgentNotifyReadiness } from "@/lib/customer-engagement/engine/agent-dry-run"

export { EngagementWorkflowRuntime }      from "./runtime";
export { EngagementEventDispatcherImpl }  from "./event-dispatcher";
export { EngagementActionDispatcherImpl } from "./action-dispatcher";

export type {
  WorkflowExecutionEngine,
  WorkflowExecutionResult,
  EventDispatchResult,
  ActionDispatchResult,
  EngagementRetryPolicy,
  EngagementHistoryWriter,
  EngagementFailureHandler,
  EngagementScheduledAction,
  FailureHandlingResult,
} from "./types";

export { DEFAULT_RETRY_POLICY } from "./types";

export type {
  LineActionReadinessStatus,
  LineActionPayload,
  LineActionReadinessResult,
} from "./line-dry-run";

export type {
  AgentNotifyReadinessStatus,
  AgentNotifyPayload,
  AgentNotifyReadinessResult,
} from "./agent-dry-run";

export { getWorkCompletedAgentSubscribers } from "./agent-dry-run";
