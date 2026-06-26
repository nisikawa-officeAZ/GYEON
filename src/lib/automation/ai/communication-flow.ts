// GYEON Business Hub — Automation AI Gateway Bridge: Communication Flow (Sprint 12D)
//
// Phase G — Defines the typed model for the Automation → AI → Communication Center pipeline.
//
// Full pipeline (Sprint 13):
//   Automation Trigger
//       ↓
//   AI Draft (via AI Gateway Bridge)
//       ↓
//   Dealer Approval Gate (requires_dealer_approval policy)
//       ↓
//   Communication Center (channel adapter routing)
//       ↓
//   LINE / WhatsApp / Email / Instagram / X
//
// Sprint 12D: Pipeline is declared but no step executes.
// All AutomationCommunicationFlow objects have execution_deferred: true.
//
// Compatible channels per flow type:
//   message_draft  → LINE, WhatsApp, Email, SMS
//   review_request → LINE, Email
//   marketing_post → SNS platforms (dealer posts manually — no auto-publish)
//   internal       → No channel dispatch
//
// Pure — no "use server", no async, no DB calls, no external calls, no message sending.

import type { AutomationAIActionTypeId }  from "./ai-action-types";
import type { AutomationWorkflowId, AutomationTriggerId } from "../automation-types";
import type { CommunicationChannelId }    from "@/lib/communication/communication-types";

// ─── Flow step types ──────────────────────────────────────────────────────────

export type CommunicationFlowStepType =
  | "automation_trigger"   // 1. Automation engine fires trigger
  | "ai_draft"             // 2. AI Gateway Bridge generates content
  | "dealer_approval"      // 3. Dealer reviews and approves draft
  | "channel_dispatch"     // 4. Communication Center sends to channel
  | "channel_confirm"      // 5. Channel confirms delivery
  | "no_dispatch";         // For internal/analysis flows — pipeline ends before dispatch

export interface CommunicationFlowStep {
  step_type:         CommunicationFlowStepType;
  label:             string;
  description:       string;
  is_blocking:       boolean;   // True if next step cannot start until this completes
  requires_human:    boolean;   // True if a human action is needed at this step
  execution_deferred: true;
}

// ─── Flow types ───────────────────────────────────────────────────────────────

export type AutomationCommunicationFlowType =
  | "message_draft"    // AI drafts a customer message — dealer approves — channel sends
  | "review_request"   // AI drafts review request — dealer approves — channel sends
  | "marketing_post"   // AI generates SNS content — dealer posts manually
  | "internal_only";   // AI analysis/summary — no channel dispatch

// ─── Flow definition ──────────────────────────────────────────────────────────

export interface AutomationCommunicationFlow {
  flow_type:            AutomationCommunicationFlowType;
  display_name:         string;
  description:          string;
  ai_action_types:      AutomationAIActionTypeId[];
  compatible_workflows: AutomationWorkflowId[];
  compatible_triggers:  AutomationTriggerId[];
  compatible_channels:  CommunicationChannelId[];
  steps:                CommunicationFlowStep[];
  requires_consent:     boolean;   // Customer ai_communication_permission
  requires_approval:    boolean;   // Dealer must approve before dispatch
  auto_dispatch:        false;     // Never auto-dispatches in Sprint 12D
  execution_deferred:   true;
  target_sprint:        string;
}

// ─── Flow registry ──────────────────────────────────────────────────────────────

