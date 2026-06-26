// DealerOS — AI Gateway: API Key Format Validation
// Pure function — no network calls, no server context.
// Used by save-ai-settings.ts (server) and test-ai-connection.ts (server).

import type { AIProviderId } from "./types";

// Known key prefixes per provider (used for format hints, not strict enforcement)
const KEY_PREFIXES: Partial<Record<AIProviderId, string[]>> = {
  openai:     ["sk-", "sk-proj-"],
  anthropic:  ["sk-ant-"],
  gemini:     ["AIza"],
  openrouter: ["sk-or-"],
  // azure_openai: no standard prefix
};

const KEY_MIN_LENGTH: Record<AIProviderId, number> = {
  openai:       20,
  anthropic:    30,
  gemini:       30,
  azure_openai: 20,
  openrouter:   20,
};

/**
 * Validate API key format for a given provider.
 * Returns null if valid; a Japanese error message string if invalid.
 */
export function validateApiKeyFormat(
  provider: AIProviderId,
  key: string,
): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "APIキーを入力してください";

  const minLen = KEY_MIN_LENGTH[provider];
  if (trimmed.length < minLen) {
    return `APIキーが短すぎます（${provider} のキーは通常 ${minLen} 文字以上です）`;
  }

  const prefixes = KEY_PREFIXES[provider];
  if (prefixes && prefixes.length > 0) {
    const validPrefix = prefixes.some((p) => trimmed.startsWith(p));
    if (!validPrefix) {
      return `APIキーの形式が正しくない可能性があります（${prefixes[0]} で始まるキーが必要です）`;
    }
  }

  return null;
}

/** UI placeholder hint for the API key input field. */
export function getKeyPlaceholder(provider: AIProviderId): string {
  switch (provider) {
    case "openai":      return "sk-...";
    case "anthropic":   return "sk-ant-...";
    case "gemini":      return "AIza...";
    case "openrouter":  return "sk-or-...";
    case "azure_openai":return "（Azure Portal のAPIキー）";
  }
}
