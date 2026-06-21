"use server";

// Health check service — PHASE57 Disaster Recovery
// Verifies connectivity to Supabase DB, Storage, LINE, and env vars.
// Used by admin SystemHealthCard. Does NOT throw — always returns a status object.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

export interface ComponentHealth {
  status:  HealthStatus;
  message: string;
  latency?: number; // ms
}

export interface SystemHealth {
  supabase:    ComponentHealth;
  storage:     ComponentHealth;
  line:        ComponentHealth;
  environment: ComponentHealth;
  timestamp:   string;
  overall:     HealthStatus;
}

// ─── Individual checks ────────────────────────────────────────────────────────

export async function checkSupabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("dealers").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      // Table not found is OK (migration not applied yet) — just check connectivity
      if (error.code === "42P01") {
        return { status: "warning", message: "接続OK (一部テーブル未作成)", latency };
      }
      return { status: "error", message: `DB接続エラー: ${error.message}`, latency };
    }
    return { status: "healthy", message: `接続OK (${latency}ms)`, latency };
  } catch (err) {
    return {
      status: "error",
      message: `Supabase接続失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      latency: Date.now() - start,
    };
  }
}

export async function checkStorage(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage.listBuckets();
    const latency = Date.now() - start;

    if (error) {
      return { status: "error", message: `Storage接続エラー: ${error.message}`, latency };
    }

    const bucketNames = (data ?? []).map((b) => b.name);
    const hasDocuments = bucketNames.includes("documents");

    if (!hasDocuments) {
      return {
        status: "warning",
        message: `Storage接続OK / 'documents' バケット未作成 (${latency}ms)`,
        latency,
      };
    }
    return { status: "healthy", message: `Storage接続OK (${latency}ms)`, latency };
  } catch (err) {
    return {
      status: "error",
      message: `Storage確認失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      latency: Date.now() - start,
    };
  }
}

export async function checkLine(): Promise<ComponentHealth> {
  const channelId     = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken   = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const missing: string[] = [];
  if (!channelId)     missing.push("LINE_CHANNEL_ID");
  if (!channelSecret) missing.push("LINE_CHANNEL_SECRET");
  if (!accessToken)   missing.push("LINE_CHANNEL_ACCESS_TOKEN");

  if (missing.length === 3) {
    return { status: "warning", message: "LINE未設定 (オプション機能)" };
  }
  if (missing.length > 0) {
    return { status: "warning", message: `LINE設定不完全: ${missing.join(", ")} が未設定` };
  }
  return { status: "healthy", message: "LINE環境変数 設定済み" };
}

export async function checkEnvironment(): Promise<ComponentHealth> {
  const required: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return {
      status: "error",
      message: `必須環境変数が未設定: ${missing.join(", ")}`,
    };
  }
  return { status: "healthy", message: "必須環境変数 すべて設定済み" };
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealth> {
  const [supabase, storage, line, environment] = await Promise.all([
    checkSupabase(),
    checkStorage(),
    checkLine(),
    checkEnvironment(),
  ]);

  const statuses = [supabase.status, storage.status, line.status, environment.status];
  let overall: HealthStatus = "healthy";
  if (statuses.includes("error"))   overall = "error";
  else if (statuses.includes("warning")) overall = "warning";

  return {
    supabase,
    storage,
    line,
    environment,
    timestamp: new Date().toISOString(),
    overall,
  };
}
