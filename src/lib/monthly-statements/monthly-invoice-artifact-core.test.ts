// B1B-E3 — pure decision-core tests for the monthly-invoice artifact.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-invoice-artifact-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MONTHLY_INVOICE_CONTENT_TYPE,
  buildMonthlyInvoiceObjectKey,
  parseMonthlyInvoiceObjectKey,
  resolveSignableMonthlyArtifact,
  classifyExistenceProbe,
  decidePointedArtifact,
  decideUnpointedCandidate,
  isActiveArtifactUniqueViolation,
  isPointerConflict,
  isStatementNotIssued,
  describeMonthlyArtifactOutcome,
} from "./monthly-invoice-artifact-core";

const DEALER = "22222222-2222-4222-8222-222222222222";
const STMT = "11111111-1111-4111-8111-111111111111";
const DF = "aaaaaaa1-0000-4000-8000-000000000001";
const CANONICAL = `${DEALER}/monthly_invoice/issued/${STMT}/${DF}.pdf`;

/* ── canonical key build/parse ──────────────────────────────────────────────── */

test("AC-1 canonical key builds and parses roundtrip", () => {
  const key = buildMonthlyInvoiceObjectKey(DEALER, STMT, DF);
  assert.equal(key, CANONICAL);
  assert.deepEqual(parseMonthlyInvoiceObjectKey(key), {
    dealerId: DEALER, statementId: STMT, documentFileId: DF,
  });
});

test("AC-2 malformed keys refuse to parse", () => {
  for (const bad of [
    null, undefined, "",
    `${DEALER}/invoice/issued/${STMT}/${DF}.pdf`,          // wrong namespace
    `${DEALER}/monthly_invoice/draft/${STMT}/${DF}.pdf`,   // wrong lifecycle segment
    `${DEALER}/monthly_invoice/issued/${STMT}/${DF}.png`,  // wrong suffix
    `${DEALER}/monthly_invoice/issued/${STMT}/not-a-uuid.pdf`,
    `not-a-uuid/monthly_invoice/issued/${STMT}/${DF}.pdf`,
    `${DEALER}/monthly_invoice/issued/${STMT}/${DF}.pdf/extra`,
    `${DEALER}/monthly_invoice/issued/${DF}.pdf`,          // missing segment
  ]) {
    assert.equal(parseMonthlyInvoiceObjectKey(bad as string), null, String(bad));
  }
});

/* ── signable-artifact resolution matrix ────────────────────────────────────── */

function validRow() {
  return {
    dealerId: DEALER, statementId: STMT,
    rowId: DF, rowDealerId: DEALER, rowDocumentType: "monthly_invoice",
    rowDocumentId: STMT, rowStatus: "active",
    rowMimeType: MONTHLY_INVOICE_CONTENT_TYPE, rowFilePath: CANONICAL,
  };
}

test("AC-3 a fully canonical active row resolves to its canonical path", () => {
  assert.deepEqual(resolveSignableMonthlyArtifact(validRow()), { kind: "resolved", filePath: CANONICAL });
});

test("AC-4 every non-canonical variation is unsignable", () => {
  const variations: Array<Partial<Parameters<typeof resolveSignableMonthlyArtifact>[0]>> = [
    { rowId: null }, { rowId: "not-a-uuid" },
    { rowDealerId: "99999999-9999-4999-8999-999999999999" },
    { rowDocumentType: "invoice" },
    { rowDocumentId: "99999999-9999-4999-8999-999999999999" },
    { rowStatus: "archived" },
    { rowMimeType: "text/plain" },
    { rowFilePath: `${DEALER}/monthly_invoice/issued/${STMT}/wrong.pdf` },
    { rowFilePath: null },
  ];
  for (const v of variations) {
    assert.deepEqual(
      resolveSignableMonthlyArtifact({ ...validRow(), ...v }),
      { kind: "unsignable" },
      JSON.stringify(v),
    );
  }
});

/* ── existence-probe classification (the accepted three-way taxonomy) ───────── */

test("AC-5 resolved {data:true, error:null} is present", () => {
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: true, error: null }), "present");
});

