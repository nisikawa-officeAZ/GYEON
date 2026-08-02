// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — pure issuance contract tests.
//
// Run: node --import tsx --test src/lib/invoices/invoice-issuance-core.test.ts
//
// These exercise the decisions themselves — no database, no Storage, no React.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  INVOICE_COMMERCIAL_FIELDS,
  INVOICE_POST_ISSUE_MUTABLE_FIELDS,
  POST_ISSUE_STATUSES,
  ISSUED_INVOICE_CONTENT_TYPE,
  buildIssuedInvoiceObjectKey,
  canEditCommercialFields,
  canRecordPayment,
  describeIssueOutcome,
  evaluateCommercialEdit,
  evaluateIssueRequest,
  evaluateSoftDelete,
  evaluateStatusTransition,
  isDraft,
  planCompensation,
  rejectsClientStatusSelection,
  resolveConcurrentIssue,
  resolveSignableArtifact,
  canDownloadIssuedArtifact,
  evaluateCompensation,
  parseIssuedInvoiceObjectKey,
  DRAFT_SAVE_TEXT_KEYS,
  DRAFT_SAVE_MONEY_KEYS,
  DRAFT_SAVE_ITEM_KEYS,
  isPlainPayloadObject,
  validateDraftSaveFields,
  validateDraftSaveItems,
  shouldRemoveObjectAfterRowDeletion,
} from "./invoice-issuance-core";

const DEALER = "11111111-1111-4111-8111-111111111111";
const INVOICE = "22222222-2222-4222-8222-222222222222";
const DOCFILE = "33333333-3333-4333-8333-333333333333";

// ── Draft editability ────────────────────────────────────────────────────────

test("1. a draft invoice may be edited", () => {
  assert.equal(isDraft("draft"), true);
  assert.equal(canEditCommercialFields("draft"), true);
  assert.deepEqual(evaluateCommercialEdit("draft"), { kind: "allowed" });
});

test("2. every non-draft status rejects commercial edits", () => {
  for (const status of ["issued", "partially_paid", "paid", "overdue", "cancelled"]) {
    assert.equal(canEditCommercialFields(status), false, status);
    const decision = evaluateCommercialEdit(status);
    assert.equal(decision.kind, "rejected");
    assert.equal(
      decision.kind === "rejected" ? decision.reason : "",
      "invoice_issued_fields_immutable"
    );
  }
});

test("3. a missing or unknown status is treated as non-draft (fail closed)", () => {
  for (const status of [null, undefined, "", "weird"]) {
    assert.equal(canEditCommercialFields(status as string | null), false);
  }
});

// ── Payment and lifecycle do not unlock commercial fields ────────────────────

test("4. payments are allowed only on a real (non-draft, non-cancelled) document", () => {
  assert.equal(canRecordPayment("draft"), false);
  assert.equal(canRecordPayment("cancelled"), false);
  for (const status of ["issued", "partially_paid", "paid", "overdue"]) {
    assert.equal(canRecordPayment(status), true, status);
  }
});

test("5. the mutable-after-issue set never overlaps the frozen commercial set", () => {
  for (const field of INVOICE_POST_ISSUE_MUTABLE_FIELDS) {
    assert.ok(
      !(INVOICE_COMMERCIAL_FIELDS as readonly string[]).includes(field),
      `${field} must not be both frozen and mutable`
    );
  }
  // The artifact pointer in particular must be frozen.
  assert.ok((INVOICE_COMMERCIAL_FIELDS as readonly string[]).includes("pdf_file_path"));
  assert.ok((INVOICE_COMMERCIAL_FIELDS as readonly string[]).includes("pdf_file_url"));
});

test("6. lifecycle movement among post-issue states stays allowed", () => {
  for (const to of POST_ISSUE_STATUSES) {
    assert.deepEqual(evaluateStatusTransition("issued", to), { kind: "allowed" }, to);
  }
});

// ── No way back to draft ─────────────────────────────────────────────────────

test("7. a non-draft invoice can never return to draft", () => {
  for (const from of ["issued", "partially_paid", "paid", "overdue", "cancelled"]) {
    const decision = evaluateStatusTransition(from, "draft");
    assert.equal(decision.kind, "rejected", from);
    assert.equal(
      decision.kind === "rejected" ? decision.reason : "",
      "invoice_cannot_return_to_draft"
    );
  }
});

