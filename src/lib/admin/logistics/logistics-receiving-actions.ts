"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  LogisticsReceivingRecord,
  AdminReceiptInput,
  AdminReceiptResult,
  ReceivingFormData,
} from "./logistics-types";

export async function getReceivingFormData(): Promise<ReceivingFormData> {
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
      .select("id, sku, product_name, units_per_case")
      .eq("is_active", true)
      .order("category")
      .order("product_name"),
  ]);

  return {
    dealers:  (dealersRes.data  ?? []) as ReceivingFormData["dealers"],
    products: (productsRes.data ?? []) as ReceivingFormData["products"],
  };
}

export async function getRecentAdminReceipts(limit = 50): Promise<LogisticsReceivingRecord[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [receiptsRes, dealersRes] = await Promise.all([
    supabase
      .from("inventory_receipts")
      .select("*, gyeon_products(sku, product_name)")
      .order("received_at", { ascending: false })
      .limit(limit),
    supabase
      .from("dealers")
      .select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );

  return ((receiptsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const product = r.gyeon_products as Record<string, unknown> | null;
    return {
      id:                      r.id as string,
      dealer_id:               r.dealer_id as string,
      dealer_name:             dealerMap.get(r.dealer_id as string) ?? "—",
      product_id:              r.product_id as string,
      sku:                     (product?.sku as string | null) ?? "—",
      product_name:            (product?.product_name as string | null) ?? "—",
      case_count:              r.case_count as number,
      loose_count:             r.loose_count as number,
      damaged_count:           (r.damaged_count as number | null) ?? 0,
      total_quantity:          r.total_quantity as number,
      units_per_case_snapshot: r.units_per_case_snapshot as number,
      received_at:             r.received_at as string,
      note:                    (r.note as string | null) ?? null,
    };
  });
}

export async function createAdminReceiptRecord(
  input: AdminReceiptInput,
): Promise<AdminReceiptResult> {
  await requireAdmin();
  const supabase = createAdminClient();

  const caseCount  = Math.max(0, Math.floor(input.case_count));
  const looseCount = Math.max(0, Math.floor(input.loose_count));
  const damaged    = Math.max(0, Math.floor(input.damaged_count));
  const upc        = Math.max(1, Math.floor(input.units_per_case_snapshot));
  const delta      = caseCount * upc + looseCount;

  if (delta <= 0) {
    return { success: false, error: "入荷数量は1以上を入力してください" };
  }

  const note = [
    input.note ?? "",
    damaged > 0 ? `破損数: ${damaged}個` : "",
  ].filter(Boolean).join(" | ") || null;

  // 1. Insert receipt
  const { data: receipt, error: insertErr } = await supabase
    .from("inventory_receipts")
    .insert({
      dealer_id:               input.dealer_id,
      product_id:              input.product_id,
      case_count:              caseCount,
      loose_count:             looseCount,
      damaged_count:           damaged,
      units_per_case_snapshot: upc,
      total_quantity:          delta,
      note,
    })
    .select("id")
    .single();

  if (insertErr) {
    return { success: false, error: insertErr.message };
  }

  // 2. Upsert dealer_stock_levels (add to existing total)
  const { data: existing } = await supabase
    .from("dealer_stock_levels")
    .select("id, case_count, loose_count, total_quantity, units_per_case_used")
    .eq("dealer_id", input.dealer_id)
    .eq("product_id", input.product_id)
    .single();

  if (existing) {
    const newTotal = (existing as { total_quantity: number }).total_quantity + delta;
    const newCase  = (existing as { case_count: number }).case_count + caseCount;
    const newLoose = (existing as { loose_count: number }).loose_count + looseCount;
    await supabase
      .from("dealer_stock_levels")
      .update({
        case_count:      newCase,
        loose_count:     newLoose,
        total_quantity:  newTotal,
        last_counted_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .eq("id", (existing as { id: string }).id);
  } else {
    await supabase
      .from("dealer_stock_levels")
      .insert({
        dealer_id:           input.dealer_id,
        product_id:          input.product_id,
        case_count:          caseCount,
        loose_count:         looseCount,
        units_per_case_used: upc,
        total_quantity:      delta,
        last_counted_at:     new Date().toISOString(),
      });
  }

  // 3. Insert stock_movement (type=receive)
  await supabase.from("stock_movements").insert({
    dealer_id:               input.dealer_id,
    product_id:              input.product_id,
    movement_type:           "receive",
    quantity_delta:          delta,
    case_count:              caseCount,
    loose_count:             looseCount,
    units_per_case_snapshot: upc,
    balance_after:           ((existing as { total_quantity: number } | null)?.total_quantity ?? 0) + delta,
    source_type:             "receipt",
    source_id:               (receipt as { id: string }).id,
    note,
  });

  return { success: true };
}
