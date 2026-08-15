"use server";

// DealerOS — Customer Accounts Receivable service (Phase E8.6, no persistence).
//
// Dealer-scoped reusable service: fetches a customer's invoices + completed
// payments and returns the AR summary via the pure calculations. dealer_id is
// resolved server-side via getCurrentDealer(); customerId is dealer-scoped by
// the queries. Nothing is written.

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import {
  summarizeAccountsReceivable,
  type AccountsReceivableSummary,
  type ARInvoice,
  type ARPayment,
} from "./ar-calculations";

export async function getCustomerAccountsReceivable(
  customerId: string,
): Promise<AccountsReceivableSummary | { error: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };
  if (!customerId) return { error: "顧客が指定されていません" };

  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total, paid_amount, due_date, status")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .neq("status", "cancelled");

  // E8.7: link payments through the customer's invoices (invoice_id), NOT
  // payments.customer_id, so legacy payments without customer_id are still
  // counted for Last Payment Date. Amounts already come from invoice.paid_amount.
  const invoiceIds = (invoices ?? []).map((i) => (i as { id: string }).id);
  let payments: ARPayment[] = [];
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from("payments")
      .select("payment_date, amount, status")
      .eq("dealer_id", dealer.dealer_id)
      .in("invoice_id", invoiceIds)
      .eq("status", "completed");
    payments = (data ?? []) as ARPayment[];
  }

  const today = new Date().toISOString().slice(0, 10);
  return summarizeAccountsReceivable((invoices ?? []) as ARInvoice[], payments, today);
}
