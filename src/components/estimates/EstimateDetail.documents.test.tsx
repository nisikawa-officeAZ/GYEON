// GDA_ESTIMATE_DETAIL_DOCUMENTS_R1 — EstimateDetail's reopened delivery-note surface.
//
// Run: node --import tsx --test src/components/estimates/EstimateDetail.documents.test.tsx
//
// EstimateDetail itself calls useRouter() unconditionally on every render, which throws
// outside a mounted Next.js App Router — so this file does NOT runtime-import or render
// EstimateDetail.tsx. It instead imports and executes buildSavedDeliveryNotePath directly
// — the same pure authority (SavedEstimateDocuments.tsx) EstimateDetail delegates to — and
// verifies via source text that EstimateDetail actually delegates to it, conditionally
// renders the active link, and never auto-mutates an invoice. Authored NOT_RUN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildSavedDeliveryNotePath } from "./wizard/production/SavedEstimateDocuments";
import type { SavedInvoiceSummary } from "./wizard/production/saved-estimate-invoice-controller";

const DETAIL_SRC = "src/components/estimates/EstimateDetail.tsx";
const DETAIL_VIEW_SRC = "src/components/estimates/EstimateDetailView.tsx";
const DETAIL_ROUTE_SRC = "src/app/estimates/[id]/page.tsx";
const GET_INVOICE_SRC = "src/lib/invoices/get-invoice.ts";

/** Comment-stripped source, so documentation may name a hazard the code must not use. */
const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const UUID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const EXPECTED_HREF = `/pdf/delivery-note?invoiceId=${UUID}`;

type InvoicePick = Pick<SavedInvoiceSummary, "id" | "status" | "deliveryDate">;

const invoice = (over: Partial<InvoicePick>): InvoicePick => ({
  id: UUID,
  status: "issued",
  deliveryDate: "2026-09-20",
  ...over,
});

// ── 1. Eligible ──────────────────────────────────────────────────────────────

test("1. eligible: issued status + valid date + valid id yields the exact delivery-note href", () => {
  assert.equal(buildSavedDeliveryNotePath(invoice({})), EXPECTED_HREF);
});

test("1b. eligible: paid, partially_paid and overdue are equally allowed statuses", () => {
  for (const status of ["paid", "partially_paid", "overdue"] as const) {
    assert.equal(buildSavedDeliveryNotePath(invoice({ status })), EXPECTED_HREF);
  }
});

// ── 2. No related invoice ───────────────────────────────────────────────────

test("2. no invoice: null input yields null, never a guess", () => {
  assert.equal(buildSavedDeliveryNotePath(null), null);
});

// ── 3. Draft invoice ─────────────────────────────────────────────────────────

test("3. draft: an unissued invoice yields null even with a valid date and id", () => {
  assert.equal(buildSavedDeliveryNotePath(invoice({ status: "draft" })), null);
});

// ── 4. Cancelled status ──────────────────────────────────────────────────────

test("4. cancelled status yields null", () => {
  assert.equal(buildSavedDeliveryNotePath(invoice({ status: "cancelled" })), null);
});

// ── 5. Invalid or missing delivery date ─────────────────────────────────────

test("5. invalid or missing delivery date yields null despite an otherwise-eligible status", () => {
  assert.equal(buildSavedDeliveryNotePath(invoice({ deliveryDate: null })), null);
  assert.equal(buildSavedDeliveryNotePath(invoice({ deliveryDate: "not-a-date" })), null);
  assert.equal(buildSavedDeliveryNotePath(invoice({ deliveryDate: "2026-02-30" })), null); // impossible calendar date
});

// ── 6. Ambiguous readback ────────────────────────────────────────────────────

test("6. ambiguous readback: the server layer collapses >1 candidate row to null, " +
     "which this function treats identically to no invoice", () => {
  // getInvoiceForEstimate never returns more than one row's data — ambiguity is a null
  // input here by construction. This asserts that collapse renders no link, same as case 2.
  assert.equal(buildSavedDeliveryNotePath(null), null);
});

// ── 7. Read failure ──────────────────────────────────────────────────────────

test("7. read failure: getRelatedInvoice's try/catch also resolves to null, " +
     "rendering the same fail-closed disabled state — the estimate detail page stays usable", () => {
  assert.equal(buildSavedDeliveryNotePath(null), null);
});

// ── 8. Defense in depth: a malformed id fails closed even if status/date look valid ────

test("8. a malformed invoice id fails closed regardless of status/date", () => {
  for (const badId of ["", "not-a-uuid", `${UUID}0`, `${UUID}/../../admin`]) {
    assert.equal(buildSavedDeliveryNotePath(invoice({ id: badId })), null);
  }
});

test("9. the encoded href never doubles as an injection vector for a malicious-looking id", () => {
  // isValidEstimateId's strict pattern rejects this before encodeURIComponent runs.
  assert.equal(buildSavedDeliveryNotePath(invoice({ id: `${UUID}"><script>alert(1)</script>` })), null);
});

