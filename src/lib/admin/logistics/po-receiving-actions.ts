"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PendingProductOrder,
  PoFulfillmentLine,
  PoFulfillmentStatus,
  PoReceivingResult,
  ExtendedOrderStatus,
} from "./logistics-types";

export async function getPendingProductOrders(): Promise<PendingProductOrder[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [ordersRes, dealersRes] = await Promise.all([
    supabase
      .from("product_orders")
      .select("id, dealer_id, order_number, status, order_date, created_at, product_order_items(id, product_id, sku, product_name_snapshot, quantity)")
      .in("status", ["submitted", "approved", "fulfilling"])
      .order("created_at", { ascending: false }),
    supabase.from("dealers").select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  // For fulfilling orders, load existing lines
  const orders = (ordersRes.data ?? []) as Record<string, unknown>[];
  const fulfillingIds = orders
    .filter((o) => o.status === "fulfilling")
    .map((o) => o.id as string);

  let linesMap = new Map<string, PoFulfillmentLine[]>();

  if (fulfillingIds.length > 0) {
    const { data: linesData } = await supabase
      .from("po_fulfillment_lines")
      .select("*")
      .in("product_order_id", fulfillingIds)
      .order("created_at");

    for (const line of (linesData ?? []) as Record<string, unknown>[]) {
      const ordId = line.product_order_id as string;
      if (!linesMap.has(ordId)) linesMap.set(ordId, []);
      const ordQty     = line.ordered_qty as number;
      const fulfilledQ = line.fulfilled_qty as number;
      const backordQ   = line.backordered_qty as number;
      linesMap.get(ordId)!.push({
        id:                    line.id as string,
        product_order_id:      ordId,
        product_id:            (line.product_id as string | null) ?? null,
        sku_snapshot:          line.sku_snapshot as string,
        product_name_snapshot: line.product_name_snapshot as string,
        ordered_qty:           ordQty,
        fulfilled_qty:         fulfilledQ,
        backordered_qty:       backordQ,
        remaining_qty:         Math.max(0, ordQty - fulfilledQ - backordQ),
        status:                line.status as PoFulfillmentStatus,
        note:                  (line.note as string | null) ?? null,
      });
    }
  }

  return orders.map((o) => {
    const items = (o.product_order_items as Record<string, unknown>[]) ?? [];
    const totalQty = items.reduce((sum, i) => sum + (i.quantity as number), 0);

    return {
      id:           o.id as string,
      dealer_id:    o.dealer_id as string,
      dealer_name:  dealerMap.get(o.dealer_id as string) ?? "—",
      order_number: (o.order_number as string | null) ?? null,
      status:       o.status as ExtendedOrderStatus,
      order_date:   (o.order_date as string | null) ?? null,
      created_at:   o.created_at as string,
      item_count:   items.length,
      total_qty:    totalQty,
      lines:        linesMap.get(o.id as string) ?? [],
    };
  });
}

export async function startPoFulfillment(orderId: string): Promise<PoReceivingResult> {
  const caller = await requireAdmin();
  const supabase = createAdminClient();

  // Verify order is in a fulfillable state
  const { data: order, error: orderErr } = await supabase
    .from("product_orders")
    .select("id, status, product_order_items(id, product_id, sku, product_name_snapshot, quantity)")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return { success: false, error: "注文が見つかりません" };
  const o = order as Record<string, unknown>;

  if (!["submitted", "approved"].includes(o.status as string)) {
    return { success: false, error: "この注文は出荷準備できません" };
  }

  const items = (o.product_order_items as Record<string, unknown>[]) ?? [];
  if (items.length === 0) return { success: false, error: "注文明細がありません" };

  // Create fulfillment lines from order items
  const lines = items.map((item) => ({
    product_order_id:      orderId,
    product_order_item_id: item.id as string,
    product_id:            item.product_id as string | null,
    sku_snapshot:          item.sku as string,
    product_name_snapshot: item.product_name_snapshot as string,
    ordered_qty:           item.quantity as number,
    fulfilled_qty:         0,
    backordered_qty:       0,
    status:                "pending",
  }));

  const { error: linesErr } = await supabase
    .from("po_fulfillment_lines")
    .insert(lines);

  if (linesErr) return { success: false, error: linesErr.message };

  // Update order status to fulfilling
  const { error: statusErr } = await supabase
    .from("product_orders")
    .update({ status: "fulfilling", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (statusErr) return { success: false, error: statusErr.message };

  return { success: true };
}

export async function recordLineReceiving(params: {
  lineId:        string;
  orderId:       string;
  fulfilledQty:  number;
  backorderedQty: number;
  note?:         string;
}): Promise<PoReceivingResult> {
  const caller = await requireAdmin();
  const supabase = createAdminClient();

  // Verify line belongs to order (security)
  const { data: line, error: lineErr } = await supabase
    .from("po_fulfillment_lines")
    .select("id, product_order_id, ordered_qty")
    .eq("id", params.lineId)
    .eq("product_order_id", params.orderId)
    .single();

  if (lineErr || !line) return { success: false, error: "明細が見つかりません" };

  const l = line as Record<string, unknown>;
  const orderedQty = l.ordered_qty as number;
  const fulfilledQ = Math.max(0, Math.trunc(params.fulfilledQty));
  const backordQ   = Math.max(0, Math.trunc(params.backorderedQty));

  if (fulfilledQ + backordQ > orderedQty) {
    return { success: false, error: "出荷数量+バックオーダー数量が注文数量を超えています" };
  }

  const remaining = orderedQty - fulfilledQ - backordQ;
  let lineStatus: PoFulfillmentStatus;
  if (fulfilledQ >= orderedQty)             lineStatus = "fulfilled";
  else if (backordQ >= orderedQty - fulfilledQ) lineStatus = "backordered";
  else if (fulfilledQ > 0)                  lineStatus = "partial";
  else                                       lineStatus = "pending";

  const { error: updateErr } = await supabase
    .from("po_fulfillment_lines")
    .update({
      fulfilled_qty:   fulfilledQ,
      backordered_qty: backordQ,
      status:          lineStatus,
      note:            params.note?.trim() || null,
      fulfilled_by:    lineStatus === "fulfilled" ? caller.id : null,
      fulfilled_at:    lineStatus === "fulfilled" ? new Date().toISOString() : null,
      updated_at:      new Date().toISOString(),
    })
    .eq("id", params.lineId);

  if (updateErr) return { success: false, error: updateErr.message };

  // Check if all lines are done — if so, mark order fulfilled
  const { data: allLines } = await supabase
    .from("po_fulfillment_lines")
    .select("status")
    .eq("product_order_id", params.orderId);

  const lines = (allLines ?? []) as { status: string }[];
  const allDone = lines.every((li) => li.status === "fulfilled" || li.status === "backordered");
  const hasPartial = lines.some((li) => li.status === "partial" || li.status === "pending");

  if (allDone && !hasPartial) {
    await supabase
      .from("product_orders")
      .update({ status: "fulfilled", updated_at: new Date().toISOString() })
      .eq("id", params.orderId);
  }

  return { success: true };
}
