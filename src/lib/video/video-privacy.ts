// DealerOS — Video Pipeline Privacy Model
//
// Sprint 11B Phase F: customer privacy model for the AI Video Pipeline.
//
// This module defines the privacy configuration, consent requirements,
// and retention tracking for video projects and their outputs.
//
// Privacy gates defined here:
//   VideoConsentRequirement — who must provide consent for a source to be used
//   VideoFacesPolicy — how faces in video are handled (blur vs. allow)
//   VideoLicensePlatePolicy — how license plates in video are handled
//   VideoDownloadRecord — audit trail for each output download
//   VideoPrivacyConfig — aggregated privacy config for a VideoProject
//
// Phase F guarantees:
//   - No runtime deletion (records are created; actual deletion is Phase 11C+)
//   - download_tracking creates immutable audit records, not side effects
//   - consent_requirement gates are checked before any AI access
//   - ai_training_excluded = true permanently blocks AI training use of this video
//
// Relationship to @/lib/media/media-consent.ts:
//   Media consent governs individual MediaAsset objects.
//   VideoPrivacyConfig governs the output video derived from those assets.
//   Both must be checked — source media consent + output video privacy config.

import type { VideoRetention } from "./video-types";

// ─── Consent requirement ──────────────────────────────────────────────────────

/**
 * VideoConsentRequirement — the consent level required for a video project.
 *
 * Ordered from most restrictive to least:
 *   ai_excluded        — Media must never be used for AI; blocks AI generation entirely
 *   consent_required   — Explicit customer consent must be obtained before use
 *   internal_only      — Only for internal records; cannot be published
 *   marketing_approved — Full marketing use permitted (most permissive)
 *   not_required       — No consent needed (e.g., dealer logo, stock media)
 */
export type VideoConsentRequirement =
  | "ai_excluded"         // Source or output marked AI-excluded — blocks video generation
  | "consent_required"    // Explicit written/digital consent needed before any external use
  | "internal_only"       // Use in work orders / internal records only
  | "marketing_approved"  // Full marketing use permitted — can be published externally
  | "not_required";       // No consent needed (dealer-owned content: logo, product photo)

// ─── Privacy policies ─────────────────────────────────────────────────────────

/**
 * How faces of people appearing in the video are handled.
 * blur_non_consenting: blur faces of people who have not provided consent.
 * blur_all: blur all faces regardless of consent (maximum privacy).
 * allow_all: no blurring — requires explicit dealer confirmation of consent.
 */
export type VideoFacesPolicy =
  | "blur_all"             // All faces blurred — maximum privacy
  | "blur_non_consenting"  // Only non-consenting faces blurred
  | "allow_all";           // All faces shown — consent verified for all individuals

/**
 * How vehicle license plates in the video are handled.
 * blur_all is the default and recommended policy.
 */
export type VideoLicensePlatePolicy =
  | "blur_all"    // All license plates blurred (default, recommended)
  | "allow_all";  // License plates shown — dealer accepts responsibility

// ─── VideoPrivacyConfig ───────────────────────────────────────────────────────

/**
 * VideoPrivacyConfig — the complete privacy configuration for a VideoProject.
 *
 * Applied to the output video. All source media must individually satisfy
 * their own MediaConsentDetail requirements (in @/lib/media/media-consent.ts).
 *
 * ai_training_excluded = true means the generated video and its source media
 * cannot be used to train AI models. This is a permanent flag once set.
 */
export interface VideoPrivacyConfig {
  /** Consent requirement for using the output video externally. */
  output_consent_requirement: VideoConsentRequirement;
  /**
   * Derived from the strictest source media consent requirement.
   * If any source requires "ai_excluded", the entire project is ai_excluded.
   */
  source_consent_requirement: VideoConsentRequirement;
  /** How faces in the output video are handled. */
  faces_policy:               VideoFacesPolicy;
  /** How license plates in the output video are handled. */
  license_plate_policy:       VideoLicensePlatePolicy;
  /**
   * If true, neither the output video nor its source media may be used
   * for AI model training. Permanent once set.
   */
  ai_training_excluded:       boolean;
  /** Project-level retention configuration. */
  retention:                  VideoRetention;
}

// ─── Download tracking ────────────────────────────────────────────────────────

/**
 * Why the dealer downloaded the output video.
 * Recorded in VideoDownloadRecord for audit purposes.
 */
export type VideoDownloadReason =
  | "dealer_preview"       // Internal preview before approval
  | "dealer_archive"       // Long-term archive download
  | "marketing_use"        // Exported for use in marketing materials
  | "social_publish"       // Downloaded before publishing to social media
  | "customer_delivery"    // Delivered to the customer directly
  | "other";               // Miscellaneous download — notes should be provided

/**
 * VideoDownloadRecord — immutable audit record for each output video download.
 *
 * Phase F: records are created; no side effects, no deletions triggered.
 * Phase 11C+: retention policies that trigger deletion after download will
 * consume these records to determine when deletion is eligible.
 *
 * file_path_hash: SHA-256 hash of the output file path (never the raw path).
 * This allows audit trail without exposing storage URLs in logs.
 */
