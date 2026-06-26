// GYEON Business Hub — Automation Center: Trigger Registry (Sprint 12C)
//
// Static registry of all automation trigger types with metadata.
//
// Trigger sources:
//   "ce_event"           — Customer Engagement Platform fires this (10 events)
//   "scheduler"          — Time-based: birthday, inactivity, maintenance window
//   "dealer_manual"      — Dealer fires the workflow explicitly from the UI
//   "system"             — Platform generates this (invoice overdue, review missing)
//   "ai_agent"           — AI agent requests workflow execution (Sprint 12D+)
//
// Available vs planned:
//   available: true  — trigger is wired to CE or scheduler (can fire)
//   available: false — trigger is declared, not yet wired to an event source
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { AutomationTriggerId, AutomationWorkflowId } from "./automation-types";

// ─── Trigger source ────────────────────────────────────────────────────────────

export type AutomationTriggerSource =
  | "ce_event"
  | "scheduler"
  | "dealer_manual"
  | "system"
  | "ai_agent";

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface AutomationTriggerMeta {
  trigger_id:       AutomationTriggerId;
  display_name:     string;
  description:      string;
  source:           AutomationTriggerSource;
  /** True when this trigger has a real event source wired (CE, scheduler, or system). */
  available:        boolean;
  available_since:  string;
  /** Typical workflows this trigger activates. */
  suggested_workflows: AutomationWorkflowId[];
  /** Whether this trigger always includes a customer_id in context. */
  has_customer_context: boolean;
  /** Whether this trigger always includes a vehicle_id in context. */
  has_vehicle_context: boolean;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const AUTOMATION_TRIGGER_REGISTRY: AutomationTriggerMeta[] = [
  // ── CE-mapped triggers (EngagementEventType mirrors) ───────────────────────
  {
    trigger_id:           "customer_created",
    display_name:         "New Customer Created",
    description:          "Fires when a new customer record is created. Maps to CE CUSTOMER_CREATED event.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["new_customer_welcome"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "vehicle_registered",
    display_name:         "Vehicle Registered",
    description:          "Fires when a vehicle is added to a customer record. Maps to CE VEHICLE_REGISTERED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["new_customer_welcome"],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "estimate_approved",
    display_name:         "Estimate Approved",
    description:          "Fires when a customer accepts an estimate. Maps to CE ESTIMATE_APPROVED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["reservation_confirmation"],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "work_started",
    display_name:         "Work Order Started",
    description:          "Fires when a work order moves to in-progress. Maps to CE WORK_STARTED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  [],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "work_completed",
    display_name:         "Work Order Completed",
    description:          "Fires when a job is marked complete. Maps to CE WORK_COMPLETED. " +
                          "Primary trigger for review requests and follow-up campaigns.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["review_campaign", "work_completed_follow_up"],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "payment_completed",
    display_name:         "Payment Completed",
    description:          "Fires when a payment is received. Maps to CE PAYMENT_COMPLETED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["vip_follow_up"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "review_requested",
    display_name:         "Review Request Sent",
    description:          "Fires when a review request is sent to the customer. Maps to CE REVIEW_REQUESTED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  [],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "review_received",
    display_name:         "Review Received",
    description:          "Fires when a customer posts a review on any connected platform. " +
                          "Maps to CE REVIEW_RECEIVED.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  [],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "maintenance_due",
    display_name:         "Maintenance Due",
    description:          "Fires when a customer's scheduled maintenance window opens. " +
                          "Maps to CE MAINTENANCE_DUE.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  ["maintenance_reminder"],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "campaign_sent",
    display_name:         "Campaign Delivered",
    description:          "Fires when a marketing campaign is delivered to a customer. " +
                          "Maps to CE CAMPAIGN_SENT.",
    source:               "ce_event",
    available:            true,
    available_since:      "Sprint 11G",
    suggested_workflows:  [],
    has_customer_context: true,
    has_vehicle_context:  false,
  },

  // ── Extended triggers ─────────────────────────────────────────────────────
  {
    trigger_id:           "estimate_created",
    display_name:         "Estimate Created",
    description:          "Fires when a new estimate is created for a customer. " +
                          "Source: work orders system (not yet a CE event).",
    source:               "system",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["estimate_follow_up"],
    has_customer_context: true,
    has_vehicle_context:  true,
  },
  {
    trigger_id:           "invoice_overdue",
    display_name:         "Invoice Overdue",
    description:          "Fires when an invoice passes its due date without payment. " +
                          "Source: invoicing system scheduler (future).",
    source:               "scheduler",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["invoice_overdue_notice"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "customer_birthday",
    display_name:         "Customer Birthday",
    description:          "Fires on the customer's birthday. Requires birthday field in customer record. " +
                          "Source: daily scheduler job (future).",
    source:               "scheduler",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["birthday_greeting"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "review_missing",
    display_name:         "Review Missing After Visit",
    description:          "Fires N days after work_completed when no review has been received. " +
                          "Source: system check against review count for the job.",
    source:               "system",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["review_campaign"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "new_lead",
    display_name:         "New Lead",
    description:          "Fires when a new lead is created (form submission, LINE, or import). " +
                          "Distinct from customer_created — no work order yet.",
    source:               "system",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["new_customer_welcome"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "customer_inactive",
    display_name:         "Customer Inactive",
    description:          "Fires when a customer has not visited in a configurable number of days. " +
                          "Source: daily inactivity scanner (requires AI entitlement for scoring).",
    source:               "scheduler",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["inactive_customer_recovery", "revisit_campaign"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "reservation_created",
    display_name:         "Reservation Created",
    description:          "Fires when a new appointment is booked. " +
                          "Source: reservations system (not yet a CE event).",
    source:               "system",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["reservation_confirmation"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "reservation_reminder",
    display_name:         "Reservation Reminder",
    description:          "Fires N hours before a scheduled reservation. Source: scheduler.",
    source:               "scheduler",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (wired)",
    suggested_workflows:  ["reservation_reminder"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "ai_insight_generated",
    display_name:         "AI Insight Generated",
    description:          "Fires when the AI Insights module generates an actionable insight. " +
                          "Enables AI-triggered workflow execution (Sprint 12D+).",
    source:               "ai_agent",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 12D+ (wired)",
    suggested_workflows:  ["ai_insight_action"],
    has_customer_context: false,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "manual_trigger",
    display_name:         "Manual Trigger",
    description:          "Dealer fires the workflow explicitly from the Automation UI. " +
                          "Always available when the workflow is active.",
    source:               "dealer_manual",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 13+ (UI implemented)",
    suggested_workflows:  ["revisit_campaign", "birthday_greeting"],
    has_customer_context: true,
    has_vehicle_context:  false,
  },
  {
    trigger_id:           "ai_trigger",
    display_name:         "AI-Initiated Trigger",
    description:          "An AI agent requests workflow execution autonomously. " +
                          "Requires dealer approval policy (AUT-005).",
    source:               "ai_agent",
    available:            false,
    available_since:      "Sprint 12C (declared) / Sprint 12D+ (wired)",
    suggested_workflows:  ["ai_insight_action"],
    has_customer_context: false,
    has_vehicle_context:  false,
  },
] as const satisfies AutomationTriggerMeta[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getTriggerMeta(
  trigger_id: AutomationTriggerId,
): AutomationTriggerMeta | undefined {
  return AUTOMATION_TRIGGER_REGISTRY.find(t => t.trigger_id === trigger_id);
}

export function getAvailableTriggers(): AutomationTriggerMeta[] {
  return AUTOMATION_TRIGGER_REGISTRY.filter(t => t.available);
}

export function getPlannedTriggers(): AutomationTriggerMeta[] {
  return AUTOMATION_TRIGGER_REGISTRY.filter(t => !t.available);
}

export function getTriggersBySource(source: AutomationTriggerSource): AutomationTriggerMeta[] {
  return AUTOMATION_TRIGGER_REGISTRY.filter(t => t.source === source);
}

export function getTriggerIds(): AutomationTriggerId[] {
  return AUTOMATION_TRIGGER_REGISTRY.map(t => t.trigger_id);
}
