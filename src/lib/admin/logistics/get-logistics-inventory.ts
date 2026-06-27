"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogisticsInventoryRow } from "./logistics-types";

export async function getLogisticsInventory(): Promise<LogisticsInventoryRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  // All stock levels across all dealers
  const [stockRes, dealerRes] = await Promise.all([
    supabase
      .from("dealer_stock_levels")
      .select("*, gyeon_products(sku, product_name, category, size_label, units_per_case)")
      .order("dealer_id")
      .limit(1000),

    supabase
      .from("dealers")
      .select("id, name")
      .order("name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealerRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  // Compute reserved quantities from product_order_items (submitted/approved orders only)
  // Get order dealer_id mapping for submitted/approved orders
  const { data: ordersRaw } = await supabase
    .from("product_orders")
    .select("id, dealer_id")
    .in("status", ["submitted", "approved"]);

  const activeOrderIds = new Set(
    ((ordersRaw ?? []) as { id: string; dealer_id: string }[]).map((o) => o.id)
  );
  const orderDealerMap = new Map<string, string>(
    ((ordersRaw ?? []) as { id: string; dealer_id: string }[]).map((o) => [o.id, o.dealer_id])
  );

  // Group reserved by dealer+product (simplified: count items, not quantity — product_order_items has `quantity`)
  // We need quantity field
  const { data: itemsWithQty } = await supabase
    .from("product_order_items")
    .select("product_id, order_id, quantity")
    .limit(5000);

  const reservedMap = new Map<string, number>();
  for (const item of (itemsWithQty ?? []) as { product_id: string | null; order_id: string; quantity: number }[]) {
    if (!item.product_id || !activeOrderIds.has(item.order_id)) continue;
    const dealerId = orderDealerMap.get(item.order_id);
    if (!dealerId) continue;
    const key = `${dealerId}::${item.product_id}`;
    reservedMap.set(key, (reservedMap.get(key) ?? 0) + item.quantity);
  }

  const rows: LogisticsInventoryRow[] = [];
  for (const s of (stockRes.data ?? []) as Record<string, unknown>[]) {
    const product = s.gyeon_products as Record<string, unknown> | null;
    const key = `${s.dealer_id as string}::${s.product_id as string}`;
    const reserved = reservedMap.get(key) ?? 0;
    const total    = s.total_quantity as number;
    rows.push({
      dealer_id:       s.dealer_id as string,
      dealer_name:     dealerMap.get(s.dealer_id as string) ?? "—",
      product_id:      s.product_id as string,
      sku:             (product?.sku as string | null) ?? "—",
      product_name:    (product?.product_name as string | null) ?? "—",
      category:        (product?.category as string | null) ?? null,
      size_label:      (product?.size_label as string | null) ?? null,
      units_per_case:  (product?.units_per_case as number | null) ?? null,
      case_count:      s.case_count  as number,
      loose_count:     s.loose_count as number,
      total_quantity:  total,
      reserved_qty:    reserved,
      available_qty:   Math.max(0, total - reserved),
      last_counted_at: s.last_counted_at as string,
    });
  }

  return rows;
}
