// DealerOS — Media Consent Model
//
// Sprint 10L Phase A + Phase F: canonical consent model for all media operations.
//
// MediaConsentDetail is a richer view of customer consent than the MediaConsentStatus
// string type in media-types.ts. It includes:
//   - The specific scopes the customer has (or has not) consented to
//   - The channel through which consent was obtained
//   - Timing fields (requested, responded, expires, revoked)
//
// MediaConsentStatus (the simple 4-value enum) remains in media-types.ts for DB-layer use.
// MediaConsentDetail is the domain-layer enrichment used in MediaAsset.
//
// Privacy invariants:
//   - Consent defaults to "not_required" for internal-only media.
//   - Consent cannot be assumed from silence — it must be explicitly approved.
//   - Revocation is immediate and irrevocable at the scoped level.
//   - AI training exclusion is orthogonal: it can block training even with full consent.

import type { MediaConsentStatus } from "./media-types";

// ─── Consent scopes ───────────────────────────────────────────────────────────

/**
 * The specific use cases a customer can consent to or deny for their media.
 *
 * Each scope is independent — a customer may consent to completion_report use
 * while denying marketing_use.
 *
 * Scopes are additive: a consent with ["completion_report", "customer_gallery"]
 * authorizes both uses independently.
 */
export type MediaConsentScope =
  | "completion_report"   // Include in PDF completion report sent to customer
  | "customer_gallery"    // Show in customer portal gallery
  | "marketing_use"       // Use in SNS posts, website, marketing campaigns
  | "ai_analysis"         // Pass to AI agents for visual analysis
  | "ai_training";        // Use in AI model training (always opt-in, never default)

// ─── Consent channel ──────────────────────────────────────────────────────────

/**
 * The channel through which the customer provided consent.
 * Used for audit purposes and to determine consent record trustworthiness.
 */
export type MediaConsentChannel =
  | "line"         // Consent obtained via LINE message (documented in LINE conversation)
  | "web_form"     // Customer submitted a web consent form (LIFF or web portal)
  | "in_person"    // Verbal/written consent obtained in person at the shop
  | "email"        // Consent obtained via email exchange
  | "unknown";     // Channel not recorded — use for legacy or migrated records

// ─── Consent detail ───────────────────────────────────────────────────────────

/**
 * MediaConsentDetail — domain-layer consent model.
 *
 * Extended version of MediaConsentStatus. Contains the full consent record
 * including scope, channel, timing, and revocation state.
 *
 * This object is constructed at the application layer and is not stored as-is in the DB.
 * The DB stores consent_status (string) and the application reconstructs the detail.
 */
export interface MediaConsentDetail {
  status:        MediaConsentStatus;
  /** Which specific uses the customer has consented to. Empty if status != "approved". */
  scopes:        MediaConsentScope[];
  /** Channel through which consent was obtained. */
  channel?:      MediaConsentChannel;
  /** ISO 8601 — when the consent request was sent to the customer. */
  requested_at?: string;
  /** ISO 8601 — when the customer responded. */
  responded_at?: string;
  /** ISO 8601 — when this consent expires. Null for permanent consent. */
  expires_at?:   string;
  /** ISO 8601 — set if the customer revoked consent. */
  revoked_at?:   string;
}

// ─── Preset consent objects ───────────────────────────────────────────────────

/** Default consent for new internal-only uploads. No request needed. */
export const DEFAULT_MEDIA_CONSENT: MediaConsentDetail = {
  status: "not_required",
  scopes: [],
};

/** Pending consent — request sent, awaiting customer response. */
export function pendingConsent(requestedAt: string, channel?: MediaConsentChannel): MediaConsentDetail {
  return {
    status:       "pending",
    scopes:       [],
    channel,
    requested_at: requestedAt,
  };
}

/**
 * Full marketing consent — all scopes except AI training.
 * AI training always requires a separate explicit opt-in.
 */
export const FULL_MARKETING_CONSENT_SCOPES: MediaConsentScope[] = [
  "completion_report",
  "customer_gallery",
  "marketing_use",
  "ai_analysis",
];

// ─── Consent helpers ──────────────────────────────────────────────────────────

/**
 * Returns true if the consent record authorizes the given scope.
 *
 * Checks:
 *   1. status must be "approved"
 *   2. consent must not be revoked
 *   3. consent must not be expired
 *   4. scopes must include the requested scope
 */
export function hasConsentForScope(
  consent: MediaConsentDetail,
  scope:   MediaConsentScope,
): boolean {
  if (consent.status !== "approved")    return false;
  if (consent.revoked_at)               return false;
  if (consent.expires_at && new Date(consent.expires_at) < new Date()) return false;
  return consent.scopes.includes(scope);
}

/**
 * Returns true if the consent is currently active (approved, not revoked, not expired).
 */
export function isConsentActive(consent: MediaConsentDetail): boolean {
  if (consent.status !== "approved") return false;
  if (consent.revoked_at)            return false;
  if (consent.expires_at && new Date(consent.expires_at) < new Date()) return false;
  return true;
}

/**
 * Returns true if consent for the given scope has been explicitly denied.
 */
export function isConsentDenied(consent: MediaConsentDetail): boolean {
  return consent.status === "denied";
}

/**
 * Returns true if a consent request has been sent but not yet answered.
 */
export function isConsentPending(consent: MediaConsentDetail): boolean {
  return consent.status === "pending" && !consent.revoked_at;
}
