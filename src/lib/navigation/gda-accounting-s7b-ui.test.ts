import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GDA_UI_ACCOUNTING_S7B — source-contract guard.
//
// This phase refreshes invoice/payment form interiors, detail panels, nested
// accounting sections, and allocation rows to the accepted TOP v18 / GDA
// premium visual system. It is intentionally source-text only: no React render,
// no Supabase, no DB, no PDF generation, and no business-data access.

const ROOT = process.cwd();
const read = (relPath: string) => readFileSync(join(ROOT, relPath), "utf8");

// Exact eight-path literal allowlist for GDA_UI_ACCOUNTING_S7B_INSTRUCTION_V1.
const PHASE_ALLOWLIST = [
  "src/components/invoices/InvoiceForm.tsx",
  "src/components/invoices/InvoiceDetail.tsx",
  "src/components/invoices/InvoiceSection.tsx",
  "src/components/payments/PaymentForm.tsx",
  "src/components/payments/PaymentDetail.tsx",
  "src/components/payments/PaymentSection.tsx",
  "src/components/payments/AllocationEditor.tsx",
  "src/lib/navigation/gda-accounting-s7b-ui.test.ts",
] as const;

const INVOICE_FORM = read(PHASE_ALLOWLIST[0]);
const INVOICE_DETAIL = read(PHASE_ALLOWLIST[1]);
const INVOICE_SECTION = read(PHASE_ALLOWLIST[2]);
const PAYMENT_FORM = read(PHASE_ALLOWLIST[3]);
const PAYMENT_DETAIL = read(PHASE_ALLOWLIST[4]);
const PAYMENT_SECTION = read(PHASE_ALLOWLIST[5]);
const ALLOCATION_EDITOR = read(PHASE_ALLOWLIST[6]);

const MODIFIED_SOURCES = [
  INVOICE_FORM,
  INVOICE_DETAIL,
  INVOICE_SECTION,
  PAYMENT_FORM,
  PAYMENT_DETAIL,
  PAYMENT_SECTION,
  ALLOCATION_EDITOR,
];

const ALL_PAYMENT_UI = [PAYMENT_FORM, PAYMENT_DETAIL, PAYMENT_SECTION, ALLOCATION_EDITOR].join("\n");

test("phase scope contract: exactly eight literal paths, this test file included", () => {
  assert.equal(PHASE_ALLOWLIST.length, 8);
  assert.equal(new Set(PHASE_ALLOWLIST).size, 8, "no duplicate paths in the allowlist");
  assert.ok(
    PHASE_ALLOWLIST.includes("src/lib/navigation/gda-accounting-s7b-ui.test.ts" as (typeof PHASE_ALLOWLIST)[number]),
    "this test file is itself the eighth allowlisted path",
  );
});

test("protected ScreensPreview and PDF/template paths are not newly referenced by S7B surfaces", () => {
  for (const src of MODIFIED_SOURCES) {
    assert.doesNotMatch(src, /ScreensPreview/);
    assert.doesNotMatch(src, /components\/documents\/templates/);
    assert.doesNotMatch(src, /lib\/pdf\//);
    assert.doesNotMatch(src, /lib\/monthly-statements/);
    assert.doesNotMatch(src, /InvoicePdfPreview/);
  }

  // Existing invoice-detail PDF action is preserved, not expanded into a new
  // PDF implementation surface.
  assert.equal(INVOICE_DETAIL.split("InvoicePdfIssueActions").length - 1, 3);
});

test("all seven modified surfaces carry TOP v18 GDA premium visual tokens", () => {
  for (const src of MODIFIED_SOURCES) {
    assert.match(src, /border-\[#263955\]/);
    assert.match(src, /bg-\[#111826\]/);
    assert.match(src, /rounded-2xl/);
    assert.match(src, /backdrop-blur-xl/);
  }
});

test("forms preserve invoice creation/update/calculation field authority tokens", () => {
  for (const token of [
    "createInvoice",
    "updateInvoice",
    "previewDocumentNumber",
    "calculateInvoiceTotals",
    "items_json",
  ]) {
    assert.match(INVOICE_FORM, new RegExp(token));
  }
});

test("payment form preserves create/update/open-invoice/idempotency/mode authority tokens", () => {
  for (const token of [
    "createPayment",
    "updatePayment",
    "getOpenInvoicesForCustomer",
    "idempotency_key",
    "legacy_direct",
    "allocated",
    "unapplied",
  ]) {
    assert.match(PAYMENT_FORM, new RegExp(token));
  }
});

test("allocation and conversion authority tokens remain present", () => {
  assert.match(PAYMENT_DETAIL, /getPaymentAllocations/);
  assert.match(PAYMENT_DETAIL, /convertPaymentToAllocated/);
  assert.match(PAYMENT_DETAIL, /validateAllocations/);
  assert.match(ALLOCATION_EDITOR, /proposeOldestDueFirst/);
  assert.match(ALLOCATION_EDITOR, /validateAllocations/);
});

test("critical callback tokens remain present across form, detail, and nested sections", () => {
  const all = MODIFIED_SOURCES.join("\n");
  for (const token of [
    "onCancel",
    "onSuccess",
    "onClose",
    "onEdit",
    "onConverted",
    "onInvoiceChange",
    "onPaymentSaved",
  ]) {
    assert.match(all, new RegExp(token));
  }
});

test("payment UI does not introduce delete flows", () => {
  assert.doesNotMatch(ALL_PAYMENT_UI, /deletePayment/);
  assert.doesNotMatch(ALL_PAYMENT_UI, /onDelete/);
  assert.doesNotMatch(ALL_PAYMENT_UI, /削除/);
});

test("edit restrictions remain visible and unchanged in intent", () => {
  assert.match(INVOICE_DETAIL, /editing is a draft-only privilege/);
  assert.match(INVOICE_DETAIL, /invoiceData\.status === "draft"/);
  assert.match(PAYMENT_FORM, /EDIT: notes \/ internal_memo only/);
  assert.match(PAYMENT_FORM, /金額・日付などの金銭項目は登録後に変更できません/);
});

test("nested sections preserve list/create/edit/detail view-state transitions", () => {
  for (const src of [INVOICE_SECTION, PAYMENT_SECTION]) {
    assert.match(src, /mode: "list"/);
    assert.match(src, /mode: "create"/);
    assert.match(src, /mode: "edit"/);
    assert.match(src, /mode: "detail"/);
    assert.match(src, /refresh\(\)/);
  }
});
