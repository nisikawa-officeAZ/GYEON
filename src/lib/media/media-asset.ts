// DealerOS — MediaAsset Domain Object
//
// Sprint 10L Phase A: canonical business-domain media object.
//
// MediaAsset extends DealerMedia (the DB-layer type) with domain-level enrichment:
//   - category:     what business purpose this asset serves
//   - status:       current operational state
//   - lifecycle:    position in the full media lifecycle (derived from fields)
//   - associations: links to business entities (populated via join or derived)
//   - retention:    computed retention summary
//   - consent:      domain-level consent detail
//
// Usage:
//   toMediaAsset(dbRecord)            → fully enriched MediaAsset
//   toMediaReference(dbRecord)        → lightweight reference for list rendering
//
// Media must no longer be treated as files. Media is a business domain.
// "Where is this media used?" → associations
// "What can be done with it?" → checkMediaPermission(asset)
// "Is it still accessible?" → asset.status, asset.retention.is_expired

import type { DealerMedia }           from "./media-types";
import type { MediaType, MediaVisibility, MediaConsentStatus, MediaDeletionRecord } from "./media-types";
import { DEFAULT_RETENTION_DAYS, isRetentionExpired }  from "./media-types";
import { deriveLifecycleStage }        from "./media-lifecycle";
import type { MediaLifecycleStage }    from "./media-lifecycle";
import { deriveAssociationsFromMedia } from "./media-association";
import type { MediaAssociation }       from "./media-association";
import { DEFAULT_MEDIA_CONSENT }       from "./media-consent";
import type { MediaConsentDetail }     from "./media-consent";
import type { VideoRetentionPeriod }   from "./media-video";

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * What business purpose this media asset serves.
 * Derived from media_type, usage, visibility, and AI flags.
 */
export type MediaCategory =
  | "job_documentation"    // Before/during/after photos and videos from a work order
  | "completion_evidence"  // Formal completion record (used in completion report)
  | "customer_delivery"    // Media shown or sent to customer at delivery
  | "marketing_asset"      // Cleared for marketing and SNS use
  | "ai_generated"         // Created by an AI agent (Photo AI, Video AI)
  | "ai_input"             // Source material used as AI input for generation
  | "brand_asset"          // Dealer logo, watermark, branding elements
  | "review_evidence"      // Used in a reputation or review workflow
  | "unknown";             // Uncategorized — requires dealer action

// ─── Asset status ─────────────────────────────────────────────────────────────

/**
 * Current operational status of a media asset.
 * Not the same as lifecycle stage — status is the "can I use this right now?" answer.
 */
export type MediaAssetStatus =
  | "pending_upload"    // Record created; file not yet uploaded to Supabase Storage
  | "active"            // File exists in storage and is accessible
  | "processing"        // Undergoing server-side processing (thumbnail gen, blurring)
  | "retention_expired" // Past retention window — file awaits physical deletion
  | "soft_deleted"      // deleted_at is set; file gone, record retained for audit
  | "archived";         // Long-term storage tier — not actively served

// ─── Retention summary ────────────────────────────────────────────────────────

/**
 * Computed retention state for a media asset.
 * Provides a clear, single-field answer to "will this asset expire?"
 */
export interface MediaRetention {
  /** The configured retention period for this asset. */
  policy:             VideoRetentionPeriod;
  /** ISO 8601 expiry timestamp. Null for long-term retention (photos). */
  expires_at:         string | null;
  /** True if the retention window has elapsed and the file should be deleted. */
  is_expired:         boolean;
  /** True if the dealer has opted into permanent retention (default for photos). */
  is_dealer_retained: boolean;
  /** Present only if the asset has already been deleted (MediaDeletionRecord semantics). */
  deletion_record?:   MediaDeletionRecord;
}

// ─── MediaAsset — canonical domain object ─────────────────────────────────────

/**
 * MediaAsset is the primary business-domain object for all customer media.
 *
 * Extends DealerMedia (the DB-layer type) with domain-level enrichment:
 *   - category + status: what it is and whether it's accessible
 *   - lifecycle: where in the full lifecycle this asset currently sits
 *   - associations: which business entities reference this media
 *   - retention: when this file will expire
 *   - consent: the full domain-level consent record
 *
 * Construction: always use toMediaAsset() — never construct MediaAsset directly.
 */
