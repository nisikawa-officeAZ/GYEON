// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — pure issuance contract.
//
// Every decision that must be reasoned about — which edits are still allowed,
// which status transitions are legal, what the immutable object key looks like,
// and what has to be undone when a step fails — lives here as plain functions.
//
// IMPORT-SAFE BY CONSTRUCTION: no React, no server-only, no Supabase client, no
// environment access, no network. Time and identifiers are injected so tests are
// deterministic.

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

/**
 * Columns frozen the moment an invoice leaves draft. Mirrors the database
 * trigger in 20260801132658_invoice_issued_immutability.sql — the two must stay
 * in step, which the boundary test asserts.
 */
export const INVOICE_COMMERCIAL_FIELDS = [
  "dealer_id",
  "customer_id",
  "vehicle_id",
  "estimate_id",
  "work_order_id",
  "completion_report_id",
  "invoice_number",
  "title",
  "issue_date",
  "due_date",
  "subtotal",
  "discount_amount",
  "tax_rate",
  "tax_amount",
  "total",
  "notes",
  "pdf_file_path",
  "pdf_file_url",
] as const;

/** Money movement and internal notes stay editable after issuance. */
export const INVOICE_POST_ISSUE_MUTABLE_FIELDS = [
  "paid_amount",
  "balance_due",
  "internal_memo",
  "status",
  "updated_at",
] as const;

/** Lifecycle states an already-committed invoice may still move between. */
export const POST_ISSUE_STATUSES: readonly InvoiceStatus[] = [
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

export function isDraft(status: string | null | undefined): boolean {
  return status === "draft";
}

/** Commercial edits and line-item changes are a draft-only privilege. */
export function canEditCommercialFields(status: string | null | undefined): boolean {
  return isDraft(status);
}

/** Payments belong to a real document; a draft has not been sent to anyone. */
export function canRecordPayment(status: string | null | undefined): boolean {
  return !isDraft(status) && status !== "cancelled";
}

export type TransitionDecision =
  | { readonly kind: "allowed" }
  | { readonly kind: "rejected"; readonly reason: string };

/**
 * The only transitions the system recognises. Issuance itself is deliberately
 * NOT reachable from here — it is owned by issueInvoice, which must produce the
 * artifact first.
 */
export function evaluateStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined
): TransitionDecision {
  if (from === to) return { kind: "allowed" };

  if (to === "draft") {
    return { kind: "rejected", reason: "invoice_cannot_return_to_draft" };
  }

  if (isDraft(from)) {
    // A draft may only be issued (through issueInvoice) or abandoned.
    if (to === "issued" || to === "cancelled") return { kind: "allowed" };
    return { kind: "rejected", reason: "invoice_invalid_draft_transition" };
  }

  if (!POST_ISSUE_STATUSES.includes(to as InvoiceStatus)) {
    return { kind: "rejected", reason: "invoice_invalid_lifecycle_transition" };
  }

  return { kind: "allowed" };
}

/** A client may never hand us a status; issuance and payment own that field. */
export function rejectsClientStatusSelection(requested: string | null | undefined): boolean {
  return requested !== null && requested !== undefined && requested !== "";
}

export type EditDecision =
  | { readonly kind: "allowed" }
  | { readonly kind: "rejected"; readonly reason: string };

/**
 * Decide whether a commercial update may proceed, given the invoice's CURRENT
 * status as read from the database (never from the client).
 */
export function evaluateCommercialEdit(currentStatus: string | null | undefined): EditDecision {
  if (canEditCommercialFields(currentStatus)) return { kind: "allowed" };
  return { kind: "rejected", reason: "invoice_issued_fields_immutable" };
}

/** Soft deletion of a committed invoice is a correction, not an edit. */
export function evaluateSoftDelete(currentStatus: string | null | undefined): EditDecision {
  if (isDraft(currentStatus)) return { kind: "allowed" };
  return { kind: "rejected", reason: "invoice_issued_cannot_be_deleted" };
}

export const ISSUED_INVOICE_CONTENT_TYPE = "application/pdf";

/**
 * The immutable object key.
 *
 * Every segment comes from a trusted server value — the session dealer, the
 * invoice row, and a freshly minted server UUID. No client string and no
 * user-supplied file name reaches the key, and the dealer prefix keeps the
 * object inside that tenant's folder. Because the UUID is new for every
 * issuance, an upload with upsert:false can never overwrite an earlier artifact.
 */
