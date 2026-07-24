import "server-only";

// R92B Phase 2 — immutable estimate-PDF snapshot for customer sharing.
//
// Thin server-only wrapper. It renders through the SAME production renderer as
// the download path, then writes to a UNIQUE immutable Storage path with
// `upsert:false` and inserts its own `document_files` row. It deliberately does
// NOT reuse `generate-pdf-and-upload.ts` (which upserts a mutable
// `{dealer}/{type}/{number}.pdf` path and archives siblings) — a shared snapshot
// must never be overwritten by an ordinary regeneration. All path and
// compensation DECISIONS live in the pure `estimate-share-core`.

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEstimatePdfData } from "@/lib/pdf/get-estimate-pdf-data";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderEstimateDocumentPdf } from "@/lib/pdf/render-estimate-document";
import { buildSnapshotStoragePath } from "@/lib/estimates/estimate-share-core";
// The same pure header/name helper the download route uses, so the customer's
// saved file carries the estimate number rather than an opaque UUID.
import { buildPdfFilename } from "@/app/pdf/estimate/pdf-response-headers";

export type SnapshotResult =
  | { kind: "ok"; documentFileId: string; filePath: string; fileName: string }
  | { kind: "failed"; reason: "pdf-generation-failed" | "document-persist-failed" };

/**
 * `dealerId` is server-resolved by the caller (never client input). The estimate
 * is (re)loaded dealer-scoped by `getEstimatePdfData`, so a foreign id renders
 * nothing.
 */
export async function generateEstimateSnapshotPdf(dealerId: string, estimateId: string): Promise<SnapshotResult> {
  const estimate = await getEstimatePdfData(estimateId);
  if (!estimate) return { kind: "failed", reason: "pdf-generation-failed" };

  const brand = await getBrandProfile(dealerId);

  let buffer: Buffer;
  try {
    buffer = await renderEstimateDocumentPdf(estimate, brand);
  } catch (err) {
    console.error("[estimate snapshot] render failed:", err);
    return { kind: "failed", reason: "pdf-generation-failed" };
  }

  // The documentFileId is generated up front so it can seed the immutable path.
  // The Storage OBJECT name is the UUID (globally unique, never overwritten); the
  // document_files.file_name is the customer-facing display name.
  const documentFileId = randomUUID();
  const fileName = buildPdfFilename(estimate.estimate_number ?? estimate.estimate_no);
  const filePath = buildSnapshotStoragePath(dealerId, estimateId, documentFileId);

  const supabase = createAdminClient();

  const { error: uploadError } = await supabase
    .storage
    .from("documents")
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    console.error("[estimate snapshot] upload failed:", uploadError.message);
    return { kind: "failed", reason: "pdf-generation-failed" };
  }

  const { error: insertError } = await supabase
    .from("document_files")
    .insert({
      id:            documentFileId,
      dealer_id:     dealerId,
      document_type: "estimate",
      document_id:   estimateId,
      file_name:     fileName,
      file_path:     filePath,
      public_url:    null,
      file_size:     buffer.byteLength,
      mime_type:     "application/pdf",
      status:        "active",
    });

  if (insertError) {
    // Compensation for a failed document-persist: delete the orphan object.
    await supabase.storage.from("documents").remove([filePath]);
    console.error("[estimate snapshot] document_files insert failed:", insertError.message);
    return { kind: "failed", reason: "document-persist-failed" };
  }

  return { kind: "ok", documentFileId, filePath, fileName };
}
