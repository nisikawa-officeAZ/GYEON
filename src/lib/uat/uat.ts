"use server";

// PHASE63: UAT management service — async server functions.
// Super Admin only. No production mutations. No dealer-facing access.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin }   from "@/lib/admin/get-current-admin";
import { writeAuditLog }     from "@/lib/admin/write-audit-log";
import type {
  UatDealer,
  UatSession,
  UatFeedback,
  UatIssue,
  UatDealerStatus,
  UatSessionStatus,
  UatFeedbackStatus,
  UatIssueSeverity,
  UatIssueStatus,
  UatDealerWithSessions,
} from "./uat-types";

// ─── Internal guard ───────────────────────────────────────────────────────────

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Super admin access required");
  return admin;
}

// ─── UAT Dealers ──────────────────────────────────────────────────────────────

export async function createUatDealer(params: {
  dealerName:  string;
  contactName: string;
  email:       string;
  country:     string;
  notes:       string;
}): Promise<{ success: boolean; dealerId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("uat_dealers")
      .insert({
        dealer_name:  params.dealerName.trim(),
        contact_name: params.contactName.trim() || null,
        email:        params.email.trim()        || null,
        country:      params.country.trim()      || null,
        notes:        params.notes.trim()        || null,
        status:       "invited",
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "uat_dealer_created",
      details:     { dealer_id: data.id, dealer_name: params.dealerName, country: params.country },
    });

    return { success: true, dealerId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getUatDealers(): Promise<UatDealer[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("uat_dealers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as UatDealer[];
  } catch {
    return [];
  }
}

export async function updateUatDealerStatus(
  dealerId: string,
  status:   UatDealerStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("uat_dealers")
      .update({ status })
      .eq("id", dealerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getUatDashboardData(): Promise<{
  dealers:  UatDealerWithSessions[];
  openIssues:     UatIssue[];
  allFeedback:    UatFeedback[];
}> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const [dealersRes, sessionsRes, feedbackRes, issuesRes] = await Promise.all([
      supabase.from("uat_dealers").select("*").order("created_at"),
      supabase.from("uat_sessions").select("*").order("started_at"),
      supabase.from("uat_feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("uat_issues").select("*").order("created_at", { ascending: false }),
    ]);

    const dealers:  UatDealer[]  = (dealersRes.data  ?? []) as UatDealer[];
    const sessions: UatSession[] = (sessionsRes.data ?? []) as UatSession[];
    const feedback: UatFeedback[] = (feedbackRes.data ?? []) as UatFeedback[];
    const issues:   UatIssue[]   = (issuesRes.data   ?? []) as UatIssue[];

    // Build session → feedback map
    const sessionIds = sessions.map(s => s.id);
    const feedbackBySession: Record<string, UatFeedback[]> = {};
    const issuesBySession:   Record<string, UatIssue[]>   = {};

    for (const sid of sessionIds) {
      feedbackBySession[sid] = feedback.filter(f => f.session_id === sid);
      issuesBySession[sid]   = issues.filter(i  => i.session_id === sid);
    }

    const dealersWithSessions: UatDealerWithSessions[] = dealers.map(d => {
      const dealerSessions = sessions.filter(s => s.dealer_id === d.id);
      const dealerFeedback = dealerSessions.flatMap(s => feedbackBySession[s.id] ?? []);
      const dealerIssues   = dealerSessions.flatMap(s => issuesBySession[s.id]   ?? []);
      return { ...d, sessions: dealerSessions, feedback: dealerFeedback, issues: dealerIssues };
    });

    const openIssues = issues.filter(i => i.status === "open" || i.status === "investigating");

    return { dealers: dealersWithSessions, openIssues, allFeedback: feedback };
  } catch {
    return { dealers: [], openIssues: [], allFeedback: [] };
  }
}

// ─── UAT Sessions ─────────────────────────────────────────────────────────────

export async function createSession(dealerId: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("uat_sessions")
      .insert({ dealer_id: dealerId, status: "active" })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    // Mark dealer as active
    await supabase.from("uat_dealers").update({ status: "active" }).eq("id", dealerId);

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "uat_session_started",
      details:     { session_id: data.id, dealer_id: dealerId },
    });

    return { success: true, sessionId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function completeSession(
  sessionId: string,
  dealerId:  string,
  summary:   string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("uat_sessions")
      .update({
        status:   "completed",
        ended_at: new Date().toISOString(),
        summary:  summary.trim() || null,
      })
      .eq("id", sessionId);

    if (error) return { success: false, error: error.message };

    // Check if all sessions for this dealer are completed
    const { data: remaining } = await supabase
      .from("uat_sessions")
      .select("id")
      .eq("dealer_id", dealerId)
      .neq("status", "completed");

    if (!remaining || remaining.length === 0) {
      await supabase.from("uat_dealers").update({ status: "completed" }).eq("id", dealerId);
    }

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "uat_session_completed",
      details:     { session_id: sessionId, dealer_id: dealerId },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── UAT Feedback ─────────────────────────────────────────────────────────────

export async function createFeedback(params: {
  sessionId:   string;
  category:    string;
  rating:      number;
  title:       string;
  description: string;
}): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("uat_feedback")
      .insert({
        session_id:  params.sessionId,
        category:    params.category    || null,
        rating:      params.rating,
        title:       params.title.trim(),
        description: params.description.trim() || null,
        status:      "open",
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "uat_feedback_created",
      details:     { feedback_id: data.id, category: params.category, rating: params.rating },
    });

    return { success: true, feedbackId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function updateFeedback(
  feedbackId: string,
  status:     UatFeedbackStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("uat_feedback")
      .update({ status })
      .eq("id", feedbackId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── UAT Issues ───────────────────────────────────────────────────────────────

export async function createIssue(params: {
  sessionId?:  string;
  severity:    UatIssueSeverity;
  title:       string;
  description: string;
}): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("uat_issues")
      .insert({
        session_id:  params.sessionId ?? null,
        severity:    params.severity,
        title:       params.title.trim(),
        description: params.description.trim() || null,
        status:      "open",
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "uat_issue_created",
      details:     { issue_id: data.id, severity: params.severity, title: params.title },
    });

    return { success: true, issueId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function updateIssue(
  issueId:    string,
  status:     UatIssueStatus,
  resolution: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const isResolving = status === "resolved" || status === "wont_fix";

    const { error } = await supabase
      .from("uat_issues")
      .update({
        status,
        resolution:  resolution.trim() || null,
        resolved_at: isResolving ? new Date().toISOString() : null,
      })
      .eq("id", issueId);

    if (error) return { success: false, error: error.message };

    if (isResolving) {
      void writeAuditLog({
        adminUserId: admin.id,
        action:      "uat_issue_resolved",
        details:     { issue_id: issueId, status },
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getOpenIssues(): Promise<UatIssue[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("uat_issues")
      .select("*")
      .in("status", ["open", "investigating"])
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as UatIssue[];
  } catch {
    return [];
  }
}
