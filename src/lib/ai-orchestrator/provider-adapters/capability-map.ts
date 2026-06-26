// DealerOS — AI Orchestration Engine: Provider Capability Maps (Sprint 11N Phase C)
//
// Declares per-provider capability support status at the ADAPTER layer.
//
// This is distinct from AI_PROVIDER_REGISTRY.capabilities (model-layer support):
//   AI_PROVIDER_REGISTRY.capabilities[] — what the provider's API supports natively
//   AIProviderAdapterCapabilityMap      — what our adapter WILL implement (Sprint 11O+)
//
// support_status values:
//   "planned"          — Provider API supports it; adapter will implement in Sprint 11O+
//   "supported_later"  — Provider has limited/experimental access; no firm sprint
//   "unavailable"      — Provider's API cannot do this; will never be implemented
//   "requires_review"  — Model-level support exists but needs compliance/policy review
//
// These maps are DECLARATIONS only — no adapter code, no SDK imports, no network calls.
// They are consumed by inspectAdapterRegistry() for execution guard check #13.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }                     from "@/lib/ai/types";
import type { AICapability }                     from "@/lib/ai/capabilities";
import type {
  AIProviderAdapterCapabilityMap,
  AIProviderCapabilityDeclaration,
}                                                from "./adapter-registry-types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function cap(
  capability:       AICapability,
  support_status:   AIProviderCapabilityDeclaration["support_status"],
  supported_models: string[],
  notes:            string,
): AIProviderCapabilityDeclaration {
  return { capability, support_status, supported_models, notes };
}

// ─── OpenAI capability map ────────────────────────────────────────────────────

/**
 * OPENAI_CAPABILITY_MAP — adapter-layer capability declarations for OpenAI.
 *
 * Source: AI_PROVIDER_REGISTRY["openai"].capabilities
 * (text_generation, chat_completion, vision, ocr, embeddings, function_calling)
 */
export const OPENAI_CAPABILITY_MAP: AIProviderAdapterCapabilityMap = {
  text_generation:  cap("text_generation",  "planned",        ["gpt-4o", "gpt-4o-mini"], "Core chat text generation via Chat Completions API"),
  chat_completion:  cap("chat_completion",  "planned",        ["gpt-4o", "gpt-4o-mini"], "Multi-turn conversation via Chat Completions API"),
  function_calling: cap("function_calling", "planned",        ["gpt-4o", "gpt-4o-mini"], "Structured tool use and JSON mode"),
  embeddings:       cap("embeddings",       "planned",        ["text-embedding-3-small", "text-embedding-3-large"], "Vector embeddings via Embeddings API"),
  vision:           cap("vision",           "planned",        ["gpt-4o", "gpt-4o-mini"], "Image understanding via Chat Completions with vision"),
  ocr:              cap("ocr",              "planned",        ["gpt-4o"], "Document OCR via vision input in Chat Completions"),
  image_generation: cap("image_generation", "supported_later",["dall-e-3"], "Image generation via Images API (DALL-E 3) — adapter planned post-11O"),
  video_generation: cap("video_generation", "unavailable",    [], "OpenAI text API does not support video generation (Sora is a separate product)"),
  seo_analysis:     cap("seo_analysis",     "requires_review",["gpt-4o"], "Keyword analysis via prompting — not a native API feature; requires content review"),
  meo_analysis:     cap("meo_analysis",     "requires_review",["gpt-4o"], "MEO guidance via prompting — requires compliance review"),
  aeo_analysis:     cap("aeo_analysis",     "requires_review",["gpt-4o"], "Answer engine prompting — requires compliance review"),
  llmo_analysis:    cap("llmo_analysis",    "requires_review",["gpt-4o"], "LLM optimization prompting — requires compliance review"),
  aio_analysis:     cap("aio_analysis",     "requires_review",["gpt-4o"], "AI Overview analysis via prompting — requires compliance review"),
  social_post:      cap("social_post",      "planned",        ["gpt-4o", "gpt-4o-mini"], "Social media content generation via Chat Completions"),
  analytics:        cap("analytics",        "planned",        ["gpt-4o"], "Data summarization and analytics via structured prompting"),
  reporting:        cap("reporting",        "planned",        ["gpt-4o"], "Structured report generation via Chat Completions with function_calling"),
};

// ─── Anthropic capability map ─────────────────────────────────────────────────

/**
 * ANTHROPIC_CAPABILITY_MAP — adapter-layer capability declarations for Anthropic Claude.
 *
 * Source: AI_PROVIDER_REGISTRY["anthropic"].capabilities
 * (text_generation, chat_completion, vision, function_calling, seo_analysis)
 */
