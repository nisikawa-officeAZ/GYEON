"use server";

// DealerOS — AI Gateway: Readiness Check
// All future AI features must call checkAiGatewayReady() before executing.
// Security: dealer_id from getCurrentDealer() only.

import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess } from "@/lib/plans/can-use-feature";
import { getProviderEntry }   from "./provider-registry";
import type { AIProviderId }  from "./types";
import type { AIGatewayStatus } from "./ai-settings-types";

export interface AIGatewayReadiness {
  status:   AIGatewayStatus;
  provider: AIProviderId | null;
  message:  string;
}

/**
 * Check whether the AI Gateway is fully ready for a dealer.
 * All AI features (ai_marketing, ai_reputation, ai_growth) must verify "ready" before execution.
 */
export async function checkAiGatewayReady(): Promise<AIGatewayReadiness> {
  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) {
    return {
      status:   "not_pro_plus",
      provider: null,
      message:  "AI Gatewayは Pro+ プランが必要です",
    };
  }

  const dealer = await getCurrentDealer();
  if (!dealer) {
    return { status: "not_configured", provider: null, message: "認証エラー" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dealer_settings")
    .select("ai_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (error?.code === "42703") {
    return {
      status:   "migration_required",
      provider: null,
      message:  "データベースのアップデートが必要です（管理者にお問い合わせください）",
    };
  }

  const ai = (data?.ai_settings as Record<string, unknown>) ?? {};
  const provider = (ai.primary_provider as AIProviderId) ?? null;

  if (!provider) {
    return {
      status:   "not_configured",
      provider: null,
      message:  "AIプロバイダーが設定されていません",
    };
  }

  if (ai.enabled === false) {
    return {
      status:   "disabled",
      provider,
      message:  "AI Gatewayが無効化されています",
    };
  }

  const entry = getProviderEntry(provider);
  const hasKey = entry &&
    typeof ai[entry.settingsKey] === "string" &&
    (ai[entry.settingsKey] as string).length > 0;

  if (!hasKey) {
    return {
      status:   "no_key",
      provider,
      message:  `${entry?.nameJa ?? provider} のAPIキーが設定されていません`,
    };
  }

  return { status: "ready", provider, message: "AI Gatewayは設定済みです" };
}
