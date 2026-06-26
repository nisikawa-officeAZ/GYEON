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
import { settingsOk, settingsFail }       from "../errors";
import type { AISettingsResult }          from "../errors";
import type { AISettingsProfile }         from "../settings-profile-types";
import {
  buildProfileFromLoadResult,
  buildDefaultProfile,
} from "../profile-builders";

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

// buildProfileFromLoadResult and buildDefaultProfile are in ../profile-builders
// (non-"use server" file) — re-exported from actions/index.ts
