"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { calculateNetAmount } from "./payment-types";
import { recalculateInvoicePayment } from "./recalculate-invoice-payment";

export async function createPayment(
  fd: FormData
): Promise<{ error: string } | { success: true; id: string }> {
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

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      dealer_id:      dealer.dealer_id,
      invoice_id,
      customer_id:    inv.customer_id ?? null,
      payment_number: (fd.get("payment_number") as string) || null,
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

  return { success: true, id: payment.id };
}
