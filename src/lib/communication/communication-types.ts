// GYEON Business Hub — Communication Center: Domain Types (Sprint 11X Phase A)
//
// Canonical domain types for the GYEON Business Hub Communication Center.
//
// The Communication Center is a platform-level shared service that provides
// a unified communication abstraction across all GYEON Business Hub applications.
// It sits above application-specific integrations (e.g., src/lib/line/) and
// declares what communication is possible — not how it is executed.
//
// Registered channels (7):
//   line, whatsapp, instagram, facebook_messenger, x, email, sms
//
// Design principles:
//   - No provider SDKs imported
//   - No database persistence
//   - No runtime messaging
//   - Foundation and architecture declarations only
//   - Applications consume communication services through Platform Core only
//
// Pure — no "use server", no async, no DB calls, no external calls.

// ─── Channel identifiers ──────────────────────────────────────────────────────

export type CommunicationChannelId =
  | "line"                 // LINE Messaging API — primary channel in Japan
  | "whatsapp"             // WhatsApp Business API
  | "instagram"            // Instagram Messaging (Meta)
  | "facebook_messenger"   // Facebook Messenger (Meta)
  | "x"                    // X (formerly Twitter) Direct Messages
  | "email"                // Email (SMTP / transactional provider)
  | "sms";                 // SMS (carrier / aggregator)

// ─── Channel type ─────────────────────────────────────────────────────────────

export type CommunicationChannelType =
  | "messaging"  // Dedicated instant messaging platform (LINE, WhatsApp)
  | "social"     // Social media with messaging capability (X, Instagram)
  | "direct";    // Direct 1:1 communication without social layer (Email, SMS)

// ─── Message direction ────────────────────────────────────────────────────────

export type MessageDirection =
  | "outbound"       // Platform → Customer only
  | "inbound"        // Customer → Platform only
  | "bidirectional"; // Full two-way conversation

// ─── Provider and capability status ──────────────────────────────────────────

export type CommunicationProviderStatus =
  | "active"      // Integrated and live in at least one application
  | "planned"     // Integration planned; not yet implemented
  | "beta"        // Available but not production-recommended
  | "deprecated"; // Being phased out

// ─── Communication capability identifiers ────────────────────────────────────

export type CommunicationCapabilityId =
  | "send_message"       // Send plain text messages
  | "receive_message"    // Receive inbound messages via webhook
  | "send_media"         // Send images, videos, documents
  | "receive_media"      // Receive inbound media attachments
  | "send_template"      // Send provider-approved message templates
  | "automation"         // Trigger-based automated message workflows
  | "read_receipts"      // Delivery and read confirmation
  | "typing_indicator"   // Typing/composing indicator
  | "rich_content"       // Buttons, carousels, quick replies
  | "thread_context";    // Reply within a conversation thread

// ─── Communication channel ────────────────────────────────────────────────────

export interface CommunicationChannel {
  channel_id:                 CommunicationChannelId;
  display_name:               string;
  type:                       CommunicationChannelType;
  direction:                  MessageDirection;
  status:                     CommunicationProviderStatus;
  requires_business_account:  boolean;
  requires_user_opt_in:       boolean;
  supports_media:             boolean;
  supports_templates:         boolean;
  supports_automation:        boolean;
  supports_ai_replies:        boolean;
  supports_rich_content:      boolean;
  /** BusinessApplicationId values — string to avoid circular import. */
  available_in:               string[];
  /** ISO 3166-1 alpha-2 codes, or "global". */
  region_availability:        string[];
  estimated_japan_reach:      string | null;   // e.g., "95M active users"
  business_api_required:      boolean;
  spec_document:              string | null;
  implementation_sprint:      string | null;
}

// ─── Communication provider ───────────────────────────────────────────────────

export interface CommunicationProvider {
  provider_id:       string;
  display_name:      string;
  channel:           CommunicationChannelId;
  vendor:            string;
  status:            CommunicationProviderStatus;
  api_version:       string | null;
  rate_limits: {
    messages_per_second: number | null;
    messages_per_day:    number | null;
  };
  webhook_supported:   boolean;
  sandbox_available:   boolean;
  implementation_notes: string;
}

// ─── Communication capability ─────────────────────────────────────────────────

