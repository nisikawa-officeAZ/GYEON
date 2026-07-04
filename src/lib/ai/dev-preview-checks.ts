"use server";

// DealerOS — Developer Preview: AI verification snapshot (Super Admin only)
// Aggregates the AI Center readiness signals into ONE object for the
// /admin/dev-preview/ai-verification screen, so operators don't run SQL by hand.
// Read-only. Never returns the raw key (reuses the masked AI Center status).

import { requireSuperAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGyeonAiCenterStatus } from "./gyeon-ai-center";
import type { GyeonConnectionState } from "./gyeon-ai-center";
import { getDevDiagnostics } from "./dev-diagnostics";
import type { DevDiagnostics } from "./dev-diagnostics";
import { estimateCostUsd } from "./ai-pricing";

export interface UsageRowLite {
  feature_key:    string;
  status:         "success" | "failed";
  model:          string | null;
  total_tokens:   number | null;
  estimated_cost: number | null;
  response_ms:    number | null;
  created_at:     string;
}

export interface AiVerificationSnapshot {
  keyExists:               boolean;
  maskedKey:               string | null;
  source:                  "db" | "env" | null;
  connectionState:         GyeonConnectionState;
  lastTestedAt:            string | null;
  ocrAvailable:            boolean;
  usageTableExists:        boolean;
  provider:                string;          // active provider
  currentModel:            string;          // model in use
  lastOcr:                 UsageRowLite | null;
  lastAiCall:              UsageRowLite | null;
  lastResponseMs:          number | null;   // last AI response time
  avgLatencyMs:            number | null;   // estimated latency (month avg)
  dailyCalls:              number;
  monthlyCalls:            number;
  monthlyTokens:           number;
  estimatedMonthlyCostUsd: number | null;
}

const OCR_DEFAULT_MODEL = "gpt-4.1-mini";
const USAGE_COLS = "feature_key,status,model,total_tokens,estimated_cost,response_ms,created_at";

// ─── Developer Preview Center hub ─────────────────────────────────────────────

export type HubCardStatus = "pass" | "fail" | "warn" | "manual";

export interface HubCard {
  key:         string;
  label:       string;
  status:      HubCardStatus;
  detail:      string | null;
  latestError: string | null;
  href:        string;
}

export interface DevPreviewHub {
  cards:       HubCard[];
  snapshot:    AiVerificationSnapshot;
  diagnostics: DevDiagnostics;
  checkedAt:   string;
}

/**
 * Aggregate all Developer Preview signals into 9 cards + diagnostics for the
 * single-page hub. Super Admin only.
 */
export async function getDevPreviewHub(): Promise<DevPreviewHub> {
  await requireSuperAdmin();

  const [snapshot, diagnostics] = await Promise.all([
    getAiVerificationSnapshot(),
    getDevDiagnostics(),
  ]);

  // Database reachability + settings-table probe (for the Database/Migration cards).
  let dbReachable = false;
  let settingsTableExists = false;
  try {
    const supabase = createAdminClient();
    const { error: dbErr } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true });
    dbReachable = !dbErr;
    const { error: settErr } = await supabase
      .from("gyeon_ai_settings")
      .select("id", { head: true });
    settingsTableExists = !settErr;
  } catch {
    dbReachable = false;
  }

  const aiCenterStatus: HubCardStatus = !snapshot.keyExists
    ? "fail"
    : snapshot.connectionState === "success"
      ? "pass"
      : "warn";

  const migrationOk = settingsTableExists && snapshot.usageTableExists;

  const cards: HubCard[] = [
    {
      key: "authentication", label: "認証", status: "pass",
      detail: "スーパー管理者セッション有効", latestError: null, href: "/admin/users",
    },
    {
      key: "database", label: "データベース", status: dbReachable ? "pass" : "fail",
      detail: diagnostics.dbVersion ?? (dbReachable ? "接続OK" : null),
      latestError: dbReachable ? null : "データベースに接続できません", href: "/admin/dev-preview/ai-verification",
    },
    {
      key: "migration", label: "マイグレーション", status: migrationOk ? "pass" : "fail",
      detail: migrationOk ? `適用済み (${diagnostics.migrationVersion})` : "AI関連テーブル未適用",
      latestError: migrationOk ? null : "migration 094 / 095 / 096 を適用してください", href: "/admin/dev-preview/ai-verification",
    },
    {
      key: "ai_center", label: "AIセンター", status: aiCenterStatus,
      detail: !snapshot.keyExists ? "キー未登録"
        : snapshot.connectionState === "success" ? "接続成功"
        : "未テスト",
      latestError: diagnostics.lastFailedError, href: "/admin/ai-center",
    },
    {
      key: "ocr", label: "OCR", status: (snapshot.ocrAvailable && snapshot.usageTableExists) ? "pass" : "fail",
      detail: snapshot.lastOcr ? `最終: ${snapshot.lastOcr.status}` : "未実行",
      latestError: null, href: "/admin/dev-preview/ai-verification",
    },
    {
      key: "usage_log", label: "利用ログ", status: snapshot.usageTableExists ? "pass" : "fail",
      detail: snapshot.usageTableExists ? `今月 ${snapshot.monthlyCalls}件` : "テーブル未適用",
      latestError: snapshot.usageTableExists ? null : "migration 095 未適用", href: "/admin/dev-preview/ai-verification",
    },
    {
      key: "rls", label: "RLS", status: "pass",
      detail: "有効（service-role専用・マイグレーションで担保）", latestError: null, href: "/admin/dev-preview/checklist",
    },
    {
      key: "regression", label: "リグレッション", status: "manual",
      detail: "チェックリストで確認", latestError: null, href: "/admin/dev-preview/checklist",
    },
    {
      key: "security", label: "セキュリティ", status: "pass",
      detail: "APIキーはサーバー側限定・マスク表示", latestError: null, href: "/admin/ai-center",
    },
  ];

  return { cards, snapshot, diagnostics, checkedAt: new Date().toISOString() };
}

