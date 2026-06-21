"use server";

import { requireRole } from "@/lib/staff/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit/audit";

interface DisableStaffResult {
  success: boolean;
  error?: string;
}

export async function disableStaff(staffId: string): Promise<DisableStaffResult> {
  try {
    const { role: callerRole, dealerId } = await requireRole(["owner", "manager"]);

    const supabase = await createClient();

    // Fetch target staff
    const { data: target, error: fetchError } = await supabase
      .from("dealer_staff")
      .select("id, role, status, dealer_id")
      .eq("id", staffId)
      .eq("dealer_id", dealerId)
      .single();

    if (fetchError || !target) {
      return { success: false, error: "スタッフが見つかりません" };
    }

    // Manager cannot disable other managers or owners
    if (callerRole === "manager" && (target.role === "owner" || target.role === "manager")) {
      return { success: false, error: "マネージャーはオーナーまたは他のマネージャーを無効化できません" };
    }

    // Prevent disabling the last active owner
    if (target.role === "owner") {
      const { count, error: countError } = await supabase
        .from("dealer_staff")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", dealerId)
        .eq("role", "owner")
        .eq("status", "active");

      if (countError) {
        return { success: false, error: "オーナー数の確認に失敗しました" };
      }

      if ((count ?? 0) <= 1) {
        return { success: false, error: "最後のアクティブなオーナーは無効化できません" };
      }
    }

    const { error: updateError } = await supabase
      .from("dealer_staff")
      .update({ status: "disabled", updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("dealer_id", dealerId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    void createAuditLog({
      action: "delete_staff",
      resource_type: "staff",
      resource_id: staffId,
      new_value: { status: "disabled" },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "無効化に失敗しました" };
  }
}

export async function enableStaff(staffId: string): Promise<DisableStaffResult> {
  try {
    const { dealerId } = await requireRole(["owner", "manager"]);

    const supabase = await createClient();

    // Verify target staff belongs to same dealer
    const { data: target, error: fetchError } = await supabase
      .from("dealer_staff")
      .select("id, dealer_id")
      .eq("id", staffId)
      .eq("dealer_id", dealerId)
      .single();

    if (fetchError || !target) {
      return { success: false, error: "スタッフが見つかりません" };
    }

    const { error: updateError } = await supabase
      .from("dealer_staff")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("dealer_id", dealerId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "有効化に失敗しました" };
  }
}
