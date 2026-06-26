// DealerOS — LINE Automation Platform: Policy and Approval Model (Sprint 11G Phase D)
//
// Defines approval modes, policies, and approval gate evaluation for all workflows.
//
// Approval modes:
//   automatic       — dispatch immediately after trigger, no human gate
//   dealer_approval — dealer must approve in the UI before dispatch
//   manager_approval— escalated approval for high-impact workflows
//   disabled        — workflow is administratively turned off
//
// Policy rules:
//   - dealer_id is always from getCurrentDealer() in any server-side code
//   - dealer_approval is required for any message that could affect reputation
//   - compliance_required: true forces validateReviewLineMessage() (or equivalent)
//     before any customer-facing message is dispatched
//   - cooldown_hours prevents re-sending the same workflow to the same customer
//     within the specified window (30 days for review requests)
//
// All approval evaluation is pure and synchronous — DB lookups are the caller's
// responsibility. This keeps the policy model testable without a live database.

import type {
  LineAutomationWorkflowId,
  LineAutomationApproval,
} from "./line-automation-types";

// ─── Approval mode ─────────────────────────────────────────────────────────────

/**
 * LineAutomationApprovalMode — who must approve before LINE dispatch.
 *
 * "automatic"       — no human gate; system dispatches immediately after trigger
 * "dealer_approval" — dealer must approve via the UI (Review Request flow)
 * "manager_approval"— escalated; requires manager role (high-impact workflows)
 * "disabled"        — workflow is permanently off; no dispatches allowed
 */
export type LineAutomationApprovalMode =
  | "automatic"
  | "dealer_approval"
  | "manager_approval"
  | "disabled";

// ─── Policy ────────────────────────────────────────────────────────────────────

/**
 * LineAutomationPolicy — governance rules for a single workflow.
 *
 * Each workflow has a default policy that the dealer may customize
 * (once a settings DB table exists — pending CTO approval).
 */
export interface LineAutomationPolicy {
  workflow_id:           LineAutomationWorkflowId;
  approval_mode:         LineAutomationApprovalMode;
  /** True when an AI agent step is required (fails if AI Gateway is not ready). */
  requires_ai:           boolean;
  /** True when customer must have a linked LINE account. */
  requires_line_link:    boolean;
  /** True when a configured review/landing URL is required. */
  requires_destination:  boolean;
  /** True when the message text must pass compliance validation before dispatch. */
  compliance_required:   boolean;
  /** Maximum LINE messages sent to any single customer per calendar day. */
  max_messages_per_day:  number;
  /** Minimum hours between repeat sends of this workflow to the same customer. */
  cooldown_hours:        number;
  /** False = workflow is skipped without error; useful during rollout. */
  enabled:               boolean;
}

// ─── Approval gate ─────────────────────────────────────────────────────────────

/**
 * LineAutomationApprovalGate — evaluated result of the approval check.
 * Returned by buildApprovalGate() — pure, no DB calls.
 */
export interface LineAutomationApprovalGate {
  workflow_id:      LineAutomationWorkflowId;
  mode:             LineAutomationApprovalMode;
  requires_action:  boolean;
  /** True when the gate is currently satisfied (approved or automatic). */
  gate_open:        boolean;
  /** Reason the gate is closed — empty string when gate_open. */
  blocked_reason:   string;
  /** The recorded approval that satisfied this gate — null if not yet approved. */
  approval:         LineAutomationApproval | null;
}

// ─── Default policies ──────────────────────────────────────────────────────────

/**
 * DEFAULT_WORKFLOW_POLICIES — default governance for each workflow.
 *
 * These defaults are applied when no dealer-customized policy exists.
 * Review request defaults are the strictest: dealer approval + compliance required.
 * Informational workflows (invoice, confirmation) use automatic approval.
 */
