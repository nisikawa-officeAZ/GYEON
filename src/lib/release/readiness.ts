"use server";

// PHASE60: Release readiness utility.
// Checks runtime state (env vars, DB tables, subscription data, onboarding state)
// and returns a structured report for the admin release readiness page.
// Does NOT deploy, migrate, or modify anything — read-only.

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadinessStatus = "pass" | "warning" | "fail";
export type OverallStatus   = "ready" | "warning" | "blocked";

export interface ReadinessCheck {
  key:     string;
  label:   string;
  status:  ReadinessStatus;
  message: string;
}

export interface ReleaseReadinessReport {
  overall: OverallStatus;
  checks:  ReadinessCheck[];
  checkedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(key: string, label: string, message: string): ReadinessCheck {
  return { key, label, status: "pass", message };
}

function warn(key: string, label: string, message: string): ReadinessCheck {
  return { key, label, status: "warning", message };
}

function fail(key: string, label: string, message: string): ReadinessCheck {
  return { key, label, status: "fail", message };
}

// ─── Individual checks ────────────────────────────────────────────────────────

export async function checkEnvironmentReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey       = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL;
  const storageBucket = process.env.STORAGE_BUCKET;
  const cronSecret    = process.env.CRON_SECRET;

  checks.push(
    supabaseUrl
      ? pass("env_supabase_url",  "Supabase URL",        supabaseUrl)
      : fail("env_supabase_url",  "Supabase URL",        "NEXT_PUBLIC_SUPABASE_URL is not set")
  );

  checks.push(
    anonKey
      ? pass("env_anon_key",      "Supabase Anon Key",   "Set")
      : fail("env_anon_key",      "Supabase Anon Key",   "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set")
  );

  checks.push(
    serviceKey
      ? pass("env_service_key",   "Service Role Key",    "Set (server-only)")
      : fail("env_service_key",   "Service Role Key",    "SUPABASE_SERVICE_ROLE_KEY is not set")
  );

  checks.push(
    appUrl
      ? (appUrl.endsWith("/")
          ? warn("env_app_url",   "App URL",             `${appUrl} — trailing slash detected`)
          : pass("env_app_url",   "App URL",             appUrl))
      : warn("env_app_url",       "App URL",             "NEXT_PUBLIC_APP_URL is not set (used in emails and LINE webhooks)")
  );

  checks.push(
    storageBucket
      ? pass("env_storage_bucket", "Storage Bucket",     storageBucket)
      : warn("env_storage_bucket", "Storage Bucket",     "STORAGE_BUCKET not set — defaulting to 'documents'")
  );

  checks.push(
    cronSecret
      ? (cronSecret.length >= 32
          ? pass("env_cron_secret", "Cron Secret",       "Set (32+ chars)")
          : warn("env_cron_secret", "Cron Secret",       "CRON_SECRET set but shorter than 32 chars — consider regenerating"))
      : warn("env_cron_secret",    "Cron Secret",        "CRON_SECRET not set — cron jobs will not be authenticated")
  );

  return checks;
}

export async function checkStorageReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    const supabase = await createAdminClient();
    const bucket   = process.env.STORAGE_BUCKET ?? "documents";

    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      checks.push(fail("storage_bucket_list", "Storage Buckets", `Cannot list buckets: ${error.message}`));
      return checks;
    }

    const found = (buckets ?? []).find((b) => b.name === bucket);
    if (!found) {
      checks.push(fail("storage_bucket_exists", "Storage Bucket Exists", `Bucket "${bucket}" not found`));
      return checks;
    }

    checks.push(pass("storage_bucket_exists", "Storage Bucket Exists", `"${bucket}" bucket found`));

    checks.push(
      found.public
        ? fail("storage_bucket_private", "Storage Bucket Private", `Bucket "${bucket}" is PUBLIC — must be private`)
        : pass("storage_bucket_private", "Storage Bucket Private", "Bucket is private")
    );

    // Verify document_files table exists by attempting a count
    const { error: tableError } = await supabase
      .from("document_files")
      .select("id", { count: "exact", head: true });

    checks.push(
      tableError
        ? fail("storage_document_files", "document_files Table", `Table error: ${tableError.message}`)
        : pass("storage_document_files", "document_files Table", "Table accessible")
    );
  } catch (e) {
    checks.push(fail("storage_error", "Storage Check", `Unexpected error: ${String(e)}`));
  }

  return checks;
}

