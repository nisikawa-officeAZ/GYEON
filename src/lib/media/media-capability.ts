// DealerOS — Media Capability Registry
//
// Sprint 10J: canonical registry of all media processing capabilities.
// Records what each capability does, which media types it supports,
// whether it is available now, and what blocks it when unavailable.
//
// No runtime processing. Registry only.
// Consumers check available_now before attempting any operation.

import type { MediaType } from "./media-types";
import type { AppFeature } from "@/lib/plans/plan-types";

// ─── Capability identity ──────────────────────────────────────────────────────

export type MediaCapabilityId =
  | "preview"           // In-app inline preview (photos: <img>; videos: placeholder)
  | "download"          // Direct file download via signed URL
  | "thumbnail"         // Server-generated thumbnail image
  | "streaming"         // Adaptive video streaming (HLS)
  | "ai_analysis"       // AI visual analysis — quality scoring, defect detection
  | "ai_marketing"      // AI content generation — captions, hashtags, posts
  | "customer_gallery"  // Customer-facing media gallery (portal)
  | "completion_report"; // Inclusion in printable completion reports

// ─── Capability entry ─────────────────────────────────────────────────────────

export interface MediaCapabilityEntry {
  id:               MediaCapabilityId;
  label:            string;
  description:      string;
  supported_types:  MediaType[];
  available_now:    boolean;
  requires_feature?: AppFeature;
  phase:            string;
  blocked_by?:      string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MEDIA_CAPABILITY_REGISTRY: MediaCapabilityEntry[] = [
  {
    id:              "preview",
    label:           "In-app preview",
    description:
      "Photos render inline as <img>. Videos render as a placeholder card with video icon. " +
      "Full video player requires Phase 10K streaming infrastructure.",
    supported_types: ["photo", "video"],
    available_now:   true,
    phase:           "Sprint 10I",
  },
  {
    id:              "download",
    label:           "Direct file download",
    description:     "Generates a signed URL for direct download. Respects dealer_id isolation.",
    supported_types: ["photo", "video"],
    available_now:   true,
    phase:           "Sprint 10I",
  },
  {
    id:              "thumbnail",
    label:           "Server-generated thumbnail",
    description:
      "Server-side extraction of a JPEG thumbnail. " +
      "Photos: resized to 480px width. Videos: first-frame JPEG.",
    supported_types: ["photo", "video"],
    available_now:   false,
    phase:           "Phase 10J",
    blocked_by:
      "Thumbnail generation service not implemented. " +
      "Requires server-side image resizing and video first-frame extraction.",
  },
  {
    id:              "streaming",
    label:           "Adaptive video streaming (HLS)",
    description:
      "HLS adaptive bitrate streaming via CDN. " +
      "Segments video into chunks for smooth playback on variable connections.",
    supported_types: ["video"],
    available_now:   false,
    phase:           "Phase 10K",
    blocked_by:
      "HLS transcoding pipeline and CDN configuration required. " +
      "See VIDEO_INFRA_REQUIREMENTS in media-video.ts.",
  },
  {
    id:               "ai_analysis",
    label:            "AI visual analysis",
    description:
      "AI-powered quality scoring, defect detection, and scene understanding. " +
      "Requires consent_status = approved and visibility >= customer_visible.",
    supported_types:  ["photo", "video"],
    available_now:    false,
    requires_feature: "ai_marketing" as AppFeature,
    phase:            "Phase 71–72",
    blocked_by:
      "AI Marketing Agent Phase G-B required. " +
      "External AI provider calls are gated behind AI Gateway activation.",
  },
  {
    id:               "ai_marketing",
    label:            "AI marketing content generation",
    description:
      "Generates SNS captions, hashtags, and platform posts from approved media. " +
      "Requires visibility = marketing_approved, consent = approved, is_marketing_approved = true.",
    supported_types:  ["photo", "video"],
    available_now:    false,
    requires_feature: "ai_marketing" as AppFeature,
    phase:            "Phase 71–76",
    blocked_by:
      "AI Marketing Agent not yet active. " +
      "Phase G-B runtime adapters required.",
  },
  {
    id:              "customer_gallery",
    label:           "Customer-facing media gallery",
    description:
      "Customer portal where clients can view their vehicle's photo and video history. " +
      "Requires consent_status = approved for each shared asset.",
    supported_types: ["photo", "video"],
    available_now:   false,
    phase:           "Future — Customer Portal",
    blocked_by:      "Customer portal not yet implemented.",
  },
  {
    id:              "completion_report",
    label:           "Completion report inclusion",
    description:
      "Photos appear inline in the printable completion report. " +
      "Videos render as a placeholder (PDF cannot embed video). " +
      "Requires is_public = true on the work_order_files record.",
    supported_types: ["photo", "video"],
    available_now:   true,
    phase:           "Sprint 10I",
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the capability entry for the given ID, or undefined if not found. */
export function getMediaCapability(id: MediaCapabilityId): MediaCapabilityEntry | undefined {
  return MEDIA_CAPABILITY_REGISTRY.find((c) => c.id === id);
}

/** Returns all capabilities that support the given media type. */
export function getCapabilitiesForType(mediaType: MediaType): MediaCapabilityEntry[] {
  return MEDIA_CAPABILITY_REGISTRY.filter((c) => c.supported_types.includes(mediaType));
}

/** Returns only capabilities that are currently available (available_now = true). */
export function getAvailableCapabilities(): MediaCapabilityEntry[] {
  return MEDIA_CAPABILITY_REGISTRY.filter((c) => c.available_now);
}

/** Returns capabilities that are blocked and lists the reasons. */
export function getBlockedCapabilities(): MediaCapabilityEntry[] {
  return MEDIA_CAPABILITY_REGISTRY.filter((c) => !c.available_now && c.blocked_by !== undefined);
}
