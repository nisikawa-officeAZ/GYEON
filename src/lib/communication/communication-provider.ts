// GYEON Business Hub — Communication Center: Provider Registry (Sprint 11X Phase B)
//
// Canonical metadata for communication channel providers.
// Each provider entry declares API characteristics, rate limits, and integration notes.
//
// No provider SDK imports. No API keys. No credentials.
// Metadata declarations only — consumed by architecture documentation and future
// provider selection logic.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CommunicationCapability,
  CommunicationCapabilityId,
  CommunicationChannelId,
  CommunicationProvider,
} from "./communication-types";

// ─── Provider entries ─────────────────────────────────────────────────────────

const LINE_MESSAGING_API: CommunicationProvider = {
  provider_id:    "line_messaging_api",
  display_name:   "LINE Messaging API",
  channel:        "line",
  vendor:         "LINE Corporation",
  status:         "active",
  api_version:    "v2",
  rate_limits: {
    messages_per_second: 1000,
    messages_per_day:    null,    // Depends on plan tier
  },
  webhook_supported: true,
  sandbox_available: false,
  implementation_notes:
    "Dealer Agent uses this provider for Rich Menu management and push notifications. " +
    "Each dealer configures their own LINE Business Account credentials (channel_id, " +
    "channel_secret, access_token). Credentials are dealer-scoped and stored server-side only. " +
    "Existing implementation: src/lib/line/.",
};

const WHATSAPP_BUSINESS_API: CommunicationProvider = {
  provider_id:    "whatsapp_cloud_api",
  display_name:   "WhatsApp Cloud API",
  channel:        "whatsapp",
  vendor:         "Meta Platforms",
  status:         "planned",
  api_version:    "v19.0",
  rate_limits: {
    messages_per_second: 80,
    messages_per_day:    1000,   // Varies by tier; 1000 is the free tier default
  },
  webhook_supported: true,
  sandbox_available: true,
  implementation_notes:
    "Template messages (HSM) require Meta pre-approval. Business verification required. " +
    "24-hour session window applies to conversational messages. " +
    "Intended for GYEON Distribution B2B partner communication.",
};

const INSTAGRAM_GRAPH_API: CommunicationProvider = {
  provider_id:    "instagram_graph_api",
  display_name:   "Instagram Graph API",
  channel:        "instagram",
  vendor:         "Meta Platforms",
  status:         "planned",
  api_version:    "v19.0",
  rate_limits: {
    messages_per_second: null,
    messages_per_day:    1000,
  },
  webhook_supported: true,
  sandbox_available: true,
  implementation_notes:
    "Requires Instagram Business or Creator account connected to a Facebook Page. " +
    "Inbound messages only available if user sends first (within 7 days) or via story mentions. " +
    "Intended for GYEON Dealer Agent marketing and GYEON CRM customer engagement.",
};

const META_MESSENGER_API: CommunicationProvider = {
  provider_id:    "meta_messenger_platform",
  display_name:   "Meta Messenger Platform",
  channel:        "facebook_messenger",
  vendor:         "Meta Platforms",
  status:         "planned",
  api_version:    "v19.0",
  rate_limits: {
    messages_per_second: null,
    messages_per_day:    null,
  },
  webhook_supported: true,
  sandbox_available: true,
  implementation_notes:
    "Requires Facebook Page. 24-hour standard messaging window + 1 follow-up message tag. " +
    "Templates approved as 'Message Tags' for specific use cases. " +
    "Lower penetration in Japan than LINE; valuable for international or B2B scenarios.",
};

const X_API_V2: CommunicationProvider = {
  provider_id:    "x_api_v2",
  display_name:   "X API v2",
  channel:        "x",
  vendor:         "X Corp",
  status:         "planned",
  api_version:    "v2",
  rate_limits: {
    messages_per_second: null,
    messages_per_day:    1000,   // Direct Message limit varies by access tier
  },
  webhook_supported: true,
  sandbox_available: false,
  implementation_notes:
    "X has high penetration in Japan (~67M users). Primarily for brand monitoring " +
    "and public engagement; DM functionality requires both parties to follow each other " +
    "or DMs open setting. API access requires paid tier for most production use cases.",
};

const EMAIL_SMTP: CommunicationProvider = {
  provider_id:    "transactional_smtp",
  display_name:   "Transactional Email (SMTP)",
  channel:        "email",
  vendor:         "TBD (SendGrid / Resend / Postmark)",
  status:         "planned",
  api_version:    null,
  rate_limits: {
    messages_per_second: null,
    messages_per_day:    null,   // Provider-dependent
  },
  webhook_supported: true,
  sandbox_available: true,
  implementation_notes:
    "Provider TBD at implementation time. Supabase Auth currently uses SMTP for invite emails. " +
    "Transactional email (completion reports, invoices, statements) and marketing email (reminders, " +
    "promotions) require separate sender configurations. Marketing requires CAN-SPAM and " +
    "Japanese specific commercial email laws (特定電子メール法) compliance.",
};

