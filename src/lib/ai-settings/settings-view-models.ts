// DealerOS — AI Settings Platform: Settings View Models (Sprint 11O Phase E)
//
// View models for the future AI Settings UI.
// Shapes the data displayed in provider cards, capability assignment table,
// budget panel, and health status panel.
//
// No UI is implemented in Sprint 11O. These models are ready for wiring
// in the AI Settings UI sprint.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }   from "@/lib/ai/types";
import type { AICapability }   from "@/lib/ai/capabilities";
import type { AiSettingsView } from "@/lib/ai/ai-settings-types";
import type {
  AIProviderHealthStatus,
  AISettingsProfile,
  AIExecutionPreference,
} from "./settings-profile-types";
import type { AICapabilityAssignmentStatus } from "./capability-assignment";
import type { AIBudgetStrategy }             from "./budget-policy";

// ─── Provider status card ─────────────────────────────────────────────────────

export interface AIProviderStatusCard {
  provider_id:       AIProviderId;
  display_name:      string;
  /** True if this is the dealer's primary_provider. */
  is_primary:        boolean;
  /** From AiSettingsView.providers — whether an encrypted key is stored. Never the key itself. */
  has_key_stored:    boolean;
  /** Always false in Sprint 11O — no concrete adapters yet. */
  adapter_available: false;
  health_status:     AIProviderHealthStatus;
  quality_tier:      "good" | "better" | "best";
  cost_tier:         "budget" | "standard" | "premium";
  speed_tier:        "fast" | "standard" | "slow";
  /** True if this provider is enabled in the dealer's provider configuration. */
  is_enabled:        boolean;
}

// ─── Capability assignment card ───────────────────────────────────────────────

export interface AICapabilityAssignmentCard {
  capability:          AICapability;
  /** Human-readable group label for UI display. */
  group_label:         string;
  assignment_status:   AICapabilityAssignmentStatus;
  preferred_provider:  AIProviderId | null;
  fallback_provider:   AIProviderId | null;
  /**
   * True if at least one enabled and selected provider is configured for this dealer.
   * False if no provider is configured and the capability cannot be routed.
   */
  is_actionable:       boolean;
}

// ─── Budget card ──────────────────────────────────────────────────────────────

export interface AIBudgetCard {
  monthly_limit_usd:  number;
  current_month_usd:  number;
  /** Remaining budget. null if no limit configured (monthly_limit_usd === 0). */
  remaining_usd:      number | null;
  warning_threshold:  number;
  strategy:           AIBudgetStrategy;
  is_over_warning:    boolean;
  is_over_limit:      boolean;
}

// ─── Health card ──────────────────────────────────────────────────────────────

export interface AIHealthCard {
  provider_id:   AIProviderId;
  health_status: AIProviderHealthStatus;
  latency_ms:    number | null;
  last_checked:  string | null;
  error_message: string | null;
}

// ─── Full platform view ───────────────────────────────────────────────────────

export interface AISettingsPlatformView {
  dealer_id:             string;
  provider_cards:        AIProviderStatusCard[];
  capability_cards:      AICapabilityAssignmentCard[];
  budget_card:           AIBudgetCard;
  health_cards:          AIHealthCard[];
  default_provider:      AIProviderId | null;
  fallback_providers:    AIProviderId[];
  execution_preference:  AIExecutionPreference;
  is_fully_configured:   boolean;
  /** English descriptions of missing configuration items. */
  configuration_issues:  string[];
  view_built_at:         string;  // ISO 8601
}

// ─── Static metadata ──────────────────────────────────────────────────────────

const CAPABILITY_GROUP_LABELS: Record<AICapability, string> = {
  text_generation:  "Text Generation",
  chat_completion:  "Chat",
  function_calling: "Function Calling",
  embeddings:       "Embeddings",
  vision:           "Vision",
  ocr:              "OCR",
  image_generation: "Image Generation",
  video_generation: "Video Generation",
  seo_analysis:     "SEO Analysis",
  meo_analysis:     "MEO Analysis",
  aeo_analysis:     "AEO Analysis",
  llmo_analysis:    "LLMO Analysis",
  aio_analysis:     "AIO Analysis",
  social_post:      "Social Post",
  analytics:        "Analytics",
  reporting:        "Reporting",
};

const PROVIDER_DISPLAY_NAMES: Record<AIProviderId, string> = {
  openai:       "OpenAI",
  anthropic:    "Anthropic Claude",
  gemini:       "Google Gemini",
  azure_openai: "Azure OpenAI",
  openrouter:   "OpenRouter",
};

const PROVIDER_QUALITY_TIERS: Record<AIProviderId, "good" | "better" | "best"> = {
  openai:       "better",
  anthropic:    "best",
  gemini:       "better",
  azure_openai: "better",
  openrouter:   "good",
};

const PROVIDER_COST_TIERS: Record<AIProviderId, "budget" | "standard" | "premium"> = {
  openai:       "standard",
  anthropic:    "premium",
  gemini:       "budget",
  azure_openai: "premium",
  openrouter:   "budget",
};

