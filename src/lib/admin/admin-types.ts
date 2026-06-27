// Re-export from admin-roles for backward compatibility.
// admin_users.role DB constraint currently only allows 'super_admin';
// gyeon_admin and logistics_admin require a future migration to the constraint.
import type { AdminRole as _AdminRole } from "@/lib/admin/admin-roles";
export type { AdminRole } from "@/lib/admin/admin-roles";
export type AdminStatus = "active" | "disabled";

export interface AdminUserDB {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  role: _AdminRole;
  status: AdminStatus;
  created_at: string;
  updated_at: string;
}

export type AdminAuditAction =
  | "password_reset_sent"
  | "temporary_password_created"
  | "user_disabled"
  | "user_enabled"
  | "user_deleted"
  | "plan_changed"
  | "dealer_updated"
  | "dealer_status_changed"
  | "login_impersonation_started"
  | "admin_login"
  // PHASE58: subscription management
  | "subscription_created"
  | "subscription_updated"
  | "trial_extended"
  | "subscription_note_updated"
  // PHASE61: migration status
  | "migration_status_viewed"
  // PHASE62: staging verification
  | "staging_verification_run_created"
  | "staging_verification_item_updated"
  | "staging_verification_completed"
  | "staging_issue_created"
  | "staging_issue_resolved"
  // PHASE63: UAT management
  | "uat_dealer_created"
  | "uat_session_started"
  | "uat_session_completed"
  | "uat_feedback_created"
  | "uat_issue_created"
  | "uat_issue_resolved"
  // PHASE64: billing management
  | "billing_created"
  | "invoice_issued"
  | "invoice_paid"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "subscription_suspended"
  // PHASE65: RC status
  | "release_candidate_viewed"
  | "release_score_checked"
  // PHASE66: official release
  | "official_release_viewed"
  // Dealer rank management
  | "rank_assigned"
  // PHASE74: trial approval
  | "dealer_approved"
  | "dealer_rejected"
  | "trial_auto_downgraded";

export interface AdminAuditLogDB {
  id: string;
  admin_user_id: string | null;
  target_user_id: string | null;
  target_dealer_id: string | null;
  action: AdminAuditAction;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DealerAdminView {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  subscription_status: string;
  started_at: string | null;
  expired_at: string | null;
  created_at: string;
  owner_user_id: string | null;
  staff_count?: number;
  // PHASE71 approval fields
  approval_status:          string | null;
  approved_at:              string | null;
  rejection_reason:         string | null;
  // PHASE74 trial fields
  trial_plan_type:          string | null;
  service_start_date:       string | null;
  trial_start_date:         string | null;
  trial_end_date:           string | null;
  trial_status:             string | null;
  auto_downgrade_plan_type: string | null;
  detailer_rank:            string | null;
}

export interface UserAdminView {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  dealer_name?: string | null;
  dealer_role?: string | null;
}
