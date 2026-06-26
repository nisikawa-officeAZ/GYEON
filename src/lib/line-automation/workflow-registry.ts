// DealerOS — LINE Automation Platform: Workflow Registry (Sprint 11G Phase B)
//
// Centralized registry of all supported LINE automation workflows.
//
// Each entry describes:
//   - Workflow ID and human-readable metadata
//   - Which triggers activate the workflow
//   - Default policy (from line-automation-policy.ts)
//   - Required app features (plan gates)
//   - Required AI agents (from AI Agent Framework)
//   - Implementation status and sprint
//
// The registry is the single source of truth for:
//   - Workflow discovery (settings UI, admin panel)
//   - Feature gate enforcement (canUseFeature)
//   - Trigger routing (which workflows to consider for a given trigger)
//   - Documentation generation
//
// Adding a new workflow:
//   1. Add the workflow ID to LineAutomationWorkflowId in line-automation-types.ts
//   2. Add an entry to WORKFLOW_REGISTRY below
//   3. Add the trigger mapping in trigger-model.ts LINE_TRIGGER_WORKFLOW_MAP
//   4. Add a default policy in line-automation-policy.ts DEFAULT_WORKFLOW_POLICIES
//   5. Add an AI integration spec in ai-integration.ts LINE_AI_INTEGRATION_REGISTRY
//
// Pure — no "use server", no async, no DB calls.

import type { AIAgentId }      from "@/lib/ai/agents/types";
import type { AppFeature }     from "@/lib/plans/plan-types";
import type {
  LineAutomationWorkflowId,
  LineAutomationTriggerType,
  LineAutomationSchedule,
} from "./line-automation-types";
import { DEFAULT_WORKFLOW_POLICIES } from "./line-automation-policy";

// ─── Registry entry ────────────────────────────────────────────────────────────

/**
 * LineAutomationWorkflowEntry — complete descriptor for a single workflow.
 */
export interface LineAutomationWorkflowEntry {
  id:                   LineAutomationWorkflowId;
  label:                string;
  description:          string;
  /** CE or scheduler trigger types that activate this workflow. */
  triggers:             LineAutomationTriggerType[];
  /** App features required to use this workflow. */
  required_features:    AppFeature[];
  /** AI agents required for AI-powered steps (may be empty). */
  required_agents:      AIAgentId[];
  /** Minimum DealerPlan label for UI display. */
  required_plan:        "basic" | "pro" | "pro_plus";
  /** Optional time-based schedule for this workflow. */
  schedule:             LineAutomationSchedule | null;
  implementation_status:"planned" | "partial" | "complete";
  sprint:               string;
  release_notes:        string;
}

// ─── WORKFLOW_REGISTRY ─────────────────────────────────────────────────────────

/**
 * WORKFLOW_REGISTRY — all LINE automation workflows.
 * 10 workflows covering the full customer lifecycle from work completion to repeat visits.
 */
