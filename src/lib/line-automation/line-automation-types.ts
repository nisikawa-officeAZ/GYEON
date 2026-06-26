// DealerOS — LINE Automation Platform: Core Domain Types (Sprint 11G Phase A)
//
// Canonical type definitions for the LINE Automation Platform.
// This module is the single source of truth for all automation domain types.
//
// Pure types — no "use server", no external calls, no side effects.
//
// Design principles:
//   - dealer_id always comes from getCurrentDealer() — never from client input
//   - dispatch_deferred: true is a literal in Sprint 11G — real dispatch is Phase 11H+
//   - ai_deferred: true is a literal in Sprint 11G — real AI execution is Phase 11H+
//   - Every workflow that touches customers requires explicit approval or policy gate
//   - No fake persistence — state is computed, not stored (until review_requests migration)
//
// Consumed by:
//   - Customer Engagement Platform (trigger source)
//   - AI Gateway + Agent Framework (AI step execution, future)
//   - Media Platform (rich media content, future)
//   - LINE Messaging API (dispatch, future)

import type { AIAgentId } from "@/lib/ai/agents/types";
import type { AITaskType } from "@/lib/ai/types";
import type { AppFeature }  from "@/lib/plans/plan-types";

// ─── Workflow identifier ───────────────────────────────────────────────────────

/**
 * LineAutomationWorkflowId — canonical identifiers for all supported workflows.
 * Registry: see workflow-registry.ts.
 */
export type LineAutomationWorkflowId =
  | "review_request"
  | "maintenance_reminder"
  | "reservation_confirmation"
  | "reservation_reminder"
  | "estimate_followup"
  | "invoice_notification"
  | "campaign_delivery"
  | "birthday_message"
  | "inspection_reminder"
  | "custom_workflow";

// ─── Trigger type ──────────────────────────────────────────────────────────────

/**
 * LineAutomationTriggerType — all events that can activate a workflow.
 *
 * CE-mapped triggers (subset of EngagementEventType):
 *   WORK_COMPLETED, MAINTENANCE_DUE, PAYMENT_COMPLETED
 *
 * Reservation triggers (not yet in CE — requires reservations table):
 *   RESERVATION_CREATED, RESERVATION_TOMORROW
 *
 * Future triggers:
 *   ESTIMATE_EXPIRED, CUSTOMER_BIRTHDAY, MANUAL_TRIGGER, AI_TRIGGER
 */
export type LineAutomationTriggerType =
  | "WORK_COMPLETED"
  | "MAINTENANCE_DUE"
  | "RESERVATION_CREATED"
  | "RESERVATION_TOMORROW"
  | "ESTIMATE_EXPIRED"
  | "PAYMENT_COMPLETED"
  | "CUSTOMER_BIRTHDAY"
  | "MANUAL_TRIGGER"
  | "AI_TRIGGER";

/**
 * LineAutomationTrigger — a fully resolved trigger event that activates a workflow.
 * Built by the automation engine from a source event (CE, scheduled job, or manual).
 */
export interface LineAutomationTrigger {
  type:             LineAutomationTriggerType;
  /** Original CE event type or external source identifier. */
  source_event:     string;
  /** Source entity IDs — set by the trigger builder, not the caller. */
  dealer_id:        string;
  customer_id:      string | null;
  work_order_id?:   string;
  vehicle_id?:      string;
  /** Untyped payload from the source event — serializable. */
  payload:          Record<string, unknown>;
  triggered_by:     "system" | "dealer" | "ai_agent";
  triggered_at:     string;
}

// ─── Action model ──────────────────────────────────────────────────────────────

/**
 * LineAutomationActionType — all action types a workflow step may perform.
 */
export type LineAutomationActionType =
  | "send_text_message"         // Plain text LINE push message
  | "send_template_message"     // LINE template (button/confirm/carousel)
  | "send_flex_message"         // LINE Flex Message for rich layouts
  | "send_rich_menu"            // Activate a Rich Menu for the customer
  | "ai_generate_message"       // AI generates message content (Phase 11H+)
  | "ai_personalize_content"    // AI customizes template variables (Phase 11H+)
  | "schedule_followup"         // Queues a delayed follow-up action
  | "log_interaction"           // Records interaction in message log
  | "update_customer_segment"   // Tags/segments customer based on outcome
  | "notify_dealer";            // Sends an in-app notification to the dealer

/**
 * LineAutomationAction — a single step in a workflow execution plan.
 *
 * deferred: true when the action cannot be executed in the current sprint.
 * All actions are deferred in Sprint 11G — execution is Phase 11H+.
 */
export interface LineAutomationAction {
  type:             LineAutomationActionType;
  sequence:         number;
  label:            string;
  /** True when this action requires an AI agent. */
  requires_ai:      boolean;
  ai_agent_id?:     AIAgentId;
  ai_task_type?:    AITaskType;
  /** True when execution is deferred to a future sprint. */
  deferred:         boolean;
  /** Human-readable reason this action is deferred. */
  blocked_reason?:  string;
  /** Serializable parameters for the action — populated by workflow builder. */
  payload:          Record<string, unknown>;
}

// ─── Execution state ───────────────────────────────────────────────────────────

