"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";

const SYSTEM_ADMIN_ID = "system-cron";

/**
 * Downgrades all dealers whose trial_end_date has passed and trial_status is 'active'.
 * Sets plan = auto_downgrade_plan_type and trial_status = 'ended'.
 * Should be called from a protected cron endpoint — never from client code.
 */
export async function checkAndDowngradeExpiredTrials(): Promise<{
  downgraded: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: expired, error: fetchError } = await supabase
    .from("dealers")
    .select("id, plan, trial_end_date, auto_downgrade_plan_type")
    .eq("trial_status", "active")
    .lt("trial_end_date", today);

  if (fetchError) {
    return { downgraded: 0, errors: [fetchError.message] };
  }
  if (!expired || expired.length === 0) {
    return { downgraded: 0, errors: [] };
  }

  const errors: string[] = [];
  let downgraded = 0;

  for (const dealer of expired) {
    const downgradePlan = dealer.auto_downgrade_plan_type ?? "basic";

    const { error } = await supabase
      .from("dealers")
      .update({
        plan:             downgradePlan,
        subscription_status: "active",
        trial_status:     "ended",
      })
      .eq("id", dealer.id);

    if (error) {
      errors.push(`dealer ${dealer.id}: ${error.message}`);
    } else {
      downgraded++;
      await writeAuditLog({
        adminUserId:    SYSTEM_ADMIN_ID,
        targetDealerId: dealer.id,
        action:         "trial_auto_downgraded",
        details:        { from: dealer.plan, to: downgradePlan },
      });
    }
  }

  return { downgraded, errors };
}
