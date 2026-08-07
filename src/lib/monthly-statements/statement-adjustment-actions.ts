"use server";

// B3-B1B I2 — draft-only statement adjustments.
//
// Finance-only, authenticated SSR client. dealer, actor, and the statement's customer are
// resolved SERVER-side (client identity values are never authoritative). Exactly one
// adjustment INSERT or one adjustment DELETE per action; statement totals are NEVER updated
// from TypeScript — the issuance RPC stamps authoritative totals. The accepted database
// trigger re-enforces draft-only mutability even if this boundary were bypassed.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { isValidAdjustment } from "./statement-adjustment-core";

export async function addStatementAdjustment(
  statementId: string,
  signedAmount: number,
  reason: string,
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!statementId) return { error: "月次請求書が見つかりません" };
  if (!isValidAdjustment({ signed_amount: signedAmount, reason })) {
    return { error: "調整額は0以外の数値、理由は必須です" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };

  // Server-resolved statement scope: dealer-scoped lookup supplies customer_id + status.
  const { data: stmt } = await supabase
    .from("monthly_statements")
    .select("id, dealer_id, customer_id, status")
    .eq("id", statementId)
    .eq("dealer_id", auth.dealerId)
    .maybeSingle();
  if (!stmt) return { error: "月次請求書が見つかりません" };
  if (stmt.status !== "draft") return { error: "下書きの月次請求書のみ調整できます" };

  const { data, error } = await supabase
    .from("monthly_statement_adjustments")
    .insert({
      dealer_id:     stmt.dealer_id,
      customer_id:   stmt.customer_id,
      statement_id:  stmt.id,
      signed_amount: signedAmount,
      reason:        reason.trim(),
      created_by:    actor,
    })
    .select("id");

  if (error) {
    console.error("addStatementAdjustment error:", error);
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "調整の登録に失敗しました" };
  return { success: true };
}

export async function deleteStatementAdjustment(
  adjustmentId: string,
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!adjustmentId) return { error: "調整が見つかりません" };

  const supabase = await createClient();

  // Draft-only gate resolved server-side before the single DELETE.
  const { data: adj } = await supabase
    .from("monthly_statement_adjustments")
    .select("id, statement_id, monthly_statements ( status )")
    .eq("id", adjustmentId)
    .eq("dealer_id", auth.dealerId)
    .maybeSingle();
  if (!adj) return { error: "調整が見つかりません" };
  const parentStatus = (adj as unknown as { monthly_statements: { status: string } | null }).monthly_statements?.status;
  if (parentStatus !== "draft") return { error: "下書きの月次請求書のみ調整できます" };

  const { data, error } = await supabase
    .from("monthly_statement_adjustments")
    .delete()
    .eq("id", adjustmentId)
    .eq("dealer_id", auth.dealerId)
    .select("id");

  if (error) {
    console.error("deleteStatementAdjustment error:", error);
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "調整が見つかりません" };
  return { success: true };
}
