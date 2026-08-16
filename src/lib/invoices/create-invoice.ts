"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { InvoiceItemInput, calculateInvoiceTotals, lineTotal } from "./invoice-types";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { createActivityLog } from "@/lib/activity/activity-log";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import { resolveBillingTerms, resolveInvoiceDueDate } from "@/lib/customer-billing/billing-terms";
import { resolveDeliveryDate } from "./invoice-delivery-date";

export async function createInvoice(fd: FormData): Promise<{ error: string } | { success: true; id: string }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Parse optional FK fields
  const customer_id           = (fd.get("customer_id") as string | null) || null;
  const vehicle_id            = (fd.get("vehicle_id") as string | null) || null;
  const estimate_id           = (fd.get("estimate_id") as string | null) || null;
  const work_order_id         = (fd.get("work_order_id") as string | null) || null;
  const completion_report_id  = (fd.get("completion_report_id") as string | null) || null;

  // Validate FK ownership
  if (customer_id) {
    const { data } = await supabase.from("customers").select("id").eq("id", customer_id).eq("dealer_id", dealer.dealer_id).single();
    if (!data) return { error: "顧客が見つかりません" };
  }
  if (vehicle_id) {
    const { data } = await supabase.from("vehicles").select("id").eq("id", vehicle_id).eq("dealer_id", dealer.dealer_id).single();
    if (!data) return { error: "車両が見つかりません" };
  }
  if (estimate_id) {
    const { data } = await supabase.from("estimates").select("id").eq("id", estimate_id).eq("dealer_id", dealer.dealer_id).single();
    if (!data) return { error: "見積が見つかりません" };
  }
  // MONTHLY-DATA-B1: while validating FK ownership, capture the two authoritative delivery-date
  // sources through the SAME dealer-scoped queries (report_date from a linked completion report;
  // actual_end_at from a linked work order). No extra trust surface is introduced.
  let woActualEndAt: string | null = null;
  let crReportDate: string | null = null;
  if (work_order_id) {
    const { data } = await supabase.from("work_orders").select("id, actual_end_at").eq("id", work_order_id).eq("dealer_id", dealer.dealer_id).single();
    if (!data) return { error: "作業指示書が見つかりません" };
    woActualEndAt = (data as { actual_end_at: string | null }).actual_end_at ?? null;
  }
  if (completion_report_id) {
    const { data } = await supabase.from("completion_reports").select("id, report_date").eq("id", completion_report_id).eq("dealer_id", dealer.dealer_id).single();
    if (!data) return { error: "完了報告書が見つかりません" };
    crReportDate = (data as { report_date: string | null }).report_date ?? null;
  }

  // Parse line items
  const itemsRaw = fd.get("items_json") as string | null;
  const items: InvoiceItemInput[] = itemsRaw ? JSON.parse(itemsRaw) : [];

  // Recalculate totals server-side
  const discount_amount = parseFloat((fd.get("discount_amount") as string) || "0");
  const tax_rate        = parseFloat((fd.get("tax_rate") as string) || "10");
  const paid_amount     = parseFloat((fd.get("paid_amount") as string) || "0");
  const totals = calculateInvoiceTotals(items, discount_amount, tax_rate, paid_amount);

  // Insert invoice
  const rawInvoiceNumber = (fd.get("invoice_number") as string) || null;
  const resolvedInvoiceNumber = rawInvoiceNumber || (await getNextDocumentNumber("invoice")) || null;

  // MONTHLY-DATA-B1 (+R1): registered precedence — authorized manual input → completion-report date
  // → work-order completion date (Asia/Tokyo) → null. issue_date is never a source. FAIL CLOSED: a
  // present-but-invalid manual value (or report_date) is rejected BEFORE the INSERT and never
  // silently replaced by a lower-precedence source. The raw FormData value is passed through so a
  // non-string (e.g. File) is treated as invalid, not coerced.
  const deliveryResolution = resolveDeliveryDate({
    manual:      fd.get("delivery_date"),
    reportDate:  crReportDate,
    actualEndAt: woActualEndAt,
  });
  if (deliveryResolution.kind === "invalid") {
    return { error: "請求書の作成に失敗しました" };
  }
  const delivery_date = deliveryResolution.value;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      dealer_id:            dealer.dealer_id,
      customer_id,
      vehicle_id,
      estimate_id,
      work_order_id,
      completion_report_id,
      invoice_number:       resolvedInvoiceNumber,
      // B1: a new invoice is ALWAYS a draft. Leaving draft requires issueInvoice,
      // which produces the immutable PDF artifact first, so a client-supplied
      // status can never manufacture an "issued" invoice with no document.
      status:               "draft",
      title:                (fd.get("title") as string) || null,
      issue_date:           (fd.get("issue_date") as string) || null,
      due_date:             (fd.get("due_date") as string) || null,
      delivery_date,
      discount_amount,
      tax_rate,
      paid_amount,
      subtotal:             totals.subtotal,
      tax_amount:           totals.tax_amount,
      total:                totals.total,
      balance_due:          totals.balance_due,
      notes:                (fd.get("notes") as string) || null,
      internal_memo:        (fd.get("internal_memo") as string) || null,
    })
    .select("id")
    .single();

  if (invErr || !inv) {
    console.error("createInvoice error:", invErr);
    return { error: invErr?.message ?? "請求書の作成に失敗しました" };
  }

  // Insert line items
  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      invoice_id:            inv.id,
      dealer_id:             dealer.dealer_id,
      category:              item.category,
      item_name:             item.item_name,
      description:           item.description || null,
      quantity:              item.quantity,
      unit_price:            item.unit_price,
      discount_rate:         item.discount_rate,
      line_total:            lineTotal(item.quantity, item.unit_price, item.discount_rate),
      sort_order:            item.sort_order,
      item_type:             item.item_type             ?? "manual",
      product_id:            item.product_id            ?? null,
      sku:                   item.sku                   ?? null,
      product_name_snapshot: item.product_name_snapshot ?? null,
      retail_price_snapshot: item.retail_price_snapshot ?? null,
    }));
    const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
    if (itemsErr) {
      console.error("createInvoice items error:", itemsErr);
      // Rollback invoice
      await supabase.from("invoices").delete().eq("id", inv.id);
      return { error: "明細の保存に失敗しました" };
    }
  }

  void createActivityLog({
    entity_type: "invoice",
    entity_id:   inv.id,
    customer_id: customer_id ?? null,
    action:      "created",
    title:       `請求書を作成: ${resolvedInvoiceNumber ?? inv.id.slice(0, 8)}`,
  });

  return { success: true, id: inv.id };
}

