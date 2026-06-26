"use server";

// DealerOS — AI Settings Platform: Get AI Usage Summary (Sprint 11R Phase B)
//
// Returns the current dealer's AI usage summary for a given billing period.
// When dealer_ai_usage_log table is not yet available (migration 073 pending),
// returns an empty summary with table_available: false rather than failing.
//
// Security:
//   - dealer_id ALWAYS from getCurrentDealer() — never from client input
//   - Pro+ feature gate enforced server-side

import { getCurrentDealer }    from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }  from "@/lib/plans/can-use-feature";
import { AI_SETTINGS_REPOSITORY_FACTORY } from "../repository";
import type { AIUsageSummaryResult }      from "../repository";
import { settingsOk, settingsFail }       from "../errors";
import type { AISettingsResult }          from "../errors";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * getAIUsageSummary — returns AI usage data for the current (or specified) billing period.
 *
 * Period format: "YYYY-MM" (e.g. "2026-06"). Defaults to current month.
 * Returns an empty summary if dealer_ai_usage_log does not exist (migration 073 pending).
 */
export async function getAIUsageSummary(
  period?: string,
): Promise<AISettingsResult<AIUsageSummaryResult>> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return settingsFail("AUTHENTICATION_FAILED", "Not authenticated");
  }

  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) {
    return settingsFail(
      "FEATURE_NOT_LICENSED",
      "AI usage data requires Pro+ plan",
      { feature: "ai_gateway" },
    );
  }

  const targetPeriod = period ?? currentPeriod();

  if (!/^\d{4}-\d{2}$/.test(targetPeriod)) {
    return settingsFail(
      "VALIDATION_FAILED",
      "Period must be in YYYY-MM format",
      { period: targetPeriod },
    );
  }

  const usageRepo = AI_SETTINGS_REPOSITORY_FACTORY.createUsageRepository();
  const summary   = await usageRepo.getSummary(dealer.dealer_id, targetPeriod);

  return settingsOk(summary);
}
