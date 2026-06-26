// DealerOS — AI Settings Platform: Profile Builders (Sprint 11R — refactored in Sprint 11V)
//
// Pure functions that construct AISettingsProfile objects from loaded data or defaults.
// Extracted from get-ai-settings-profile.ts (was "use server") so they can be imported
// by both server actions and client-side code (e.g., page.tsx fallback profile).
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AISettingsLoadResult }    from "./repository";
import type { AISettingsProfile }       from "./settings-profile-types";
import type { AIProviderConfiguration } from "./settings-profile-types";
import type { AIProviderId }            from "@/lib/ai/types";
import {
  DEFAULT_BUDGET_POLICY,
  DEFAULT_EXECUTION_PREFERENCE,
  DEFAULT_PROVIDER_SELECTION,
  buildDefaultProviderSelection,
  DEFAULT_CAPABILITY_ASSIGNMENTS,
} from "./index";
import {
  deserializeCapabilityPreferences,
  deserializeBudgetPolicy,
  deserializeExecutionPreference,
} from "./database-types";

export function buildProfileFromLoadResult(
  dealer_id:       string,
  loaded:          AISettingsLoadResult,
  currentMonthUsd: number,
): AISettingsProfile {
  const primary = loaded.primary_provider;

  const providerSelection = primary
    ? buildDefaultProviderSelection(primary)
    : { ...DEFAULT_PROVIDER_SELECTION };

  if (loaded.fallback_providers.length > 0) {
    providerSelection.fallback_providers = loaded.fallback_providers;
  }

  const capabilityAssignments =
    Object.keys(loaded.capability_preferences).length > 0
      ? deserializeCapabilityPreferences(loaded.capability_preferences)
      : { ...DEFAULT_CAPABILITY_ASSIGNMENTS };

  const budgetFromDb = deserializeBudgetPolicy(loaded.budget_policy);
  const budgetPolicy = budgetFromDb ?? {
    ...DEFAULT_BUDGET_POLICY,
    monthly_limit_usd:   loaded.monthly_limit_usd,
    auto_pause_on_limit: loaded.hard_limit,
  };

  const execPref =
    deserializeExecutionPreference(loaded.execution_preferences)
    ?? { ...DEFAULT_EXECUTION_PREFERENCE };

  const providerConfigs: Partial<Record<AIProviderId, AIProviderConfiguration>> = {};
  for (const [providerId, status] of Object.entries(loaded.provider_key_status)) {
    if (status?.has_key) {
      providerConfigs[providerId as AIProviderId] = {
        provider_id:         providerId as AIProviderId,
        is_selected:         providerId === primary,
        model_overrides:     {},
        rate_limit_rpm:      null,
        max_tokens_per_call: null,
        is_enabled:          true,
        configured_at:       status.validated_at,
      };
    }
  }

  const isConfigured = Object.keys(providerConfigs).length > 0;

  return {
    dealer_id,
    provider_selection:      providerSelection,
    provider_configurations: providerConfigs,
    capability_assignments:  capabilityAssignments,
    budget_policy:           budgetPolicy,
    execution_preference:    execPref,
    provider_health:         {},
    is_ai_enabled:           loaded.enabled && isConfigured,
    is_configured:           isConfigured,
    profile_version:         "1.1.0-persisted",
    built_at:                new Date().toISOString(),
  };
}

export function buildDefaultProfile(dealer_id: string): AISettingsProfile {
  return {
    dealer_id,
    provider_selection:      { ...DEFAULT_PROVIDER_SELECTION },
    provider_configurations: {},
    capability_assignments:  { ...DEFAULT_CAPABILITY_ASSIGNMENTS },
    budget_policy:           { ...DEFAULT_BUDGET_POLICY },
    execution_preference:    { ...DEFAULT_EXECUTION_PREFERENCE },
    provider_health:         {},
    is_ai_enabled:           false,
    is_configured:           false,
    profile_version:         "1.1.0-defaults",
    built_at:                new Date().toISOString(),
  };
}