test("8. a draft may only be issued or cancelled", () => {
  assert.deepEqual(evaluateStatusTransition("draft", "issued"), { kind: "allowed" });
  assert.deepEqual(evaluateStatusTransition("draft", "cancelled"), { kind: "allowed" });
  for (const to of ["paid", "partially_paid", "overdue"]) {
    const decision = evaluateStatusTransition("draft", to);
    assert.equal(decision.kind, "rejected", to);
    assert.equal(
      decision.kind === "rejected" ? decision.reason : "",
      "invoice_invalid_draft_transition"
    );
  }
});

test("9. a client-supplied status is always refused", () => {
  assert.equal(rejectsClientStatusSelection("issued"), true);
  assert.equal(rejectsClientStatusSelection("draft"), true);
  assert.equal(rejectsClientStatusSelection(null), false);
  assert.equal(rejectsClientStatusSelection(""), false);
});

test("10. soft deletion is a draft-only operation", () => {
  assert.deepEqual(evaluateSoftDelete("draft"), { kind: "allowed" });
  const decision = evaluateSoftDelete("issued");
  assert.equal(decision.kind, "rejected");
  assert.equal(
    decision.kind === "rejected" ? decision.reason : "",
    "invoice_issued_cannot_be_deleted"
  );
});

// ── Immutable object key ─────────────────────────────────────────────────────

test("11. the object key is dealer-prefixed, invoice-scoped and UUID-named", () => {
  const key = buildIssuedInvoiceObjectKey(DEALER, INVOICE, DOCFILE);
  assert.equal(key, `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`);
  assert.ok(key.startsWith(`${DEALER}/`), "dealer folder must be the first segment");
  assert.ok(key.includes(`/${INVOICE}/`), "the invoice scopes the folder");
  assert.ok(key.endsWith(".pdf"));
});

test("12. every issuance produces a distinct key, so upsert:false cannot collide", () => {
  const a = buildIssuedInvoiceObjectKey(DEALER, INVOICE, DOCFILE);
  const b = buildIssuedInvoiceObjectKey(DEALER, INVOICE, "44444444-4444-4444-8444-444444444444");
  assert.notEqual(a, b);
});

test("13. no client-controlled file name can reach the key", () => {
  for (const hostile of ["../../etc/passwd", "name with spaces", "", "not-a-uuid", "INV-0001"]) {
    assert.throws(() => buildIssuedInvoiceObjectKey(DEALER, INVOICE, hostile));
    assert.throws(() => buildIssuedInvoiceObjectKey(hostile, INVOICE, DOCFILE));
    assert.throws(() => buildIssuedInvoiceObjectKey(DEALER, hostile, DOCFILE));
  }
});

test("14. the upload content type is fixed to PDF", () => {
  assert.equal(ISSUED_INVOICE_CONTENT_TYPE, "application/pdf");
});

// ── Repeat issuance ──────────────────────────────────────────────────────────

test("15. a draft with no artifact proceeds to render", () => {
  assert.deepEqual(
    evaluateIssueRequest({ status: "draft", pdf_file_path: null }),
    { kind: "proceed" }
  );
});

test("16. repeating issuance returns the original artifact instead of making another", () => {
  assert.deepEqual(
    evaluateIssueRequest({ status: "issued", pdf_file_path: "d/invoice/issued/i/f.pdf" }),
    { kind: "already-issued" }
  );
  // ...and so does any later lifecycle state that still holds the artifact.
  for (const status of ["partially_paid", "paid", "overdue"]) {
    assert.deepEqual(
      evaluateIssueRequest({ status, pdf_file_path: "d/invoice/issued/i/f.pdf" }),
      { kind: "already-issued" },
      status
    );
  }
});

test("17. a non-draft invoice with no artifact is a typed failure, never a re-render", () => {
  const decision = evaluateIssueRequest({ status: "issued", pdf_file_path: null });
  assert.equal(decision.kind, "rejected");
  assert.equal(
    decision.kind === "rejected" ? decision.reason : "",
    "invoice_artifact_missing"
  );
});

test("18. a draft that somehow already carries an artifact is refused, not overwritten", () => {
  const decision = evaluateIssueRequest({ status: "draft", pdf_file_path: "d/x.pdf" });
  assert.equal(decision.kind, "rejected");
  assert.equal(
    decision.kind === "rejected" ? decision.reason : "",
    "invoice_unexpected_draft_artifact"
  );
});

test("19. a cancelled draft-less invoice is refused with its own reason", () => {
  const decision = evaluateIssueRequest({ status: "cancelled", pdf_file_path: null });
  assert.equal(decision.kind, "rejected");
  assert.equal(decision.kind === "rejected" ? decision.reason : "", "invoice_cancelled");
});

