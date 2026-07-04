"use server";

// DealerOS — AI Center: GYEON-managed OpenAI key management (Super Admin only)
// SERVER ACTIONS. Security invariants:
//   - requireSuperAdmin() gate on every action (defense in depth; the page also gates).
//   - The raw key is NEVER returned to the client and NEVER logged.
//   - The key is stored AES-256-GCM encrypted in gyeon_ai_settings (service-role only).
//   - Status reads return a MASKED representation only ("sk-...****").
//
// See: docs/AI_API_OWNERSHIP_POLICY.md

import { requireSuperAdmin }   from "@/lib/admin/require-admin";
import { createAdminClient }   from "@/lib/supabase/admin";
import { getCurrentUser }      from "@/lib/auth/get-current-user";
import { writeAuditLog }       from "@/lib/admin/write-audit-log";
import { encryptApiKey, isEncryptionConfigured } from "./crypto";
import { validateApiKeyFormat } from "./validate-api-key";
import { getGyeonManagedApiKey } from "./gyeon-managed-key";

const MASKED_KEY = "sk-...****";
const TEST_TIMEOUT_MS = 10_000;

export type GyeonConnectionState = "unset" | "success" | "failed";

export interface GyeonAiCenterStatus {
  /** True when a GYEON-managed key is resolvable (DB or env fallback). */
  hasKey: boolean;
  /** Masked key for display — never the raw key. null when no key. */
  maskedKey: string | null;
  /** Where the resolved key comes from. */
  source: "db" | "env" | null;
  /** ISO timestamp of the last connection test, or null. */
  lastTestedAt: string | null;
  /** Result of the last connection test. */
  lastTestStatus: "success" | "failed" | null;
  /** DEALER_AI_KEY_SECRET present — required to persist a DB key. */
  encryptionConfigured: boolean;
  /** 未設定 / 接続成功 / 接続失敗 for the UI badge. */
  connectionState: GyeonConnectionState;
}

export interface GyeonAiUsageSummary {
  /** Total OCR usage-log rows. */
  total:      number;
  success:    number;
  failed:     number;
  /** ISO timestamp of the most recent OCR usage row, or null. */
  lastUsedAt: string | null;
}

type ActionResult = { success: true } | { success: false; error: string };

/** Read the AI Center status. Super Admin only. Never returns the raw key. */
export async function getGyeonAiCenterStatus(): Promise<GyeonAiCenterStatus> {
  await requireSuperAdmin();

  const key = await getGyeonManagedApiKey();
  const hasKey = key.ok;
  const source = key.ok ? key.source : null;

  let lastTestedAt: string | null = null;
  let lastTestStatus: "success" | "failed" | null = null;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("gyeon_ai_settings")
      .select("last_tested_at, last_test_status")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      lastTestedAt   = (data.last_tested_at as string | null) ?? null;
      lastTestStatus = (data.last_test_status as "success" | "failed" | null) ?? null;
    }
  } catch {
    // Table may not exist yet — treat as no test history.
  }

  const connectionState: GyeonConnectionState = !hasKey
    ? "unset"
    : (lastTestStatus ?? "unset");

  return {
    hasKey,
    maskedKey: hasKey ? MASKED_KEY : null,
    source,
    lastTestedAt,
    lastTestStatus,
    encryptionConfigured: isEncryptionConfigured(),
    connectionState,
  };
}

/**
 * Minimal usage summary for the AI Center (vehicle_registration_ocr feature).
 * Super Admin only. Returns zeros if the usage-log table is not yet applied.
 */