// Creates an invoice pre-populated from a work order's linked estimate items
//
// GDA-3B: a common-path replay guard, not full concurrency-safe idempotency.
// Before doing anything else, this checks for a dealer-scoped invoice already
// linked to the work order and returns it unchanged on a match, so ordinary
// retries, stale UI submissions, and second-tab calls cannot mint another
// generated draft invoice. Two truly simultaneous requests can still both pass
// this lookup before either insert; closing that requires a separately
// authorized database contract (unique key or transactional lock). Manual
// creation of additional invoices for one work order remains permitted, so no
// one-invoice-per-work-order rule is inferred here.
export async function createInvoiceFromWorkOrder(
  workOrderId: string
): Promise<{ error: string } | { success: true; id: string; alreadyExists: boolean }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const { data: existing, error: existingErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("dealer_id", dealer.dealer_id)
    .eq("work_order_id", workOrderId)
    .maybeSingle();

  if (existingErr) return { error: "請求書の確認に失敗しました" };
  if (existing) return { success: true, id: existing.id, alreadyExists: true };

  // Fetch work order with estimate + items
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select(`
      id, customer_id, vehicle_id, title, actual_end_at,
      estimate_id,
      estimates (
        id, estimate_number, title, tax_rate, discount_amount,
        estimate_items (
          category, item_name, description, quantity, unit_price, discount_rate, line_total, sort_order
        )
      )
    `)
    .eq("id", workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (woErr || !wo) return { error: "作業指示書が見つかりません" };

  const estimate = wo.estimates as unknown as {
    id: string;
    estimate_number: string | null;
    title: string | null;
    tax_rate: number;
    discount_amount: number;
    estimate_items: {
      category: string; item_name: string; description: string | null;
      quantity: number; unit_price: number; discount_rate: number;
      line_total: number; sort_order: number;
    }[];
  } | null;

  const items = estimate?.estimate_items ?? [];
  const discount_amount = estimate?.discount_amount ?? 0;
  const tax_rate        = estimate?.tax_rate ?? 10;
  const paid_amount     = 0;
  const totals = calculateInvoiceTotals(items, discount_amount, tax_rate, paid_amount);

  // MONTHLY-DATA-B1 (+R1): the linked work order is the delivery-date source — its actual completion
  // timestamp projected onto the Asia/Tokyo calendar date. Null when the work is not yet complete.
  // actual_end_at is a timestamptz column (valid or null), so resolution is always "resolved"; the
  // defensive invalid branch keeps delivery_date null rather than guessing.
  const woDeliveryResolution = resolveDeliveryDate({
    actualEndAt: (wo as { actual_end_at?: string | null }).actual_end_at ?? null,
  });
  const delivery_date = woDeliveryResolution.kind === "resolved" ? woDeliveryResolution.value : null;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      dealer_id:      dealer.dealer_id,
      customer_id:    wo.customer_id ?? null,
      vehicle_id:     wo.vehicle_id ?? null,
      estimate_id:    wo.estimate_id ?? null,
      work_order_id:  workOrderId,
      status:         "draft",
      title:          wo.title ?? "請求書",
      issue_date:     new Date().toISOString().slice(0, 10),
      delivery_date,
      discount_amount,
      tax_rate,
      paid_amount,
      subtotal:       totals.subtotal,
      tax_amount:     totals.tax_amount,
      total:          totals.total,
      balance_due:    totals.balance_due,
    })
    .select("id")
    .single();

  if (invErr || !inv) return { error: invErr?.message ?? "請求書の作成に失敗しました" };

  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      invoice_id:    inv.id,
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
      await supabase.from("invoices").delete().eq("id", inv.id);
      return { error: "明細の保存に失敗しました" };
    }
  }

  return { success: true, id: inv.id, alreadyExists: false };
}

