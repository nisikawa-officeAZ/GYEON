"use server";

import { requireAdmin, requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { DEFAULT_DEALER_RANK } from "@/lib/ranks/dealer-ranks";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function approveDealerTrial(
  dealerId: string,
  options?: {
    detailerRank?:    string;
    initialPlan?:     string;
    serviceStartDate?: string;
    trialDays?:       number;
    trialEndDate?:    string;
  }
) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const today          = new Date().toISOString().split("T")[0];
  const plan           = options?.initialPlan     ?? "pro_plus";
  const serviceStart   = options?.serviceStartDate ?? today;
  const trialDays      = options?.trialDays        ?? 30;
  const trialEnd       = options?.trialEndDate     ?? addDays(serviceStart, trialDays);
  // Rank is mandatory — default to the locked canonical default if unspecified.
  const detailerRank   = options?.detailerRank     ?? DEFAULT_DEALER_RANK;

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:          "approved",
      approved_by:              admin.id,
      approved_at:              new Date().toISOString(),
      plan,
      subscription_status:      "trial",
      trial_plan_type:          plan,
      service_start_date:       serviceStart,
      trial_start_date:         serviceStart,
      trial_end_date:           trialEnd,
      trial_status:             "active",
      auto_downgrade_plan_type: "basic",
      detailer_rank:            detailerRank,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  // Create dealer_members row so the owner can log in immediately after approval.
  // Fetch owner_user_id from the dealers row (set at self-registration time).
  const { data: dealerRow } = await supabase
    .from("dealers")
    .select("owner_user_id")
    .eq("id", dealerId)
    .single();

  if (dealerRow?.owner_user_id) {
    await supabase
      .from("dealer_members")
      .upsert(
        {
          dealer_id: dealerId,
          user_id:   dealerRow.owner_user_id,
          role:      "owner",
          status:    "active",
        },
        { onConflict: "dealer_id,user_id" },
      );
  }

  // Write-through sync of the assigned rank to dealer_settings (authoritative copy
  // is dealers.detailer_rank; dealer-facing UI + estimates read dealer_settings).
  await supabase
    .from("dealer_settings")
    .upsert(
      { dealer_id: dealerId, detailer_rank: detailerRank, updated_at: new Date().toISOString() },
      { onConflict: "dealer_id" },
    );

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_approved",
    details:        { plan, trial_end_date: trialEnd, detailer_rank: detailerRank },
  });

  return { success: true };
}

export async function rejectDealer(dealerId: string, reason: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:  "rejected",
      rejected_by:      admin.id,
      rejected_at:      new Date().toISOString(),
      rejection_reason: reason || "管理者による拒否",
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_rejected",
    details:        { reason },
  });

  return { success: true };
}

export async function suspendDealer(dealerId: string, reason: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Access cut FIRST: suspend all active dealer_members so getCurrentDealer()
  // returns null, blocking every protected dealer-facing page and server
  // action. Checking this error is mandatory — a silently-ignored failure here
  // previously let the dealer-state write below report success while access
  // was never actually cut. Cutting access before the dealer-state write also
  // means a later failure below leaves membership already suspended (fail
  // closed) instead of an inconsistent "suspended dealer, active members".
  const { error: memberError } = await supabase
    .from("dealer_members")
    .update({ status: "suspended" })
    .eq("dealer_id", dealerId)
    .eq("status", "active");

  if (memberError) return { success: false, error: memberError.message };

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:     "suspended",
      subscription_status: "suspended",
      rejection_reason:    reason || null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_suspended",
    details:        { reason },
  });

  return { success: true };
}

export async function reactivateDealer(dealerId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Determine correct subscription_status based on trial state
  const { data: dealer } = await supabase
    .from("dealers")
    .select("trial_status, trial_end_date")
    .eq("id", dealerId)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const trialActive =
    dealer?.trial_status === "active" &&
    dealer?.trial_end_date &&
    dealer.trial_end_date >= today;

  const subscriptionStatus = trialActive ? "trial" : "active";

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:     "approved",
      subscription_status: subscriptionStatus,
      rejection_reason:    null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  // Re-activate dealer_members that were suspended by suspendDealer().
  await supabase
    .from("dealer_members")
    .update({ status: "active" })
    .eq("dealer_id", dealerId)
    .eq("status", "suspended");

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_reactivated",
    details:        { subscription_status: subscriptionStatus },
  });

  return { success: true };
}

/**
 * Soft-delete (archive) a dealer AND cut off all access (Super Admin only).
 *
 * Sets dealers.deleted_at so the dealer is hidden from the admin
 * approval/list screen. This is a reversible soft delete — NO records are
 * hard-deleted and NO business data is removed:
 *   - auth.users are NOT removed (handle auth deletion separately in User Management)
 *   - customers / vehicles / estimates are NOT removed
 *   - dealer_members rows are NOT removed (preserved for audit/restore)
 *
 * Access cut: all ACTIVE dealer_members for this dealer are set to
 * status = 'suspended'. Because getCurrentDealer() only resolves memberships
 * with status = 'active', this immediately blocks the owner/staff from logging
 * into the dealer app or accessing any dealer data — closing the previous gap
 * where an archived dealer's members stayed active and could still sign in.
 *
 * Restore requires BOTH steps (e.g. via reactivateDealer, or manually):
 *   UPDATE dealers SET deleted_at = NULL WHERE id = ...
 *   UPDATE dealer_members SET status = 'active' WHERE dealer_id = ... AND status = 'suspended'
 */
