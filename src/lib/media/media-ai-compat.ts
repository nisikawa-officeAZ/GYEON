// GYEON Business Hub — Media Asset Center: AI Compatibility Registry (Sprint 12E)
//
// Defines AI compatibility modes for the Media Asset Center.
//
// The existing media-ai.ts (Sprint 10J) defines:
//   MediaAICapabilityType = "ai_analysis" | "ai_marketing"
//   Gate functions for marketing_agent, reputation_agent, growth_agent
//
// Sprint 12E extends the AI compatibility model to cover all 6 planned AI workflows:
//   ai_image_generation, ai_video_generation, ai_caption_generation,
//   ocr_processing, review_image, marketing_asset
//
// Each compatibility mode describes:
//   - Which AI agents handle it
//   - Which media asset types are compatible
//   - What consent and approval requirements apply
//   - What the execution path will be in Sprint 13+
//
// This module does NOT replace media-ai.ts — it extends it at the registry level.
// No AI execution. No provider calls. No real AI processing.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { MediaAssetTypeId } from "./media-asset-type-registry";

// ─── Shared type references ───────────────────────────────────────────────────

// Re-declaring locally to avoid circular imports with media-ai.ts
// These mirror the types in @/lib/ai/agents/types and @/lib/automation/ai
type AIAgentIdRef =
  | "marketing_agent"
  | "reputation_agent"
  | "growth_agent"
  | "ocr_agent"
  | "review_agent"
  | "line_agent"
  | "seo_agent";

// ─── AI compatibility mode identifier ────────────────────────────────────────

/**
 * MediaAICompatibilityModeId — the 6 AI capability modes for the Media Asset Center.
 *
 * Each mode represents a distinct AI workflow that involves media assets.
 * An asset may be compatible with multiple modes.
 */
export type MediaAICompatibilityModeId =
  | "ai_image_generation"    // Asset is source input or output of AI image generation
  | "ai_video_generation"    // Asset is source input or output of AI video generation
  | "ai_caption_generation"  // Asset is source material for AI caption/text generation
  | "ocr_processing"         // Asset submitted to OCR for text extraction
  | "review_image"           // Asset associated with a customer review workflow
  | "marketing_asset";       // Asset cleared for AI-assisted marketing workflows

// ─── Compatibility descriptor ─────────────────────────────────────────────────

export interface MediaAICompatDescriptor {
  mode_id:                  MediaAICompatibilityModeId;
  display_name:             string;
  description:              string;
  /** AI agents that handle this mode. */
  handling_agents:          AIAgentIdRef[];
  /** Asset types that can be used as SOURCE input in this mode. */
  compatible_source_types:  MediaAssetTypeId[];
  /** Asset types that are produced as OUTPUT in this mode. */
  output_asset_types:       MediaAssetTypeId[];
  /** Whether customer consent is required before AI processing. */
  requires_consent:         boolean;
  /** Whether dealer must approve before AI-generated output is dispatched. */
  requires_dealer_approval: boolean;
  /** Whether the source asset is deleted after processing. */
  deletes_source_after:     boolean;
  /** Whether this mode is currently available for execution. */
  available:                boolean;
  available_since:          string;
  target_sprint:            string;
  /** Compile-time literal — no AI execution in Sprint 12E. */
  execution_deferred:       true;
}

// ─── AI compatibility registry ────────────────────────────────────────────────

