// GYEON Business Hub — Media Asset Center: Asset Type Registry (Sprint 12E)
//
// Defines the complete catalog of media asset types supported by the Media Asset Center.
//
// Sprint 10I/10J/10L established MediaType = "photo" | "video" (2 types).
// Sprint 12E extends the type model to cover all current and planned asset categories:
//   9 types total — images, videos, AI-generated content, PDFs, OCR sources,
//   attachments, voice recordings, and future 3D assets.
//
// Design:
//   MediaAssetTypeId   — new union type (superset of existing MediaType)
//   MediaOwnerType     — formal ownership model (dealer / customer / system)
//   MediaAssetTypeDescriptor — metadata entry per type (MEDIA_ASSET_TYPE_REGISTRY)
//
// Backward compatibility:
//   Existing MediaType ("photo" | "video") is preserved unchanged.
//   MediaAssetTypeId includes all MediaType values — no migration required.
//
// No storage implementation. No uploads. No external API calls. Registry only.
//
// Pure — no "use server", no async, no DB calls, no execution.

// ─── Extended media asset type identifier ─────────────────────────────────────

/**
 * MediaAssetTypeId — full catalog of media asset types supported by the Media Asset Center.
 *
 * Superset of the legacy MediaType ("photo" | "video").
 * Each type maps to an entry in MEDIA_ASSET_TYPE_REGISTRY.
 */
export type MediaAssetTypeId =
  | "image"                // General photograph (JPEG, PNG, WEBP, HEIC, HEIF)
  | "video"                // General video recording (MP4, MOV, WEBM, AVI)
  | "ai_generated_image"   // Image created by AI generation pipeline (Stable Diffusion, etc.)
  | "ai_generated_video"   // Video created by AI generation pipeline (Sprint 14+)
  | "pdf"                  // PDF document (estimates, invoices, completion reports, manuals)
  | "ocr_source_image"     // Image or scan submitted specifically for OCR text extraction
  | "attachment"           // General file attachment (CSV, XLSX, other non-media files)
  | "voice"                // Voice recording or audio message (LINE voice note, etc.)
  | "3d_asset";            // Future 3D asset (GLTF, OBJ, USDZ) — Sprint 15+

// ─── Owner model ──────────────────────────────────────────────────────────────

/**
 * MediaOwnerType — which entity class created or owns the asset.
 *
 * Note: individual owner identity is tracked via owner_id (FK to customer/dealer/system).
 * MediaOwnerType is the entity class — not the specific person.
 */
export type MediaOwnerType =
  | "dealer"    // Created by or for the dealer shop (staff uploads, shop branding)
  | "customer"  // Provided by or associated with a specific customer
  | "system";   // Created by the platform itself (AI generation outputs, thumbnails)

// ─── Asset type descriptor ────────────────────────────────────────────────────