// ── Concurrency ──────────────────────────────────────────────────────────────

test("20. exactly one concurrent issuer wins the conditional update", () => {
  assert.equal(resolveConcurrentIssue(1), "winner");
  assert.equal(resolveConcurrentIssue(0), "loser");
  // Defensive: anything other than a single matched row is not a win.
  assert.equal(resolveConcurrentIssue(2), "loser");
});

// ── Compensation ─────────────────────────────────────────────────────────────

test("21. compensation removes the document row before the object", () => {
  assert.deepEqual(
    planCompensation({ objectUploaded: true, documentRowInserted: true }),
    ["delete-document-row", "remove-object"]
  );
});

test("22. an orphan object with no row only needs the object removed", () => {
  assert.deepEqual(
    planCompensation({ objectUploaded: true, documentRowInserted: false }),
    ["remove-object"]
  );
});

test("23. nothing uploaded means nothing to undo", () => {
  assert.deepEqual(planCompensation({ objectUploaded: false, documentRowInserted: false }), []);
});

// ── Operator-facing messages ─────────────────────────────────────────────────

test("24. every outcome has Japanese text that leaks no storage internals", () => {
  const kinds = [
    "issued",
    "already_issued",
    "validation_error",
    "conflict",
    "artifact_missing",
    "storage_error",
    "persistence_error",
  ] as const;
  for (const kind of kinds) {
    const text = describeIssueOutcome(kind);
    assert.ok(text.length > 0, kind);
    for (const leak of ["documents", "bucket", "service_role", "supabase", "/invoice/issued/"]) {
      assert.ok(!text.toLowerCase().includes(leak), `${kind} must not mention ${leak}`);
    }
  }
});

// ── B1-R1: artifact resolution before signing ────────────────────────────────

const VALID_INPUT = {
  dealerId: DEALER,
  invoiceId: INVOICE,
  documentFileId: DOCFILE,
  documentFilePath: `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`,
  documentType: "invoice",
  documentStatus: "active",
  mimeType: "application/pdf",
  documentRowDealerId: DEALER,
  documentRowDocumentId: INVOICE,
  invoicePdfFilePath: `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`,
};

test("25. a fully canonical, active, dealer-owned PDF row resolves", () => {
  const r = resolveSignableArtifact(VALID_INPUT);
  assert.equal(r.kind, "resolved");
  assert.equal(
    r.kind === "resolved" ? r.filePath : "",
    `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`
  );
});

test("26. a foreign-dealer document row can never be signed", () => {
  const foreign = "99999999-9999-4999-8999-999999999999";
  // Row belongs to another dealer.
  assert.equal(
    resolveSignableArtifact({ ...VALID_INPUT, documentRowDealerId: foreign }).kind,
    "rejected"
  );
  // Row belongs to another invoice.
  assert.equal(
    resolveSignableArtifact({ ...VALID_INPUT, documentRowDocumentId: foreign }).kind,
    "rejected"
  );
});

test("27. a non-canonical stored path can never be signed", () => {
  for (const hostile of [
    `${DEALER}/invoice/issued/${INVOICE}/other.pdf`,
    `${DEALER}/branding/logo.pdf`,
    "../../secrets.pdf",
    `99999999-9999-4999-8999-999999999999/invoice/issued/${INVOICE}/${DOCFILE}.pdf`,
    "",
  ]) {
    assert.equal(
      resolveSignableArtifact({ ...VALID_INPUT, documentFilePath: hostile }).kind,
      "rejected",
      hostile
    );
  }
});

test("28. the invoice row and the document row must agree on the path", () => {
  assert.equal(
    resolveSignableArtifact({
      ...VALID_INPUT,
      invoicePdfFilePath: `${DEALER}/invoice/issued/${INVOICE}/44444444-4444-4444-8444-444444444444.pdf`,
    }).kind,
    "rejected"
  );
  assert.equal(
    resolveSignableArtifact({ ...VALID_INPUT, invoicePdfFilePath: null }).kind,
    "rejected"
  );
});

test("29. archived, non-invoice or non-PDF rows are refused", () => {
  assert.equal(resolveSignableArtifact({ ...VALID_INPUT, documentStatus: "archived" }).kind, "rejected");
  assert.equal(resolveSignableArtifact({ ...VALID_INPUT, documentType: "estimate" }).kind, "rejected");
  assert.equal(resolveSignableArtifact({ ...VALID_INPUT, mimeType: "text/html" }).kind, "rejected");
  assert.equal(resolveSignableArtifact({ ...VALID_INPUT, documentFileId: null }).kind, "rejected");
});

