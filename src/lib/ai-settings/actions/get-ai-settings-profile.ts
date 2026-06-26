"use server";

// DealerOS — AI Settings Platform: Get AI Settings Profile (Sprint 11R Phase B)
//
// Security:
//   - dealer_id ALWAYS from getCurrentDealer() — never from client input
//   - Pro+ feature gate enforced server-side
//   - No raw API keys returned — only has_key: boolean per provider

import { getCurrentDealer }    from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }  from "@/lib/plans/can-use-feature";
import { AI_SETTINGS_REPOSITORY_FACTORY } from "../repository";
import type { AISettingsLoadResult }      from "../repository";
import { settingsOk, settingsFail }       from "../errors";
import type { AISettingsResult }          from "../errors";
import type { AISettingsProfile }         from "../settings-profile-types";
import type { AIProviderConfiguration }   from "../settings-profile-types";
import type { AIProviderId }              from "@/lib/ai/types";
import {
  DEFAULT_BUDGET_POLICY,
  DEFAULT_EXECUTION_PREFERENCE,
  DEFAULT_PROVIDER_SELECTION,
  buildDefaultProviderSelection,
  DEFAULT_CAPABILITY_ASSIGNMENTS,
} from "../index";
import {
  deserializeCapabilityPreferences,
  deserializeBudgetPolicy,
  deserializeExecutionPreference,
} from "../database-types";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * getAISettingsProfile — loads the dealer's complete AI settings profile.
 *
 * Combines basic config (dealer_settings.ai_settings) with extended config
 * (dealer_ai_settings table if available) into a single AISettingsProfile.
 *
 * Returns MIGRATION_REQUIRED as a soft failure — callers receive a defaults-based
 * profile rather than an empty error, so the UI can render with safe defaults.
 * Returns FEATURE_NOT_LICENSED if the dealer is not on Pro+.
 * Returns AUTHENTICATION_FAILED if not authenticated.
 */
export async function getAISettingsProfile(): Promise<AISettingsResult<AISettingsProfile>> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return settingsFail("AUTHENTICATION_FAILED", "Not authenticated");
  }

  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) {
    return settingsFail(
      "FEATURE_NOT_LICENSED",
      "AI Settings require Pro+ plan",
      { feature: "ai_gateway" },
    );
  }

  const settingsRepo = AI_SETTINGS_REPOSITORY_FACTORY.createSettingsRepository();
  const usageRepo    = AI_SETTINGS_REPOSITORY_FACTORY.createUsageRepository();

  const loadResult = await settingsRepo.load(dealer.dealer_id);

  if (!loadResult.ok) {
    if (loadResult.error.code === "MIGRATION_REQUIRED") {
      return settingsOk(buildDefaultProfile(dealer.dealer_id));
    }
    return loadResult;
  }

  const currentMonthUsd = await usageRepo.getMonthlySpend(
    dealer.dealer_id,
    currentPeriod(),
  );

  return settingsOk(buildProfileFromLoadResult(dealer.dealer_id, loadResult.value, currentMonthUsd));
}

// ─── Profile construction ─────────────────────────────────────────────────────

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
