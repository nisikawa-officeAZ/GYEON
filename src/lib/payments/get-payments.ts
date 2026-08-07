"use server";

// B3-B1B I1 — dealer-scoped payment read models (authenticated client, read-only).
// payments.invoice_id is nullable; the allocation aggregate lets the UI derive the
// display mode (legacy_direct / allocated / unapplied) without a second round trip.
// Also hosts the global-creation read helpers (payable customers + open invoices).

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { PaymentDB, PayableCustomerOption, OpenInvoiceOption } from "./payment-types";

const PAYMENT_SELECT = `
  id, dealer_id, invoice_id, customer_id,
  payment_number, payment_date, payment_method,
  amount, fee_amount, net_amount, status,
  reference_no, notes, internal_memo, created_at, updated_at,
  payment_allocations ( allocated_amount ),
  invoices ( invoice_number, title, total, paid_amount, balance_due, status ),
  customers ( last_name, first_name )
`;

export async function getPayments(): Promise<PaymentDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("dealer_id", dealer.dealer_id)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPayments error:", error);
    return [];
  }
  return (data ?? []) as unknown as PaymentDB[];
}

/**
 * I1-R1: every payment applied to ONE invoice — the union of legacy-direct rows
 * (payments.invoice_id = invoice) and allocated rows linked through a dealer-scoped
 * payment_allocations row. Each returned row carries invoice_context_amount: the full
 * payment amount for a direct row, or ONLY the persisted allocated_amount applied to the
 * requested invoice for an allocated row. Deduplicated by payment id, deterministically
 * ordered (payment_date desc, created_at desc, id). FAIL-CLOSED: any failed sub-query
 * returns [] rather than a silently incomplete partial result.
 */
export async function getPaymentsByInvoice(invoiceId: string): Promise<PaymentDB[]> {
  if (!invoiceId) return [];
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  // 1. dealer-scoped allocations pointing at THIS invoice -> payment ids + applied amounts
  const allocRes = await supabase
    .from("payment_allocations")
    .select("payment_id, allocated_amount")
    .eq("invoice_id", invoiceId)
    .eq("dealer_id", dealer.dealer_id);
  if (allocRes.error) {
    console.error("getPaymentsByInvoice allocations error:", allocRes.error);
    return [];
  }
  const appliedByPayment = new Map<string, number>();
  for (const row of (allocRes.data ?? []) as { payment_id: string; allocated_amount: number }[]) {
    appliedByPayment.set(row.payment_id, (appliedByPayment.get(row.payment_id) ?? 0) + row.allocated_amount);
  }

  // 2. legacy-direct payments of this invoice
  const directRes = await supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("invoice_id", invoiceId)
    .eq("dealer_id", dealer.dealer_id);
  if (directRes.error) {
    console.error("getPaymentsByInvoice direct error:", directRes.error);
    return [];
  }

  // 3. allocated payments linked through the allocation rows
  let allocatedRows: PaymentDB[] = [];
  const allocatedIds = [...appliedByPayment.keys()];
  if (allocatedIds.length > 0) {
    const byIdsRes = await supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .in("id", allocatedIds)
      .eq("dealer_id", dealer.dealer_id);
    if (byIdsRes.error) {
      console.error("getPaymentsByInvoice allocated error:", byIdsRes.error);
      return [];
    }
    allocatedRows = (byIdsRes.data ?? []) as unknown as PaymentDB[];
  }

  // union + dedup (a direct row wins; its context amount is the full payment amount)
  const merged = new Map<string, PaymentDB>();
  for (const p of allocatedRows) {
    merged.set(p.id, { ...p, invoice_context_amount: appliedByPayment.get(p.id) ?? 0 });
  }
  for (const p of (directRes.data ?? []) as unknown as PaymentDB[]) {
    merged.set(p.id, { ...p, invoice_context_amount: p.amount });
  }

  // deterministic ordering: payment_date desc (nulls last), created_at desc, id asc
  return [...merged.values()].sort((a, b) => {
    const da = a.payment_date ?? "";
    const db = b.payment_date ?? "";
    if (da !== db) return da === "" ? 1 : db === "" ? -1 : (da < db ? 1 : -1);
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });
}

/** Active (non-deleted) customers of the resolved dealer, for the global creation flow. */
export async function getPayableCustomers(): Promise<PayableCustomerOption[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, last_name, first_name")
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("last_name", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getPayableCustomers error:", error);
    return [];
  }
  return (data ?? []) as PayableCustomerOption[];
}

/**
 * Open (payable) invoices of one customer: balance_due > 0, not deleted, and in a payable
 * lifecycle state. Ordered oldest due date first with deterministic fallbacks
 * (null due_date last, then invoice_number, then id) — the advisory-proposal order.
 * Read-only; the database caps remain the allocation authority.
 */
export async function getOpenInvoicesForCustomer(customerId: string): Promise<OpenInvoiceOption[]> {
  if (!customerId) return [];
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, title, due_date, total, paid_amount, balance_due, status")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .in("status", ["issued", "partially_paid", "overdue"])
    .gt("balance_due", 0)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("invoice_number", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    console.error("getOpenInvoicesForCustomer error:", error);
    return [];
  }
  return (data ?? []) as OpenInvoiceOption[];
}
