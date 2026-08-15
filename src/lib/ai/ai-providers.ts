// DealerOS — AI provider architecture (display/config only)
// CLIENT-SAFE. Declares the providers the AI Center is architected for. Only
// OpenAI is active today; the others are prepared but disabled. Provider
// SWITCHING is intentionally NOT implemented yet — this is architecture only.
//
// See: docs/AI_API_OWNERSHIP_POLICY.md

export type AiProviderStatus = "active" | "planned";

export interface AiProviderInfo {
  id:     string;
  label:  string;
  status: AiProviderStatus;
  note:   string;
}

export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  { id: "openai",     label: "OpenAI",            status: "active",  note: "稼働中（GYEON管理キー）" },
  { id: "claude",     label: "Claude (Anthropic)",status: "planned", note: "準備中" },
  { id: "gemini",     label: "Gemini (Google)",   status: "planned", note: "準備中" },
  { id: "openrouter", label: "OpenRouter",        status: "planned", note: "将来対応" },
];