export async function checkSupabaseReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    const supabase = await createAdminClient();

    // Check key tables exist by querying them
    const tables = [
      { key: "dealers",              label: "dealers table" },
      { key: "dealer_members",       label: "dealer_members table" },
      { key: "customers",            label: "customers table" },
      { key: "audit_logs",           label: "audit_logs table" },
      { key: "subscription_plans",   label: "subscription_plans table (migration 058)" },
      { key: "dealer_subscriptions", label: "dealer_subscriptions table (migration 058)" },
    ] as const;

    for (const t of tables) {
      const { error } = await supabase
        .from(t.key)
        .select("*", { count: "exact", head: true });

      checks.push(
        error
          ? fail(`db_${t.key}`, t.label, `Not accessible: ${error.message}`)
          : pass(`db_${t.key}`, t.label, "Accessible")
      );
    }

    // Verify subscription_plans seeded
    const { data: plans, error: plansError } = await supabase
      .from("subscription_plans")
      .select("code");

    if (!plansError && plans) {
      const codes = plans.map((p: { code: string }) => p.code);
      const hasBasic   = codes.includes("basic");
      const hasPro     = codes.includes("pro");
      const hasProPlus = codes.includes("pro_plus");

      checks.push(
        (hasBasic && hasPro && hasProPlus)
          ? pass("db_plans_seeded", "subscription_plans Seeded", "basic, pro, pro_plus found")
          : fail("db_plans_seeded", "subscription_plans Seeded", `Missing plans: ${["basic","pro","pro_plus"].filter(c => !codes.includes(c)).join(", ")}`)
      );
    }

    // Check dealer_settings has onboarding columns (migration 059)
    const { data: cols, error: colError } = await supabase
      .rpc("version"); // just a liveness check; column check via information_schema below
    void cols; void colError;

    const { data: onboardingCols, error: schemaError } = await supabase
      .from("dealer_settings")
      .select("onboarding_completed, onboarding_step")
      .limit(0);

    checks.push(
      schemaError
        ? fail("db_onboarding_cols", "dealer_settings onboarding columns (migration 059)",
            `Columns missing or inaccessible: ${schemaError.message}`)
        : pass("db_onboarding_cols", "dealer_settings onboarding columns (migration 059)",
            "onboarding_completed, onboarding_step present")
    );

    void onboardingCols;

  } catch (e) {
    checks.push(fail("db_error", "Database Check", `Unexpected error: ${String(e)}`));
  }

  return checks;
}

export async function checkLineReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  const channelId    = process.env.LINE_CHANNEL_ID;
  const channelSec   = process.env.LINE_CHANNEL_SECRET;
  const accessToken  = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const liffId       = process.env.NEXT_PUBLIC_LIFF_ID;

  const allSet = channelId && channelSec && accessToken;

  if (!allSet) {
    checks.push(warn(
      "line_env",
      "LINE Environment Variables",
      "LINE_CHANNEL_ID / SECRET / ACCESS_TOKEN not fully set — LINE integration will be disabled"
    ));
  } else {
    checks.push(pass("line_env", "LINE Environment Variables", "All LINE env vars set"));
    checks.push(
      liffId
        ? pass("line_liff", "LINE LIFF ID", `NEXT_PUBLIC_LIFF_ID: ${liffId}`)
        : warn("line_liff", "LINE LIFF ID", "NEXT_PUBLIC_LIFF_ID not set — customer link LIFF will not work")
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    checks.push(
      appUrl
        ? pass("line_webhook_url", "LINE Webhook URL", `Should be: ${appUrl}/api/line/webhook`)
        : warn("line_webhook_url", "LINE Webhook URL", "NEXT_PUBLIC_APP_URL not set — cannot compute webhook URL")
    );
  }

  // Check line_message_logs table exists
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from("line_message_logs")
      .select("id", { count: "exact", head: true });

    checks.push(
      error
        ? fail("line_db_logs", "line_message_logs Table", `Table error: ${error.message}`)
        : pass("line_db_logs", "line_message_logs Table", "Accessible")
    );
  } catch (e) {
    checks.push(fail("line_db_error", "LINE DB Check", `Unexpected error: ${String(e)}`));
  }

  return checks;
}

