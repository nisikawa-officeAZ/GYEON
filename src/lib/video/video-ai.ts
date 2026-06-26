// DealerOS — AI Video Pipeline Compatibility Layer
//
// Sprint 11B Phase E: provider-agnostic AI compatibility for the video pipeline.
//
// This module defines the AI request/response envelope and provider capability
// registry for the AI Video Pipeline. It is designed to plug into the AI Gateway
// (AI_GATEWAY_SPEC.md) without changing the pipeline architecture.
//
// Architecture:
//   VideoProject → toVideoProjectForAI() gate → VideoAIRequest → AI Gateway → VideoAIResponse
//
// Provider-agnostic design:
//   - VideoAIProviderId covers all current and future providers
//   - VIDEO_AI_PROVIDER_REGISTRY documents each provider's capabilities and status
//   - No provider SDK is imported; no API calls are made from this module
//   - The gateway handles provider selection and routing at runtime
//
// Phase E scope:
//   - VideoAIRequest: canonical request envelope (not executed)
//   - VideoAIResponse: canonical response envelope (not parsed yet)
//   - VIDEO_AI_PROVIDER_REGISTRY: 8 providers, all available_now = false
//   - AGENT_VIDEO_CAPABILITIES: which AI agents can trigger video pipeline steps
//   - toVideoProjectForAI(): gate function (validates consent + policy before AI access)
//
// No AI inference, no API calls, no runtime video generation in this module.
//
// Relationship to AI Gateway:
//   The AI Gateway (src/lib/ai-gateway/) handles provider routing, key management,
//   and AES-256-GCM encrypted secrets. This module only defines the contract.
//   See AI_GATEWAY_SPEC.md for gateway implementation details.

import type { MediaForAI, MediaAICapabilityRequest }    from "@/lib/media";
import { checkMediaAICapability }                      from "@/lib/media";
import type { AIAgentId }                              from "@/lib/ai/agents/types";
import type {
  VideoAIProviderId,
  VideoAICapabilityType,
  VideoPublishingProfileId,
  VideoPolicy,
} from "./video-types";
import type { VideoSource }              from "./video-source";
import { allSourcesPermittedForMarketing } from "./video-source";
import type { VideoProject }             from "./video-project";
import { toVideoProjectForStoryboard }   from "./video-project";

// ─── Provider capability registry ────────────────────────────────────────────

/**
 * VideoAIProviderCapability — what a specific AI provider can do in the pipeline.
 * All providers have available_now = false until AI Gateway integration is complete.
 */
export interface VideoAIProviderCapability {
  provider_id:              VideoAIProviderId;
  label:                    string;
  supported_capabilities:   VideoAICapabilityType[];
  /** Maximum output video duration in seconds. Null if no hard limit. */
  max_output_duration_seconds: number | null;
  /** Maximum number of source media inputs per request. Null if no hard limit. */
  max_input_media_count:    number | null;
  supported_aspect_ratios:  string[];
  available_now:            boolean;
  blocked_by?:              string;
  notes?:                   string;
}

/**
 * VIDEO_AI_PROVIDER_REGISTRY — all known AI providers for the video pipeline.
 *
 * Providers capable of video generation are marked separately from providers
 * used for analysis/scripting. All have available_now = false.
 * Integration requires explicit CTO approval and API credentials.
 */