export const ANTHROPIC_CAPABILITY_MAP: AIProviderAdapterCapabilityMap = {
  text_generation:  cap("text_generation",  "planned",        ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"], "Core text generation via Messages API"),
  chat_completion:  cap("chat_completion",  "planned",        ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"], "Multi-turn conversation via Messages API"),
  function_calling: cap("function_calling", "planned",        ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"], "Tool use via Messages API tool_use parameter"),
  embeddings:       cap("embeddings",       "unavailable",    [], "Anthropic Messages API does not expose an embeddings endpoint"),
  vision:           cap("vision",           "planned",        ["claude-sonnet-4-6"], "Image analysis via Messages API with base64 image content"),
  ocr:              cap("ocr",              "planned",        ["claude-sonnet-4-6"], "Document reading via vision — Claude 3+ models have strong OCR ability"),
  image_generation: cap("image_generation", "unavailable",    [], "Anthropic API does not support image generation"),
  video_generation: cap("video_generation", "unavailable",    [], "Anthropic API does not support video generation"),
  seo_analysis:     cap("seo_analysis",     "planned",        ["claude-sonnet-4-6"], "SEO analysis via structured prompting (in AI_PROVIDER_REGISTRY.capabilities)"),
  meo_analysis:     cap("meo_analysis",     "requires_review",["claude-sonnet-4-6"], "MEO guidance via prompting — requires compliance review"),
  aeo_analysis:     cap("aeo_analysis",     "requires_review",["claude-sonnet-4-6"], "Answer engine prompting — requires compliance review"),
  llmo_analysis:    cap("llmo_analysis",    "requires_review",["claude-sonnet-4-6"], "LLM optimization analysis — requires compliance review"),
  aio_analysis:     cap("aio_analysis",     "requires_review",["claude-sonnet-4-6"], "AI Overview analysis via prompting — requires compliance review"),
  social_post:      cap("social_post",      "planned",        ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"], "Social media content via Messages API"),
  analytics:        cap("analytics",        "planned",        ["claude-sonnet-4-6"], "Data analysis via long-context Messages API"),
  reporting:        cap("reporting",        "planned",        ["claude-sonnet-4-6"], "Structured report generation via Messages API with tool_use"),
};

// ─── Gemini capability map ────────────────────────────────────────────────────

/**
 * GEMINI_CAPABILITY_MAP — adapter-layer capability declarations for Google Gemini.
 *
 * Source: AI_PROVIDER_REGISTRY["gemini"].capabilities
 * (text_generation, chat_completion, vision, ocr, embeddings, function_calling,
 *  seo_analysis, aio_analysis)
 */
export const GEMINI_CAPABILITY_MAP: AIProviderAdapterCapabilityMap = {
  text_generation:  cap("text_generation",  "planned",         ["gemini-1.5-pro", "gemini-flash"], "Text generation via Gemini API generateContent"),
  chat_completion:  cap("chat_completion",  "planned",         ["gemini-1.5-pro", "gemini-flash"], "Multi-turn chat via Gemini API with history"),
  function_calling: cap("function_calling", "planned",         ["gemini-1.5-pro", "gemini-flash"], "Function declarations via Gemini API tools parameter"),
  embeddings:       cap("embeddings",       "planned",         ["text-embedding-004"], "Embeddings via Google Generative AI text-embedding-004"),
  vision:           cap("vision",           "planned",         ["gemini-1.5-pro", "gemini-flash"], "Image/video analysis via Gemini multimodal API"),
  ocr:              cap("ocr",              "planned",         ["gemini-1.5-pro"], "Document reading via Gemini vision — strong OCR on multi-page documents"),
  image_generation: cap("image_generation", "supported_later", ["imagen-3"], "Image generation via Imagen API — limited programmatic access; planned post-11O"),
  video_generation: cap("video_generation", "supported_later", ["veo-2"], "Video generation via Veo API — limited availability; planned post-11O"),
  seo_analysis:     cap("seo_analysis",     "planned",         ["gemini-1.5-pro"], "SEO analysis via prompting (in AI_PROVIDER_REGISTRY.capabilities)"),
  meo_analysis:     cap("meo_analysis",     "requires_review", ["gemini-1.5-pro"], "MEO via prompting — requires compliance review"),
  aeo_analysis:     cap("aeo_analysis",     "requires_review", ["gemini-1.5-pro"], "Answer engine prompting — requires compliance review"),
  llmo_analysis:    cap("llmo_analysis",    "requires_review", ["gemini-1.5-pro"], "LLM optimization analysis — requires compliance review"),
  aio_analysis:     cap("aio_analysis",     "planned",         ["gemini-1.5-pro"], "AI Overview optimization (in AI_PROVIDER_REGISTRY — Google native context)"),
  social_post:      cap("social_post",      "planned",         ["gemini-1.5-pro", "gemini-flash"], "Social media content via generateContent"),
  analytics:        cap("analytics",        "planned",         ["gemini-1.5-pro"], "Data analysis via long-context Gemini API"),
  reporting:        cap("reporting",        "planned",         ["gemini-1.5-pro"], "Structured reporting via function_calling and generateContent"),
};

// ─── Azure OpenAI capability map ──────────────────────────────────────────────

/**
 * AZURE_OPENAI_CAPABILITY_MAP — adapter-layer capability declarations for Azure OpenAI.
 *
 * Source: AI_PROVIDER_REGISTRY["azure_openai"].capabilities
 * (text_generation, chat_completion, vision, embeddings, function_calling)
 *
 * Azure OpenAI is the enterprise compliance option. Requires a dealer-specific endpoint URL.
 */
export const AZURE_OPENAI_CAPABILITY_MAP: AIProviderAdapterCapabilityMap = {
  text_generation:  cap("text_generation",  "planned",         ["gpt-4o", "gpt-4o-mini"], "Text generation via Azure OpenAI Chat Completions endpoint"),
  chat_completion:  cap("chat_completion",  "planned",         ["gpt-4o", "gpt-4o-mini"], "Multi-turn chat via Azure OpenAI deployments"),
  function_calling: cap("function_calling", "planned",         ["gpt-4o", "gpt-4o-mini"], "Tool use via Azure OpenAI Chat Completions tools parameter"),
  embeddings:       cap("embeddings",       "planned",         ["text-embedding-3-small", "text-embedding-3-large"], "Embeddings via Azure OpenAI Embeddings endpoint"),
  vision:           cap("vision",           "planned",         ["gpt-4o"], "Image understanding via Azure OpenAI vision-enabled deployment"),
  ocr:              cap("ocr",              "planned",         ["gpt-4o"], "Document OCR via Azure OpenAI vision input"),
  image_generation: cap("image_generation", "supported_later", ["dall-e-3"], "DALL-E 3 available on Azure — limited by deployment availability; planned post-11O"),
  video_generation: cap("video_generation", "unavailable",     [], "Azure OpenAI does not provide a video generation endpoint"),
  seo_analysis:     cap("seo_analysis",     "requires_review", ["gpt-4o"], "Keyword analysis via prompting — requires compliance review (enterprise context)"),
  meo_analysis:     cap("meo_analysis",     "requires_review", ["gpt-4o"], "MEO guidance via prompting — requires compliance review"),
  aeo_analysis:     cap("aeo_analysis",     "requires_review", ["gpt-4o"], "Answer engine prompting — requires compliance review"),
  llmo_analysis:    cap("llmo_analysis",    "requires_review", ["gpt-4o"], "LLM optimization analysis — requires compliance review"),
  aio_analysis:     cap("aio_analysis",     "requires_review", ["gpt-4o"], "AI Overview analysis via prompting — requires compliance review"),
  social_post:      cap("social_post",      "planned",         ["gpt-4o", "gpt-4o-mini"], "Social media content via Azure OpenAI Chat Completions"),
  analytics:        cap("analytics",        "planned",         ["gpt-4o"], "Data analysis via Azure OpenAI Chat Completions"),
  reporting:        cap("reporting",        "planned",         ["gpt-4o"], "Structured reporting via Azure OpenAI function_calling"),
};

// ─── OpenRouter capability map ────────────────────────────────────────────────

/**
 * OPENROUTER_CAPABILITY_MAP — adapter-layer capability declarations for OpenRouter.
 *
 * Source: AI_PROVIDER_REGISTRY["openrouter"].capabilities
 * (text_generation, chat_completion, vision, image_generation, function_calling, seo_analysis)
 *
 * OpenRouter is an aggregator — it routes to 100+ models from multiple providers.
 * Capability availability depends on the selected model. Declared at the aggregator level.
 */
export const OPENROUTER_CAPABILITY_MAP: AIProviderAdapterCapabilityMap = {
  text_generation:  cap("text_generation",  "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o", "openai/gpt-4o-mini"], "Text generation via OpenRouter unified Chat Completions API"),
  chat_completion:  cap("chat_completion",  "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o"], "Multi-turn chat via OpenRouter Chat Completions"),
  function_calling: cap("function_calling", "planned",         ["openai/gpt-4o", "anthropic/claude-sonnet-4-6"], "Tool use via OpenRouter — model-dependent support"),
  embeddings:       cap("embeddings",       "supported_later", ["openai/text-embedding-3-small"], "Embeddings routed to OpenAI via OpenRouter — limited availability"),
  vision:           cap("vision",           "planned",         ["openai/gpt-4o", "anthropic/claude-sonnet-4-6", "google/gemini-1.5-pro"], "Vision via OpenRouter — routes to vision-capable models"),
  ocr:              cap("ocr",              "planned",         ["openai/gpt-4o", "google/gemini-1.5-pro"], "Document OCR via vision-capable models routed through OpenRouter"),
  image_generation: cap("image_generation", "planned",         ["openai/dall-e-3"], "Image generation via OpenRouter routing to DALL-E 3 (in AI_PROVIDER_REGISTRY.capabilities)"),
  video_generation: cap("video_generation", "unavailable",     [], "OpenRouter does not route to video generation endpoints"),
  seo_analysis:     cap("seo_analysis",     "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o"], "SEO analysis via prompting through OpenRouter (in AI_PROVIDER_REGISTRY.capabilities)"),
  meo_analysis:     cap("meo_analysis",     "requires_review", ["anthropic/claude-sonnet-4-6"], "MEO guidance via prompting — requires compliance review"),
  aeo_analysis:     cap("aeo_analysis",     "requires_review", ["anthropic/claude-sonnet-4-6"], "Answer engine prompting — requires compliance review"),
  llmo_analysis:    cap("llmo_analysis",    "requires_review", ["anthropic/claude-sonnet-4-6"], "LLM optimization analysis — requires compliance review"),
  aio_analysis:     cap("aio_analysis",     "requires_review", ["openai/gpt-4o"], "AI Overview analysis via prompting — requires compliance review"),
  social_post:      cap("social_post",      "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o-mini"], "Social media content via OpenRouter Chat Completions"),
  analytics:        cap("analytics",        "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o"], "Data analysis routed to capable models via OpenRouter"),
  reporting:        cap("reporting",        "planned",         ["anthropic/claude-sonnet-4-6", "openai/gpt-4o"], "Structured reporting via function_calling through OpenRouter"),
};