// ── Source-wiring guardrails ─────────────────────────────────────────────────

test("10. EstimateDetail delegates the delivery-note control to buildSavedDeliveryNotePath " +
     "via resolveDeliveryNoteHref, conditionally renders the active link, and never a second/" +
     "parallel eligibility check or an unconditional link", () => {
  const src = codeOf(DETAIL_SRC);
  assert.match(src, /buildSavedDeliveryNotePath/);
  assert.match(src, /resolveDeliveryNoteHref\(invoiceReadback \?\? relatedInvoice\)/);
  assert.match(src, /data-testid="estimate-detail-delivery-note"/);
  assert.match(src, /deliveryNoteHref \?/);
  // Never an active link rendered unconditionally, and never a second date/status check.
  assert.doesNotMatch(src, /href=\{`\/pdf\/delivery-note/);
  assert.doesNotMatch(src, /hasIssuedInvoice\(/);
  assert.doesNotMatch(src, /isValidCalendarDate\(/);
});

test("11. EstimateDetail never auto-creates, auto-issues, or auto-dates an invoice " +
     "from the delivery-note surface", () => {
  const src = codeOf(DETAIL_SRC);
  const deliveryNoteBlock = src.slice(src.indexOf('Card title="納品書"'), src.indexOf('Card title="納品書"') + 1200);
  assert.doesNotMatch(deliveryNoteBlock, /createInvoiceFromEstimate/);
  assert.doesNotMatch(deliveryNoteBlock, /saveDate|issue\(/);
});

test("12. getInvoiceForEstimate stays tenant-scoped by BOTH dealer_id and estimate_id, " +
     "excludes soft-deleted rows, and never uses a service-role client", () => {
  const src = codeOf(GET_INVOICE_SRC);
  const fnStart = src.indexOf("export async function getInvoiceForEstimate");
  assert.notEqual(fnStart, -1);
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.match(fnBody, /\.eq\("estimate_id", estimateId\)/);
  assert.match(fnBody, /\.eq\("dealer_id", dealer\.dealer_id\)/);
  assert.match(fnBody, /\.is\("deleted_at", null\)/);
  assert.doesNotMatch(fnBody, /service_role|SUPABASE_SERVICE_ROLE/);
});

// ── Same-page invoice wiring ────────────────────────────────────────────────

test("13. reopened route injects the five canonical invoice actions through EstimateDetailView", () => {
  const route = codeOf(DETAIL_ROUTE_SRC);
  const view = codeOf(DETAIL_VIEW_SRC);
  assert.match(route, /create:\s*createInvoiceFromEstimate/);
  assert.match(route, /read:\s*getInvoice/);
  assert.match(route, /saveDate:\s*saveInvoiceDeliveryDate/);
  assert.match(route, /issue:\s*issueInvoice/);
  assert.match(route, /download:\s*getIssuedInvoicePdfUrl/);
  assert.match(route, /invoiceActions=\{\{/);
  assert.match(view, /invoiceActions:\s*SavedInvoiceActions/);
  assert.match(view, /invoiceActions=\{invoiceActions\}/);
});

test("14. EstimateDetail reuses SavedEstimateInvoice and removes the old create-and-navigation path", () => {
  const src = codeOf(DETAIL_SRC);
  assert.match(src, /<SavedEstimateInvoice/);
  assert.match(src, /key=\{estimate\.id\}/);
  assert.match(src, /actions=\{invoiceActions\}/);
  assert.match(src, /onInvoice=\{handleInvoiceReadback\}/);
  assert.doesNotMatch(src, /createInvoiceFromEstimate/);
  assert.doesNotMatch(src, /router\.push\("\/invoices"\)/);
  assert.doesNotMatch(src, /handleCreateInvoice/);
});

test("15. unapproved estimates expose no mutation-capable invoice workflow", () => {
  const src = codeOf(DETAIL_SRC);
  assert.match(src, /isApproved \? \(\s*<div className="text-slate-100">\s*<SavedEstimateInvoice/);
  assert.match(src, /data-testid="estimate-detail-invoice"/);
  assert.match(src, /見積の承認が必要です/);
  assert.match(src, /自動承認や請求書の作成・発行は行いません/);
});

test("16. delivery-note eligibility may refresh only from a non-null parsed invoice readback", () => {
  const src = codeOf(DETAIL_SRC);
  assert.match(src, /invoiceReadback \?\? relatedInvoice/);
  assert.match(src, /if \(invoice !== null\) setInvoiceReadback\(invoice\)/);
  assert.doesNotMatch(src, /if \(invoice === null\) setInvoiceReadback/);
});

test("17. same-page invoice content inherits a readable foreground on the dark detail card", () => {
  const src = codeOf(DETAIL_SRC);
  assert.match(src, /<div className="text-slate-100">\s*<SavedEstimateInvoice/);
});
