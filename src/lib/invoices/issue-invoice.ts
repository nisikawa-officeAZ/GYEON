"use server";

// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — issue an invoice, producing ONE immutable PDF.
//
// Why this exists separately from generate-invoice-pdf.ts: the old path uploaded
// to a stable key with upsert:true, so re-generating silently replaced the bytes a
// customer had already received. Issuance here writes a UUID-keyed object with
// upsert:false, which the Storage API refuses to overwrite, and only then flips
// the invoice out of draft.
//
// Ordering is deliberate: render → upload → record → conditional transition. The
// invoice becomes `issued` only after the artifact provably exists.
//
// Cleanup is NOT atomic and is not claimed to be: a table and an object store
// cannot be committed together. On failure we ATTEMPT compensation (row first,
// then object) and inspect the result — if a step fails, the caller receives
// `cleanup_failed` rather than a success, because an orphan object or dangling
// row is left behind and needs operator attention.
//
// The Storage writer is the service-role client, which bypasses RLS, so EVERY
// invoice and document_files statement here carries an explicit dealer_id
// predicate. Tenancy is enforced by this code, not by policy.

import { randomUUID } from "node:crypto";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import { renderInvoicePdf } from "@/lib/pdf/templates/invoice-pdf";
import { getDealerStampForPdf } from "@/lib/pdf/get-dealer-stamp";
import { getDealerBranding } from "@/lib/pdf/dealer-branding";
import {
  ISSUED_INVOICE_CONTENT_TYPE,
  buildIssuedInvoiceObjectKey,
  describeIssueOutcome,
  evaluateIssueRequest,
  planCompensation,
  evaluateCompensation,
  resolveConcurrentIssue,
  resolveSignableArtifact,
  parseIssuedInvoiceObjectKey,
  shouldRemoveObjectAfterRowDeletion,
  canDownloadIssuedArtifact,
  type CompensationStepResult,
  type IssueOutcomeKind,
} from "@/lib/invoices/invoice-issuance-core";
import { validateIssuanceSnapshot } from "@/lib/invoices/invoice-issuance-snapshot";

const SIGNED_URL_TTL_SECONDS = 604800; // 7 days

export type IssueInvoiceResult =
  | { readonly kind: "issued"; readonly signedUrl: string }
  | { readonly kind: "already_issued"; readonly signedUrl: string }
  | { readonly kind: "validation_error"; readonly message: string }
  | { readonly kind: "conflict"; readonly message: string }
  | { readonly kind: "artifact_missing"; readonly message: string }
  | { readonly kind: "storage_error"; readonly message: string }
  | { readonly kind: "persistence_error"; readonly message: string }
  | { readonly kind: "cleanup_failed"; readonly message: string };

function fail(kind: Exclude<IssueOutcomeKind, "issued" | "already_issued">): IssueInvoiceResult {
  return { kind, message: describeIssueOutcome(kind) } as IssueInvoiceResult;
}

/**
 * Resolve the ONE artifact this invoice is allowed to expose, then sign it.
 *
 * B1-R1-1: the path on the invoice row is never trusted on its own. Any dealer
 * member can insert a `document_files` row and the storage policies let them
 * write inside their own folder, so signing a stored string with the service role
 * would let a member have arbitrary objects signed. Instead the active invoice
 * document row is looked up dealer-scoped, and the pure core requires it to be an
 * active PDF whose file_path is the canonical key rebuilt from the dealer, the
 * invoice and that row's own id — and that the invoice agrees with it.
 *
 * Never renders and never uploads: a signing failure must not be "fixed" by
 * producing a second artifact.
 */
