// GYEON Business Hub — Communication Center: Package Barrel (Sprint 11X)
//
// Public API for src/lib/communication/.
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  CommunicationChannelId,
  CommunicationChannelType,
  MessageDirection,
  CommunicationProviderStatus,
  CommunicationCapabilityId,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationCapability,
  CommPolicyEnforcement,
  CommunicationPolicy,
  CustomerNotificationPreferences,
  CustomerCommunicationPreferences,
  InboxConversationStatus,
  InboxAssignmentStatus,
  UnifiedInboxFeatures,
  UnifiedInboxConfig,
  AICommunicationFeatureId,
  AICommunicationCapability,
  CommunicationCenterDescriptor,
} from "./communication-types";

// ── Channel registry ──────────────────────────────────────────────────────────
export {
  COMMUNICATION_CHANNEL_REGISTRY,
  getChannel,
  getActiveChannels,
  getPlannedChannels,
  getChannelsForApplication,
  getBidirectionalChannels,
  getChannelsSupportingAutomation,
  getChannelsSupportingAI,
} from "./channel-registry";

// ── Communication provider ────────────────────────────────────────────────────
export {
  COMMUNICATION_PROVIDER_REGISTRY,
  COMMUNICATION_CAPABILITIES,
  getProvider,
  getProvidersForChannel,
  getCapability,
  getCapabilitiesForChannel,
} from "./communication-provider";

// ── Customer communication ────────────────────────────────────────────────────
export type { CustomerCommunicationSummary } from "./customer-communication";

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_CUSTOMER_COMMUNICATION_PREFERENCES,
  canSendMarketing,
  canSendReviewRequest,
  canSendMaintenanceReminder,
  canUseAICommunication,
  canSendJobUpdate,
  resolvePreferredChannel,
  summarizePreferences,
  isValidChannelId,
  sanitizeChannelList,
} from "./customer-communication";

// ── Unified Inbox ─────────────────────────────────────────────────────────────
export type {
  ConversationThread,
  InboxMessage,
  MessageAttachment,
  ThreadAssignmentEvent,
  UnifiedInboxSummary,
} from "./unified-inbox";

export {
  UNIFIED_INBOX_CONFIG,
  UNIFIED_INBOX_SUMMARY,
} from "./unified-inbox";

// ── AI communication ──────────────────────────────────────────────────────────
export {
  AI_COMMUNICATION_CAPABILITIES,
  getAICommunicationCapability,
  getAICapabilitiesForChannel,
  getAICapabilitiesRequiringConsent,
  getAICapabilitiesRequiringStaffReview,
  getAutomatedAICapabilities,
} from "./ai-communication";

// ── Communication policy ──────────────────────────────────────────────────────
export {
  COMMUNICATION_POLICIES,
  getCommPolicy,
  getStrictCommPolicies,
  getAdvisoryCommPolicies,
  getPoliciesForChannel,
  getPoliciesApplyingToAllChannels,
} from "./communication-policy";

// ── Platform Core bridge ──────────────────────────────────────────────────────
export type {
  CommunicationModuleManifest,
  CommPolicySummary,
} from "./platform-core-bridge";

export {
  APPLICATION_CHANNEL_MAP,
  COMMUNICATION_MODULE_MANIFEST,
  COMMUNICATION_POLICY_SUMMARY,
  COMMUNICATION_CENTER,
  getChannelsForPlatformApp,
  getApplicationsForChannel,
} from "./platform-core-bridge";
