// DealerOS — Media Validation
//
// Sprint 10J: centralized MIME type, file size, and upload policy validation.
// Pure logic — no Supabase calls, no external API calls.
// Works in both server and client contexts.
//
// Security:
//   - Policy objects define what is allowed; validation never bypasses them.
//   - VIDEO upload policy is disabled by default until Phase 10K infrastructure review.

import type { MediaType, MediaFileInput } from "./media-types";
import {
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  CURRENT_MAX_UPLOAD_BYTES,
  VIDEO_TARGET_MAX_UPLOAD_BYTES,
} from "./media-types";

// Re-export MediaFileInput so consumers can import from either location.
export type { MediaFileInput };

// ─── Upload policy ────────────────────────────────────────────────────────────

export interface MediaUploadPolicy {
  /** MIME types accepted by this policy. */
  allowed_mime_types:   readonly string[];
  /** Hard ceiling for any single file upload under this policy. */
  max_file_size_bytes:  number;
  /** Whether video MIME types are accepted at all. */
  allow_video:          boolean;
  /** Per-video size ceiling when allow_video is true. Ignored otherwise. */
  max_video_size_bytes: number;
}

/**
 * Current production policy — photos only, 20 MB hard limit.
 * Video upload is intentionally disabled until Phase 10K infrastructure is approved.
 */
export const CURRENT_PHOTO_UPLOAD_POLICY: MediaUploadPolicy = {
  allowed_mime_types:   PHOTO_MIME_TYPES,
  max_file_size_bytes:  CURRENT_MAX_UPLOAD_BYTES,  // 20 MB
  allow_video:          false,
  max_video_size_bytes: 0,
};

/** Alias for the current enforced upload policy. */
export const CURRENT_UPLOAD_POLICY: MediaUploadPolicy = CURRENT_PHOTO_UPLOAD_POLICY;

/**
 * Future policy after Phase 10K infrastructure review and CTO approval.
 * DO NOT activate without completing VIDEO_INFRA_REQUIREMENTS in media-video.ts.
 */
export const FUTURE_VIDEO_UPLOAD_POLICY: MediaUploadPolicy = {
  allowed_mime_types:   [...PHOTO_MIME_TYPES, ...VIDEO_MIME_TYPES],
  max_file_size_bytes:  VIDEO_TARGET_MAX_UPLOAD_BYTES,  // 500 MB
  allow_video:          true,
  max_video_size_bytes: VIDEO_TARGET_MAX_UPLOAD_BYTES,
};

// ─── Validation result ────────────────────────────────────────────────────────

export type MediaValidationErrorCode =
  | "file_too_large"
  | "mime_type_not_allowed"
  | "media_type_not_detected"
  | "video_upload_not_enabled"
  | "file_name_missing";

export interface MediaValidationError {
  code:    MediaValidationErrorCode;
  message: string;
}

export interface MediaValidationResult {
  valid:       boolean;
  media_type?: MediaType;
  mime_type:   string;
  file_name:   string;
  file_size:   number;
  errors:      MediaValidationError[];
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates a file against an upload policy.
 * Returns a typed result — never throws.
 *
 * Usage:
 *   const result = validateMediaFile({ name: f.name, size: f.size, type: f.type });
 *   if (!result.valid) show(result.errors[0].message);
 */
export function validateMediaFile(
  file: MediaFileInput,
  policy: MediaUploadPolicy = CURRENT_UPLOAD_POLICY,
): MediaValidationResult {
  const errors: MediaValidationError[] = [];

  if (!file.name) {
    errors.push({
      code:    "file_name_missing",
      message: "File name is required.",
    });
  }

  const detectedType = detectMediaType(file.type, file.name);
  const normalizedMime = file.type.toLowerCase();

  if (detectedType === "video" && !policy.allow_video) {
    errors.push({
      code:    "video_upload_not_enabled",
      message:
        "Video upload is not available yet. Maximum file size is 20 MB. " +
        "Video support will be enabled in a future update.",
    });
  } else if (!(policy.allowed_mime_types as readonly string[]).includes(normalizedMime)) {
    errors.push({
      code:    "mime_type_not_allowed",
      message: `File type "${file.type}" is not accepted. Allowed types: ${policy.allowed_mime_types.join(", ")}.`,
    });
  }

  const sizeLimit =
    detectedType === "video" && policy.allow_video
      ? policy.max_video_size_bytes
      : policy.max_file_size_bytes;

  if (file.size > sizeLimit) {
    const limitMb = (sizeLimit / (1024 * 1024)).toFixed(0);
    const fileMb  = (file.size / (1024 * 1024)).toFixed(1);
    errors.push({
      code:    "file_too_large",
      message: `File size ${fileMb} MB exceeds the ${limitMb} MB limit.`,
    });
  }

  return {
    valid:      errors.length === 0,
    media_type: detectedType ?? undefined,
    mime_type:  file.type,
    file_name:  file.name,
    file_size:  file.size,
    errors,
  };
}

// ─── MIME type helpers ────────────────────────────────────────────────────────

/** Returns true if the MIME type is a supported photo format. */
export function isPhotoMimeType(mimeType: string): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** Returns true if the MIME type is a supported video format. */
export function isVideoMimeType(mimeType: string): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** Returns true if the MIME type is any supported media format (photo or video). */
export function isMediaMimeType(mimeType: string): boolean {
  return isPhotoMimeType(mimeType) || isVideoMimeType(mimeType);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function detectMediaType(mimeType: string, fileName: string): MediaType | null {
  const mime = mimeType.toLowerCase();

  if (mime.startsWith("image/") || isPhotoMimeType(mime)) return "photo";
  if (mime.startsWith("video/") || isVideoMimeType(mime)) return "video";

  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext)) return "photo";
  if (["mp4", "mov", "avi", "webm", "m4v", "3gp"].includes(ext))           return "video";

  return null;
}
