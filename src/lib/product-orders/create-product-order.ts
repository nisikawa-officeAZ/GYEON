"use server";

// GYEON order V1 draft creation.
//
// Exactly one mutation is permitted: create_gyeon_product_order_v1_rpc on the
// authenticated SSR client. The client may name a GYEON product and quantity,
// but SKU, product name, price, buyer rank, shipping, totals, tenant, and actor
// are all reloaded or derived inside the RPC. No direct table write or rollback
// delete remains in this action.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { ProductOrderDB } from "./product-order-types";

export interface ProductOrderItemInput {
  product_id:            string | null;
  sku:                   string;
  product_name_snapshot: string;
  retail_price_snapshot: number | null;
  quantity:              number;
}

export interface CreateProductOrderInput {
  items:            ProductOrderItemInput[];
  order_date?:      string | null;
  notes?:           string | null;
  status?:          "draft" | "submitted";
  idempotency_key?: string | null;
}

function mapRpcError(message: string | undefined): string {
  switch (message) {
    case "gyeon_order_rpc_actor_mismatch":
      return "認証情報が一致しません";
    case "gyeon_order_rpc_not_authorized":
      return "この操作を行う権限がありません";
    case "gyeon_order_rpc_idempotency_key_required":
      return "リクエストキーがありません。注文画面を開き直してください";
    case "gyeon_order_rpc_idempotency_conflict":
      return "同じリクエストキーで異なる注文が送信されています。注文画面を開き直してください";
    case "gyeon_order_rpc_invalid_lines":
      return "注文商品または数量が不正です";
    case "gyeon_order_rpc_invalid_quantity":
      return "注文単位または最低注文数を確認してください";
    case "gyeon_order_rpc_offer_unavailable":
      return "現在注文できない商品が含まれています";
    case "gyeon_order_rpc_backorder_denied":
      return "在庫不足のため注文できない商品が含まれています";
    case "gyeon_order_rpc_buyer_rank_denied":
      return "GYEON認定区分を確認できないため注文できません";
    case "gyeon_order_rpc_shipping_unresolved":
      return "配送地域または送料を確定できないため注文できません";
    case "gyeon_order_rpc_dealer_inactive":
      return "店舗が有効ではないため注文できません";
    case "gyeon_order_rpc_notes_too_long":
      return "備考は1000文字以内で入力してください";
    case "gyeon_order_rpc_numbering_failed":
      return "注文番号を発行できませんでした";
    default:
      return message || "注文の作成に失敗しました";
  }
}

export async function createProductOrder(
  input: CreateProductOrderInput,
): Promise<{ error: string } | { success: true; data: ProductOrderDB }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  // V1 submit requires a real card authorization. Until that adapter is wired,
  // the server refuses the old "save and submit" shortcut instead of creating an
  // unpaid submitted order.
  if (input.status === "submitted") {
    return { error: "カード与信の接続前は下書き保存のみ利用できます" };
  }

  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) {
    return { error: "商品を1つ以上追加してください" };
  }

  const idempotencyKey = input.idempotency_key?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return { error: "リクエストキーがありません。注文画面を開き直してください" };
  }

  const seen = new Set<string>();
  const lines: Array<{ product_id: string; quantity: number }> = [];
  for (const item of input.items) {
    const productId = item.product_id?.trim() ?? "";
    if (
      !productId ||
      seen.has(productId) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100_000
    ) {
      return { error: "注文商品または数量が不正です" };
    }
    seen.add(productId);
    lines.push({ product_id: productId, quantity: item.quantity });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };

  const { data, error } = await supabase.rpc("create_gyeon_product_order_v1_rpc", {
    p_dealer_id:       auth.dealerId,
    p_actor:           actor,
    p_idempotency_key: idempotencyKey,
    p_lines:           lines,
    p_notes:           input.notes ?? null,
  });

  if (error || !data) {
    console.error("[GYEON order] create RPC failed");
    return { error: mapRpcError(error?.message) };
  }

  return { success: true, data: data as unknown as ProductOrderDB };
}