export interface VideoDownloadRecord {
  id:              string;
  project_id:      string;
  dealer_id:       string;
  /** SHA-256 hash of the output file path — never the raw storage path. */
  file_path_hash:  string;
  downloaded_at:   string;   // ISO 8601
  downloaded_by:   string | null;   // Staff ID if available; null if anonymous
  download_reason: VideoDownloadReason;
  notes:           string | null;
}

// ─── Deletion record ──────────────────────────────────────────────────────────

/**
 * Why a VideoProject output is being deleted.
 */
export type VideoDeletionReason =
  | "retention_expired"     // Retention window elapsed
  | "dealer_requested"      // Explicit dealer deletion request
  | "consent_revoked"       // Customer revoked consent post-generation
  | "ai_excluded_violation" // Media was used in violation of ai_excluded policy
  | "policy_violation"      // Output violated VideoPolicy
  | "audit_complete";       // Post-audit cleanup

/**
 * VideoDeletionRecord — immutable record that an output was marked for deletion.
 *
 * Phase F: creates the record only. No runtime deletion.
 * Phase 11C+: a scheduled job reads these records and performs the actual deletion.
 * The record remains in the audit log after deletion is confirmed.
 */
export interface VideoDeletionRecord {
  id:                    string;
  project_id:            string;
  dealer_id:             string;
  deletion_reason:       VideoDeletionReason;
  scheduled_for:         string;   // ISO 8601 — when deletion is eligible
  deleted_at:            string | null;   // Null until Phase 11C+ confirms deletion
  output_file_path_hash: string;          // SHA-256 hash — never the raw path
  download_record_ids:   string[];        // All VideoDownloadRecord IDs for this output
  notes:                 string | null;
}

// ─── Default configs ──────────────────────────────────────────────────────────

export const DEFAULT_VIDEO_PRIVACY_CONFIG: VideoPrivacyConfig = {
  output_consent_requirement: "marketing_approved",
  source_consent_requirement: "consent_required",
  faces_policy:               "blur_non_consenting",
  license_plate_policy:       "blur_all",
  ai_training_excluded:       true,    // AI training opt-out by default
  retention: {
    source_media_retention_days:    30,
    generated_video_retention_days: 30,
    delete_after_download:          false,
    delete_after_publishing:        false,
    dealer_retained:                false,
  },
};

// ─── Privacy helpers ──────────────────────────────────────────────────────────

/**
 * Derives the strictest VideoConsentRequirement from a list of requirements.
 * Used to compute source_consent_requirement from all source media consent levels.
 *
 * Strictness order (most → least restrictive):
 *   ai_excluded > consent_required > internal_only > marketing_approved > not_required
 */
export function resolveStrictestConsentRequirement(
  requirements: VideoConsentRequirement[],
): VideoConsentRequirement {
  const order: VideoConsentRequirement[] = [
    "ai_excluded",
    "consent_required",
    "internal_only",
    "marketing_approved",
    "not_required",
  ];
  for (const level of order) {
    if (requirements.includes(level)) return level;
  }
  return "not_required";
}

/**
 * Returns true if the given VideoPrivacyConfig blocks AI video generation.
 * This is true when any source is ai_excluded or ai_training_excluded.
 */
export function isAIGenerationBlocked(config: VideoPrivacyConfig): boolean {
  return (
    config.source_consent_requirement === "ai_excluded" ||
    config.output_consent_requirement  === "ai_excluded"
  );
}

/**
 * Returns true if the output video can be published externally.
 * Requires output_consent_requirement = "marketing_approved".
 */
export function isExternalPublishingAllowed(config: VideoPrivacyConfig): boolean {
  return config.output_consent_requirement === "marketing_approved";
}

/**
 * Creates an immutable VideoDownloadRecord.
 * The caller must generate the id and supply the file_path_hash.
 *
 * No side effects — this function only constructs the record object.
 * Persistence is the responsibility of the server action that calls this.
 */
export function buildDownloadRecord(
  id:           string,
  projectId:    string,
  dealerId:     string,
  filePathHash: string,
  reason:       VideoDownloadReason,
  downloadedAt: string,
  overrides?:   Partial<Pick<VideoDownloadRecord, "downloaded_by" | "notes">>,
): VideoDownloadRecord {
  return {
    id,
    project_id:      projectId,
    dealer_id:       dealerId,
    file_path_hash:  filePathHash,
    downloaded_at:   downloadedAt,
    downloaded_by:   overrides?.downloaded_by ?? null,
    download_reason: reason,
    notes:           overrides?.notes         ?? null,
  };
}

/**
 * Creates a VideoDeletionRecord marking a video output as scheduled for deletion.
 *
 * No side effects — this function only constructs the record object.
 * Phase 11C+: a scheduled job will read this record and perform actual deletion.
 */
export function buildDeletionRecord(
  id:             string,
  projectId:      string,
  dealerId:       string,
  reason:         VideoDeletionReason,
  scheduledFor:   string,
  outputPathHash: string,
  downloadIds:    string[],
  notes?:         string,
): VideoDeletionRecord {
  return {
    id,
    project_id:            projectId,
    dealer_id:             dealerId,
    deletion_reason:       reason,
    scheduled_for:         scheduledFor,
    deleted_at:            null,
    output_file_path_hash: outputPathHash,
    download_record_ids:   downloadIds,
    notes:                 notes ?? null,
  };
}
