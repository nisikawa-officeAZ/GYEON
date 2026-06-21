"use server";

import { requireRole } from "@/lib/staff/require-role";
import { createClient } from "@/lib/supabase/server";
import type { DealerStaffRole } from "@/lib/staff/staff-types";
import { createAuditLog } from "@/lib/audit/audit";

interface UpdateStaffRoleResult {
  success: boolean;
  error?: string;
}

export async function updateStaffRole(
  staffId: string,
  newRole: DealerStaffRole
): Promise<UpdateStaffRoleResult> {
  try {
    const { dealerId } = await requireRole(["owner"]);

    const supabase = await createClient();

    // Verify target staff belongs to same dealer
    const { data: target, error: fetchError } = await supabase
      .from("dealer_staff")
      .select("id, role, status, dealer_id")
      .eq("id", staffId)
      .eq("dealer_id", dealerId)
      .single();

    if (fetchError || !target) {
      return { success: false, error: "スタッフが見つかりません" };
    }

    // Prevent demoting the last owner
    if (target.role === "owner" && newRole !== "owner") {
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
        return { success: false, error: "最後のオーナーは降格できません" };
      }
    }

    const { error: updateError } = await supabase
      .from("dealer_staff")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("dealer_id", dealerId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    void createAuditLog({
      action: "change_role",
      resource_type: "role",
      resource_id: staffId,
      old_value: { role: target.role },
      new_value: { role: newRole },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}
