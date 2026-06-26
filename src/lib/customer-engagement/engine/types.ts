// DealerOS — Customer Engagement Platform: Runtime Engine Interfaces
//
// Production-quality type contracts for the execution engine.
// No implementation in Sprint 10G — these interfaces define exactly what
// Phase G-A and Phase G-B will satisfy.
//
// Execution flow:
//   WorkflowExecutionEngine.dispatch(event)
//     → EngagementEventDispatcher.dispatchEvent(event)
//         → getTriggersForEvent(event.event_type)
//         → checkTriggerEligibility(trigger)
//         → createEngagementContext(event)
//         → EngagementActionDispatcher.dispatchAll(workflow.actions, ctx, event)
//             → For each action:
//                 delay_hours === 0 → execute immediately
//                 delay_hours  > 0  → schedule via line_notification_queue or job queue
//             → EngagementHistoryWriter.append(entry) per action
//         → On failure: EngagementFailureHandler.handleFailure(...)

import type {
  EngagementContext,
  EngagementAction,
  EngagementActionType,
  EngagementActionId,
  EngagementHistoryStatus,
  EngagementHistoryEntry,
  EngagementHistory,
  EngagementWorkflowId,
} from "../types";

import type {
  EngagementEvent,
  EngagementEventType,
} from "../events";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface WorkflowExecutionResult {
  success:            boolean;
  trace_id:           string;
  workflow_id?:       EngagementWorkflowId;
  actions_total:      number;
  actions_completed:  number;
  actions_failed:     number;
  actions_skipped:    number;
  /** Japanese user-readable error message when success === false. */
  error?:             string;
}

export interface EventDispatchResult {
  trace_id:           string;
  triggers_found:     number;
  triggers_eligible:  number;
  triggers_skipped:   number;
  workflow_results:   WorkflowExecutionResult[];
}

export interface ActionDispatchResult {
  action_id:          EngagementActionId;
  action_type:        EngagementActionType;
  status:             EngagementHistoryStatus;
  /** Set when action was scheduled with delay_hours > 0. */
  scheduled_for?:     string;   // ISO 8601
  /** Set when action was dispatched to LINE queue. */
  queue_id?:          string;
  /** Japanese error message when status === "failed". */
  error?:             string;
}

export type FailureHandlingResult =
  | { action: "retry";    delay_ms: number; attempt: number }
  | { action: "give_up";  logged: true;     reason: string  };

// ─── Retry policy ─────────────────────────────────────────────────────────────

export interface EngagementRetryPolicy {
  /** Maximum retry attempts before giving up. */
  max_attempts:      number;
  /** Returns true if the action should be retried given the attempt count and error. */
  shouldRetry(action: EngagementAction, attempt: number, error: Error): boolean;
  /** Exponential backoff — returns delay in milliseconds. */
  nextRetryDelayMs(attempt: number): number;
}

/**
 * Default retry policy — 3 attempts, exponential backoff.
 * Not yet instantiated; Sprint 10G type contract only.
 */
export const DEFAULT_RETRY_POLICY: EngagementRetryPolicy = {
  max_attempts: 3,
  shouldRetry(_action, attempt, _error): boolean {
    return attempt < 3;
  },
  nextRetryDelayMs(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30_000);  // max 30s
  },
};

// ─── Core engine interfaces ───────────────────────────────────────────────────

/**
 * EngagementHistoryWriter — appends immutable entries to the engagement history.
 *
 * Phase G-A: no-op (table does not yet exist).
 * Phase G-B: inserts into `customer_engagement_history` (migration required).
 */
export interface EngagementHistoryWriter {
  append(
    entry: Omit<EngagementHistoryEntry, "entry_id" | "occurred_at">,
  ): Promise<void>;

  getHistory(
    dealer_id:   string,
    customer_id: string,
  ): Promise<EngagementHistory>;
}

/**
 * EngagementFailureHandler — classifies failures and decides retry vs give-up.
 * Errors are always logged in Japanese and safe for user display.
 */
export interface EngagementFailureHandler {
  handleFailure(
    action:  EngagementAction,
    context: EngagementContext,
    error:   Error,
    attempt: number,
    policy:  EngagementRetryPolicy,
  ): Promise<FailureHandlingResult>;
}