export const WORKFLOW_REGISTRY: readonly LineAutomationWorkflowEntry[] = [
  {
    id:                   "review_request",
    label:                "Review Request",
    description:          "Sends a compliance-safe LINE review request after work completion. Dealer must approve before dispatch.",
    triggers:             ["WORK_COMPLETED", "MANUAL_TRIGGER"],
    required_features:    ["line", "ai_reputation"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             null,
    implementation_status:"partial",
    sprint:               "Sprint 11E/11F (UI + builder), Sprint 11H+ (dispatch)",
    release_notes:        "Approval UI and deterministic message builder complete. LINE dispatch deferred to Sprint 11H+.",
  },

  {
    id:                   "maintenance_reminder",
    label:                "Maintenance Reminder",
    description:          "Sends a LINE reminder when a scheduled maintenance window opens for a customer vehicle.",
    triggers:             ["MAINTENANCE_DUE", "MANUAL_TRIGGER"],
    required_features:    ["line", "maintenance"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             {
      workflow_id:    "maintenance_reminder",
      cron_expression:null,  // Event-driven — no cron; fired by CE MAINTENANCE_DUE event
      delay_hours:    0,
      max_attempts:   3,
      retry_backoff:  "linear",
      active:         true,
    },
    implementation_status:"complete",
    sprint:               "Phase 47",
    release_notes:        "Implemented in Phase 47 via notification queue. Fully operational.",
  },

  {
    id:                   "reservation_confirmation",
    label:                "Reservation Confirmation",
    description:          "Sends an immediate LINE confirmation when a customer creates a reservation.",
    triggers:             ["RESERVATION_CREATED"],
    required_features:    ["line", "reservations"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             null,
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Requires RESERVATION_CREATED CE event integration. Architecture defined in Sprint 11G.",
  },

  {
    id:                   "reservation_reminder",
    label:                "Reservation Reminder",
    description:          "Sends a LINE reminder 24 hours before a reservation.",
    triggers:             ["RESERVATION_TOMORROW"],
    required_features:    ["line", "reservations"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             {
      workflow_id:    "reservation_reminder",
      cron_expression:"0 8 * * *",  // Daily at 08:00 — check for reservations tomorrow
      delay_hours:    -24,          // Negative: fire 24h BEFORE the event
      max_attempts:   2,
      retry_backoff:  "none",
      active:         false,        // Inactive until RESERVATION_TOMORROW trigger is wired
    },
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Requires scheduler integration. Architecture defined in Sprint 11G.",
  },

  {
    id:                   "estimate_followup",
    label:                "Estimate Follow-up",
    description:          "Sends a LINE follow-up when an estimate expires without dealer approval. Dealer review required.",
    triggers:             ["ESTIMATE_EXPIRED", "MANUAL_TRIGGER"],
    required_features:    ["line", "estimates"],
    required_agents:      ["marketing_agent"],
    required_plan:        "pro_plus",
    schedule:             {
      workflow_id:    "estimate_followup",
      cron_expression:"0 10 * * *",  // Daily at 10:00 — check for expired estimates
      delay_hours:    0,
      max_attempts:   1,
      retry_backoff:  "none",
      active:         false,
    },
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Requires estimate expiry date field and scheduler. AI personalization is optional.",
  },

  {
    id:                   "invoice_notification",
    label:                "Invoice Notification",
    description:          "Sends an automatic LINE notification when a payment is received.",
    triggers:             ["PAYMENT_COMPLETED"],
    required_features:    ["line", "invoices", "payments"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             null,
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "PAYMENT_COMPLETED CE event is available. LINE dispatch deferred to Sprint 11H+.",
  },

  {
    id:                   "campaign_delivery",
    label:                "Campaign Delivery",
    description:          "Delivers AI-personalized LINE marketing campaigns. Manager approval required before any sends.",
    triggers:             ["WORK_COMPLETED", "MANUAL_TRIGGER", "AI_TRIGGER"],
    required_features:    ["line", "ai_marketing"],
    required_agents:      ["marketing_agent"],
    required_plan:        "pro_plus",
    schedule:             null,
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "High-impact workflow — manager_approval mode enforced. Requires AI Marketing Platform.",
  },

  {
    id:                   "birthday_message",
    label:                "Birthday Message",
    description:          "Sends a LINE birthday message on a customer's birthday (requires date of birth in profile).",
    triggers:             ["CUSTOMER_BIRTHDAY"],
    required_features:    ["line"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             {
      workflow_id:    "birthday_message",
      cron_expression:"0 9 * * *",  // Daily at 09:00 — check for today's birthdays
      delay_hours:    0,
      max_attempts:   1,
      retry_backoff:  "none",
      active:         false,
    },
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Requires customer date_of_birth field and daily scheduler.",
  },

  {
    id:                   "inspection_reminder",
    label:                "Vehicle Inspection Reminder",
    description:          "Sends a LINE reminder for upcoming vehicle inspections (shaken, seibi, etc.).",
    triggers:             ["MAINTENANCE_DUE"],
    required_features:    ["line", "maintenance"],
    required_agents:      [],
    required_plan:        "pro_plus",
    schedule:             {
      workflow_id:    "inspection_reminder",
      cron_expression:null,
      delay_hours:    0,
      max_attempts:   2,
      retry_backoff:  "linear",
      active:         false,
    },
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Shares MAINTENANCE_DUE trigger with maintenance_reminder. Policy distinguishes them.",
  },

  {
    id:                   "custom_workflow",
    label:                "Custom Workflow",
    description:          "Dealer-defined workflow with custom message, trigger, and schedule. Dealer approval required.",
    triggers:             ["MANUAL_TRIGGER", "AI_TRIGGER"],
    required_features:    ["line", "ai_gateway"],
    required_agents:      ["line_agent"],
    required_plan:        "pro_plus",
    schedule:             null,
    implementation_status:"planned",
    sprint:               "Sprint 11H+",
    release_notes:        "Future capability for dealers to define their own workflows. Architecture in Sprint 11G.",
  },
] as const;

// ─── Registry helpers ──────────────────────────────────────────────────────────

/** Returns the registry entry for a workflow. undefined if ID is not in registry. */
export function getWorkflowEntry(
  id: LineAutomationWorkflowId,
): LineAutomationWorkflowEntry | undefined {
  return WORKFLOW_REGISTRY.find((w) => w.id === id);
}

/** Returns all workflows with the given implementation status. */
export function getWorkflowsByStatus(
  status: "planned" | "partial" | "complete",
): readonly LineAutomationWorkflowEntry[] {
  return WORKFLOW_REGISTRY.filter((w) => w.implementation_status === status);
}

/**
 * getEnabledWorkflows — returns workflows whose default policy has enabled: true.
 * In Sprint 11G, only maintenance_reminder is fully enabled.
 */
export function getEnabledWorkflows(): readonly LineAutomationWorkflowEntry[] {
  return WORKFLOW_REGISTRY.filter((w) => DEFAULT_WORKFLOW_POLICIES[w.id].enabled);
}

/**
 * getWorkflowsForFeature — returns all workflows that require a given feature.
 * Useful for plan upgrade prompts.
 */
export function getWorkflowsForFeature(
  feature: AppFeature,
): readonly LineAutomationWorkflowEntry[] {
  return WORKFLOW_REGISTRY.filter((w) => w.required_features.includes(feature));
}

/**
 * getWorkflowsForTriggerType — returns all workflow entries activated by a trigger.
 */
export function getWorkflowEntriesForTrigger(
  trigger: LineAutomationTriggerType,
): readonly LineAutomationWorkflowEntry[] {
  return WORKFLOW_REGISTRY.filter((w) => w.triggers.includes(trigger));
}