test("30. every rejection uses the same coarse reason, so nothing can be probed", () => {
  const variants = [
    { ...VALID_INPUT, documentStatus: "archived" },
    { ...VALID_INPUT, documentType: "estimate" },
    { ...VALID_INPUT, mimeType: "text/html" },
    { ...VALID_INPUT, documentFilePath: "../x.pdf" },
    { ...VALID_INPUT, invoicePdfFilePath: null },
  ];
  for (const v of variants) {
    const r = resolveSignableArtifact(v);
    assert.equal(r.kind === "rejected" ? r.reason : "", "invoice_artifact_missing");
  }
});

test("31. a draft invoice has nothing to download", () => {
  assert.equal(canDownloadIssuedArtifact("draft"), false);
  for (const s of ["issued", "partially_paid", "paid", "overdue", "cancelled"]) {
    assert.equal(canDownloadIssuedArtifact(s), true, s);
  }
});

// ── B1-R1-5: cleanup failure is never silent ─────────────────────────────────

test("32. a clean compensation reports clean", () => {
  assert.deepEqual(
    evaluateCompensation([
      { step: "delete-document-row", ok: true },
      { step: "remove-object", ok: true },
    ]),
    { kind: "clean" }
  );
});

test("33. a failed document-row deletion is surfaced", () => {
  const r = evaluateCompensation([
    { step: "delete-document-row", ok: false },
    { step: "remove-object", ok: true },
  ]);
  assert.equal(r.kind, "incomplete");
  assert.deepEqual(r.kind === "incomplete" ? r.failed : [], ["delete-document-row"]);
});

test("34. a failed object removal is surfaced", () => {
  const r = evaluateCompensation([
    { step: "delete-document-row", ok: true },
    { step: "remove-object", ok: false },
  ]);
  assert.equal(r.kind, "incomplete");
  assert.deepEqual(r.kind === "incomplete" ? r.failed : [], ["remove-object"]);
});

test("35. cleanup_failed has its own operator message and leaks nothing", () => {
  const text = describeIssueOutcome("cleanup_failed");
  assert.ok(text.length > 0);
  assert.notEqual(text, describeIssueOutcome("persistence_error"));
  for (const leak of ["documents", "bucket", "service_role", "supabase", "/invoice/issued/"]) {
    assert.ok(!text.toLowerCase().includes(leak));
  }
});

// ── B1-R2: exact artifact selection ──────────────────────────────────────────

test("36. the stored pointer parses to exactly one document row", () => {
  const parsed = parseIssuedInvoiceObjectKey(`${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`);
  assert.deepEqual(parsed, { dealerId: DEALER, invoiceId: INVOICE, documentFileId: DOCFILE });
});

test("37. a malformed or hostile pointer parses to nothing", () => {
  for (const bad of [
    null,
    undefined,
    "",
    `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.PDF`,
    `${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf/../x.pdf`,
    `${DEALER}/invoice/${INVOICE}/${DOCFILE}.pdf`,
    `${DEALER}/invoice/issued/${INVOICE}/not-a-uuid.pdf`,
    `../${DEALER}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`,
  ]) {
    assert.equal(parseIssuedInvoiceObjectKey(bad as string | null), null, String(bad));
  }
});

test("38. a second active row cannot stand in for the pointed-at artifact", () => {
  const otherRow = "55555555-5555-4555-8555-555555555555";
  // The invoice points at DOCFILE, but a different (e.g. race-loser) row is offered.
  const r = resolveSignableArtifact({
    ...VALID_INPUT,
    documentFileId: otherRow,
    documentFilePath: `${DEALER}/invoice/issued/${INVOICE}/${otherRow}.pdf`,
  });
  assert.equal(r.kind, "rejected");
});

test("39. the pointer must name this dealer and this invoice", () => {
  const foreign = "99999999-9999-4999-8999-999999999999";
  assert.equal(
    resolveSignableArtifact({
      ...VALID_INPUT,
      invoicePdfFilePath: `${foreign}/invoice/issued/${INVOICE}/${DOCFILE}.pdf`,
    }).kind,
    "rejected"
  );
  assert.equal(
    resolveSignableArtifact({
      ...VALID_INPUT,
      invoicePdfFilePath: `${DEALER}/invoice/issued/${foreign}/${DOCFILE}.pdf`,
    }).kind,
    "rejected"
  );
});

