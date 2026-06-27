"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogisticsBackorderRow } from "./logistics-types";

export async function getLogisticsBackorders(): Promise<LogisticsBackorderRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [backordersRes, dealersRes] = await Promise.all([
    supabase
      .from("logistics_backorders")
      .select("*, gyeon_products(sku, product_name), product_orders(order_number)")
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("dealers")
      .select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  return ((backordersRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const product = r.gyeon_products as Record<string, unknown> | null;
    const order   = r.product_orders as Record<string, unknown> | null;
    return {
      id:                    r.id as string,
      dealer_id:             r.dealer_id as string,
      dealer_name:           dealerMap.get(r.dealer_id as string) ?? "—",
      product_id:            (r.product_id as string | null) ?? null,
      sku:                   (product?.sku as string | null) ?? null,
      product_name:          (product?.product_name as string | null) ?? null,
      ordered_qty:           r.ordered_qty as number,
      waiting_qty:           r.waiting_qty as number,
      expected_arrival_date: (r.expected_arrival_date as string | null) ?? null,
      target_delivery_date:  (r.target_delivery_date  as string | null) ?? null,
      status:                r.status as LogisticsBackorderRow["status"],
      notes:                 (r.notes as string | null) ?? null,
      order_number:          (order?.order_number as string | null) ?? null,
      created_at:            r.created_at as string,
    };
  });
}