export function buildIssuedInvoiceObjectKey(
  dealerId: string,
  invoiceId: string,
  documentFileId: string
): string {
  for (const [name, value] of [
    ["dealerId", dealerId],
    ["invoiceId", invoiceId],
    ["documentFileId", documentFileId],
  ] as const) {
    if (!isUuidLike(value)) {
      throw new Error(`buildIssuedInvoiceObjectKey: ${name} must be a UUID`);
    }
  }
  return `${dealerId}/invoice/issued/${invoiceId}/${documentFileId}.pdf`;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value ?? ""
  );
}

/**
 * B1-R2-3: derive WHICH document row is the issued artifact, strictly, from the
 * invoice's own pointer — never by picking the newest active row. Two active
 * rows can exist (a race loser that failed cleanup), and "newest" could hide the
 * real winner.
 */
export function parseIssuedInvoiceObjectKey(
  filePath: string | null | undefined
): { readonly dealerId: string; readonly invoiceId: string; readonly documentFileId: string } | null {
  const match =
    /^([0-9a-fA-F-]{36})\/invoice\/issued\/([0-9a-fA-F-]{36})\/([0-9a-fA-F-]{36})\.pdf$/.exec(
      (filePath ?? "").trim()
    );
  if (!match) return null;

  const [, dealerId, invoiceId, documentFileId] = match;
  if (!isUuidLike(dealerId) || !isUuidLike(invoiceId) || !isUuidLike(documentFileId)) return null;

  return { dealerId, invoiceId, documentFileId };
}

export type ArtifactResolution =
  | { readonly kind: "resolved"; readonly filePath: string }
  | { readonly kind: "rejected"; readonly reason: string };

/**
 * Decide whether a stored artifact may be signed.
 *
 * B1-R1-1: a path read off the invoice row is NOT evidence. `document_files` is
 * writable by any dealer member, and the storage policies let a member write
 * inside their own folder, so a forged row or a hand-made object could otherwise
 * be signed by the service role. We therefore accept a path only when:
 *
 *   1. an ACTIVE invoice document row exists for this dealer and invoice;
 *   2. it is a PDF;
 *   3. its file_path equals the CANONICAL key rebuilt from the dealer id, the
 *      invoice id and that row's own id — so the row cannot point anywhere else;
 *   4. the invoice's own pdf_file_path agrees with it.
 *
 * Anything else is refused rather than signed. The reason is deliberately coarse
 * so a caller cannot probe which condition failed.
 */
export function resolveSignableArtifact(input: {
  dealerId: string;
  invoiceId: string;
  documentFileId: string | null | undefined;
  documentFilePath: string | null | undefined;
  documentType: string | null | undefined;
  documentStatus: string | null | undefined;
  mimeType: string | null | undefined;
  documentRowDealerId: string | null | undefined;
  documentRowDocumentId: string | null | undefined;
  invoicePdfFilePath: string | null | undefined;
}): ArtifactResolution {
  const reject = { kind: "rejected", reason: "invoice_artifact_missing" } as const;

  if (!isUuidLike(input.dealerId) || !isUuidLike(input.invoiceId)) return reject;
  if (!input.documentFileId || !isUuidLike(input.documentFileId)) return reject;

  // The invoice pointer must itself parse, and must name THIS dealer, THIS
  // invoice and THIS document row — so another active row cannot stand in.
  const parsed = parseIssuedInvoiceObjectKey(input.invoicePdfFilePath);
  if (!parsed) return reject;
  if (parsed.dealerId !== input.dealerId) return reject;
  if (parsed.invoiceId !== input.invoiceId) return reject;
  if (parsed.documentFileId !== input.documentFileId) return reject;

  if (input.documentRowDealerId !== input.dealerId) return reject;
  if (input.documentRowDocumentId !== input.invoiceId) return reject;
  if (input.documentType !== "invoice") return reject;
  if (input.documentStatus !== "active") return reject;
  if (input.mimeType !== ISSUED_INVOICE_CONTENT_TYPE) return reject;

  let canonical: string;
  try {
    canonical = buildIssuedInvoiceObjectKey(
      input.dealerId,
      input.invoiceId,
      input.documentFileId
    );
  } catch {
    return reject;
  }

  if (input.documentFilePath !== canonical) return reject;
  if ((input.invoicePdfFilePath ?? "") !== canonical) return reject;

  return { kind: "resolved", filePath: canonical };
}

/**
 * A download is only meaningful once the invoice has actually been issued.
 *
 * B1-R2-6: this is an explicit allowlist, not `!isDraft`. Null, empty and any
 * unrecognised status fail closed rather than being treated as issued.
 */
