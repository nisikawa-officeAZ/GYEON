"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DocumentFileDB,
  DocumentType,
  buildDocumentFileName,
  buildDocumentStoragePath,
} from "@/lib/documents/document-file-types";

export async function generateAndUploadPdf(params: {
  dealerId: string;
  documentType: DocumentType;
  documentId: string;
  documentNumber: string;
  pdfBuffer: Buffer;
}): Promise<{ success: true; file: DocumentFileDB; signedUrl: string } | { success: false; error: string }> {
  const { dealerId, documentType, documentId, documentNumber, pdfBuffer } = params;
  const supabase = createAdminClient();

  // 1. Build file name and storage path
  const fileName = buildDocumentFileName(documentType, documentNumber);
  const storagePath = buildDocumentStoragePath(dealerId, documentType, fileName);

  // 2. Upload to Supabase Storage
  const { error: uploadError } = await supabase
    .storage
    .from("documents")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    if (
      uploadError.message?.includes("Bucket not found") ||
      uploadError.message?.includes("bucket")
    ) {
      return {
        success: false,
        error: "Storage bucket 'documents' が作成されていません。DOCUMENT_STORAGE_SETUP.md を参照してください。",
      };
    }
    return { success: false, error: `アップロードエラー: ${uploadError.message}` };
  }

  // 3. Generate signed URL (7 days = 604800 seconds)
  const { data: signedData, error: signedError } = await supabase
    .storage
    .from("documents")
    .createSignedUrl(storagePath, 604800);

  if (signedError || !signedData?.signedUrl) {
    return { success: false, error: "署名付きURL生成エラー" };
  }

  const signedUrl = signedData.signedUrl;
  const signedUrlExpiresAt = new Date(Date.now() + 604800 * 1000).toISOString();

  // 4. Archive existing active files for this document
  await supabase
    .from("document_files")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("dealer_id", dealerId)
    .eq("document_type", documentType)
    .eq("document_id", documentId)
    .eq("status", "active");

  // 5. Insert new document_files record
  const { data: inserted, error: insertError } = await supabase
    .from("document_files")
    .insert({
      dealer_id:             dealerId,
      document_type:         documentType,
      document_id:           documentId,
      file_name:             fileName,
      file_path:             storagePath,
      public_url:            null,
      signed_url_expires_at: signedUrlExpiresAt,
      file_size:             pdfBuffer.byteLength,
      mime_type:             "application/pdf",
      status:                "active",
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return { success: false, error: `レコード登録エラー: ${insertError?.message ?? "unknown"}` };
  }

  return { success: true, file: inserted as DocumentFileDB, signedUrl };
}
