import "server-only";

// R92B Phase 2 — orchestrates creation of a revocable, tokenized estimate share.
//
// Thin server-only wrapper. Every DECISION (URL validity, token shape/hash,
// cross-table authority, compensation) lives in the pure `estimate-share-core`;
// this file only resolves the session, performs I/O in the ratified order, and
// runs the compensations the core prescribes. The raw token exists ONLY in the
// returned in-memory URL — never a column, log, or error.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { generateEstimateSnapshotPdf } from "@/lib/pdf/generate-estimate-snapshot-pdf";
import {
  resolveAppOrigin,
  buildShareUrl,
  generateShareToken,
  shareTokenHash,
  checkShareCreateAuthority,
} from "./estimate-share-core";
import type { CreateShareOutcome } from "./estimate-share-types";

/** Shares live for 7 days, matching the download signed-URL horizon. */
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createEstimateShare(estimateId: string): Promise<CreateShareOutcome> {
  // §6 — an invalid/missing canonical app URL fails BEFORE any side effect, so a
  // misconfigured deployment never leaves an orphaned snapshot behind.
  const origin = resolveAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === "production",
  );
  if (origin.kind !== "ok") return { kind: "pdf-unavailable", reason: "invalid-app-url" };

  const dealer = await getCurrentDealer();
  if (!dealer) return { kind: "pdf-unavailable", reason: "reference-integrity-failed" };
  const user = await getCurrentUser();

  const admin = createAdminClient();

  // Dealer-scoped estimate row for the authority proof (admin bypasses RLS, so
  // the tenant predicate is explicit and mandatory).
  const { data: estimateRow } = await admin
    .from("estimates")
    .select("id, dealer_id")
    .eq("id", estimateId)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!estimateRow) return { kind: "pdf-unavailable", reason: "reference-integrity-failed" };

  // Render + immutable upload + document_files insert (self-compensating on its
  // own failures).
  const snapshot = await generateEstimateSnapshotPdf(dealer.dealer_id, estimateId);
  if (snapshot.kind === "failed") return { kind: "pdf-unavailable", reason: snapshot.reason };

  const { data: docRow } = await admin
    .from("document_files")
    .select("id, dealer_id, document_type, document_id, status")
    .eq("id", snapshot.documentFileId)
    .maybeSingle();

  const authority = checkShareCreateAuthority({
    dealerId: dealer.dealer_id,
    estimateId,
    documentFileId: snapshot.documentFileId,
    estimate: { id: estimateRow.id, dealerId: estimateRow.dealer_id },
    documentFile: docRow
      ? {
          id: docRow.id,
          dealerId: docRow.dealer_id,
          documentType: docRow.document_type,
          documentId: docRow.document_id,
          status: docRow.status,
        }
      : null,
  });
  if (authority.kind !== "ok") {
    // Defense-in-depth: an inconsistent snapshot row is archived (object kept).
    await admin
      .from("document_files")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", snapshot.documentFileId);
    return { kind: "pdf-unavailable", reason: "reference-integrity-failed" };
  }

  const rawToken = generateShareToken();
  const tokenHash = shareTokenHash(rawToken);
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const { data: shareRow, error: shareErr } = await admin
    .from("estimate_shares")
    .insert({
      dealer_id: dealer.dealer_id,
      estimate_id: estimateId,
      document_file_id: snapshot.documentFileId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user?.id ?? null,
    })
    .select("id, expires_at")
    .single();

  if (shareErr || !shareRow) {
    // §5 compensation for a failed share-create: archive the orphan row.
    await admin
      .from("document_files")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", snapshot.documentFileId);
    console.error("[estimate share] insert failed:", shareErr?.message ?? "unknown");
    return { kind: "pdf-unavailable", reason: "share-create-failed" };
  }

  return {
    kind: "created",
    share: {
      url: buildShareUrl(origin.origin, rawToken),
      shareId: shareRow.id,
      documentFileId: snapshot.documentFileId,
      expiresAt: shareRow.expires_at,
    },
  };
}
