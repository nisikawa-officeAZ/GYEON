"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDB } from "@/lib/invoices/invoice-types";
import { renderInvoicePdf } from "./templates/invoice-pdf";
import { getDealerStampForPdf } from "./get-dealer-stamp";
import { generateAndUploadPdf } from "./generate-pdf-and-upload";
import { createActivityLog } from "@/lib/activity/activity-log";
import { createNotification } from "@/lib/notifications/notification";
import { createAuditLog } from "@/lib/audit/audit";

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

  const stamp = await getDealerStampForPdf(dealer.dealer_id);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderInvoicePdf(invoice, stamp);
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

  void createActivityLog({
    entity_type: "document_file",
    entity_id:   invoiceId,
    customer_id: (invoice.customers as unknown as { id?: string } | null)?.id ?? null,
    action:      "generated_pdf",
    title:       `請求書PDFを生成: ${documentNumber}`,
  });

  void createNotification({
    type:    "success",
    title:   "PDFを生成しました",
    message: documentNumber,
  });

  void createAuditLog({
    action: "generate_pdf",
    resource_type: "document",
    resource_id: invoiceId,
    new_value: { document_type: "invoice", number: invoice.invoice_number },
  });

  return { success: true, signedUrl: result.signedUrl };
}