export const DEFAULT_WORKFLOW_POLICIES: Record<LineAutomationWorkflowId, LineAutomationPolicy> = {
  review_request: {
    workflow_id:          "review_request",
    approval_mode:        "dealer_approval",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: true,
    compliance_required:  true,
    max_messages_per_day: 1,
    cooldown_hours:       720,   // 30 days — customers must not be spammed for reviews
    enabled:              false, // Disabled until LINE dispatch is implemented (Phase 11H+)
  },

  maintenance_reminder: {
    workflow_id:          "maintenance_reminder",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       168,   // 7 days
    enabled:              true,
  },

  reservation_confirmation: {
    workflow_id:          "reservation_confirmation",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 2,
    cooldown_hours:       1,
    enabled:              false, // Disabled until reservations trigger integration
  },

  reservation_reminder: {
    workflow_id:          "reservation_reminder",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       24,
    enabled:              false,
  },

  estimate_followup: {
    workflow_id:          "estimate_followup",
    approval_mode:        "dealer_approval",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       72,   // 3 days
    enabled:              false,
  },

  invoice_notification: {
    workflow_id:          "invoice_notification",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       0,   // No cooldown — invoice is a transactional message
    enabled:              false,
  },

  campaign_delivery: {
    workflow_id:          "campaign_delivery",
    approval_mode:        "manager_approval",
    requires_ai:          true,   // AI personalizes campaign content
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  true,
    max_messages_per_day: 1,
    cooldown_hours:       720,   // 30 days — marketing messages must not be spammy
    enabled:              false,
  },

  birthday_message: {
    workflow_id:          "birthday_message",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       8760, // 365 days — one per year
    enabled:              false,
  },

  inspection_reminder: {
    workflow_id:          "inspection_reminder",
    approval_mode:        "automatic",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  false,
    max_messages_per_day: 1,
    cooldown_hours:       168,
    enabled:              false,
  },

  custom_workflow: {
    workflow_id:          "custom_workflow",
    approval_mode:        "dealer_approval",
    requires_ai:          false,
    requires_line_link:   true,
    requires_destination: false,
    compliance_required:  true,
    max_messages_per_day: 1,
    cooldown_hours:       24,
    enabled:              false,
  },
};

// ─── Approval gate builder ─────────────────────────────────────────────────────

/**
 * buildApprovalGate — evaluates whether the approval gate is satisfied.
 *
 * Pure function — caller is responsible for fetching the approval record.
 * No DB calls. No getCurrentDealer().
 */
export function buildApprovalGate(
  policy:   LineAutomationPolicy,
  approval: LineAutomationApproval | null,
): LineAutomationApprovalGate {
  const mode = policy.approval_mode;

  if (mode === "disabled") {
    return {
      workflow_id:     policy.workflow_id,
      mode,
      requires_action: false,
      gate_open:       false,
      blocked_reason:  "Workflow is administratively disabled",
      approval:        null,
    };
  }

  if (mode === "automatic") {
    return {
      workflow_id:     policy.workflow_id,
      mode,
      requires_action: false,
      gate_open:       true,
      blocked_reason:  "",
      approval:        null,
    };
  }

  // dealer_approval or manager_approval: gate is open only if a valid approval exists
  const hasApproval = approval !== null;
  const isExpired   = approval?.expires_at
    ? new Date(approval.expires_at) < new Date()
    : false;

  const gate_open    = hasApproval && !isExpired;
  const blocked_reason = !hasApproval
    ? `${mode === "manager_approval" ? "Manager" : "Dealer"} approval required before dispatch`
    : isExpired
      ? "Approval has expired — re-approval required"
      : "";

  return {
    workflow_id:     policy.workflow_id,
    mode,
    requires_action: !gate_open,
    gate_open,
    blocked_reason,
    approval,
  };
}

// ─── Policy helpers ────────────────────────────────────────────────────────────

/** Returns the default policy for a workflow. Never null — all workflows have defaults. */
export function getDefaultPolicy(workflowId: LineAutomationWorkflowId): LineAutomationPolicy {
  return DEFAULT_WORKFLOW_POLICIES[workflowId];
}

/** True when the policy requires a human to act before dispatch is possible. */
export function requiresHumanApproval(policy: LineAutomationPolicy): boolean {
  return policy.approval_mode === "dealer_approval" || policy.approval_mode === "manager_approval";
}
