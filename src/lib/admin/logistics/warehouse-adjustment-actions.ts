"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WarehouseAdjustmentInput,
  WarehouseAdjustmentRow,
  AdjustmentResult,
  AdjustmentType,
  ReceivingFormData,
} from "./logistics-types";

export async function getAdjustmentFormData(): Promise<ReceivingFormData> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [dealersRes, productsRes] = await Promise.all([
    supabase
      .from("dealers")
      .select("id, name")
      .eq("approval_status", "approved")
      .order("name"),
    supabase
      .from("gyeon_products")
      .select("id, sku, product_name, units_per_case, jan_code")
      .eq("is_active", true)
      .order("category")
      .order("product_name"),
  ]);

  return {
    dealers:  (dealersRes.data  ?? []) as ReceivingFormData["dealers"],
    products: (productsRes.data ?? []) as ReceivingFormData["products"],
  };
}

export async function createWarehouseAdjustment(
  input: WarehouseAdjustmentInput,
): Promise<AdjustmentResult> {
  const caller = await requireAdmin();
  const supabase = createAdminClient();

  const delta   = Math.trunc(input.quantity_delta);
  const upc     = Math.max(1, Math.trunc(input.units_per_case_snapshot));

  if (delta === 0) {
    return { success: false, error: "調整数量は0以外を指定してください" };
  }
  if (!input.reason.trim()) {
    return { success: false, error: "理由は必須です" };
  }

  // Read current stock level
  const { data: existing } = await supabase
    .from("dealer_stock_levels")
    .select("id, total_quantity")
    .eq("dealer_id", input.dealer_id)
    .eq("product_id", input.product_id)
    .single();

  const currentQty = (existing as { total_quantity: number } | null)?.total_quantity ?? 0;
  const balanceAfter = Math.max(0, currentQty + delta);

  // 1. Insert warehouse_adjustment record
  const { error: adjErr } = await supabase
    .from("warehouse_adjustments")
    .insert({
      dealer_id:               input.dealer_id,
      product_id:              input.product_id,
      adjustment_type:         input.adjustment_type,
      reason:                  input.reason.trim(),
      quantity_delta:          delta,
      case_count:              Math.max(0, Math.trunc(input.case_count)),
      loose_count:             Math.max(0, Math.trunc(input.loose_count)),
      units_per_case_snapshot: upc,
      balance_after:           balanceAfter,
      note:                    input.note?.trim() || null,
      performed_by:            caller.id,
    });

  if (adjErr) return { success: false, error: adjErr.message };

  // 2. Update dealer_stock_levels
  if (existing) {
    await supabase
      .from("dealer_stock_levels")
      .update({
        total_quantity:  balanceAfter,
        last_counted_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .eq("id", (existing as { id: string }).id);
  }

  // 3. Mirror to stock_movements for unified history
  const movementType = delta < 0 ? "adjustment_out" : "adjustment_in";
  await supabase.from("stock_movements").insert({
    dealer_id:               input.dealer_id,
    product_id:              input.product_id,
    movement_type:           movementType,
    quantity_delta:          delta,
    case_count:              Math.max(0, Math.trunc(input.case_count)),
    loose_count:             Math.max(0, Math.trunc(input.loose_count)),
    units_per_case_snapshot: upc,
    balance_after:           balanceAfter,
    source_type:             "warehouse_adjustment",
    adjustment_reason:       `${input.adjustment_type}: ${input.reason.trim()}`,
    note:                    input.note?.trim() || null,
    created_by:              caller.id,
  });

  return { success: true };
}

export async function getRecentWarehouseAdjustments(limit = 50): Promise<WarehouseAdjustmentRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [adjRes, dealersRes] = await Promise.all([
    supabase
      .from("warehouse_adjustments")
      .select("*, gyeon_products(sku, product_name), admin_users(name)")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("dealers").select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  return ((adjRes.data ?? []) as Record<string, unknown>[]).map((row) => {
    const product   = row.gyeon_products   as Record<string, unknown> | null;
    const performer = row.admin_users as Record<string, unknown> | null;
    return {
      id:                  row.id as string,
      dealer_id:           row.dealer_id as string,
      dealer_name:         dealerMap.get(row.dealer_id as string) ?? "—",
      product_id:          row.product_id as string,
      sku:                 (product?.sku as string | null) ?? "—",
      product_name:        (product?.product_name as string | null) ?? "—",
      adjustment_type:     row.adjustment_type as AdjustmentType,
      reason:              row.reason as string,
      quantity_delta:      row.quantity_delta as number,
      balance_after:       row.balance_after as number,
      performed_by_name:   (performer?.name as string | null) ?? null,
      note:                (row.note as string | null) ?? null,
      created_at:          row.created_at as string,
    };
  });
}