test("AC-6 resolved 404 and 400 StorageErrors are confirmed_missing", () => {
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: false, error: { status: 404 } }), "confirmed_missing");
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: false, error: { status: 400 } }), "confirmed_missing");
  assert.equal(
    classifyExistenceProbe({ kind: "resolved", data: false, error: { originalError: { status: 404 } } }),
    "confirmed_missing",
  );
});

test("AC-7 thrown 401/403 are probe_unavailable", () => {
  assert.equal(classifyExistenceProbe({ kind: "thrown", error: { status: 401 } }), "probe_unavailable");
  assert.equal(classifyExistenceProbe({ kind: "thrown", error: { status: 403 } }), "probe_unavailable");
});

test("AC-8 thrown 5xx are probe_unavailable", () => {
  for (const status of [500, 502, 503]) {
    assert.equal(classifyExistenceProbe({ kind: "thrown", error: { status } }), "probe_unavailable");
  }
});

test("AC-9 network/timeout/unknown rejections are probe_unavailable", () => {
  assert.equal(classifyExistenceProbe({ kind: "thrown", error: new Error("fetch failed") }), "probe_unavailable");
  assert.equal(classifyExistenceProbe({ kind: "thrown", error: undefined }), "probe_unavailable");
  assert.equal(classifyExistenceProbe({ kind: "thrown", error: "ETIMEDOUT" }), "probe_unavailable");
});

test("AC-10 malformed resolved shapes are probe_unavailable — never truthiness-classified", () => {
  // data:true with a non-null error is NOT the library's success shape
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: true, error: { status: 500 } }), "probe_unavailable");
  // data:false without an error object proves nothing
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: false, error: null }), "probe_unavailable");
  // data:false with a NON-400/404 error must not be treated as missing
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: false, error: { status: 500 } }), "probe_unavailable");
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: false, error: { status: 401 } }), "probe_unavailable");
  // truthy-but-not-true data is malformed
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: "yes", error: null }), "probe_unavailable");
  assert.equal(classifyExistenceProbe({ kind: "resolved", data: 1, error: null }), "probe_unavailable");
});

/* ── branch decisions ───────────────────────────────────────────────────────── */

test("AC-11 pointed/winner decisions: sign | operator_attention | retry_required", () => {
  assert.equal(decidePointedArtifact("present"), "sign");
  assert.equal(decidePointedArtifact("confirmed_missing"), "operator_attention");
  assert.equal(decidePointedArtifact("probe_unavailable"), "retry_required");
});

test("AC-12 ONLY confirmed_missing can enter stale-row cleanup", () => {
  assert.equal(decideUnpointedCandidate("present"), "attach");
  assert.equal(decideUnpointedCandidate("confirmed_missing"), "cleanup_then_render");
  assert.equal(decideUnpointedCandidate("probe_unavailable"), "retry_required");
  // exhaustive: no other classification exists, and neither remaining branch cleans up
  const cleanupTriggers = (["present", "confirmed_missing", "probe_unavailable"] as const)
    .filter((c) => decideUnpointedCandidate(c) === "cleanup_then_render");
  assert.deepEqual(cleanupTriggers, ["confirmed_missing"]);
});

/* ── race detection + outcome vocabulary ────────────────────────────────────── */

test("AC-13 race detectors match exactly the accepted signals", () => {
  assert.equal(isActiveArtifactUniqueViolation("23505"), true);
  assert.equal(isActiveArtifactUniqueViolation("23503"), false);
  assert.equal(isActiveArtifactUniqueViolation(null), false);
  assert.equal(isPointerConflict("monthly_pdf_pointer_conflict"), true);
  assert.equal(isPointerConflict("monthly_pdf_document_not_canonical"), false);
  assert.equal(isStatementNotIssued("monthly_pdf_statement_not_issued"), true);
  assert.equal(isStatementNotIssued(""), false);
});

test("AC-14 outcome vocabulary distinguishes operator attention from retry", () => {
  assert.ok(describeMonthlyArtifactOutcome("artifact_missing").includes("管理者"));
  assert.ok(describeMonthlyArtifactOutcome("artifact_missing").includes("再試行では解決しません"));
  assert.ok(describeMonthlyArtifactOutcome("storage_error").includes("再試行"));
  assert.ok(!describeMonthlyArtifactOutcome("storage_error").includes("管理者"));
  assert.ok(describeMonthlyArtifactOutcome("cleanup_failed").includes("管理者"));
});
