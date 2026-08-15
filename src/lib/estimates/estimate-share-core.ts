// R92B Phase 2 — the pure decision core for the estimate-share lifecycle.
//
// ── WHY THIS FILE IS PURE ───────────────────────────────────────────────────
// The wrappers that drive it (`create-estimate-share.ts`, `resolve-estimate-
// share.ts`, `generate-estimate-snapshot-pdf.ts`, `estimate-share-actions.ts`)
// all open with `import "server-only"`, which is UNRESOLVABLE under
// `node --import tsx --test` (it is a devDependency of Next, absent from
// node_modules). So every substantive decision — URL validity, token shape and
// hashing, cross-table authority, public-resolution rules, the immutable
// snapshot path, and the compensation ordering — lives HERE and is executed
// directly by the tests. The wrappers only load rows, perform I/O, and delegate.
//
// No "use server", no server-only, no React, no Supabase, no environment, no
// fetch. `node:crypto` is a builtin (resolvable under tsx) used for hashing and
// CSPRNG token bytes; time is always injected, never read from `Date` here.

import { createHash, randomBytes } from "node:crypto";

// ── Canonical share URL (§6) ────────────────────────────────────────────────

export type AppOriginResult =
  | { readonly kind: "ok"; readonly origin: string }
  | { readonly kind: "invalid-app-url" };

/**
 * Resolve the canonical origin from the app-URL env value ALONE.
 *
 * Sole authority is the caller-supplied `rawEnv` (from
 * `process.env.NEXT_PUBLIC_APP_URL`). There is NO Host / forwarded-host /
 * VERCEL_URL / implicit-localhost fallback — a missing or unparseable value
 * fails closed. Parsing is via the URL API, never string work. In production
 * the scheme MUST be https; in development http://localhost is allowed.
 */
