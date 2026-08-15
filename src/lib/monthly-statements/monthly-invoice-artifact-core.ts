// B1B-E3 — pure decision core for the immutable monthly-invoice PDF artifact.
//
// No I/O, no Supabase, no Storage: every canonical-key, artifact-validation, existence-
// classification, and race/cleanup decision lives here so the server action stays a thin
// orchestrator and every branch is unit-provable without a backend.
//
// The canonical object key is the ONE accepted shape the M1 database contract validates
// in-trigger and in-RPC:  <dealer>/monthly_invoice/issued/<statement>/<documentFileId>.pdf

export const MONTHLY_INVOICE_CONTENT_TYPE = "application/pdf";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildMonthlyInvoiceObjectKey(
  dealerId: string,
  statementId: string,
  documentFileId: string,
): string {
  return `${dealerId}/monthly_invoice/issued/${statementId}/${documentFileId}.pdf`;
}

export interface MonthlyInvoiceObjectPointer {
  dealerId: string;
  statementId: string;
  documentFileId: string;
}

/** Strict canonical-key parse: exactly five segments, UUID-shaped ids, .pdf suffix. */
export function parseMonthlyInvoiceObjectKey(
  path: string | null | undefined,
): MonthlyInvoiceObjectPointer | null {
  if (typeof path !== "string") return null;
  const segments = path.split("/");
  if (segments.length !== 5) return null;
  const [dealerId, ns, issued, statementId, fileName] = segments;
  if (ns !== "monthly_invoice" || issued !== "issued") return null;
  if (!fileName.endsWith(".pdf")) return null;
  const documentFileId = fileName.slice(0, -".pdf".length);
  if (!UUID_RE.test(dealerId) || !UUID_RE.test(statementId) || !UUID_RE.test(documentFileId)) {
    return null;
  }
  return { dealerId, statementId, documentFileId };
}

export type MonthlyArtifactResolution =
  | { kind: "resolved"; filePath: string }
  | { kind: "unsignable" };

/**
 * The ONE artifact row a statement may expose. Mirrors the accepted invoice discipline:
 * a stored path is never trusted on its own — the row must be the dealer's own ACTIVE
 * monthly_invoice PDF row for THIS statement whose file_path is the canonical key rebuilt
 * from the dealer, the statement and the row's OWN id.
 */
export function resolveSignableMonthlyArtifact(input: {
  dealerId: string;
  statementId: string;
  rowId: string | null | undefined;
  rowDealerId: string | null | undefined;
  rowDocumentType: string | null | undefined;
  rowDocumentId: string | null | undefined;
  rowStatus: string | null | undefined;
  rowMimeType: string | null | undefined;
  rowFilePath: string | null | undefined;
}): MonthlyArtifactResolution {
  const { dealerId, statementId, rowId } = input;
  if (!rowId || !UUID_RE.test(rowId)) return { kind: "unsignable" };
  if (input.rowDealerId !== dealerId) return { kind: "unsignable" };
  if (input.rowDocumentType !== "monthly_invoice") return { kind: "unsignable" };
  if (input.rowDocumentId !== statementId) return { kind: "unsignable" };
  if (input.rowStatus !== "active") return { kind: "unsignable" };
  if (input.rowMimeType !== MONTHLY_INVOICE_CONTENT_TYPE) return { kind: "unsignable" };
  const canonical = buildMonthlyInvoiceObjectKey(dealerId, statementId, rowId);
  if (input.rowFilePath !== canonical) return { kind: "unsignable" };
  return { kind: "resolved", filePath: canonical };
}

// ─── Storage existence-probe taxonomy (E3-A1-R2) ─────────────────────────────
//
// The installed storage-js exists() resolves {data:true,error:null} on success, resolves
// {data:false,error} ONLY for HTTP 400/404, and THROWS everything else. The classifier
// re-proves that shape explicitly — never a truthiness check — so 401/403/5xx/network/
// timeout/unknown/malformed outcomes can never masquerade as a confirmed-missing object.

export type ExistenceProbeOutcome =
  | { kind: "resolved"; data: unknown; error: unknown }
  | { kind: "thrown"; error: unknown };

export type ExistenceClassification = "present" | "confirmed_missing" | "probe_unavailable";

function storageErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const direct = (error as { status?: unknown }).status;
  if (typeof direct === "number") return direct;
  const original = (error as { originalError?: unknown }).originalError;
  if (typeof original === "object" && original !== null) {
    const nested = (original as { status?: unknown }).status;
    if (typeof nested === "number") return nested;
  }
  return undefined;
}

export function classifyExistenceProbe(outcome: ExistenceProbeOutcome): ExistenceClassification {
  if (outcome.kind === "thrown") return "probe_unavailable";
  const { data, error } = outcome;
  if (data === true && error === null) return "present";
  if (data === false && typeof error === "object" && error !== null) {
    const status = storageErrorStatus(error);
    if (status === 400 || status === 404) return "confirmed_missing";
  }
  // Every other resolved shape is malformed — proves nothing about the bytes.
  return "probe_unavailable";
}

// ─── branch decisions by classification ──────────────────────────────────────

/** Pointed artifact (and race-winner resolution): the pointer is immutable either way. */
export type PointedArtifactDecision = "sign" | "operator_attention" | "retry_required";

export function decidePointedArtifact(c: ExistenceClassification): PointedArtifactDecision {
  if (c === "present") return "sign";
  if (c === "confirmed_missing") return "operator_attention";
  return "retry_required";
}

/** Unpointed active candidate row: only a CONFIRMED missing object may trigger cleanup. */
export type UnpointedCandidateDecision = "attach" | "cleanup_then_render" | "retry_required";

export function decideUnpointedCandidate(c: ExistenceClassification): UnpointedCandidateDecision {
  if (c === "present") return "attach";
  if (c === "confirmed_missing") return "cleanup_then_render";
  return "retry_required";
}

// ─── race detection ──────────────────────────────────────────────────────────

/** The active-artifact unique index (dealer_id, document_id) WHERE monthly_invoice+active. */
export function isActiveArtifactUniqueViolation(code: string | null | undefined): boolean {
  return code === "23505";
}

/** The attach RPC's existing-different-pointer rejection. */
export function isPointerConflict(message: string | null | undefined): boolean {
  return message === "monthly_pdf_pointer_conflict";
}

/** The attach RPC's voided/withdrawn rejection. */
export function isStatementNotIssued(message: string | null | undefined): boolean {
  return message === "monthly_pdf_statement_not_issued";
}

// ─── outcome vocabulary ──────────────────────────────────────────────────────

export type MonthlyArtifactOutcomeKind =
  | "ready"
  | "validation_error"
  | "conflict"
  | "artifact_missing"
  | "storage_error"
  | "render_error"
  | "persistence_error"
  | "cleanup_failed";

export function describeMonthlyArtifactOutcome(kind: MonthlyArtifactOutcomeKind): string {
  switch (kind) {
    case "ready":             return "PDFを準備しました";
    case "validation_error":  return "PDFを作成できる状態ではありません";
    case "conflict":          return "月次請求書の状態が変更されました。画面を更新してください";
    case "artifact_missing":  return "PDFデータに不整合があります。管理者に連絡してください（再試行では解決しません）";
    case "storage_error":     return "ストレージに接続できませんでした。時間をおいて再試行してください";
    case "render_error":      return "PDFの生成に失敗しました。再試行してください";
    case "persistence_error": return "PDFの保存に失敗しました。再試行してください";
    case "cleanup_failed":    return "PDF処理の後始末に失敗しました。管理者に連絡してください";
  }
}
