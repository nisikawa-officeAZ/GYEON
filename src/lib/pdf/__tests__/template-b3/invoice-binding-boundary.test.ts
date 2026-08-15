// TEMPLATE-B3 source-boundary + unit tests for the native invoice binding.
//
// Run: node --import tsx --test src/lib/pdf/__tests__/template-b3/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildInvoiceChromiumContext } from "../../chromium-document/invoice-document-context";
import { toInvoiceDocumentData } from "../../invoice-document-data";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import type { BrandProfile } from "@/components/documents/types";

const ROOT = process.cwd();
const DESIGN = path.join(ROOT, "src/lib/pdf/design/premium");
const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const HTML = read(path.join(DESIGN, "invoice-a4-compact.html"));
const ISSUE = read(path.join(ROOT, "src/lib/invoices/issue-invoice.ts"));

test("B3-1 the invoice HTML is native: no doc-variant dependency, invoice labels baked in", () => {
  assert.ok(!HTML.includes("doc-variant"), "doc-variant.js must not be referenced");
  assert.ok(HTML.includes('data-doc-kind="invoice"'), "body must be an invoice before any JS runs");
  // The ACCEPTED validation pixels render the grand total in the BASE geometry (GRAND TOTAL on its
  // own top line inside the 68mm box). The body.doc-kind-invoice override rules produce a
  // different, self-overflowing grid (labels column + value exceed the fixed box) and were
  // demonstrably inactive in the accepted renders — so the native page must NOT activate them.
  assert.ok(!HTML.includes("doc-kind-invoice"), "the doc-kind-invoice CSS mode must stay inactive (accepted geometry)");
  assert.ok(!HTML.includes("doc-grand-total--invoice"), "the grand total uses the accepted base structure");
  for (const label of ["請求書", "Invoice &nbsp;/&nbsp; Billing Statement", "下記の通りご請求申し上げます", "Invoice No.", "Payment Due", "Billing To", "請求先", "対象車両", "Billing Items", "請求内容", "ご請求金額"]) {
    assert.ok(HTML.includes(label), `native invoice label missing: ${label}`);
  }
});

test("B3-2 estimate-only labels are absent", () => {
  for (const forbidden of ["見積書", "Estimate &nbsp;/&nbsp;", "お見積り申し上げます", "Estimate No.", "Valid Until", "施工内容・製品", "Services &amp; Products", "合計金額"]) {
    assert.ok(!HTML.includes(forbidden), `estimate-only content leaked: ${forbidden}`);
  }
  assert.ok(!/SENT|PREPARED BY|draft/i.test(HTML), "status chips / watermarks must be absent");
});

test("B3-3 QR elements and QR inputs are absent; grand-total geometry container retained", () => {
  assert.ok(!HTML.includes("qr-item") && !HTML.includes("qr-icon") && !HTML.includes("qr-code"), "QR elements must be absent");
  assert.ok(!HTML.includes("doc-qr.js"), "doc-qr must not load");
  assert.ok(HTML.includes('doc-footer-v2__qr-list" style="visibility: hidden;"'), "the empty hidden list preserves the accepted grand-total geometry");
  const ctx = read(path.join(ROOT, "src/lib/pdf/chromium-document/invoice-document-context.ts"));
  assert.ok(!/qrChannels/.test(ctx), "the invoice context has no QR input");
});

test("B3-4 no sample identity, sample values, external URLs, or preview parameters", () => {
  for (const forbidden of ["OFFICE AZ", "office-az", "officeaz", "石井", "紗也華", "フェラーリ", "458 Italia", "名古屋", "2015", "2026.0", "EST-2026", "INV / 2026", "A2F9", "¥2", "¥3", "¥9", "brand-profiles", "qr-live", "stress", "searchParams"]) {
    assert.ok(!HTML.includes(forbidden), `forbidden sample/preview content: ${forbidden}`);
  }
  assert.ok(!HTML.includes("fonts.googleapis") && !/src="https?:/.test(HTML) && !/url\(\s*['"]?https?:/i.test(HTML), "remote dependencies forbidden");
  const dataJs = read(path.join(DESIGN, "invoice-data.js"));
  assert.ok(!dataJs.includes("innerHTML") && !dataJs.includes("fetch("), "binder must be textContent-only and offline");
  assert.ok(dataJs.includes("data-doc-data-error") && dataJs.includes("data-doc-data-ready"), "binder must fail closed");
  const paginate = read(path.join(DESIGN, "invoice-paginate.js"));
  assert.ok(!/CAPACITY_/i.test(paginate) && !paginate.includes("searchParams") && !/stress/i.test(paginate), "pagination must stay measurement-based");
  assert.ok(paginate.includes("document.fonts.ready"), "pagination must wait for fonts");
});