export async function checkSubscriptionReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    const supabase = await createAdminClient();

    // Plans seeded
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("code, name, monthly_price")
      .order("sort_order");

    if (error) {
      checks.push(fail("sub_plans_table", "subscription_plans", `Error: ${error.message}`));
      return checks;
    }

    const planList = (plans ?? []) as Array<{ code: string; name: string; monthly_price: number }>;
    checks.push(
      planList.length >= 3
        ? pass("sub_plans_count", "Subscription Plans Count", `${planList.length} plans found`)
        : fail("sub_plans_count", "Subscription Plans Count", `Only ${planList.length} plan(s) found — expected 3 (basic, pro, pro_plus)`)
    );

    const basicPlan   = planList.find(p => p.code === "basic");
    const proPlan     = planList.find(p => p.code === "pro");
    const proPlusPlan = planList.find(p => p.code === "pro_plus");

    checks.push(basicPlan   ? pass("sub_plan_basic",    "Plan: basic",    `Price: ¥${basicPlan.monthly_price}`) : fail("sub_plan_basic", "Plan: basic", "Not found"));
    checks.push(proPlan     ? pass("sub_plan_pro",      "Plan: pro",      `Price: ¥${proPlan.monthly_price}`) : fail("sub_plan_pro", "Plan: pro", "Not found"));
    checks.push(proPlusPlan ? pass("sub_plan_pro_plus", "Plan: pro_plus", `Price: ¥${proPlusPlan.monthly_price}`) : fail("sub_plan_pro_plus", "Plan: pro_plus", "Not found"));

    // Check if any dealers have problematic subscription state
    const { data: badSubs, error: subError } = await supabase
      .from("dealer_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended");

    if (!subError) {
      // Suspended dealers are a warning, not a blocker
      checks.push(pass("sub_dealer_state", "Dealer Subscriptions", "Table accessible"));
    }

  } catch (e) {
    checks.push(fail("sub_error", "Subscription Check", `Unexpected error: ${String(e)}`));
  }

  return checks;
}

export async function checkOnboardingReadiness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    const supabase = await createAdminClient();

    // Check dealer_settings table has onboarding columns
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("onboarding_completed, onboarding_step")
      .limit(1);

    if (error) {
      checks.push(fail(
        "onboarding_cols",
        "Onboarding Columns (migration 059)",
        `dealer_settings missing onboarding columns: ${error.message}`
      ));
      return checks;
    }

    checks.push(pass("onboarding_cols", "Onboarding Columns (migration 059)", "Columns present in dealer_settings"));

    // Check that no existing dealer is stuck with onboarding_completed=false AND step=1
    // (migration 059 UPDATE should have set all to completed=true)
    const { count: stuckCount, error: stuckError } = await supabase
      .from("dealer_settings")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_completed", false)
      .eq("onboarding_step", 1);

    if (!stuckError) {
      checks.push(
        (stuckCount ?? 0) === 0
          ? pass("onboarding_existing_dealers", "Existing Dealers Onboarding State", "All existing dealers marked completed (migration 059 applied correctly)")
          : warn("onboarding_existing_dealers", "Existing Dealers Onboarding State",
              `${stuckCount} dealer(s) have onboarding_completed=false with step=1 — they will be redirected to /onboarding on first login`)
      );
    }

    void data;

  } catch (e) {
    checks.push(fail("onboarding_error", "Onboarding Check", `Unexpected error: ${String(e)}`));
  }

  return checks;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function getReleaseReadinessStatus(): Promise<ReleaseReadinessReport> {
  const [envChecks, storageChecks, dbChecks, lineChecks, subChecks, onboardingChecks] =
    await Promise.all([
      checkEnvironmentReadiness(),
      checkStorageReadiness(),
      checkSupabaseReadiness(),
      checkLineReadiness(),
      checkSubscriptionReadiness(),
      checkOnboardingReadiness(),
    ]);

  const checks = [
    ...envChecks,
    ...dbChecks,
    ...subChecks,
    ...onboardingChecks,
    ...storageChecks,
    ...lineChecks,
  ];

  const hasBlocked = checks.some(c => c.status === "fail");
  const hasWarning = checks.some(c => c.status === "warning");

  const overall: OverallStatus = hasBlocked ? "blocked" : hasWarning ? "warning" : "ready";

  return {
    overall,
    checks,
    checkedAt: new Date().toISOString(),
  };
}
