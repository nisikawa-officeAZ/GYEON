"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDB } from "@/lib/invoices/invoice-types";
import { renderInvoicePdf } from "./templates/invoice-pdf";
import { generateAndUploadPdf } from "./generate-pdf-and-upload";

export async function generateInvoicePdf(
  invoiceId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customers    ( last_name, first_name, phone, email ),
      vehicles     ( maker, model, year, grade, plate_number, color ),
      estimates    ( estimate_number, title, total ),
      work_orders  ( work_order_number, title, status ),
      invoice_items ( * )
    `)
    .eq("id", invoiceId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (error || !data) {
    return { success: false, error: "請求書データの取得に失敗しました" };
  }

  const invoice = data as InvoiceDB;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderInvoicePdf(invoice);
  } catch (err) {
    return { success: false, error: `PDF生成エラー: ${String(err)}` };
  }

  const documentNumber =
    invoice.invoice_number ?? `INV-${invoiceId.slice(0, 8).toUpperCase()}`;

  const result = await generateAndUploadPdf({
    dealerId:       dealer.dealer_id,
    documentType:   "invoice",
    documentId:     invoiceId,
    documentNumber,
    pdfBuffer,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, signedUrl: result.signedUrl };
}
