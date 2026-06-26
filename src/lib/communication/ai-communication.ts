// GYEON Business Hub — Communication Center: AI Communication Foundation (Sprint 11X Phase E)
//
// AI-assisted communication capability declarations.
//
// The AI Communication module defines the future set of AI-powered messaging features
// available through the Communication Center. These capabilities use the shared
// AI Gateway (src/lib/ai/) and require customer AI consent (CustomerCommunicationPreferences).
//
// Architecture only — no AI provider SDK imports. No runtime execution.
// All AI execution routes through the AI Gateway module.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AICommunicationCapability,
  AICommunicationFeatureId,
  CommunicationChannelId,
} from "./communication-types";

// ─── AI communication capabilities ───────────────────────────────────────────

function aiCap(
  feature_id:                 AICommunicationFeatureId,
  display_name:               string,
  description:                string,
  supported_channels:         CommunicationChannelId[],
  requires_customer_ai_consent: boolean,
  requires_staff_review:      boolean,
  status:                     AICommunicationCapability["status"],
  target_sprint:              string | null,
): AICommunicationCapability {
  return {
    feature_id,
    display_name,
    description,
    supported_channels,
    requires_ai_gateway:          true,
    requires_customer_ai_consent,
    requires_staff_review,
    status,
    target_sprint,
  };
}

export const AI_COMMUNICATION_CAPABILITIES: AICommunicationCapability[] = [
  aiCap(
    "ai_reply_generation",
    "AI Reply Generation",
    "Generate contextual reply suggestions based on conversation history and customer record. " +
    "Staff reviews and approves the AI-drafted reply before sending.",
    ["line", "whatsapp", "instagram", "facebook_messenger", "x", "email"],
    true,
    true,    // Staff must review before send
    "planned",
    "Sprint 12+",
  ),
  aiCap(
    "ai_translation",
    "AI Message Translation",
    "Real-time translation of inbound messages from any language to Japanese (or configured language). " +
    "Outbound message translation available for international B2B communication.",
    ["line", "whatsapp", "instagram", "facebook_messenger", "x", "email", "sms"],
    false,   // Translation does not require customer AI consent (internal use)
    false,
    "planned",
    "Sprint 12+",
  ),
  aiCap(
    "ai_tone_adjustment",
    "AI Tone Adjustment",
    "Adjust the tone of a draft message between formal, friendly, and professional " +
    "without changing the factual content. Staff writes the core message; AI refines the tone.",
    ["line", "whatsapp", "email"],
    false,   // Internal tone adjustment; does not require customer AI consent
    true,    // Staff sees the adjusted version before sending
    "planned",
    "Sprint 12+",
  ),
  aiCap(
    "ai_follow_up",
    "AI Follow-up Sequence",
    "Generate a multi-step follow-up message sequence for inactive customers or " +
    "pending estimates. Sequences are reviewed and scheduled by staff.",
    ["line", "email", "sms"],
    true,
    true,
    "planned",
    "Sprint 13+",
  ),
  aiCap(
    "ai_maintenance_reminder",
    "AI Maintenance Reminder",
    "Generate personalised maintenance reminder messages incorporating the customer's " +
    "vehicle, last service date, and coating type. Uses AI to vary phrasing and avoid " +
    "repetitive templates.",
    ["line", "email", "sms"],
    true,
    false,   // Can be sent automatically once customer AI consent is on record
    "planned",
    "Sprint 12+",
  ),
  aiCap(
    "ai_review_request",
    "AI Review Request",
    "Generate compliant, personalised review request messages after job completion. " +
    "Adheres to Google review policy guidelines: no incentive language, no targeting " +
    "only satisfied customers. Requires review_request_consent and ai_communication_permission.",
    ["line", "email", "sms"],
    true,
    false,   // Can be sent automatically once both consent flags are confirmed
    "planned",
    "Sprint 12+",
  ),
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export function getAICommunicationCapability(
  feature_id: AICommunicationFeatureId,
): AICommunicationCapability | undefined {
  return AI_COMMUNICATION_CAPABILITIES.find((c) => c.feature_id === feature_id);
}

export function getAICapabilitiesForChannel(
  channel_id: CommunicationChannelId,
): AICommunicationCapability[] {
  return AI_COMMUNICATION_CAPABILITIES.filter((c) =>
    c.supported_channels.includes(channel_id),
  );
}

export function getAICapabilitiesRequiringConsent(): AICommunicationCapability[] {
  return AI_COMMUNICATION_CAPABILITIES.filter(
    (c) => c.requires_customer_ai_consent,
  );
}

export function getAICapabilitiesRequiringStaffReview(): AICommunicationCapability[] {
  return AI_COMMUNICATION_CAPABILITIES.filter((c) => c.requires_staff_review);
}

export function getAutomatedAICapabilities(): AICommunicationCapability[] {
  return AI_COMMUNICATION_CAPABILITIES.filter((c) => !c.requires_staff_review);
}
