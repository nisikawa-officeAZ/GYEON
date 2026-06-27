"use server";

// RC-05: Inventory receiving and stock movement server actions.
// All dealer_id values come from getCurrentDealer() — never from client input.
// Graceful degradation: if migration 072 is not applied, descriptive errors are returned.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import type {
  StockLevel,
  StockMovement,
  InventoryReceipt,
  CreateReceiptInput,
  CreateReceiptResult,
  GetMovementsResult,
  MovementType,
} from "./inventory-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMigration072Missing(
  err: { message?: string; code?: string } | null,
): boolean {
  return !!(
    err?.code === "42P01" ||
    (err?.message?.includes("does not exist"))
  );
}

const MIGRATION_MSG =
  "テーブルが未適用です。マイグレーション 072_inventory_receiving_movements.sql を Supabase SQL Editor で実行してください。";

// ─── Create receiving record ───────────────────────────────────────────────────
//
// Flow:
//   1. Validate + clamp inputs (server-side)
//   2. Insert inventory_receipts row
//   3. Upsert dealer_stock_levels (add to existing total)
//   4. Insert stock_movements row (source_type='receipt')
//   5. Return updated StockLevel

export async function createReceivingRecord(
  input: CreateReceiptInput,
): Promise<CreateReceiptResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const user = await getCurrentUser();

  // Server-side calculation — client cannot override
  const caseCount  = Math.max(0, Math.floor(input.case_count));
  const looseCount = Math.max(0, Math.floor(input.loose_count));
  const upc        = Math.max(1, Math.floor(input.units_per_case_snapshot));
  const delta      = caseCount * upc + looseCount;

  if (delta <= 0) {
    return { success: false, error: "入荷数量は1以上を入力してください" };
  }

  const supabase   = await createClient();
  const now        = new Date().toISOString();

  // 1. Insert receipt
  const { data: receipt, error: rErr } = await supabase
    .from("inventory_receipts")
    .insert({
      dealer_id:               dealer.dealer_id,
      product_id:              input.product_id,
      case_count:              caseCount,
      loose_count:             looseCount,
      units_per_case_snapshot: upc,
      total_quantity:          delta,
      received_at:             now,
      received_by:             user?.id ?? null,
      note:                    input.note?.trim() || null,
    })
    .select()
    .single();

  if (rErr || !receipt) {
    if (isMigration072Missing(rErr)) return { success: false, error: MIGRATION_MSG };
    return { success: false, error: "入荷レコードの登録に失敗しました" };
  }

  // 2. Get current stock level to calculate balance_after
  const { data: current } = await supabase
    .from("dealer_stock_levels")
    .select("total_quantity, case_count, loose_count, units_per_case_used")
    .eq("dealer_id",  dealer.dealer_id)
    .eq("product_id", input.product_id)
    .maybeSingle();

  const oldTotal    = (current?.total_quantity ?? 0);
  const balanceAfter = oldTotal + delta;

  // New case/loose breakdown: add received case/loose to existing
  const newCaseCount  = (current?.case_count  ?? 0) + caseCount;
  const newLooseCount = (current?.loose_count ?? 0) + looseCount;
  // Absorb loose into cases if they fill a case
  const effectiveUpc = upc;
  const totalLoose   = newLooseCount;
  const extraCases   = Math.floor(totalLoose / effectiveUpc);
  const remLoose     = totalLoose % effectiveUpc;
  const finalCases   = newCaseCount + extraCases;

  // 3. Upsert stock level
  const { data: stock, error: sErr } = await supabase
    .from("dealer_stock_levels")
    .upsert(
      {
        dealer_id:           dealer.dealer_id,
        product_id:          input.product_id,
        case_count:          finalCases,
        loose_count:         remLoose,
        units_per_case_used: effectiveUpc,
        total_quantity:      balanceAfter,
        last_counted_at:     now,
        last_counted_by:     user?.id ?? null,
        notes:               null,
      },
      { onConflict: "dealer_id,product_id" },
    )
    .select()
    .single();

  if (sErr || !stock) {
    return { success: false, error: "在庫レベルの更新に失敗しました" };
  }

  // 4. Insert movement record — non-blocking if 072 not applied
  await supabase
    .from("stock_movements")
    .insert({
      dealer_id:               dealer.dealer_id,
      product_id:              input.product_id,
      movement_type:           "receive" satisfies MovementType,
      quantity_delta:          delta,
      case_count:              caseCount,
      loose_count:             looseCount,
      units_per_case_snapshot: upc,
      balance_after:           balanceAfter,
      source_type:             "receipt",
      source_id:               receipt.id,
      note:                    input.note?.trim() || null,
      created_by:              user?.id ?? null,
      created_at:              now,
    })
    .then(({ error }) => {
      if (error && !isMigration072Missing(error)) {
        console.error("[receiving] movement insert error:", error.message);
      }
    });

  return {
    success: true,
    receipt: receipt as InventoryReceipt,
    stock:   stock   as StockLevel,
  };
}

// ─── Get recent movements (for a product or all products) ─────────────────────

export async function getRecentMovements(
  productId?: string,
  limit = 10,
): Promise<GetMovementsResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    // Fetch movements
    let q = supabase
      .from("stock_movements")
      .select("*, gyeon_products(product_name, sku)")
      .eq("dealer_id", dealer.dealer_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (productId) q = q.eq("product_id", productId);

    const { data, error } = await q;

    if (error) {
      if (isMigration072Missing(error)) return [];
      console.error("[receiving] getRecentMovements error:", error.message);
      return [];
    }

    return (data ?? []).map((row: StockMovement & {
      gyeon_products: { product_name: string; sku: string } | null
    }) => ({
      ...row,
      product_name: row.gyeon_products?.product_name ?? "",
      sku:          row.gyeon_products?.sku          ?? "",
    }));
  } catch {
    return [];
  }
}
