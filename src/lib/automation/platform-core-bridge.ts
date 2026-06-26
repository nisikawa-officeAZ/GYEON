// GYEON Business Hub — Automation Center: Platform Core Bridge (Sprint 12C)
//
// Maps Automation Center triggers and actions to Platform Core applications.
// Defines which triggers and actions are applicable per application and
// declares compatibility with Communication Center, AI Gateway, Analytics Center,
// AI Marketplace, Subscription Center, and CRM.
//
// Dependency direction:
//   automation → platform-core, communication, subscription, analytics
//   Never import from automation in those modules.
//
// No AI execution. No external calls. No workflow execution.
// Pure — no "use server", no async, no DB calls.

import type { PlatformApplicationId }  from "@/lib/platform-core/platform-types";
import type { CommunicationChannelId } from "@/lib/communication/communication-types";
import type { AIEntitlementId }        from "@/lib/subscription/subscription-center-types";
import type { AnalyticsMetricGroupId } from "@/lib/analytics/analytics-types";
import type { AutomationTriggerId, AutomationActionId, AutomationWorkflowId } from "./automation-types";

// ─── Application → automation mapping ─────────────────────────────────────────

export interface ApplicationAutomationProfile {
  application_id:    PlatformApplicationId;
  supported_triggers: AutomationTriggerId[];
  supported_actions:  AutomationActionId[];
  recommended_templates: AutomationWorkflowId[];
  analytics_groups:  AnalyticsMetricGroupId[];
}

export const APPLICATION_AUTOMATION_MAP: ApplicationAutomationProfile[] = [
  {
    application_id:   "dealer_agent",
    supported_triggers: [
      "customer_created", "vehicle_registered", "estimate_created", "estimate_approved",
      "work_started", "work_completed", "payment_completed",
      "review_requested", "review_received", "review_missing",
      "maintenance_due", "invoice_overdue", "customer_birthday",
      "customer_inactive", "new_lead", "reservation_created",
      "reservation_reminder", "manual_trigger",
    ],
    supported_actions: [
      "send_line_message", "request_review", "create_task", "create_reminder",
      "notify_staff", "create_internal_note", "update_crm_tag",
      "schedule_reservation", "generate_ai_caption", "generate_ai_video",
      "generate_ai_summary", "send_to_channel",
    ],
    recommended_templates: [
      "maintenance_reminder", "review_campaign", "new_customer_welcome",
      "work_completed_follow_up", "estimate_follow_up", "invoice_overdue_notice",
      "birthday_greeting", "reservation_confirmation", "reservation_reminder",
      "vip_follow_up",
    ],
    analytics_groups: [
      "dealer_operations", "work_orders", "estimates", "maintenance",
      "communication", "reviews", "crm", "sales",
    ],
  },
  {
    application_id:   "crm",
    supported_triggers: [
      "customer_created", "customer_inactive", "customer_birthday",
      "new_lead", "campaign_sent", "manual_trigger",
    ],
    supported_actions: [
      "update_crm_tag", "create_internal_note", "notify_staff",
      "create_task", "send_to_channel", "generate_ai_caption",
    ],
    recommended_templates: [
      "new_customer_welcome", "birthday_greeting",
      "revisit_campaign", "inactive_customer_recovery", "vip_follow_up",
    ],
    analytics_groups: ["crm", "communication"],
  },
  {
    application_id:   "ai_operations",
    supported_triggers: [
      "ai_insight_generated", "ai_trigger", "work_completed",
      "payment_completed", "maintenance_due",
    ],
    supported_actions: [
      "generate_ai_caption", "generate_ai_video", "generate_ai_reply",
      "generate_ai_summary", "notify_staff",
    ],
    recommended_templates: ["ai_insight_action", "revisit_campaign", "inactive_customer_recovery"],
    analytics_groups: ["ai_usage", "dealer_operations"],
  },
  {
    application_id:   "enterprise_distribution",
    supported_triggers: [
      "customer_created", "payment_completed", "invoice_overdue", "new_lead",
    ],
    supported_actions: [
      "notify_staff", "create_task", "create_internal_note", "update_crm_tag",
    ],
    recommended_templates: ["new_customer_welcome", "invoice_overdue_notice", "vip_follow_up"],
    analytics_groups: ["sales", "crm"],
  },
  {
    application_id:   "accounting",
    supported_triggers: ["invoice_overdue", "payment_completed"],
    supported_actions: ["notify_staff", "create_task", "create_internal_note"],
    recommended_templates: ["invoice_overdue_notice"],
    analytics_groups: ["accounting", "sales"],
  },
  {
    application_id:   "warehouse",
    supported_triggers: ["manual_trigger"],
    supported_actions: ["notify_staff", "create_task"],
    recommended_templates: [],
    analytics_groups: [],
  },
];