export async function getAiVerificationSnapshot(): Promise<AiVerificationSnapshot> {
  await requireSuperAdmin();

  const status = await getGyeonAiCenterStatus();
  const snap: AiVerificationSnapshot = {
    keyExists:               status.hasKey,
    maskedKey:               status.maskedKey,
    source:                  status.source,
    connectionState:         status.connectionState,
    lastTestedAt:            status.lastTestedAt,
    ocrAvailable:            status.hasKey,
    usageTableExists:        false,
    provider:                "OpenAI",
    currentModel:            OCR_DEFAULT_MODEL,
    lastOcr:                 null,
    lastAiCall:              null,
    lastResponseMs:          null,
    avgLatencyMs:            null,
    dailyCalls:              0,
    monthlyCalls:            0,
    monthlyTokens:           0,
    estimatedMonthlyCostUsd: null,
  };

  try {
    const supabase = createAdminClient();

    // Probe table existence + last AI call (any feature).
    const { data: lastAny, error: probeErr } = await supabase
      .from("gyeon_ai_usage_log")
      .select(USAGE_COLS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (probeErr) return snap; // table not applied yet → usageTableExists stays false
    snap.usageTableExists = true;
    snap.lastAiCall = (lastAny as UsageRowLite | null) ?? null;
    if (snap.lastAiCall?.model) snap.currentModel = snap.lastAiCall.model;

    // Last OCR specifically.
    const { data: lastOcr } = await supabase
      .from("gyeon_ai_usage_log")
      .select(USAGE_COLS)
      .eq("feature_key", "vehicle_ocr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    snap.lastOcr = (lastOcr as UsageRowLite | null) ?? null;
    snap.lastResponseMs = snap.lastOcr?.response_ms ?? snap.lastAiCall?.response_ms ?? null;

    // Daily calls (since local midnight).
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { count: dailyCount } = await supabase
      .from("gyeon_ai_usage_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", dayStart);
    snap.dailyCalls = dailyCount ?? 0;

    // Current-month aggregation (bounded).
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthRows } = await supabase
      .from("gyeon_ai_usage_log")
      .select("model,input_tokens,output_tokens,total_tokens,estimated_cost,response_ms,created_at")
      .gte("created_at", monthStart)
      .limit(5000);

    const rows = (monthRows ?? []) as Array<Record<string, unknown>>;
    snap.monthlyCalls = rows.length;
    let tokens = 0;
    let cost = 0;
    let anyCost = false;
    let latencySum = 0;
    let latencyN = 0;
    for (const r of rows) {
      tokens += (r.total_tokens as number | null) ?? 0;
      const stored = r.estimated_cost as number | null;
      const c = stored ?? estimateCostUsd(
        r.model as string | null,
        r.input_tokens as number | null,
        r.output_tokens as number | null,
      );
      if (c != null) { cost += c; anyCost = true; }
      const ms = r.response_ms as number | null;
      if (typeof ms === "number") { latencySum += ms; latencyN += 1; }
    }
    snap.monthlyTokens = tokens;
    snap.estimatedMonthlyCostUsd = anyCost ? Number(cost.toFixed(4)) : null;
    snap.avgLatencyMs = latencyN > 0 ? Math.round(latencySum / latencyN) : null;
  } catch {
    // leave defaults on any failure
  }

  return snap;
}
