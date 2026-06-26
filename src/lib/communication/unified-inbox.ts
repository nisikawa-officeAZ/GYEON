// GYEON Business Hub — Communication Center: Unified Inbox Foundation (Sprint 11X Phase D)
//
// Architecture-only declarations for the future Unified Inbox feature.
//
// The Unified Inbox will provide a single interface for staff to read, reply to,
// and manage conversations across all communication channels (LINE, WhatsApp,
// Instagram, Facebook Messenger, X, Email, SMS).
//
// CURRENT STATUS: Architecture declarations only.
// No implementation. No persistence. No runtime messaging.
// These types serve as the intended schema for future sprint planning.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CommunicationChannelId,
  InboxAssignmentStatus,
  InboxConversationStatus,
  UnifiedInboxConfig,
  UnifiedInboxFeatures,
} from "./communication-types";

// ─── Unified Inbox configuration ──────────────────────────────────────────────

const INBOX_FEATURES: UnifiedInboxFeatures = {
  conversation_threads: true,
  message_history:      true,
  attachments:          true,
  ai_assistant:         true,
  read_status:          true,
  staff_assignment:     true,
  search:               true,
  labels_and_tags:      true,
  bulk_actions:         true,
  mobile_app:           false,   // Mobile app planned for a later sprint
};

const UNIFIED_INBOX_CHANNELS: CommunicationChannelId[] = [
  "line",
  "whatsapp",
  "instagram",
  "facebook_messenger",
  "x",
  "email",
  "sms",
];

export const UNIFIED_INBOX_CONFIG: UnifiedInboxConfig = {
  supported_channels: UNIFIED_INBOX_CHANNELS,
  features:           INBOX_FEATURES,
  status:             "planned",
  target_sprint:      "Sprint 12+",
};

// ─── Future schema shapes (architecture intent) ───────────────────────────────
//
// The following interfaces describe the intended data shape for the Unified Inbox
// when implementation begins. These are NOT persisted in Sprint 11X.
// They are provided here to guide schema design in future database migration sprints.

/** Represents a conversation thread between the business and a customer. */
export interface ConversationThread {
  thread_id:       string;   // UUID
  /** dealer_id (for Dealer Agent) or company_id (for other apps). Never client-supplied. */
  tenant_id:       string;
  customer_id:     string | null;
  channel:         CommunicationChannelId;
  channel_user_id: string;   // Provider-specific customer identifier (LINE user ID, etc.)
  status:          InboxConversationStatus;
  assignment:      InboxAssignmentStatus;
  assigned_to:     string | null;   // Staff member ID
  unread_count:    number;
  last_message_at: string | null;   // ISO 8601
  created_at:      string;          // ISO 8601
  updated_at:      string;          // ISO 8601
}

/** Represents a single message within a ConversationThread. */
export interface InboxMessage {
  message_id:   string;   // UUID
  thread_id:    string;
  direction:    "inbound" | "outbound";
  channel:      CommunicationChannelId;
  content_type: "text" | "image" | "video" | "document" | "template" | "system";
  body:         string | null;
  media_url:    string | null;
  /** True if this message was drafted or sent by the AI assistant. */
  ai_generated: boolean;
  sent_by:      string | null;    // Staff member ID (null = automated / system)
  is_read:      boolean;
  sent_at:      string;           // ISO 8601
  delivered_at: string | null;
  read_at:      string | null;
}

/** Represents a file attachment on an InboxMessage. */
export interface MessageAttachment {
  attachment_id: string;
  message_id:    string;
  filename:      string;
  mime_type:     string;
  size_bytes:    number;
  storage_path:  string;   // Platform media storage path
  created_at:    string;
}

/** Assignment event log for a ConversationThread. */
export interface ThreadAssignmentEvent {
  event_id:    string;
  thread_id:   string;
  from_status: InboxAssignmentStatus | null;
  to_status:   InboxAssignmentStatus;
  from_staff:  string | null;
  to_staff:    string | null;
  reason:      string | null;
  occurred_at: string;   // ISO 8601
}

// ─── Inbox summary type ───────────────────────────────────────────────────────

export interface UnifiedInboxSummary {
  status:             "planned";
  target_sprint:      string;
  supported_channels: number;
  feature_count:      number;
  schema_types_declared: number;
}

export const UNIFIED_INBOX_SUMMARY: UnifiedInboxSummary = {
  status:                "planned",
  target_sprint:         UNIFIED_INBOX_CONFIG.target_sprint,
  supported_channels:    UNIFIED_INBOX_CONFIG.supported_channels.length,
  feature_count:         Object.keys(UNIFIED_INBOX_CONFIG.features).length,
  schema_types_declared: 4,   // ConversationThread, InboxMessage, MessageAttachment, ThreadAssignmentEvent
};
