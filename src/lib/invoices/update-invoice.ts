"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { calculateInvoiceTotals, lineTotal } from "./invoice-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import {
  evaluateCommercialEdit,
  evaluateSoftDelete,
  isPlainPayloadObject,
  validateDraftSaveFields,
  validateDraftSaveItems,
} from "./invoice-issuance-core";

export async function updateInvoice(
  id: string,
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Validate ownership AND read the authoritative status. B1: a commercial edit
  // is a draft-only privilege — once the invoice has been issued its figures are
  // a commercial record, and corrections happen by cancelling and issuing a new
  // invoice. The database trigger enforces the same rule; this is the friendly
  // first line of defence.
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();
  if (!existing) return { error: "請求書が見つかりません" };

  const editDecision = evaluateCommercialEdit(existing.status as string | null);
  if (editDecision.kind === "rejected") {
    return { error: "発行済みの請求書は編集できません。取消のうえ新しい請求書を発行してください" };
  }

  // B1-V1-R2: the payload is validated FAIL-CLOSED before any money math runs
  // and before the RPC is called. InvoiceForm always submits items_json, so a
  // missing or malformed payload is a defect, never a "leave the lines alone"
  // request — this action never sends p_items = null.
  const itemsRaw = fd.get("items_json");
  if (typeof itemsRaw !== "string" || itemsRaw.trim() === "") {
    return { error: "請求書の保存に失敗しました" };
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(itemsRaw);
  } catch {
    return { error: "請求書の保存に失敗しました" };
  }
  if (!Array.isArray(parsedItems)) {
    return { error: "請求書の保存に失敗しました" };
  }

  // Map each client line to the exact 8-key RPC element shape. Line totals are
  // recomputed server-side with the shared rule; a client value is never
  // trusted. Client-only extras (item_type, product_id) are dropped here, and
  // any garbage value survives the mapping only as far as the validator below.
  const itemRows: Record<string, unknown>[] = [];
  for (const raw of parsedItems) {
    if (!isPlainPayloadObject(raw)) {
      return { error: "請求書の保存に失敗しました" };
    }
    itemRows.push({
      category:      raw.category,
      item_name:     raw.item_name,
      // Passed through RAW: normalizing here (e.g. `|| null`) would launder
      // invalid falsy values into a valid null before the validator sees them.
      // A legal empty string is normalized to NULL by the RPC's own nullif.
      description:   raw.description,
      quantity:      raw.quantity,
      unit_price:    raw.unit_price,
      discount_rate: raw.discount_rate,
      line_total:    lineTotal(
        raw.quantity as number,
        raw.unit_price as number,
        raw.discount_rate as number
      ),
      sort_order:    raw.sort_order,
    });
  }

  const itemsValidation = validateDraftSaveItems(itemRows);
  if (itemsValidation.kind !== "valid") {
    return { error: "請求書の保存に失敗しました" };
  }

  // Totals — computed from the VALIDATED rows only. parseFloat garbage becomes
  // NaN here and is caught by the fields validator below, never persisted.
  const discount_amount = parseFloat((fd.get("discount_amount") as string) || "0");
  const tax_rate        = parseFloat((fd.get("tax_rate") as string) || "10");
  const paid_amount     = parseFloat((fd.get("paid_amount") as string) || "0");

  const totals = calculateInvoiceTotals(
    itemRows as { quantity: number; unit_price: number; discount_rate: number }[],
    discount_amount,
    tax_rate,
    paid_amount
  );

  // R4-1: ONE transaction. The old code sent a parent UPDATE, then a DELETE of
  // every line, then an INSERT — three separate Data API requests, so the invoice
  // was briefly committed with new totals and no lines. A concurrent issuance
  // could render and permanently publish that torn state. The RPC locks the
  // invoice, re-checks draft under the lock, and does the whole edit atomically.
  const fields: Record<string, unknown> = {
    invoice_number: (fd.get("invoice_number") as string) || null,
    title:          (fd.get("title") as string) || null,
    issue_date:     (fd.get("issue_date") as string) || null,
    due_date:       (fd.get("due_date") as string) || null,
    discount_amount,
    tax_rate,
    paid_amount,
    notes:          (fd.get("notes") as string) || null,
    internal_memo:  (fd.get("internal_memo") as string) || null,
    subtotal:       totals.subtotal,
    tax_amount:     totals.tax_amount,
    total:          totals.total,
    balance_due:    totals.balance_due,
  };

  const fieldsValidation = validateDraftSaveFields(fields, "with-items");
  if (fieldsValidation.kind !== "valid") {
    return { error: "請求書の保存に失敗しました" };
  }

  const { data: outcome, error: rpcErr } = await supabase.rpc("save_invoice_draft", {
    p_invoice_id: id,
    p_dealer_id:  dealer.dealer_id,
    p_fields:     fields,
    p_items:      itemRows,
  });

  if (rpcErr) {
    console.error("updateInvoice error:", rpcErr);
    return { error: "請求書の保存に失敗しました" };
  }

  const result = (outcome as { outcome?: string } | null)?.outcome;
  if (result === "not-found") return { error: "請求書が見つかりません" };
  if (result === "not-draft") {
    return { error: "発行済みの請求書は編集できません。取消のうえ新しい請求書を発行してください" };
  }
  if (result === "invalid-input") return { error: "請求書の保存に失敗しました" };
  if (result !== "saved") return { error: "請求書の保存に失敗しました" };

  return { success: true };
}

export async function softDeleteInvoice(id: string): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // B1: an issued invoice is a commercial record — it is cancelled, never deleted.
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();
  if (!existing) return { error: "請求書が見つかりません" };

  if (evaluateSoftDelete(existing.status as string | null).kind === "rejected") {
    return { error: "発行済みの請求書は削除できません。取消を使用してください" };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .eq("status", "draft");

  if (error) return { error: error.message };
  return { success: true };
}
