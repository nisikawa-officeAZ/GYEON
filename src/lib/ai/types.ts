// DealerOS — AI Gateway: Core Types
// Design only — NO runtime implementation in this file.
//
// Architecture rules (non-negotiable):
//   - Dealer owns their AI provider API key — stored in dealer_ai_settings (future migration)
//   - dealer_id is ALWAYS injected server-side from getCurrentDealer()
//   - API keys are NEVER returned to the client, NEVER logged
//   - Office AZ does not pay AI inference costs for AI agent features
//
// See: docs/master_specification/AI_GATEWAY_SPEC.md

// ─── Provider identifiers ─────────────────────────────────────────────────────

export type AIProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "azure_openai"
  | "openrouter";

// ─── Feature identifiers ──────────────────────────────────────────────────────

/** Feature keys that require an AI provider to function. */
export type AIFeatureKey =
  | "ai_marketing"
  | "ai_reputation"
  | "ai_growth"
  | "ai_video_generation"
  | "ai_review_assistant"
  | "ai_social_scheduler"
  | "ai_marketing_analytics";

/** Task categories the gateway dispatches to providers. */
export type AITaskType =
  | "content_writing"           // SNS captions, hashtags, descriptions
  | "image_analysis"            // Quality scoring, license plate/face detection
  | "video_generation"          // Marketing video from job photos
  | "review_request_generation" // LINE review request messages
  | "review_writing_support"    // Neutral prompts to help customers write reviews
  | "review_response_drafting"  // GBP review response drafts (dealer edits, posts manually)
  | "keyword_extraction"        // SEO/MEO keyword analysis
  | "reputation_analysis";      // Reputation data analysis and recommendations

// ─── Provider configuration ───────────────────────────────────────────────────

/** Resolved provider config — API key reference only, never the raw key. */
export interface AIProviderConfig {
  provider:    AIProviderId;
  model:       string;         // e.g. "gpt-4o", "claude-sonnet-4-6"
  /** Reference to the encrypted key in dealer_ai_settings — NEVER the key value. */
  key_source:  "dealer_ai_settings";
}

/** Per-task routing preference stored by the dealer. */
export interface AITaskRouting {
  task_type: AITaskType;
  provider:  AIProviderId;
  model?:    string;  // Omit to use the gateway's recommended default for the provider
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface AITextRequest {
  /** Always injected server-side from getCurrentDealer() — never from client input. */
  dealer_id:      string;
  task_type:      AITaskType;
  system_prompt?: string;
  user_prompt:    string;
  max_tokens?:    number;
  temperature?:   number;
}

export interface AITextResponse {
  content:  string;
  provider: AIProviderId;
  model:    string;
  usage: {
    prompt_tokens:     number;
    completion_tokens: number;
    total_tokens:      number;
  };
}

// ─── Key validation ───────────────────────────────────────────────────────────

export interface AIKeyValidationResult {
  valid:        boolean;
  /** User-readable error — NEVER includes the raw key or internal stack trace. */
  error?:       string;
  validated_at: string;  // ISO 8601
}

// ─── Provider adapter contract ────────────────────────────────────────────────

/**
 * Interface all AI provider adapters must satisfy.
 * Concrete implementations live in src/lib/ai/providers/ (created at Phase G implementation).
 */
export interface AIProviderAdapter {
  readonly id: AIProviderId;

  /** Validate the API key without inference. */
  validateKey(apiKey: string): Promise<AIKeyValidationResult>;

  /** Generate text content. */
  generateText(request: AITextRequest): Promise<AITextResponse>;
}
