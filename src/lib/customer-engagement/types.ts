// DealerOS — Customer Engagement Platform: Core Types
//
// EngagementContext, EngagementWorkflow, EngagementAction, EngagementHistory.
// These types form the contract for the Customer Engagement orchestration layer.
//
// Security rules (non-negotiable):
//   - dealer_id in EngagementContext is ALWAYS from getCurrentDealer()
//   - No EngagementContext may be constructed from client input
//   - All events are immutable append-only records

import type { AppFeature }          from "@/lib/plans/plan-types";
import type { EngagementEventType } from "./events";

// ─── Engagement context ───────────────────────────────────────────────────────

/**
 * Built by createEngagementContext() — never constructed from client data.
 * Carries all server-side resolved state for one engagement workflow run.
 */
export interface EngagementContext {
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:    string;
  customer_id:  string;
  vehicle_id?:  string;
  job_id?:      string;
  event_type:   EngagementEventType;
  /** UUID — for log correlation across workflow steps and AI agent calls. */
  trace_id:     string;
  triggered_at: string;  // ISO 8601
}

// ─── Engagement action ────────────────────────────────────────────────────────

export type EngagementActionType =
  | "send_line_message"              // Send a LINE message via LINE Messaging API
  | "request_review"                 // Trigger review request (via Reputation Agent)
  | "schedule_maintenance_reminder"  // Schedule a future maintenance reminder
  | "send_marketing_campaign"        // Trigger marketing campaign (via Marketing Agent)
  | "notify_agent"                   // Dispatch to an AI agent for inference (Phase G)
  | "create_task"                    // Create an internal dealer task/reminder
  | "update_customer_tag";           // Apply a CRM tag to the customer record

export type EngagementActionId = string;

export interface EngagementActionConfig {
  /** LINE message template ID — for send_line_message actions. */
  template_id?:      string;
  /**
   * AI Agent ID to dispatch to — for notify_agent actions.
   * Must be a valid AIAgentId from the agent registry.
   */
  agent_id?:         string;
  /** Review platform target — for request_review actions. */
  platform?:         string;
  /** Hours ahead to schedule the reminder — for schedule_maintenance_reminder. */
  reminder_days?:    number;
  /** CRM tag name — for update_customer_tag actions. */
  tag_name?:         string;
  /** Campaign template ID — for send_marketing_campaign actions. */
  campaign_id?:      string;
  /** Internal task description — for create_task actions. */
  task_description?: string;
}

export interface EngagementAction {
  id:                EngagementActionId;
  type:              EngagementActionType;
  /** Hours to wait after the trigger before executing this action. 0 = immediate. */
  delay_hours:       number;
  config:            EngagementActionConfig;
  conditions:        EngagementCondition[];
  /** Feature gate — action is skipped if dealer lacks this feature. */
  required_feature?: AppFeature;
}

// ─── Engagement condition ─────────────────────────────────────────────────────

export type EngagementConditionType =
  | "feature_enabled"                  // Dealer has the required AppFeature
  | "customer_has_line"                // Customer is LINE-linked
  | "vehicle_has_maintenance_schedule" // Vehicle has a configured maintenance plan
  | "review_not_yet_requested"         // Review request has not been sent for this job
  | "payment_is_completed"             // Payment status is confirmed
  | "work_order_is_completed"          // Work order status is completed
  | "ai_gateway_ready";                // AI Gateway is configured and enabled

export interface EngagementCondition {
  type:     EngagementConditionType;
  /** Required feature — populated when type = "feature_enabled". */
  feature?: AppFeature;
  /** Arbitrary string param for future condition types. */
  param?:   string;
}

// ─── Engagement workflow ──────────────────────────────────────────────────────

export type EngagementWorkflowId =
  | "welcome_flow"          // CUSTOMER_CREATED → welcome LINE message
  | "completion_flow"       // WORK_COMPLETED → completion notification → review request
  | "payment_flow"          // PAYMENT_COMPLETED → payment confirmation LINE message
  | "review_request_flow"   // REVIEW_REQUESTED → tracking + reputation agent notification
  | "review_received_flow"  // REVIEW_RECEIVED → reputation analysis → marketing feed
  | "maintenance_flow"      // MAINTENANCE_DUE → reminder LINE message → follow-up
  | "campaign_flow";        // CAMPAIGN_SENT → tracking → analytics update

export interface EngagementWorkflow {
  id:                EngagementWorkflowId;
  name_ja:           string;
  description_ja:    string;
  trigger_event:     EngagementEventType;
  actions:           EngagementAction[];
  /** Conditions that must all pass before any action runs. */
  conditions:        EngagementCondition[];
  enabled:           boolean;
  /** Feature gate — workflow is skipped entirely if dealer lacks this feature. */
  required_feature?: AppFeature;
}

// ─── Engagement history ───────────────────────────────────────────────────────

export type EngagementHistoryStatus = "pending" | "completed" | "failed" | "skipped";

export interface EngagementHistoryEntry {
  entry_id:     string;            // UUID
  event_type:   EngagementEventType;
  workflow_id:  EngagementWorkflowId;
  action_id:    EngagementActionId | null;
  action_type:  EngagementActionType | null;
  status:       EngagementHistoryStatus;
  trace_id:     string;
  occurred_at:  string;            // ISO 8601
  /** User-readable Japanese result message. Present on completed/failed entries. */
  result_ja?:   string;
}

/**
 * Full engagement history for a customer under one dealer.
 * Append-only — entries are never modified after creation.
 *
 * Persistence: future `customer_engagement_history` table (migration pending CTO approval).
 * Sprint 10F: type contract only.
 */
export interface EngagementHistory {
  dealer_id:    string;
  customer_id:  string;
  entries:      EngagementHistoryEntry[];
  /** ISO 8601 date of the most recent entry. */
  last_event_at?: string;
}
