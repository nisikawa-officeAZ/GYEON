"use server";

// Inventory counting server actions
// All dealer_id values come from getCurrentDealer() — never from client input.
// Graceful degradation: if migration 069 is not yet applied, returns descriptive errors.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import type {
  StockLevel,
  ProductWithStock,
  StockCountInput,
  UpsertStockResult,
  MovementType,
} from "./inventory-types";
type ProductRow = {
  id:            string;
  sku:           string;
  product_name:  string;
  category:      string | null;
  size_label:    string | null;
  units_per_case: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMigrationMissing(err: { message?: string; code?: string } | null): boolean {
  return !!(
    err?.code === "42P01" ||
    err?.code === "42703" ||
    (err?.message?.includes("does not exist"))
  );
}

// ─── Get all products with current dealer stock levels ────────────────────────

export async function getProductsWithStock(
  keyword?: string,
  category?: string,
): Promise<ProductWithStock[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    // Fetch active products
    let productQuery = supabase
      .from("gyeon_products")
      .select("id, sku, product_name, category, size_label, units_per_case")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("product_name", { ascending: true })
      .limit(300);

    if (category) productQuery = productQuery.eq("category", category);
    if (keyword)  productQuery = productQuery.or(
      `product_name.ilike.%${keyword}%,sku.ilike.%${keyword}%`,
    );

    const { data: products, error: pErr } = await productQuery;
    if (pErr) {
      console.error("[inventory] product fetch error:", pErr.message);
      return [];
    }

    // Fetch dealer stock levels
    const { data: stocks, error: sErr } = await supabase
      .from("dealer_stock_levels")
      .select("*")
      .eq("dealer_id", dealer.dealer_id);

    // If migration not applied yet, proceed with empty stocks (not an error for the user)
    if (sErr && !isMigrationMissing(sErr)) {
      console.error("[inventory] stock fetch error:", sErr.message);
    }

    const stockMap = new Map<string, StockLevel>();
    for (const s of (stocks ?? []) as StockLevel[]) {
      stockMap.set(s.product_id, s);
    }

    return (products ?? []).map((p: ProductRow) => ({
      product_id:     p.id,
      sku:            p.sku,
      product_name:   p.product_name,
      category:       p.category,
      size_label:     p.size_label,
      units_per_case: p.units_per_case ?? null,
      stock:          stockMap.get(p.id) ?? null,
    }));
  } catch (err) {
    console.error("[inventory] getProductsWithStock error:", err);
    return [];
  }
}

// ─── Upsert a stock count ─────────────────────────────────────────────────────

export async function upsertStockCount(
  input: StockCountInput,
): Promise<UpsertStockResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const user = await getCurrentUser();

  // Clamp inputs to non-negative integers
  const caseCount       = Math.max(0, Math.floor(input.case_count));
  const looseCount      = Math.max(0, Math.floor(input.loose_count));
  const unitsPerCase    = Math.max(1, Math.floor(input.units_per_case_used));
  const totalQuantity   = caseCount * unitsPerCase + looseCount;

  const supabase = await createClient();
  const now      = new Date().toISOString();

  // Get current total for delta calculation (used in movement record)
  const { data: current } = await supabase
    .from("dealer_stock_levels")
    .select("total_quantity")
    .eq("dealer_id",  dealer.dealer_id)
    .eq("product_id", input.product_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("dealer_stock_levels")
    .upsert(
      {
        dealer_id:           dealer.dealer_id,
        product_id:          input.product_id,
        case_count:          caseCount,
        loose_count:         looseCount,
        units_per_case_used: unitsPerCase,
        total_quantity:      totalQuantity,
        last_counted_at:     now,
        last_counted_by:     user?.id ?? null,
        notes:               input.notes?.trim() || null,
      },
      { onConflict: "dealer_id,product_id" },
    )
    .select()
    .single();

  if (error || !data) {
    if (isMigrationMissing(error)) {
      return {
        success: false,
        error: "在庫カウントテーブルが未適用です。マイグレーション 069_inventory_counting.sql を Supabase SQL Editor で実行してください。",
      };
    }
    console.error("[inventory] upsert error:", error?.message);
    return { success: false, error: "在庫の保存に失敗しました" };
  }

  // Record stock movement (non-blocking — graceful if migration 072 not applied)
  const oldTotal = current?.total_quantity ?? 0;
  const delta    = totalQuantity - oldTotal;
  if (delta !== 0) {
    const movType: MovementType = delta > 0 ? "adjustment_in" : "adjustment_out";
    supabase
      .from("stock_movements")
      .insert({
        dealer_id:               dealer.dealer_id,
        product_id:              input.product_id,
        movement_type:           movType,
        quantity_delta:          delta,
        case_count:              caseCount,
        loose_count:             looseCount,
        units_per_case_snapshot: unitsPerCase,
        balance_after:           totalQuantity,
        source_type:             "count",
        source_id:               null,
        note:                    input.notes?.trim() || null,
        created_by:              user?.id ?? null,
        created_at:              now,
      })
      .then(({ error: mErr }) => {
        if (mErr && !isMigrationMissing(mErr)) {
          console.error("[inventory] movement insert error:", mErr.message);
        }
      });
  }

  return { success: true, stock: data as StockLevel };
}

// ─── Delete a stock level entry ───────────────────────────────────────────────

export async function deleteStockLevel(
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("dealer_stock_levels")
    .delete()
    .eq("dealer_id",  dealer.dealer_id)
    .eq("product_id", productId);

  if (error) {
    if (isMigrationMissing(error)) {
      return { success: false, error: "テーブルが未適用です" };
    }
    return { success: false, error: "削除に失敗しました" };
  }

  return { success: true };
}
