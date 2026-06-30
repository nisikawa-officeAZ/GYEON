"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { calculateNetAmount } from "./payment-types";
import { recalculateInvoicePayment } from "./recalculate-invoice-payment";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { createActivityLog } from "@/lib/activity/activity-log";
import { createNotification } from "@/lib/notifications/notification";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createEngagementEvent } from "@/lib/customer-engagement/context";
import { EngagementWorkflowRuntime } from "@/lib/customer-engagement/engine/runtime";

export async function createPayment(
  fd: FormData
): Promise<{ error: string } | { success: true; id: string }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const invoice_id = fd.get("invoice_id") as string | null;
  if (!invoice_id) return { error: "請求書IDが必要です" };

  // Validate invoice ownership and get customer_id
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, customer_id")
    .eq("id", invoice_id)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();
  if (!inv) return { error: "請求書が見つかりません" };

  const amount     = parseFloat((fd.get("amount") as string) || "0");
  const fee_amount = parseFloat((fd.get("fee_amount") as string) || "0");
  const net_amount = calculateNetAmount(amount, fee_amount);

  const rawPaymentNumber    = (fd.get("payment_number") as string) || null;
  const resolvedPaymentNumber = rawPaymentNumber || (await getNextDocumentNumber("payment")) || null;

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      dealer_id:      dealer.dealer_id,
      invoice_id,
      customer_id:    inv.customer_id ?? null,
      payment_number: resolvedPaymentNumber,
      payment_date:   (fd.get("payment_date") as string) || null,
      payment_method: (fd.get("payment_method") as string) || "cash",
      amount,
      fee_amount,
      net_amount,
      status:         (fd.get("status") as string) || "completed",
      reference_no:   (fd.get("reference_no") as string) || null,
      notes:          (fd.get("notes") as string) || null,
      internal_memo:  (fd.get("internal_memo") as string) || null,
    })
    .select("id")
    .single();

  if (error || !payment) {
    console.error("createPayment error:", error);
    return { error: error?.message ?? "入金の登録に失敗しました" };
  }

  // Recalculate invoice totals
  await recalculateInvoicePayment(supabase, invoice_id, dealer.dealer_id);

  void createActivityLog({
    entity_type: "payment",
    entity_id:   payment.id,
    customer_id: inv.customer_id ?? null,
    action:      "paid",
    title:       `入金を記録: ${amount.toLocaleString()}円`,
  });

  void createNotification({
    type:        "success",
    title:       "入金を記録しました",
    message:     `${amount.toLocaleString()}円が記録されました`,
    entity_type: "payment",
    entity_id:   payment.id,
  });

  // Phase 4 Sprint 5 — emit PAYMENT_COMPLETED for the payment engagement flow.
  // Only for completed payments tied to a customer; dealer_id resolved server-side.
  const paymentStatus = (fd.get("status") as string) || "completed";
  if (paymentStatus === "completed" && inv.customer_id) {
    const pm = (fd.get("payment_method") as string) || "cash";
    const method = (["cash", "card", "transfer", "other"].includes(pm) ? pm : "other") as
      "cash" | "card" | "transfer" | "other";
    const event = await createEngagementEvent("PAYMENT_COMPLETED", inv.customer_id, {
      payment_id: payment.id,
      invoice_id,
      amount,
      currency:   "JPY",
      method,
      paid_at:    (fd.get("payment_date") as string) || new Date().toISOString(),
    });
    if (event) {
      await new EngagementWorkflowRuntime().dispatch(event);
    }
  }

  return { success: true, id: payment.id };
}