/**
 * LineAutomationExecutionState — lifecycle state of an automation execution.
 *
 * "dry_run"              — All checks passed; execution is deferred to Phase 11H+
 * "blocked_no_line_link" — Customer is not linked to LINE
 * "blocked_no_approval"  — Dealer/manager approval required but not yet given
 * "blocked_disabled"     — Workflow is disabled in policy
 * "blocked_compliance"   — A compliance rule blocked execution
 * "blocked_ai_unavailable" — AI agent required but AI Gateway is not ready
 * "deferred_ai"          — AI step cannot execute; rest of workflow is deferred
 * "deferred_dispatch"    — LINE dispatch layer not yet implemented
 * "error"                — System error during preparation
 */
export type LineAutomationExecutionState =
  | "dry_run"
  | "blocked_no_line_link"
  | "blocked_no_approval"
  | "blocked_disabled"
  | "blocked_compliance"
  | "blocked_ai_unavailable"
  | "deferred_ai"
  | "deferred_dispatch"
  | "error";

// ─── Context ───────────────────────────────────────────────────────────────────

/**
 * LineAutomationContext — the fully assembled context for a workflow run.
 *
 * Built server-side before any execution attempt.
 * dealer_id is always sourced from getCurrentDealer() — never from input.
 */
export interface LineAutomationContext {
  /** Always from getCurrentDealer() — never from client input or URL. */
  dealer_id:        string;
  workflow_id:      LineAutomationWorkflowId;
  customer_id:      string | null;
  /** LINE user ID for the customer — null if not linked. */
  line_user_id:     string | null;
  trigger:          LineAutomationTrigger;
  required_features:AppFeature[];
  prepared_at:      string;
}

// ─── Execution result ──────────────────────────────────────────────────────────

/**
 * LineAutomationResult — typed outcome of a workflow preparation run.
 *
 * dispatch_deferred: true — LINE dispatch is not implemented in Sprint 11G.
 * ai_deferred: true — AI execution is not implemented in Sprint 11G.
 * Both fields are literal types to prevent accidental "truthy" bypasses.
 */
export interface LineAutomationResult {
  state:                    LineAutomationExecutionState;
  /** Always from getCurrentDealer() via LineAutomationContext. */
  dealer_id:                string;
  workflow_id:              LineAutomationWorkflowId;
  trigger:                  LineAutomationTrigger;
  actions_planned:          LineAutomationAction[];
  blocking_reasons:         string[];
  warnings:                 string[];
  dealer_approval_required: boolean;
  /** Always true in Sprint 11G — real dispatch requires Phase 11H+ */
  dispatch_deferred:        true;
  /** Always true in Sprint 11G — real AI execution requires Phase 11H+ */
  ai_deferred:              true;
  prepared_at:              string;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

/**
 * LineAutomationSchedule — time-based execution configuration for a workflow.
 * Used for RESERVATION_TOMORROW, CUSTOMER_BIRTHDAY, etc.
 * Not currently evaluated — Sprint 11G is architecture only.
 */
export interface LineAutomationSchedule {
  workflow_id:      LineAutomationWorkflowId;
  /** ISO 8601 interval or cron expression. null = event-driven, no schedule. */
  cron_expression:  string | null;
  /** Delay from trigger event to first execution attempt, in hours. */
  delay_hours:      number;
  max_attempts:     number;
  retry_backoff:    "none" | "linear" | "exponential";
  active:           boolean;
}

// ─── Approval ─────────────────────────────────────────────────────────────────

/**
 * LineAutomationApproval — a recorded dealer or manager approval decision.
 * Not persisted in Sprint 11G — requires approval_log DB table.
 */
export interface LineAutomationApproval {
  id:               string;
  workflow_id:      LineAutomationWorkflowId;
  /** Always from getCurrentDealer() — never from form input. */
  dealer_id:        string;
  approved_by:      "dealer" | "manager" | "system";
  approved_at:      string;
  /** null = permanent standing approval (until revoked) */
  expires_at:       string | null;
  scope:            "single" | "batch" | "standing";
  revocable:        boolean;
  /** Reason for approval (audit trail) — optional */
  note?:            string;
}

// ─── Media reference ───────────────────────────────────────────────────────────

/**
 * LineAutomationMediaRef — a pointer to a MediaAsset in the Media Platform.
 * Used by rich media LINE messages (before/after galleries, campaign images).
 * Consumption of the Media Platform — does not import from it to avoid coupling.
 */
export interface LineAutomationMediaRef {
  media_asset_id: string;
  media_type:     "image" | "video";
  purpose:        "before_after" | "campaign" | "gallery" | "thumbnail";
  url:            string | null;
}

// ─── Execution plan ────────────────────────────────────────────────────────────

/**
 * LineAutomationExecutionPlan — the complete prepared plan before execution.
 *
 * Represents everything needed to execute a workflow, assembled from:
 *   LineAutomationContext + LineAutomationPolicy + AI integration spec
 *
 * Execution itself is always deferred to Phase 11H+ in Sprint 11G.
 */
export interface LineAutomationExecutionPlan {
  context:            LineAutomationContext;
  actions:            LineAutomationAction[];
  /** Deterministic message preview when available (no AI required). */
  estimated_message:  string | null;
  /** true = approval gate will block dispatch until approved */
  approval_required:  boolean;
  /** null = no AI steps needed for this workflow */
  ai_plan_summary:    string | null;
  /** null = no time-based scheduling needed for this workflow */
  schedule:           LineAutomationSchedule | null;
  /** Always true in Sprint 11G */
  dispatch_deferred:  true;
  prepared_at:        string;
}
