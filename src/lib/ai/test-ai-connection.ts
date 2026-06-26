"use server";

// DealerOS — AI Gateway: Connection Test
// Sprint 10C: API key format validation only — no network calls.
// The test_type field honestly reports "format_validation" to the UI.
// Network-level provider connection test is deferred to Phase G (adapter implementation).

import { createClient }         from "@/lib/supabase/server";
import { getCurrentDealer }     from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }   from "@/lib/plans/can-use-feature";
import { decryptApiKey }        from "./crypto";
import { validateApiKeyFormat } from "./validate-api-key";
import { getProviderEntry }     from "./provider-registry";
import type { AIProviderId }    from "./types";
import type { AiConnectionTestResult } from "./ai-settings-types";

type TestResult = AiConnectionTestResult | { success: false; error: string };

export async function testAiConnection(
  provider: AIProviderId,
): Promise<TestResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) return { success: false, error: "Pro+プランが必要です" };

  const entry = getProviderEntry(provider);
  if (!entry) return { success: false, error: "不明なプロバイダーです" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dealer_settings")
    .select("ai_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (error) return { success: false, error: "設定の読み込みに失敗しました" };

  const ai = (data?.ai_settings as Record<string, unknown>) ?? {};
  const encryptedKey = ai[entry.settingsKey] as string | undefined;
  const tested_at = new Date().toISOString();

  if (!encryptedKey) {
    return {
      success: false,
      provider,
      message: `${entry.nameJa} のAPIキーが設定されていません`,
      tested_at,
      test_type: "format_validation",
    };
  }

  const decrypted = decryptApiKey(encryptedKey);
  if (!decrypted) {
    return {
      success: false,
      provider,
      message: "APIキーの復号に失敗しました。キーを再設定してください。",
      tested_at,
      test_type: "format_validation",
    };
  }

  const formatError = validateApiKeyFormat(provider, decrypted);
  if (formatError) {
    return {
      success: false,
      provider,
      message: formatError,
      tested_at,
      test_type: "format_validation",
    };
  }

  return {
    success:   true,
    provider,
    message:   `${entry.nameJa} のAPIキー形式を確認しました`,
    tested_at,
    test_type: "format_validation",
  };
}