export async function deleteDealer(dealerId: string) {
  const admin = await requireSuperAdmin();
  const supabase = createAdminClient();

  // Access cut FIRST — suspend every active membership for this dealer so the
  // owner and staff can no longer authenticate into the dealer app, BEFORE the
  // dealer is archived below. dealer_id is the server-action target (Super
  // Admin scoped), never client tenant data; the update is scoped to this
  // dealer only. Cutting access before archiving means a later archive-write
  // failure still leaves access already cut (fail closed) rather than an
  // archived dealer whose members can still sign in.
  const { data: suspendedMembers, error: memberError } = await supabase
    .from("dealer_members")
    .update({ status: "suspended" })
    .eq("dealer_id", dealerId)
    .eq("status", "active")
    .select("id");

  if (memberError) return { success: false, error: memberError.message };

  const suspendedCount = suspendedMembers?.length ?? 0;

  const { error } = await supabase
    .from("dealers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", dealerId)
    .is("deleted_at", null);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_deleted",
    details:        { soft_delete: true, suspended_members: suspendedCount },
  });

  return { success: true, suspendedMembers: suspendedCount };
}

/**
 * Restore an archived dealer AND re-activate its members (Super Admin only).
 *
 * Reverses deleteDealer(): clears dealers.deleted_at, restores approval to
 * 'approved', recomputes subscription_status from trial state, and re-activates
 * every suspended dealer_members row so the owner/staff can log into the dealer
 * app again. No business data is created or destroyed. dealer_id is the
 * server-action target (never client tenant data); all updates are scoped to
 * this one dealer.
 */
export async function restoreDealer(dealerId: string) {
  const admin = await requireSuperAdmin();
  const supabase = createAdminClient();

  // Recompute subscription from trial state, mirroring reactivateDealer().
  const { data: dealer } = await supabase
    .from("dealers")
    .select("trial_status, trial_end_date")
    .eq("id", dealerId)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const trialActive =
    dealer?.trial_status === "active" &&
    dealer?.trial_end_date &&
    dealer.trial_end_date >= today;

  const subscriptionStatus = trialActive ? "trial" : "active";

  const { error } = await supabase
    .from("dealers")
    .update({
      deleted_at:          null,
      approval_status:     "approved",
      subscription_status: subscriptionStatus,
      rejection_reason:    null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  // Re-activate every membership that deleteDealer()/suspendDealer() suspended.
  const { data: reactivated, error: memberError } = await supabase
    .from("dealer_members")
    .update({ status: "active" })
    .eq("dealer_id", dealerId)
    .eq("status", "suspended")
    .select("id");

  if (memberError) return { success: false, error: memberError.message };

  const reactivatedCount = reactivated?.length ?? 0;

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_restored",
    details:        { subscription_status: subscriptionStatus, reactivated_members: reactivatedCount },
  });

  return { success: true, reactivatedMembers: reactivatedCount };
}

// purgeDealer() runtime allow-list: Vercel Preview or a local test/dev
// runtime ONLY. Production is denied unconditionally, regardless of any other
// signal — VERCEL_ENV="production" always wins over NODE_ENV.
function isPurgeDealerRuntimePermitted(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "preview") return true;
  return process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
}

/**
 * Permanently delete (完全削除) a dealer — DISABLED.
 * Super Admin only (the auth boundary is still enforced).
 *
 * A true purge would need to delete the dealers row (cascading dealer_members
 * + related records) AND hard-delete the owner's auth user as one atomic
 * operation. This phase has no DB transaction/RPC available to make that
 * atomic, so a partial failure between the two deletes would leave
 * cross-system partial deletion — an unacceptable outcome for an irreversible
 * action. Rather than allow that risk, this action is disabled: it always
 * fails closed, first on a runtime check (never outside Preview/test), then
 * unconditionally on the missing atomic guarantee. Use deleteDealer()
 * (soft archive) plus a separate, explicit deleteUserAdmin() call instead.
 */
export async function purgeDealer(dealerId: string) {
  await requireSuperAdmin();

  if (!isPurgeDealerRuntimePermitted()) {
    return { success: false, error: "この操作は開発またはプレビュー環境でのみ許可されています" };
  }

  return {
    success: false,
    error:
      "完全削除は無効化されています（複数システムにまたがる削除をアトミックに行う手段が" +
      "実装されるまで）。個別に「アーカイブ」と、必要であれば「ユーザー完全削除」を使用してください。",
  };
}
