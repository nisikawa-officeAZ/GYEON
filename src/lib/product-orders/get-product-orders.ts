"use server";

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { ProductOrderDB, OrderStatus } from "./product-order-types";

export interface ProductOrderFilter {
  status?: OrderStatus | OrderStatus[];
}

export async function getProductOrders(
  filter: ProductOrderFilter = {},
): Promise<ProductOrderDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  let query = supabase
    .from("product_orders")
    .select("*, product_order_items(*)")
    .eq("dealer_id", dealer.dealer_id)
    .order("created_at", { ascending: false });

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in("status", filter.status);
    } else {
      query = query.eq("status", filter.status);
    }
  }

  const { data } = await query;
  return (data ?? []) as unknown as ProductOrderDB[];
}

export async function getProductOrder(id: string): Promise<ProductOrderDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_orders")
    .select("*, product_order_items(*)")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  return data as unknown as ProductOrderDB | null;
}
