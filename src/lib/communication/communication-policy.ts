// GYEON Business Hub — Communication Center: Communication Policy (Sprint 11X Phase A)
//
// Governance rules for all communication through the GYEON Business Hub Communication Center.
//
// Rules cover:
//   - Customer consent requirements
//   - AI-generated message controls
//   - Credential security
//   - Tenant data isolation
//   - Regulatory compliance (CAN-SPAM, 特定電子メール法, LINE policies)
//
// Strict rules (COMM-001 through COMM-007): must never be violated
// Advisory rules (COMM-008 through COMM-010): best-practice guidelines
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CommunicationChannelId,
  CommunicationPolicy,
  CommPolicyEnforcement,
} from "./communication-types";

// ─── Policy declarations ──────────────────────────────────────────────────────

const COMM_POLICIES: CommunicationPolicy[] = [
  {
    policy_id:   "COMM-001",
    title:       "Customer Opt-In Required Before Outbound Messaging",
    description: "No outbound message may be sent to a customer on any channel unless the customer has explicitly opted in to that channel (enabled_channels includes the target channel). The opt-in must be recorded with a consent timestamp.",
    enforcement: "strict",
    rationale:   "Unsolicited messaging violates consumer privacy laws in Japan and globally, and risks account suspension by messaging providers (LINE Business Account, WhatsApp Business API, etc.). Confirmed opt-in protects both the business and the platform.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-002",
    title:       "Marketing Messages Require Explicit Marketing Consent",
    description: "Promotional messages, discount offers, campaign announcements, and any content primarily intended to drive sales must check marketing_consent = true before sending. Transactional messages (job updates, booking confirmations) are exempt.",
    enforcement: "strict",
    rationale:   "Japanese law (特定電子メール法) and LINE messaging policies require separate, explicit consent for commercial messages. Conflating transactional and marketing consent is a regulatory risk and a trust violation.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-003",
    title:       "AI-Generated Customer Messages Require ai_communication_permission",
    description: "Any message where the content is generated or substantially modified by AI must check ai_communication_permission = true on the customer's CommunicationPreferences before generation or delivery. Human-authored messages are not subject to this check.",
    enforcement: "strict",
    rationale:   "Customers have a right to know if they are receiving AI-generated communications. The permission flag gives customers control and protects the platform from disclosure-related complaints.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-004",
    title:       "Channel Credentials Stored Server-Side Only",
    description: "All channel credentials (LINE channel_secret, LINE access_token, WhatsApp API key, SMTP password, SMS aggregator key) must be stored and accessed exclusively server-side. They must never be returned to the browser, included in API responses, or logged.",
    enforcement: "strict",
    rationale:   "Communication channel credentials grant the ability to send messages as the business. A leaked LINE access_token would allow an attacker to send messages on behalf of any dealer whose token was exposed. Server-side storage is a non-negotiable security requirement.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-005",
    title:       "Communication Data Isolated Per Tenant",
    description: "Message logs, customer preferences, conversation threads, and channel configuration must be scoped to the tenant (dealer_id for Dealer Agent; company_id for GYEON Distribution). Cross-tenant access to communication data is prohibited.",
    enforcement: "strict",
    rationale:   "Message content is sensitive personal data. A dealer must never be able to read the messages of another dealer's customers. This applies even when multiple tenants share the same Supabase instance.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-006",
    title:       "Opt-Out Requests Processed Immediately",
    description: "When a customer opts out of a communication channel (via STOP keyword, unsubscribe link, or in-app preference change), the channel must be removed from enabled_channels and no further messages sent on that channel within the same processing cycle. Delayed opt-out processing is prohibited.",
    enforcement: "strict",
    rationale:   "Immediate opt-out is required by Japanese commercial email law and by the messaging provider policies of LINE, WhatsApp, and others. Delayed opt-out processing exposes the platform to regulatory fines and provider account suspension.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-007",
    title:       "Review Request Messages Must Not Incentivise or Selectively Target",
    description: "AI-generated or template review request messages must not: offer rewards in exchange for reviews, direct customers to leave positive reviews only, or selectively send requests only to customers assumed to be satisfied. All post-completion review requests must follow the same process regardless of inferred customer sentiment.",
    enforcement: "strict",
    rationale:   "Google's review policies and consumer protection laws prohibit incentivised and selective review solicitation. Violations risk Google Business Profile suspension. The ai_review_request AI capability is designed to comply with these rules by design.",
    applies_to:  ["line", "email", "sms"],
  },
  {
    policy_id:   "COMM-008",
    title:       "Prefer Customer's Preferred Channel",
    description: "When sending a message where multiple channels are available, resolve the customer's preferred_channel first. Fall back to the first enabled channel only if the preferred channel is unavailable for the message type.",
    enforcement: "advisory",
    rationale:   "Customers who have expressed a channel preference expect to receive communications there. Ignoring the preference increases unsubscribe rates and reduces message effectiveness.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-009",
    title:       "AI-Generated Messages Should Be Reviewed Before Automated Send",
    description: "For AI capabilities that support staff review (ai_reply_generation, ai_tone_adjustment, ai_follow_up), prefer a review step before automated delivery unless the use case explicitly requires immediate send and the capability is marked requires_staff_review = false.",
    enforcement: "advisory",
    rationale:   "AI-generated messages can occasionally produce inappropriate or inaccurate content. A human review step for high-stakes message types (customer-facing replies, follow-up sequences) significantly reduces customer-facing quality incidents.",
    applies_to:  "all",
  },
  {
    policy_id:   "COMM-010",
    title:       "Character Encoding and Length Validated Before SMS Send",
    description: "Before dispatching an SMS message, the application should validate character encoding (Shift-JIS compatibility for Japanese domestic SMS) and segment count (160 chars per segment for ASCII, 70 chars for multi-byte). Long messages should be split or truncated with user awareness.",
    enforcement: "advisory",
    rationale:   "Unvalidated SMS content can result in garbled characters in Japanese delivery, unexpected multi-segment billing, or carrier rejection. Pre-flight validation prevents silent delivery failures.",
    applies_to:  ["sms"],
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const COMMUNICATION_POLICIES: CommunicationPolicy[] = COMM_POLICIES;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCommPolicy(
  policy_id: string,
): CommunicationPolicy | undefined {
  return COMMUNICATION_POLICIES.find((p) => p.policy_id === policy_id);
}

export function getStrictCommPolicies(): CommunicationPolicy[] {
  return COMMUNICATION_POLICIES.filter((p) => p.enforcement === "strict");
}

export function getAdvisoryCommPolicies(): CommunicationPolicy[] {
  return COMMUNICATION_POLICIES.filter((p) => p.enforcement === "advisory");
}

export function getPoliciesForChannel(
  channel_id: CommunicationChannelId,
): CommunicationPolicy[] {
  return COMMUNICATION_POLICIES.filter(
    (p) =>
      p.applies_to === "all" ||
      (Array.isArray(p.applies_to) && p.applies_to.includes(channel_id)),
  );
}

export function getPoliciesApplyingToAllChannels(): CommunicationPolicy[] {
  return COMMUNICATION_POLICIES.filter((p) => p.applies_to === "all");
}