export interface CommunicationCapability {
  capability_id:      CommunicationCapabilityId;
  display_name:       string;
  description:        string;
  supported_channels: CommunicationChannelId[];
  status:             CommunicationProviderStatus;
}

// ─── Communication policy ─────────────────────────────────────────────────────

export type CommPolicyEnforcement = "strict" | "advisory";

export interface CommunicationPolicy {
  policy_id:   string;    // COMM-001 … COMM-NNN
  title:       string;
  description: string;
  enforcement: CommPolicyEnforcement;
  rationale:   string;
  applies_to:  CommunicationChannelId[] | "all";
}

// ─── Customer communication preferences ───────────────────────────────────────
//
// Metadata model for how a customer wishes to be contacted.
// No persistence here — this shape is consumed by application DB layers.

export interface CustomerNotificationPreferences {
  job_updates:            boolean;  // Work order status, completion notices
  maintenance_reminders:  boolean;  // Coating / maintenance cycle reminders
  promotional:            boolean;  // Marketing campaigns and promotions
  system_notices:         boolean;  // Account and booking confirmations
}

export interface CustomerCommunicationPreferences {
  preferred_channel:            CommunicationChannelId | null;
  enabled_channels:             CommunicationChannelId[];
  marketing_consent:            boolean;
  review_request_consent:       boolean;
  ai_communication_permission:  boolean;
  notification_preferences:     CustomerNotificationPreferences;
  /** ISO 8601 timestamp. null = consent not yet recorded. */
  consent_recorded_at:          string | null;
  /** ISO 8601 timestamp of last preference update. */
  last_updated_at:              string | null;
}

// ─── Unified Inbox — architecture types (Phase D) ─────────────────────────────
//
// These types describe the future Unified Inbox feature.
// No implementation exists. Declared to document the intended schema
// for future sprint planning.

export type InboxConversationStatus =
  | "open"      // Active conversation requiring attention
  | "pending"   // Awaiting customer reply
  | "resolved"  // Staff-marked as resolved
  | "archived"; // Closed and retained for history

export type InboxAssignmentStatus =
  | "unassigned"  // Not yet claimed by staff
  | "assigned"    // Assigned to a specific staff member
  | "ai_handled"  // AI assistant is responding
  | "escalated";  // Escalated from AI to human

export interface UnifiedInboxFeatures {
  conversation_threads: boolean;
  message_history:      boolean;
  attachments:          boolean;
  ai_assistant:         boolean;
  read_status:          boolean;
  staff_assignment:     boolean;
  search:               boolean;
  labels_and_tags:      boolean;
  bulk_actions:         boolean;
  mobile_app:           boolean;
}

export interface UnifiedInboxConfig {
  supported_channels:     CommunicationChannelId[];
  features:               UnifiedInboxFeatures;
  /** Always "planned" in this sprint. */
  status:                 "planned";
  target_sprint:          string;
}

// ─── AI communication capabilities (Phase E) ──────────────────────────────────

export type AICommunicationFeatureId =
  | "ai_reply_generation"       // Generate contextual replies to inbound messages
  | "ai_translation"            // Real-time message translation
  | "ai_tone_adjustment"        // Adjust message tone (formal / friendly)
  | "ai_follow_up"              // Automated follow-up sequence generation
  | "ai_maintenance_reminder"   // AI-personalised maintenance reminder copy
  | "ai_review_request";        // Compliant review request message generation

export interface AICommunicationCapability {
  feature_id:                 AICommunicationFeatureId;
  display_name:               string;
  description:                string;
  supported_channels:         CommunicationChannelId[];
  requires_ai_gateway:        true;
  requires_customer_ai_consent: boolean;
  requires_staff_review:      boolean;  // true = AI drafts; staff approves before send
  status:                     CommunicationProviderStatus;
  target_sprint:              string | null;
}

// ─── Communication Center descriptor ─────────────────────────────────────────

export interface CommunicationCenterDescriptor {
  version:                        string;
  sprint:                         string;
  registered_channel_count:       number;
  active_channel_count:           number;
  planned_channel_count:          number;
  registered_provider_count:      number;
  communication_capability_count: number;
  ai_capability_count:            number;
  policy_count:                   number;
  strict_policy_count:            number;
  platform_core_integrated:       true;
  persistence_required:           false;
  unified_inbox_status:           "planned";
  target_sprint:                  string;
}
