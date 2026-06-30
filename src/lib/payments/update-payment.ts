"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { calculateNetAmount } from "./payment-types";
import { recalculateInvoicePayment } from "./recalculate-invoice-payment";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function updatePayment(
  id: string,
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return auth;

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Validate ownership and get invoice_id
  const { data: existing } = await supabase
    .from("payments")
    .select("id, invoice_id")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();
  if (!existing) return { error: "入金記録が見つかりません" };

  const amount     = parseFloat((fd.get("amount") as string) || "0");
  const fee_amount = parseFloat((fd.get("fee_amount") as string) || "0");
  const net_amount = calculateNetAmount(amount, fee_amount);

  const { error } = await supabase
    .from("payments")
    .update({
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
      updated_at:     new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("updatePayment error:", error);
    return { error: error.message };
  }

  // Recalculate invoice totals
  await recalculateInvoicePayment(supabase, existing.invoice_id as string, dealer.dealer_id);

  return { success: true };
}
