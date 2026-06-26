// GYEON Business Hub — Automation Center: Core Domain Types (Sprint 12C)
//
// Defines the canonical type model for the Automation Center — the platform-level
// workflow engine shared by all GYEON Business Hub applications.
//
// Design principles:
//   - AutomationTrigger is a superset of EngagementEventType (CE) and includes
//     scheduler, dealer-manual, and AI-generated triggers not in the CE system.
//   - AutomationAction routes to the correct channel via the Communication Center.
//     It never calls provider SDKs directly.
//   - execution_deferred: true is a compile-time literal for all workflow objects
//     in Sprint 12C. Execution requires the Automation Engine (future sprint).
//   - dealer_id must always come from getCurrentDealer() in the execution layer.
//     It is never stored in workflow definitions.
//
// Relationship to src/lib/line-automation/:
//   - line-automation is a LINE-channel-specific implementation (Sprint 11G).
//   - The Automation Center supersedes it with a multi-channel, multi-app model.
//   - line-automation channel adapters will forward to Automation Center in future sprints.
//   - Automation Center does NOT import from line-automation (no dependency inversion).
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { EngagementEventType }    from "@/lib/customer-engagement/events";
import type { CommunicationChannelId } from "@/lib/communication/communication-types";
import type { PlatformApplicationId }  from "@/lib/platform-core/platform-types";
import type { AIEntitlementId }        from "@/lib/subscription/subscription-center-types";
import type { AnalyticsMetricGroupId } from "@/lib/analytics/analytics-types";

// Re-export for module consumers
export type { CommunicationChannelId, PlatformApplicationId, AIEntitlementId, AnalyticsMetricGroupId };

// ─── Workflow identity ────────────────────────────────────────────────────────

/**
 * AutomationWorkflowId — canonical identifiers for all workflow templates.
 * Registry: see workflow-templates.ts.
 */
export type AutomationWorkflowId =
  | "maintenance_reminder"
  | "review_campaign"
  | "revisit_campaign"
  | "birthday_greeting"
  | "new_customer_welcome"
  | "vip_follow_up"
  | "inactive_customer_recovery"
  | "estimate_follow_up"
  | "invoice_overdue_notice"
  | "work_completed_follow_up"
  | "reservation_confirmation"
  | "reservation_reminder"
  | "ai_insight_action"
  | "custom_workflow";

// ─── Trigger identifiers ──────────────────────────────────────────────────────

/**
 * AutomationTriggerId — all events that can activate an automation workflow.
 *
 * CE-mapped triggers (directly correspond to EngagementEventType):
 *   customer_created, vehicle_registered, estimate_approved,
 *   work_started, work_completed, payment_completed,
 *   review_requested, review_received, maintenance_due, campaign_sent
 *
 * Extended triggers (not yet in CE — scheduler or system-generated):
 *   estimate_created, invoice_overdue, customer_birthday,
 *   review_missing, new_lead, customer_inactive, reservation_created,
 *   reservation_reminder, ai_insight_generated
 *
 * Control triggers:
 *   manual_trigger — dealer fires workflow explicitly
 *   ai_trigger     — AI agent requests workflow execution (Sprint 12D+)
 */
export type AutomationTriggerId =
  // CE event mirrors
  | "customer_created"
  | "vehicle_registered"
  | "estimate_approved"
  | "work_started"
  | "work_completed"
  | "payment_completed"
  | "review_requested"
  | "review_received"
  | "maintenance_due"
  | "campaign_sent"
  // Extended triggers
  | "estimate_created"
  | "invoice_overdue"
  | "customer_birthday"
  | "review_missing"
  | "new_lead"
  | "customer_inactive"
  | "reservation_created"
  | "reservation_reminder"
  | "ai_insight_generated"
  // Control triggers
  | "manual_trigger"
  | "ai_trigger";

