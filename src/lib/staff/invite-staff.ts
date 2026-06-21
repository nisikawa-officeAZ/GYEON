"use server";

import { requireRole } from "@/lib/staff/require-role";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import type { DealerStaffRole, DealerStaffDB } from "@/lib/staff/staff-types";
import { createAuditLog } from "@/lib/audit/audit";

interface InviteStaffInput {
  email: string;
  name: string;
  role: DealerStaffRole;
}

interface InviteStaffResult {
  success: boolean;
  data?: DealerStaffDB;
  error?: string;
}

export async function inviteStaff(input: InviteStaffInput): Promise<InviteStaffResult> {
  try {
    const { role: callerRole, dealerId } = await requireRole(["owner", "manager"]);

    // Manager cannot invite owner or manager — can only invite staff/readonly
    if (callerRole === "manager" && (input.role === "owner" || input.role === "manager")) {
      return { success: false, error: "マネージャーはオーナーまたはマネージャーを招待できません" };
    }

    // Double-check dealer_id from auth (already resolved by requireRole, but re-fetch to be safe)
    const dealer = await getCurrentDealer();
    if (!dealer || dealer.dealer_id !== dealerId) {
      return { success: false, error: "ディーラー情報の取得に失敗しました" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_staff")
      .insert({
        dealer_id:  dealerId,
        email:      input.email,
        name:       input.name,
        role:       input.role,
        status:     "invited",
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    void createAuditLog({
      action: "create_staff",
      resource_type: "staff",
      resource_id: data.id,
      new_value: { email: input.email, name: input.name, role: input.role },
    });

    return { success: true, data: data as DealerStaffDB };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "招待に失敗しました" };
  }
}
