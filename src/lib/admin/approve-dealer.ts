"use server";

import { requireAdmin } from "./require-admin";
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
      approval_status:  "suspended",
      subscription_status: "suspended",
      rejection_reason: reason || null,
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
      approval_status:  "approved",
      subscription_status: subscriptionStatus,
      rejection_reason: null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_reactivated",
    details:        { subscription_status: subscriptionStatus },
  });

  return { success: true };
}