/** Maps AutomationTriggerId back to the CE EngagementEventType it mirrors (if any). */
export const TRIGGER_TO_CE_EVENT: Partial<Record<AutomationTriggerId, EngagementEventType>> = {
  customer_created:   "CUSTOMER_CREATED",
  vehicle_registered: "VEHICLE_REGISTERED",
  estimate_approved:  "ESTIMATE_APPROVED",
  work_started:       "WORK_STARTED",
  work_completed:     "WORK_COMPLETED",
  payment_completed:  "PAYMENT_COMPLETED",
  review_requested:   "REVIEW_REQUESTED",
  review_received:    "REVIEW_RECEIVED",
  maintenance_due:    "MAINTENANCE_DUE",
  campaign_sent:      "CAMPAIGN_SENT",
} as const;

// ─── Action identifiers ───────────────────────────────────────────────────────

/**
 * AutomationActionId — all actions a workflow step can execute.
 * Registry: see action-registry.ts.
 */
export type AutomationActionId =
  // Communication actions — route via Communication Center
  | "send_line_message"
  | "send_whatsapp_message"
  | "send_email"
  | "send_sms"
  | "send_to_channel"       // Generic: routes to dealer's preferred channel
  | "request_review"        // Sends review request via configured channel
  // Staff actions
  | "create_task"
  | "create_reminder"
  | "notify_staff"
  | "create_internal_note"
  // CRM actions
  | "update_crm_tag"
  | "schedule_reservation"
  // AI actions — require AI Gateway (gated by AIEntitlementId)
  | "generate_ai_caption"
  | "generate_ai_video"
  | "generate_ai_reply"
  | "generate_ai_summary";

// ─── Delay model ──────────────────────────────────────────────────────────────

export type AutomationDelayUnit = "minutes" | "hours" | "days" | "weeks";

export type AutomationDelayType =
  | "fixed"             // Wait a fixed amount after the previous step
  | "relative_to_trigger" // Wait relative to the original trigger event
  | "specific_time";    // Execute at a specific time of day

export interface AutomationDelay {
  type:     AutomationDelayType;
  amount:   number;
  unit:     AutomationDelayUnit;
  /** If execution does not start within max_wait_hours, the step is skipped. */
  max_wait_hours: number | null;
  /** For specific_time: "09:00" (24h, dealer local time). */
  at_time?: string;
}

// ─── Condition model ──────────────────────────────────────────────────────────

export type AutomationConditionType =
  | "customer_has_line"
  | "customer_has_whatsapp"
  | "customer_has_email"
  | "customer_has_vehicle"
  | "customer_tag_includes"
  | "customer_tag_excludes"
  | "days_since_last_visit"
  | "amount_greater_than"
  | "amount_less_than"
  | "work_order_type_is"
  | "review_score_less_than"
  | "review_score_at_least"
  | "ai_entitlement_active"
  | "channel_connected";

export interface AutomationCondition {
  type:            AutomationConditionType;
  /** The value to compare against. Type-safe at runtime via condition executor (future). */
  value?:          string | number | boolean;
  /** For AI entitlement checks — the specific entitlement required. */
  entitlement_id?: AIEntitlementId;
  /** For channel checks. */
  channel_id?:     CommunicationChannelId;
}

// ─── Step model ───────────────────────────────────────────────────────────────

export type AutomationStepType =
  | "trigger"          // Entry point — exactly one per workflow
  | "condition"        // Branch based on a condition check
  | "delay"            // Wait before proceeding
  | "action"           // Execute an action
  | "parallel_actions" // Execute multiple actions simultaneously
  | "end";             // Terminal step

export interface AutomationStep {
  step_id:          string;
  type:             AutomationStepType;
  /** Populated when type is "action" or "parallel_actions". */
  action_id?:       AutomationActionId;
  /** For parallel_actions: list of action IDs to run together. */
  parallel_action_ids?: AutomationActionId[];
  /** Populated when type is "delay". */
  delay?:           AutomationDelay;
  /** Populated when type is "condition". */
  condition?:       AutomationCondition;
  /** Next step on success / condition-true. null = end. */
  on_success:       string | null;
  /** Next step on failure / condition-false. null = end (skip gracefully). */
  on_failure:       string | null;
  /** Human-readable description for the visual builder (future). */
  label:            string;
}