export function canDownloadIssuedArtifact(status: string | null | undefined): boolean {
  return POST_ISSUE_STATUSES.includes(status as InvoiceStatus);
}

export type IssueDecision =
  | { readonly kind: "proceed" }
  | { readonly kind: "already-issued" }
  | { readonly kind: "rejected"; readonly reason: string };

/**
 * Should this request render and upload a PDF at all?
 *
 * A repeated issuance must return the existing artifact rather than producing a
 * second one, so an invoice that already carries a path short-circuits here.
 */
export function evaluateIssueRequest(invoice: {
  status?: string | null;
  pdf_file_path?: string | null;
}): IssueDecision {
  const path = invoice.pdf_file_path?.trim() ?? "";

  if (!isDraft(invoice.status)) {
    if (path) return { kind: "already-issued" };
    if (invoice.status === "cancelled") {
      return { kind: "rejected", reason: "invoice_cancelled" };
    }
    return { kind: "rejected", reason: "invoice_artifact_missing" };
  }

  // A draft should not already carry an artifact; if it does, something wrote
  // outside the issuance path and we refuse rather than overwrite.
  if (path) return { kind: "rejected", reason: "invoice_unexpected_draft_artifact" };

  return { kind: "proceed" };
}

/**
 * Outcome of the race-safe conditional update `... WHERE id = ? AND status =
 * 'draft'`. Exactly one concurrent caller can match the predicate; every other
 * caller sees zero rows and must give up its own artifact.
 */
export function resolveConcurrentIssue(updatedRowCount: number): "winner" | "loser" {
  return updatedRowCount === 1 ? "winner" : "loser";
}

export type CompensationStep = "delete-document-row" | "remove-object";

export interface CompensationStepResult {
  readonly step: CompensationStep;
  readonly ok: boolean;
}

/**
 * B1-R1-5: cleanup spans two systems (a table and an object store) and cannot be
 * atomic. If any step fails we must say so rather than pretend the artifact was
 * tidied away — an orphan object or dangling row needs operator attention.
 */
export function evaluateCompensation(
  results: readonly CompensationStepResult[]
): { readonly kind: "clean" } | { readonly kind: "incomplete"; readonly failed: readonly CompensationStep[] } {
  const failed = results.filter((r) => !r.ok).map((r) => r.step);
  return failed.length === 0 ? { kind: "clean" } : { kind: "incomplete", failed };
}

/**
 * B1-R2-4: the steps are DEPENDENT, not merely ordered. Removing the object
 * after a failed row deletion would leave a row pointing at bytes that no longer
 * exist — strictly worse than an orphan object, because the row still looks
 * valid. So the object may only be removed once the row is provably gone (or was
 * never inserted).
 */
export function shouldRemoveObjectAfterRowDeletion(state: {
  documentRowInserted: boolean;
  documentRowDeleted: boolean;
}): boolean {
  return state.documentRowInserted ? state.documentRowDeleted : true;
}

/**
 * What to undo, in order, when a step after the upload fails.
 *
 * The order matters: the document_files row is removed BEFORE the object, so no
 * window exists where a row points at bytes that are already gone. If the row
 * was never inserted, only the object needs removing.
 */
export function planCompensation(state: {
  objectUploaded: boolean;
  documentRowInserted: boolean;
}): readonly CompensationStep[] {
  const steps: CompensationStep[] = [];
  if (state.documentRowInserted) steps.push("delete-document-row");
  if (state.objectUploaded) steps.push("remove-object");
  return steps;
}

// ── B1-V1-R2: draft-save payload schema ──────────────────────────────────────
//
// The fail-closed input contract of save_invoice_draft, expressed once as pure
// data and functions. The SQL function enforces the SAME schema (the boundary
// test pins the two key sets together), so a payload this validator rejects is
// also rejected by the database, and vice versa. Money ARITHMETIC is not judged
// here — that stays with validateIssuanceSnapshot so the system keeps exactly
// one rounding and tax policy.

export const DRAFT_SAVE_TEXT_KEYS = [
  "invoice_number",
  "title",
  "issue_date",
  "due_date",
  // MONTHLY-DATA-B1: 納品日 — a nullable-string date key, exactly like issue_date / due_date. Its
  // presence here keeps this contract byte-for-byte consistent with the effective save_invoice_draft
  // SQL key arrays (the boundary test pins the two together).
  "delivery_date",
  "notes",
  "internal_memo",
] as const;

export const DRAFT_SAVE_MONEY_KEYS = [
  "discount_amount",
  "tax_rate",
  "paid_amount",
  "subtotal",
  "tax_amount",
  "total",
  "balance_due",
] as const;

