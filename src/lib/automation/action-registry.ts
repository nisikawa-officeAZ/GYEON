// GYEON Business Hub — Automation Center: Action Registry (Sprint 12C)
//
// Static registry of all automation action types with metadata.
//
// Action routing model:
//   - Communication actions route to Communication Center channel adapters.
//     The automation engine never calls LINE / WhatsApp / Email SDKs directly.
//   - Staff actions route to the internal notification and task system.
//   - CRM actions route to the Dealer Agent CRM module.
//   - AI actions route through the AI Gateway — gated by AIEntitlementId.
//     All AI actions require checkAiGatewayReady() before execution.
//
// No action executes in Sprint 12C. All actions are metadata declarations.
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { AutomationActionId, AIEntitlementId, CommunicationChannelId, PlatformApplicationId } from "./automation-types";

// ─── Action category ───────────────────────────────────────────────────────────

export type AutomationActionCategory =
  | "communication"     // Sends a message to a customer via a channel
  | "staff_ops"         // Creates internal tasks, reminders, or notifications
  | "crm"              // Updates CRM data (tags, notes, scheduling)
  | "ai_content"        // Generates AI content (requires AI Gateway)
  | "scheduling"        // Creates or suggests reservations;

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface AutomationActionMeta {
  action_id:            AutomationActionId;
  display_name:         string;
  description:          string;
  category:             AutomationActionCategory;
  /** Communication channel this action routes to. null for non-communication actions. */
  channel_id:           CommunicationChannelId | null;
  /** Application that must be enabled for this action to execute. */
  required_application: PlatformApplicationId | null;
  /** AI entitlement required (AI actions only). null for non-AI actions. */
  required_ai_entitlement: AIEntitlementId | null;
  /** Whether the action requires explicit staff approval before sending. */
  requires_approval:    boolean;
  /** Whether the action can be used with customers who have not consented to AI communication. */
  requires_ai_consent:  boolean;
  available:            boolean;
  available_since:      string;
  /** Can this action run in parallel with other actions in the same step? */
  supports_parallel:    boolean;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const AUTOMATION_ACTION_REGISTRY: AutomationActionMeta[] = [
  // ── Communication actions ────────────────────────────────────────────────
  {
    action_id:               "send_line_message",
    display_name:            "Send LINE Message",
    description:             "Sends a templated or AI-generated message to the customer via LINE. " +
                             "Requires LINE channel connection and customer LINE link. " +
                             "Routes to src/lib/communication/ LINE adapter.",
    category:                "communication",
    channel_id:              "line",
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               true,
    available_since:         "Sprint 11G",
    supports_parallel:       false,
  },
  {
    action_id:               "send_whatsapp_message",
    display_name:            "Send WhatsApp Message",
    description:             "Sends a message to the customer via WhatsApp Business API. " +
                             "Channel: Communication Center WhatsApp adapter (Sprint 13+).",
    category:                "communication",
    channel_id:              "whatsapp",
    required_application:    null,
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "send_email",
    display_name:            "Send Email",
    description:             "Sends an email to the customer. " +
                             "Channel: Communication Center Email adapter (Sprint 13+).",
    category:                "communication",
    channel_id:              "email",
    required_application:    null,
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "send_sms",
    display_name:            "Send SMS",
    description:             "Sends an SMS to the customer. " +
                             "Channel: Communication Center SMS adapter (Sprint 13+).",
    category:                "communication",
    channel_id:              "sms",
    required_application:    null,
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "send_to_channel",
    display_name:            "Send to Preferred Channel",
    description:             "Routes the message to the customer's preferred communication channel. " +
                             "Determined by CustomerCommunicationPreferences in Communication Center. " +
                             "Falls back to LINE if no preference is set.",
    category:                "communication",
    channel_id:              null,   // Dynamic — determined at runtime
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "request_review",
    display_name:            "Request Customer Review",
    description:             "Sends a review request to the customer via their preferred channel. " +
                             "Respects comm-policy COMM-006 (one review request per work order). " +
                             "Requires customer consent for AI-assisted content.",
    category:                "communication",
    channel_id:              null,   // Dynamic
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               true,
    available_since:         "Sprint 11G",
    supports_parallel:       false,
  },

  // ── Staff actions ─────────────────────────────────────────────────────────
  {
    action_id:               "create_task",
    display_name:            "Create Staff Task",
    description:             "Creates an internal task for a staff member or team. " +
                             "Task appears in the staff task list with priority and due date.",
    category:                "staff_ops",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       true,
  },
  {
    action_id:               "create_reminder",
    display_name:            "Create Staff Reminder",
    description:             "Sets a timed reminder for a staff member. " +
                             "Appears in the notifications panel at the specified time.",
    category:                "staff_ops",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       true,
  },
  {
    action_id:               "notify_staff",
    display_name:            "Notify Staff",
    description:             "Sends an in-app push notification to specified staff roles or individuals. " +
                             "Used for critical alerts such as invoice overdue or VIP customer visits.",
    category:                "staff_ops",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       true,
  },
  {
    action_id:               "create_internal_note",
    display_name:            "Create Internal Note",
    description:             "Adds a timestamped note to the customer record. " +
                             "Visible to staff but never sent to the customer.",
    category:                "staff_ops",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       true,
  },

  // ── CRM actions ───────────────────────────────────────────────────────────
  {
    action_id:               "update_crm_tag",
    display_name:            "Update CRM Tag",
    description:             "Adds, removes, or updates a tag on the customer's CRM record. " +
                             "Tags are used for segmentation and future campaign targeting.",
    category:                "crm",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       false,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       true,
  },
  {
    action_id:               "schedule_reservation",
    display_name:            "Suggest Reservation",
    description:             "Creates a reservation suggestion for the customer based on available slots. " +
                             "Does not auto-confirm — dealer or customer must confirm.",
    category:                "scheduling",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: null,
    requires_approval:       true,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },

  // ── AI content actions ────────────────────────────────────────────────────
  {
    action_id:               "generate_ai_caption",
    display_name:            "Generate AI Caption",
    description:             "Requests the AI Gateway to generate an SNS caption or message body. " +
                             "Output is passed to the next send_* action. " +
                             "Requires communication_ai or marketing_ai entitlement.",
    category:                "ai_content",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: "communication_ai",
    requires_approval:       true,    // Staff must review before send
    requires_ai_consent:     true,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 12D+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "generate_ai_video",
    display_name:            "Generate AI Marketing Video",
    description:             "Requests the AI Gateway to generate a short marketing video from job photos. " +
                             "Requires video_ai entitlement and dealer-owned provider.",
    category:                "ai_content",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: "video_ai",
    requires_approval:       true,
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 13+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "generate_ai_reply",
    display_name:            "Generate AI Reply Draft",
    description:             "Requests the AI Gateway to draft a reply to an inbound customer message. " +
                             "Staff must review and approve before sending. " +
                             "Requires communication_ai entitlement and ai_communication_permission consent.",
    category:                "ai_content",
    channel_id:              null,
    required_application:    null,
    required_ai_entitlement: "communication_ai",
    requires_approval:       true,
    requires_ai_consent:     true,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 12D+ (wired)",
    supports_parallel:       false,
  },
  {
    action_id:               "generate_ai_summary",
    display_name:            "Generate AI Business Summary",
    description:             "Requests the AI Gateway to generate a narrative summary of business data. " +
                             "Output populates the ai_summary slot in the AI Insights Panel. " +
                             "Requires growth_ai entitlement and 30+ days of data.",
    category:                "ai_content",
    channel_id:              null,
    required_application:    "dealer_agent",
    required_ai_entitlement: "growth_ai",
    requires_approval:       false,   // Summary is informational, not sent to customers
    requires_ai_consent:     false,
    available:               false,
    available_since:         "Sprint 12C (declared) / Sprint 12D+ (wired)",
    supports_parallel:       false,
  },
] as const satisfies AutomationActionMeta[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getActionMeta(
  action_id: AutomationActionId,
): AutomationActionMeta | undefined {
  return AUTOMATION_ACTION_REGISTRY.find(a => a.action_id === action_id);
}

export function getAvailableActions(): AutomationActionMeta[] {
  return AUTOMATION_ACTION_REGISTRY.filter(a => a.available);
}

export function getActionsByCategory(
  category: AutomationActionCategory,
): AutomationActionMeta[] {
  return AUTOMATION_ACTION_REGISTRY.filter(a => a.category === category);
}

export function getAIActions(): AutomationActionMeta[] {
  return AUTOMATION_ACTION_REGISTRY.filter(a => a.required_ai_entitlement !== null);
}

export function getActionsForChannel(
  channel_id: CommunicationChannelId,
): AutomationActionMeta[] {
  return AUTOMATION_ACTION_REGISTRY.filter(a => a.channel_id === channel_id);
}

export function getActionIds(): AutomationActionId[] {
  return AUTOMATION_ACTION_REGISTRY.map(a => a.action_id);
}