// ─── Trigger descriptor ───────────────────────────────────────────────────────

export interface AutomationTriggerDescriptor {
  trigger_id:       AutomationTriggerId;
  /** CE event this trigger mirrors. null for non-CE triggers. */
  ce_event_type:    EngagementEventType | null;
  /** Conditions that must pass before the workflow activates. */
  entry_conditions: AutomationCondition[];
}

// ─── Workflow definition ──────────────────────────────────────────────────────

export type AutomationWorkflowStatus =
  | "template"    // Uninstantiated template — no dealer context
  | "draft"       // Dealer is editing, not yet active
  | "active"      // Running — fires on trigger
  | "paused"      // Temporarily suspended by dealer
  | "archived";   // No longer in use

/**
 * AutomationWorkflow — the canonical definition of a single workflow.
 *
 * Key invariants:
 *   - dealer_id is NOT stored in the definition. It is injected at execution time
 *     via getCurrentDealer() — never from the client.
 *   - execution_deferred: true is a compile-time guarantee that no step is
 *     executed in Sprint 12C. Execution requires the Automation Engine.
 *   - status: "template" for all entries in WORKFLOW_TEMPLATES (workflow-templates.ts).
 */
export interface AutomationWorkflow {
  id:                       AutomationWorkflowId;
  version:                  number;             // Incremented on breaking changes
  display_name:             string;
  description:              string;
  category:                 AutomationWorkflowCategory;
  trigger:                  AutomationTriggerDescriptor;
  steps:                    AutomationStep[];
  required_channels:        CommunicationChannelId[];
  required_applications:    PlatformApplicationId[];
  required_ai_entitlement:  AIEntitlementId | null;
  analytics_metric_groups:  AnalyticsMetricGroupId[];  // Which metrics this workflow affects
  status:                   AutomationWorkflowStatus;
  available_since:          string;    // Sprint when this template was added
  target_execution_sprint:  string;    // Sprint when live execution is planned
  execution_deferred:       true;      // Always true in Sprint 12C
}

export type AutomationWorkflowCategory =
  | "retention"        // Customer retention and re-engagement
  | "acquisition"      // New customer onboarding
  | "review_management" // Review requests and responses
  | "communication"    // General customer communication
  | "revenue"          // Invoice follow-up, payment reminders
  | "maintenance"      // Service reminders and scheduling
  | "ai_powered"       // Workflows that require AI content generation
  | "staff_ops";       // Internal staff notifications and tasks

// ─── Runtime context (declared, execution deferred) ───────────────────────────

/**
 * AutomationContext — the runtime context injected at execution time.
 * Execution is deferred to future sprints. Declared here for AI Gateway compatibility.
 */
export interface AutomationContext {
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:         string;
  customer_id:       string | null;
  vehicle_id:        string | null;
  work_order_id:     string | null;
  trigger_event_id:  string;          // CE event trace_id or scheduler job ID
  trigger_id:        AutomationTriggerId;
  triggered_at:      string;          // ISO 8601
  /** AI entitlements active for this dealer at execution time. */
  ai_entitlements:   AIEntitlementId[];
  /** Channels confirmed ready for this dealer. */
  active_channels:   CommunicationChannelId[];
}

/**
 * AutomationExecutionResult — declared for future execution engine.
 * All fields are null in Sprint 12C.
 */
export interface AutomationExecutionResult {
  workflow_id:   AutomationWorkflowId;
  success:       boolean;
  steps_executed: number;
  steps_skipped:  number;
  error_message: string | null;
  executed_at:   string | null;
  execution_deferred: true;
}
