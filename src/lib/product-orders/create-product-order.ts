"use server";

import { createClient }          from "@/lib/supabase/server";
import { getCurrentDealer }      from "@/lib/auth/get-current-dealer";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { ProductOrderDB }        from "./product-order-types";
import { createActivityLog }     from "@/lib/activity/activity-log";

export interface ProductOrderItemInput {
  product_id:            string | null;
  sku:                   string;
  product_name_snapshot: string;
  retail_price_snapshot: number | null;
  quantity:              number;
}

export interface CreateProductOrderInput {
  items:      ProductOrderItemInput[];
  order_date?: string | null;
  notes?:      string | null;
  status?:     "draft" | "submitted";
}

export async function createProductOrder(
  input: CreateProductOrderInput,
): Promise<{ error: string } | { success: true; data: ProductOrderDB }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  if (!input.items || input.items.length === 0) {
    return { error: "商品を1つ以上追加してください" };
  }

  const supabase    = await createClient();
  const did         = dealer.dealer_id;
  const orderNumber = (await getNextDocumentNumber("product_order")) ?? `PO-${Date.now()}`;
  const orderDate   = input.order_date ?? new Date().toISOString().slice(0, 10);

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("product_orders")
    .insert({
      dealer_id:    did,
      order_number: orderNumber,
      status:       input.status ?? "draft",
      order_date:   orderDate,
      notes:        input.notes ?? null,
    })
    .select("*")
    .single();

  if (orderErr || !order) {
    console.error("createProductOrder error:", orderErr);
    return { error: orderErr?.message ?? "注文の作成に失敗しました" };
  }

  // Insert items
  const itemRows = input.items.map((item) => ({
    order_id:              order.id,
    product_id:            item.product_id,
    sku:                   item.sku,
    product_name_snapshot: item.product_name_snapshot,
    retail_price_snapshot: item.retail_price_snapshot,
    quantity:              item.quantity,
    subtotal:              Math.round((item.retail_price_snapshot ?? 0) * item.quantity),
  }));

  const { error: itemsErr } = await supabase
    .from("product_order_items")
    .insert(itemRows);

  if (itemsErr) {
    console.error("createProductOrder items error:", itemsErr);
    // Rollback order
    await supabase.from("product_orders").delete().eq("id", order.id);
    return { error: "明細の保存に失敗しました" };
  }

  // Fetch full order with items
  const { data: full } = await supabase
    .from("product_orders")
    .select("*, product_order_items(*)")
    .eq("id", order.id)
    .single();

  void createActivityLog({
    entity_type: "product_order",
    entity_id:   order.id,
    action:      "created",
    title:       `商品注文を作成: ${orderNumber}`,
  });

  return { success: true, data: full as unknown as ProductOrderDB };
}