/**
 * EngagementActionDispatcher — executes or schedules a single workflow action.
 *
 * Routing logic:
 *   action.type === "send_line_message"         → sendLineMessage() / sendCompletionNotification()
 *   action.type === "request_review"            → queueLineNotification(purpose="review_request")
 *   action.type === "schedule_maintenance_reminder" → queueLineNotification(purpose="maintenance_reminder")
 *   action.type === "notify_agent"              → runAgentLifecycle() via AI Agent Framework (Phase G)
 *   action.type === "update_customer_tag"       → customer CRM tag write (future schema)
 *   action.type === "create_task"               → internal task record (future schema)
 *   action.type === "send_marketing_campaign"   → Marketing Agent (future)
 *
 * Delayed actions (action.delay_hours > 0):
 *   LINE actions → queueLineNotification(scheduled_at = now + delay_hours)
 *   AI actions   → EngagementJobQueue (Phase G-B, requires job queue infrastructure)
 */
export interface EngagementActionDispatcher {
  dispatchAction(
    action:  EngagementAction,
    context: EngagementContext,
    event:   EngagementEvent,
  ): Promise<ActionDispatchResult>;

  dispatchAll(
    actions: EngagementAction[],
    context: EngagementContext,
    event:   EngagementEvent,
  ): Promise<ActionDispatchResult[]>;
}

/**
 * EngagementEventDispatcher — routes a single event to all eligible triggers.
 * Calls checkTriggerEligibility per trigger and runs each workflow in sequence.
 */
export interface EngagementEventDispatcher {
  dispatchEvent<T extends EngagementEventType>(
    event: EngagementEvent<T>,
  ): Promise<EventDispatchResult>;
}

/**
 * WorkflowExecutionEngine — top-level orchestrator.
 * Entry point for all Customer Engagement runtime execution.
 *
 * Usage pattern (Phase G-A, no schema change):
 *
 *   // In updateWorkOrder() after status transition to "completed":
 *   const event = await createEngagementEvent("WORK_COMPLETED", customer_id, payload);
 *   if (event) await engine.dispatch(event);
 *
 * The engine never throws — all errors are caught and returned in WorkflowExecutionResult.
 * dealer_id is always from EngagementContext (createEngagementContext → getCurrentDealer()).
 */
export interface WorkflowExecutionEngine {
  dispatch<T extends EngagementEventType>(
    event: EngagementEvent<T>,
  ): Promise<WorkflowExecutionResult>;
}

// ─── Delayed action scheduling ────────────────────────────────────────────────

/**
 * EngagementScheduledAction — a workflow action queued for future execution.
 *
 * Phase G-A: stored in `line_notification_queue` for LINE actions only.
 * Phase G-B: stored in `engagement_job_queue` (new table) for all action types.
 */
export interface EngagementScheduledAction {
  schedule_id:    string;    // Reference ID in the queue system
  action_id:      EngagementActionId;
  action_type:    EngagementActionType;
  dealer_id:      string;    // Always from EngagementContext
  customer_id:    string;
  trace_id:       string;
  scheduled_for:  string;    // ISO 8601 — now + delay_hours
  payload:        Record<string, unknown>;
  status:         "scheduled" | "processing" | "completed" | "failed" | "cancelled";
}

// ─── Phase G-A integration plan (no schema change required) ──────────────────
// The following actions are immediately implementable with existing infrastructure:
//
// WORK_COMPLETED → send_line_message (delay 0h)
//   → sendCompletionNotification(customer_id, work_order_number, report_url)
//   → Existing: src/lib/line/send-line-message.ts
//
// WORK_COMPLETED → request_review (delay 24h)
//   → queueLineNotification({
//       customer_id, line_customer_id,
//       scheduled_at: now + 24h,
//       purpose: "review_request",
//       body: "review request text (static for Phase G-A; AI-generated in Phase G-B)",
//     })
//   → Existing: src/lib/line/queue-line-notification.ts
//
// MAINTENANCE_DUE → send_line_message (delay 0h)
//   → sendMaintenanceReminder(customer_id, booking_url)
//   → Existing: src/lib/line/send-line-message.ts
//
// CUSTOMER_CREATED → send_line_message (delay 0h)
//   → sendLineTextMessage(line_user_id, welcome_text, { purpose: "system" })
//   → Existing: src/lib/line/send-line-message.ts
