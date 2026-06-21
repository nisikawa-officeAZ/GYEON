"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { PaymentDB } from "./payment-types";

export async function getPayments(): Promise<PaymentDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(`
      id, dealer_id, invoice_id, customer_id,
      payment_number, payment_date, payment_method,
      amount, fee_amount, net_amount, status,
      reference_no, notes, internal_memo, created_at, updated_at,
      invoices ( invoice_number, title, total, paid_amount, balance_due, status ),
      customers ( last_name, first_name )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPayments error:", error);
    return [];
  }

  return (data ?? []) as unknown as PaymentDB[];
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<PaymentDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(`
      id, dealer_id, invoice_id, customer_id,
      payment_number, payment_date, payment_method,
      amount, fee_amount, net_amount, status,
      reference_no, notes, internal_memo, created_at, updated_at,
      invoices ( invoice_number, title, total, paid_amount, balance_due, status ),
      customers ( last_name, first_name )
    `)
    .eq("invoice_id", invoiceId)
    .eq("dealer_id", dealer.dealer_id)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPaymentsByInvoice error:", error);
    return [];
  }

  return (data ?? []) as unknown as PaymentDB[];
}
