// TEMPLATE-C2-DN — delivery-note binding boundary + unit tests.
//
// The route/loader/renderer pull in server-only + Chromium modules that cannot resolve under this
// runner, so their auth / tenant / offline / no-persistence guarantees are asserted from source
// text; the pure conversion + adapter are executed against real inputs.
//
// Run: node --import tsx --test src/lib/pdf/__tests__/template-c2/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  deliveryNumberFromInvoiceNumber,
  toDeliveryNoteDocumentData,
} from "../../delivery-note-document-data";
import { buildDeliveryNoteChromiumContext } from "../../chromium-document/delivery-note-document-context";
import { isDeliveryNoteAllowedStatus, DELIVERY_NOTE_ALLOWED_STATUSES } from "../../get-delivery-note-pdf-data";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import type { BrandProfile } from "@/components/documents/types";

const ROOT = process.cwd();
const DESIGN = path.join(ROOT, "src/lib/pdf/design/premium");
const codeOf = (p: string): string =>
  readFileSync(path.join(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const raw = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const ROUTE = "src/app/pdf/delivery-note/route.ts";
const LOADER = "src/lib/pdf/get-delivery-note-pdf-data.ts";
const RENDERER = "src/lib/pdf/render-delivery-note-document.tsx";
const CONTEXT = "src/lib/pdf/chromium-document/delivery-note-document-context.ts";

/* ── delivery-number conversion (pure) ──────────────────────────────────── */

test("DN-1 supported INV numbers convert to DLV preserving the serial", () => {
  assert.equal(deliveryNumberFromInvoiceNumber("INV-2026-00008"), "DLV-2026-00008");
  assert.equal(deliveryNumberFromInvoiceNumber(" INV-2030-12345 "), "DLV-2030-12345");
});

test("DN-2 missing, malformed, hostile, or unsupported invoice numbers fail closed", () => {
  for (const bad of [
    null, undefined, "", "INV-2026-0008", "INV-2026-000008", "INV/2026/00008",
    "EST-2026-00008", "DLV-2026-00008", "INV-ABCD-00008", "INV-2026-0000X",
    "INV-12345678", "<script>INV-2026-00008</script>", "INV-2026-00008; DROP", "inv-2026-00008",
  ]) {
    assert.equal(deliveryNumberFromInvoiceNumber(bad as string), null, `should reject: ${String(bad)}`);
  }
});

/* ── status matrix ──────────────────────────────────────────────────────── */

test("DN-3 allowed and rejected invoice-status matrix", () => {
  assert.deepEqual([...DELIVERY_NOTE_ALLOWED_STATUSES], ["issued", "paid", "partially_paid", "overdue"]);
  for (const s of ["issued", "paid", "partially_paid", "overdue"]) assert.ok(isDeliveryNoteAllowedStatus(s));
  for (const s of ["draft", "cancelled", "", "unknown", null, undefined, 5]) assert.ok(!isDeliveryNoteAllowedStatus(s));
});

/* ── adapter: issued invoice → delivery-note data ───────────────────────── */

const invoice = {
  id: "00000000-0000-4000-8000-000000000001",
  invoice_number: "INV-2026-00031",
  status: "issued",
  issue_date: "2026-08-03",
  due_date: "2026-09-02",
  subtotal: 100000,
  discount_amount: 5000,
  tax_rate: 10,
  tax_amount: 9500,
  total: 104500,
  notes: "表示価格はすべて税込です。\n納品内容・数量をご確認ください。",
  internal_memo: "SECRET-DN-INTERNAL",
  work_order_id: "00000000-0000-4000-8000-0000000000aa",
  work_orders: { work_order_number: "WO-1", title: "t", status: "completed", actual_end_at: "2026-08-01T05:00:00.000Z" },
  customers: { last_name: "石井", first_name: "紗也華", phone: "052-000-0000", email: "c@example.jp", postal_code: "460-0002", address1: "名古屋市中区丸の内1-2-3", is_business: false },
  vehicles: { maker: "フェラーリ", model: "458 Italia", year: "2015", grade: "Base", plate_number: "名古屋 332 ひ 3830", color: "ロッソコルサ / Red", mileage: 28400 },
  invoice_items: [
    { id: "b", invoice_id: "x", dealer_id: "d", category: "ppf", item_name: "PPF ヘッドライト", description: null, quantity: 2, unit_price: 25000, discount_rate: 0, line_total: 50000, sort_order: 1, created_at: "" },
    { id: "a", invoice_id: "x", dealer_id: "d", category: "coating", item_name: "MOHS EVO", description: "ボディコーティング", quantity: 1, unit_price: 55000, discount_rate: 10, line_total: 49500, sort_order: 0, created_at: "" },
  ],
} as unknown as InvoiceDB;

const brand: BrandProfile = {
  brandId: "dn", brandNameJa: "株式会社テストディテイラー", colors: { primary: "#000" },
  contact: { postalCode: "123-4567", address: "東京都テスト区1-2-3", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {}, qrLinks: [],
};
const LOGO = "data:image/png;base64,AAAA";

test("DN-4 the adapter uses issued items and persisted totals, delivery number, and the WO date", () => {
  const data = toDeliveryNoteDocumentData(invoice, "2026-08-01");
  assert.equal(data.serial, "DLV/2026/00031"); // formatDocumentSerial(DLV-2026-00031)
  assert.equal(data.deliveryDate, "2026-08-01");
  assert.deepEqual(data.items.map((i) => i.name), ["MOHS EVO", "PPF ヘッドライト"]); // persisted sort_order
  assert.equal(data.summary.subtotal, 100000);
  assert.equal(data.summary.discount, 5000);
  assert.equal(data.summary.tax, 9500);
  assert.equal(data.summary.grandTotal, 104500);
  assert.equal(data.items[0].amount, 49500);
});

test("DN-5 the adapter never recomputes totals and never reads estimate rows", () => {
  const src = codeOf("src/lib/pdf/delivery-note-document-data.ts");
  assert.ok(!/estimate_items|estimates\b/.test(src), "the delivery-note adapter must not touch estimate data");
  // it reads exactly the persisted invoice aggregate fields, no arithmetic on them
  for (const f of ["invoice.subtotal", "invoice.discount_amount", "invoice.tax_rate", "invoice.tax_amount", "invoice.total"]) {
    assert.ok(src.includes(f), `adapter must read persisted ${f}`);
  }
  assert.ok(!/subtotal\s*[+\-*/]|reduce\(/.test(src), "adapter must not recompute the summary");
});

test("DN-6 the adapter fails closed on an unsupported number or a missing delivery date", () => {
  assert.throws(() => toDeliveryNoteDocumentData({ ...invoice, invoice_number: "EST-2026-00031" } as InvoiceDB, "2026-08-01"));
  assert.throws(() => toDeliveryNoteDocumentData(invoice, ""));
  assert.throws(() => toDeliveryNoteDocumentData(invoice, "   "));
});

test("DN-7 delivery date comes only from the WO date; no current clock in document data", () => {
  const src = codeOf("src/lib/pdf/delivery-note-document-data.ts") + codeOf(LOADER) + codeOf(CONTEXT);
  assert.ok(!/Date\.now|new Date\(\)|toISOString\(\)/.test(src), "document data must not read the current clock");
  const loader = codeOf(LOADER);
  assert.ok(loader.includes("actual_end_at"), "the loader must source the delivery date from work_orders.actual_end_at");
  assert.ok(!/issue_date.*deliveryDate|report_date/.test(loader), "no issue_date/report_date substitution");
});

test("DN-8 internal_memo cannot reach the delivery-note document data or context", () => {
  const data = toDeliveryNoteDocumentData(invoice, "2026-08-01");
  assert.ok(!JSON.stringify(data).includes("SECRET-DN-INTERNAL"));
  const ctx = buildDeliveryNoteChromiumContext(data, brand, LOGO);
  assert.ok(!JSON.stringify(ctx).includes("SECRET-DN-INTERNAL"));
  const src = codeOf("src/lib/pdf/delivery-note-document-data.ts") + codeOf(CONTEXT);
  assert.ok(!/internal_memo|internalMemo|\bmargin\b|dealer_?cost/i.test(src));
});

test("DN-9 context: store logo must be embedded bytes; honorific derives from party kind", () => {
  const ctx = buildDeliveryNoteChromiumContext(toDeliveryNoteDocumentData(invoice, "2026-08-01"), brand, LOGO);
  assert.equal(ctx.storeSettings.storeLogoSrc, LOGO);
  assert.equal(ctx.documentData.customer.honorific, "様");
  assert.throws(() => buildDeliveryNoteChromiumContext(toDeliveryNoteDocumentData(invoice, "2026-08-01"), brand, "https://x/logo.png"));
  const corp = buildDeliveryNoteChromiumContext(
    toDeliveryNoteDocumentData({ ...invoice, customers: { ...invoice.customers, is_business: true } } as InvoiceDB, "2026-08-01"),
    brand, LOGO,
  );
  assert.equal(corp.documentData.customer.honorific, "御中");
});

/* ── route: auth, tenant isolation, no service role, no persistence ─────── */

test("DN-10 the route resolves the dealer server-side and never accepts a client dealer id", () => {
  const src = codeOf(ROUTE);
  assert.ok(src.includes("getCurrentDealer()"), "dealer must come from the session");
  assert.ok(!/searchParams\.get\(\s*["'`]dealer/i.test(src), "dealer_id must never come from the query");
  assert.ok(src.includes('runtime = "nodejs"') && src.includes('dynamic = "force-dynamic"'), "route must be nodejs force-dynamic");
  assert.ok(src.includes('"Cache-Control": "no-store"') && src.includes('"Content-Type": "application/pdf"'), "no-store application/pdf");
  assert.ok(/status:\s*401/.test(src) && /status:\s*400/.test(src) && /status:\s*404/.test(src) && /status:\s*500/.test(src), "coarse status codes");
});

test("DN-11 the loader is RLS-scoped by dealer id AND invoice id, never service-role", () => {
  const src = codeOf(LOADER);
  assert.ok(src.includes('createClient'), "must use the caller's RLS-scoped client");
  assert.ok(!/createAdminClient|service_role|service-role/i.test(src), "the download path must not use the admin/service-role client");
  assert.ok(src.includes('.eq("id", invoiceId)') && src.includes('.eq("dealer_id", dealerId)'), "query scoped by invoice id AND dealer id");
  assert.ok(src.includes('.is("deleted_at", null)'), "soft-deleted invoices excluded");
  // dealer A ≠ dealer B: a foreign invoice resolves to not_found (single coarse reason)
  assert.ok(src.includes('kind: "not_found"'), "foreign/missing invoice → not_found");
  assert.ok(src.includes('kind: "not_eligible"'), "status/number/work-order/date gate → not_eligible");
});

test("DN-12 no Storage upload, document_files write, signed URL, or invoice-state transition", () => {
  const all = codeOf(ROUTE) + codeOf(LOADER) + codeOf(RENDERER) + codeOf("src/lib/pdf/delivery-note-document-data.ts") + codeOf(CONTEXT);
  for (const forbidden of [".upload(", ".createSignedUrl(", "document_files", ".storage", "issueInvoice", ".update(", ".insert(", ".delete(", "upsert"]) {
    assert.ok(!all.includes(forbidden), `delivery-note chain must not perform ${forbidden}`);
  }
});

/* ── renderer + design binding ──────────────────────────────────────────── */

test("DN-13 the renderer is offline and uses the shared Chromium foundation", () => {
  const src = codeOf(RENDERER);
  assert.ok(src.includes("renderChromiumDocumentPdf"), "must delegate to the shared Chromium renderer");
  assert.ok(src.includes('templateFile: "delivery-note-a4-compact.html"'), "must render the native delivery-note template");
  assert.ok(src.includes("resolveStoreLogoDataUri"), "logo via the shared store-logo resolver");
  assert.ok(!src.includes("@react-pdf"), "no react-pdf");
});

test("DN-14 native delivery-note HTML: adopted labels, no doc-variant, no sample identity", () => {
  const html = raw("src/lib/pdf/design/premium/delivery-note-a4-compact.html");
  assert.ok(!html.includes("doc-variant"), "must not depend on doc-variant.js");
  assert.ok(html.includes('data-doc-kind="delivery"'), "native delivery document before any JS runs");
  for (const label of ["納品書", "Delivery Note &nbsp;/&nbsp; Completion Record", "下記の通り納品いたしました", "Delivery No.", "Recipient", "納品先", "Delivered Items", "納品内容", "Delivery Date"]) {
    assert.ok(html.includes(label), `native delivery-note label missing: ${label}`);
  }
  for (const forbidden of ["見積書", "Estimate No.", "Valid Until", "お見積り", "OFFICE AZ", "office-az", "石井", "フェラーリ", "名古屋", "EST-2026", "A2F9", "qr-live", "SENT", "PREPARED BY"]) {
    assert.ok(!html.includes(forbidden), `forbidden content in delivery-note HTML: ${forbidden}`);
  }
  assert.ok(!html.includes("fonts.googleapis") && !/src="https?:/.test(html) && !/url\(\s*['"]?https?:/i.test(html), "offline only");
});

test("DN-15 the binder uses textContent only, fails closed, and pagination is measurement-based", () => {
  const data = raw("src/lib/pdf/design/premium/delivery-note-data.js");
  assert.ok(!data.includes("innerHTML") && !data.includes("document.write") && !data.includes("fetch("), "textContent-only, offline");
  assert.ok(data.includes("data-doc-data-error") && data.includes("data-doc-data-ready"), "fail-closed handshake");
  assert.ok(data.includes("d.deliveryDateDisplay"), "binds the delivery date");
  const paginate = raw("src/lib/pdf/design/premium/delivery-note-paginate.js");
  assert.ok(!/CAPACITY_/i.test(paginate) && !paginate.includes("searchParams") && !/stress/i.test(paginate), "measurement-based, no URL params");
  assert.ok(paginate.includes("scrollHeight <= page.clientHeight") && paginate.includes("document.fonts.ready"), "measured fit + fonts.ready");
});

test("DN-16 the new CSS block is delivery-only and leaves estimate/invoice geometry untargeted", () => {
  const css = raw(path.join("src/lib/pdf/design/premium", "estimate-a4-compact.css"));
  const start = css.indexOf("/* ── TEMPLATE-C2-DN");
  const after = css.indexOf("/* ── TEMPLATE-B3-R1", start);
  const rawBlock = css.slice(start, after === -1 ? undefined : after);
  assert.ok(rawBlock.length > 100, "the delivery-note containment block must exist");
  const block = rawBlock.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const l of block.split("\n").filter((x) => x.includes("{"))) {
    assert.ok(l.includes('body[data-doc-kind="delivery"]'), `non-delivery-scoped selector: ${l.trim()}`);
  }
  assert.ok(!/data-doc-kind="estimate"|data-doc-kind="invoice"/.test(block), "must not target estimate/invoice");
  for (const forbidden of ["overflow: hidden", "text-overflow", "ellipsis", "line-clamp", "font-size"]) {
    assert.ok(!block.includes(forbidden), `forbidden containment technique: ${forbidden}`);
  }
});

/* ── UI ──────────────────────────────────────────────────────────────────── */

test("DN-17 the UI action is gated on allowed status + completion date and never mutates the invoice", () => {
  const ui = codeOf("src/components/invoices/InvoicePdfIssueActions.tsx");
  assert.ok(ui.includes('["issued", "paid", "partially_paid", "overdue"]'), "delivery-note allowed-status list");
  assert.ok(/deliveryNoteAllowed\s*&&\s*hasCompletionDate/.test(ui), "action requires allowed status AND a completion date");
  assert.ok(ui.includes("/pdf/delivery-note?invoiceId="), "action opens the authenticated delivery-note route");
  assert.ok(/deliveryNoteAllowed\s*&&\s*!hasCompletionDate/.test(ui), "missing-date guidance branch");
  assert.ok(ui.includes("作業完了日を登録"), "the guidance explains the missing completion date");
  // the delivery-note control is a plain anchor to the route — no onClick, no issuance call
  const dnStart = ui.indexOf("deliveryNoteAllowed && hasCompletionDate");
  const dnEnd = ui.indexOf("納品書を表示", dnStart) + 40;
  const dnRegion = ui.slice(dnStart, dnEnd);
  assert.ok(dnRegion.includes("/pdf/delivery-note?invoiceId="), "the DN control links to the route");
  assert.ok(!/onClick|issueInvoice|\.update\(|run\(/.test(dnRegion), "the DN control performs no invoice mutation");
});

/* ── TEMPLATE-C2-DN-R1: string-to-HTML exclusion + correct issued-invoice source claim ────── */

test("DN-R1a the delivery-note binder and paginator contain no string-to-HTML APIs", () => {
  const scripts = [
    raw("src/lib/pdf/design/premium/delivery-note-data.js"),
    raw("src/lib/pdf/design/premium/delivery-note-paginate.js"),
  ];
  for (const src of scripts) {
    for (const api of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "insertAdjacentText"]) {
      // insertAdjacentText is safe, but document.write / *HTML are not — check the HTML-injecting set
      if (api === "insertAdjacentText") continue;
      assert.ok(!src.includes(api), `delivery-note script must not use ${api}`);
    }
  }
});

test("DN-R1b the paginator clears the table body with replaceChildren, not innerHTML", () => {
  const paginate = raw("src/lib/pdf/design/premium/delivery-note-paginate.js");
  assert.ok(paginate.includes("tbody.replaceChildren()"), "the table-body clear must use replaceChildren");
  assert.ok(!paginate.includes("innerHTML"), "no innerHTML clear may remain");
});

test("DN-R1c the binder header documents the issued-invoice source, not an EstimateDB snapshot", () => {
  const data = raw("src/lib/pdf/design/premium/delivery-note-data.js");
  assert.ok(!data.includes("EstimateDB"), "the incorrect EstimateDB source claim must be gone");
  assert.ok(/issued-invoice projection/i.test(data), "the header must document the issued-invoice source");
});
