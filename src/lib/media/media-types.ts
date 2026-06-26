// DealerOS — Canonical Media Model
//
// Defines the media-first architecture for all customer photos and videos.
//
// Sprint 10I: type contract only. No schema migration in this sprint.
//
// Current storage: work_order_files (WorkOrderFileDB).
//   Already contains: file_type = 'photo' | 'document' | 'video' | 'other'.
//   Missing: thumbnail_path, duration_seconds, width, height, captured_at,
//            uploaded_by, media_usage, consent_status, completion_report_id,
//            is_marketing_approved, is_ai_training_excluded.
//
// Target storage: DealerMedia (requires Phase 10J migration — CTO approval).
//
// Security:
//   - dealer_id is always from getCurrentDealer() — never from client input
//   - Private media is internal_only by default
//   - Customer-visible and marketing use require explicit consent at each level
//   - is_ai_training_excluded is immutable once set to true

import type { WorkOrderFileDB, WorkOrderFilePhase } from "@/lib/work-order-files/work-order-file-types";

// ─── Core media identity ───────────────────────────────────────────────────────

/** Technical type of the media asset — content type, not file format. */
export type MediaType = "photo" | "video";

/**
 * The intended context or workflow phase of a media asset.
 * Maps to WorkOrderFilePhase for current work order files.
 */
export type MediaUsage =
  | "before"               // Captured before work began — documents vehicle condition
  | "after"                // Captured after work completed — shows final result
  | "work_in_progress"     // Mid-job documentation
  | "completion"           // Formal completion record (used in completion report)
  | "customer_visible"     // Cleared for sharing in customer-facing documents
  | "internal_only"        // Dealer/staff only — never visible to customer
  | "marketing_candidate"  // Flagged as suitable for marketing use (pending consent)
  | "ai_training_excluded"; // Explicitly excluded from AI model training datasets

// ─── Consent and visibility ────────────────────────────────────────────────────

/**
 * Customer's consent status for sharing this media beyond the dealer.
 * Required before: customer_visible, marketing use, AI training.
 * Internal-only media does not require consent.
 */
export type MediaConsentStatus =
  | "not_required"  // Internal-only media — no consent form needed
  | "pending"       // Consent form sent or prompted — awaiting response
  | "approved"      // Customer has explicitly consented (timestamp stored separately)
  | "denied";       // Customer explicitly declined — must not be used externally

/**
 * Where this media asset is allowed to appear.
 * Visibility is a ratchet: it can be increased only with explicit consent at each level.
 * It can be decreased at any time (e.g., if consent is revoked).
 *
 * Default for all new uploads: "internal_only".
 */
export type MediaVisibility =
  | "internal_only"       // Default. Only dealer organization can access.
  | "customer_visible"    // May appear in customer-facing completion reports.
  | "marketing_approved"; // Cleared for SNS / website / marketing (strongest access).

// ─── Canonical DealerMedia model ──────────────────────────────────────────────

/**
 * DealerMedia — the canonical media model.
 *
 * Phase 10I: type contract only.
 * Phase 10J: extend work_order_files with missing columns (CTO approval required).
 *
 * Fields marked [FUTURE] are not present in the current work_order_files schema.
 * The workOrderFileToDealerMedia() adapter bridges the gap until migration.
 */
export interface DealerMedia {
  id:             string;
  /** Always from getCurrentDealer(). Never from client. */
  dealer_id:      string;

  // ── Core identity ────────────────────────────────────────────────────────
  media_type:     MediaType;
  usage:          MediaUsage;
  visibility:     MediaVisibility;
  consent_status: MediaConsentStatus;

  // ── Privacy flags ─────────────────────────────────────────────────────────
  /**
   * [FUTURE] Must not be used for any AI provider model training.
   * Immutable once set to true — requires CTO approval to unset.
   */
  is_ai_training_excluded: boolean;
  /**
   * [FUTURE] Dealer has approved this asset for SNS / marketing use.
   * Requires consent_status = "approved".
   */
  is_marketing_approved: boolean;

  // ── File storage ──────────────────────────────────────────────────────────
  file_path:       string;         // Storage path under dealer_id scope
  file_url:        string | null;  // Signed or public URL
  /**
   * [FUTURE] Storage path to a pre-generated thumbnail image.
   * Null until the thumbnail generation service is implemented (Phase 10J+).
   * Videos: first-frame JPEG. Photos: resized 480px JPEG.
   */
  thumbnail_path:  string | null;
  mime_type:       string | null;
  file_size_bytes: number | null;

  // ── Media metadata [FUTURE] ───────────────────────────────────────────────
  /** [FUTURE] Duration in seconds. Videos only. Null until extraction is implemented. */
  duration_seconds: number | null;
  /** [FUTURE] Width in pixels. Null until image/video metadata extraction is implemented. */
  width:            number | null;
  /** [FUTURE] Height in pixels. */
  height:           number | null;
  /** [FUTURE] ISO 8601 — when the media was physically captured (EXIF or user-provided). */
  captured_at:      string | null;
  /** [FUTURE] UUID of the staff member who uploaded this file. */
  uploaded_by:      string | null;

