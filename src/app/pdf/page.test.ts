import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("records PDF entry never renders the legacy mock PDF UI", () => {
  assert.doesNotMatch(source, /PDFPreview/);
  assert.doesNotMatch(source, /デモプレビュー/);
  assert.doesNotMatch(source, /MOCK_PDF_ESTIMATE/);
  assert.doesNotMatch(source, /gyeonId|GyeonServicePdfPreview|getGyeonServicePdfData/);
});

test("PDF index lists tenant-scoped saved estimates and opens the production route", () => {
  assert.match(source, /getEstimates\(\)/);
  assert.match(source, /保存済み見積書/);
  assert.match(source, /href=\{`\/pdf\?estimateId=\$\{encodeURIComponent\(row\.id\)\}`\}/);
  assert.match(source, /<EstimatePdfFrame estimateId=\{estimateId\} \/>/);
});

test("an invalid estimate id fails closed instead of falling back to sample data", () => {
  assert.match(source, /指定された見積書が見つかりません/);
  assert.match(source, /invalidSelection/);
});

test("retired estimate UI implementations are physically absent", () => {
  for (const retiredPath of [
    "src/components/pdf/GyeonServicePdfPreview.tsx",
    "src/lib/pdf/get-gyeon-service-pdf-data.ts",
    "src/components/flow/CustomerVehicleEstimateFlow.tsx",
    "src/components/estimates/mockEstimates.ts",
    "src/components/documents/templates/estimate/EstimateTemplate.tsx",
    "src/components/customers/CustomerList.tsx",
    "src/components/customers/CustomerCard.tsx",
    "src/components/customers/mockCustomers.ts",
    "src/components/vehicles/mockVehicles.ts",
  ]) {
    assert.equal(existsSync(retiredPath), false, `${retiredPath} must stay deleted`);
  }
});