export function resolveAppOrigin(rawEnv: string | undefined | null, isProduction: boolean): AppOriginResult {
  if (typeof rawEnv !== "string" || rawEnv.trim() === "") return { kind: "invalid-app-url" };
  let url: URL;
  try {
    url = new URL(rawEnv.trim());
  } catch {
    return { kind: "invalid-app-url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "invalid-app-url" };
  if (isProduction && url.protocol !== "https:") return { kind: "invalid-app-url" };
  if (!isProduction && url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    // dev may use http ONLY for localhost.
    return { kind: "invalid-app-url" };
  }
  return { kind: "ok", origin: url.origin };
}

/** Build the public share URL. The raw token is a URL path segment only. */
export function buildShareUrl(origin: string, rawToken: string): string {
  return `${origin}/s/e/${rawToken}`;
}

// ── Token: 256-bit CSPRNG, base64url, SHA-256 persistence (§3) ───────────────

export const SHARE_TOKEN_BYTES = 32; // 256 bits
/** base64url of 32 bytes is exactly 43 chars (no padding). AUTHORITATIVE length —
 *  the client-safe LINE message-length accounting keeps its own literal (this
 *  module imports node:crypto and must stay out of client bundles); a drift test
 *  asserts the two agree. */
export const SHARE_TOKEN_LENGTH = 43;
const SHARE_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Generate a fresh raw token from the server CSPRNG. Returned in memory only. */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

/** The exact public-token shape, validated BEFORE any DB access. */
export function isValidShareTokenShape(token: unknown): boolean {
  return typeof token === "string" && SHARE_TOKEN_SHAPE.test(token);
}

/** SHA-256 hex of the raw token — the ONLY thing ever persisted. */
export function shareTokenHash(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ── Cross-table create authority (§4/§5) ────────────────────────────────────

export interface ShareCreateAuthorityInput {
  readonly dealerId: string;
  readonly estimateId: string;
  readonly documentFileId: string;
  /** The dealer-scoped estimate row, or null if not this dealer's. */
  readonly estimate: { readonly id: string; readonly dealerId: string } | null;
  /** The freshly-created document_files row, or null. */
  readonly documentFile: {
    readonly id: string;
    readonly dealerId: string;
    readonly documentType: string;
    readonly documentId: string;
    readonly status: string;
  } | null;
}

export type ShareCreateAuthorityResult =
  | { readonly kind: "ok" }
  | { readonly kind: "reference-integrity-failed" };

/**
 * Prove every relationship before an estimate_shares row is inserted. The admin
 * client bypasses RLS, so each predicate is explicit and mandatory.
 */
export function checkShareCreateAuthority(input: ShareCreateAuthorityInput): ShareCreateAuthorityResult {
  const { dealerId, estimateId, documentFileId, estimate, documentFile } = input;
  if (!estimate) return { kind: "reference-integrity-failed" };
  if (estimate.id !== estimateId) return { kind: "reference-integrity-failed" };
  if (estimate.dealerId !== dealerId) return { kind: "reference-integrity-failed" };
  if (!documentFile) return { kind: "reference-integrity-failed" };
  if (documentFile.id !== documentFileId) return { kind: "reference-integrity-failed" };
  if (documentFile.dealerId !== dealerId) return { kind: "reference-integrity-failed" };
  if (documentFile.documentType !== "estimate") return { kind: "reference-integrity-failed" };
  if (documentFile.documentId !== estimateId) return { kind: "reference-integrity-failed" };
  if (documentFile.status !== "active") return { kind: "reference-integrity-failed" };
  return { kind: "ok" };
}

// ── Public resolution (§4/§1) ───────────────────────────────────────────────

export interface ShareResolutionInput {
  readonly nowMs: number;
  /** The estimate_shares row matched by token_hash, or null. */
  readonly share: {
    readonly id: string;
    readonly dealerId: string;
    readonly estimateId: string;
    readonly documentFileId: string;
    readonly revokedAt: string | null;
    readonly expiresAt: string;
  } | null;
  /** The referenced document_files row, or null. */
  readonly documentFile: {
    readonly id: string;
    readonly dealerId: string;
    readonly documentType: string;
    readonly documentId: string;
    readonly status: string;
    readonly filePath: string;
    readonly fileName: string;
  } | null;
}

export type ShareResolutionResult =
  | { readonly kind: "available"; readonly filePath: string; readonly fileName: string }
  /** Every failure collapses to ONE indistinguishable answer (§10). */
  | { readonly kind: "unavailable" };

/**
 * Decide whether a share resolves. Every inconsistency — missing rows, revoked,
 * expired, cross-table mismatch, deleted document — yields the SAME `unavailable`
 * so an outsider cannot distinguish the reason. Document status `active` OR
 * `archived` is accepted (an ordinary PDF regeneration archives the row without
 * breaking a live share); `deleted` is unavailable.
 */
export function resolveShareDecision(input: ShareResolutionInput): ShareResolutionResult {
  const { nowMs, share, documentFile } = input;
  if (!share) return { kind: "unavailable" };
  if (share.revokedAt !== null) return { kind: "unavailable" };
  const expiresMs = Date.parse(share.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return { kind: "unavailable" };
  if (!documentFile) return { kind: "unavailable" };
  if (documentFile.id !== share.documentFileId) return { kind: "unavailable" };
  if (documentFile.dealerId !== share.dealerId) return { kind: "unavailable" };
  if (documentFile.documentType !== "estimate") return { kind: "unavailable" };
  if (documentFile.documentId !== share.estimateId) return { kind: "unavailable" };
  if (documentFile.status !== "active" && documentFile.status !== "archived") return { kind: "unavailable" };
  return { kind: "available", filePath: documentFile.filePath, fileName: documentFile.fileName };
}

// ── Active-share list projection (§4/§8) ────────────────────────────────────

/** True iff the row is currently deliverable (non-revoked, non-expired). */
export function isShareActive(row: { revokedAt: string | null; expiresAt: string }, nowMs: number): boolean {
  if (row.revokedAt !== null) return false;
  const expiresMs = Date.parse(row.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

/** The EXACT safe projection. No token_hash, no document_file_id, no path. */
export function toShareListItem(row: { id: string; createdAt: string; expiresAt: string }): EstimateShareListItemLocal {
  return { id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt };
}
// Local alias to avoid a cross-file import cycle in the pure core; identical shape
// to EstimateShareListItem in estimate-share-types.ts.
export interface EstimateShareListItemLocal {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

// ── Immutable snapshot path (§5) ────────────────────────────────────────────

/** The file name is the server-generated documentFileId — never client input. */
export function buildSnapshotFileName(documentFileId: string): string {
  return `${documentFileId}.pdf`;
}

/**
 * A UNIQUE immutable path derived only from server values. Distinct from the
 * mutable `{dealer}/{type}/{number}.pdf` upsert path, so a share snapshot is
 * never overwritten by an ordinary regeneration.
 */
export function buildSnapshotStoragePath(dealerId: string, estimateId: string, documentFileId: string): string {
  return `${dealerId}/estimate/shares/${estimateId}/${buildSnapshotFileName(documentFileId)}`;
}

// ── Compensation ordering (§5) ──────────────────────────────────────────────

export type SnapshotStage = "uploaded" | "document-persisted";

/**
 * What to undo when share creation fails after a given stage, and which
 * `pdf-unavailable` reason to surface. Pure decision — the wrapper performs the
 * described I/O.
 */
export function compensationFor(
  failedStage: "upload" | "document-persist" | "share-create",
): {
  readonly deleteObject: boolean;
  readonly archiveDocumentRow: boolean;
  readonly reason: PdfUnavailableReason;
} {
  switch (failedStage) {
    case "upload":
      return { deleteObject: false, archiveDocumentRow: false, reason: "pdf-generation-failed" };
    case "document-persist":
      // The object was written but no row references it → delete the orphan.
      return { deleteObject: true, archiveDocumentRow: false, reason: "document-persist-failed" };
    case "share-create":
      // The row exists but no share references it → archive the row, keep object.
      return { deleteObject: false, archiveDocumentRow: true, reason: "share-create-failed" };
  }
}

import type { PdfUnavailableReason } from "./estimate-share-types";
