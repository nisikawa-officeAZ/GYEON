"use server";

// B3-B1B I2 — draft abandonment.
//
// EXACTLY ONE dealer-, id-, and status-constrained DELETE against monthly_statements with a
// returned-row check. The database owns dependent cleanup (monthly_statement_lines and
// monthly_statement_adjustments cascade with the draft) and the accepted no-hard-delete
// trigger keeps issued/voided statements undeletable even if this boundary were bypassed.
// The burned statement number is permanent: recreation allocates the NEXT number.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function abandonMonthlyStatementDraft(
  statementId: string,
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!statementId || typeof statementId !== "string") {
    return { error: "月次請求書が見つかりません" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_statements")
    .delete()
    .eq("id", statementId)
    .eq("dealer_id", auth.dealerId)
    .eq("status", "draft")
    .select("id");

  if (error) {
    console.error("abandonMonthlyStatementDraft error:", error);
    if (error.message === "monthly_statement_no_hard_delete") {
      return { error: "発行済み・取消済みの月次請求書は削除できません" };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "削除できる下書きが見つかりません（既に発行済みか削除済みの可能性があります）" };
  }
  return { success: true };
}