// ─── Combined map registry ────────────────────────────────────────────────────

/**
 * PROVIDER_CAPABILITY_MAPS — maps each AIProviderId to its capability map.
 *
 * Consumed by inspectAdapterRegistry() and the execution guard.
 */
export const PROVIDER_CAPABILITY_MAPS: Record<AIProviderId, AIProviderAdapterCapabilityMap> = {
  openai:       OPENAI_CAPABILITY_MAP,
  anthropic:    ANTHROPIC_CAPABILITY_MAP,
  gemini:       GEMINI_CAPABILITY_MAP,
  azure_openai: AZURE_OPENAI_CAPABILITY_MAP,
  openrouter:   OPENROUTER_CAPABILITY_MAP,
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * getCapabilityDeclaration — returns the capability declaration for a provider/capability pair.
 *
 * Returns undefined if the provider is unknown or the capability is not declared.
 * Absence from the map implies support_status: "unavailable".
 */
export function getCapabilityDeclaration(
  provider_id: AIProviderId,
  capability:  AICapability,
): AIProviderCapabilityDeclaration | undefined {
  return PROVIDER_CAPABILITY_MAPS[provider_id]?.[capability];
}

/**
 * getUnavailableCapabilities — returns capabilities that have support_status "unavailable"
 * for the given provider, filtered from the required set.
 */
export function getUnavailableCapabilities(
  provider_id:    AIProviderId,
  required_caps:  AICapability[],
): AICapability[] {
  const map = PROVIDER_CAPABILITY_MAPS[provider_id];
  if (!map) return required_caps; // Unknown provider — all required caps are unavailable

  return required_caps.filter((cap) => {
    const decl = map[cap];
    // Absent from map → treat as unavailable
    if (!decl) return true;
    return decl.support_status === "unavailable";
  });
}

/**
 * getCapabilityGroupsForProvider — returns the routing group names for all planned/later
 * capabilities of a provider.
 */
export function getCapabilityGroupsForProvider(provider_id: AIProviderId): string[] {
  const map = PROVIDER_CAPABILITY_MAPS[provider_id];
  if (!map) return [];

  const GROUP_LABEL: Record<AICapability, string> = {
    text_generation:  "chat",
    chat_completion:  "chat",
    function_calling: "chat",
    embeddings:       "embeddings",
    vision:           "vision",
    ocr:              "ocr",
    image_generation: "image_generation",
    video_generation: "video_generation",
    seo_analysis:     "seo",
    meo_analysis:     "meo",
    aeo_analysis:     "aeo",
    llmo_analysis:    "llmo",
    aio_analysis:     "aio",
    social_post:      "social_post",
    analytics:        "analytics",
    reporting:        "reporting",
  };

  const seen = new Set<string>();
  for (const [cap, decl] of Object.entries(map) as [AICapability, AIProviderCapabilityDeclaration][]) {
    if (decl.support_status === "planned" || decl.support_status === "supported_later") {
      const label = GROUP_LABEL[cap];
      if (label) seen.add(label);
    }
  }
  return Array.from(seen);
}
