// TEMPLATE-C2-WR — work-report binding boundary + unit tests.
//
// The route/loader/renderer pull in server-only + Chromium modules that cannot resolve under this
// runner, so their auth / tenant / offline / no-persistence / monetary-exclusion guarantees are
// asserted from source text; the pure adapter + context are executed against real inputs.
//
// Run: node --import tsx --test src/lib/pdf/__tests__/template-c2/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toWorkReportDocumentData, type WorkReportSource } from "../../work-report-document-data";
import { buildWorkReportChromiumContext } from "../../chromium-document/work-report-document-context";
import type { BrandProfile } from "@/components/documents/types";

const ROOT = process.cwd();
const DESIGN = path.join(ROOT, "src/lib/pdf/design/premium");
const codeOf = (p: string): string =>
  readFileSync(path.join(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const raw = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const LOADER = "src/lib/pdf/get-work-report-pdf-data.ts";
const DATA = "src/lib/pdf/work-report-document-data.ts";
const CONTEXT = "src/lib/pdf/chromium-document/work-report-document-context.ts";
const RENDERER = "src/lib/pdf/render-work-report-document.tsx";
const ROUTE = "src/app/pdf/work-report/route.ts";
const HTML = "src/lib/pdf/design/premium/work-report-a4-compact.html";
const BINDER = "src/lib/pdf/design/premium/work-report-data.js";
const PAGINATE = "src/lib/pdf/design/premium/work-report-paginate.js";

// The complete monetary-exclusion tokens. The chain must be structurally unable to carry any.
const MONETARY = [
  "quantity", "unit_price", "discount_rate", "line_total", "subtotal", "discount_amount",
  "tax_rate", "tax_amount", "total", "paid_amount", "balance_due", "cost", "margin", "price", "amount",
];

const source: WorkReportSource = {
  reportNumber: "RPT-2026-00007",
  reportDate: "2026-08-04",
  workDate: "2026-08-04T09:30:00+09:00",
  customerMessage: "本日は作業内容をご確認いただきありがとうございます。\n今後のメンテナンスは別途ご案内します。",
  customer: { last_name: "石井", first_name: "紗也華", postal_code: "460-0002", address1: "名古屋市中区丸の内1-2-3", phone: "052-000-0000", email: "c@example.jp", is_business: false },
  vehicle: { maker: "フェラーリ", model: "458 Italia", year: "2015", grade: "Base", plate_number: "名古屋 332 ひ 3830", color: "ロッソコルサ / Red", mileage: 28400 },
  items: [
    { category: "ppf", item_name: "PPF ヘッドライト", description: "Headlight Protection Film", sort_order: 1 },
    { category: "coating", item_name: "MOHS EVO", description: "ボディコーティング", sort_order: 0 },
  ],
};
const brand: BrandProfile = {
  brandId: "wr", brandNameJa: "株式会社テストディテイラー", colors: { primary: "#000" },
  contact: { postalCode: "123-4567", address: "東京都テスト区1-2-3", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {}, qrLinks: [],
};
const LOGO = "data:image/png;base64,AAAA";

/* ── monetary exclusion (the core contract) ─────────────────────────────── */

test("WR-1 the entire work-report chain is structurally monetary-free", () => {
  for (const p of [DATA, CONTEXT, RENDERER, ROUTE, LOADER]) {
    const code = codeOf(p);
    for (const tok of MONETARY) {
      assert.ok(!new RegExp(`\\b${tok}\\b`).test(code), `${p} references forbidden monetary token: ${tok}`);
    }
  }
  const html = raw(HTML);
  for (const tok of ["¥", "単価", "数量", "小計", "消費税", "値引", "合計", "Unit Price", "Qty", "Discount", "Subtotal", "doc-summary-v2", "doc-grand-total"]) {
    assert.ok(!html.includes(tok), `work-report HTML contains monetary element: ${tok}`);
  }
  const binder = codeOf(BINDER);
  for (const tok of MONETARY) assert.ok(!new RegExp(`\\b${tok}\\b`).test(binder), `binder references ${tok}`);
});

test("WR-2 the chain never reuses the monetary completion model or renderer", () => {
  const all = codeOf(DATA) + codeOf(CONTEXT) + codeOf(RENDERER) + codeOf(ROUTE) + codeOf(LOADER);
  for (const forbidden of ["CompletionReportFullData", "generate-completion-report-pdf", "generateCompletionReportPdf", "completion-report-pdf", "@react-pdf"]) {
    assert.ok(!all.includes(forbidden), `chain must not reuse ${forbidden}`);
  }
});

test("WR-3 the loader selects only non-monetary estimate-item columns", () => {
  const code = codeOf(LOADER);
  // estimate_items projection is exactly category / item_name / description / sort_order
  const m = /estimate_items\s*\(([^)]*)\)/.exec(code);
  assert.ok(m, "the loader must project estimate_items");
  const cols = m![1].replace(/\s/g, "").split(",").filter(Boolean).sort();
  assert.deepEqual(cols, ["category", "description", "item_name", "sort_order"]);
});

/* ── adapter + context ──────────────────────────────────────────────────── */

test("WR-4 the adapter maps non-monetary rows in persisted sort_order", () => {
  const d = toWorkReportDocumentData(source);
  assert.equal(d.serial, "RPT/2026/00007");
  assert.equal(d.issueDate, "2026-08-04");
  assert.equal(d.workDate, "2026-08-04T09:30:00+09:00");
  assert.deepEqual(d.items.map((i) => i.name), ["MOHS EVO", "PPF ヘッドライト"]); // sort_order 0,1
  assert.deepEqual(Object.keys(d.items[0]).sort(), ["category", "description", "name"]);
  assert.equal(d.notes.length, 2);
});

test("WR-5 dates come only from report_date and actual_end_at; no clock", () => {
  const src = codeOf(DATA) + codeOf(LOADER) + codeOf(CONTEXT);
  assert.ok(!/Date\.now|new Date\(\)|toISOString\(\)/.test(src), "no current clock");
  const loader = codeOf(LOADER);
  assert.ok(loader.includes("report_date") && loader.includes("actual_end_at"), "report_date + actual_end_at are the sources");
  assert.ok(!/created_at|updated_at|scheduled_end_at|issue_date/.test(loader), "no forbidden date fallback");
});

test("WR-6 internal_memo and cost/margin are unreachable", () => {
  const d = toWorkReportDocumentData(source);
  assert.ok(!JSON.stringify(d).toLowerCase().includes("internal"));
  const ctx = buildWorkReportChromiumContext(d, brand, LOGO);
  assert.ok(!JSON.stringify(ctx).toLowerCase().includes("internal"));
  const src = codeOf(DATA) + codeOf(CONTEXT) + codeOf(LOADER);
  assert.ok(!/internal_memo|internalMemo/.test(src), "internal_memo must never be selected or mapped");
});

test("WR-7 the adapter fails closed on a missing number or either date", () => {
  assert.throws(() => toWorkReportDocumentData({ ...source, reportNumber: "" }));
  assert.throws(() => toWorkReportDocumentData({ ...source, reportDate: "" }));
  assert.throws(() => toWorkReportDocumentData({ ...source, workDate: "   " }));
});

test("WR-8 context: store logo must be embedded bytes; honorific derives from party kind; no summary", () => {
  const ctx = buildWorkReportChromiumContext(toWorkReportDocumentData(source), brand, LOGO);
  assert.equal(ctx.storeSettings.storeLogoSrc, LOGO);
  assert.equal(ctx.documentData.customer.honorific, "様");
  assert.equal(ctx.documentData.workDateDisplay, "2026.08.04");
  assert.ok(!("summary" in ctx.documentData), "the work-report context has no summary");
  assert.throws(() => buildWorkReportChromiumContext(toWorkReportDocumentData(source), brand, "https://x/logo.png"));
  const corp = buildWorkReportChromiumContext(toWorkReportDocumentData({ ...source, customer: { ...source.customer!, is_business: true } }), brand, LOGO);
  assert.equal(corp.documentData.customer.honorific, "御中");
});

/* ── loader eligibility + route ─────────────────────────────────────────── */

test("WR-9 the loader gates completion status, dates, number, estimate and >=1 item, all fail-closed", () => {
  const code = codeOf(LOADER);
  assert.ok(code.includes('wo.status !== "completed"'), "work order must be completed");
  assert.ok(code.includes("actual_end_at") && code.includes("report_date") && code.includes("report_number"), "date/number gates");
  assert.ok(code.includes("estimate_id") && code.includes("items.length === 0"), "estimate + at least one item");
  assert.ok(code.includes('kind: "not_found"') && code.includes('kind: "not_eligible"'), "coarse fail-closed outcomes");
  assert.ok(code.includes('.eq("id", reportId)') && code.includes('.eq("dealer_id", dealerId)'), "scoped by report id AND dealer id");
  assert.ok(code.includes("createClient") && !/createAdminClient|service_role|service-role/i.test(code), "RLS client, never service-role");
});

test("WR-10 the route: nodejs force-dynamic, application/pdf, private no-store, coarse statuses, no persistence", () => {
  const code = codeOf(ROUTE);
  assert.ok(code.includes('runtime = "nodejs"') && code.includes('dynamic = "force-dynamic"'));
  assert.ok(code.includes('"Content-Type": "application/pdf"') && code.includes('"Cache-Control": "private, no-store"'));
  assert.ok(code.includes("getCurrentDealer()") && !/searchParams\.get\(\s*["'`]dealer/i.test(code), "session dealer only");
  assert.ok(/status:\s*401/.test(code) && /status:\s*404/.test(code) && /status:\s*500/.test(code), "coarse statuses");
  const all = code + codeOf(LOADER) + codeOf(RENDERER) + codeOf(DATA) + codeOf(CONTEXT);
  for (const forbidden of [".upload(", ".createSignedUrl(", "document_files", ".storage", ".update(", ".insert(", ".delete(", "upsert"]) {
    assert.ok(!all.includes(forbidden), `work-report chain must not ${forbidden}`);
  }
});

/* ── native design + safe DOM ───────────────────────────────────────────── */

test("WR-11 native work-report HTML: adopted labels, 2-column table, no doc-variant, no monetary section", () => {
  const html = raw(HTML);
  assert.ok(!html.includes("doc-variant"), "no doc-variant.js dependency");
  assert.ok(html.includes('data-doc-kind="work_report"'), "native work-report document before any JS");
  for (const label of ["作業内容書", "Work Report", "Work Date", "Category", "Work / Service Details", "作業内容"]) {
    assert.ok(html.includes(label), `native work-report label missing: ${label}`);
  }
  assert.ok(html.includes("work-report-table") && html.includes("work-item-name") && html.includes("work-item-description"), "2-column WR table");
  for (const forbidden of ["見積書", "請求書", "納品書", "Estimate No.", "Invoice No.", "Delivery No.", "OFFICE AZ", "石井", "フェラーリ", "MOHS EVO", "qr-live"]) {
    assert.ok(!html.includes(forbidden), `forbidden content in work-report HTML: ${forbidden}`);
  }
  assert.ok(!html.includes("fonts.googleapis") && !/src="https?:/.test(html) && !/url\(\s*['"]?https?:/i.test(html), "offline only");
});

test("WR-12 binder + paginator: textContent-only, replaceChildren, no string-to-HTML, measurement pagination", () => {
  for (const p of [BINDER, PAGINATE]) {
    const src = raw(p);
    for (const api of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"]) {
      assert.ok(!src.includes(api), `${p} must not use ${api}`);
    }
  }
  const binder = raw(BINDER);
  assert.ok(binder.includes("replaceChildren") && binder.includes("data-doc-data-error") && binder.includes("data-doc-data-ready"), "safe clear + fail-closed handshake");
  assert.ok(binder.includes("d.workDateDisplay"), "binds the work date");
  const paginate = raw(PAGINATE);
  assert.ok(!/CAPACITY_/i.test(paginate) && !paginate.includes("searchParams") && !/stress/i.test(paginate), "measurement-based, no URL params");
  assert.ok(paginate.includes("scrollHeight <= page.clientHeight") && paginate.includes("document.fonts.ready") && paginate.includes("replaceChildren"), "measured fit + fonts.ready + safe clear");
});

test("WR-13 the new CSS block is work-report-only and leaves other documents untargeted", () => {
  const css = raw("src/lib/pdf/design/premium/estimate-a4-compact.css");
  const start = css.indexOf("/* ── TEMPLATE-C2-WR");
  // end at whichever accepted block marker comes next (C2-DN or B3-R1), so this slice is WR-only.
  const nextDn = css.indexOf("/* ── TEMPLATE-C2-DN", start + 1);
  const nextB3 = css.indexOf("/* ── TEMPLATE-B3-R1", start + 1);
  const ends = [nextDn, nextB3].filter((i) => i !== -1);
  const after = ends.length ? Math.min(...ends) : -1;
  const rawBlock = css.slice(start, after === -1 ? undefined : after);
  assert.ok(rawBlock.length > 100, "the work-report containment block must exist");
  const block = rawBlock.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const l of block.split("\n").filter((x) => x.includes("{"))) {
    assert.ok(l.includes('body[data-doc-kind="work_report"]'), `non-work-report-scoped selector: ${l.trim()}`);
  }
  assert.ok(!/data-doc-kind="invoice"|data-doc-kind="delivery"|data-doc-kind="estimate"/.test(block), "must not target other documents");
  for (const forbidden of ["overflow: hidden", "text-overflow", "ellipsis", "line-clamp", "font-size"]) {
    assert.ok(!block.includes(forbidden), `forbidden containment technique: ${forbidden}`);
  }
});

/* ── UI ──────────────────────────────────────────────────────────────────── */

test("WR-14 the completion-report UI replaces window.print + legacy generator with the authenticated route", () => {
  const ui = codeOf("src/components/completion-reports/CompletionReportSection.tsx");
  assert.ok(!ui.includes("window.print"), "the window.print PDF path must be gone");
  assert.ok(!ui.includes("generateCompletionReportPdf") && !ui.includes("DocumentPdfActions"), "the legacy monetary generator must be gone");
  assert.ok(ui.includes("/pdf/work-report?reportId="), "links to the authenticated work-report route");
  assert.ok(ui.includes("&download=1"), "download link present");
  assert.ok(/status === "completed"/.test(ui) && ui.includes("actual_end_at"), "gated on completed WO + completion date");
  assert.ok(ui.includes("作業内容書を表示") && ui.includes("作業内容書をダウンロード"), "adopted action labels");
});

/* ── C2-WR-R1 long-text wrapping regression (the effective high-specificity rules) ── */

// Extract the declaration body of the HIGH-SPECIFICITY work-report rule for a leaf class.
// This is the rule that actually wins the cascade for .work-item-name / .work-item-description;
// asserting on it (not a weaker override) is what proves the clip regression cannot return.
const wrHiRuleBody = (leaf: string): string => {
  const css = raw("src/lib/pdf/design/premium/estimate-a4-compact.css");
  const sel = `body.doc-kind-work-report .doc-table-v2.work-report-table .${leaf}`;
  const i = css.indexOf(sel);
  assert.ok(i !== -1, `the high-specificity work-report rule for .${leaf} must exist`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  assert.ok(open !== -1 && close !== -1 && close > open, `malformed rule for .${leaf}`);
  return css.slice(open + 1, close);
};

// A shrinkable + wrapping-capable rule body: shrink allowed, min-width:0, soft-wrap enabled,
// and NEITHER of the two clip-causing declarations present.
const assertShrinkableWrapping = (body: string, leaf: string) => {
  assert.ok(!/white-space\s*:\s*nowrap/.test(body), `.${leaf} must not declare white-space: nowrap`);
  assert.ok(!/flex\s*:\s*0\s+0\s+auto/.test(body), `.${leaf} must not declare flex: 0 0 auto (unshrinkable)`);
  assert.ok(/white-space\s*:\s*normal/.test(body), `.${leaf} must wrap: white-space: normal`);
  assert.ok(/overflow-wrap\s*:\s*anywhere/.test(body), `.${leaf} must set overflow-wrap: anywhere`);
  assert.ok(/word-break\s*:\s*break-word/.test(body), `.${leaf} must set word-break: break-word`);
  assert.ok(/min-width\s*:\s*0/.test(body), `.${leaf} must set min-width: 0`);
  assert.ok(/flex\s*:\s*0\s+1\s+auto/.test(body), `.${leaf} must be shrinkable: flex: 0 1 auto`);
  // No truncation / clipping / geometry workaround may sneak in on the fixed rule.
  for (const forbidden of [/overflow\s*:\s*hidden/, /text-overflow/, /ellipsis/, /line-clamp/, /transform\s*:/, /(^|\s|;)height\s*:/, /max-height\s*:/, /!important/]) {
    assert.ok(!forbidden.test(body), `.${leaf} must not introduce a workaround matching ${forbidden}`);
  }
};

test("WR-15 the effective work-report item NAME rule is shrinkable + wrapping-capable, left/bold preserved", () => {
  const body = wrHiRuleBody("work-item-name");
  assertShrinkableWrapping(body, "work-item-name");
  assert.ok(/text-align\s*:\s*left/.test(body), "item name stays left-aligned");
  assert.ok(/font-weight\s*:\s*700/.test(body), "item name stays bold");
  assert.ok(!/font-size/.test(body), "no font-size reduction workaround was introduced on the name");
});

test("WR-16 the effective work-report item DESCRIPTION rule is shrinkable + wrapping-capable, right/muted preserved", () => {
  const body = wrHiRuleBody("work-item-description");
  assertShrinkableWrapping(body, "work-item-description");
  assert.ok(/text-align\s*:\s*right/.test(body), "description stays right-aligned");
  assert.ok(/font-weight\s*:\s*400/.test(body), "description weight preserved");
  assert.ok(/font-size\s*:\s*11px/.test(body), "description font-size preserved (unchanged, not a shrink workaround)");
  assert.ok(/color\s*:\s*var\(--doc-text-muted\)/.test(body), "description muted color preserved");
});

test("WR-17 the spacer that keeps short name/description pairs on one row is preserved; repair stays WR-scoped", () => {
  const css = raw("src/lib/pdf/design/premium/estimate-a4-compact.css");
  const spacerIdx = css.indexOf("body.doc-kind-work-report .doc-table-v2.work-report-table .work-item-spacer");
  assert.ok(spacerIdx !== -1, "the work-item-spacer rule must exist");
  const spacer = css.slice(css.indexOf("{", spacerIdx) + 1, css.indexOf("}", spacerIdx));
  assert.ok(/flex\s*:\s*1\s+1\s+12px/.test(spacer) && /min-width\s*:\s*12px/.test(spacer), "spacer grows to push description right on short rows");
  // Both repaired rules remain scoped to the work-report table only (no cross-document leakage).
  for (const leaf of ["work-item-name", "work-item-description"]) {
    const sel = `body.doc-kind-work-report .doc-table-v2.work-report-table .${leaf}`;
    assert.ok(css.includes(sel), `${leaf} rule stays scoped to body.doc-kind-work-report .work-report-table`);
  }
});