test("B3-5 internal_memo and cost/margin fields are unreachable", () => {
  for (const p of ["src/lib/pdf/invoice-document-data.ts", "src/lib/pdf/chromium-document/invoice-document-context.ts", "src/lib/pdf/render-invoice-document.tsx", "src/lib/pdf/design/premium/invoice-data.js"]) {
    const body = stripComments(read(path.join(ROOT, p)));
    assert.ok(!body.includes("internal_memo") && !body.includes("internalMemo"), `${p} must not touch internal_memo`);
    assert.ok(!/\bmargin\b/i.test(body) && !/dealer_?cost/i.test(body), `${p} must not touch cost/margin`);
  }
});

/* ── adapter + context unit tests over a persisted-shape fixture ─────────── */

const invoice = {
  id: "00000000-0000-4000-8000-000000000001",
  invoice_number: "INV-2026-00031",
  status: "draft",
  issue_date: "2026-08-03",
  due_date: "2026-09-02",
  subtotal: 100000,
  discount_amount: 5000,
  tax_rate: 10,
  tax_amount: 9500,
  total: 104500,
  paid_amount: 0,
  balance_due: 104500,
  notes: "表示価格はすべて税込です。\nお支払期日は発行日から30日以内です。",
  internal_memo: "SECRET-INTERNAL",
  content_version: 3,
  customers: { last_name: "石井", first_name: "紗也華", phone: "052-000-0000", email: "c@example.jp", postal_code: "460-0002", address1: "名古屋市中区丸の内1-2-3", is_business: false },
  vehicles: { maker: "フェラーリ", model: "458 Italia", year: "2015", grade: "Base", plate_number: "名古屋 332 ひ 3830", color: "ロッソコルサ / Red", mileage: 28400 },
  invoice_items: [
    { id: "b", invoice_id: "x", dealer_id: "d", category: "ppf", item_name: "PPF ヘッドライト", description: null, quantity: 2, unit_price: 25000, discount_rate: 0, line_total: 50000, sort_order: 1, created_at: "" },
    { id: "a", invoice_id: "x", dealer_id: "d", category: "coating", item_name: "MOHS EVO", description: "ボディコーティング", quantity: 1, unit_price: 55000, discount_rate: 10, line_total: 49500, sort_order: 0, created_at: "" },
  ],
} as unknown as InvoiceDB;

