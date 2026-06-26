// GYEON Business Hub — Communication Center: Channel Registry (Sprint 11X Phase B)
//
// Canonical registry of all supported communication channels.
//
// Channels (7):
//   Active (1):   line (Rich Menu active; Messaging planned)
//   Planned (6):  whatsapp, instagram, facebook_messenger, x, email, sms
//
// No provider SDKs imported. Metadata declarations only.
// Applications consume channel definitions through Platform Core only.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CommunicationChannel,
  CommunicationChannelId,
} from "./communication-types";

// ─── 1. LINE ─────────────────────────────────────────────────────────────────

const LINE_CHANNEL: CommunicationChannel = {
  channel_id:                "line",
  display_name:              "LINE",
  type:                      "messaging",
  direction:                 "bidirectional",
  status:                    "active",
  requires_business_account: true,
  requires_user_opt_in:      true,
  supports_media:            true,
  supports_templates:        true,
  supports_automation:       true,
  supports_ai_replies:       true,
  supports_rich_content:     true,
  available_in:              ["dealer_agent", "enterprise_distribution"],
  region_availability:       ["JP", "TH", "TW", "ID", "VN"],
  estimated_japan_reach:     "95M active users (2025)",
  business_api_required:     true,
  spec_document:             "07_LINE_REQUIREMENTS.md",
  implementation_sprint:     "Phase B (Rich Menu active; Messaging API planned)",
};

// ─── 2. WhatsApp ─────────────────────────────────────────────────────────────

const WHATSAPP_CHANNEL: CommunicationChannel = {
  channel_id:                "whatsapp",
  display_name:              "WhatsApp",
  type:                      "messaging",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: true,
  requires_user_opt_in:      true,
  supports_media:            true,
  supports_templates:        true,
  supports_automation:       true,
  supports_ai_replies:       true,
  supports_rich_content:     true,
  available_in:              ["enterprise_distribution", "crm"],
  region_availability:       ["global"],
  estimated_japan_reach:     "~10M active users (2025, lower penetration vs LINE)",
  business_api_required:     true,
  spec_document:             null,
  implementation_sprint:     null,
};

// ─── 3. Instagram ─────────────────────────────────────────────────────────────

const INSTAGRAM_CHANNEL: CommunicationChannel = {
  channel_id:                "instagram",
  display_name:              "Instagram",
  type:                      "social",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: true,
  requires_user_opt_in:      true,
  supports_media:            true,
  supports_templates:        false,
  supports_automation:       true,
  supports_ai_replies:       true,
  supports_rich_content:     true,
  available_in:              ["dealer_agent", "crm"],
  region_availability:       ["global"],
  estimated_japan_reach:     "33M active users (2025)",
  business_api_required:     true,
  spec_document:             null,
  implementation_sprint:     null,
};

// ─── 4. Facebook Messenger ────────────────────────────────────────────────────

const FACEBOOK_MESSENGER_CHANNEL: CommunicationChannel = {
  channel_id:                "facebook_messenger",
  display_name:              "Facebook Messenger",
  type:                      "social",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: true,
  requires_user_opt_in:      true,
  supports_media:            true,
  supports_templates:        true,
  supports_automation:       true,
  supports_ai_replies:       true,
  supports_rich_content:     true,
  available_in:              ["dealer_agent", "crm"],
  region_availability:       ["global"],
  estimated_japan_reach:     "13M active users (2025)",
  business_api_required:     true,
  spec_document:             null,
  implementation_sprint:     null,
};

// ─── 5. X (formerly Twitter) ─────────────────────────────────────────────────

const X_CHANNEL: CommunicationChannel = {
  channel_id:                "x",
  display_name:              "X",
  type:                      "social",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: true,
  requires_user_opt_in:      false,
  supports_media:            true,
  supports_templates:        false,
  supports_automation:       false,
  supports_ai_replies:       true,
  supports_rich_content:     false,
  available_in:              ["dealer_agent"],
  region_availability:       ["global"],
  estimated_japan_reach:     "67M active users (2025, high penetration in Japan)",
  business_api_required:     true,
  spec_document:             null,
  implementation_sprint:     null,
};

// ─── 6. Email ─────────────────────────────────────────────────────────────────

const EMAIL_CHANNEL: CommunicationChannel = {
  channel_id:                "email",
  display_name:              "Email",
  type:                      "direct",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: false,
  requires_user_opt_in:      true,
  supports_media:            true,
  supports_templates:        true,
  supports_automation:       true,
  supports_ai_replies:       true,
  supports_rich_content:     true,
  available_in:              ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  region_availability:       ["global"],
  estimated_japan_reach:     "Universal",
  business_api_required:     false,
  spec_document:             null,
  implementation_sprint:     "Sprint 12+",
};

// ─── 7. SMS ───────────────────────────────────────────────────────────────────

const SMS_CHANNEL: CommunicationChannel = {
  channel_id:                "sms",
  display_name:              "SMS",
  type:                      "direct",
  direction:                 "bidirectional",
  status:                    "planned",
  requires_business_account: false,
  requires_user_opt_in:      true,
  supports_media:            false,
  supports_templates:        true,
  supports_automation:       true,
  supports_ai_replies:       false,
  supports_rich_content:     false,
  available_in:              ["dealer_agent", "enterprise_distribution"],
  region_availability:       ["JP", "global"],
  estimated_japan_reach:     "Universal (carrier-based)",
  business_api_required:     false,
  spec_document:             null,
  implementation_sprint:     null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const COMMUNICATION_CHANNEL_REGISTRY: CommunicationChannel[] = [
  LINE_CHANNEL,
  WHATSAPP_CHANNEL,
  INSTAGRAM_CHANNEL,
  FACEBOOK_MESSENGER_CHANNEL,
  X_CHANNEL,
  EMAIL_CHANNEL,
  SMS_CHANNEL,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getChannel(
  channel_id: CommunicationChannelId,
): CommunicationChannel | undefined {
  return COMMUNICATION_CHANNEL_REGISTRY.find(
    (c) => c.channel_id === channel_id,
  );
}

export function getActiveChannels(): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter((c) => c.status === "active");
}

export function getPlannedChannels(): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter((c) => c.status === "planned");
}

export function getChannelsForApplication(
  application_id: string,
): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter((c) =>
    c.available_in.includes(application_id),
  );
}

export function getBidirectionalChannels(): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter(
    (c) => c.direction === "bidirectional",
  );
}

export function getChannelsSupportingAutomation(): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter((c) => c.supports_automation);
}

export function getChannelsSupportingAI(): CommunicationChannel[] {
  return COMMUNICATION_CHANNEL_REGISTRY.filter((c) => c.supports_ai_replies);
}
