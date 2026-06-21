"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";

export async function updateDealerPlan(
  dealerId: string,
  plan: "basic" | "pro" | "pro_plus"
) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Get current plan for audit
  const { data: current } = await supabase
    .from("dealers")
    .select("plan")
    .eq("id", dealerId)
    .single();

  const { error } = await supabase
    .from("dealers")
    .update({ plan })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId: admin.id,
    targetDealerId: dealerId,
    action: "plan_changed",
    details: { from: current?.plan, to: plan },
  });

  return { success: true };
}

export async function updateDealerSubscriptionStatus(
  dealerId: string,
  status: "active" | "trial" | "expired" | "cancelled"
) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("dealers")
    .select("subscription_status")
    .eq("id", dealerId)
    .single();

  const { error } = await supabase
    .from("dealers")
    .update({ subscription_status: status })
    .eq("id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId: admin.id,
    targetDealerId: dealerId,
    action: "dealer_status_changed",
    details: { from: current?.subscription_status, to: status },
  });

  return { success: true };
}
