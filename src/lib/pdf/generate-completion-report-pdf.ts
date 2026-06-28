"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompletionReportFullData } from "@/lib/completion-reports/completion-report-types";
import { renderCompletionReportPdf } from "./templates/completion-report-pdf";
import { getDealerStampForPdf } from "./get-dealer-stamp";
import { generateAndUploadPdf } from "./generate-pdf-and-upload";
import { createAuditLog } from "@/lib/audit/audit";

export async function generateCompletionReportPdf(
  reportId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();

  // Fetch report
  const { data: reportData, error: reportError } = await supabase
    .from("completion_reports")
    .select("*")
    .eq("id", reportId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (reportError || !reportData) {
    return { success: false, error: "作業完了報告書データの取得に失敗しました" };
  }

  // Fetch dealer info
  const { data: dealerData } = await supabase
    .from("dealers")
    .select("id, name, dealer_type, prefecture, address, phone, email")
    .eq("id", dealer.dealer_id)
    .single();

  // Fetch work order with nested relations
  const { data: woData } = await supabase
    .from("work_orders")
    .select(`
      id,
      work_order_number,
      title,
      status,
      scheduled_start_at,
      scheduled_end_at,
      actual_start_at,
      actual_end_at,
      assigned_staff,
      service_summary,
      notes,
      customers ( last_name, first_name, phone, email ),
      vehicles  ( maker, model, year, grade, plate_number, color ),
      estimates (
        estimate_number,
        title,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        total,
        estimate_items (
          id, category, item_name, description,
          quantity, unit_price, discount_rate, line_total, sort_order
        )
      )
    `)
    .eq("id", reportData.work_order_id)
    .single();

  // Fetch files
  const { data: filesData } = await supabase
    .from("work_order_files")
    .select("*")
    .eq("work_order_id", reportData.work_order_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullData: CompletionReportFullData = {
    report:     reportData,
    dealer:     dealerData ?? null,
    work_order: woData ? (woData as unknown as CompletionReportFullData["work_order"]) : null,
    files:      filesData ?? [],
  };

  const stamp = await getDealerStampForPdf(dealer.dealer_id);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderCompletionReportPdf(fullData, stamp);
  } catch (err) {
    return { success: false, error: `PDF生成エラー: ${String(err)}` };
  }

  const documentNumber =
    reportData.report_number ?? `RPT-${reportId.slice(0, 8).toUpperCase()}`;

  const result = await generateAndUploadPdf({
    dealerId:       dealer.dealer_id,
    documentType:   "completion_report",
    documentId:     reportId,
    documentNumber,
    pdfBuffer,
  });

  if (!result.success) return { success: false, error: result.error };

  void createAuditLog({
    action: "generate_pdf",
    resource_type: "document",
    resource_id: reportId,
    new_value: { document_type: "completion_report", number: documentNumber },
  });

  return { success: true, signedUrl: result.signedUrl };
}
