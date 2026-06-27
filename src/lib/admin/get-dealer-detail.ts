"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DealerAdminView } from "./admin-types";

export interface DealerStats {
  estimateCount: number;
  customerCount: number;
  vehicleCount:  number;
  ocrCount:      number;
  lastLogin:     string | null;
  daysRemaining: number | null;
}

export interface TimelineEvent {
  id:     string;
  date:   string;
  type:   "registration" | "approval" | "service_start" | "trial_start" |
          "trial_end" | "plan_change" | "suspension" | "reactivation" |
          "rejection" | "rank_change" | "trial_extended" | "reset" |
          "auto_downgrade" | "other";
  label:  string;
  detail: string | null;
  actor:  string | null;
}

export interface AdminAuditEntry {
  id:           string;
  created_at:   string;
  action:       string;
  admin_email:  string | null;
  admin_name:   string | null;
  details:      Record<string, unknown>;
}

export interface DealerDetail {
  stats:     DealerStats;
  timeline:  TimelineEvent[];
  auditLogs: AdminAuditEntry[];
}

function calcDaysRemaining(trialEnd: string | null | undefined): number | null {
  if (!trialEnd) return null;
  const today = new Date(new Date().toISOString().split("T")[0]).getTime();
  const end   = new Date(trialEnd).getTime();
  return Math.round((end - today) / 86_400_000);
}

function actionToTimelineType(action: string): TimelineEvent["type"] {
  switch (action) {
    case "dealer_approved":        return "approval";
    case "dealer_rejected":        return "rejection";
    case "dealer_suspended":       return "suspension";
    case "dealer_reactivated":     return "reactivation";
    case "plan_changed":           return "plan_change";
    case "rank_changed":           return "rank_change";
    case "trial_extended":         return "trial_extended";
    case "dealer_reset":           return "reset";
    case "trial_auto_downgraded":  return "auto_downgrade";
    default:                       return "other";
  }
}

function actionLabel(action: string, details: Record<string, unknown>): { label: string; detail: string | null } {
  const from = details.from as string | undefined;
  const to   = details.to   as string | undefined;
  const planLabel = (p: string | undefined) =>
    p === "pro_plus" ? "Pro Plus" : p === "pro" ? "Pro" : p === "basic" ? "Basic" : p ?? "—";

  switch (action) {
    case "dealer_approved":
      return { label: "Approved", detail: to ? `Plan: ${planLabel(details.plan as string)}` : null };
    case "dealer_rejected":
      return { label: "Rejected", detail: (details.reason as string | undefined) ?? null };
    case "dealer_suspended":
      return { label: "Suspended", detail: (details.reason as string | undefined) ?? null };
    case "dealer_reactivated":
      return { label: "Reactivated", detail: `Subscription: ${details.subscription_status ?? "—"}` };
    case "plan_changed":
      return { label: "Plan Changed", detail: `${planLabel(from)} → ${planLabel(to)}` };
    case "rank_changed":
      return { label: "Rank Changed", detail: `${from ?? "—"} → ${to ?? "—"}` };
    case "trial_extended":
      return { label: "Trial Extended", detail: to ? `→ ${new Date(to).toLocaleDateString("ja-JP")}` : null };
    case "dealer_reset":
      return { label: "Account Reset", detail: `Previous: ${details.previous_approval_status ?? "—"}` };
    case "trial_auto_downgraded":
      return { label: "Auto-downgraded", detail: planLabel(details.plan as string | undefined) };
    default:
      return { label: action, detail: null };
  }
}