  // ── Relations ─────────────────────────────────────────────────────────────
  customer_id:           string | null;
  vehicle_id:            string | null;
  work_order_id:         string | null;
  /** [FUTURE] FK to completion_reports — added in Phase 10J migration. */
  completion_report_id:  string | null;

  created_at: string;
  updated_at: string;
}

// ─── Adapter: WorkOrderFileDB → DealerMedia ───────────────────────────────────

/**
 * Adapts a current WorkOrderFileDB record to the canonical DealerMedia interface.
 * All [FUTURE] fields default to null/false until schema migration is applied.
 *
 * Phase 10J: this adapter becomes unnecessary once work_order_files is extended.
 */
export function workOrderFileToDealerMedia(file: WorkOrderFileDB): DealerMedia {
  return {
    id:             file.id,
    dealer_id:      file.dealer_id,
    media_type:     file.file_type === "video" ? "video" : "photo",
    usage:          mapPhaseToUsage(file.phase),
    visibility:     file.is_public ? "customer_visible" : "internal_only",
    consent_status: "not_required",
    is_ai_training_excluded: false,
    is_marketing_approved:   false,
    file_path:       file.file_path,
    file_url:        file.file_url,
    thumbnail_path:  null,
    mime_type:       file.mime_type,
    file_size_bytes: file.file_size,
    duration_seconds: null,
    width:            null,
    height:           null,
    captured_at:      null,
    uploaded_by:      null,
    customer_id:      null,
    vehicle_id:       null,
    work_order_id:    file.work_order_id,
    completion_report_id: null,
    created_at: file.created_at,
    updated_at: file.updated_at,
  };
}

function mapPhaseToUsage(phase: WorkOrderFilePhase): MediaUsage {
  switch (phase) {
    case "before":   return "before";
    case "during":   return "work_in_progress";
    case "after":    return "after";
    case "delivery": return "completion";
    case "damage":   return "internal_only";
    default:         return "internal_only";
  }
}

// ─── Upload constraints ────────────────────────────────────────────────────────

/** Current enforced limit for all file uploads (photos + videos). */
export const CURRENT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;  // 20 MB

/**
 * Target maximum for video uploads — NOT yet enforced.
 *
 * Before increasing the video limit, the following must be reviewed:
 *   1. Supabase Storage plan capacity and egress pricing
 *   2. Vercel serverless function memory and body size limits (Pro: up to 4.5 GB body)
 *   3. CDN streaming strategy (HLS segmentation vs. progressive download)
 *   4. Thumbnail generation service for video previews
 *   5. Mobile upload UX (large file upload progress, retry on failure)
 *
 * Phase 10J: update CURRENT_MAX_UPLOAD_BYTES in upload-work-order-file.ts
 * after infrastructure review and CTO approval.
 */
export const VIDEO_TARGET_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;  // 500 MB

// ─── MIME type constants ───────────────────────────────────────────────────────

export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/avi",
  "video/x-m4v",
  "video/3gpp",
] as const;

export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number];

// ─── AI Marketing Agent integration ───────────────────────────────────────────

/**
 * MediaForMarketing — subset of DealerMedia fields relevant to the AI Marketing Agent.
 * The Marketing Agent must not access fields beyond this interface.
 *
 * Privacy rule: only media where:
 *   - visibility = "marketing_approved"
 *   - consent_status = "approved"
 *   - is_ai_training_excluded = false (for AI-assisted content)
 * may be passed to external AI providers.
 */
export interface MediaForMarketing {
  id:                      string;
  dealer_id:               string;
  media_type:              MediaType;
  usage:                   MediaUsage;
  file_url:                string | null;
  thumbnail_path:          string | null;
  mime_type:               string | null;
  duration_seconds:        number | null;
  width:                   number | null;
  height:                  number | null;
  is_marketing_approved:   true;      // Invariant — always true in this context
  is_ai_training_excluded: boolean;
  work_order_id:           string | null;
  vehicle_id:              string | null;
}

/**
 * Filters a DealerMedia list to only marketing-approved assets.
 * Enforces: visibility = "marketing_approved" AND consent_status = "approved".
 */
export function getMarketingApprovedMedia(
  media: DealerMedia[],
): MediaForMarketing[] {
  return media
    .filter(
      (m): m is DealerMedia & { visibility: "marketing_approved"; consent_status: "approved" } =>
        m.visibility        === "marketing_approved" &&
        m.consent_status    === "approved" &&
        m.is_marketing_approved === true,
    )
    .map((m) => ({
      id:                      m.id,
      dealer_id:               m.dealer_id,
      media_type:              m.media_type,
      usage:                   m.usage,
      file_url:                m.file_url,
      thumbnail_path:          m.thumbnail_path,
      mime_type:               m.mime_type,
      duration_seconds:        m.duration_seconds,
      width:                   m.width,
      height:                  m.height,
      is_marketing_approved:   true as const,
      is_ai_training_excluded: m.is_ai_training_excluded,
      work_order_id:           m.work_order_id,
      vehicle_id:              m.vehicle_id,
    }));
}
