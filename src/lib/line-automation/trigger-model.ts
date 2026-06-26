// DealerOS — LINE Automation Platform: Trigger Model (Sprint 11G Phase C)
//
// Defines the trigger type system, CE event mappings, and trigger-to-workflow routing.
//
// LineAutomationTriggerType is a superset of EngagementEventType:
//   - WORK_COMPLETED, MAINTENANCE_DUE, PAYMENT_COMPLETED map 1:1 to CE events
//   - RESERVATION_CREATED, RESERVATION_TOMORROW, ESTIMATE_EXPIRED, CUSTOMER_BIRTHDAY
//     are future triggers not yet in the CE event system
//   - MANUAL_TRIGGER is fired by explicit dealer action in the UI
//   - AI_TRIGGER is fired by an AI agent making an autonomous decision (Phase 11H+)
//
// The trigger-to-workflow map (LINE_TRIGGER_WORKFLOW_MAP) is the canonical routing
// table: given a trigger, which workflows should be considered for activation.
// Multiple workflows may be activated by a single trigger (e.g. WORK_COMPLETED
// activates both review_request and campaign_delivery).
//
// Pure — no "use server", no async, no DB calls.

import type { EngagementEventType } from "@/lib/customer-engagement/events";
import type { LineAutomationTriggerType, LineAutomationWorkflowId } from "./line-automation-types";

// ─── CE event → trigger mapping ────────────────────────────────────────────────

/**
 * CE_EVENT_TO_TRIGGER — maps CE EngagementEventType to LineAutomationTriggerType.
 * Only CE events that have a corresponding automation trigger are included.
 * Other CE events (CUSTOMER_CREATED, VEHICLE_REGISTERED, etc.) have no trigger.
 */
export const CE_EVENT_TO_TRIGGER: Partial<Record<EngagementEventType, LineAutomationTriggerType>> = {
  WORK_COMPLETED:   "WORK_COMPLETED",
  MAINTENANCE_DUE:  "MAINTENANCE_DUE",
  PAYMENT_COMPLETED:"PAYMENT_COMPLETED",
} as const;

/**
 * lineAutomationTriggerFromCEEvent — converts a CE event type to the corresponding
 * LineAutomationTriggerType. Returns null for CE events with no automation trigger.
 */
export function lineAutomationTriggerFromCEEvent(
  event: EngagementEventType,
): LineAutomationTriggerType | null {
  return CE_EVENT_TO_TRIGGER[event] ?? null;
}

// ─── Trigger metadata ──────────────────────────────────────────────────────────

/**
 * LineAutomationTriggerMeta — human-readable metadata about a trigger type.
 * Used for documentation, settings UI, and admin panels.
 */
export interface LineAutomationTriggerMeta {
  type:             LineAutomationTriggerType;
  label:            string;
  description:      string;
  source:           "ce_event" | "reservation_system" | "scheduler" | "dealer" | "ai_agent";
  available:        boolean;    // True when trigger is wired up in Sprint 11G
  available_since:  string;     // Sprint or phase when this trigger became available
}

/**
 * TRIGGER_REGISTRY — metadata for all supported trigger types.
 */
export const TRIGGER_REGISTRY: readonly LineAutomationTriggerMeta[] = [
  {
    type:            "WORK_COMPLETED",
    label:           "Work Completed",
    description:     "Fired when a work order is marked as completed",
    source:          "ce_event",
    available:       true,
    available_since: "Sprint 11E",
  },
  {
    type:            "MAINTENANCE_DUE",
    label:           "Maintenance Due",
    description:     "Fired when a scheduled maintenance window opens for a customer vehicle",
    source:          "ce_event",
    available:       true,
    available_since: "Phase 47",
  },
  {
    type:            "RESERVATION_CREATED",
    label:           "Reservation Created",
    description:     "Fired when a customer books a new reservation",
    source:          "reservation_system",
    available:       false,
    available_since: "Sprint 11H+",
  },
  {
    type:            "RESERVATION_TOMORROW",
    label:           "Reservation Tomorrow",
    description:     "Fired 24 hours before a reservation is scheduled",
    source:          "scheduler",
    available:       false,
    available_since: "Sprint 11H+",
  },
  {
    type:            "ESTIMATE_EXPIRED",
    label:           "Estimate Expired",
    description:     "Fired when an estimate passes its expiry date without approval",
    source:          "scheduler",
    available:       false,
    available_since: "Sprint 11H+",
  },
  {
    type:            "PAYMENT_COMPLETED",
    label:           "Payment Completed",
    description:     "Fired when a payment is received and recorded",
    source:          "ce_event",
    available:       true,
    available_since: "Phase 58",
  },
  {
    type:            "CUSTOMER_BIRTHDAY",
    label:           "Customer Birthday",
    description:     "Fired on a customer's birthday (requires date of birth in customer profile)",
    source:          "scheduler",
    available:       false,
    available_since: "Sprint 11H+",
  },
  {
    type:            "MANUAL_TRIGGER",
    label:           "Manual Trigger",
    description:     "Dealer manually initiates the workflow from the UI",
    source:          "dealer",
    available:       true,
    available_since: "Sprint 11G",
  },
  {
    type:            "AI_TRIGGER",
    label:           "AI-Initiated Trigger",
    description:     "An AI agent determines the optimal time to run a workflow",
    source:          "ai_agent",
    available:       false,
    available_since: "Sprint 11H+",
  },
] as const;

// ─── Trigger → workflow routing table ─────────────────────────────────────────

/**
 * LINE_TRIGGER_WORKFLOW_MAP — canonical routing: trigger → workflows to activate.
 *
 * A single trigger may activate multiple workflows. The automation engine
 * evaluates the policy and eligibility for each workflow independently.
 *
 * Examples:
 *   WORK_COMPLETED activates review_request (review solicitation)
 *   MAINTENANCE_DUE activates maintenance_reminder and inspection_reminder
 */
export const LINE_TRIGGER_WORKFLOW_MAP: Record<LineAutomationTriggerType, LineAutomationWorkflowId[]> = {
  WORK_COMPLETED:       ["review_request"],
  MAINTENANCE_DUE:      ["maintenance_reminder", "inspection_reminder"],
  RESERVATION_CREATED:  ["reservation_confirmation"],
  RESERVATION_TOMORROW: ["reservation_reminder"],
  ESTIMATE_EXPIRED:     ["estimate_followup"],
  PAYMENT_COMPLETED:    ["invoice_notification"],
  CUSTOMER_BIRTHDAY:    ["birthday_message"],
  MANUAL_TRIGGER:       [
    "review_request",
    "maintenance_reminder",
    "reservation_confirmation",
    "estimate_followup",
    "campaign_delivery",
    "custom_workflow",
  ],
  AI_TRIGGER: [
    "review_request",
    "campaign_delivery",
    "birthday_message",
    "custom_workflow",
  ],
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns all workflow IDs that a given trigger may activate. */
export function getWorkflowsForTrigger(
  trigger: LineAutomationTriggerType,
): LineAutomationWorkflowId[] {
  return LINE_TRIGGER_WORKFLOW_MAP[trigger] ?? [];
}

/** Returns the trigger metadata record for a given trigger type. */
export function getTriggerMeta(
  type: LineAutomationTriggerType,
): LineAutomationTriggerMeta | undefined {
  return TRIGGER_REGISTRY.find((t) => t.type === type);
}

/** Returns all trigger types that are currently wired up and available. */
export function getAvailableTriggers(): readonly LineAutomationTriggerMeta[] {
  return TRIGGER_REGISTRY.filter((t) => t.available);
}
