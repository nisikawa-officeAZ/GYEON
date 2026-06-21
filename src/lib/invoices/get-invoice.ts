"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { InvoiceDB } from "./invoice-types";

export async function getInvoice(id: string): Promise<InvoiceDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, dealer_id, customer_id, vehicle_id, estimate_id, work_order_id, completion_report_id,
      invoice_number, status, title, issue_date, due_date,
      subtotal, discount_amount, tax_rate, tax_amount, total, paid_amount, balance_due,
      notes, internal_memo, pdf_file_path, pdf_file_url, deleted_at, created_at, updated_at,
      customers ( last_name, first_name, phone, email ),
      vehicles ( maker, model, year, grade, plate_number, color ),
      estimates ( estimate_number, title, total ),
      work_orders ( work_order_number, title, status ),
      invoice_items (
        id, invoice_id, dealer_id, category, item_name, description,
        quantity, unit_price, discount_rate, line_total, sort_order, created_at, updated_at
      )
    `)
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("getInvoice error:", error);
    return null;
  }

  return data as unknown as InvoiceDB;
}

export async function getInvoicesByWorkOrder(workOrderId: string): Promise<InvoiceDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, dealer_id, customer_id, vehicle_id, estimate_id, work_order_id, completion_report_id,
      invoice_number, status, title, issue_date, due_date,
      subtotal, discount_amount, tax_rate, tax_amount, total, paid_amount, balance_due,
      notes, internal_memo, pdf_file_path, pdf_file_url, deleted_at, created_at, updated_at,
      customers ( last_name, first_name, phone, email ),
      vehicles ( maker, model, year, grade, plate_number, color ),
      estimates ( estimate_number, title, total ),
      work_orders ( work_order_number, title, status )
    `)
    .eq("work_order_id", workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getInvoicesByWorkOrder error:", error);
    return [];
  }

  return (data ?? []) as unknown as InvoiceDB[];
}
