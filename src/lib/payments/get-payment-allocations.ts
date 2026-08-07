"use server";

// B3-B1B I1 — read model for a payment's persisted allocations (authenticated client,
// dealer-scoped, read-only; RLS is the row authority; no admin client anywhere).

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { PaymentAllocationRow } from "./payment-types";

export async function getPaymentAllocations(paymentId: string): Promise<PaymentAllocationRow[]> {
  if (!paymentId) return [];
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_allocations")
    .select(`
      id, payment_id, invoice_id, allocated_amount, allocation_order,
      invoices ( invoice_number, title, due_date, total, balance_due, status )
    `)
    .eq("payment_id", paymentId)
    .eq("dealer_id", dealer.dealer_id)
    .order("allocation_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getPaymentAllocations error:", error);
    return [];
  }
  return (data ?? []) as unknown as PaymentAllocationRow[];
}
