// DealerOS — AI Gateway: Provider Registry
// Design only — NO runtime adapter implementation.
//
// Registry defines the metadata for each supported AI provider.
// Actual adapters are registered at Phase G implementation time.

import type { AIProviderId, AITaskType } from "./types";

// ─── Capabilities ─────────────────────────────────────────────────────────────

export type AICapability =
  | "text_generation"   // Generate natural language text
  | "chat_completion"   // Multi-turn conversation
  | "vision"            // Image understanding / OCR
  | "image_generation"  // Create images from text
  | "video_generation"  // Create video content
  | "embeddings"        // Vector embeddings for search
  | "function_calling"; // Structured tool use / JSON output

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface AIProviderRegistryEntry {
  id:                AIProviderId;
  nameJa:            string;
  descJa:            string;
  capabilities:      AICapability[];
  /** Recommended default models for this provider. */
  defaultModels:     Record<AITaskType, string>;
  /** True once the adapter module is implemented (Phase G). */
  adapterAvailable:  false;  // Locked false until implementation — prevents accidental use
  /** Settings key in dealer_settings.ai_settings where this provider's key is stored. */
  settingsKey:       string;
  /** URL to the provider's API key management page — shown in dealer settings UI. */
  keyManagementUrl?: string;
  /** Whether an additional endpoint URL is required (Azure OpenAI only). */
  requiresEndpoint:  boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AI_PROVIDER_REGISTRY: AIProviderRegistryEntry[] = [
  {
    id:               "openai",
    nameJa:           "OpenAI",
    descJa:           "GPT-4o / GPT-4o mini。テキスト生成・画像理解・コンテンツ作成に最適。",
    capabilities:     ["text_generation", "chat_completion", "vision", "embeddings", "function_calling"],
    adapterAvailable: false,
    requiresEndpoint: false,
    settingsKey:      "openai_api_key",
    keyManagementUrl: "https://platform.openai.com/api-keys",
    defaultModels: {
      content_writing:           "gpt-4o",
      image_analysis:            "gpt-4o",
      video_generation:          "",  // Not natively supported by text API
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
    descJa:           "Claude Sonnet / Haiku。長文生成・レビュー対応文・コンテンツ品質に優れる。",
    capabilities:     ["text_generation", "chat_completion", "vision", "function_calling"],
    adapterAvailable: false,
    requiresEndpoint: false,
    settingsKey:      "anthropic_api_key",
    keyManagementUrl: "https://console.anthropic.com/settings/keys",
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
    descJa:           "Gemini 1.5 Pro / Flash。マルチモーダル・高速・コスト効率に優れる。",
    capabilities:     ["text_generation", "chat_completion", "vision", "embeddings", "function_calling"],
    adapterAvailable: false,
    requiresEndpoint: false,
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
    descJa:           "Microsoft Azure 上の OpenAI モデル。企業コンプライアンス対応ディーラー向け。",
    capabilities:     ["text_generation", "chat_completion", "vision", "embeddings", "function_calling"],
    adapterAvailable: false,
    requiresEndpoint: true,  // Azure requires a custom endpoint URL
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
    descJa:           "1つのAPIキーで100以上のモデルにアクセス。複数プロバイダーを1本化したいディーラー向け。",
    capabilities:     ["text_generation", "chat_completion", "vision", "image_generation", "function_calling"],
    adapterAvailable: false,
    requiresEndpoint: false,
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