export const DRAFT_SAVE_ITEM_KEYS = [
  "category",
  "item_name",
  "description",
  "quantity",
  "unit_price",
  "discount_rate",
  "line_total",
  "sort_order",
] as const;

export type DraftSaveValidation =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly reason: string };

/**
 * A payload object must be a PLAIN object: not null, not an array, not a class
 * instance. Anything else could carry getters, prototypes or exotic behaviour
 * that a schema check cannot reason about.
 */
export function isPlainPayloadObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteJsonNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/** Exactly these keys — every one present, nothing else. */
function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(obj).length === keys.length &&
    keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k))
  );
}

/**
 * Validate the p_fields payload.
 *
 * "with-items": the full 13-key shape the application always sends — six
 * nullable-string identity/text/date keys plus seven finite-number money keys.
 * "text-only": the DB-RPC-only 6-key shape used with p_items = NULL, where
 * every money key is FORBIDDEN so stored totals can never drift from preserved
 * lines. NaN and Infinity are unrepresentable in JSON, and the number type
 * check also refuses the string forms Postgres would otherwise cast (numeric
 * accepts 'NaN').
 */
export function validateDraftSaveFields(
  fields: unknown,
  mode: "with-items" | "text-only"
): DraftSaveValidation {
  const invalid = (reason: string): DraftSaveValidation => ({ kind: "invalid", reason });

  if (!isPlainPayloadObject(fields)) return invalid("fields-not-object");

  const required: readonly string[] =
    mode === "with-items"
      ? [...DRAFT_SAVE_TEXT_KEYS, ...DRAFT_SAVE_MONEY_KEYS]
      : DRAFT_SAVE_TEXT_KEYS;
  if (!hasExactKeys(fields, required)) return invalid("fields-key-set");

  for (const key of DRAFT_SAVE_TEXT_KEYS) {
    if (!isNullableString(fields[key])) return invalid(`fields-${key}-type`);
  }
  if (mode === "with-items") {
    for (const key of DRAFT_SAVE_MONEY_KEYS) {
      if (!isFiniteJsonNumber(fields[key])) return invalid(`fields-${key}-type`);
    }
  }
  return { kind: "valid" };
}

/**
 * Validate the p_items payload: a (possibly empty) array of exact 8-key plain
 * objects. One bad element rejects the whole payload — no partial application.
 * item_name must be a string but MAY be empty: the invoice form legitimately
 * lets a just-added blank line be saved in a draft.
 */
export function validateDraftSaveItems(items: unknown): DraftSaveValidation {
  const invalid = (reason: string): DraftSaveValidation => ({ kind: "invalid", reason });

  if (!Array.isArray(items)) return invalid("items-not-array");

  for (let i = 0; i < items.length; i++) {
    const item: unknown = items[i];
    if (!isPlainPayloadObject(item)) return invalid(`items[${i}]-not-object`);
    if (!hasExactKeys(item, DRAFT_SAVE_ITEM_KEYS)) return invalid(`items[${i}]-key-set`);
    if (typeof item.category !== "string") return invalid(`items[${i}]-category-type`);
    if (typeof item.item_name !== "string") return invalid(`items[${i}]-item_name-type`);
    if (!isNullableString(item.description)) return invalid(`items[${i}]-description-type`);
    for (const key of ["quantity", "unit_price", "discount_rate", "line_total", "sort_order"] as const) {
      if (!isFiniteJsonNumber(item[key])) return invalid(`items[${i}]-${key}-type`);
    }
  }
  return { kind: "valid" };
}

export type IssueOutcomeKind =
  | "issued"
  | "already_issued"
  | "validation_error"
  | "conflict"
  | "artifact_missing"
  | "storage_error"
  | "persistence_error"
  | "cleanup_failed";

/** Japanese operator-facing text. Storage paths and internals never appear. */
export function describeIssueOutcome(kind: IssueOutcomeKind): string {
  switch (kind) {
    case "issued":
      return "請求書を発行しました";
    case "already_issued":
      return "この請求書は既に発行済みです";
    case "validation_error":
      return "この請求書は発行できません";
    case "conflict":
      return "他の操作と競合しました。画面を更新してください";
    case "artifact_missing":
      return "発行済みPDFを取得できませんでした";
    case "storage_error":
      return "PDFの保存に失敗しました";
    case "persistence_error":
      return "発行処理に失敗しました";
    case "cleanup_failed":
      return "発行処理に失敗しました。管理者に連絡してください";
  }
}
