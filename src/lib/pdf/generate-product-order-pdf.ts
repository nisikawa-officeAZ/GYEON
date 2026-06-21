"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductOrderDB } from "@/lib/product-orders/product-order-types";
import { renderProductOrderPdf } from "./templates/product-order-pdf";
import { generateAndUploadPdf } from "./generate-pdf-and-upload";

export async function generateProductOrderPdf(
  orderId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_orders")
    .select(`
      *,
      product_order_items ( * )
    `)
    .eq("id", orderId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (error || !data) {
    return { success: false, error: "注文データの取得に失敗しました" };
  }

  const order = data as ProductOrderDB;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProductOrderPdf(order);
  } catch (err) {
    return { success: false, error: `PDF生成エラー: ${String(err)}` };
  }

  const documentNumber =
    order.order_number ?? `PO-${orderId.slice(0, 8).toUpperCase()}`;

  const result = await generateAndUploadPdf({
    dealerId:       dealer.dealer_id,
    documentType:   "product_order",
    documentId:     orderId,
    documentNumber,
    pdfBuffer,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, signedUrl: result.signedUrl };
}