// ─── Communication Center compatibility ────────────────────────────────────────

/**
 * Maps automation action IDs to the Communication Center channels they use.
 * Used by the automation engine to verify channel readiness before execution.
 */
export const ACTION_CHANNEL_MAP: Partial<Record<AutomationActionId, CommunicationChannelId>> = {
  send_line_message:      "line",
  send_whatsapp_message:  "whatsapp",
  send_email:             "email",
  send_sms:               "sms",
  request_review:         "line",   // Default — runtime may use preferred channel
};

// ─── AI Gateway compatibility ──────────────────────────────────────────────────

/**
 * Maps automation action IDs to the AI entitlements they require.
 * The automation engine checks planHasAIEntitlement() before executing these actions.
 */
export const ACTION_AI_ENTITLEMENT_MAP: Partial<Record<AutomationActionId, AIEntitlementId>> = {
  generate_ai_caption: "communication_ai",
  generate_ai_video:   "video_ai",
  generate_ai_reply:   "communication_ai",
  generate_ai_summary: "growth_ai",
};

// ─── Subscription Center compatibility ────────────────────────────────────────

/**
 * Minimum AI entitlement for each AI-powered workflow category.
 * Advisory in Sprint 12C — enforced by AI Gateway in Sprint 13.
 */
export const WORKFLOW_CATEGORY_ENTITLEMENT: Record<string, AIEntitlementId | null> = {
  retention:        null,
  acquisition:      null,
  review_management: null,
  communication:    null,
  revenue:          null,
  maintenance:      null,
  staff_ops:        null,
  ai_powered:       "growth_ai",
};

// ─── Analytics Center compatibility ───────────────────────────────────────────

/**
 * Analytics metric groups affected by automation workflows.
 * Used to populate analytics tracking when the execution engine runs.
 */
export const AUTOMATION_ANALYTICS_IMPACT: Partial<Record<AutomationWorkflowId, AnalyticsMetricGroupId[]>> = {
  maintenance_reminder:        ["maintenance", "communication"],
  review_campaign:             ["reviews", "communication"],
  revisit_campaign:            ["crm", "communication"],
  birthday_greeting:           ["crm", "communication"],
  new_customer_welcome:        ["crm", "communication"],
  vip_follow_up:               ["sales", "crm"],
  inactive_customer_recovery:  ["crm", "communication"],
  estimate_follow_up:          ["estimates", "communication"],
  invoice_overdue_notice:      ["accounting", "sales"],
  work_completed_follow_up:    ["dealer_operations", "communication"],
  reservation_confirmation:    ["dealer_operations", "communication"],
  reservation_reminder:        ["dealer_operations", "communication"],
  ai_insight_action:           ["ai_usage", "dealer_operations"],
};

// ─── Module manifest ───────────────────────────────────────────────────────────

export const AUTOMATION_MODULE_MANIFEST = {
  module_id:    "automation_center",
  version:      "1.0.0",
  sprint:       "Sprint 12C",
  status:       "foundation" as const,
  dependencies: [
    "platform_core",
    "communication_center",
    "subscription_center",
    "analytics_center",
    "ai_insights",
    "customer_engagement",
  ],
  execution_deferred: true as const,
  target_execution_sprint: "Sprint 13",
} as const;

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getApplicationAutomationProfile(
  application_id: PlatformApplicationId,
): ApplicationAutomationProfile | undefined {
  return APPLICATION_AUTOMATION_MAP.find(p => p.application_id === application_id);
}

export function getChannelForAction(
  action_id: AutomationActionId,
): CommunicationChannelId | null {
  return ACTION_CHANNEL_MAP[action_id] ?? null;
}

export function getEntitlementForAction(
  action_id: AutomationActionId,
): AIEntitlementId | null {
  return ACTION_AI_ENTITLEMENT_MAP[action_id] ?? null;
}
