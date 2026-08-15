"use server";

// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — compatibility wrapper, no longer a generator.
//
// This module used to render an invoice and upload it through
// `generateAndUploadPdf`, which writes a STABLE key with `upsert: true`. That
// meant regenerating an invoice silently replaced the bytes a customer had
// already been sent, and archived `document_files` rows ended up pointing at
// content that no longer matched them.
//
// Issuance now belongs to `issueInvoice`, which writes a UUID-keyed object with
// `upsert: false` and flips the invoice out of draft only after the artifact
// exists. This wrapper delegates so that no callable invoice path retains the
// overwrite behaviour, while keeping the old call signature working.

import { issueInvoice, getIssuedInvoicePdfUrl } from "@/lib/invoices/issue-invoice";

export async function generateInvoicePdf(
  invoiceId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const result = await issueInvoice(invoiceId);

  switch (result.kind) {
    case "issued":
    case "already_issued":
      return { success: true, signedUrl: result.signedUrl };
    default:
      return { success: false, error: result.message };
  }
}

/** Download-only helper: re-signs the existing artifact, never regenerates it. */
export async function getInvoicePdfUrl(
  invoiceId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const result = await getIssuedInvoicePdfUrl(invoiceId);

  if (result.kind === "issued" || result.kind === "already_issued") {
    return { success: true, signedUrl: result.signedUrl };
  }
  return { success: false, error: result.message };
}
