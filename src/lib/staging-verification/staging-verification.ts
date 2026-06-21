"use server";

// PHASE62: Staging verification service — async server functions.
// Super Admin only. Read-only where possible.
// Does NOT apply migrations, execute SQL, or modify production.

import { createAdminClient }    from "@/lib/supabase/admin";
import { getCurrentAdmin }      from "@/lib/admin/get-current-admin";
import { writeAuditLog }        from "@/lib/admin/write-audit-log";
import { STAGING_VERIFICATION_CHECKLIST } from "./checklist";
import type {
  StagingVerificationRun,
  StagingVerificationItem,
  StagingIssue,
  VerificationRunStatus,
  VerificationItemStatus,
  IssueSeverity,
  IssueStatus,
} from "./checklist";

// ─── Internal guard ───────────────────────────────────────────────────────────

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Super admin access required");
  return admin;
}

// ─── Verification Runs ────────────────────────────────────────────────────────

export async function createVerificationRun(runName: string): Promise<{ success: boolean; runId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    // Create the run
    const { data: run, error: runError } = await supabase
      .from("staging_verification_runs")
      .insert({
        run_name:    runName.trim(),
        environment: "staging",
        status:      "in_progress",
      })
      .select("id")
      .single();

    if (runError || !run) {
      return { success: false, error: runError?.message ?? "Failed to create run" };
    }

    // Seed all checklist items
    const items = STAGING_VERIFICATION_CHECKLIST.map(def => ({
      run_id:   run.id,
      category: def.category,
      item_key: def.item_key,
      label:    def.label,
      status:   "pending" as const,
    }));

    const { error: itemsError } = await supabase
      .from("staging_verification_items")
      .insert(items);

    if (itemsError) {
      return { success: false, error: `Run created but items failed: ${itemsError.message}` };
    }

    // Audit log
    void writeAuditLog({
      adminUserId: admin.id,
      action:      "staging_verification_run_created",
      details:     { run_id: run.id, run_name: runName, item_count: items.length },
    });

    return { success: true, runId: run.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getVerificationRuns(): Promise<StagingVerificationRun[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("staging_verification_runs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as StagingVerificationRun[];
  } catch {
    return [];
  }
}

export async function getVerificationRun(runId: string): Promise<{
  run:    StagingVerificationRun | null;
  items:  StagingVerificationItem[];
  issues: StagingIssue[];
}> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const [runRes, itemsRes, issuesRes] = await Promise.all([
      supabase.from("staging_verification_runs").select("*").eq("id", runId).single(),
      supabase.from("staging_verification_items").select("*").eq("run_id", runId).order("created_at"),
      supabase.from("staging_issues").select("*").eq("run_id", runId).order("created_at", { ascending: false }),
    ]);

    return {
      run:    runRes.data  as StagingVerificationRun | null,
      items:  (itemsRes.data  ?? []) as StagingVerificationItem[],
      issues: (issuesRes.data ?? []) as StagingIssue[],
    };
  } catch {
    return { run: null, items: [], issues: [] };
  }
}

export async function updateVerificationItemStatus(
  itemId:       string,
  status:       VerificationItemStatus,
  operatorNote: string,
  evidenceUrl:  string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("staging_verification_items")
      .update({
        status,
        operator_note: operatorNote.trim() || null,
        evidence_url:  evidenceUrl.trim()  || null,
        checked_by:    admin.user_id,
        checked_at:    new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "staging_verification_item_updated",
      details:     { item_id: itemId, status, has_note: !!operatorNote },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function completeVerificationRun(
  runId:          string,
  overallStatus:  Exclude<VerificationRunStatus, "in_progress">,
  summary:        string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("staging_verification_runs")
      .update({
        status:       overallStatus,
        completed_at: new Date().toISOString(),
        completed_by: admin.user_id,
        summary:      summary.trim() || null,
      })
      .eq("id", runId)
      .eq("status", "in_progress"); // only complete in-progress runs

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "staging_verification_completed",
      details:     { run_id: runId, overall_status: overallStatus },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Staging Issues ───────────────────────────────────────────────────────────

export async function createStagingIssue(params: {
  runId?:      string;
  title:       string;
  description: string;
  severity:    IssueSeverity;
  relatedArea: string;
}): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("staging_issues")
      .insert({
        run_id:       params.runId ?? null,
        severity:     params.severity,
        status:       "open",
        title:        params.title.trim(),
        description:  params.description.trim() || null,
        related_area: params.relatedArea.trim()  || null,
        created_by:   admin.user_id,
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "staging_issue_created",
      details:     { issue_id: data.id, severity: params.severity, title: params.title },
    });

    return { success: true, issueId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function updateStagingIssue(
  issueId:        string,
  status:         IssueStatus,
  resolutionNote: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const isResolving = status === "resolved" || status === "wont_fix";

    const { error } = await supabase
      .from("staging_issues")
      .update({
        status,
        resolution_note: resolutionNote.trim() || null,
        resolved_by:     isResolving ? admin.user_id : null,
        resolved_at:     isResolving ? new Date().toISOString() : null,
      })
      .eq("id", issueId);

    if (error) return { success: false, error: error.message };

    if (isResolving) {
      void writeAuditLog({
        adminUserId: admin.id,
        action:      "staging_issue_resolved",
        details:     { issue_id: issueId, status },
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getStagingIssues(runId?: string): Promise<StagingIssue[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    let query = supabase
      .from("staging_issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (runId) {
      query = query.eq("run_id", runId);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as StagingIssue[];
  } catch {
    return [];
  }
}
