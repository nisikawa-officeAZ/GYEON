import "server-only";

// R92B Phase 2 — resolves a PUBLIC share token to a servable PDF, or to one
// indistinguishable "unavailable".
//
// Thin server-only wrapper used by the unauthenticated `/s/e/[token]` page and
// file route. It validates the token SHAPE before any DB access, looks the share
// up by `token_hash` (never the raw token) with the admin client, and delegates
// every accept/reject DECISION to the pure `resolveShareDecision`. Revoked,
// expired, cross-tenant, deleted-document and unknown-token all collapse to the
// same `unavailable`, so an outsider cannot probe which case they hit.

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidShareTokenShape, shareTokenHash, resolveShareDecision } from "./estimate-share-core";

export type ResolvedShare =
  | { kind: "available"; filePath: string; fileName: string }
  | { kind: "unavailable" };

export async function resolveEstimateShare(rawToken: string): Promise<ResolvedShare> {
  // §3 — the exact 43-char base64url shape is proved BEFORE the query runs, so a
  // malformed token never reaches the database.
  if (!isValidShareTokenShape(rawToken)) return { kind: "unavailable" };

  const admin = createAdminClient();

  const { data: share } = await admin
    .from("estimate_shares")
    .select("id, dealer_id, estimate_id, document_file_id, revoked_at, expires_at")
    .eq("token_hash", shareTokenHash(rawToken))
    .maybeSingle();

  let documentFile: {
    id: string;
    dealer_id: string;
    document_type: string;
    document_id: string;
    status: string;
    file_path: string;
    file_name: string;
  } | null = null;

  if (share) {
    const { data: doc } = await admin
      .from("document_files")
      .select("id, dealer_id, document_type, document_id, status, file_path, file_name")
      .eq("id", share.document_file_id)
      .maybeSingle();
    documentFile = doc;
  }

  return resolveShareDecision({
    nowMs: Date.now(),
    share: share
      ? {
          id: share.id,
          dealerId: share.dealer_id,
          estimateId: share.estimate_id,
          documentFileId: share.document_file_id,
          revokedAt: share.revoked_at,
          expiresAt: share.expires_at,
        }
      : null,
    documentFile: documentFile
      ? {
          id: documentFile.id,
          dealerId: documentFile.dealer_id,
          documentType: documentFile.document_type,
          documentId: documentFile.document_id,
          status: documentFile.status,
          filePath: documentFile.file_path,
          fileName: documentFile.file_name,
        }
      : null,
  });
}

/** Download the immutable snapshot bytes for a resolved, available share. */
export async function downloadSharedPdfBytes(filePath: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documents").download(filePath);
  if (error || !data) {
    if (error) console.error("[estimate share] download failed:", error.message);
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
