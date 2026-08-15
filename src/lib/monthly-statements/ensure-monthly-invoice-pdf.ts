"use server";

// B1B-E3 — retry-safe issued monthly-invoice PDF artifact action (accepted E3-A1/R1/R2 contract,
// E3-I1-R1 convergence/read-error/download repairs).
//
// ensureMonthlyInvoicePdf: the ONE path that materializes the immutable monthly-invoice PDF for an
// ISSUED statement. Ordering per accepted contract: pointed artifact → canonical validation →
// existence probe → sign (zero renders); valid unpointed artifact → validate → probe → attach RPC →
// pointed revalidation/sign (zero renders); stale byteless row → exact-row cleanup → fresh render;
// no artifact → render once → UUID upload (upsert:false) → document_files insert (public_url:null)
// → attach RPC → pointed revalidation → sign.
//
// FAIL-CLOSED READS (I1-R1): every read checks `error` separately from `data`. A query error stops
// as persistence_error with zero downstream side effects — it is never treated as row-not-found.
//
// WINNER CONVERGENCE (I1-R1): a race loser that finds an unpointed active winner row validates it,
// byte-verifies it, and ATTACHES it before signing, so convergence never leaves the statement
// pointerless. A conflict on that attach performs exactly one dealer-scoped statement re-read and
// signs the now-pointed winner. No recursion, no loops, no renders, no winner mutation.
//
// The financial issuance already happened in issue_monthly_statement_rpc: this module writes no
// financial column and never touches monthly_statements directly — the pointer is written ONLY by
// attach_monthly_statement_pdf_rpc through the service-role boundary.
//
// Storage existence probes use the accepted three-way taxonomy: only a resolved 400/404
// StorageError is a CONFIRMED missing object; every thrown/unknown outcome is probe_unavailable →
// storage_error/retry_required with ZERO side effects.
//
// The service-role client bypasses RLS, so every admin statement carries explicit dealer_id
// predicates — tenancy is enforced by this code (the accepted issue-invoice discipline).

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderMonthlyInvoiceDocumentPdf } from "@/lib/pdf/render-monthly-invoice-document";
import type {
  MonthlyStatementDB,
  MonthlyStatementLineDB,
  MonthlyStatementReceiptDB,
  MonthlyStatementAdjustmentDB,
} from "./monthly-statement-types";
import {
  MONTHLY_INVOICE_CONTENT_TYPE,
  buildMonthlyInvoiceObjectKey,
  resolveSignableMonthlyArtifact,
  classifyExistenceProbe,
  decidePointedArtifact,
  decideUnpointedCandidate,
  isActiveArtifactUniqueViolation,
  isPointerConflict,
  isStatementNotIssued,
  describeMonthlyArtifactOutcome,
  type ExistenceClassification,
  type MonthlyArtifactOutcomeKind,
} from "./monthly-invoice-artifact-core";

const SIGNED_URL_TTL_SECONDS = 604800; // 7 days — signing is read-time only, never persisted

type Admin = ReturnType<typeof createAdminClient>;

export type MonthlyInvoicePdfResult =
  | { kind: "ready"; signedUrl: string }
  | { kind: Exclude<MonthlyArtifactOutcomeKind, "ready">; message: string };

function fail(kind: Exclude<MonthlyArtifactOutcomeKind, "ready">): MonthlyInvoicePdfResult {
  return { kind, message: describeMonthlyArtifactOutcome(kind) };
}

/**
 * The ONE existence probe (E3-A1-R2): explicit try/catch normalizer — a resolved outcome and a
 * thrown outcome are classified by the pure core's decision table, never by truthiness.
 */
async function probeObjectExistence(admin: Admin, path: string): Promise<ExistenceClassification> {
  try {
    const result = await admin.storage.from("documents").exists(path);
    return classifyExistenceProbe({ kind: "resolved", data: result.data, error: result.error });
  } catch (error) {
    return classifyExistenceProbe({ kind: "thrown", error });
  }
}

/**
 * Resolve + byte-verify + sign the artifact row `documentFileId` for this statement.
 * Strict accepted order: dealer-scoped row lookup → canonical validation → exists → sign
 * (with download disposition so browser navigation downloads instead of leaving the app).
 * Never renders, never uploads, never attaches, never mutates the pointer.
 */
