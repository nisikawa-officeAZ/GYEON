"use server";

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { OrderStatus }      from "./product-order-types";

/** Updates order status. Only allowed transitions are enforced client-side. */
export async function updateProductOrderStatus(
  id:     string,
  status: OrderStatus,
): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  // Ownership gate
  const { data: existing } = await supabase
    .from("product_orders")
    .select("id, status")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (!existing) return { success: false, error: "注文が見つかりません" };

  const { error } = await supabase
    .from("product_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Updates notes on a draft order. */
export async function updateProductOrderNotes(
  id:    string,
  notes: string | null,
): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("product_orders")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .eq("status", "draft"); // only editable when draft

  if (error) return { success: false, error: error.message };
  return { success: true };
}
