"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { isValidRank } from "@/lib/ranks/dealer-ranks";

export async function extendDealerTrial(dealerId: string, newTrialEndDate: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("dealers")
    .select("trial_end_date, trial_status, subscription_status")
    .eq("id", dealerId)
    .single();

  const wasEnded = current?.trial_status === "ended";

  const { error } = await supabase
    .from("dealers")
    .update({
      trial_end_date:       newTrialEndDate,
      trial_status:         "active",
      subscription_status:  wasEnded ? "trial" : (current?.subscription_status ?? "trial"),
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "trial_extended",
    details:        { from: current?.trial_end_date, to: newTrialEndDate, was_ended: wasEnded },
  });

  return { success: true };
}

export async function changeDealerRank(dealerId: string, newRank: string) {
  const admin = await requireAdmin();

  // Validate server-side against the canonical rank registry — never trust the client.
  if (!isValidRank(newRank)) {
    return { success: false, error: "無効なランクです" };
  }

  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("dealers")
    .select("detailer_rank")
    .eq("id", dealerId)
    .single();

  // dealers.detailer_rank is the authoritative rank.
  const { error } = await supabase
    .from("dealers")
    .update({ detailer_rank: newRank })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  // Write-through sync so dealer-facing settings (and estimates) stay consistent.
  await supabase
    .from("dealer_settings")
    .upsert(
      { dealer_id: dealerId, detailer_rank: newRank, updated_at: new Date().toISOString() },
      { onConflict: "dealer_id" },
    );

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "rank_changed",
    details:        { from: current?.detailer_rank, to: newRank },
  });

  return { success: true };
}

export async function resetDealerAccount(dealerId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("dealers")
    .select("approval_status, plan, subscription_status, trial_status")
    .eq("id", dealerId)
    .single();

  // Reset to pending: clear approval/trial state, preserve dealer data
  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:          "pending",
      approved_by:              null,
      approved_at:              null,
      rejected_by:              null,
      rejected_at:              null,
      rejection_reason:         null,
      subscription_status:      "cancelled",
      trial_plan_type:          null,
      service_start_date:       null,
      trial_start_date:         null,
      trial_end_date:           null,
      trial_status:             "none",
      auto_downgrade_plan_type: null,
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "dealer_reset",
    details:        {
      previous_approval_status:  current?.approval_status,
      previous_plan:             current?.plan,
      previous_subscription:     current?.subscription_status,
      previous_trial_status:     current?.trial_status,
    },
  });

  return { success: true };
}