const SMS_AGGREGATOR: CommunicationProvider = {
  provider_id:    "sms_aggregator",
  display_name:   "SMS Aggregator",
  channel:        "sms",
  vendor:         "TBD (Twilio / Vonage / domestic JP carrier aggregator)",
  status:         "planned",
  api_version:    null,
  rate_limits: {
    messages_per_second: null,
    messages_per_day:    null,
  },
  webhook_supported: true,
  sandbox_available: true,
  implementation_notes:
    "Japanese domestic SMS requires compliance with carrier regulations. International SMS " +
    "available via global aggregators. SMS is a fallback channel when customers have not " +
    "connected LINE. Character limits and encoding (Shift-JIS vs UTF-8) must be handled. " +
    "Provider selection pending cost analysis.",
};

// ─── Provider registry ────────────────────────────────────────────────────────

export const COMMUNICATION_PROVIDER_REGISTRY: CommunicationProvider[] = [
  LINE_MESSAGING_API,
  WHATSAPP_BUSINESS_API,
  INSTAGRAM_GRAPH_API,
  META_MESSENGER_API,
  X_API_V2,
  EMAIL_SMTP,
  SMS_AGGREGATOR,
];

// ─── Capability declarations ──────────────────────────────────────────────────

function capability(
  id:                 CommunicationCapabilityId,
  display_name:       string,
  description:        string,
  supported_channels: CommunicationChannelId[],
  status:             CommunicationCapability["status"],
): CommunicationCapability {
  return { capability_id: id, display_name, description, supported_channels, status };
}

export const COMMUNICATION_CAPABILITIES: CommunicationCapability[] = [
  capability(
    "send_message",
    "Send Message",
    "Deliver a plain text message from the platform to a customer on their preferred channel",
    ["line", "whatsapp", "instagram", "facebook_messenger", "x", "email", "sms"],
    "active",
  ),
  capability(
    "receive_message",
    "Receive Message",
    "Receive inbound messages from customers via webhook and route to the platform",
    ["line", "whatsapp", "instagram", "facebook_messenger", "x", "email"],
    "planned",
  ),
  capability(
    "send_media",
    "Send Media",
    "Attach and deliver images, videos, or documents alongside messages",
    ["line", "whatsapp", "instagram", "facebook_messenger", "email"],
    "planned",
  ),
  capability(
    "receive_media",
    "Receive Media",
    "Receive inbound media files (images, documents) from customers",
    ["line", "whatsapp", "instagram", "facebook_messenger", "email"],
    "planned",
  ),
  capability(
    "send_template",
    "Send Template Message",
    "Send provider-approved structured templates (e.g., completion notice, invoice)",
    ["line", "whatsapp", "email", "sms"],
    "planned",
  ),
  capability(
    "automation",
    "Automation Workflow",
    "Trigger message sequences automatically based on business events",
    ["line", "whatsapp", "instagram", "facebook_messenger", "email", "sms"],
    "planned",
  ),
  capability(
    "read_receipts",
    "Read Receipts",
    "Delivery and read confirmation signals from the channel provider",
    ["line", "whatsapp", "instagram", "facebook_messenger"],
    "planned",
  ),
  capability(
    "typing_indicator",
    "Typing Indicator",
    "Show composing indicator while staff or AI is drafting a reply",
    ["line", "whatsapp", "instagram", "facebook_messenger"],
    "planned",
  ),
  capability(
    "rich_content",
    "Rich Content",
    "Interactive buttons, carousels, quick replies, and rich menu elements",
    ["line", "whatsapp", "facebook_messenger"],
    "active",
  ),
  capability(
    "thread_context",
    "Thread Context",
    "Reply within a specific conversation thread for contextual messaging",
    ["instagram", "facebook_messenger", "x", "email"],
    "planned",
  ),
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getProvider(provider_id: string): CommunicationProvider | undefined {
  return COMMUNICATION_PROVIDER_REGISTRY.find((p) => p.provider_id === provider_id);
}

export function getProvidersForChannel(
  channel_id: CommunicationChannelId,
): CommunicationProvider[] {
  return COMMUNICATION_PROVIDER_REGISTRY.filter((p) => p.channel === channel_id);
}

export function getCapability(
  capability_id: CommunicationCapabilityId,
): CommunicationCapability | undefined {
  return COMMUNICATION_CAPABILITIES.find((c) => c.capability_id === capability_id);
}

export function getCapabilitiesForChannel(
  channel_id: CommunicationChannelId,
): CommunicationCapability[] {
  return COMMUNICATION_CAPABILITIES.filter((c) =>
    c.supported_channels.includes(channel_id),
  );
}
