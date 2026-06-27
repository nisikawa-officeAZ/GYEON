"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminStockMovementRow } from "./logistics-types";

export async function getAdminStockMovements(limit = 100): Promise<AdminStockMovementRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [movRes, dealersRes] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("*, gyeon_products(sku, product_name), admin_users(name)")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("dealers").select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  return ((movRes.data ?? []) as Record<string, unknown>[]).map((row) => {
    const product  = row.gyeon_products as Record<string, unknown> | null;
    const creator  = row.admin_users    as Record<string, unknown> | null;
    return {
      id:                row.id as string,
      dealer_id:         row.dealer_id as string,
      dealer_name:       dealerMap.get(row.dealer_id as string) ?? "—",
      product_id:        row.product_id as string,
      sku:               (product?.sku as string | null) ?? "—",
      product_name:      (product?.product_name as string | null) ?? "—",
      movement_type:     row.movement_type as string,
      quantity_delta:    row.quantity_delta as number,
      balance_after:     row.balance_after as number,
      source_type:       (row.source_type as string | null) ?? null,
      note:              (row.note as string | null) ?? null,
      adjustment_reason: (row.adjustment_reason as string | null) ?? null,
      created_by_name:   (creator?.name as string | null) ?? null,
      created_at:        row.created_at as string,
    };
  });
}
