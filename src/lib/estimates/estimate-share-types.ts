// R92B Phase 2 — shared types for the estimate-share lifecycle.
//
// Pure types file — no directive, no imports with side effects — so it is
// importable from both the pure core and the server-only wrappers.

/** The customer-safe projection returned to the client for the revoke UI. */
export interface EstimateShareListItem {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/** Why a PDF-link send could not produce a share. Every literal is closed. */
export type PdfUnavailableReason =
  | "invalid-app-url"
  | "pdf-generation-failed"
  | "document-persist-failed"
  | "share-create-failed"
  | "reference-integrity-failed";

/** A created share, carried transiently in memory only. Never persisted whole. */
export interface EstimateShareContext {
  /** `${origin}/s/e/<rawToken>` — the raw token lives ONLY here, in memory. */
  readonly url: string;
  readonly shareId: string;
  readonly documentFileId: string;
  readonly expiresAt: string;
}

/** Outcome of the server-only share-creation orchestration. */
export type CreateShareOutcome =
  | { readonly kind: "created"; readonly share: EstimateShareContext }
  | { readonly kind: "pdf-unavailable"; readonly reason: PdfUnavailableReason };
