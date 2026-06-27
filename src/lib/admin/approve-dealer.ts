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
  options?: { trialEndDate?: string }
) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const trialEnd = options?.trialEndDate ?? addDays(today, 30);

  const { error } = await supabase
    .from("dealers")
    .update({
      approval_status:          "approved",
      approved_by:              admin.id,
      approved_at:              new Date().toISOString(),
      plan:                     "pro_plus",
      subscription_status:      "trial",
      trial_plan_type:          "pro_plus",
      service_start_date:       today,
      trial_start_date:         today,
      trial_end_date:           trialEnd,
      trial_status:             "active",
      auto_downgrade_plan_type: "basic",
    })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:     admin.id,
    targetDealerId:  dealerId,
    action:          "dealer_approved",
    details:         { plan: "pro_plus", trial_end_date: trialEnd },
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
