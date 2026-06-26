// DealerOS — Media Audit Utilities
//
// Sprint 10L Phase D: audit trail helpers for media deletion lifecycle.
//
// Creates and validates MediaDeletionRecord objects — the safe metadata record
// retained after a file is physically deleted from Supabase Storage.
//
// Rules:
//   - MediaDeletionRecord must NEVER contain file_url or file_path after deletion.
//   - The record proves the asset existed and documents its end-of-life reason.
//   - No runtime deletion is implemented here — these are pure construction helpers.
//   - isDeletionEligible() determines whether a file CAN be deleted; it does not
//     perform or schedule the deletion.

import type { DealerMedia, MediaDeletionReason, MediaDeletionRecord } from "./media-types";
import { DEFAULT_RETENTION_DAYS, isRetentionExpired } from "./media-types";

// ─── Deletion record factory ──────────────────────────────────────────────────

/**
 * Constructs a MediaDeletionRecord from a DealerMedia record.
 *
 * Call this immediately before physically deleting the file from storage.
 * The record must be persisted BEFORE the storage deletion so the audit trail
 * is never lost if the storage deletion fails.
 *
 * The record intentionally omits file_path and file_url — those must not be
 * retained after deletion.
 */
export function createDeletionRecord(
  asset:  DealerMedia,
  reason: MediaDeletionReason,
  opts?: {
    generated_output_record?: string;
    download_status?:         MediaDeletionRecord["download_status"];
    publish_status?:          MediaDeletionRecord["publish_status"];
  },
): MediaDeletionRecord {
  return {
    media_id:                asset.id,
    work_order_id:           asset.work_order_id,
    customer_id:             asset.customer_id,
    vehicle_id:              asset.vehicle_id,
    media_type:              asset.media_type,
    deleted_at:              new Date().toISOString(),
    retention_reason:        reason,
    generated_output_record: opts?.generated_output_record ?? null,
    download_status:         opts?.download_status ?? "unknown",
    publish_status:          opts?.publish_status ?? "unknown",
  };
}

// ─── Deletion record validation ────────────────────────────────────────────────

/**
 * Returns true if a deletion record has all required fields populated correctly.
 * Use before persisting a record to ensure it is well-formed.
 */
export function validateDeletionRecord(record: MediaDeletionRecord): boolean {
  return !!(
    record.media_id             &&
    record.media_type           &&
    record.deleted_at           &&
    record.retention_reason     &&
    record.download_status      &&
    record.publish_status
  );
}

// ─── Deletion eligibility ──────────────────────────────────────────────────────

/**
 * Returns true if a media asset is currently eligible for physical deletion.
 *
 * An asset is eligible when:
 *   - It has not already been deleted (deleted_at is null)
 *   - Its retention window has expired (for videos: > 30 days since upload)
 *
 * Photos are NEVER eligible under the default policy (10-year retention).
 * This function does not account for dealer-configured retention overrides —
 * that is handled by the future retention enforcement runtime (Phase 10M+).
 *
 * This function does NOT delete anything. Actual deletion requires:
 *   1. CTO approval to apply the media_assets migration
 *   2. A dedicated retention enforcement service (Phase 10M+)
 *   3. Physical storage deletion + record update as an atomic operation
 */
export function isDeletionEligible(asset: DealerMedia, now: Date = new Date()): boolean {
  if (asset.deleted_at)            return false;  // Already soft-deleted
  if (!asset.file_path)            return false;  // No file to delete
  if (asset.media_type !== "video") return false;  // Photos not eligible by default

  const days    = DEFAULT_RETENTION_DAYS["video"];
  const created = new Date(asset.created_at);
  const expires = new Date(created);
  expires.setDate(expires.getDate() + days);
  return now > expires;
}

/**
 * Returns all assets from the given list that are eligible for deletion.
 * Useful for batch audits and pre-deletion review (no runtime deletion).
 */
export function getEligibleForDeletion(assets: DealerMedia[]): DealerMedia[] {
  const now = new Date();
  return assets.filter((a) => isDeletionEligible(a, now));
}

/**
 * Returns true if the asset has a consent_revoked deletion reason applicable.
 * When a customer revokes consent, all media flagged as marketing_approved or
 * customer_visible for that customer must be reviewed for deletion.
 */
export function requiresConsentRevocationReview(asset: DealerMedia): boolean {
  return asset.consent_status === "denied" && (
    asset.visibility === "customer_visible" ||
    asset.visibility === "marketing_approved"
  );
}
