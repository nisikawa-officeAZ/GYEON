// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — document-file type tests.
//
// Run: node --import tsx --test src/lib/documents/document-file-types.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  documentTypeLabel,
  buildDocumentFileName,
  buildDocumentStoragePath,
  type DocumentType,
} from "./document-file-types";

test("monthly_invoice is a DocumentType with the correct Japanese label", () => {
  const t: DocumentType = "monthly_invoice";
  assert.equal(documentTypeLabel(t), "月次請求書");
});

test("every existing document type is retained without weakening", () => {
  const existing: Record<string, string> = {
    estimate: "見積書",
    completion_report: "作業完了報告書",
    invoice: "請求書",
    product_order: "商品注文書",
  };
  for (const [t, label] of Object.entries(existing)) {
    assert.equal(documentTypeLabel(t as DocumentType), label);
  }
});

test("the file-name and dealer-scoped storage-path helpers support monthly_invoice", () => {
  assert.equal(buildDocumentFileName("monthly_invoice", "MIV-2026-08-00001"), "MIV-2026-08-00001.pdf");
  assert.equal(
    buildDocumentStoragePath("dealer-1", "monthly_invoice", "MIV-2026-08-00001.pdf"),
    "dealer-1/monthly_invoice/MIV-2026-08-00001.pdf",
  );
});