export const COMMUNICATION_FLOW_TEMPLATES: AutomationCommunicationFlow[] = [

  {
    flow_type:    "message_draft",
    display_name: "AI Message Draft → Channel",
    description:
      "The most common flow: an automation trigger fires, the AI Gateway Bridge " +
      "generates a draft message for dealer review, and after approval the " +
      "Communication Center dispatches to the customer's preferred channel.",
    ai_action_types:      ["generate_ai_caption", "generate_ai_reply", "generate_maintenance_message"],
    compatible_workflows: [
      "maintenance_reminder", "revisit_campaign", "inactive_customer_recovery",
      "new_customer_welcome", "work_completed_follow_up", "estimate_follow_up",
    ],
    compatible_triggers:  [
      "maintenance_due", "customer_inactive", "customer_created",
      "work_completed", "estimate_created",
    ],
    compatible_channels:  ["line", "whatsapp", "email", "sms"],
    steps: [
      {
        step_type:         "automation_trigger",
        label:             "Trigger",
        description:       "Automation engine fires a trigger event.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "ai_draft",
        label:             "AI Draft",
        description:       "AI Gateway Bridge generates message content (no execution in Sprint 12D).",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "dealer_approval",
        label:             "Dealer Approval",
        description:       "Dealer reviews the draft and approves or rejects before dispatch.",
        is_blocking:       true,
        requires_human:    true,
        execution_deferred: true,
      },
      {
        step_type:         "channel_dispatch",
        label:             "Communication Center",
        description:       "Communication Center routes the approved message to the correct channel.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "channel_confirm",
        label:             "Channel Confirmation",
        description:       "Channel confirms delivery (LINE read receipt, email open, etc.).",
        is_blocking:       false,
        requires_human:    false,
        execution_deferred: true,
      },
    ],
    requires_consent:   true,
    requires_approval:  true,
    auto_dispatch:      false,
    execution_deferred: true,
    target_sprint:      "Sprint 13",
  },

  {
    flow_type:    "review_request",
    display_name: "AI Review Request → Channel",
    description:
      "Specialized flow for review requests. Requires review platform policy compliance " +
      "check before AI draft is generated. AUT-007 (one per work order) enforced at " +
      "the trigger step. Dealer approves before the request is sent.",
    ai_action_types:      ["generate_review_request"],
    compatible_workflows: ["review_campaign"],
    compatible_triggers:  ["work_completed", "review_missing"],
    compatible_channels:  ["line", "email"],
    steps: [
      {
        step_type:         "automation_trigger",
        label:             "Trigger",
        description:       "work_completed or review_missing triggers the flow. " +
                           "AUT-007 check: no review request yet for this work_order_id.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "ai_draft",
        label:             "AI Review Request Draft",
        description:       "review_agent generates a compliant review request message.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "dealer_approval",
        label:             "Dealer Approval",
        description:       "Dealer confirms the draft is appropriate before sending.",
        is_blocking:       true,
        requires_human:    true,
        execution_deferred: true,
      },
      {
        step_type:         "channel_dispatch",
        label:             "Communication Center",
        description:       "Communication Center sends the request via LINE or Email.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "channel_confirm",
        label:             "Channel Confirmation",
        description:       "Channel confirms delivery.",
        is_blocking:       false,
        requires_human:    false,
        execution_deferred: true,
      },
    ],
    requires_consent:   false,  // Review request consent separate from AI comm consent
    requires_approval:  true,
    auto_dispatch:      false,
    execution_deferred: true,
    target_sprint:      "Sprint 13",
  },

  {
    flow_type:    "marketing_post",
    display_name: "AI SNS Post → Dealer Manual Publish",
    description:
      "Generates SNS content for dealer review. The dealer copies and posts manually " +
      "to the relevant platform. The platform never auto-publishes to SNS. " +
      "This flow has no channel_dispatch step.",
    ai_action_types:      ["generate_sns_post", "generate_video_storyboard"],
    compatible_workflows: [],  // No specific workflow yet — manual trigger only
    compatible_triggers:  ["manual_trigger", "work_completed"],
    compatible_channels:  [],  // No channel dispatch — dealer posts manually
    steps: [
      {
        step_type:         "automation_trigger",
        label:             "Trigger",
        description:       "Manual trigger or work_completed fires the flow.",
        is_blocking:       true,
        requires_human:    true,   // Manual trigger requires dealer action
        execution_deferred: true,
      },
      {
        step_type:         "ai_draft",
        label:             "AI SNS Content Generation",
        description:       "marketing_agent generates caption, hashtags, and metadata.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "dealer_approval",
        label:             "Dealer Review and Publish",
        description:       "Dealer reviews the content and posts manually to the platform.",
        is_blocking:       true,
        requires_human:    true,
        execution_deferred: true,
      },
      {
        step_type:         "no_dispatch",
        label:             "No Auto-Dispatch",
        description:       "Platform does not auto-publish to SNS. Dealer posts manually.",
        is_blocking:       false,
        requires_human:    false,
        execution_deferred: true,
      },
    ],
    requires_consent:   false,
    requires_approval:  true,
    auto_dispatch:      false,
    execution_deferred: true,
    target_sprint:      "Sprint 13",
  },

  {
    flow_type:    "internal_only",
    display_name: "AI Analysis → Internal Insight",
    description:
      "Internal AI analysis flow. Output is consumed by the dashboard, insight panel, " +
      "or a downstream automation step. No message is sent to customers.",
    ai_action_types: [
      "generate_ai_summary", "analyze_customer_inactivity",
      "analyze_review_sentiment", "analyze_growth_opportunity",
    ],
    compatible_workflows: ["ai_insight_action"],
    compatible_triggers:  ["ai_insight_generated", "manual_trigger"],
    compatible_channels:  [],  // No channel dispatch
    steps: [
      {
        step_type:         "automation_trigger",
        label:             "Trigger",
        description:       "Trigger fires (ai_insight_generated or scheduled analysis).",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "ai_draft",
        label:             "AI Analysis",
        description:       "growth_agent or reputation_agent produces analysis output.",
        is_blocking:       true,
        requires_human:    false,
        execution_deferred: true,
      },
      {
        step_type:         "no_dispatch",
        label:             "Internal Routing",
        description:       "Output is routed to the AI Insights Panel or triggering system.",
        is_blocking:       false,
        requires_human:    false,
        execution_deferred: true,
      },
    ],
    requires_consent:   false,
    requires_approval:  false,
    auto_dispatch:      false,
    execution_deferred: true,
    target_sprint:      "Sprint 13",
  },

] satisfies AutomationCommunicationFlow[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getFlowForActionType(
  action_type_id: AutomationAIActionTypeId,
): AutomationCommunicationFlow | undefined {
  return COMMUNICATION_FLOW_TEMPLATES.find(
    f => f.ai_action_types.includes(action_type_id),
  );
}

export function getFlowsByChannel(
  channel_id: CommunicationChannelId,
): AutomationCommunicationFlow[] {
  return COMMUNICATION_FLOW_TEMPLATES.filter(
    f => f.compatible_channels.includes(channel_id),
  );
}

export function getFlowsRequiringApproval(): AutomationCommunicationFlow[] {
  return COMMUNICATION_FLOW_TEMPLATES.filter(f => f.requires_approval);
}

export function getFlowsRequiringConsent(): AutomationCommunicationFlow[] {
  return COMMUNICATION_FLOW_TEMPLATES.filter(f => f.requires_consent);
}
