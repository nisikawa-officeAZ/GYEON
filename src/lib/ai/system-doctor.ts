"use server";

// DealerOS — System Health / AI Doctor (Version 1.0 foundation)
// READ-ONLY diagnostics for the Developer Preview Center. It probes core
// subsystems and reports status + suggested fix. It DOES NOT perform any
// automatic repair. Auto-repair and Claude/GitHub PR generation are planned
// for Version 2.0.
//
// Super Admin only. No secrets are returned.

import { requireSuperAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGyeonAiCenterStatus } from "./gyeon-ai-center";
import { VEHICLE_REG_BUCKET } from "@/lib/vehicle-registration/storage";

export type DoctorStatus = "normal" | "warning" | "error";

export interface DoctorCard {
  key:          string;
  label:        string;
  status:       DoctorStatus;
  lastChecked:  string;          // ISO
  latestError:  string | null;
  suggestedFix: string | null;
}

export interface SystemDoctorReport {
  cards:       DoctorCard[];
  checkedAt:   string;
  roadmapNote: string;
}

// Module-local (a "use server" module may only EXPORT async functions).
const DOCTOR_ROADMAP_NOTE =
  "自動修復 および Claude/GitHub PR自動生成は Version 2.0 で予定しています。";

export async function getSystemDoctorReport(): Promise<SystemDoctorReport> {
  await requireSuperAdmin();
  const now = new Date().toISOString();
  const cards: DoctorCard[] = [];
  const supabase = createAdminClient();

  // ── Database ────────────────────────────────────────────────────────────────
  let dbErr: string | null = null;
  try {
    const { error } = await supabase.from("admin_users").select("*", { count: "exact", head: true });
    if (error) dbErr = error.message;
  } catch (e) {
    dbErr = e instanceof Error ? e.message : "接続に失敗しました";
  }
  cards.push({
    key: "database", label: "データベース",
    status: dbErr ? "error" : "normal",
    lastChecked: now, latestError: dbErr,
    suggestedFix: dbErr ? "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を確認してください。" : null,
  });

  // ── Supabase Auth ─────────────────────────────────────────────────────────────
  let authErr: string | null = null;
  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) authErr = error.message;
  } catch (e) {
    authErr = e instanceof Error ? e.message : "認証APIに接続できません";
  }
  cards.push({
    key: "auth", label: "Supabase Auth",
    status: authErr ? "error" : "normal",
    lastChecked: now, latestError: authErr,
    suggestedFix: authErr ? "サービスロールキーの権限とSupabaseの稼働状態を確認してください。" : null,
  });

  // ── Storage ───────────────────────────────────────────────────────────────────
  let storageStatus: DoctorStatus = "normal";
  let storageErr: string | null = null;
  let storageFix: string | null = null;
  try {
    const { data, error } = await supabase.storage.getBucket(VEHICLE_REG_BUCKET);
    if (error || !data) {
      storageStatus = "warning";
      storageErr = error?.message ?? "車検証用バケットが見つかりません";
      storageFix = "ストレージバケットを作成してください（docs の STORAGE セットアップ手順を参照）。";
    }
  } catch (e) {
    storageStatus = "error";
    storageErr = e instanceof Error ? e.message : "ストレージに接続できません";
    storageFix = "Supabase Storage の設定と権限を確認してください。";
  }
  cards.push({
    key: "storage", label: "ストレージ",
    status: storageStatus, lastChecked: now, latestError: storageErr, suggestedFix: storageFix,
  });

  // ── OpenAI ────────────────────────────────────────────────────────────────────
  const aiStatus = await getGyeonAiCenterStatus();
  const openaiStatus: DoctorStatus = !aiStatus.hasKey
    ? "error"
    : aiStatus.connectionState === "failed"
      ? "error"
      : aiStatus.connectionState === "success"
        ? "normal"
        : "warning";
  cards.push({
    key: "openai", label: "OpenAI",
    status: openaiStatus, lastChecked: now,
    latestError: !aiStatus.hasKey ? "APIキーが未登録です"
      : aiStatus.connectionState === "failed" ? "直近の接続テストが失敗しました" : null,
    suggestedFix: !aiStatus.hasKey ? "AIセンターでOpenAI APIキーを登録してください。"
      : aiStatus.connectionState !== "success" ? "AIセンターで接続テストを実行してください。" : null,
  });

  // ── OCR ─────────────────────────────────────────────────────────────────────
  let usageTableExists = false;
  try {
    const { error } = await supabase.from("gyeon_ai_usage_log").select("id", { head: true });
    usageTableExists = !error;
  } catch { /* table missing */ }
  let ocrStatus: DoctorStatus = "normal";
  let ocrErr: string | null = null;
  let ocrFix: string | null = null;
  if (!aiStatus.hasKey) {
    ocrStatus = "error"; ocrErr = "OpenAIキーが未登録です"; ocrFix = "AIセンターでキーを登録してください。";
  } else if (!usageTableExists) {
    ocrStatus = "warning"; ocrErr = "利用ログテーブルが未適用です"; ocrFix = "migration 095 を適用してください。";
  }
  cards.push({
    key: "ocr", label: "OCR",
    status: ocrStatus, lastChecked: now, latestError: ocrErr, suggestedFix: ocrFix,
  });

  // ── LINE Webhook (foundation — endpoint present) ────────────────────────────
  cards.push({
    key: "line_webhook", label: "LINE Webhook",
    status: "normal", lastChecked: now, latestError: null,
    suggestedFix: "署名検証エラー時はチャネルシークレット/アクセストークンを確認してください（/api/line/webhook）。",
  });

  // ── API Routes (foundation) ─────────────────────────────────────────────────
  cards.push({
    key: "api_routes", label: "API Routes",
    status: "normal", lastChecked: now, latestError: null,
    suggestedFix: "5xxが継続する場合はサーバーログとデプロイ状態を確認してください。",
  });

  // ── RLS (config-verified) ────────────────────────────────────────────────────
  cards.push({
    key: "rls", label: "RLS",
    status: "normal", lastChecked: now, latestError: null,
    suggestedFix: "新規テーブルは必ずRLSを有効化し、適切なポリシー（またはservice-role限定）を設定してください。",
  });

  return { cards, checkedAt: now, roadmapNote: DOCTOR_ROADMAP_NOTE };
}
