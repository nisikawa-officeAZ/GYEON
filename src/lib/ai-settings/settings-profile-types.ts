// DealerOS — AI Settings Platform: Settings Profile Types (Sprint 11O Phase A)
//
// Core domain types for the AI Settings Platform canonical configuration layer.
// AISettingsProfile is the top-level in-memory representation of a dealer's
// complete AI configuration state — assembled by a server action after
// getCurrentDealer(), never from client input.
//
// Security:
//   - dealer_id always from getCurrentDealer() — never from client input
//   - No api_key, secret, or raw token fields anywhere in this module
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }             from "@/lib/ai/types";
import type { AIBudgetPolicyConfig }      from "./budget-policy";
import type { AICapabilityAssignmentMap } from "./capability-assignment";
import type { AIProviderSelectionConfig } from "./provider-selection";

// ─── Provider health ──────────────────────────────────────────────────────────

export type AIProviderHealthStatus =
  | "healthy"        // Last check succeeded; provider responded within latency threshold
  | "degraded"       // Last check succeeded with elevated latency or partial failure
  | "unreachable"    // Last check could not reach the provider endpoint
  | "not_checked"    // Health check has not been performed for this provider
  | "key_invalid"    // Last check failed with authentication error
  | "rate_limited";  // Last check failed with rate limit response

export interface AIProviderHealth {
  provider_id:   AIProviderId;
  status:        AIProviderHealthStatus;
  /** Latency in milliseconds from the last health check. null if not_checked. */
  latency_ms:    number | null;
  /** ISO 8601 timestamp of the last health check attempt. null if never checked. */
  last_checked:  string | null;
  /** English user-readable description. No raw provider error messages. */
  error_message: string | null;
}

export type AIProviderHealthMap = Partial<Record<AIProviderId, AIProviderHealth>>;

// ─── Execution preference ─────────────────────────────────────────────────────

export type AIExecutionPreferenceMode =
  | "quality"   // Prioritize response quality; may be slower and costlier
  | "cost"      // Prioritize cost efficiency
  | "speed"     // Prioritize low latency
  | "balanced"; // Balance cost, quality, and speed

export interface AIExecutionPreference {
  mode:              AIExecutionPreferenceMode;
  prefer_streaming:  boolean;
  /** Maximum acceptable latency per step in ms. null = no constraint. */
  max_latency_ms:    number | null;
  /** Minimum acceptable quality tier. null = no constraint. */
  quality_threshold: "good" | "better" | "best" | null;
}

export const DEFAULT_EXECUTION_PREFERENCE: AIExecutionPreference = {
  mode:              "balanced",
  prefer_streaming:  false,
  max_latency_ms:    null,
  quality_threshold: null,
};

// ─── Per-provider configuration ───────────────────────────────────────────────

export interface AIProviderConfiguration {
  provider_id:         AIProviderId;
  /** Dealer explicitly selected this provider for use. */
  is_selected:         boolean;
  /** Dealer-configured model overrides per task type key. Empty = use gateway defaults. */
  model_overrides:     Partial<Record<string, string>>;
  /** Optional requests-per-minute cap. null = no dealer-side rate limiting. */
  rate_limit_rpm:      number | null;
  /** Optional per-call token cap override. null = use provider defaults. */
  max_tokens_per_call: number | null;
  /** Dealer can disable a configured provider without deleting its key. */
  is_enabled:          boolean;
  /** ISO 8601 timestamp of when this provider was first configured. null if unconfigured. */
  configured_at:       string | null;
}

// ─── Provider priority ────────────────────────────────────────────────────────

export interface AIProviderPriority {
  /** Ordered list of provider IDs, index 0 = highest priority. */
  ordered:      AIProviderId[];
  last_updated: string;  // ISO 8601
}

// ─── Settings profile ─────────────────────────────────────────────────────────

/**
 * AISettingsProfile — canonical in-memory representation of a dealer's
 * complete AI configuration state.
 *
 * Assembled by a server action that calls getCurrentDealer() and loads
 * the dealer's ai_settings from the database. Never constructed from
 * client input directly.
 */
export interface AISettingsProfile {
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:               string;
  provider_selection:      AIProviderSelectionConfig;
  /** Per-provider configuration entries. Only configured providers have entries. */
  provider_configurations: Partial<Record<AIProviderId, AIProviderConfiguration>>;
  capability_assignments:  AICapabilityAssignmentMap;
  budget_policy:           AIBudgetPolicyConfig;
  execution_preference:    AIExecutionPreference;
  provider_health:         AIProviderHealthMap;
  /** true when the dealer has AI features enabled in their account. */
  is_ai_enabled:           boolean;
  /** true when at least one provider is configured with a stored key. */
  is_configured:           boolean;
  profile_version:         string;
  /** ISO 8601 timestamp of when this profile was built. */
  built_at:                string;
}

// ─── Platform descriptor ──────────────────────────────────────────────────────

export interface AISettingsPlatformDescriptor {
  version:                string;
  /** true from Sprint 11R — repository + server actions implemented. */
  settings_available:     boolean;
  settings_target_sprint: string;
  supported_providers:    number;
  supported_capabilities: number;
}

export const AI_SETTINGS_PLATFORM: AISettingsPlatformDescriptor = {
  version:                "1.1.0-persisted",
  settings_available:     true,
  settings_target_sprint: "Sprint 11R",
  supported_providers:    5,
  supported_capabilities: 16,
};