// ── B1-R2-4: compensation dependency ─────────────────────────────────────────

test("40. the object is removed only after the row is provably gone", () => {
  assert.equal(
    shouldRemoveObjectAfterRowDeletion({ documentRowInserted: true, documentRowDeleted: true }),
    true
  );
  // Row deletion failed → removing the object would leave a row pointing at
  // missing bytes, which is worse than an orphan object.
  assert.equal(
    shouldRemoveObjectAfterRowDeletion({ documentRowInserted: true, documentRowDeleted: false }),
    false
  );
  // No row was ever inserted → the object is a pure orphan and may go.
  assert.equal(
    shouldRemoveObjectAfterRowDeletion({ documentRowInserted: false, documentRowDeleted: false }),
    true
  );
});

test("41. a skipped or failed object removal counts as incomplete cleanup", () => {
  const r = evaluateCompensation([
    { step: "delete-document-row", ok: false },
    { step: "remove-object", ok: false },
  ]);
  assert.equal(r.kind, "incomplete");
  assert.deepEqual(
    r.kind === "incomplete" ? r.failed : [],
    ["delete-document-row", "remove-object"]
  );
});

// ── B1-R2-6: download status fails closed ────────────────────────────────────

test("42. unknown, null and empty statuses cannot download", () => {
  for (const bad of [null, undefined, "", "draft", "weird", "ISSUED", "sent"]) {
    assert.equal(canDownloadIssuedArtifact(bad as string | null), false, String(bad));
  }
  for (const good of ["issued", "partially_paid", "paid", "overdue", "cancelled"]) {
    assert.equal(canDownloadIssuedArtifact(good), true, good);
  }
});

// ── B1-V1-R2: draft-save payload schema ──────────────────────────────────────

const VALID_TEXT_FIELDS = {
  invoice_number: "INV-1",
  title:          null,
  issue_date:     "2026-08-02",
  due_date:       null,
  notes:          "",
  internal_memo:  null,
};

const VALID_FULL_FIELDS = {
  ...VALID_TEXT_FIELDS,
  discount_amount: 0,
  tax_rate:        10,
  paid_amount:     0,
  subtotal:        1000,
  tax_amount:      100,
  total:           1100,
  balance_due:     1100,
};

const VALID_ITEM = {
  category:      "coating",
  item_name:     "line",
  description:   null,
  quantity:      1,
  unit_price:    1000,
  discount_rate: 0,
  line_total:    1000,
  sort_order:    0,
};

test("43. the schema key sets are exactly the accepted contract", () => {
  assert.deepEqual([...DRAFT_SAVE_TEXT_KEYS],
    ["invoice_number", "title", "issue_date", "due_date", "notes", "internal_memo"]);
  assert.deepEqual([...DRAFT_SAVE_MONEY_KEYS],
    ["discount_amount", "tax_rate", "paid_amount", "subtotal", "tax_amount", "total", "balance_due"]);
  assert.deepEqual([...DRAFT_SAVE_ITEM_KEYS],
    ["category", "item_name", "description", "quantity", "unit_price", "discount_rate", "line_total", "sort_order"]);
});

test("44. plain-object detection rejects null, arrays, scalars and class instances", () => {
  assert.equal(isPlainPayloadObject({}), true);
  assert.equal(isPlainPayloadObject(Object.create(null)), true);
  for (const bad of [null, undefined, [], "x", 5, true, new Date(), new (class Payload {})()]) {
    assert.equal(isPlainPayloadObject(bad), false, String(bad));
  }
});

test("45. a valid 13-key payload and a valid 6-key text-only payload pass", () => {
  assert.deepEqual(validateDraftSaveFields(VALID_FULL_FIELDS, "with-items"), { kind: "valid" });
  assert.deepEqual(validateDraftSaveFields(VALID_TEXT_FIELDS, "text-only"), { kind: "valid" });
});

test("46. non-object p_fields shapes fail in both modes", () => {
  for (const bad of [null, undefined, [], "x", 5, true, new Date()]) {
    for (const mode of ["with-items", "text-only"] as const) {
      assert.equal(validateDraftSaveFields(bad, mode).kind, "invalid", `${String(bad)} ${mode}`);
    }
  }
});

