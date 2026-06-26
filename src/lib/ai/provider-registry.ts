// DealerOS — AI Gateway: Provider Registry
// Design only — NO runtime adapter implementation.
//
// Registry defines the metadata for each supported AI provider.
// Actual adapters are registered at Phase G implementation time.

import type { AIProviderId, AITaskType } from "./types";

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface AIProviderRegistryEntry {
  id:                AIProviderId;
  nameJa:            string;
  /** Recommended default models for this provider. */
  defaultModels:     Record<AITaskType, string>;
  /** True once the adapter module is implemented (Phase G). */
  adapterAvailable:  false;  // Locked false until implementation — prevents accidental use
  /** Settings key in dealer_ai_settings where this provider's key is stored. */
  settingsKey:       string;
  /** URL to the provider's API key management page — shown in dealer settings UI. */
  keyManagementUrl?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AI_PROVIDER_REGISTRY: AIProviderRegistryEntry[] = [
  {
    id:               "openai",
    nameJa:           "OpenAI",
    adapterAvailable: false,
    settingsKey:      "openai_api_key",
    keyManagementUrl: "https://platform.openai.com/api-keys",
    defaultModels: {
      content_writing:           "gpt-4o",
      image_analysis:            "gpt-4o",
      video_generation:          "",  // Not supported by OpenAI text API — handled separately
      review_request_generation: "gpt-4o-mini",
      review_writing_support:    "gpt-4o-mini",
      review_response_drafting:  "gpt-4o",
      keyword_extraction:        "gpt-4o-mini",
      reputation_analysis:       "gpt-4o",
    },
  },
  {
    id:               "anthropic",
    nameJa:           "Claude (Anthropic)",
    adapterAvailable: false,
    settingsKey:      "claude_api_key",
    keyManagementUrl: "https://console.anthropic.com/",
    defaultModels: {
      content_writing:           "claude-sonnet-4-6",
      image_analysis:            "claude-sonnet-4-6",
      video_generation:          "",
      review_request_generation: "claude-haiku-4-5-20251001",
      review_writing_support:    "claude-haiku-4-5-20251001",
      review_response_drafting:  "claude-sonnet-4-6",
      keyword_extraction:        "claude-haiku-4-5-20251001",
      reputation_analysis:       "claude-sonnet-4-6",
    },
  },
  {
    id:               "gemini",
    nameJa:           "Gemini (Google)",
    adapterAvailable: false,
    settingsKey:      "gemini_api_key",
    keyManagementUrl: "https://aistudio.google.com/apikey",
    defaultModels: {
      content_writing:           "gemini-1.5-pro",
      image_analysis:            "gemini-1.5-pro",
      video_generation:          "",
      review_request_generation: "gemini-flash",
      review_writing_support:    "gemini-flash",
      review_response_drafting:  "gemini-1.5-pro",
      keyword_extraction:        "gemini-flash",
      reputation_analysis:       "gemini-1.5-pro",
    },
  },
  {
    id:               "azure_openai",
    nameJa:           "Azure OpenAI",
    adapterAvailable: false,
    settingsKey:      "azure_openai_api_key",
    defaultModels: {
      content_writing:           "gpt-4o",
      image_analysis:            "gpt-4o",
      video_generation:          "",
      review_request_generation: "gpt-4o-mini",
      review_writing_support:    "gpt-4o-mini",
      review_response_drafting:  "gpt-4o",
      keyword_extraction:        "gpt-4o-mini",
      reputation_analysis:       "gpt-4o",
    },
  },
  {
    id:               "openrouter",
    nameJa:           "OpenRouter",
    adapterAvailable: false,
    settingsKey:      "openrouter_api_key",
    keyManagementUrl: "https://openrouter.ai/keys",
    defaultModels: {
      content_writing:           "anthropic/claude-sonnet-4-6",
      image_analysis:            "openai/gpt-4o",
      video_generation:          "",
      review_request_generation: "openai/gpt-4o-mini",
      review_writing_support:    "openai/gpt-4o-mini",
      review_response_drafting:  "anthropic/claude-sonnet-4-6",
      keyword_extraction:        "openai/gpt-4o-mini",
      reputation_analysis:       "anthropic/claude-sonnet-4-6",
    },
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getProviderEntry(id: AIProviderId): AIProviderRegistryEntry | undefined {
  return AI_PROVIDER_REGISTRY.find((p) => p.id === id);
}

export function getAvailableProviderIds(): AIProviderId[] {
  return AI_PROVIDER_REGISTRY.map((p) => p.id);
}
