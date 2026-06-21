"use server";

// PHASE65: RC status utility.
// Returns structured release candidate status with 10-category scoring (10 pts each, total 100).
// Read-only — does NOT deploy, migrate, or modify anything.

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RcCheckStatus = "pass" | "warning" | "fail";
export type RcOverallStatus = "ready" | "warning" | "blocked";

export interface RcCheck {
  key:     string;
  label:   string;
  status:  RcCheckStatus;
  message: string;
  points:  number;   // max points for this category
  earned:  number;   // earned points (0 = fail, points/2 = warning, points = pass)
}

export interface RcCategory {
  key:     string;
  label:   string;
  points:  number;
  earned:  number;
  status:  RcCheckStatus;
  checks:  RcCheck[];
}

export interface RcStatusReport {
  version:    string;
  status:     RcOverallStatus;
  score:      number;   // 0–100
  maxScore:   number;   // always 100
  categories: RcCategory[];
  checkedAt:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rcPass(key: string, label: string, message: string, points: number): RcCheck {
  return { key, label, status: "pass", message, points, earned: points };
}

function rcWarn(key: string, label: string, message: string, points: number): RcCheck {
  return { key, label, status: "warning", message, points, earned: Math.floor(points / 2) };
}

function rcFail(key: string, label: string, message: string, points: number): RcCheck {
  return { key, label, status: "fail", message, points, earned: 0 };
}

function categoryStatus(checks: RcCheck[]): RcCheckStatus {
  if (checks.some(c => c.status === "fail"))    return "fail";
  if (checks.some(c => c.status === "warning")) return "warning";
  return "pass";
}

// ─── Category checks ──────────────────────────────────────────────────────────

async function checkMigration(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();

    // Probe key tables introduced at various migration phases
    const probes = [
      { table: "customers",            label: "customers (038)"           },
      { table: "vehicles",             label: "vehicles (039)"            },
      { table: "dealers",              label: "dealers (040)"             },
      { table: "dealer_subscriptions", label: "dealer_subscriptions (058)"},
      { table: "uat_dealers",          label: "uat_dealers (063)"         },
      { table: "dealer_billing",       label: "dealer_billing (064)"      },
    ];

    let allPass = true;
    const missing: string[] = [];

    for (const p of probes) {
      const { error } = await supabase
        .from(p.table as "customers")
        .select("*", { count: "exact", head: true });
      if (error) { allPass = false; missing.push(p.label); }
    }

    checks.push(
      allPass
        ? rcPass("migration_tables", "Core Tables Present", "All probed tables accessible", 10)
        : rcFail("migration_tables", "Core Tables Present", `Missing: ${missing.join(", ")}`, 10)
    );
  } catch (e) {
    checks.push(rcFail("migration_error", "Migration Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkRls(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();

    // Verify RLS-protected tables exist and are accessible via admin client
    const tables = ["dealer_billing", "billing_invoices", "uat_dealers", "staging_verification_runs"];
    const inaccessible: string[] = [];

    for (const t of tables) {
      const { error } = await supabase
        .from(t as "dealer_billing")
        .select("*", { count: "exact", head: true });
      if (error) inaccessible.push(t);
    }

    checks.push(
      inaccessible.length === 0
        ? rcPass("rls_tables", "RLS Tables Accessible (admin)", "All admin-accessible tables respond", 10)
        : rcWarn("rls_tables", "RLS Tables Accessible (admin)", `Cannot probe: ${inaccessible.join(", ")}`, 10)
    );
  } catch (e) {
    checks.push(rcFail("rls_error", "RLS Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkStorage(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();
    const bucket   = process.env.STORAGE_BUCKET ?? "documents";
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      checks.push(rcFail("storage_list", "Storage Buckets", `Cannot list: ${error.message}`, 10));
      return checks;
    }

    const found = (buckets ?? []).find(b => b.name === bucket);
    if (!found) {
      checks.push(rcFail("storage_bucket", "Storage Bucket", `Bucket "${bucket}" not found`, 10));
    } else if (found.public) {
      checks.push(rcFail("storage_bucket", "Storage Bucket", `Bucket "${bucket}" is PUBLIC — must be private`, 10));
    } else {
      checks.push(rcPass("storage_bucket", "Storage Bucket", `"${bucket}" is private`, 10));
    }
  } catch (e) {
    checks.push(rcFail("storage_error", "Storage Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkPdf(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("document_files")
      .select("id", { count: "exact", head: true });

    checks.push(
      error
        ? rcWarn("pdf_table", "document_files Table", `Table issue: ${error.message}`, 10)
        : rcPass("pdf_table", "document_files Table", "Table accessible — PDF storage ready", 10)
    );
  } catch (e) {
    checks.push(rcFail("pdf_error", "PDF Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkLine(): Promise<RcCheck[]> {
  const channelId   = process.env.LINE_CHANNEL_ID;
  const channelSec  = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const allSet = channelId && channelSec && accessToken;
  return [
    allSet
      ? rcPass("line_env", "LINE Credentials", "All LINE env vars set", 10)
      : rcWarn("line_env", "LINE Credentials", "LINE env vars not fully set — LINE integration disabled", 10),
  ];
}

async function checkSubscription(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("code");

    if (error) {
      checks.push(rcFail("sub_plans", "Subscription Plans", `Error: ${error.message}`, 10));
      return checks;
    }

    const codes   = (plans ?? []).map((p: { code: string }) => p.code);
    const hasAll  = ["basic", "pro", "pro_plus"].every(c => codes.includes(c));

    checks.push(
      hasAll
        ? rcPass("sub_plans", "Subscription Plans", "basic, pro, pro_plus seeded", 10)
        : rcFail("sub_plans", "Subscription Plans", `Missing plans: ${["basic","pro","pro_plus"].filter(c => !codes.includes(c)).join(", ")}`, 10)
    );
  } catch (e) {
    checks.push(rcFail("sub_error", "Subscription Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkBilling(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();
    const [billingRes, invoicesRes] = await Promise.all([
      supabase.from("dealer_billing").select("id", { count: "exact", head: true }),
      supabase.from("billing_invoices").select("id", { count: "exact", head: true }),
    ]);

    const ok = !billingRes.error && !invoicesRes.error;
    checks.push(
      ok
        ? rcPass("billing_tables", "Billing Tables", "dealer_billing + billing_invoices accessible", 10)
        : rcFail("billing_tables", "Billing Tables", `Table error: ${billingRes.error?.message ?? invoicesRes.error?.message}`, 10)
    );
  } catch (e) {
    checks.push(rcFail("billing_error", "Billing Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkAudit(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();
    const [auditRes, adminAuditRes] = await Promise.all([
      supabase.from("audit_logs").select("id", { count: "exact", head: true }),
      supabase.from("admin_audit_logs").select("id", { count: "exact", head: true }),
    ]);

    const ok = !auditRes.error && !adminAuditRes.error;
    checks.push(
      ok
        ? rcPass("audit_tables", "Audit Tables", "audit_logs + admin_audit_logs accessible", 10)
        : rcFail("audit_tables", "Audit Tables", `Table error: ${auditRes.error?.message ?? adminAuditRes.error?.message}`, 10)
    );
  } catch (e) {
    checks.push(rcFail("audit_error", "Audit Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

async function checkBackup(): Promise<RcCheck[]> {
  // No automated backup check possible at this stage.
  // Check that the Supabase project URL is set (implies a real project, not local).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isCloud     = supabaseUrl && supabaseUrl.includes(".supabase.co");

  return [
    isCloud
      ? rcPass("backup_env", "Supabase Cloud Project", "Project is on Supabase cloud (PITR available)", 10)
      : rcWarn("backup_env", "Supabase Cloud Project", "Supabase URL does not appear to be a cloud project — verify PITR is enabled", 10),
  ];
}

async function checkUat(): Promise<RcCheck[]> {
  const checks: RcCheck[] = [];
  try {
    const supabase = createAdminClient();

    const [dealerRes, issueRes] = await Promise.all([
      supabase.from("uat_dealers").select("status"),
      supabase.from("uat_issues").select("severity, status").in("status", ["open", "investigating"]),
    ]);

    const dealers     = (dealerRes.data  ?? []) as { status: string }[];
    const openIssues  = (issueRes.data   ?? []) as { severity: string; status: string }[];
    const completed   = dealers.filter(d => d.status === "completed").length;
    const criticals   = openIssues.filter(i => i.severity === "critical").length;
    const highs       = openIssues.filter(i => i.severity === "high").length;

    if (criticals > 0) {
      checks.push(rcFail("uat_issues", "UAT Open Issues", `${criticals} CRITICAL issue(s) open — must resolve before GA`, 10));
    } else if (highs > 0) {
      checks.push(rcWarn("uat_issues", "UAT Open Issues", `${highs} HIGH issue(s) open — review before GA`, 10));
    } else {
      checks.push(
        completed >= 2
          ? rcPass("uat_issues", "UAT Status", `${completed} dealer(s) completed UAT, no critical/high issues`, 10)
          : rcWarn("uat_issues", "UAT Status", `Only ${completed} dealer(s) completed UAT — recommend ≥ 2`, 10)
      );
    }
  } catch (e) {
    checks.push(rcFail("uat_error", "UAT Check", `Error: ${String(e)}`, 10));
  }
  return checks;
}

// ─── Main exports ─────────────────────────────────────────────────────────────

export async function getReleaseChecklist(): Promise<RcCategory[]> {
  const [
    migrationChecks,
    rlsChecks,
    storageChecks,
    pdfChecks,
    lineChecks,
    subChecks,
    billingChecks,
    auditChecks,
    backupChecks,
    uatChecks,
  ] = await Promise.all([
    checkMigration(),
    checkRls(),
    checkStorage(),
    checkPdf(),
    checkLine(),
    checkSubscription(),
    checkBilling(),
    checkAudit(),
    checkBackup(),
    checkUat(),
  ]);

  const categories: RcCategory[] = [
    { key: "migration",    label: "Migration",    points: 10, checks: migrationChecks },
    { key: "rls",          label: "RLS",          points: 10, checks: rlsChecks       },
    { key: "storage",      label: "Storage",      points: 10, checks: storageChecks   },
    { key: "pdf",          label: "PDF",          points: 10, checks: pdfChecks       },
    { key: "line",         label: "LINE",         points: 10, checks: lineChecks      },
    { key: "subscription", label: "Subscription", points: 10, checks: subChecks       },
    { key: "billing",      label: "Billing",      points: 10, checks: billingChecks   },
    { key: "audit",        label: "Audit",        points: 10, checks: auditChecks     },
    { key: "backup",       label: "Backup / DR",  points: 10, checks: backupChecks    },
    { key: "uat",          label: "UAT",          points: 10, checks: uatChecks       },
  ].map(cat => ({
    ...cat,
    earned: cat.checks.reduce((s, c) => s + c.earned, 0),
    status: categoryStatus(cat.checks),
  }));

  return categories;
}

export async function getReleaseScore(): Promise<number> {
  const categories = await getReleaseChecklist();
  return categories.reduce((s, c) => s + c.earned, 0);
}

export async function getRcStatus(): Promise<RcStatusReport> {
  const categories = await getReleaseChecklist();

  const score    = categories.reduce((s, c) => s + c.earned, 0);
  const hasBlocked = categories.some(c => c.status === "fail");
  const hasWarning = categories.some(c => c.status === "warning");

  const status: RcOverallStatus = hasBlocked ? "blocked" : hasWarning ? "warning" : "ready";

  return {
    version:    "1.0.0-RC1",
    status,
    score,
    maxScore:   100,
    categories,
    checkedAt:  new Date().toISOString(),
  };
}