export const VIDEO_AI_PROVIDER_REGISTRY: ReadonlyArray<VideoAIProviderCapability> = [
  {
    provider_id:               "anthropic",
    label:                     "Anthropic Claude",
    supported_capabilities:    ["storyboard_generation", "caption_generation", "quality_review"],
    max_output_duration_seconds: null,    // Text/storyboard only — no video output
    max_input_media_count:     20,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1", "4:3", "4:5"],
    available_now:             false,
    blocked_by:                "AI Gateway storyboard_generation capability not yet routed",
    notes:                     "Claude handles storyboarding and script generation. Not a video generation provider.",
  },
  {
    provider_id:               "openai_sora",
    label:                     "OpenAI Sora",
    supported_capabilities:    ["video_generation", "storyboard_generation"],
    max_output_duration_seconds: 60,
    max_input_media_count:     4,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1"],
    available_now:             false,
    blocked_by:                "OpenAI Sora API access not yet available — waitlisted",
    notes:                     "Text-to-video and image-to-video. High quality but limited duration and input count.",
  },
  {
    provider_id:               "google_veo",
    label:                     "Google Veo 2",
    supported_capabilities:    ["video_generation"],
    max_output_duration_seconds: 60,
    max_input_media_count:     8,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1"],
    available_now:             false,
    blocked_by:                "Google Veo API requires Vertex AI enterprise access — not yet provisioned",
    notes:                     "High-fidelity video generation with strong automotive/product capabilities.",
  },
  {
    provider_id:               "runway_gen3",
    label:                     "Runway Gen-3 Alpha",
    supported_capabilities:    ["video_generation", "scene_assembly"],
    max_output_duration_seconds: 10,
    max_input_media_count:     2,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1"],
    available_now:             false,
    blocked_by:                "Runway API credentials not yet configured in AI Gateway",
    notes:                     "Strong at motion generation from images. Short clips (5–10s) — ideal for scene-level generation.",
  },
  {
    provider_id:               "pika_labs",
    label:                     "Pika 2.0",
    supported_capabilities:    ["video_generation", "scene_assembly"],
    max_output_duration_seconds: 15,
    max_input_media_count:     3,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1"],
    available_now:             false,
    blocked_by:                "Pika Labs API credentials not yet configured in AI Gateway",
    notes:                     "Good for before/after transitions and reveal-style video generation.",
  },
  {
    provider_id:               "kling_ai",
    label:                     "Kling AI",
    supported_capabilities:    ["video_generation", "scene_assembly"],
    max_output_duration_seconds: 30,
    max_input_media_count:     5,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1"],
    available_now:             false,
    blocked_by:                "Kling AI API credentials not yet configured in AI Gateway",
    notes:                     "Strong high-quality character/object motion. Good for vehicle showcase generation.",
  },
  {
    provider_id:               "azure_openai",
    label:                     "Azure OpenAI",
    supported_capabilities:    ["storyboard_generation", "caption_generation", "quality_review"],
    max_output_duration_seconds: null,
    max_input_media_count:     10,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1", "4:3", "4:5"],
    available_now:             false,
    blocked_by:                "Azure OpenAI credentials not yet configured in AI Gateway",
    notes:                     "Same capabilities as Anthropic Claude via Azure. Use for enterprise compliance contexts.",
  },
  {
    provider_id:               "openrouter",
    label:                     "OpenRouter",
    supported_capabilities:    ["storyboard_generation", "caption_generation"],
    max_output_duration_seconds: null,
    max_input_media_count:     10,
    supported_aspect_ratios:   ["9:16", "16:9", "1:1", "4:3", "4:5"],
    available_now:             false,
    blocked_by:                "OpenRouter API key not yet configured in AI Gateway",
    notes:                     "Multi-provider routing — useful for cost optimization across text-generation tasks.",
  },
] as const;

// ─── Agent capability map ─────────────────────────────────────────────────────

/**
 * AGENT_VIDEO_CAPABILITIES — which AI agents can trigger which video pipeline steps.
 *
 * marketing_agent: full pipeline — storyboard through quality review
 * growth_agent:    limited to storyboard input and thumbnail selection
 * Other agents do not interact with the video pipeline in Phase E.
 */
export type VideoAIAgentCapability =
  | "submit_storyboard_request"   // Trigger storyboard generation
  | "review_generated_video"      // Quality review of generated output
  | "generate_captions"           // Generate subtitles or on-screen text
  | "select_thumbnail"            // Select best thumbnail from output
  | "submit_generation_request";  // Trigger video generation

export const AGENT_VIDEO_CAPABILITIES: Partial<Record<AIAgentId, VideoAIAgentCapability[]>> = {
  marketing_agent: [
    "submit_storyboard_request",
    "submit_generation_request",
    "review_generated_video",
    "generate_captions",
    "select_thumbnail",
  ],
  growth_agent: [
    "submit_storyboard_request",
    "select_thumbnail",
  ],
};