const PROVIDER_SPEED_TIERS: Record<AIProviderId, "fast" | "standard" | "slow"> = {
  openai:       "fast",
  anthropic:    "standard",
  gemini:       "fast",
  azure_openai: "fast",
  openrouter:   "fast",
};

const ALL_PROVIDERS: AIProviderId[] = [
  "openai", "anthropic", "gemini", "azure_openai", "openrouter",
];

const ALL_CAPABILITIES: AICapability[] = [
  "text_generation", "chat_completion", "function_calling", "embeddings",
  "vision", "ocr", "image_generation", "video_generation",
  "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
  "social_post", "analytics", "reporting",
];

// ─── View model builders ──────────────────────────────────────────────────────

export function buildProviderStatusCards(
  profile:  AISettingsProfile,
  settings: AiSettingsView,
): AIProviderStatusCard[] {
  return ALL_PROVIDERS.map((provider_id) => {
    const provider_status = settings.providers[provider_id];
    const config = profile.provider_configurations[provider_id];
    const health = profile.provider_health[provider_id];
    return {
      provider_id,
      display_name:      PROVIDER_DISPLAY_NAMES[provider_id],
      is_primary:        profile.provider_selection.primary_provider === provider_id,
      has_key_stored:    provider_status?.has_key ?? false,
      adapter_available: false as const,
      health_status:     health?.status ?? "not_checked",
      quality_tier:      PROVIDER_QUALITY_TIERS[provider_id],
      cost_tier:         PROVIDER_COST_TIERS[provider_id],
      speed_tier:        PROVIDER_SPEED_TIERS[provider_id],
      is_enabled:        config?.is_enabled ?? false,
    };
  });
}

export function buildCapabilityAssignmentCards(
  profile: AISettingsProfile,
): AICapabilityAssignmentCard[] {
  const has_any_provider =
    profile.provider_selection.primary_provider !== null || profile.is_configured;

  return ALL_CAPABILITIES.map((capability) => {
    const assignment = profile.capability_assignments[capability];
    return {
      capability,
      group_label:        CAPABILITY_GROUP_LABELS[capability],
      assignment_status:  assignment?.status ?? "preferred",
      preferred_provider: assignment?.preferred_provider
        ?? profile.provider_selection.primary_provider,
      fallback_provider:  assignment?.fallback_provider ?? null,
      is_actionable:      has_any_provider,
    };
  });
}

export function buildBudgetCard(
  profile:           AISettingsProfile,
  current_month_usd: number,
): AIBudgetCard {
  const { budget_policy } = profile;
  const limit = budget_policy.monthly_limit_usd;
  const warning_amount = limit > 0 ? limit * budget_policy.warning_threshold : null;

  return {
    monthly_limit_usd: limit,
    current_month_usd,
    remaining_usd:     limit > 0 ? Math.max(0, limit - current_month_usd) : null,
    warning_threshold: budget_policy.warning_threshold,
    strategy:          budget_policy.budget_strategy,
    is_over_warning:   warning_amount !== null && current_month_usd >= warning_amount,
    is_over_limit:     limit > 0 && current_month_usd >= limit,
  };
}

export function buildHealthCards(
  profile: AISettingsProfile,
): AIHealthCard[] {
  return ALL_PROVIDERS.map((provider_id) => {
    const health = profile.provider_health[provider_id];
    return {
      provider_id,
      health_status: health?.status ?? "not_checked",
      latency_ms:    health?.latency_ms ?? null,
      last_checked:  health?.last_checked ?? null,
      error_message: health?.error_message ?? null,
    };
  });
}

/**
 * buildSettingsPlatformView — assembles the full settings page view model.
 *
 * Takes a pre-built AISettingsProfile (from server action after getCurrentDealer())
 * and the current AiSettingsView (gateway key status from DB).
 * Returns a view-ready structure for the AI Settings page.
 *
 * current_month_usd defaults to 0 until dealer_ai_usage_log migration is available.
 */
export function buildSettingsPlatformView(
  profile:           AISettingsProfile,
  settings:          AiSettingsView,
  current_month_usd: number = 0,
  now:               string = new Date().toISOString(),
): AISettingsPlatformView {
  const issues: string[] = [];

  if (!profile.is_ai_enabled) {
    issues.push("AI features are disabled — enable AI in account settings");
  }
  if (!profile.provider_selection.primary_provider) {
    issues.push("No primary provider configured — select a provider in AI Gateway settings");
  }
  if (!profile.is_configured) {
    issues.push("No provider API key stored — add an API key in AI Gateway settings");
  }

  return {
    dealer_id:            profile.dealer_id,
    provider_cards:       buildProviderStatusCards(profile, settings),
    capability_cards:     buildCapabilityAssignmentCards(profile),
    budget_card:          buildBudgetCard(profile, current_month_usd),
    health_cards:         buildHealthCards(profile),
    default_provider:     profile.provider_selection.primary_provider,
    fallback_providers:   profile.provider_selection.fallback_providers,
    execution_preference: profile.execution_preference,
    is_fully_configured:  issues.length === 0,
    configuration_issues: issues,
    view_built_at:        now,
  };
}
