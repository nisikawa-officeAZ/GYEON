"use server";

import { requireAdmin, requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";

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
  const detailerRank   = options?.detailerRank     ?? null;

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

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:     "suspended",
      subscription_status: "suspended",
      rejection_reason:    reason || null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  // Suspend all active dealer_members so getCurrentDealer() returns null,
  // blocking access to all protected dealer-facing pages and server actions.
  await supabase
    .from("dealer_members")
    .update({ status: "suspended" })
    .eq("dealer_id", dealerId)
    .eq("status", "active");

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
 * Soft-delete a dealer (Super Admin only).
 *
 * Sets dealers.deleted_at so the dealer is hidden from the admin
 * approval/list screen. This is a reversible soft delete — NO records are
 * hard-deleted:
 *   - auth.users are NOT removed
 *   - customers / vehicles / estimates are NOT removed
 *   - dealer_members are NOT removed
 * Restore with: UPDATE dealers SET deleted_at = NULL WHERE id = ...
 */
export async function deleteDealer(dealerId: string) {
  const admin = await requireSuperAdmin();
  const supabase = createAdminClient();

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
    details:        { soft_delete: true },
  });

  return { success: true };
}
