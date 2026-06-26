// GYEON Business Hub — Media Asset Center: Platform Integration Bridge (Sprint 12E)
//
// Defines the architecture for Media Asset Center integration with all platform modules.
//
// The Media Asset Center is the shared media platform for all GYEON Business Hub
// applications. This module declares the integration points — what each module
// can do with media, which asset types it supports, and what constraints apply.
//
// Platform integration points (Phase F spec):
//   1. Communication Center   — media in messages, channel attachments
//   2. Automation Center      — media-triggered workflows, AI content from media
//   3. AI Marketplace         — AI agents consuming and producing media
//   4. Dealer Agent           — media in job documentation, completion reports
//   5. GYEON Distribution     — product media in distribution orders
//
// Dependency direction (non-negotiable):
//   media/ → communication/, automation/, ai/, subscription/
//   These modules do NOT import from media/ — dependency is one-way.
//
// Architecture only. No runtime calls. No execution.
// Pure — no "use server", no async, no DB calls, no external calls.

import type { MediaAssetTypeId }         from "./media-asset-type-registry";
import type { MediaUsageContextId }       from "./media-usage-registry";
import type { MediaAICompatibilityModeId } from "./media-ai-compat";
import type { MediaLifecyclePolicyId }    from "./media-policy";

// ─── Platform integration identifier ─────────────────────────────────────────

/**
 * MediaPlatformIntegrationId — the 5 GYEON platform modules that integrate with Media.
 */
export type MediaPlatformIntegrationId =
  | "communication_center"  // Unified inbox, channel messaging, media attachments
  | "automation_center"     // Trigger-based workflows involving media assets
  | "ai_marketplace"        // AI agents producing and consuming media
  | "dealer_agent"          // Job documentation, completion reports, customer gallery
  | "gyeon_distribution";   // Product catalog media for GYEON distribution orders

// ─── Integration access level ─────────────────────────────────────────────────

/**
 * How a platform module interacts with the Media Asset Center.
 * A module may have multiple access levels simultaneously.
 */
export type MediaAccessLevel =
  | "read"     // Can query and display media assets
  | "write"    // Can upload or create new media assets
  | "link"     // Can create associations between media and entities
  | "approve"  // Can approve media for higher visibility levels
  | "delete"   // Can soft-delete or trigger retention policy enforcement
  | "generate"; // Can trigger AI media generation workflows

// ─── Integration entry ────────────────────────────────────────────────────────

export interface MediaPlatformIntegration {
  integration_id:      MediaPlatformIntegrationId;
  display_name:        string;
  description:         string;
  /** How this module interacts with media. */
  access_levels:       MediaAccessLevel[];
  /** Asset types this module uses. */
  supported_asset_types: MediaAssetTypeId[];
  /** Usage contexts this module creates or reads. */
  supported_contexts:  MediaUsageContextId[];
  /** AI compatibility modes this module invokes. */
  ai_modes:            MediaAICompatibilityModeId[];
  /** Lifecycle policies applied to media created by this module. */
  applied_policies:    MediaLifecyclePolicyId[];
  requires_consent:    boolean;   // Whether the integration requires customer consent
  requires_approval:   boolean;   // Whether dealer must approve media for this integration
  available:           boolean;
  target_sprint:       string;
  /** Architecture is declared. Execution is deferred. */
  execution_deferred:  true;
}

// ─── Integration registry ──────────────────────────────────────────────────────