export interface MediaAssetTypeDescriptor {
  type_id:               MediaAssetTypeId;
  display_name:          string;
  description:           string;
  /** MIME types accepted for this asset type. Empty = no MIME restriction yet. */
  allowed_mime_types:    string[];
  /** Maximum upload size in MB. null = limit not yet defined. */
  max_upload_mb:         number | null;
  /** Whether an inline preview can be shown in the web UI (Sprint 10I+). */
  supports_preview:      boolean;
  /** Whether this asset type supports thumbnail generation (Sprint 10J+). */
  supports_thumbnail:    boolean;
  /** Whether this asset can be processed by an AI agent. */
  ai_processable:        boolean;
  /** Whether this asset type is typically customer-facing. */
  customer_facing:       boolean;
  /** Whether this type may be used in marketing/SNS workflows. */
  marketing_eligible:    boolean;
  /** Typical owner class for this type. */
  default_owner:         MediaOwnerType;
  /** True if the type is fully supported in the current sprint. */
  available:             boolean;
  available_since:       string;
  /** Sprint when storage and upload support will be added. */
  target_storage_sprint: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MEDIA_ASSET_TYPE_REGISTRY: MediaAssetTypeDescriptor[] = [

  {
    type_id:               "image",
    display_name:          "Photo / Image",
    description:
      "General photograph or image — the primary media type for work documentation. " +
      "Used in work order photo galleries, completion reports, before/after documentation, " +
      "vehicle profiles, and marketing campaigns. Supports JPEG, PNG, WEBP, HEIC, HEIF.",
    allowed_mime_types:    [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif",
    ],
    max_upload_mb:         20,
    supports_preview:      true,
    supports_thumbnail:    true,
    ai_processable:        true,
    customer_facing:       true,
    marketing_eligible:    true,
    default_owner:         "dealer",
    available:             true,
    available_since:       "Sprint 10I",
    target_storage_sprint: "Sprint 10I (active)",
  },

  {
    type_id:               "video",
    display_name:          "Video",
    description:
      "Video recording — supports work process documentation, before/after videos, " +
      "and AI marketing video source material. Storage infrastructure is planned " +
      "(Phase 10K). Accepts MP4, QuickTime, WEBM, AVI, M4V, 3GPP.",
    allowed_mime_types:    [
      "video/mp4", "video/quicktime", "video/webm",
      "video/avi", "video/x-m4v", "video/3gpp",
    ],
    max_upload_mb:         500,
    supports_preview:      false,     // Full video player deferred to Phase 10K
    supports_thumbnail:    false,     // First-frame thumbnail deferred to Phase 10J
    ai_processable:        true,
    customer_facing:       true,
    marketing_eligible:    true,
    default_owner:         "dealer",
    available:             true,
    available_since:       "Sprint 10I",
    target_storage_sprint: "Phase 10K (HLS infrastructure required)",
  },

  {
    type_id:               "ai_generated_image",
    display_name:          "AI Generated Image",
    description:
      "Image created by an AI image generation pipeline. Currently produced by the " +
      "AI Photo AI workflow using the marketing_agent. Requires dealer approval before " +
      "marketing use. Always ai_generated = true on the DealerMedia record.",
    allowed_mime_types:    ["image/jpeg", "image/png", "image/webp"],
    max_upload_mb:         null,    // Not uploaded — generated internally
    supports_preview:      true,
    supports_thumbnail:    true,
    ai_processable:        false,   // Is AI output — not submitted for further AI processing
    customer_facing:       false,   // Requires dealer approval first
    marketing_eligible:    true,
    default_owner:         "system",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 13 (generation)",
    target_storage_sprint: "Sprint 13",
  },

  {
    type_id:               "ai_generated_video",
    display_name:          "AI Generated Video",
    description:
      "Video created by an AI video generation pipeline using job completion photos " +
      "as source material. Generated by the marketing_agent via the video_generation " +
      "task type. Subject to 30-day default retention. Requires dealer download confirmation " +
      "for delete_after_download lifecycle policy.",
    allowed_mime_types:    ["video/mp4"],
    max_upload_mb:         null,    // Not uploaded — generated internally
    supports_preview:      false,
    supports_thumbnail:    false,
    ai_processable:        false,
    customer_facing:       false,   // Dealer publishes manually to SNS
    marketing_eligible:    true,
    default_owner:         "system",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 14 (generation)",
    target_storage_sprint: "Sprint 14",
  },

  {
    type_id:               "pdf",
    display_name:          "PDF Document",
    description:
      "PDF document — covers estimates, invoices, completion reports, maintenance records, " +
      "and any dealer-generated documents. PDFs may be sent to customers via Communication " +
      "Center or attached to work orders and invoices.",
    allowed_mime_types:    ["application/pdf"],
    max_upload_mb:         10,
    supports_preview:      false,   // PDF preview viewer deferred to future sprint
    supports_thumbnail:    false,   // PDF first-page thumbnail deferred
    ai_processable:        true,    // OCR agent can extract text from PDFs
    customer_facing:       true,
    marketing_eligible:    false,
    default_owner:         "dealer",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 13 (storage)",
    target_storage_sprint: "Sprint 13",
  },

  {
    type_id:               "ocr_source_image",
    display_name:          "OCR Source Image",
    description:
      "Image or scan submitted specifically for OCR text extraction by the ocr_agent. " +
      "Used for processing maintenance records, work manuals, and legacy paper documents. " +
      "Default lifecycle: delete_after_ai_processing — source deleted once text is extracted.",
    allowed_mime_types:    [
      "image/jpeg", "image/png", "image/webp", "image/tiff",
      "image/heic", "image/heif", "application/pdf",
    ],
    max_upload_mb:         20,
    supports_preview:      true,
    supports_thumbnail:    false,
    ai_processable:        true,    // Primary purpose is AI OCR processing
    customer_facing:       false,
    marketing_eligible:    false,
    default_owner:         "dealer",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 13 (OCR integration)",
    target_storage_sprint: "Sprint 13",
  },

  {
    type_id:               "attachment",
    display_name:          "File Attachment",
    description:
      "General file attachment not classified as photo, video, or PDF. " +
      "Includes spreadsheets (CSV, XLSX), technical documents, and other business files " +
      "attached to work orders, estimates, or customer communications.",
    allowed_mime_types:    [
      "text/csv", "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    max_upload_mb:         5,
    supports_preview:      false,
    supports_thumbnail:    false,
    ai_processable:        false,
    customer_facing:       true,
    marketing_eligible:    false,
    default_owner:         "dealer",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 13 (storage)",
    target_storage_sprint: "Sprint 13",
  },

  {
    type_id:               "voice",
    display_name:          "Voice Recording",
    description:
      "Voice message or audio recording received via LINE or other messaging channel. " +
      "Used in the Communication Center unified inbox. May be transcribed by the " +
      "line_agent in a future sprint. Short retention window by default (30 days).",
    allowed_mime_types:    ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/m4a"],
    max_upload_mb:         10,
    supports_preview:      false,   // Audio player deferred to future sprint
    supports_thumbnail:    false,
    ai_processable:        false,   // Transcription deferred to Sprint 14
    customer_facing:       false,   // Internal — communication context only
    marketing_eligible:    false,
    default_owner:         "customer",
    available:             false,
    available_since:       "Sprint 12E (declared) / Sprint 14 (audio in Communication Center)",
    target_storage_sprint: "Sprint 14",
  },

  {
    type_id:               "3d_asset",
    display_name:          "3D Asset (Planned)",
    description:
      "Future 3D model asset — GLTF, OBJ, or USDZ format. " +
      "Intended for vehicle exterior 3D documentation and AR visualization in the " +
      "customer portal. Not a committed roadmap item — subject to CTO approval " +
      "and demand validation in Sprint 15+.",
    allowed_mime_types:    ["model/gltf-binary", "model/gltf+json", "model/obj"],
    max_upload_mb:         null,
    supports_preview:      false,
    supports_thumbnail:    false,
    ai_processable:        false,
    customer_facing:       false,
    marketing_eligible:    false,
    default_owner:         "dealer",
    available:             false,
    available_since:       "Sprint 12E (planned) / Sprint 15+ (subject to demand)",
    target_storage_sprint: "Sprint 15+",
  },

] as const satisfies MediaAssetTypeDescriptor[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getAssetTypeDescriptor(
  type_id: MediaAssetTypeId,
): MediaAssetTypeDescriptor | undefined {
  return MEDIA_ASSET_TYPE_REGISTRY.find(t => t.type_id === type_id);
}

export function getAssetTypesByOwner(
  owner: MediaOwnerType,
): MediaAssetTypeDescriptor[] {
  return MEDIA_ASSET_TYPE_REGISTRY.filter(t => t.default_owner === owner);
}

export function getAIProcessableTypes(): MediaAssetTypeDescriptor[] {
  return MEDIA_ASSET_TYPE_REGISTRY.filter(t => t.ai_processable);
}

export function getMarketingEligibleTypes(): MediaAssetTypeDescriptor[] {
  return MEDIA_ASSET_TYPE_REGISTRY.filter(t => t.marketing_eligible);
}

export function getAvailableAssetTypes(): MediaAssetTypeDescriptor[] {
  return MEDIA_ASSET_TYPE_REGISTRY.filter(t => t.available);
}

export function getPlannedAssetTypes(): MediaAssetTypeDescriptor[] {
  return MEDIA_ASSET_TYPE_REGISTRY.filter(t => !t.available);
}

export function getAllAssetTypeIds(): MediaAssetTypeId[] {
  return MEDIA_ASSET_TYPE_REGISTRY.map(t => t.type_id);
}
