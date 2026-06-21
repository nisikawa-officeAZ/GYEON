"use server";

// Recalculates invoice paid_amount / balance_due / status
// based on completed payments for the given invoice_id.
// Called after every payment INSERT / UPDATE / DELETE.

import { SupabaseClient } from "@supabase/supabase-js";

export async function recalculateInvoicePayment(
  supabase: SupabaseClient,
  invoiceId: string,
  dealerId: string,
): Promise<void> {
  // Sum only 'completed' payments
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("dealer_id", dealerId)
    .eq("status", "completed");

  const paidAmount = (payments ?? []).reduce((s, p) => s + (p.amount as number), 0);

  // Fetch invoice for total / due_date
  const { data: inv } = await supabase
    .from("invoices")
    .select("total, due_date, status")
    .eq("id", invoiceId)
    .eq("dealer_id", dealerId)
    .single();

  if (!inv) return;

  const total      = inv.total as number;
  const balanceDue = Math.max(0, total - paidAmount);

  // Determine new status
  let newStatus: string;
  const today    = new Date().toISOString().slice(0, 10);
  const overdue  = inv.due_date && inv.due_date < today && balanceDue > 0;

  if (balanceDue <= 0) {
    newStatus = "paid";
  } else if (paidAmount > 0) {
    newStatus = overdue ? "overdue" : "partially_paid";
  } else {
    // No payments yet — keep issued/draft, or mark overdue if past due
    const currentStatus = inv.status as string;
    if (overdue && (currentStatus === "issued" || currentStatus === "partially_paid")) {
      newStatus = "overdue";
    } else {
      newStatus = currentStatus === "paid" || currentStatus === "partially_paid"
        ? "issued"
        : currentStatus;
    }
  }

  await supabase
    .from("invoices")
    .update({
      paid_amount: paidAmount,
      balance_due: balanceDue,
      status:      newStatus,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("dealer_id", dealerId);
}
