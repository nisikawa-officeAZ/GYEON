// GYEON Business Hub — Communication Center: Customer Communication Model (Sprint 11X Phase C)
//
// Customer communication preferences and consent model.
//
// This module declares the metadata shape for how customers wish to be contacted.
// Applications (Dealer Agent, GYEON Distribution, GYEON CRM) persist and read these
// preferences in their own databases. This module declares the canonical shape
// and provides pure validation helpers — no database access.
//
// Consent model:
//   marketing_consent          — required for promotional messages
//   review_request_consent     — required for review request messages
//   ai_communication_permission— required before AI generates any customer-facing message
//   notification_preferences   — per-type opt-in for transactional messages
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CommunicationChannelId,
  CustomerCommunicationPreferences,
  CustomerNotificationPreferences,
} from "./communication-types";
import { COMMUNICATION_CHANNEL_REGISTRY } from "./channel-registry";

// ─── Default preferences ──────────────────────────────────────────────────────
//
// Safe defaults applied when a new customer record is created.
// All consents default to false — explicit opt-in required.

export const DEFAULT_NOTIFICATION_PREFERENCES: CustomerNotificationPreferences = {
  job_updates:           true,   // On by default — operational, not marketing
  maintenance_reminders: false,  // Requires consent
  promotional:           false,  // Requires marketing consent
  system_notices:        true,   // On by default — account/booking confirmations
};

export const DEFAULT_CUSTOMER_COMMUNICATION_PREFERENCES: CustomerCommunicationPreferences = {
  preferred_channel:            null,    // Not set until customer interacts
  enabled_channels:             [],      // No channels enabled until consent given
  marketing_consent:            false,
  review_request_consent:       false,
  ai_communication_permission:  false,
  notification_preferences:     DEFAULT_NOTIFICATION_PREFERENCES,
  consent_recorded_at:          null,
  last_updated_at:              null,
};

// ─── Consent validation ───────────────────────────────────────────────────────

/** Returns true if the preferences permit sending a marketing message on the given channel. */
export function canSendMarketing(
  prefs:   CustomerCommunicationPreferences,
  channel: CommunicationChannelId,
): boolean {
  return (
    prefs.marketing_consent &&
    prefs.enabled_channels.includes(channel) &&
    prefs.notification_preferences.promotional
  );
}

/** Returns true if the preferences permit sending a review request on the given channel. */
export function canSendReviewRequest(
  prefs:   CustomerCommunicationPreferences,
  channel: CommunicationChannelId,
): boolean {
  return (
    prefs.review_request_consent &&
    prefs.enabled_channels.includes(channel)
  );
}

/** Returns true if the preferences permit sending a maintenance reminder on the given channel. */
export function canSendMaintenanceReminder(
  prefs:   CustomerCommunicationPreferences,
  channel: CommunicationChannelId,
): boolean {
  return (
    prefs.enabled_channels.includes(channel) &&
    prefs.notification_preferences.maintenance_reminders
  );
}

/** Returns true if AI may generate a customer-facing message for this customer. */
export function canUseAICommunication(
  prefs: CustomerCommunicationPreferences,
): boolean {
  return prefs.ai_communication_permission;
}

/** Returns true if a job update (completion notice, status change) may be sent. */
export function canSendJobUpdate(
  prefs:   CustomerCommunicationPreferences,
  channel: CommunicationChannelId,
): boolean {
  return (
    prefs.enabled_channels.includes(channel) &&
    prefs.notification_preferences.job_updates
  );
}

// ─── Channel resolution ───────────────────────────────────────────────────────

/**
 * Resolve the best channel to use for a given message type.
 * Returns the preferred channel if it is enabled and appropriate,
 * otherwise falls back to the first enabled channel that supports the message type.
 */
export function resolvePreferredChannel(
  prefs:            CustomerCommunicationPreferences,
  available_channels: CommunicationChannelId[],
): CommunicationChannelId | null {
  const enabled = prefs.enabled_channels.filter((c) =>
    available_channels.includes(c),
  );
  if (enabled.length === 0) return null;

  if (
    prefs.preferred_channel &&
    enabled.includes(prefs.preferred_channel)
  ) {
    return prefs.preferred_channel;
  }

  return enabled[0] ?? null;
}

// ─── Preference summary ───────────────────────────────────────────────────────

export interface CustomerCommunicationSummary {
  has_any_channel:             boolean;
  channel_count:               number;
  preferred_channel:           CommunicationChannelId | null;
  marketing_allowed:           boolean;
  review_request_allowed:      boolean;
  ai_communication_allowed:    boolean;
  maintenance_reminders_allowed: boolean;
  consent_on_record:           boolean;
}

export function summarizePreferences(
  prefs: CustomerCommunicationPreferences,
): CustomerCommunicationSummary {
  return {
    has_any_channel:               prefs.enabled_channels.length > 0,
    channel_count:                 prefs.enabled_channels.length,
    preferred_channel:             prefs.preferred_channel,
    marketing_allowed:             prefs.marketing_consent,
    review_request_allowed:        prefs.review_request_consent,
    ai_communication_allowed:      prefs.ai_communication_permission,
    maintenance_reminders_allowed: prefs.notification_preferences.maintenance_reminders,
    consent_on_record:             prefs.consent_recorded_at !== null,
  };
}

// ─── Valid channel guard ──────────────────────────────────────────────────────

const VALID_CHANNEL_IDS = new Set<string>(
  COMMUNICATION_CHANNEL_REGISTRY.map((c) => c.channel_id),
);

export function isValidChannelId(value: string): value is CommunicationChannelId {
  return VALID_CHANNEL_IDS.has(value);
}

/** Filters out any invalid channel IDs from an array (e.g., from DB or form input). */
export function sanitizeChannelList(
  raw: string[],
): CommunicationChannelId[] {
  return raw.filter(isValidChannelId);
}
