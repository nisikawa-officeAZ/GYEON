"use server";

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { OrderStatus }      from "./product-order-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

// Dealers may only move orders along these paths.
// Admin-only statuses (approved) and terminal states (cancelled) are blocked.
const DEALER_ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:     ["submitted", "cancelled"],
  submitted: ["cancelled"],
  approved:  [],   // admin-only — dealer cannot change an approved order
  cancelled: [],   // terminal state
};

/** Updates order status with server-side transition guard. */
export async function updateProductOrderStatus(
  id:     string,
  status: OrderStatus,
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  // Ownership gate — also fetches current status for transition check
  const { data: existing } = await supabase
    .from("product_orders")
    .select("id, status")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (!existing) return { success: false, error: "注文が見つかりません" };

  const currentStatus = existing.status as OrderStatus;
  const allowed = DEALER_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(status)) {
    return {
      success: false,
      error:   `この操作は許可されていません (${currentStatus} → ${status})`,
    };
  }

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
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

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