// ─── AI request/response types ────────────────────────────────────────────────

/**
 * VideoProjectForAI — the minimal safe projection sent to AI providers.
 *
 * Does NOT include:
 * - Raw MediaAsset file_url or file_path (replaced with pre-validated MediaForAI)
 * - dealer_settings, LINE secrets, or any other sensitive dealer data
 * - Full VideoPolicy details beyond what the provider needs
 *
 * dealer_id is always included for audit purposes.
 */
export interface VideoProjectForAI {
  project_id:              string;
  dealer_id:               string;
  template_id:             string | null;
  target_profiles:         VideoPublishingProfileId[];
  scene_descriptions:      VideoSceneDescriptionForAI[];
  source_media:            MediaForAI[];   // Pre-validated; file_url replaced with safe ref
  policy_summary: {
    watermark_required:    boolean;
    logo_required:         boolean;
    max_duration_seconds:  number | null;
  };
}

export interface VideoSceneDescriptionForAI {
  scene_type:              string;
  order:                   number;
  target_duration_seconds: number | null;
  description:             string | null;
  source_media_ids:        string[];
}

/**
 * VideoAIRequest — the full request envelope sent to the AI Gateway.
 * The gateway routes this to the appropriate provider based on capability and availability.
 */
export interface VideoAIRequest {
  request_id:   string;
  dealer_id:    string;
  agent_id:     AIAgentId;
  capability:   VideoAICapabilityType;
  provider_id:  VideoAIProviderId;
  project:      VideoProjectForAI;
  created_at:   string;   // ISO 8601
}

/**
 * VideoAIResponse — the response envelope returned from the AI Gateway.
 * The pipeline consumes this after the gateway resolves the provider call.
 *
 * No execution in Phase E — type definition only.
 */
export interface VideoAIResponse {
  request_id:    string;
  dealer_id:     string;
  provider_id:   VideoAIProviderId;
  capability:    VideoAICapabilityType;
  success:       boolean;
  /** For storyboard_generation: JSON storyboard structure. For video_generation: output file reference. */
  result_json:   Record<string, unknown> | null;
  error_code:    string | null;
  error_message: string | null;
  duration_ms:   number | null;
  completed_at:  string;   // ISO 8601
}

// ─── Gate function ────────────────────────────────────────────────────────────

/**
 * VideoAIGateResult — the result of the AI access gate check.
 */
export type VideoAIGateResult =
  | { allowed: true;  project: VideoProjectForAI; provider_id: VideoAIProviderId }
  | { allowed: false; reason:  string };

/**
 * toVideoProjectForAI — gate function that validates a VideoProject before
 * creating the AI request payload.
 *
 * Validates:
 * 1. project.dealer_id matches the caller's dealerId (cross-dealer isolation)
 * 2. project.policy.ai_content_allowed = true (explicit opt-in required)
 * 3. All source media pass checkMediaAICapability("ai_marketing")
 * 4. All source media pass allSourcesPermittedForMarketing()
 * 5. The requested provider supports the requested capability
 *
 * Returns allowed=false if any check fails.
 * Never throws — gate failures are business logic, not exceptions.
 */