async function signResolvedArtifact(
  dealerId: string,
  invoiceId: string,
  invoicePdfFilePath: string | null | undefined
): Promise<string | null> {
  const admin = createAdminClient();

  // B1-R2-3: the pointer names exactly one document row. Selecting the NEWEST
  // active row instead would let a race loser that failed cleanup shadow the
  // real winner, so the id is parsed out of the pointer and queried directly.
  const pointer = parseIssuedInvoiceObjectKey(invoicePdfFilePath);
  if (!pointer || pointer.dealerId !== dealerId || pointer.invoiceId !== invoiceId) {
    return null;
  }

  const { data: row } = await admin
    .from("document_files")
    .select("id, dealer_id, document_type, document_id, file_path, mime_type, status")
    .eq("id", pointer.documentFileId)
    .eq("dealer_id", dealerId)
    .eq("document_type", "invoice")
    .eq("document_id", invoiceId)
    .eq("file_path", invoicePdfFilePath)
    .eq("mime_type", ISSUED_INVOICE_CONTENT_TYPE)
    .eq("status", "active")
    .maybeSingle();

  const resolution = resolveSignableArtifact({
    dealerId,
    invoiceId,
    documentFileId: row?.id as string | undefined,
    documentFilePath: row?.file_path as string | undefined,
    documentType: row?.document_type as string | undefined,
    documentStatus: row?.status as string | undefined,
    mimeType: row?.mime_type as string | undefined,
    documentRowDealerId: row?.dealer_id as string | undefined,
    documentRowDocumentId: row?.document_id as string | undefined,
    invoicePdfFilePath,
  });

  if (resolution.kind !== "resolved") return null;

  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(resolution.filePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function issueInvoice(invoiceId: string): Promise<IssueInvoiceResult> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return fail("validation_error");

  const dealer = await getCurrentDealer();
  if (!dealer) return fail("validation_error");
  const dealerId = dealer.dealer_id;

  if (typeof invoiceId !== "string" || invoiceId.trim() === "") {
    return fail("validation_error");
  }

  // Read through the caller's RLS-scoped client, additionally pinned to the
  // session dealer.
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, pdf_file_path, invoice_number, content_version")
    .eq("id", invoiceId)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  if (!invoice) return fail("validation_error");

  const decision = evaluateIssueRequest(invoice);

  if (decision.kind === "already-issued") {
    const signed = await signResolvedArtifact(
      dealerId,
      invoiceId,
      invoice.pdf_file_path as string | null
    );
    return signed
      ? { kind: "already_issued", signedUrl: signed }
      : fail("artifact_missing");
  }

  if (decision.kind === "rejected") {
    return fail(decision.reason === "invoice_artifact_missing" ? "artifact_missing" : "validation_error");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Nothing is written yet, so a render failure leaves no state at all.
  const admin = createAdminClient();

  const { data: full, error: fullErr } = await admin
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
    .eq("dealer_id", dealerId)
    .single();

  if (fullErr || !full) return fail("persistence_error");

  // B1-R2-5: the marker is captured from the SAME read that feeds the renderer,
  // so it describes exactly the content about to become the PDF. B1-R3-6: it is
  // a real InvoiceDB column now, so no ad hoc cast hides a missing field.
  const renderedInvoice = full as InvoiceDB;
  const renderedContentVersion = renderedInvoice.content_version;
  if (typeof renderedContentVersion !== "number") return fail("persistence_error");

  // R4-4: refuse to publish an internally inconsistent snapshot. This runs
  // BEFORE rendering, before any upload, before the document row and before the
  // invoice transition — so an invalid invoice leaves zero state behind.
  const snapshot = validateIssuanceSnapshot(
    renderedInvoice as unknown as Parameters<typeof validateIssuanceSnapshot>[0]
  );
  if (snapshot.kind === "invalid") {
    console.error("[invoice issuance] snapshot rejected", {
      invoiceId,
      reason: snapshot.reason,
      detail: snapshot.detail,
    });
    return fail("validation_error");
  }

  let buffer: Buffer;
  try {
    const stamp = await getDealerStampForPdf(dealerId);
    const branding = await getDealerBranding(dealerId);
    buffer = await renderInvoicePdf(renderedInvoice, stamp, branding);
  } catch {
    return fail("persistence_error");
  }

  // ── Upload (immutable) ────────────────────────────────────────────────────
  const documentFileId = randomUUID();
  const filePath = buildIssuedInvoiceObjectKey(dealerId, invoiceId, documentFileId);

  let objectUploaded = false;
  let documentRowInserted = false;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(filePath, buffer, {
      contentType: ISSUED_INVOICE_CONTENT_TYPE,
      upsert: false, // the whole point: an existing key must never be replaced
    });

  if (uploadError) return fail("storage_error");
  objectUploaded = true;

  // Compensate in the order the pure core prescribes: row first, then object, so
  // no row ever outlives the bytes it points at.
  // Cleanup spans a table and an object store, so it is NOT atomic and can fail.
  // The caller must therefore inspect the result: a failed step leaves an orphan
  // that needs operator attention and must never be reported as a clean outcome.
  async function compensate(): Promise<"clean" | "incomplete"> {
    const results: CompensationStepResult[] = [];
    let documentRowDeleted = false;

    for (const step of planCompensation({ objectUploaded, documentRowInserted })) {
      if (step === "delete-document-row") {
        const { error } = await admin
          .from("document_files")
          .delete()
          .eq("id", documentFileId)
          .eq("dealer_id", dealerId);
        documentRowDeleted = !error;
        results.push({ step, ok: !error });
        if (error) {
          console.error("[invoice issuance] document row cleanup failed", {
            invoiceId,
            documentFileId,
            code: error.code,
          });
        }
        continue;
      }

      // B1-R2-4: removing the object while the row survives would leave a row
      // pointing at missing bytes — worse than an orphan object. Skip it.
      if (!shouldRemoveObjectAfterRowDeletion({ documentRowInserted, documentRowDeleted })) {
        results.push({ step, ok: false });
        console.error("[invoice issuance] object removal skipped: row still present", {
          invoiceId,
          documentFileId,
        });
        continue;
      }

      const { error } = await admin.storage.from("documents").remove([filePath]);
      results.push({ step, ok: !error });
      if (error) {
        console.error("[invoice issuance] object cleanup failed", {
          invoiceId,
          documentFileId,
        });
      }
    }

    return evaluateCompensation(results).kind === "clean" ? "clean" : "incomplete";
  }

  // ── Record the artifact ───────────────────────────────────────────────────
  const { error: insertError } = await admin.from("document_files").insert({
    id: documentFileId,
    dealer_id: dealerId,
    document_type: "invoice",
    document_id: invoiceId,
    file_name: `invoice-${invoice.invoice_number ?? invoiceId}.pdf`,
    file_path: filePath,
    public_url: null,
    signed_url_expires_at: null,
    file_size: buffer.byteLength,
    mime_type: ISSUED_INVOICE_CONTENT_TYPE,
    status: "active",
  });

  if (insertError) {
    const cleanup = await compensate();
    return fail(cleanup === "clean" ? "persistence_error" : "cleanup_failed");
  }
  documentRowInserted = true;

  // ── Race-safe transition ──────────────────────────────────────────────────
  // `status = 'draft'` in the predicate is the winner gate: exactly one
  // concurrent caller can match, and the loser tears its own artifact down.
  const { data: updatedRows, error: updateError } = await admin
    .from("invoices")
    .update({
      status: "issued",
      pdf_file_path: filePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("dealer_id", dealerId)
    .eq("status", "draft")
    // B1-R2-5: if the draft changed while we rendered, this predicate misses and
    // the issuance loses — the row can never disagree with the delivered bytes.
    .eq("content_version", renderedContentVersion)
    .select("id");

  if (updateError) {
    const cleanup = await compensate();
    return fail(cleanup === "clean" ? "persistence_error" : "cleanup_failed");
  }

  if (resolveConcurrentIssue(updatedRows?.length ?? 0) === "loser") {
    // A losing racer that could not clean up must NOT report a happy
    // already_issued: an orphan object or row is still out there.
    if ((await compensate()) === "incomplete") return fail("cleanup_failed");

    // Two ways to lose: another request issued first, or the draft changed
    // underneath us. Only the first has an artifact to hand back.
    const { data: winner } = await admin
      .from("invoices")
      .select("pdf_file_path, status")
      .eq("id", invoiceId)
      .eq("dealer_id", dealerId)
      .maybeSingle();

    const winnerPath = winner?.pdf_file_path as string | undefined;
    // Still a draft ⇒ nobody issued; the content moved on. That is a conflict,
    // not a success, and the operator must re-issue the current content.
    if (!winnerPath || winner?.status === "draft") return fail("conflict");

    const signed = await signResolvedArtifact(dealerId, invoiceId, winnerPath);
    return signed ? { kind: "already_issued", signedUrl: signed } : fail("artifact_missing");
  }

  const signed = await signResolvedArtifact(dealerId, invoiceId, filePath);
  // The artifact is persisted and the invoice is issued; a signing hiccup must
  // NOT roll that back or produce a second PDF.
  return signed ? { kind: "issued", signedUrl: signed } : fail("artifact_missing");
}

/**
 * Re-sign the already-issued artifact for download. Never renders, never
 * uploads, never overwrites.
 */
export async function getIssuedInvoicePdfUrl(invoiceId: string): Promise<IssueInvoiceResult> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return fail("validation_error");

  const dealer = await getCurrentDealer();
  if (!dealer) return fail("validation_error");

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("pdf_file_path, status")
    .eq("id", invoiceId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!invoice) return fail("validation_error");

  // A draft has nothing to download; it has not been issued.
  if (!canDownloadIssuedArtifact(invoice.status as string | null)) {
    return fail("validation_error");
  }

  const signed = await signResolvedArtifact(
    dealer.dealer_id,
    invoiceId,
    invoice.pdf_file_path as string | null
  );
  return signed ? { kind: "already_issued", signedUrl: signed } : fail("artifact_missing");
}