export interface MediaAsset extends DealerMedia {
  category:      MediaCategory;
  status:        MediaAssetStatus;
  lifecycle:     MediaLifecycleStage;
  associations:  MediaAssociation[];
  retention:     MediaRetention;
  consent:       MediaConsentDetail;
}

// ─── MediaReference — lightweight pointer ─────────────────────────────────────

/**
 * Lightweight reference to a media asset for list views, file pickers, and joins.
 *
 * Used when the full MediaAsset is too heavy — e.g., rendering a work order
 * thumbnail grid or populating a completion report file list.
 * Does not include association data or retention detail.
 */
export interface MediaReference {
  id:             string;
  dealer_id:      string;
  media_type:     MediaType;
  file_url:       string | null;
  thumbnail_path: string | null;
  mime_type:      string | null;
  visibility:     MediaVisibility;
  consent_status: MediaConsentStatus;
  category:       MediaCategory;
  status:         MediaAssetStatus;
}

// ─── Factory: toMediaAsset ────────────────────────────────────────────────────

/**
 * Constructs a fully enriched MediaAsset from a DealerMedia DB record.
 *
 * @param media       The raw database record (from work_order_files or media_assets).
 * @param associations Optional pre-fetched association list. When omitted, associations
 *                     are derived from nullable FK fields on the record (approximate).
 * @param consent      Optional domain-level consent detail. Defaults to DEFAULT_MEDIA_CONSENT
 *                     when not provided.
 */
export function toMediaAsset(
  media:        DealerMedia,
  associations?: MediaAssociation[],
  consent?:      MediaConsentDetail,
): MediaAsset {
  return {
    ...media,
    category:     deriveCategory(media),
    status:       deriveAssetStatus(media),
    lifecycle:    deriveLifecycleStage(media),
    associations: associations ?? deriveAssociationsFromMedia(media),
    retention:    deriveRetention(media),
    consent:      consent ?? DEFAULT_MEDIA_CONSENT,
  };
}

/**
 * Creates a lightweight MediaReference from a DealerMedia or MediaAsset record.
 * Safe to use in list rendering and pagination — no heavy fields included.
 */
export function toMediaReference(media: DealerMedia): MediaReference {
  return {
    id:             media.id,
    dealer_id:      media.dealer_id,
    media_type:     media.media_type,
    file_url:       media.file_url,
    thumbnail_path: media.thumbnail_path,
    mime_type:      media.mime_type,
    visibility:     media.visibility,
    consent_status: media.consent_status,
    category:       deriveCategory(media),
    status:         deriveAssetStatus(media),
  };
}

// ─── Internal derivation helpers ─────────────────────────────────────────────

function deriveCategory(media: DealerMedia): MediaCategory {
  if (media.ai_generated)                   return "ai_generated";
  if (media.ai_source_media_id !== null)     return "ai_input";
  if (media.is_marketing_approved)           return "marketing_asset";
  if (media.usage === "marketing_candidate") return "marketing_asset";
  if (media.usage === "completion")          return "completion_evidence";
  if (media.usage === "customer_visible")    return "customer_delivery";
  if (
    media.usage === "before" ||
    media.usage === "after"  ||
    media.usage === "work_in_progress"
  ) {
    return "job_documentation";
  }
  if (media.usage === "ai_training_excluded") return "review_evidence";
  return "unknown";
}

function deriveAssetStatus(media: DealerMedia): MediaAssetStatus {
  if (media.deleted_at)          return "soft_deleted";
  if (!media.file_path)          return "pending_upload";
  if (isRetentionExpired(media)) return "retention_expired";
  return "active";
}

function deriveRetention(media: DealerMedia): MediaRetention {
  const isPhoto = media.media_type === "photo";

  // Photos default to long-term — no expiry
  const policy: VideoRetentionPeriod = isPhoto ? 90 : 30;

  let expires_at: string | null = null;
  if (!isPhoto) {
    const days    = DEFAULT_RETENTION_DAYS["video"];
    const created = new Date(media.created_at);
    const expires = new Date(created);
    expires.setDate(expires.getDate() + days);
    expires_at = expires.toISOString();
  }

  return {
    policy,
    expires_at,
    is_expired:         isRetentionExpired(media),
    is_dealer_retained: isPhoto,
    deletion_record:    undefined,
  };
}
