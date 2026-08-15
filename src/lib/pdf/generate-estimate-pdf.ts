"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstimateDB } from "@/lib/estimates/estimate-types";
import { renderEstimateDocumentPdf } from "./render-estimate-document";
import { getBrandProfile } from "./brand-profile";
import { generateAndUploadPdf } from "./generate-pdf-and-upload";
import { createActivityLog } from "@/lib/activity/activity-log";
import { createNotification } from "@/lib/notifications/notification";
import { createAuditLog } from "@/lib/audit/audit";

export async function generateEstimatePdf(
  estimateId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("estimates")
    .select(`
      *,
      customers ( last_name, first_name, phone, email, postal_code, address1, is_business ),
      vehicles  ( maker, model, year, grade, color, mileage, plate_number, body_size, registration_date, inspection_expiry_date ),
      estimate_items ( * )
    `)
    .eq("id", estimateId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (error || !data) {
    return { success: false, error: "見積データの取得に失敗しました" };
  }

  const estimate = data as EstimateDB;

  const brand = await getBrandProfile(dealer.dealer_id);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderEstimateDocumentPdf(estimate, brand);
  } catch (err) {
    return (console.error("[pdf] render failed:", err), { success: false, error: "PDFの生成に失敗しました。時間をおいて再度お試しください。" });
  }

  const documentNumber =
    estimate.estimate_number ?? estimate.estimate_no ?? estimateId.slice(0, 8).toUpperCase();

  const result = await generateAndUploadPdf({
    dealerId:       dealer.dealer_id,
    documentType:   "estimate",
    documentId:     estimateId,
    documentNumber,
    pdfBuffer,
  });

  if (!result.success) return { success: false, error: result.error };

  void createActivityLog({
    entity_type: "document_file",
    entity_id:   estimateId,
    customer_id: (estimate.customers as unknown as { id?: string } | null)?.id ?? null,
    action:      "generated_pdf",
    title:       `見積書PDFを生成: ${documentNumber}`,
  });

  void createNotification({
    type:    "success",
    title:   "PDFを生成しました",
    message: documentNumber,
  });

  void createAuditLog({
    action: "generate_pdf",
    resource_type: "document",
    resource_id: estimateId,
    new_value: { document_type: "estimate", number: estimate.estimate_number },
  });

  return { success: true, signedUrl: result.signedUrl };
}