const brand: BrandProfile = {
  brandId: "b3", brandNameJa: "株式会社テストディテイラー", colors: { primary: "#000" },
  contact: { postalCode: "123-4567", address: "東京都テスト区1-2-3", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {}, qrLinks: [],
};
const LOGO = "data:image/png;base64,AAAA";

test("B3-6 persisted invoice values map value-for-value into the context (no recomputation)", () => {
  const ctx = buildInvoiceChromiumContext(toInvoiceDocumentData(invoice), brand, LOGO);
  const d = ctx.documentData;
  assert.equal(d.docNoDisplay, "INV / 2026 / 00031");
  assert.equal(d.serialHashDisplay, "DOC · INV-2026-00031");
  assert.equal(d.issueDateDisplay, "2026.08.03");
  assert.equal(d.paymentDueDisplay, "2026.09.02");
  assert.equal(d.summary.subtotalDisplay, "¥100,000");
  assert.equal(d.summary.discountDisplay, "−¥5,000");
  assert.equal(d.summary.taxLabelEn, "Tax 10%");
  assert.equal(d.summary.taxDisplay, "¥9,500");
  assert.equal(d.summary.grandTotalDisplay, "¥104,500");
  // stable persisted sort_order: coating (0) before ppf (1)
  assert.deepEqual(d.items.map((i) => i.name), ["MOHS EVO", "PPF ヘッドライト"]);
  assert.equal(d.items[0].discountDisplay, "−¥5,500"); // stored gross 55,000 − stored line_total 49,500
  assert.equal(d.items[1].discountDisplay, undefined);
  assert.equal(d.vehicle.yearDisplay, "2015 年");
  assert.equal(d.vehicle.plate, "名古屋 332 ひ 3830");
  assert.equal(d.vehicle.mileage, "28,400 km");
  assert.equal(d.customer.honorific, "様");
  assert.equal(d.customer.postalCode, "460-0002");
  assert.ok(!JSON.stringify(ctx).includes("SECRET-INTERNAL"), "internal_memo can never reach the context");
  assert.ok(!JSON.stringify(ctx).includes("paid"), "paid/balance are not part of the adopted layout");
});

test("B3-7 missing optional fields are omitted, never invented", () => {
  const bare = { ...invoice, issue_date: null, due_date: null, notes: null, customers: null, vehicles: null } as unknown as InvoiceDB;
  const d = buildInvoiceChromiumContext(toInvoiceDocumentData(bare), brand, LOGO).documentData;
  assert.equal(d.issueDateDisplay, undefined);
  assert.equal(d.paymentDueDisplay, undefined);
  assert.deepEqual(d.notes, []);
  assert.equal(d.customer.postalCode, undefined);
  assert.equal(d.vehicle.name, undefined);
});

test("B3-8 store logo contract: embedded bytes only; non-data URIs throw", () => {
  assert.throws(() => buildInvoiceChromiumContext(toInvoiceDocumentData(invoice), brand, "https://remote.example/x.png"));
  const ctx = buildInvoiceChromiumContext(toInvoiceDocumentData(invoice), brand, LOGO);
  assert.equal(ctx.storeSettings.storeLogoSrc, LOGO);
});

test("B3-9 issuance boundary: renderer after snapshot validation, before upload; invariants pinned", () => {
  const validateAt = ISSUE.indexOf("validateIssuanceSnapshot(");
  const brandAt = ISSUE.indexOf("getBrandProfile(dealerId)");
  const renderAt = ISSUE.indexOf("renderInvoiceDocumentPdf(renderedInvoice");
  const uploadAt = ISSUE.indexOf(".upload(filePath");
  const transitionAt = ISSUE.indexOf('.eq("content_version", renderedContentVersion)');
  assert.ok(validateAt > 0 && brandAt > validateAt && renderAt > brandAt && uploadAt > renderAt && transitionAt > uploadAt,
    "order must be: snapshot validation → brand → render → upload → transition");
  assert.match(ISSUE, /upsert: false/);
  assert.match(ISSUE, /requireStaffCapability\("finance"\)/);
  assert.ok(!/getDealerStampForPdf|getDealerBranding\b/.test(ISSUE), "stamp/raw-branding fetches are gone from issuance");
  assert.ok(!/renderInvoicePdf\(/.test(ISSUE), "the legacy renderer is unreachable from issuance");
});

test("B3-10 issue-invoice reads the address/mileage columns the adopted layout needs", () => {
  assert.match(ISSUE, /postal_code, address1, is_business/);
  assert.match(ISSUE, /plate_number, color, mileage/);
});

test("B3-R1 invoice-scoped dynamic-text containment exists and stays invoice-only", () => {
  const css = read(path.join(DESIGN, "estimate-a4-compact.css"));
  const rawBlock = css.slice(css.indexOf("/* ── TEMPLATE-B3-R1"));
  const block = rawBlock.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(rawBlock.length > 100, "the B3-R1 containment block must exist");
  assert.ok(block.includes('body[data-doc-kind="invoice"] .doc-parties-v2 .doc-party'), "party items must drop min-width:auto");
  for (const sel of [".doc-party__name", ".doc-party__addr", ".doc-party__dl dd", ".rich-cell__name", ".rich-cell__desc", ".note-text"]) {
    assert.ok(block.includes(sel), `containment must cover ${sel}`);
  }
  for (const prop of ["min-width: 0", "max-width: 100%", "white-space: normal", "overflow-wrap: anywhere", "word-break: break-word"]) {
    assert.ok(block.includes(prop), `containment must use ${prop}`);
  }
  // invoice-only: every selector in the block is attribute-scoped; no estimate scoping appears
  const selectorLines = block.split("\n").filter((l) => l.includes("{") && !l.includes("/*"));
  for (const l of selectorLines) {
    assert.ok(l.includes('body[data-doc-kind="invoice"]'), `non-invoice-scoped selector in containment block: ${l.trim()}`);
  }
  assert.ok(!block.includes('data-doc-kind="estimate"'), "containment must not target the estimate");
  // forbidden techniques are absent
  for (const forbidden of ["overflow: hidden", "text-overflow", "ellipsis", "line-clamp", "font-size"]) {
    assert.ok(!block.includes(forbidden), `forbidden containment technique: ${forbidden}`);
  }
});

test("B3-R1b the pre-existing normal invoice geometry rules are byte-unchanged", () => {
  const css = read(path.join(DESIGN, "estimate-a4-compact.css"));
  // the accepted B3 grand-total rules remain exactly as accepted
  assert.ok(css.includes('body[data-doc-kind="invoice"] .doc-grand-total .doc-grand-total__label {\n  white-space: nowrap;\n  overflow: visible;\n}'), "accepted grand-total label rule changed");
  assert.ok(css.includes('body[data-doc-kind="invoice"] .doc-grand-total .doc-grand-total__unit {\n  display: block;\n  margin-left: 0;\n  margin-top: 1px;\n}'), "accepted grand-total unit rule changed");
});
