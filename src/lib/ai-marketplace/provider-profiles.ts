// DealerOS — AI Capability Marketplace: Provider Profiles (Sprint 11S Phase C)
//
// Static profile definitions for all 11 AI providers in the marketplace:
//   Gateway providers (5):  openai, anthropic, gemini, azure_openai, openrouter
//   Extension providers (6): google_veo, runway, kling, pika, luma, elevenlabs
//
// These are metadata profiles only — no SDK imports, no API calls, no adapters.
// Provider adapters are separate (src/lib/ai-orchestrator/provider-adapters/).
//
// key_storage fields: profiles do not store keys; key storage is always in
// dealer_settings.ai_settings via the AES-256-GCM encryption flow.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId } from "@/lib/ai/types";
import type {
  AIMarketplaceCapability,
  AIMarketplaceProviderId,
  AIProviderProfile,
} from "./marketplace-types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function profile(p: AIProviderProfile): AIProviderProfile {
  return p;
}

// ─── Gateway providers ────────────────────────────────────────────────────────

const OPENAI_PROFILE: AIProviderProfile = profile({
  provider_id:    "openai",
  display_name:   "OpenAI",
  vendor:         "OpenAI",
  description:    "Industry-leading general-purpose LLM with strong function calling, vision, and DALL-E image generation. Best default for most chat and content tasks.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "standard",
  supported_capabilities: [
    "text_generation", "chat_completion", "function_calling", "embeddings",
    "vision", "ocr", "image_generation",
    "translation",
    "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
    "social_post", "analytics", "reporting",
  ],
  specialty_capabilities: [
    "chat_completion", "function_calling", "image_generation",
  ],
  marketplace_status:  "gateway_planned",
  gateway_provider_id: "openai",
  adapter_sprint:      "Sprint 11O+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const ANTHROPIC_PROFILE: AIProviderProfile = profile({
  provider_id:    "anthropic",
  display_name:   "Anthropic Claude",
  vendor:         "Anthropic",
  description:    "Best-in-class for complex reasoning, long-context analytics, and structured report generation. Preferred for compliance-sensitive content.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "premium",
  supported_capabilities: [
    "text_generation", "chat_completion", "function_calling",
    "vision", "ocr",
    "translation",
    "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
    "social_post", "analytics", "reporting",
  ],
  specialty_capabilities: [
    "chat_completion", "analytics", "reporting",
  ],
  marketplace_status:  "gateway_planned",
  gateway_provider_id: "anthropic",
  adapter_sprint:      "Sprint 11O+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const GEMINI_PROFILE: AIProviderProfile = profile({
  provider_id:    "gemini",
  display_name:   "Google Gemini",
  vendor:         "Google",
  description:    "Google-native multimodal model with strong OCR, embeddings, and AI Overview optimization. Recommended for AIO analysis and search-adjacent tasks.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "budget",
  supported_capabilities: [
    "text_generation", "chat_completion", "function_calling", "embeddings",
    "vision", "ocr",
    "image_generation", "video_generation",
    "translation",
    "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
    "social_post", "analytics", "reporting",
  ],
  specialty_capabilities: [
    "aio_analysis", "ocr", "embeddings", "translation",
  ],
  marketplace_status:  "gateway_planned",
  gateway_provider_id: "gemini",
  adapter_sprint:      "Sprint 11O+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const AZURE_OPENAI_PROFILE: AIProviderProfile = profile({
  provider_id:    "azure_openai",
  display_name:   "Azure OpenAI",
  vendor:         "Microsoft / OpenAI",
  description:    "Enterprise-grade OpenAI deployment on Azure infrastructure. Data residency, compliance, and SLA guarantees for regulated industries.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "enterprise",
  supported_capabilities: [
    "text_generation", "chat_completion", "function_calling", "embeddings",
    "vision", "ocr",
    "translation",
    "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
    "social_post", "analytics", "reporting",
  ],
  specialty_capabilities: [
    "chat_completion", "function_calling",
  ],
  marketplace_status:  "gateway_planned",
  gateway_provider_id: "azure_openai",
  adapter_sprint:      "Sprint 11O+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const OPENROUTER_PROFILE: AIProviderProfile = profile({
  provider_id:    "openrouter",
  display_name:   "OpenRouter",
  vendor:         "OpenRouter",
  description:    "Multi-model aggregator routing to 100+ models. Ideal for cost optimization and access to niche models without managing multiple API keys.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "budget",
  supported_capabilities: [
    "text_generation", "chat_completion", "function_calling",
    "vision", "ocr", "image_generation",
    "embeddings",
    "translation",
    "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
    "social_post", "analytics", "reporting",
  ],
  specialty_capabilities: [
    "text_generation", "social_post",
  ],
  marketplace_status:  "gateway_planned",
  gateway_provider_id: "openrouter",
  adapter_sprint:      "Sprint 11O+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

// ─── Extension providers (marketplace-only) ───────────────────────────────────

const GOOGLE_VEO_PROFILE: AIProviderProfile = profile({
  provider_id:    "google_veo",
  display_name:   "Google Veo",
  vendor:         "Google",
  description:    "Google's dedicated video generation model (Veo 2). High-quality, physics-aware video from text prompts. Separate from Gemini API.",
  pricing_model:  "per_video",
  estimated_monthly_cost_tier: "premium",
  supported_capabilities: ["video_generation"],
  specialty_capabilities:  ["video_generation"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     true,
  profile_version:     "1.0.0",
});

const RUNWAY_PROFILE: AIProviderProfile = profile({
  provider_id:    "runway",
  display_name:   "Runway",
  vendor:         "Runway",
  description:    "Professional-grade video and image generation platform. Gen-3 Alpha model produces cinema-quality video with fine-grained motion control.",
  pricing_model:  "credits",
  estimated_monthly_cost_tier: "premium",
  supported_capabilities: ["video_generation", "image_generation"],
  specialty_capabilities:  ["video_generation"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: false,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const KLING_PROFILE: AIProviderProfile = profile({
  provider_id:    "kling",
  display_name:   "Kling AI",
  vendor:         "Kuaishou",
  description:    "High-quality video generation from Kuaishou. Strong performance on real-world scene fidelity. Competitive pricing relative to quality tier.",
  pricing_model:  "credits",
  estimated_monthly_cost_tier: "standard",
  supported_capabilities: ["video_generation"],
  specialty_capabilities:  ["video_generation"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: false,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const PIKA_PROFILE: AIProviderProfile = profile({
  provider_id:    "pika",
  display_name:   "Pika",
  vendor:         "Pika Labs",
  description:    "Fast short-form video generation optimized for social media clips. Quick iteration cycles and strong style-transfer capabilities.",
  pricing_model:  "credits",
  estimated_monthly_cost_tier: "budget",
  supported_capabilities: ["video_generation"],
  specialty_capabilities:  ["video_generation"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: false,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const LUMA_PROFILE: AIProviderProfile = profile({
  provider_id:    "luma",
  display_name:   "Luma AI",
  vendor:         "Luma AI",
  description:    "Dream Machine video and 3D content generation. Excellent for product visualization and immersive marketing assets.",
  pricing_model:  "credits",
  estimated_monthly_cost_tier: "standard",
  supported_capabilities: ["video_generation", "image_generation"],
  specialty_capabilities:  ["video_generation"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: false,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

const ELEVENLABS_PROFILE: AIProviderProfile = profile({
  provider_id:    "elevenlabs",
  display_name:   "ElevenLabs",
  vendor:         "ElevenLabs",
  description:    "Industry-leading voice synthesis and cloning platform. Hyper-realistic speech from text with custom voice model creation from audio samples.",
  pricing_model:  "per_token",
  estimated_monthly_cost_tier: "standard",
  supported_capabilities: ["voice_synthesis", "voice_cloning"],
  specialty_capabilities:  ["voice_synthesis", "voice_cloning"],
  marketplace_status:  "marketplace_only",
  gateway_provider_id: null,
  adapter_sprint:      "Sprint 12+",
  requires_api_key:    true,
  supports_key_rotation: true,
  is_early_access:     false,
  profile_version:     "1.0.0",
});

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AI_MARKETPLACE_PROVIDER_PROFILES: AIProviderProfile[] = [
  // Gateway providers (in AIProviderId registry)
  OPENAI_PROFILE,
  ANTHROPIC_PROFILE,
  GEMINI_PROFILE,
  AZURE_OPENAI_PROFILE,
  OPENROUTER_PROFILE,
  // Extension providers (marketplace-only, not yet in AI Gateway)
  GOOGLE_VEO_PROFILE,
  RUNWAY_PROFILE,
  KLING_PROFILE,
  PIKA_PROFILE,
  LUMA_PROFILE,
  ELEVENLABS_PROFILE,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getProviderProfile(
  provider_id: AIMarketplaceProviderId,
): AIProviderProfile | undefined {
  return AI_MARKETPLACE_PROVIDER_PROFILES.find((p) => p.provider_id === provider_id);
}

export function getGatewayProviderProfiles(): AIProviderProfile[] {
  return AI_MARKETPLACE_PROVIDER_PROFILES.filter(
    (p) => p.marketplace_status === "gateway_planned" || p.marketplace_status === "gateway_active",
  );
}

export function getExtensionProviderProfiles(): AIProviderProfile[] {
  return AI_MARKETPLACE_PROVIDER_PROFILES.filter(
    (p) => p.marketplace_status === "marketplace_only",
  );
}

export function getProvidersForCapability(
  capability: AIMarketplaceCapability,
): AIProviderProfile[] {
  return AI_MARKETPLACE_PROVIDER_PROFILES.filter((p) =>
    p.supported_capabilities.includes(capability),
  );
}

export function getSpecialistProviders(
  capability: AIMarketplaceCapability,
): AIProviderProfile[] {
  return AI_MARKETPLACE_PROVIDER_PROFILES.filter((p) =>
    p.specialty_capabilities.includes(capability),
  );
}

export function isGatewayProvider(
  provider_id: AIMarketplaceProviderId,
): provider_id is AIProviderId {
  const profile = getProviderProfile(provider_id);
  return profile?.gateway_provider_id !== null && profile !== undefined;
}