export async function getDealerDetail(
  dealerId: string,
  dealer: DealerAdminView
): Promise<DealerDetail> {
  await requireAdmin();
  const supabase = createAdminClient();

  // ── Parallel DB queries ──────────────────────────────────────────────────
  const [
    estimateRes,
    customerRes,
    vehicleRes,
    ocrRes,
    auditRes,
  ] = await Promise.all([
    supabase.from("estimates")   .select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
    supabase.from("customers")   .select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
    supabase.from("vehicles")    .select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
    supabase.from("vehicle_registration_ocr_sessions").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
    supabase.from("admin_audit_logs").select("*")
      .eq("target_dealer_id", dealerId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Last login from owner_user_id
  let lastLogin: string | null = null;
  if (dealer.owner_user_id) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(dealer.owner_user_id);
      lastLogin = authUser?.user?.last_sign_in_at ?? null;
    } catch {
      // non-fatal
    }
  }

  // Enrich audit rows with admin user info
  const auditRows = (auditRes.data ?? []) as Record<string, unknown>[];
  const adminIds = [...new Set(auditRows.map((r) => r.admin_user_id as string).filter(Boolean))];
  let adminMap: Record<string, { email: string | null; name: string | null }> = {};
  if (adminIds.length > 0) {
    const { data: adminUsers } = await supabase
      .from("admin_users")
      .select("id, email, name")
      .in("id", adminIds);
    if (adminUsers) {
      adminMap = Object.fromEntries(
        adminUsers.map((u: Record<string, unknown>) => [u.id as string, { email: u.email as string | null, name: u.name as string | null }])
      );
    }
  }

  const auditLogs: AdminAuditEntry[] = auditRows.map((r) => ({
    id:          r.id as string,
    created_at:  r.created_at as string,
    action:      r.action as string,
    admin_email: adminMap[r.admin_user_id as string]?.email ?? null,
    admin_name:  adminMap[r.admin_user_id as string]?.name ?? null,
    details:     (r.details as Record<string, unknown>) ?? {},
  }));

  // ── Build timeline ───────────────────────────────────────────────────────
  const events: TimelineEvent[] = [];

  // Fixed timestamps from dealer fields
  if (dealer.created_at) events.push({
    id: "registration", date: dealer.created_at, type: "registration",
    label: "Registration", detail: null, actor: null,
  });
  if (dealer.approved_at) events.push({
    id: "approval", date: dealer.approved_at, type: "approval",
    label: "Approval", detail: dealer.trial_plan_type ? `Plan: ${dealer.trial_plan_type}` : null, actor: null,
  });
  if (dealer.service_start_date) events.push({
    id: "service_start", date: dealer.service_start_date, type: "service_start",
    label: "Service Start", detail: null, actor: null,
  });
  if (dealer.trial_start_date) events.push({
    id: "trial_start", date: dealer.trial_start_date, type: "trial_start",
    label: "Trial Start", detail: dealer.trial_plan_type ?? null, actor: null,
  });

  // Admin audit events (excluding approval/rejection — already captured above)
  for (const log of auditRows) {
    const action = log.action as string;
    if (action === "dealer_approved" || action === "dealer_rejected") continue; // already in dealer fields
    const { label, detail } = actionLabel(action, (log.details as Record<string, unknown>) ?? {});
    const adminInfo = adminMap[log.admin_user_id as string];
    events.push({
      id:     log.id as string,
      date:   log.created_at as string,
      type:   actionToTimelineType(action),
      label,
      detail,
      actor:  adminInfo?.name ?? adminInfo?.email ?? null,
    });
  }

  // Trial end (as the last event on the timeline if date is set)
  if (dealer.trial_end_date) {
    const isEnded  = dealer.trial_status === "ended";
    const isFuture = (dealer.trial_end_date ?? "") >= new Date().toISOString().split("T")[0];
    events.push({
      id:     "trial_end",
      date:   dealer.trial_end_date,
      type:   "trial_end",
      label:  isEnded ? "Trial Ended" : isFuture ? "Trial End (scheduled)" : "Trial End",
      detail: null,
      actor:  null,
    });
  }

  // Sort chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats: DealerStats = {
    estimateCount: estimateRes.count ?? 0,
    customerCount: customerRes.count ?? 0,
    vehicleCount:  vehicleRes.count ?? 0,
    ocrCount:      ocrRes.count ?? 0,
    lastLogin,
    daysRemaining: calcDaysRemaining(dealer.trial_end_date),
  };

  return { stats, timeline: events, auditLogs };
}