test("47. the empty object, missing keys and unknown keys fail", () => {
  assert.equal(validateDraftSaveFields({}, "with-items").kind, "invalid");
  assert.equal(validateDraftSaveFields({}, "text-only").kind, "invalid");
  for (const key of Object.keys(VALID_FULL_FIELDS)) {
    const partial: Record<string, unknown> = { ...VALID_FULL_FIELDS };
    delete partial[key];
    assert.equal(validateDraftSaveFields(partial, "with-items").kind, "invalid", `missing ${key}`);
  }
  assert.equal(validateDraftSaveFields({ ...VALID_FULL_FIELDS, extra: 1 }, "with-items").kind, "invalid");
  assert.equal(validateDraftSaveFields({ ...VALID_TEXT_FIELDS, extra: 1 }, "text-only").kind, "invalid");
});

test("48. money keys are FORBIDDEN in text-only mode and REQUIRED with items", () => {
  assert.equal(validateDraftSaveFields({ ...VALID_TEXT_FIELDS, tax_rate: 10 }, "text-only").kind, "invalid");
  assert.equal(validateDraftSaveFields(VALID_FULL_FIELDS, "text-only").kind, "invalid");
  assert.equal(validateDraftSaveFields(VALID_TEXT_FIELDS, "with-items").kind, "invalid");
});

test("49. text keys accept string and null only; money keys accept finite numbers only", () => {
  for (const bad of [5, true, [], {}]) {
    assert.equal(validateDraftSaveFields({ ...VALID_FULL_FIELDS, title: bad }, "with-items").kind, "invalid", String(bad));
  }
  for (const bad of ["10", null, true, [], {}, NaN, Infinity, -Infinity]) {
    assert.equal(validateDraftSaveFields({ ...VALID_FULL_FIELDS, tax_rate: bad }, "with-items").kind, "invalid", String(bad));
  }
});

test("50. an empty item array is valid and a valid element array is valid", () => {
  assert.deepEqual(validateDraftSaveItems([]), { kind: "valid" });
  assert.deepEqual(validateDraftSaveItems([VALID_ITEM, { ...VALID_ITEM, sort_order: 1 }]), { kind: "valid" });
});

test("51. non-array item containers fail", () => {
  for (const bad of [null, undefined, {}, "x", 5, true]) {
    assert.equal(validateDraftSaveItems(bad).kind, "invalid", String(bad));
  }
});

test("52. non-object, empty-object and partial-object elements fail", () => {
  for (const bad of [[5], ["x"], [null], [true], [[]], [{}], [{ category: "other" }]]) {
    assert.equal(validateDraftSaveItems(bad).kind, "invalid", JSON.stringify(bad));
  }
});

test("53. one bad element rejects a mixed array — no partial application", () => {
  assert.equal(validateDraftSaveItems([VALID_ITEM, {}]).kind, "invalid");
  assert.equal(validateDraftSaveItems([VALID_ITEM, 5]).kind, "invalid");
});

test("54. element missing keys and unknown keys fail", () => {
  for (const key of Object.keys(VALID_ITEM)) {
    const partial: Record<string, unknown> = { ...VALID_ITEM };
    delete partial[key];
    assert.equal(validateDraftSaveItems([partial]).kind, "invalid", `missing ${key}`);
  }
  assert.equal(validateDraftSaveItems([{ ...VALID_ITEM, product_id: "x" }]).kind, "invalid");
});

test("55. element types are enforced: strings, nullable description, finite numbers", () => {
  assert.equal(validateDraftSaveItems([{ ...VALID_ITEM, category: 5 }]).kind, "invalid");
  assert.equal(validateDraftSaveItems([{ ...VALID_ITEM, item_name: null }]).kind, "invalid");
  for (const bad of [5, false, 0, undefined, [], {}]) {
    assert.equal(
      validateDraftSaveItems([{ ...VALID_ITEM, description: bad }]).kind,
      "invalid",
      `description=${JSON.stringify(bad) ?? "undefined"}`
    );
  }
  for (const key of ["quantity", "unit_price", "discount_rate", "line_total", "sort_order"]) {
    for (const bad of ["5", null, true, NaN, Infinity, -Infinity]) {
      assert.equal(
        validateDraftSaveItems([{ ...VALID_ITEM, [key]: bad }]).kind,
        "invalid",
        `${key}=${String(bad)}`
      );
    }
  }
});

test("56. empty item_name and both description forms remain legal", () => {
  assert.deepEqual(validateDraftSaveItems([{ ...VALID_ITEM, item_name: "" }]), { kind: "valid" });
  assert.deepEqual(validateDraftSaveItems([{ ...VALID_ITEM, description: "説明" }]), { kind: "valid" });
  assert.deepEqual(validateDraftSaveItems([{ ...VALID_ITEM, description: null }]), { kind: "valid" });
});
