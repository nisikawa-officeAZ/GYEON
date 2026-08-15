// TEMPLATE-C2-DN — the ONE delivery-note data loader + business gate.
//
// A delivery note may only be produced from an ALREADY-ISSUED invoice whose work order carries a
// real completion date. This module reads through the CALLER'S RLS-scoped client (never the
// service role), scoped by BOTH the invoice id AND the authenticated dealer id, so a foreign
// invoice id resolves to nothing. It then applies the approved business contract and returns
// either the render projection or a coarse typed rejection whose reason never leaks tenant
// existence, Storage paths, or database internals.

import { createClient } from "@/lib/supabase/server";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import { deliveryNumberFromInvoiceNumber } from "./delivery-note-document-data";

/** Invoice statuses for which a delivery note is allowed (issued and beyond). */
export const DELIVERY_NOTE_ALLOWED_STATUSES = ["issued", "paid", "partially_paid", "overdue"] as const;
export type DeliveryNoteAllowedStatus = (typeof DELIVERY_NOTE_ALLOWED_STATUSES)[number];

export function isDeliveryNoteAllowedStatus(status: unknown): status is DeliveryNoteAllowedStatus {
  return typeof status === "string" && (DELIVERY_NOTE_ALLOWED_STATUSES as readonly string[]).includes(status);
}

export type DeliveryNotePdfData =
  | { readonly kind: "ok"; readonly invoice: InvoiceDB; readonly deliveryDate: string }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_eligible" };

/**
 * Resolve and gate the delivery-note source.
 *
 * @param dealerId the authenticated dealer, resolved server-side (never client input)
 * @param invoiceId the requested invoice id
 */
export async function getDeliveryNotePdfData(
  dealerId: string,
  invoiceId: string,
): Promise<DeliveryNotePdfData> {
  if (!dealerId) return { kind: "unauthenticated" };
  if (typeof invoiceId !== "string" || invoiceId.trim() === "") return { kind: "invalid_request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, dealer_id, customer_id, vehicle_id, estimate_id, work_order_id, completion_report_id,
      invoice_number, status, title, issue_date, due_date,
      subtotal, discount_amount, tax_rate, tax_amount, total, paid_amount, balance_due,
      notes, pdf_file_path, pdf_file_url, deleted_at, created_at, updated_at,
      customers ( last_name, first_name, phone, email, postal_code, address1, is_business ),
      vehicles ( maker, model, year, grade, plate_number, color, mileage ),
      work_orders ( work_order_number, title, status, actual_end_at ),
      invoice_items (
        id, invoice_id, dealer_id, category, item_name, description,
        quantity, unit_price, discount_rate, line_total, sort_order, created_at, updated_at
      )
    `)
    .eq("id", invoiceId)
    .eq("dealer_id", dealerId)
    .is("deleted_at", null)
    .maybeSingle();

  // A foreign or missing invoice is indistinguishable: both are "not_found".
  if (error || !data) return { kind: "not_found" };

  const invoice = data as unknown as InvoiceDB;

  // Business contract, all fail-closed — every miss collapses to one coarse "not_eligible".
  if (!isDeliveryNoteAllowedStatus(invoice.status)) return { kind: "not_eligible" };
  if (!deliveryNumberFromInvoiceNumber(invoice.invoice_number)) return { kind: "not_eligible" };
  if (!invoice.work_order_id) return { kind: "not_eligible" };
  const deliveryDate = (invoice.work_orders?.actual_end_at ?? "").toString().trim();
  if (!deliveryDate) return { kind: "not_eligible" };

  return { kind: "ok", invoice, deliveryDate };
}