export function toVideoProjectForAI(
  project:    VideoProject,
  dealerId:   string,
  providerId: VideoAIProviderId,
  capability: VideoAICapabilityType,
): VideoAIGateResult {
  if (project.dealer_id !== dealerId) {
    return { allowed: false, reason: "Dealer isolation violation: project.dealer_id does not match caller." };
  }

  if (!project.policy.ai_content_allowed) {
    return { allowed: false, reason: "AI content generation is not enabled for this project. Set policy.ai_content_allowed = true." };
  }

  if (project.sources.length === 0) {
    return { allowed: false, reason: "VideoProject has no source media. Add at least one VideoSource before requesting AI generation." };
  }

  if (!allSourcesPermittedForMarketing(project.sources)) {
    return { allowed: false, reason: "One or more source media items do not pass the marketing permission gate. Check source media consent and visibility." };
  }

  const aiCapabilityBlocked = project.sources.some((s) => {
    const request: MediaAICapabilityRequest = {
      capability: "ai_marketing",
      media:      s.media_asset,
      agent_id:   "marketing_agent",
      dealer_id:  dealerId,
    };
    return !checkMediaAICapability(request).allowed;
  });
  if (aiCapabilityBlocked) {
    return { allowed: false, reason: "One or more source media items are not eligible for AI marketing use. Check media AI capability flags." };
  }

  const providerEntry = VIDEO_AI_PROVIDER_REGISTRY.find(
    (p) => p.provider_id === providerId,
  );
  if (!providerEntry) {
    return { allowed: false, reason: `Unknown AI provider: ${providerId}. Check VIDEO_AI_PROVIDER_REGISTRY.` };
  }

  if (!providerEntry.supported_capabilities.includes(capability)) {
    return {
      allowed: false,
      reason: `Provider "${providerEntry.label}" does not support capability "${capability}". Supported: ${providerEntry.supported_capabilities.join(", ")}.`,
    };
  }

  const storyboard  = toVideoProjectForStoryboard(project);
  const sourceMedia = project.sources.map((s): MediaForAI => ({
    id:                      s.media_asset.id,
    dealer_id:               s.media_asset.dealer_id,
    media_type:              s.media_asset.media_type,
    file_url:                s.media_asset.file_url,
    mime_type:               s.media_asset.mime_type,
    width:                   null,   // Populated at Phase 10J metadata extraction
    height:                  null,
    duration_seconds:        null,
    is_ai_training_excluded: false,
    is_marketing_approved:   s.media_asset.is_marketing_approved,
  }));

  const projectForAI: VideoProjectForAI = {
    project_id:    project.id,
    dealer_id:     project.dealer_id,
    template_id:   project.template_id,
    target_profiles: project.publishing_profiles,
    source_media:  sourceMedia,
    policy_summary: {
      watermark_required: project.policy.watermark_required,
      logo_required:      project.policy.logo_required,
      max_duration_seconds: providerEntry.max_output_duration_seconds,
    },
    scene_descriptions: storyboard.source_descriptions.map((sd) => ({
      scene_type:              sd.source_type,
      order:                   sd.order,
      target_duration_seconds: sd.display_duration_seconds,
      description:             sd.ai_scene_description,
      source_media_ids:        [sd.source_id],
    })),
  };

  return { allowed: true, project: projectForAI, provider_id: providerId };
}

/**
 * Builds a VideoAIRequest envelope from a validated VideoProjectForAI.
 * The gate (toVideoProjectForAI) must be called first.
 */
export function buildVideoAIRequest(
  requestId:  string,
  dealerId:   string,
  agentId:    AIAgentId,
  project:    VideoProjectForAI,
  capability: VideoAICapabilityType,
  providerId: VideoAIProviderId,
  now:        string,
): VideoAIRequest {
  return {
    request_id:  requestId,
    dealer_id:   dealerId,
    agent_id:    agentId,
    capability,
    provider_id: providerId,
    project,
    created_at:  now,
  };
}

// ─── Provider helpers ─────────────────────────────────────────────────────────

/**
 * Returns all providers that support the given capability.
 */
export function getProvidersForCapability(
  capability: VideoAICapabilityType,
): VideoAIProviderCapability[] {
  return VIDEO_AI_PROVIDER_REGISTRY.filter(
    (p) => p.supported_capabilities.includes(capability),
  );
}

/**
 * Returns all providers that are currently available for use.
 * Returns an empty array until AI Gateway integration is complete.
 */
export function getAvailableProviders(): VideoAIProviderCapability[] {
  return VIDEO_AI_PROVIDER_REGISTRY.filter((p) => p.available_now);
}

/**
 * Returns true if the given AI agent has the given video pipeline capability.
 */
export function agentHasVideoCapability(
  agentId:    AIAgentId,
  capability: VideoAIAgentCapability,
): boolean {
  return AGENT_VIDEO_CAPABILITIES[agentId]?.includes(capability) ?? false;
}
