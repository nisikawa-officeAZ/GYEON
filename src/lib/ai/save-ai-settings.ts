"use server";

// DealerOS — AI Gateway: Save Dealer AI Settings
// Security:
//   - dealer_id from getCurrentDealer() only — never from client
//   - API key encrypted with AES-256-GCM before storage (DEALER_AI_KEY_SECRET)
//   - Raw key is NEVER stored in logs or returned to caller after this function
//   - Pro+ feature gate enforced server-side

import { createClient }           from "@/lib/supabase/server";
import { getCurrentDealer }       from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }     from "@/lib/plans/can-use-feature";
import { encryptApiKey, isEncryptionConfigured } from "./crypto";
import { getProviderEntry }       from "./provider-registry";
import { validateApiKeyFormat }   from "./validate-api-key";
import type { AiSettingsSaveInput } from "./ai-settings-types";

export async function saveAiSettings(
  input: AiSettingsSaveInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

  if (!isEncryptionConfigured()) {
    return {
      success: false,
      error: "APIキーの暗号化設定が未完了です。環境変数 DEALER_AI_KEY_SECRET（64桁 hex）を設定してください。",
    };
  }

  const providerEntry = getProviderEntry(input.provider);
  if (!providerEntry) return { success: false, error: "不明なプロバイダーです" };

  if (input.api_key.trim()) {
    const formatError = validateApiKeyFormat(input.provider, input.api_key);
    if (formatError) return { success: false, error: formatError };
  }

  if (input.provider === "azure_openai" && !input.azure_endpoint?.trim()) {
    return { success: false, error: "Azure OpenAI を使用するにはエンドポイント URL が必要です" };
  }

  if (input.monthly_limit_usd < 0) {
    return { success: false, error: "月間上限は 0 以上の値を入力してください（0 = 無制限）" };
  }

  const supabase = await createClient();

  let currentAi: Record<string, unknown> = {};

  const { data: existing, error: readError } = await supabase
    .from("dealer_settings")
    .select("ai_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (readError?.code === "42703") {
    return {
      success: false,
      error: "AI設定の保存には、データベースの更新（マイグレーション）が必要です。管理者にお問い合わせください。",
    };
  }
  if (readError) return { success: false, error: "設定の読み込みに失敗しました" };

  currentAi = (existing?.ai_settings as Record<string, unknown>) ?? {};

  const updated: Record<string, unknown> = {
    ...currentAi,
    enabled:            input.enabled,
    primary_provider:   input.provider,
    monthly_limit_usd:  Math.max(0, Number(input.monthly_limit_usd.toFixed(2))),
    hard_limit:         input.hard_limit,
  };

  if (input.api_key.trim()) {
    const encrypted = encryptApiKey(input.api_key.trim());
    if (!encrypted) return { success: false, error: "APIキーの暗号化に失敗しました" };
    updated[providerEntry.settingsKey] = encrypted;
    updated[`${input.provider}_validated_at`] = new Date().toISOString();
  }

  if (input.provider === "azure_openai" && input.azure_endpoint?.trim()) {
    updated.azure_openai_endpoint = input.azure_endpoint.trim();
  }

  const { error: updateError } = await supabase
    .from("dealer_settings")
    .update({ ai_settings: updated, updated_at: new Date().toISOString() })
    .eq("dealer_id", dealer.dealer_id);

  if (updateError?.code === "42703") {
    return {
      success: false,
      error: "AI設定の保存には、データベースの更新（マイグレーション）が必要です。管理者にお問い合わせください。",
    };
  }
  if (updateError) return { success: false, error: "設定の保存に失敗しました" };

  return { success: true };
}