export const MEDIA_PLATFORM_INTEGRATIONS: MediaPlatformIntegration[] = [

  {
    integration_id:      "communication_center",
    display_name:        "Communication Center",
    description:
      "The Communication Center uses the Media Asset Center for all media exchanged " +
      "in customer conversations. Inbound LINE images, WhatsApp media, email attachments, " +
      "and voice messages are stored as Media Assets with usage_context = 'communication'. " +
      "Outbound media (AI-generated captions, completion photos) are dispatched to " +
      "the channel via Communication Center after dealer approval. " +
      "Full integration in Sprint 13.",
    access_levels:         ["read", "write", "link", "approve"],
    supported_asset_types: ["image", "video", "pdf", "attachment", "voice"],
    supported_contexts:    ["communication"],
    ai_modes:              ["ai_caption_generation"],
    applied_policies:      ["retention_30d", "permanent"],
    requires_consent:      true,
    requires_approval:     true,
    available:             false,
    target_sprint:         "Sprint 13",
    execution_deferred:    true,
  },

  {
    integration_id:      "automation_center",
    display_name:        "Automation Center",
    description:
      "The Automation Center uses the Media Asset Center to trigger workflows from " +
      "media events (e.g., a completion photo being uploaded triggers a review request " +
      "workflow) and to supply media context to AI Gateway Bridge actions. " +
      "Automation workflows may request AI caption generation using media as context. " +
      "No media is created by automation — only read and linked. " +
      "Integration via Automation AI Gateway Bridge (Sprint 12D). Execution in Sprint 13.",
    access_levels:         ["read", "link"],
    supported_asset_types: ["image", "video", "ai_generated_image"],
    supported_contexts:    ["work_order", "completion_report", "ai_generation"],
    ai_modes:              ["ai_caption_generation", "marketing_asset"],
    applied_policies:      [],
    requires_consent:      false,
    requires_approval:     false,
    available:             false,
    target_sprint:         "Sprint 13",
    execution_deferred:    true,
  },

  {
    integration_id:      "ai_marketplace",
    display_name:        "AI Marketplace",
    description:
      "The AI Marketplace (AI agents) is the primary consumer and producer of media. " +
      "marketing_agent:  reads approved images → generates AI images, videos, captions. " +
      "reputation_agent: reads review images → sentiment and quality analysis. " +
      "growth_agent:     reads aggregate media counts → growth opportunity analysis. " +
      "ocr_agent:        reads OCR source images → text extraction (deletes source). " +
      "All AI access is gated by checkMediaAICapability() from media-ai.ts. " +
      "No AI execution in Sprint 12E.",
    access_levels:         ["read", "generate"],
    supported_asset_types: [
      "image", "video", "ocr_source_image",
      "ai_generated_image", "ai_generated_video",
    ],
    supported_contexts:    ["ai_generation", "marketing_campaign"],
    ai_modes:              [
      "ai_image_generation", "ai_video_generation",
      "ai_caption_generation", "ocr_processing",
      "review_image", "marketing_asset",
    ],
    applied_policies:      [
      "delete_after_ai_processing", "delete_after_download", "retention_30d",
    ],
    requires_consent:      true,
    requires_approval:     true,
    available:             false,
    target_sprint:         "Sprint 13",
    execution_deferred:    true,
  },

  {
    integration_id:      "dealer_agent",
    display_name:        "Dealer Agent (GYEON Business Hub Core)",
    description:
      "The Dealer Agent is the primary creator of media assets. Staff upload work order " +
      "photos and videos during job documentation. The completion report module uses media " +
      "to build printable reports. Customer-facing completion photos are gated by " +
      "visibility = customer_visible. Marketing-eligible photos require the three-gate " +
      "consent check. The Dealer Agent owns the full upload, approval, and association workflow.",
    access_levels:         ["read", "write", "link", "approve", "delete"],
    supported_asset_types: [
      "image", "video", "pdf", "attachment",
      "ai_generated_image", "ai_generated_video",
    ],
    supported_contexts:    [
      "customer", "vehicle", "estimate", "work_order",
      "completion_report", "invoice", "marketing_campaign",
    ],
    ai_modes:              ["ai_caption_generation", "marketing_asset"],
    applied_policies:      ["permanent", "retention_30d", "dealer_defined", "legal_hold"],
    requires_consent:      true,
    requires_approval:     false,   // Dealer IS the approver
    available:             true,
    target_sprint:         "Sprint 10I (active)",
    execution_deferred:    true,
  },

  {
    integration_id:      "gyeon_distribution",
    display_name:        "GYEON Distribution",
    description:
      "The GYEON Distribution module uses the Media Asset Center for product catalog " +
      "images and distribution order documentation. Product photos are created by GYEON " +
      "or distributor staff and associated with distribution_order context. " +
      "Enterprise Distribution Application only — requires enterprise_distribution plan entitlement. " +
      "Not customer-facing from the Distribution module's perspective.",
    access_levels:         ["read", "link"],
    supported_asset_types: ["image", "pdf", "attachment"],
    supported_contexts:    ["distribution_order"],
    ai_modes:              [],
    applied_policies:      ["permanent"],
    requires_consent:      false,
    requires_approval:     false,
    available:             false,
    target_sprint:         "Sprint 15+",
    execution_deferred:    true,
  },

] as const satisfies MediaPlatformIntegration[];

// ─── Module manifest ──────────────────────────────────────────────────────────

export const MEDIA_ASSET_CENTER_MANIFEST = {
  module_id:        "media_asset_center",
  display_name:     "Media Asset Center",
  description:
    "Shared media platform for all GYEON Business Hub applications. " +
    "Provides canonical media types, lifecycle policies, usage contexts, " +
    "AI compatibility, and platform integration architecture.",
  version:          "0.2.0",
  implemented_in:   ["Sprint 10I", "Sprint 10J", "Sprint 10L", "Sprint 12E"],
  status:           "foundation",
  total_asset_types: 9,
  total_policies:   6,
  total_contexts:   10,
  total_ai_modes:   6,
  total_integrations: 5,
  execution_deferred: true as const,
} as const;

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getPlatformIntegration(
  integration_id: MediaPlatformIntegrationId,
): MediaPlatformIntegration | undefined {
  return MEDIA_PLATFORM_INTEGRATIONS.find(i => i.integration_id === integration_id);
}

export function getIntegrationsForAssetType(
  type_id: MediaAssetTypeId,
): MediaPlatformIntegration[] {
  return MEDIA_PLATFORM_INTEGRATIONS.filter(
    i => i.supported_asset_types.includes(type_id),
  );
}

export function getIntegrationsForContext(
  context_id: MediaUsageContextId,
): MediaPlatformIntegration[] {
  return MEDIA_PLATFORM_INTEGRATIONS.filter(
    i => i.supported_contexts.includes(context_id),
  );
}

export function getAvailableIntegrations(): MediaPlatformIntegration[] {
  return MEDIA_PLATFORM_INTEGRATIONS.filter(i => i.available);
}

export function getPlannedIntegrations(): MediaPlatformIntegration[] {
  return MEDIA_PLATFORM_INTEGRATIONS.filter(i => !i.available);
}

export function getIntegrationIds(): MediaPlatformIntegrationId[] {
  return MEDIA_PLATFORM_INTEGRATIONS.map(i => i.integration_id);
}
