export type AdminRole = "super_admin";
export type AdminStatus = "active" | "disabled";

export interface AdminUserDB {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  role: AdminRole;
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
  | "staging_issue_resolved";

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
