"use server";

// Dealer-side GYEON order mutations. Authenticated callers never receive direct
// INSERT/UPDATE/DELETE table privileges; these wrappers call only the narrow V1 RPCs.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { OrderStatus } from "./product-order-types";

function mapRpcError(message: string | undefined): string {
  switch (message) {
    case "gyeon_order_rpc_actor_mismatch":
      return "認証情報が一致しません";
    case "gyeon_order_rpc_not_authorized":
      return "この操作を行う権限がありません";
    case "gyeon_order_rpc_order_not_found":
      return "注文が見つかりません";
    case "gyeon_order_rpc_same_status":
      return "注文はすでに同じ状態です";
    case "gyeon_order_rpc_transition_denied":
      return "現在の注文状態ではこの操作を実行できません";
    case "gyeon_order_rpc_notes_too_long":
      return "備考は1000文字以内で入力してください";
    default:
      return message || "注文の更新に失敗しました";
  }
}

async function authenticatedMutationContext(
  capability: "edit" | "delete",
): Promise<
  | { error: string }
  | {
      dealerId: string;
      actor: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
> {
  const auth = await requireStaffCapability(capability);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };
  return { dealerId: auth.dealerId, actor, supabase };
}

export async function updateProductOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ success: boolean; error?: string }> {
  if (status === "submitted") {
    const auth = await requireStaffCapability("edit");
    if ("error" in auth) return { success: false, error: auth.error };
    return {
      success: false,
      error: "カード与信の接続前は注文を確定できません",
    };
  }

  if (status !== "cancelled") {
    const auth = await requireStaffCapability("edit");
    if ("error" in auth) return { success: false, error: auth.error };
    return { success: false, error: "この状態変更はGYEON運営側の処理です" };
  }

  const context = await authenticatedMutationContext("delete");
  if ("error" in context) return { success: false, error: context.error };

  const { data, error } = await context.supabase.rpc(
    "cancel_gyeon_product_order_v1_rpc",
    {
      p_dealer_id: context.dealerId,
      p_actor: context.actor,
      p_order_id: id,
    },
  );
  if (error || !data) {
    console.error("[GYEON order] cancel RPC failed");
    return { success: false, error: mapRpcError(error?.message) };
  }
  return { success: true };
}

export async function updateProductOrderNotes(
  id: string,
  notes: string | null,
): Promise<{ success: boolean; error?: string }> {
  const context = await authenticatedMutationContext("edit");
  if ("error" in context) return { success: false, error: context.error };

  const { data, error } = await context.supabase.rpc(
    "update_gyeon_product_order_notes_v1_rpc",
    {
      p_dealer_id: context.dealerId,
      p_actor: context.actor,
      p_order_id: id,
      p_notes: notes,
    },
  );
  if (error || !data) {
    console.error("[GYEON order] notes RPC failed");
    return { success: false, error: mapRpcError(error?.message) };
  }
  return { success: true };
}
