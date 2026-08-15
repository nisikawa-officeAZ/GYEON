"use server";

// B3-B1B I1 — atomic legacy-direct → allocated conversion.
//
// EXACTLY ONE financial mutation: convert_payment_to_allocated_rpc on the authenticated
// SSR client. The RPC owns eligibility (completed, not frozen by an issued statement),
// the original-invoice allocation requirement, the conversion fingerprint retry contract,
// allocation caps, and the in-transaction recalculation of every affected invoice.
// This action never updates payments, never writes payment_allocations, and never
// recalculates invoices in TypeScript. Only payment_id and allocation rows come from the
// UI; dealer and actor are server-resolved.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { PaymentAllocationInput } from "./payment-types";

function mapRpcError(message: string | undefined): string {
  switch (message) {
    case "payment_rpc_payment_not_found":     return "入金記録が見つかりません";
    case "payment_rpc_payment_not_completed": return "完了済みの入金のみ振替できます";
    case "payment_rpc_payment_frozen_by_issued_statement":
      return "発行済みの月次請求書に含まれているため振替できません";
    case "payment_rpc_conversion_missing_original_invoice":
      return "元の請求書への割当が必要です";
    case "payment_rpc_conversion_requires_allocations": return "割当先の請求書を指定してください";
    case "payment_rpc_conversion_conflict":
      return "この入金は既に別の内容で振替済みです";
    case "payment_rpc_invalid_allocation":     return "割当内容が不正です";
    case "payment_rpc_not_finance_authorized": return "この操作を行う権限がありません";
    case "payment_rpc_actor_mismatch":         return "認証エラー";
    default:
      return message || "入金の振替に失敗しました";
  }
}

export async function convertPaymentToAllocated(
  paymentId: string,
  allocations: PaymentAllocationInput[],
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!paymentId || typeof paymentId !== "string") return { error: "入金記録が見つかりません" };
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return { error: "割当先の請求書を指定してください" };
  }
  const seen = new Set<string>();
  for (const a of allocations) {
    if (!a || typeof a.invoice_id !== "string" || !a.invoice_id || seen.has(a.invoice_id)) {
      return { error: "割当内容が不正です" };
    }
    if (typeof a.allocated_amount !== "number" || !Number.isFinite(a.allocated_amount) || a.allocated_amount <= 0) {
      return { error: "割当内容が不正です" };
    }
    if (typeof a.allocation_order !== "number" || !Number.isInteger(a.allocation_order) || a.allocation_order < 0) {
      return { error: "割当内容が不正です" };
    }
    seen.add(a.invoice_id);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };

  const { data, error } = await supabase.rpc("convert_payment_to_allocated_rpc", {
    p_dealer_id:   auth.dealerId,   // server-resolved tenant
    p_actor:       actor,           // session user; RPC re-verifies finance authority
    p_payment_id:  paymentId,
    p_allocations: allocations.map((a) => ({
      invoice_id:       a.invoice_id,
      allocated_amount: a.allocated_amount,
      allocation_order: a.allocation_order,
    })),
  });

  if (error || !data) {
    console.error("convertPaymentToAllocated rpc error:", error);
    return { error: mapRpcError(error?.message) };
  }
  return { success: true };
}
