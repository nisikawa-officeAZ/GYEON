"use server";

// DealerOS — Developer Preview: system diagnostics (Super Admin only)
// Read-only environment/runtime facts for the Developer Preview Center.
// No secrets. Never returns the API key.

import { requireSuperAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGyeonAiCenterStatus } from "./gyeon-ai-center";
import type { GyeonConnectionState } from "./gyeon-ai-center";

// Keep in sync with the highest supabase/migrations/*.sql file in the repo.
const REPO_LATEST_MIGRATION = "096_dev_diagnostics";
// Keep in sync with package.json "version".
const BUILD_VERSION = "0.1.0";

export interface DevDiagnostics {
  environment:      string;                 // development / production
  gitCommit:        string | null;
  buildVersion:     string;
  dbVersion:        string | null;          // PostgreSQL version (via pg_version rpc)
  migrationVersion: string;                 // repo latest migration file
  provider:         string;                 // active AI provider
  openaiStatus:     GyeonConnectionState;
  lastOcrAt:        string | null;
  lastAiRequestAt:  string | null;
  lastFailedAt:     string | null;
  lastFailedError:  string | null;
}

export async function getDevDiagnostics(): Promise<DevDiagnostics> {
  await requireSuperAdmin();

  const status = await getGyeonAiCenterStatus();

  const diag: DevDiagnostics = {
    environment:      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    gitCommit:        process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT || null,
    buildVersion:     BUILD_VERSION,
    dbVersion:        null,
    migrationVersion: REPO_LATEST_MIGRATION,
    provider:         "OpenAI",
    openaiStatus:     status.connectionState,
    lastOcrAt:        null,
    lastAiRequestAt:  null,
    lastFailedAt:     null,
    lastFailedError:  null,
  };

  try {
    const supabase = createAdminClient();

    // DB version (requires migration 096's pg_version()); fall back to null.
    try {
      const { data: ver } = await supabase.rpc("pg_version");
      if (typeof ver === "string") diag.dbVersion = ver.split(" on ")[0]; // trim to "PostgreSQL x.y"
    } catch { /* function not applied — leave null */ }

    // Last OCR
    const { data: lastOcr } = await supabase
      .from("gyeon_ai_usage_log")
      .select("created_at")
      .eq("feature_key", "vehicle_ocr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    diag.lastOcrAt = (lastOcr?.created_at as string | undefined) ?? null;

    // Last AI request (any feature)
    const { data: lastAny } = await supabase
      .from("gyeon_ai_usage_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    diag.lastAiRequestAt = (lastAny?.created_at as string | undefined) ?? null;

    // Last failed request
    const { data: lastFail } = await supabase
      .from("gyeon_ai_usage_log")
      .select("created_at,error_code")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    diag.lastFailedAt    = (lastFail?.created_at as string | undefined) ?? null;
    diag.lastFailedError = (lastFail?.error_code as string | undefined) ?? null;
  } catch {
    // usage-log table not applied — leave usage fields null
  }

  return diag;
}