export async function getGyeonAiUsageSummary(): Promise<GyeonAiUsageSummary> {
  await requireSuperAdmin();
  const empty: GyeonAiUsageSummary = { total: 0, success: 0, failed: 0, lastUsedAt: null };

  try {
    const supabase = createAdminClient();
    const feature = "vehicle_ocr"; // matches the log label written in actions.ts
    const [totalRes, successRes, failedRes, lastRes] = await Promise.all([
      supabase.from("gyeon_ai_usage_log").select("*", { count: "exact", head: true }).eq("feature_key", feature),
      supabase.from("gyeon_ai_usage_log").select("*", { count: "exact", head: true }).eq("feature_key", feature).eq("status", "success"),
      supabase.from("gyeon_ai_usage_log").select("*", { count: "exact", head: true }).eq("feature_key", feature).eq("status", "failed"),
      supabase.from("gyeon_ai_usage_log").select("created_at").eq("feature_key", feature).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // If the table is missing, count queries carry an error — fall back to zeros.
    if (totalRes.error || successRes.error || failedRes.error) return empty;

    return {
      total:      totalRes.count ?? 0,
      success:    successRes.count ?? 0,
      failed:     failedRes.count ?? 0,
      lastUsedAt: (lastRes.data?.created_at as string | undefined) ?? null,
    };
  } catch {
    return empty;
  }
}

/** Register / update the GYEON-managed OpenAI key. Super Admin only. */
export async function saveGyeonOpenAiKey(rawKey: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();

  const trimmed = (rawKey ?? "").trim();
  const formatError = validateApiKeyFormat("openai", trimmed);
  if (formatError) return { success: false, error: formatError };

  if (!isEncryptionConfigured()) {
    return {
      success: false,
      error: "AIキー保存用の暗号化キーが未設定です。サーバー環境変数 DEALER_AI_KEY_SECRET を設定してください。",
    };
  }

  const encrypted = encryptApiKey(trimmed);
  if (!encrypted) {
    return { success: false, error: "APIキーの暗号化に失敗しました。" };
  }

  const currentUser = await getCurrentUser();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gyeon_ai_settings")
      .upsert(
        {
          id: 1,
          openai_api_key_encrypted: encrypted,
          // A newly saved key is untested until the operator runs a test.
          last_tested_at:   null,
          last_test_status: null,
          updated_by:       currentUser?.id ?? null,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) {
      // Surface the REAL Supabase error server-side (never the key) so operators
      // can see the actual cause instead of a generic message.
      console.error(
        "[AI Center] gyeon_ai_settings upsert failed —",
        "code:", error.code,
        "| message:", error.message,
        "| details:", error.details ?? "",
        "| hint:", error.hint ?? "",
      );
      const code = error.code ? `（${error.code}）` : "";
      return {
        success: false,
        error:
          `APIキーの保存に失敗しました${code}。接続中のSupabaseプロジェクトに ` +
          `gyeon_ai_settings テーブルが存在しない可能性があります。` +
          `対象プロジェクトのSQL Editorでマイグレーション094/095を適用してください。`,
      };
    }
  } catch {
    return { success: false, error: "APIキーの保存に失敗しました。" };
  }

  await writeAuditLog({
    adminUserId: admin.id,
    action:      "gyeon_ai_key_updated",
    details:     { provider: "openai" }, // never log the key
  });

  return { success: true };
}

/**
 * Run a live connection test against OpenAI using the resolved GYEON-managed key,
 * then persist the result. Super Admin only.
 */
export async function testGyeonOpenAiConnection(): Promise<
  { success: true; status: "success" | "failed"; testedAt: string } | { success: false; error: string }
> {
  const admin = await requireSuperAdmin();

  const key = await getGyeonManagedApiKey();
  if (!key.ok) {
    return { success: false, error: "APIキーが登録されていません。先にキーを登録してください。" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  let status: "success" | "failed" = "failed";
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method:  "GET",
      signal:  controller.signal,
      headers: { Authorization: `Bearer ${key.apiKey}` },
    });
    status = res.ok ? "success" : "failed";
  } catch {
    status = "failed";
  } finally {
    clearTimeout(timeoutId);
  }

  const testedAt = new Date().toISOString();

  // Persist the test result on the singleton row (works whether the key came
  // from DB or env — the row records status even for an env-sourced key).
  try {
    const supabase = createAdminClient();
    await supabase
      .from("gyeon_ai_settings")
      .upsert(
        { id: 1, last_tested_at: testedAt, last_test_status: status },
        { onConflict: "id" },
      );
  } catch {
    // Table missing — status simply isn't persisted; the test result still returns.
  }

  await writeAuditLog({
    adminUserId: admin.id,
    action:      "gyeon_ai_connection_tested",
    details:     { provider: "openai", status, source: key.source },
  });

  return { success: true, status, testedAt };
}
