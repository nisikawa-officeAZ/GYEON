"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { InvoiceItemInput, calculateInvoiceTotals, lineTotal } from "./invoice-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function updateInvoice(
  id: string,
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return auth;

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Validate ownership
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();
  if (!existing) return { error: "請求書が見つかりません" };

  // Parse line items
  const itemsRaw = fd.get("items_json") as string | null;
  const items: InvoiceItemInput[] | null = itemsRaw ? JSON.parse(itemsRaw) : null;

  // Totals
  const discount_amount = parseFloat((fd.get("discount_amount") as string) || "0");
  const tax_rate        = parseFloat((fd.get("tax_rate") as string) || "10");
  const paid_amount     = parseFloat((fd.get("paid_amount") as string) || "0");

  const totals = items !== null
    ? calculateInvoiceTotals(items, discount_amount, tax_rate, paid_amount)
    : null;

  const updatePayload: Record<string, unknown> = {
    invoice_number:  (fd.get("invoice_number") as string) || null,
    status:          (fd.get("status") as string) || "draft",
    title:           (fd.get("title") as string) || null,
    issue_date:      (fd.get("issue_date") as string) || null,
    due_date:        (fd.get("due_date") as string) || null,
    discount_amount,
    tax_rate,
    paid_amount,
    notes:           (fd.get("notes") as string) || null,
    internal_memo:   (fd.get("internal_memo") as string) || null,
    updated_at:      new Date().toISOString(),
  };

  if (totals) {
    updatePayload.subtotal    = totals.subtotal;
    updatePayload.tax_amount  = totals.tax_amount;
    updatePayload.total       = totals.total;
    updatePayload.balance_due = totals.balance_due;
  } else {
    // Recalculate balance_due from existing total
    updatePayload.balance_due = undefined; // will be computed from existing total below
  }

  if (!totals) {
    // Fetch existing totals to recompute balance_due with new paid_amount
    const { data: inv } = await supabase
      .from("invoices")
      .select("total")
      .eq("id", id)
      .single();
    if (inv) {
      updatePayload.balance_due = (inv.total as number) - paid_amount;
    }
    delete updatePayload.balance_due; // let DB keep it if not recalculating
  }

  const { error: updateErr } = await supabase
    .from("invoices")
    .update(updatePayload)
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (updateErr) {
    console.error("updateInvoice error:", updateErr);
    return { error: updateErr.message };
  }

  // Replace line items if provided
  if (items !== null) {
    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    if (items.length > 0) {
      const itemRows = items.map((item) => ({
        invoice_id:    id,
        dealer_id:     dealer.dealer_id,
        category:      item.category,
        item_name:     item.item_name,
        description:   item.description || null,
        quantity:      item.quantity,
        unit_price:    item.unit_price,
        discount_rate: item.discount_rate,
        line_total:    lineTotal(item.quantity, item.unit_price, item.discount_rate),
        sort_order:    item.sort_order,
      }));
      const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
      if (itemsErr) {
        console.error("updateInvoice items error:", itemsErr);
        return { error: "明細の保存に失敗しました" };
      }
    }
  }

  return { success: true };
}

export async function softDeleteInvoice(id: string): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return auth;

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) return { error: error.message };
  return { success: true };
}
