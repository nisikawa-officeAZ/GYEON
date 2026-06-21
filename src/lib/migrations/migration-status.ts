"use server";

// PHASE61: Migration status async server functions.
// READ-ONLY. Does not apply migrations. Does not call Supabase migration API.
// Inspects database schema to infer which migrations are likely applied.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MigrationInfo,
  MigrationStatusReport,
  MigrationProbe,
  getExpectedMigrationList,
} from "./migration-types";

// ─── Schema probe runner ──────────────────────────────────────────────────────

async function runProbe(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  probe: MigrationProbe
): Promise<{ applied: boolean; note: string }> {
  try {
    if (probe.type === "table") {
      const { error } = await supabase
        .from(probe.table)
        .select("*", { count: "exact", head: true });
      if (!error) return { applied: true, note: `Table "${probe.table}" accessible` };
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { applied: false, note: `Table "${probe.table}" not found` };
      }
      // Other error (e.g. RLS restricted) — table likely exists
      return { applied: true, note: `Table "${probe.table}" exists (restricted: ${error.message})` };
    }

    if (probe.type === "column") {
      const { data, error } = await supabase
        .from(probe.table)
        .select(probe.column)
        .limit(0);
      void data;
      if (!error) return { applied: true, note: `Column "${probe.column}" on "${probe.table}" present` };
      if (error.message?.includes("does not exist") || error.message?.includes(probe.column)) {
        return { applied: false, note: `Column "${probe.column}" on "${probe.table}" not found` };
      }
      return { applied: true, note: `Column likely present (query: ${error.message})` };
    }

    if (probe.type === "seed") {
      const { data, error } = await supabase
        .from(probe.table)
        .select(probe.column)
        .eq(probe.column, probe.value)
        .limit(1);
      if (error) {
        if (error.code === "42P01") return { applied: false, note: `Table "${probe.table}" not found` };
        return { applied: false, note: `Seed check error: ${error.message}` };
      }
      if ((data ?? []).length > 0) {
        return { applied: true, note: `Seed value "${probe.value}" found in "${probe.table}"` };
      }
      return { applied: false, note: `Seed value "${probe.value}" not found — migration may not be applied` };
    }
  } catch (e) {
    return { applied: false, note: `Probe error: ${String(e)}` };
  }

  return { applied: false, note: "Unknown probe type" };
}

// ─── Async server functions ───────────────────────────────────────────────────

export async function checkDatabaseSchemaStatus(): Promise<MigrationInfo[]> {
  const supabase = await createAdminClient();
  const expected = getExpectedMigrationList();
  const results: MigrationInfo[] = [];

  for (const m of expected) {
    const { applied, note } = await runProbe(supabase, m.probe);
    results.push({
      ...m,
      schemaLikelyApplied: applied,
      status:  applied ? "applied" : "missing",
      note,
    });
  }

  return results;
}

export async function getMigrationReadinessStatus(): Promise<MigrationStatusReport> {
  const migrations = await checkDatabaseSchemaStatus();

  const missingCount = migrations.filter(m => m.status === "missing").length;
  const unknownCount = migrations.filter(m => m.status === "unknown").length;

  const overall: MigrationStatusReport["overall"] =
    missingCount > 0 ? "blocked" :
    unknownCount > 0 ? "warning" :
    "ready";

  return {
    overall,
    migrations,
    checkedAt: new Date().toISOString(),
  };
}
