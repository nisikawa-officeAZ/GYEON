// PHASE62: Staging verification checklist — static definition.
// NOT a "use server" file — safe to import anywhere.
// This is the default checklist seeded when a new verification run is created.

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerificationItemStatus = "pending" | "passed" | "failed" | "blocked" | "not_applicable";
export type VerificationRunStatus  = "in_progress" | "passed" | "failed" | "blocked";
export type IssueSeverity          = "low" | "medium" | "high" | "critical";
export type IssueStatus            = "open" | "investigating" | "resolved" | "wont_fix";

export interface ChecklistItemDef {
  category: string;
  item_key: string;
  label:    string;
}

export interface StagingVerificationRun {
  id:           string;
  run_name:     string;
  environment:  string;
  status:       VerificationRunStatus;
  started_at:   string;
  completed_at: string | null;
  completed_by: string | null;
  summary:      string | null;
  created_at:   string;
  updated_at:   string;
}

export interface StagingVerificationItem {
  id:            string;
  run_id:        string;
  category:      string;
  item_key:      string;
  label:         string;
  status:        VerificationItemStatus;
  operator_note: string | null;
  evidence_url:  string | null;
  checked_by:    string | null;
  checked_at:    string | null;
  created_at:    string;
  updated_at:    string;
}

export interface StagingIssue {
  id:              string;
  run_id:          string | null;
  severity:        IssueSeverity;
  status:          IssueStatus;
  title:           string;
  description:     string | null;
  related_area:    string | null;
  resolution_note: string | null;
  created_by:      string | null;
  resolved_by:     string | null;
  created_at:      string;
  resolved_at:     string | null;
  updated_at:      string;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export const STAGING_VERIFICATION_CHECKLIST: ChecklistItemDef[] = [
  // ── Migration ──────────────────────────────────────────────────────────────
  {
    category: "Migration",
    item_key: "migration_all_applied",
    label:    "All 27 migrations applied in documented order",
  },
  {
    category: "Migration",
    item_key: "migration_no_skipped",
    label:    "No failed migration skipped",
  },
  {
    category: "Migration",
    item_key: "migration_status_page",
    label:    "Migration status page shows all Applied",
  },

  // ── Storage ────────────────────────────────────────────────────────────────
  {
    category: "Storage",
    item_key: "storage_bucket_exists",
    label:    "documents bucket exists in Supabase Storage",
  },
  {
    category: "Storage",
    item_key: "storage_bucket_private",
    label:    "documents bucket is private (not public)",
  },
  {
    category: "Storage",
    item_key: "storage_signed_url_works",
    label:    "Signed URL generated and accessible",
  },
  {
    category: "Storage",
    item_key: "storage_cross_dealer_denied",
    label:    "Cross-dealer document access denied",
  },
  {
    category: "Storage",
    item_key: "storage_path_pattern",
    label:    "Path pattern enforced: {dealer_id}/{type}/{filename}.pdf",
  },

  // ── RLS ────────────────────────────────────────────────────────────────────
  {
    category: "RLS",
    item_key: "rls_customers_isolated",
    label:    "customers table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_vehicles_isolated",
    label:    "vehicles table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_estimates_isolated",
    label:    "estimates table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_invoices_isolated",
    label:    "invoices table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_payments_isolated",
    label:    "payments table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_document_files_isolated",
    label:    "document_files table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_activity_logs_isolated",
    label:    "activity_logs table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_notifications_isolated",
    label:    "notifications table: dealer isolation verified",
  },
  {
    category: "RLS",
    item_key: "rls_audit_logs_immutable",
    label:    "audit_logs: no UPDATE or DELETE policy (immutable)",
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  {
    category: "Auth",
    item_key: "auth_email_login",
    label:    "Email + password login succeeds",
  },
  {
    category: "Auth",
    item_key: "auth_nonauth_redirect",
    label:    "Unauthenticated user redirected to /login",
  },
  {
    category: "Auth",
    item_key: "auth_admin_login",
    label:    "Super admin login to /admin succeeds",
  },
  {
    category: "Auth",
    item_key: "auth_staff_no_admin",
    label:    "Staff user cannot access /admin",
  },
  {
    category: "Auth",
    item_key: "auth_session_persists",
    label:    "Session persists on page refresh",
  },

  // ── Dealer Isolation ───────────────────────────────────────────────────────
  {
    category: "Dealer Isolation",
    item_key: "isolation_customers",
    label:    "Dealer A cannot see Dealer B customers",
  },
  {
    category: "Dealer Isolation",
    item_key: "isolation_estimates",
    label:    "Dealer A cannot see Dealer B estimates",
  },
  {
    category: "Dealer Isolation",
    item_key: "isolation_invoices",
    label:    "Dealer B cannot see Dealer A invoices",
  },
  {
    category: "Dealer Isolation",
    item_key: "isolation_staff_no_admin",
    label:    "Staff cannot access Admin console",
  },
  {
    category: "Dealer Isolation",
    item_key: "isolation_owner_own_dealer",
    label:    "Owner can manage own dealer only",
  },
  {
    category: "Dealer Isolation",
    item_key: "isolation_superadmin_all",
    label:    "Super Admin can view all dealers",
  },

  // ── PDF ────────────────────────────────────────────────────────────────────
  {
    category: "PDF",
    item_key: "pdf_estimate",
    label:    "Estimate PDF generated successfully",
  },
  {
    category: "PDF",
    item_key: "pdf_invoice",
    label:    "Invoice PDF generated successfully",
  },
  {
    category: "PDF",
    item_key: "pdf_completion_report",
    label:    "Completion Report PDF generated successfully",
  },
  {
    category: "PDF",
    item_key: "pdf_product_order",
    label:    "Product Order PDF generated successfully",
  },
  {
    category: "PDF",
    item_key: "pdf_japanese_text",
    label:    "Japanese text renders without tofu boxes",
  },
  {
    category: "PDF",
    item_key: "pdf_old_archived",
    label:    "Previous active PDF archived on re-generation",
  },

  // ── LINE ───────────────────────────────────────────────────────────────────
  {
    category: "LINE",
    item_key: "line_webhook_signature",
    label:    "Webhook signature verification works",
  },
  {
    category: "LINE",
    item_key: "line_liff_id",
    label:    "LIFF ID configured and LIFF page loads",
  },
  {
    category: "LINE",
    item_key: "line_send_succeeds",
    label:    "LINE message send succeeds (Pro Plus)",
  },
  {
    category: "LINE",
    item_key: "line_failure_logged",
    label:    "Failed LINE send creates line_message_logs entry",
  },
  {
    category: "LINE",
    item_key: "line_basic_pro_blocked",
    label:    "Basic and Pro plan cannot access LINE",
  },
  {
    category: "LINE",
    item_key: "line_pro_plus_allowed",
    label:    "Pro Plus plan can access LINE",
  },

  // ── Subscription ───────────────────────────────────────────────────────────
  {
    category: "Subscription",
    item_key: "sub_basic_restrictions",
    label:    "Basic plan: work orders / invoices / reservations blocked",
  },
  {
    category: "Subscription",
    item_key: "sub_pro_restrictions",
    label:    "Pro plan: LINE blocked, other Pro features accessible",
  },
  {
    category: "Subscription",
    item_key: "sub_pro_plus_all",
    label:    "Pro Plus plan: all features accessible",
  },
  {
    category: "Subscription",
    item_key: "sub_suspended_blocked",
    label:    "Suspended dealer blocked from paid features",
  },
  {
    category: "Subscription",
    item_key: "sub_plans_seeded",
    label:    "subscription_plans seeded: basic, pro, pro_plus",
  },

  // ── Onboarding ─────────────────────────────────────────────────────────────
  {
    category: "Onboarding",
    item_key: "onboarding_new_dealer_redirect",
    label:    "New dealer redirected to /onboarding on first login",
  },
  {
    category: "Onboarding",
    item_key: "onboarding_existing_no_redirect",
    label:    "Existing dealer (migration 059) NOT redirected",
  },
  {
    category: "Onboarding",
    item_key: "onboarding_skip_works",
    label:    "Skip (後で続ける) sets step=8, no redirect",
  },
  {
    category: "Onboarding",
    item_key: "onboarding_resume_works",
    label:    "Dashboard OnboardingCard links back to /onboarding",
  },
  {
    category: "Onboarding",
    item_key: "onboarding_complete_works",
    label:    "Step 7 complete: onboarding_completed=true, card hidden",
  },

  // ── Audit ──────────────────────────────────────────────────────────────────
  {
    category: "Audit",
    item_key: "audit_admin_visible",
    label:    "Admin audit logs visible at /admin/audit",
  },
  {
    category: "Audit",
    item_key: "audit_business_visible",
    label:    "Business audit events logged (create, PDF, etc.)",
  },
  {
    category: "Audit",
    item_key: "audit_not_editable",
    label:    "audit_logs rows cannot be updated",
  },
  {
    category: "Audit",
    item_key: "audit_not_deletable",
    label:    "audit_logs rows cannot be deleted",
  },

  // ── Notification ───────────────────────────────────────────────────────────
  {
    category: "Notification",
    item_key: "notification_onboarding_welcome",
    label:    "Welcome notification appears after onboarding complete",
  },
  {
    category: "Notification",
    item_key: "notification_bell_renders",
    label:    "Notification bell/list renders without error",
  },

  // ── Health ─────────────────────────────────────────────────────────────────
  {
    category: "Health",
    item_key: "health_supabase",
    label:    "Supabase shows healthy in /admin",
  },
  {
    category: "Health",
    item_key: "health_storage",
    label:    "Storage shows healthy in /admin",
  },
  {
    category: "Health",
    item_key: "health_line",
    label:    "LINE shows healthy or warning (not error) in /admin",
  },
  {
    category: "Health",
    item_key: "health_env_check",
    label:    "Release readiness environment check shows no failures",
  },

  // ── Release Readiness ──────────────────────────────────────────────────────
  {
    category: "Release Readiness",
    item_key: "readiness_page_loads",
    label:    "Release readiness page loads at /admin/release-readiness",
  },
  {
    category: "Release Readiness",
    item_key: "readiness_no_deploy_button",
    label:    "No production deploy button exists on any admin page",
  },
  {
    category: "Release Readiness",
    item_key: "readiness_status_appropriate",
    label:    "Release readiness shows READY or WARNING (not BLOCKED) after all migrations",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const CHECKLIST_CATEGORIES = [
  "Migration",
  "Storage",
  "RLS",
  "Auth",
  "Dealer Isolation",
  "PDF",
  "LINE",
  "Subscription",
  "Onboarding",
  "Audit",
  "Notification",
  "Health",
  "Release Readiness",
] as const;

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export function getItemsByCategory(
  items: StagingVerificationItem[]
): Record<string, StagingVerificationItem[]> {
  const grouped: Record<string, StagingVerificationItem[]> = {};
  for (const cat of CHECKLIST_CATEGORIES) {
    grouped[cat] = items.filter(i => i.category === cat);
  }
  return grouped;
}

export function getCategoryStatus(
  items: StagingVerificationItem[]
): VerificationItemStatus {
  if (items.length === 0)                             return "pending";
  if (items.some(i => i.status === "blocked"))        return "blocked";
  if (items.some(i => i.status === "failed"))         return "failed";
  if (items.some(i => i.status === "pending"))        return "pending";
  return "passed";
}

export function getRunOverallStatus(
  items: StagingVerificationItem[]
): VerificationRunStatus {
  if (items.some(i => i.status === "blocked")) return "blocked";
  if (items.some(i => i.status === "failed"))  return "failed";
  if (items.some(i => i.status === "pending")) return "in_progress";
  return "passed";
}

export function issueSeverityLabel(s: IssueSeverity): string {
  const map: Record<IssueSeverity, string> = {
    low:      "Low",
    medium:   "Medium",
    high:     "High",
    critical: "Critical",
  };
  return map[s];
}

export function issueStatusLabel(s: IssueStatus): string {
  const map: Record<IssueStatus, string> = {
    open:          "Open",
    investigating: "Investigating",
    resolved:      "Resolved",
    wont_fix:      "Won't Fix",
  };
  return map[s];
}

export function issueSeverityColor(s: IssueSeverity): string {
  const map: Record<IssueSeverity, string> = {
    low:      "bg-slate-800 text-slate-300 border-slate-600",
    medium:   "bg-amber-900/40 text-amber-300 border-amber-700/40",
    high:     "bg-orange-900/40 text-orange-300 border-orange-700/40",
    critical: "bg-red-900/40 text-red-300 border-red-700/40",
  };
  return map[s];
}

export function itemStatusColor(s: VerificationItemStatus): string {
  const map: Record<VerificationItemStatus, string> = {
    pending:        "bg-slate-800 text-slate-400 border-slate-600",
    passed:         "bg-green-900/40 text-green-300 border-green-700/40",
    failed:         "bg-red-900/40 text-red-300 border-red-700/40",
    blocked:        "bg-orange-900/40 text-orange-300 border-orange-700/40",
    not_applicable: "bg-slate-900 text-slate-600 border-slate-800",
  };
  return map[s];
}

export function runStatusColor(s: VerificationRunStatus): string {
  const map: Record<VerificationRunStatus, string> = {
    in_progress: "bg-blue-900/40 text-blue-300 border-blue-700/40",
    passed:      "bg-green-900/40 text-green-300 border-green-700/40",
    failed:      "bg-red-900/40 text-red-300 border-red-700/40",
    blocked:     "bg-orange-900/40 text-orange-300 border-orange-700/40",
  };
  return map[s];
}
