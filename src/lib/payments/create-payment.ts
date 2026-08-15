"use server";

// B3-B1B I1-R1 — payment recording bound to the accepted atomic RPC.
//
// EXACTLY ONE financial mutation: record_payment_with_allocations_rpc, called on the
// authenticated SSR client. The RPC owns tenant scope, customer/invoice validation,
// amount/fee/net integrity, allocation caps, idempotency, and the in-transaction invoice
// recalculation. This action never writes payments/allocations/invoices directly, never
// derives financial truth from pre-reads, and never allocates document numbers.
//
// dealer_id and actor are server-resolved; FormData supplies only user-entered values.
// p_net_amount is passed as null — the RPC derives net = amount - fee and a client value
// is never authoritative.
//
// NON-FINANCIAL SIDE EFFECTS ARE DEFERRED (I1-R1): the RPC returns the existing payment
// for an identical retry without reporting created-versus-replayed, so emitting activity
// logs / notifications / engagement here would duplicate them on every retry. They return
// once a transactional-outbox or explicit created-vs-replayed contract exists.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { PaymentAllocationInput, PaymentDB, PaymentMode } from "./payment-types";

const MODES: PaymentMode[] = ["legacy_direct", "allocated", "unapplied"];

function mapRpcError(message: string | undefined): string {
  switch (message) {
    case "payment_idempotency_conflict":
      return "同じリクエストキーで異なる内容の入金が既に登録されています。フォームを開き直してください";
    case "payment_rpc_invalid_amount":         return "入金額が不正です";
    case "payment_rpc_invalid_fee":            return "手数料が不正です";
    case "payment_rpc_invalid_allocation":     return "割当内容が不正です";
    case "payment_rpc_invoice_not_found":      return "請求書が見つかりません";
    case "payment_rpc_customer_not_found":     return "顧客が見つかりません";
    case "payment_rpc_not_finance_authorized": return "この操作を行う権限がありません";
    case "payment_rpc_actor_mismatch":         return "認証エラー";
    case "payment_direct_exceeds_invoice_total":
      return "入金額が請求書残高を超えています。割当入金または前受金をご利用ください";
    default:
      return message || "入金の登録に失敗しました";
  }
}

function parseAllocations(raw: string): PaymentAllocationInput[] | null {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const seen = new Set<string>();
  const out: PaymentAllocationInput[] = [];
  for (const e of parsed) {
    const inv = typeof (e as { invoice_id?: unknown })?.invoice_id === "string"
      ? (e as { invoice_id: string }).invoice_id : "";
    const amt = (e as { allocated_amount?: unknown })?.allocated_amount;
    const ord = (e as { allocation_order?: unknown })?.allocation_order;
    if (!inv || seen.has(inv)) return null;
    if (typeof amt !== "number" || !Number.isFinite(amt) || amt <= 0) return null;
    if (typeof ord !== "number" || !Number.isInteger(ord) || ord < 0) return null;
    seen.add(inv);
    out.push({ invoice_id: inv, allocated_amount: amt, allocation_order: ord });
  }
  return out;
}

export async function createPayment(
  fd: FormData
): Promise<{ error: string } | { success: true; id: string }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };

  const mode = (fd.get("mode") as string) || "";
  if (!MODES.includes(mode as PaymentMode)) return { error: "入金区分が不正です" };

  const idempotencyKey = ((fd.get("idempotency_key") as string) || "").trim();
  if (!idempotencyKey) return { error: "リクエストキーがありません。フォームを開き直してください" };

  const invoiceId  = ((fd.get("invoice_id") as string) || "").trim() || null;
  const customerId = ((fd.get("customer_id") as string) || "").trim() || null;
  const allocations = parseAllocations((fd.get("allocations") as string) || "");
  if (allocations === null) return { error: "割当内容が不正です" };

  // Mode-shape gates (fail early with a clear message; the RPC re-validates everything).
  if (mode === "legacy_direct") {
    if (!invoiceId) return { error: "請求書IDが必要です" };
    if (allocations.length !== 0) return { error: "請求書直接入金に割当は指定できません" };
  } else {
    if (!customerId) return { error: "顧客の選択が必要です" };
    if (mode === "allocated" && allocations.length === 0) return { error: "割当先の請求書を指定してください" };
    if (mode === "unapplied" && allocations.length !== 0) return { error: "前受金に割当は指定できません" };
  }

  const amount = Number(fd.get("amount"));
  const fee    = fd.get("fee_amount") === null || fd.get("fee_amount") === "" ? 0 : Number(fd.get("fee_amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "入金額が不正です" };
  if (!Number.isFinite(fee) || fee < 0)        return { error: "手数料が不正です" };

  const { data, error } = await supabase.rpc("record_payment_with_allocations_rpc", {
    p_dealer_id:       auth.dealerId,                                  // server-resolved tenant
    p_actor:           actor,                                          // session user; RPC re-verifies
    p_mode:            mode,
    p_invoice_id:      mode === "legacy_direct" ? invoiceId : null,
    p_customer_id:     mode === "legacy_direct" ? null : customerId,
    p_amount:          amount,
    p_fee_amount:      fee,
    p_net_amount:      null,                                           // RPC-derived; never client authority
    p_payment_date:    (fd.get("payment_date") as string) || null,
    p_payment_method:  (fd.get("payment_method") as string) || "cash",
    p_status:          "completed",                                    // I1: creation is completed-only
    p_payment_number:  (fd.get("payment_number") as string) || null,
    p_reference_no:    (fd.get("reference_no") as string) || null,
    p_notes:           (fd.get("notes") as string) || null,
    p_internal_memo:   (fd.get("internal_memo") as string) || null,
    p_idempotency_key: idempotencyKey,
    p_allocations:     allocations,
  });

  if (error || !data) {
    console.error("createPayment rpc error:", error);
    return { error: mapRpcError(error?.message) };
  }
  const payment = (Array.isArray(data) ? data[0] : data) as PaymentDB;

  // No non-financial side effects here (see the header): an identical retry returns the
  // SAME payment id and must remain observably identical to its first submission.
  return { success: true, id: payment.id };
}