async function signVerifiedArtifact(
  admin: Admin,
  dealerId: string,
  statementId: string,
  documentFileId: string,
): Promise<MonthlyInvoicePdfResult> {
  const { data: row, error: rowError } = await admin
    .from("document_files")
    .select("id, dealer_id, document_type, document_id, file_path, mime_type, status")
    .eq("id", documentFileId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  // A failed read proves nothing about the row — fail closed, never as artifact_missing.
  if (rowError) return fail("persistence_error");

  const resolution = resolveSignableMonthlyArtifact({
    dealerId,
    statementId,
    rowId: row?.id as string | undefined,
    rowDealerId: row?.dealer_id as string | undefined,
    rowDocumentType: row?.document_type as string | undefined,
    rowDocumentId: row?.document_id as string | undefined,
    rowStatus: row?.status as string | undefined,
    rowMimeType: row?.mime_type as string | undefined,
    rowFilePath: row?.file_path as string | undefined,
  });
  if (resolution.kind !== "resolved") return fail("artifact_missing");

  const existence = await probeObjectExistence(admin, resolution.filePath);
  const decision = decidePointedArtifact(existence);
  if (decision === "operator_attention") return fail("artifact_missing");
  if (decision === "retry_required") return fail("storage_error");

  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(resolution.filePath, SIGNED_URL_TTL_SECONDS, { download: true });
  if (error || !data?.signedUrl) return fail("storage_error");
  return { kind: "ready", signedUrl: data.signedUrl };
}

/**
 * ONE bounded winner-resolution pass after losing a race (23505 or RPC pointer conflict).
 *
 * pointer set → byte-verified sign. pointer null + active winner row → read the COMPLETE row,
 * validate its canonical shape, probe its bytes, then ATTACH it (convergence must never leave
 * the statement pointerless) and sign; an attach conflict performs exactly one dealer-scoped
 * statement re-read and signs the now-pointed winner. The winner's row and object are never
 * deleted, replaced, or mutated here. No recursion, no loops, no renders, no uploads.
 */
async function resolveRaceWinner(
  admin: Admin,
  dealerId: string,
  statementId: string,
): Promise<MonthlyInvoicePdfResult> {
  const { data: stmt, error: stmtError } = await admin
    .from("monthly_statements")
    .select("id, status, pdf_document_file_id")
    .eq("id", statementId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  if (stmtError) return fail("persistence_error");

  const pointer = stmt?.pdf_document_file_id as string | null | undefined;
  if (pointer) return signVerifiedArtifact(admin, dealerId, statementId, pointer);

  // Winner inserted its active row but has not attached yet: converge by attaching it.
  const { data: winnerRow, error: winnerError } = await admin
    .from("document_files")
    .select("id, dealer_id, document_type, document_id, file_path, mime_type, status")
    .eq("dealer_id", dealerId)
    .eq("document_type", "monthly_invoice")
    .eq("document_id", statementId)
    .eq("status", "active")
    .maybeSingle();
  if (winnerError) return fail("persistence_error");
  if (!winnerRow?.id) return fail("conflict");

  const resolution = resolveSignableMonthlyArtifact({
    dealerId,
    statementId,
    rowId: winnerRow.id as string,
    rowDealerId: winnerRow.dealer_id as string,
    rowDocumentType: winnerRow.document_type as string,
    rowDocumentId: winnerRow.document_id as string,
    rowStatus: winnerRow.status as string,
    rowMimeType: winnerRow.mime_type as string,
    rowFilePath: winnerRow.file_path as string,
  });
  if (resolution.kind !== "resolved") return fail("persistence_error");

  const existence = await probeObjectExistence(admin, resolution.filePath);
  const decision = decidePointedArtifact(existence);
  if (decision === "operator_attention") return fail("artifact_missing");
  if (decision === "retry_required") return fail("storage_error");

  const { error: attachError } = await admin.rpc("attach_monthly_statement_pdf_rpc", {
    p_dealer_id: dealerId,
    p_statement_id: statementId,
    p_document_file_id: winnerRow.id as string,
  });
  if (attachError) {
    if (isPointerConflict(attachError.message)) {
      // Someone attached between our reads: exactly ONE dealer-scoped statement re-read,
      // then sign the now-pointed winner.
      const { data: reread, error: rereadError } = await admin
        .from("monthly_statements")
        .select("pdf_document_file_id")
        .eq("id", statementId)
        .eq("dealer_id", dealerId)
        .maybeSingle();
      if (rereadError) return fail("persistence_error");
      const nowPointed = reread?.pdf_document_file_id as string | null | undefined;
      if (!nowPointed) return fail("conflict");
      return signVerifiedArtifact(admin, dealerId, statementId, nowPointed);
    }
    if (isStatementNotIssued(attachError.message)) return fail("conflict");
    return fail("persistence_error");
  }

  return signVerifiedArtifact(admin, dealerId, statementId, winnerRow.id as string);
}

export async function ensureMonthlyInvoicePdf(statementId: string): Promise<MonthlyInvoicePdfResult> {
  // ── authorization + scope gate (BEFORE any admin authority exists) ─────────
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return fail("validation_error");
  const dealerId = auth.dealerId;

  if (typeof statementId !== "string" || statementId.trim() === "") return fail("validation_error");

  const supabase = await createClient();
  const { data: statementRow, error: statementError } = await supabase
    .from("monthly_statements")
    .select("*")
    .eq("id", statementId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  if (statementError) return fail("persistence_error");
  if (!statementRow) return fail("validation_error");
  const statement = statementRow as MonthlyStatementDB;
  if (statement.status !== "issued") return fail("validation_error");

  const admin = createAdminClient();

  // ── pointed artifact: validate → exists → sign; zero renders ───────────────
  if (statement.pdf_document_file_id) {
    return signVerifiedArtifact(admin, dealerId, statementId, statement.pdf_document_file_id);
  }

  // ── unpointed active candidate: validate → exists → attach | cleanup ───────
  const { data: candidate, error: candidateError } = await admin
    .from("document_files")
    .select("id, dealer_id, document_type, document_id, file_path, mime_type, status")
    .eq("dealer_id", dealerId)
    .eq("document_type", "monthly_invoice")
    .eq("document_id", statementId)
    .eq("status", "active")
    .maybeSingle();
  if (candidateError) return fail("persistence_error");

  if (candidate?.id) {
    const candidateId = candidate.id as string;
    const candidatePath = candidate.file_path as string;
    const resolution = resolveSignableMonthlyArtifact({
      dealerId,
      statementId,
      rowId: candidateId,
      rowDealerId: candidate.dealer_id as string,
      rowDocumentType: candidate.document_type as string,
      rowDocumentId: candidate.document_id as string,
      rowStatus: candidate.status as string,
      rowMimeType: candidate.mime_type as string,
      rowFilePath: candidatePath,
    });
    // An active monthly row that fails canonical validation cannot be attached and blocks the
    // unique slot — the guard should make this unreachable; surface it for the operator.
    if (resolution.kind !== "resolved") return fail("persistence_error");

    const existence = await probeObjectExistence(admin, resolution.filePath);
    const decision = decideUnpointedCandidate(existence);

    if (decision === "retry_required") return fail("storage_error");

    if (decision === "attach") {
      const { error: attachError } = await admin.rpc("attach_monthly_statement_pdf_rpc", {
        p_dealer_id: dealerId,
        p_statement_id: statementId,
        p_document_file_id: candidateId,
      });
      if (attachError) {
        if (isPointerConflict(attachError.message)) {
          // The pointer already names a DIFFERENT artifact: this candidate lost and its row
          // and object are now permanent orphans. Compensate the LOSER's own state only, in
          // the accepted row-first order: delete exactly this row (id + dealer_id, exactly
          // one returned row), and only after that proven deletion remove its object.
          const { data: deletedRows, error: deleteError } = await admin
            .from("document_files")
            .delete()
            .eq("id", candidateId)
            .eq("dealer_id", dealerId)
            .select("id");
          if (deleteError || (deletedRows?.length ?? 0) !== 1) return fail("cleanup_failed");
          const { error: removeError } = await admin.storage.from("documents").remove([candidatePath]);
          if (removeError) return fail("cleanup_failed");
          return resolveRaceWinner(admin, dealerId, statementId);
        }
        if (isStatementNotIssued(attachError.message)) return fail("conflict");
        return fail("persistence_error");
      }
      return signVerifiedArtifact(admin, dealerId, statementId, candidateId);
    }

    // decision === "cleanup_then_render": CONFIRMED byteless stale row — delete EXACTLY that
    // unreferenced row (id + dealer_id) and render fresh only after the cleanup succeeds.
    const { data: deleted, error: deleteError } = await admin
      .from("document_files")
      .delete()
      .eq("id", candidateId)
      .eq("dealer_id", dealerId)
      .select("id");
    if (deleteError || (deleted?.length ?? 0) !== 1) return fail("cleanup_failed");
  }

  // ── no artifact: render once → immutable upload → record → attach → sign ───
  const [linesRes, receiptsRes, adjustmentsRes] = [
    await admin
      .from("monthly_statement_lines")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("statement_id", statementId),
    await admin
      .from("monthly_statement_receipts")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("statement_id", statementId),
    await admin
      .from("monthly_statement_adjustments")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("statement_id", statementId),
  ];
  if (linesRes.error || receiptsRes.error || adjustmentsRes.error) return fail("persistence_error");

  let buffer: Buffer;
  try {
    const brand = await getBrandProfile(dealerId);
    // The byte-frozen accepted renderer re-proves the closing/reconciliation formulas and every
    // row identity before anything renders (fail-closed adapter).
    buffer = await renderMonthlyInvoiceDocumentPdf(
      {
        statement,
        lines: (linesRes.data ?? []) as MonthlyStatementLineDB[],
        receipts: (receiptsRes.data ?? []) as MonthlyStatementReceiptDB[],
        adjustments: (adjustmentsRes.data ?? []) as MonthlyStatementAdjustmentDB[],
      },
      brand,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Adapter refusals are data-integrity failures, not transient render hiccups.
    return fail(message.startsWith("monthly-invoice-document:") ? "validation_error" : "render_error");
  }

  const documentFileId = randomUUID();
  const filePath = buildMonthlyInvoiceObjectKey(dealerId, statementId, documentFileId);

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(filePath, buffer, {
      contentType: MONTHLY_INVOICE_CONTENT_TYPE,
      upsert: false, // immutable: an existing key must never be replaced
    });
  if (uploadError) return fail("storage_error");

  /**
   * Loser/failure compensation for THIS attempt's own state, row-first: delete exactly our
   * document row (id + dealer_id, exactly one returned row proves the deletion), and only
   * after that proven deletion remove our object — bytes are never removed while the row
   * may still exist. Reports "incomplete" (→ cleanup_failed) instead of hiding orphans.
   */
  async function compensateOwnArtifact(rowInserted: boolean): Promise<"clean" | "incomplete"> {
    if (rowInserted) {
      const { data: deletedRows, error: deleteError } = await admin
        .from("document_files")
        .delete()
        .eq("id", documentFileId)
        .eq("dealer_id", dealerId)
        .select("id");
      if (deleteError || (deletedRows?.length ?? 0) !== 1) return "incomplete";
    }
    const { error: removeError } = await admin.storage.from("documents").remove([filePath]);
    return removeError ? "incomplete" : "clean";
  }

  const { error: insertError } = await admin.from("document_files").insert({
    id: documentFileId,
    dealer_id: dealerId,
    document_type: "monthly_invoice",
    document_id: statementId,
    file_name: `monthly-invoice-${statement.statement_number ?? statementId}.pdf`,
    file_path: filePath,
    public_url: null,
    signed_url_expires_at: null,
    file_size: buffer.byteLength,
    mime_type: MONTHLY_INVOICE_CONTENT_TYPE,
    status: "active",
  });

  if (insertError) {
    if (isActiveArtifactUniqueViolation(insertError.code)) {
      // Race loser on the active-artifact unique index: this attempt owns NO row, so the only
      // compensation is removing its own just-uploaded object; then resolve the winner once.
      if ((await compensateOwnArtifact(false)) !== "clean") return fail("cleanup_failed");
      return resolveRaceWinner(admin, dealerId, statementId);
    }
    if ((await compensateOwnArtifact(false)) !== "clean") return fail("cleanup_failed");
    return fail("persistence_error");
  }

  const { error: attachError } = await admin.rpc("attach_monthly_statement_pdf_rpc", {
    p_dealer_id: dealerId,
    p_statement_id: statementId,
    p_document_file_id: documentFileId,
  });

  if (attachError) {
    if (isPointerConflict(attachError.message)) {
      // Pointer already names a different artifact: tear down ONLY this loser's own row and
      // object (row-first, deletion proven before bytes are removed), then resolve the winner.
      if ((await compensateOwnArtifact(true)) !== "clean") return fail("cleanup_failed");
      return resolveRaceWinner(admin, dealerId, statementId);
    }
    if ((await compensateOwnArtifact(true)) !== "clean") return fail("cleanup_failed");
    return fail(isStatementNotIssued(attachError.message) ? "conflict" : "persistence_error");
  }

  // The artifact is persisted and pointed; signing failures must never re-render or roll back.
  return signVerifiedArtifact(admin, dealerId, statementId, documentFileId);
}

/**
 * Download-only path: never renders, never uploads, never attaches, never persists a URL.
 * Chain: finance gate → RLS scope read → canonical pointed-row validation → exists → sign.
 */
export async function getMonthlyInvoicePdfUrl(statementId: string): Promise<MonthlyInvoicePdfResult> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return fail("validation_error");
  const dealerId = auth.dealerId;

  if (typeof statementId !== "string" || statementId.trim() === "") return fail("validation_error");

  const supabase = await createClient();
  const { data: statement, error: statementError } = await supabase
    .from("monthly_statements")
    .select("id, status, pdf_document_file_id")
    .eq("id", statementId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  if (statementError) return fail("persistence_error");
  if (!statement) return fail("validation_error");

  // Issued statements download their artifact; a voided statement keeps its historical
  // artifact downloadable. A statement without a pointer has nothing to download.
  if (statement.status !== "issued" && statement.status !== "voided") return fail("validation_error");
  const pointer = statement.pdf_document_file_id as string | null;
  if (!pointer) return fail("validation_error");

  const admin = createAdminClient();
  return signVerifiedArtifact(admin, dealerId, statementId, pointer);
}