export const MEDIA_AI_COMPAT_REGISTRY: MediaAICompatDescriptor[] = [

  {
    mode_id:                  "ai_image_generation",
    display_name:             "AI Image Generation",
    description:
      "Source images from work orders are passed to the marketing_agent to generate " +
      "AI-enhanced or AI-composed marketing images. Source photos require " +
      "visibility = marketing_approved and consent_status = approved. " +
      "Generated output is stored as a separate ai_generated_image asset linked " +
      "to the source via ai_source_media_id.",
    handling_agents:          ["marketing_agent"],
    compatible_source_types:  ["image"],
    output_asset_types:       ["ai_generated_image"],
    requires_consent:         true,
    requires_dealer_approval: true,
    deletes_source_after:     false,   // Source photo is retained
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 13 (execution)",
    target_sprint:            "Sprint 13",
    execution_deferred:       true,
  },

  {
    mode_id:                  "ai_video_generation",
    display_name:             "AI Video Generation",
    description:
      "Completion photos are passed to the marketing_agent to generate a marketing " +
      "video using the video_generation task type. The video storyboard is produced " +
      "first (generate_video_storyboard action), then the actual video is generated " +
      "in Sprint 14. Output is stored as an ai_generated_video with delete_after_download " +
      "lifecycle policy by default.",
    handling_agents:          ["marketing_agent"],
    compatible_source_types:  ["image"],
    output_asset_types:       ["ai_generated_video"],
    requires_consent:         true,
    requires_dealer_approval: true,
    deletes_source_after:     false,
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 14 (execution)",
    target_sprint:            "Sprint 14",
    execution_deferred:       true,
  },

  {
    mode_id:                  "ai_caption_generation",
    display_name:             "AI Caption Generation",
    description:
      "Media context (photo description, service type, vehicle details) is passed to " +
      "the marketing_agent or line_agent to generate text captions, LINE messages, " +
      "or SNS post bodies. The asset itself is not sent to the AI provider — " +
      "only metadata and context. Maps to generate_ai_caption and generate_sns_post " +
      "in the Automation AI Gateway Bridge.",
    handling_agents:          ["marketing_agent", "line_agent"],
    compatible_source_types:  ["image", "video"],
    output_asset_types:       [],   // Text output — not stored as a media asset
    requires_consent:         false,
    requires_dealer_approval: true,
    deletes_source_after:     false,
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 13 (execution)",
    target_sprint:            "Sprint 13",
    execution_deferred:       true,
  },

  {
    mode_id:                  "ocr_processing",
    display_name:             "OCR Text Extraction",
    description:
      "A source image or PDF is submitted to the ocr_agent for text extraction. " +
      "Used for processing maintenance records, work orders, and paper documentation. " +
      "Source assets should use the ocr_source_image type with " +
      "delete_after_ai_processing lifecycle policy. Output is structured text data, " +
      "not a media asset.",
    handling_agents:          ["ocr_agent"],
    compatible_source_types:  ["ocr_source_image", "pdf", "image"],
    output_asset_types:       [],   // Text/JSON output — not a media asset
    requires_consent:         false,
    requires_dealer_approval: false,
    deletes_source_after:     true,   // ocr_source_image deleted after processing
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 13 (OCR integration)",
    target_sprint:            "Sprint 13",
    execution_deferred:       true,
  },

  {
    mode_id:                  "review_image",
    display_name:             "Review / Reputation Image",
    description:
      "A media asset used in a review or reputation management workflow. " +
      "Processed by the reputation_agent or review_agent for sentiment context. " +
      "Typically: a photo of the completed work accompanying a review request. " +
      "Must have visibility >= customer_visible and consent_status != denied.",
    handling_agents:          ["reputation_agent", "review_agent"],
    compatible_source_types:  ["image"],
    output_asset_types:       [],   // No media output — feeds review workflow
    requires_consent:         false,
    requires_dealer_approval: true,
    deletes_source_after:     false,
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 13 (reputation integration)",
    target_sprint:            "Sprint 13",
    execution_deferred:       true,
  },

  {
    mode_id:                  "marketing_asset",
    display_name:             "Marketing Asset",
    description:
      "A media asset cleared for use in AI-assisted marketing workflows. " +
      "Requires the full three-gate check: visibility = marketing_approved, " +
      "consent_status = approved, is_marketing_approved = true. " +
      "Extends the existing 'ai_marketing' capability in media-capability.ts. " +
      "Compatible with the marketing_agent for caption, SNS post, and AI image generation.",
    handling_agents:          ["marketing_agent", "seo_agent"],
    compatible_source_types:  ["image", "video"],
    output_asset_types:       ["ai_generated_image", "ai_generated_video"],
    requires_consent:         true,
    requires_dealer_approval: true,
    deletes_source_after:     false,
    available:                false,
    available_since:          "Sprint 12E (declared) / Sprint 13 (execution)",
    target_sprint:            "Sprint 13",
    execution_deferred:       true,
  },

] as const satisfies MediaAICompatDescriptor[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getAICompatDescriptor(
  mode_id: MediaAICompatibilityModeId,
): MediaAICompatDescriptor | undefined {
  return MEDIA_AI_COMPAT_REGISTRY.find(m => m.mode_id === mode_id);
}

export function getCompatibleModesForAssetType(
  type_id: MediaAssetTypeId,
): MediaAICompatDescriptor[] {
  return MEDIA_AI_COMPAT_REGISTRY.filter(
    m => m.compatible_source_types.includes(type_id),
  );
}

export function getModesRequiringConsent(): MediaAICompatDescriptor[] {
  return MEDIA_AI_COMPAT_REGISTRY.filter(m => m.requires_consent);
}

export function getModesRequiringApproval(): MediaAICompatDescriptor[] {
  return MEDIA_AI_COMPAT_REGISTRY.filter(m => m.requires_dealer_approval);
}

export function getModesForAgent(agent_id: AIAgentIdRef): MediaAICompatDescriptor[] {
  return MEDIA_AI_COMPAT_REGISTRY.filter(m => m.handling_agents.includes(agent_id));
}

export function getAICompatModeIds(): MediaAICompatibilityModeId[] {
  return MEDIA_AI_COMPAT_REGISTRY.map(m => m.mode_id);
}