// Phase 3 Sprint 5 — Estimate → Invoice transition (mirrors createInvoiceFromWorkOrder).
// Pre-populates an invoice from an estimate's items; totals are recomputed
// server-side. Dealer-scoped; dealer_id never accepted from client.
export async function createInvoiceFromEstimate(
  estimateId: string
): Promise<{ error: string } | { success: true; id: string }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Fetch estimate + items (dealer-scoped; totals are server-authoritative).
  const { data: est, error: estErr } = await supabase
    .from("estimates")
    .select(`
      id, status, customer_id, vehicle_id, estimate_number, title, tax_rate, discount_amount,
      estimate_items (
        category, item_name, description, quantity, unit_price, discount_rate, line_total, sort_order
      )
    `)
    .eq("id", estimateId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (estErr || !est) return { error: "見積が見つかりません" };

  // Server-side gate (defense-in-depth; the UI already restricts this to approved
  // estimates): only an approved estimate may be converted to an invoice.
  const estStatus = String((est as { status?: string }).status ?? "");
  if (estStatus !== "approved" && estStatus !== "APPROVED") {
    return { error: "承認済みの見積のみ請求書を作成できます" };
  }

  const items = (est.estimate_items as unknown as {
    category: string; item_name: string; description: string | null;
    quantity: number; unit_price: number; discount_rate: number;
    line_total: number; sort_order: number;
  }[]) ?? [];

  const discount_amount = est.discount_amount ?? 0;
  const tax_rate        = est.tax_rate ?? 10;
  const totals = calculateInvoiceTotals(items, discount_amount, tax_rate, 0);

  const resolvedInvoiceNumber = (await getNextDocumentNumber("invoice")) || null;

  // E8.2/E8.3: billing decision date = invoice issue_date. Resolve billing terms
  // from dealer-level closing/payment days (customer-level overrides are a future
  // schema step). Closing-payment applies only when BOTH days exist; otherwise
  // due_date stays null (normal per-invoice behaviour preserved). The trade flag
  // is never consulted here, so it cannot force closing billing.
  const issueDate = new Date().toISOString().slice(0, 10);
  let dueDate: string | null = null;
  try {
    const ds = await getCanonicalDealerSettings();
    const terms = resolveBillingTerms({
      dealerClosingDay: ds.dealer_closing_day,
      dealerPaymentDay: ds.dealer_payment_day,
    });
    dueDate = resolveInvoiceDueDate(issueDate, terms);
  } catch {
    dueDate = null; // never block invoice creation on billing-terms resolution
  }

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      dealer_id:      dealer.dealer_id,
      customer_id:    est.customer_id ?? null,
      vehicle_id:     est.vehicle_id ?? null,
      estimate_id:    est.id,
      invoice_number: resolvedInvoiceNumber,
      status:         "draft",
      title:          est.title ?? "請求書",
      issue_date:     issueDate,
      due_date:       dueDate,
      // MONTHLY-DATA-B1: an estimate carries no delivery date. It stays null until a work order /
      // completion report supplies one or an operator enters it — issue_date is NEVER copied here.
      delivery_date:  null,
      discount_amount,
      tax_rate,
      paid_amount:    0,
      subtotal:       totals.subtotal,
      tax_amount:     totals.tax_amount,
      total:          totals.total,
      balance_due:    totals.balance_due,
    })
    .select("id")
    .single();

  if (invErr || !inv) return { error: invErr?.message ?? "請求書の作成に失敗しました" };

  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      invoice_id:    inv.id,
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
      await supabase.from("invoices").delete().eq("id", inv.id);
      return { error: "明細の保存に失敗しました" };
    }
  }

  void createActivityLog({
    entity_type: "invoice",
    entity_id:   inv.id,
    customer_id: est.customer_id ?? null,
    action:      "created",
    title:       `見積から請求書を作成: ${est.estimate_number ?? est.id.slice(0, 8)}`,
  });

  return { success: true, id: inv.id };
}
