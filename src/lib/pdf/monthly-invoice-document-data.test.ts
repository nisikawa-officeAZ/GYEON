// B1B-E2-R1 — monthly-invoice renderer/data contract tests.
//
// The pure adapter + context builder execute against real snapshot bundles; the renderer and the
// design package (which need Chromium / server-only modules) are asserted from comment-stripped
// source text: snapshot-only reads, fail-closed formulas, identity refusal, stable ordering,
// four fixed main columns, subline-only invoice numbers, measurement pagination with no fixed
// capacities, offline self-contained assets, and hostile-long-text containment.
//
// Run: node --import tsx --test src/lib/pdf/monthly-invoice-document-data.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  toMonthlyInvoiceDocumentData,
  buildMonthlyInvoiceChromiumContext,
  type MonthlyInvoiceSource,
} from "./monthly-invoice-document-data";
import type {
  MonthlyStatementDB,
  MonthlyStatementLineDB,
  MonthlyStatementReceiptDB,
  MonthlyStatementAdjustmentDB,
} from "@/lib/monthly-statements/monthly-statement-types";
import type { BrandProfile } from "@/components/documents/types";

const ROOT = process.cwd();
const DATA = "src/lib/pdf/monthly-invoice-document-data.ts";
const RENDERER = "src/lib/pdf/render-monthly-invoice-document.ts";
const HTML = "src/lib/pdf/chromium-document/design/monthly-invoice-a4.html";
const BINDER = "src/lib/pdf/chromium-document/design/monthly-invoice-data.js";
const PAGINATE = "src/lib/pdf/chromium-document/design/monthly-invoice-paginate.js";

const raw = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (p: string): string =>
  raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");
const jsCodeOf = codeOf;

/* ── fixture: one internally consistent issued statement bundle ─────────────── */

const ST = "11111111-1111-4111-8111-111111111111";
const DEALER = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

function statement(overrides: Partial<MonthlyStatementDB> = {}): MonthlyStatementDB {
  return {
    id: ST, dealer_id: DEALER, customer_id: CUSTOMER,
    statement_number: "MIV-2026-00012", status: "issued",
    period_start: "2026-05-01", period_end: "2026-05-31", closing_date: "2026-05-31",
    payment_due_date: "2026-06-30", previous_statement_id: null,
    opening_balance: 5000,
    current_subtotal: 20000, current_discount: 1000, current_tax: 1900, current_total: 20900,
    payments_received_total: 11000, allocated_payments_total: 8000, unapplied_credit_total: 3000,
    adjustments_total: -500,
    closing_balance: 14400, // 5000 + 20900 - 11000 + (-500)
    customer_snapshot: {
      name: "株式会社スナップ商事", postal_code: "460-0002",
      prefecture: "愛知県", city: "名古屋市中区", address1: "丸の内1-2-3", address2: "ビル4F",
      address: "愛知県名古屋市中区丸の内1-2-3 ビル4F", phone: "052-000-0000", email: "b@example.jp",
    },
    dealer_snapshot: { name: "テストディーラー" },
    billing_terms_snapshot: { closing_day: 31, payment_due_date: "2026-06-30" },
    tax_summary_snapshot: {},
    issued_at: "2026-06-01T09:00:00+09:00", issued_by: "44444444-4444-4444-8444-444444444444",
    voided_at: null, voided_by: null, void_reason: null,
    created_at: "2026-06-01T09:00:00+09:00", updated_at: "2026-06-01T09:00:00+09:00",
    ...overrides,
  };
}

function line(id: string, over: Partial<MonthlyStatementLineDB> = {}): MonthlyStatementLineDB {
  return {
    id, dealer_id: DEALER, customer_id: CUSTOMER, statement_id: ST,
    invoice_id: "55555555-5555-4555-8555-555555555555",
    delivery_date: "2026-05-10", invoice_number: "INV-2026-00031",
    vehicle_snapshot: { maker: "フェラーリ", model: "458 Italia", plate_number: "名古屋 332 ひ 3830", color: "Rosso" },
    work_description_snapshot: "MOHS EVO ボディコーティング",
    subtotal_snapshot: 9000, discount_snapshot: 0, tax_rate_snapshot: 0.10, tax_snapshot: 900,
    total_snapshot: 9900, sort_order: 0, created_at: "2026-06-01T09:00:00+09:00",
    ...over,
  };
}

function receipt(id: string, over: Partial<MonthlyStatementReceiptDB> = {}): MonthlyStatementReceiptDB {
  return {
    id, statement_id: ST, payment_id: "66666666-6666-4666-8666-666666666666",
    dealer_id: DEALER, customer_id: CUSTOMER,
    payment_date_snapshot: "2026-05-15", payment_number_snapshot: "PAY-2026-00009",
    payment_method_snapshot: "bank_transfer",
    amount_snapshot: 6000, allocated_amount_snapshot: 5000, unapplied_amount_snapshot: 1000,
    created_at: "2026-06-01T09:00:00+09:00",
    ...over,
  };
}

function adjustment(id: string, over: Partial<MonthlyStatementAdjustmentDB> = {}): MonthlyStatementAdjustmentDB {
  return {
    id, dealer_id: DEALER, customer_id: CUSTOMER, statement_id: ST,
    signed_amount: -500, reason: "端数調整", created_by: null, created_at: "2026-06-01T09:00:00+09:00",
    ...over,
  };
}

function bundle(over: Partial<MonthlyInvoiceSource> = {}): MonthlyInvoiceSource {
  return {
    statement: statement(),
    lines: [
      line("aaaaaaa1-0000-4000-8000-000000000001"),
      line("aaaaaaa2-0000-4000-8000-000000000002", {
        invoice_id: "55555555-5555-4555-8555-555555555556",
        delivery_date: "2026-05-20", invoice_number: "INV-2026-00035",
        work_description_snapshot: "PPF フルフロント ほか2件",
        subtotal_snapshot: 10000, tax_snapshot: 1000, total_snapshot: 11000, sort_order: 1,
      }),
    ],
    receipts: [
      receipt("bbbbbbb1-0000-4000-8000-000000000001"),
      receipt("bbbbbbb2-0000-4000-8000-000000000002", {
        payment_id: "66666666-6666-4666-8666-666666666667",
        payment_date_snapshot: "2026-05-25",
        amount_snapshot: 5000, allocated_amount_snapshot: 3000, unapplied_amount_snapshot: 2000,
      }),
    ],
    adjustments: [adjustment("ccccccc1-0000-4000-8000-000000000001")],
    ...over,
  };
}

const brand: BrandProfile = {
  brandId: "miv", brandNameJa: "株式会社テストディテイラー", colors: { primary: "#000" },
  contact: { postalCode: "123-4567", address: "東京都テスト区1-2-3", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {}, qrLinks: [],
};
const LOGO = "data:image/png;base64,AAAA";

/* ── snapshot-only projection ───────────────────────────────────────────────── */

test("MIV-1 a consistent issued bundle projects snapshot values only", () => {
  const d = toMonthlyInvoiceDocumentData(bundle());
  assert.equal(d.serial, "MIV/2026/00012");
  assert.equal(d.periodStart, "2026-05-01");
  assert.equal(d.customer.name, "株式会社スナップ商事");
  assert.equal(d.customer.address, "愛知県名古屋市中区丸の内1-2-3 ビル4F");
  assert.equal(d.rows.length, 2);
  assert.equal(d.rows[0].deliveryDate, "2026-05-10");
  assert.equal(d.rows[0].vehicleName, "フェラーリ 458 Italia");
  assert.equal(d.rows[0].vehiclePlate, "名古屋 332 ひ 3830");
  assert.equal(d.rows[0].workDescription, "MOHS EVO ボディコーティング");
  assert.equal(d.rows[0].invoiceNumber, "INV-2026-00031");
  assert.equal(d.rows[0].amount, 9900);
  assert.equal(d.summary.closingBalance, 14400);
});

test("MIV-2 stable ordering: shuffled lines resolve to (sort_order, delivery_date, id)", () => {
  const b = bundle();
  const reversed = { ...b, lines: [...b.lines].reverse() };
  const d1 = toMonthlyInvoiceDocumentData(b);
  const d2 = toMonthlyInvoiceDocumentData(reversed);
  assert.deepEqual(d1.rows, d2.rows);
  assert.deepEqual(d1.rows.map((r) => r.invoiceNumber), ["INV-2026-00031", "INV-2026-00035"]);
});

/* ── formula refusal ────────────────────────────────────────────────────────── */

test("MIV-3 broken closing-balance formula refuses", () => {
  const b = bundle({ statement: statement({ closing_balance: 14401 }) });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /closing_balance_formula_mismatch/);
});

test("MIV-4 broken payments reconciliation refuses", () => {
  const b = bundle({
    statement: statement({ allocated_payments_total: 9000, closing_balance: 14400 }),
  });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /payments_reconciliation_mismatch/);
});

test("MIV-5 line totals that disagree with current_total refuse", () => {
  const b = bundle();
  b.lines[0] = line("aaaaaaa1-0000-4000-8000-000000000001", { total_snapshot: 9901 });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /line_total_mismatch/);
});

test("MIV-6 receipt totals that disagree with payments_received_total refuse", () => {
  const b = bundle();
  b.receipts = [b.receipts[0]];
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /receipt_total_mismatch/);
});

test("MIV-7 a receipt whose amount ≠ allocated + unapplied refuses", () => {
  const b = bundle();
  b.receipts[1] = receipt("bbbbbbb2-0000-4000-8000-000000000002", {
    amount_snapshot: 5000, allocated_amount_snapshot: 3000, unapplied_amount_snapshot: 1000,
  });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /receipt_reconciliation_mismatch/);
});

test("MIV-8 adjustment totals that disagree with adjustments_total refuse", () => {
  const b = bundle();
  b.adjustments = [adjustment("ccccccc1-0000-4000-8000-000000000001", { signed_amount: -400 })];
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /adjustment_total_mismatch/);
});

/* ── identity refusal ───────────────────────────────────────────────────────── */

test("MIV-9 non-issued statements refuse (draft and voided)", () => {
  assert.throws(() => toMonthlyInvoiceDocumentData(bundle({ statement: statement({ status: "draft" }) })), /statement_not_issued/);
  assert.throws(() => toMonthlyInvoiceDocumentData(bundle({ statement: statement({ status: "voided" }) })), /statement_not_issued/);
});

test("MIV-10 a missing statement number refuses", () => {
  const b = bundle({ statement: statement({ statement_number: null }) });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /statement_missing_number/);
});

test("MIV-11 cross-statement / cross-tenant rows refuse", () => {
  const otherStatement = bundle();
  otherStatement.lines[1] = line("aaaaaaa2-0000-4000-8000-000000000002", { statement_id: "99999999-9999-4999-8999-999999999999" });
  assert.throws(() => toMonthlyInvoiceDocumentData(otherStatement), /line_identity_mismatch/);

  const otherDealerReceipt = bundle();
  otherDealerReceipt.receipts[0] = receipt("bbbbbbb1-0000-4000-8000-000000000001", { dealer_id: "99999999-9999-4999-8999-999999999999" });
  assert.throws(() => toMonthlyInvoiceDocumentData(otherDealerReceipt), /receipt_identity_mismatch/);

  const otherCustomerAdj = bundle();
  otherCustomerAdj.adjustments[0] = adjustment("ccccccc1-0000-4000-8000-000000000001", { customer_id: "99999999-9999-4999-8999-999999999999" });
  assert.throws(() => toMonthlyInvoiceDocumentData(otherCustomerAdj), /adjustment_identity_mismatch/);
});

test("MIV-12 an issued statement without lines refuses", () => {
  const b = bundle({ lines: [] });
  assert.throws(() => toMonthlyInvoiceDocumentData(b), /issued_statement_requires_lines/);
});

/* ── context builder ────────────────────────────────────────────────────────── */

test("MIV-13 context is fully pre-formatted, negative-signed, and URL-free", () => {
  const ctx = buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(bundle()), brand, LOGO);
  assert.equal(ctx.documentData.docNoDisplay, "MIV / 2026 / 00012");
  assert.equal(ctx.documentData.periodDisplay, "2026.05.01 〜 2026.05.31");
  assert.equal(ctx.documentData.rows[0].amountDisplay, "¥9,900");
  assert.equal(ctx.documentData.summary.openingDisplay, "¥5,000");
  assert.equal(ctx.documentData.summary.paymentsReceivedDisplay, "−¥11,000");
  assert.equal(ctx.documentData.summary.adjustmentsDisplay, "−¥500");
  assert.equal(ctx.documentData.summary.closingDisplay, "¥14,400");
  assert.equal(ctx.documentData.customer.honorific, "様");
  const json = JSON.stringify(ctx).replace(ctx.storeSettings.storeLogoSrc, "");
  assert.ok(!/https?:/.test(json), "no URL may appear anywhere in the injection context");
});

test("MIV-14 a non-data: logo refuses (offline rendering is mandatory)", () => {
  assert.throws(
    () => buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(bundle()), brand, "https://cdn.example/logo.png"),
    /data: URI/,
  );
});

test("MIV-26 required balances format negatives as −¥ (U+2212), never ¥-", () => {
  // formula-valid negative fixture: opening −20,000 + current 20,900 − payments 11,000 + adj −500 = closing −10,600
  const negative = bundle({
    statement: statement({ opening_balance: -20000, closing_balance: -10600 }),
  });
  const negCtx = buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(negative), brand, LOGO);
  assert.equal(negCtx.documentData.summary.openingDisplay, "−¥20,000", "negative opening uses U+2212 before ¥");
  assert.equal(negCtx.documentData.summary.closingDisplay, "−¥10,600", "negative closing uses U+2212 before ¥");
  assert.ok(!JSON.stringify(negCtx).includes("¥-"), "the ASCII ¥- form never appears anywhere in the context");

  // positive and zero formatting unchanged
  const positive = buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(bundle()), brand, LOGO);
  assert.equal(positive.documentData.summary.openingDisplay, "¥5,000");
  assert.equal(positive.documentData.summary.closingDisplay, "¥14,400");
  const zeroOpening = bundle({ statement: statement({ opening_balance: 0, closing_balance: 9400 }) });
  const zeroCtx = buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(zeroOpening), brand, LOGO);
  assert.equal(zeroCtx.documentData.summary.openingDisplay, "¥0", "zero opening stays ¥0");

  // IEEE negative zero normalizes to plain ¥0 — never ¥-0, never −¥0 (formula-valid: -0 === 0)
  const negZeroOpening = bundle({ statement: statement({ opening_balance: -0, closing_balance: 9400 }) });
  const negZeroCtx = buildMonthlyInvoiceChromiumContext(toMonthlyInvoiceDocumentData(negZeroOpening), brand, LOGO);
  assert.equal(negZeroCtx.documentData.summary.openingDisplay, "¥0", "negative zero opening normalizes to ¥0");
  const negZeroJson = JSON.stringify(negZeroCtx);
  assert.ok(!negZeroJson.includes("¥-0"), "no ¥-0 anywhere");
  assert.ok(!negZeroJson.includes("−¥0"), "no −¥0 anywhere");

  // existing payments/adjustments displays unchanged in both fixtures
  for (const ctx of [negCtx, positive]) {
    assert.equal(ctx.documentData.summary.paymentsReceivedDisplay, "−¥11,000");
    assert.equal(ctx.documentData.summary.adjustmentsDisplay, "−¥500");
  }
});

/* ── absence of live-table access ───────────────────────────────────────────── */

test("MIV-15 the adapter and renderer are structurally unable to reach live tables", () => {
  for (const p of [DATA, RENDERER]) {
    const code = codeOf(p);
    for (const forbidden of [
      "createClient", "supabase", "from(", ".rpc(", "fetch(", "storage", "SignedUrl", "signed_url",
      "next/headers", "cookies",
    ]) {
      assert.ok(!code.includes(forbidden), `${p} must not contain ${forbidden}`);
    }
  }
  const rendererCode = codeOf(RENDERER);
  for (const forbidden of ["upload", "attach", "download", "document_files", "pdf_document_file_id"]) {
    assert.ok(!rendererCode.includes(forbidden), `renderer must not ${forbidden} in this phase`);
  }
});

/* ── design package boundary ────────────────────────────────────────────────── */

test("MIV-16 the main table has exactly the four required columns", () => {
  const html = raw(HTML);
  const thead = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
  const headers = [...thead.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1].trim());
  assert.deepEqual(headers, ["納品日", "車両", "作業内容", "金額税込"]);
  assert.equal((html.match(/<col class="c-m/g) ?? []).length, 4, "exactly four cols");
});

test("MIV-17 the invoice number binds ONLY as the 作業内容 subline", () => {
  const binder = jsCodeOf(BINDER);
  const occurrences = binder.match(/invoiceNoDisplay/g) ?? [];
  assert.ok(occurrences.length >= 1, "the subline binding exists");
  const cell2 = binder.slice(binder.indexOf("cells[2]"), binder.indexOf("cells[3]"));
  assert.ok(cell2.includes("invoiceNoDisplay"), "invoice number is bound inside the 作業内容 cell");
  assert.ok(cell2.includes("rich-cell__desc"), "…as the desc subline");
  const outside = binder.replace(cell2, "");
  assert.ok(!outside.includes("invoiceNoDisplay"), "and nowhere else");
});

test("MIV-18 pagination is measurement-based with no fixed row-capacity constants", () => {
  const paginate = jsCodeOf(PAGINATE);
  assert.ok(paginate.includes("scrollHeight") && paginate.includes("clientHeight"), "DOM measurement drives fit");
  assert.ok(paginate.includes("297mm"), "measures against the real A4 page box");
  assert.ok(!/ROWS?_PER_PAGE|MAX_ROWS|CAPACITY\s*=|capacity\s*=\s*\d/i.test(paginate), "no fixed capacities");
  assert.ok(!/location\.search|URLSearchParams/.test(paginate), "no URL parameters");
});

test("MIV-19 the design package is offline and self-contained in the vendored tree", () => {
  for (const p of [HTML, BINDER, PAGINATE]) {
    assert.ok(!/https?:\/\//.test(raw(p)), `${p} must not reference a remote URL`);
  }
  const html = raw(HTML);
  for (const shared of [
    "../../design/premium/doc-tokens.css", "../../design/premium/doc-components.css",
    "../../design/premium/doc-premium.css", "../../design/premium/concept-b.css",
    "../../design/premium/estimate-a4-compact.css", "../../design/premium/doc-brand.js",
  ]) {
    assert.ok(html.includes(shared), `the accepted premium package supplies ${shared}`);
  }
  assert.ok(html.includes("./monthly-invoice-data.js") && html.includes("./monthly-invoice-paginate.js"));
});

test("MIV-20 hostile long text is contained and Japanese glyph channels are intact", () => {
  const html = raw(HTML);
  for (const token of ["white-space: normal", "overflow-wrap: anywhere", "word-break: break-word", "min-width: 0"]) {
    assert.ok(html.includes(token), `containment requires ${token}`);
  }
  assert.ok(html.includes('lang="ja"'), "Japanese document language");
  assert.ok(html.includes("月次請求書") && html.includes("今回ご請求額"), "Japanese labels render from the template");
  const binder = jsCodeOf(BINDER);
  assert.ok(!binder.includes("innerHTML"), "document data binds via textContent only — no HTML interpolation");
  assert.ok(binder.includes("textContent"));
});

test("MIV-22 the monthly design package is traced into the serverless bundle", () => {
  // The offline Chromium renderer reads the template from disk at runtime, so the vendored
  // monthly design directory must be traced into every serverless function alongside the
  // accepted premium package.
  const nextConfig = raw("next.config.ts");
  assert.ok(
    nextConfig.includes("./src/lib/pdf/chromium-document/design/**"),
    "outputFileTracingIncludes must trace the monthly design directory",
  );
  const includesBlock = nextConfig.slice(
    nextConfig.indexOf("outputFileTracingIncludes"),
    nextConfig.indexOf("experimental:"),
  );
  assert.ok(includesBlock.includes('"/**"'), "the trace applies to every route");
  assert.ok(includesBlock.includes("./src/lib/pdf/chromium-document/design/**"), "…inside the /** include list");
  for (const kept of [
    "./src/lib/pdf/fonts/*.ttf",
    "./src/lib/pdf/brand-assets/*.png",
    "./src/lib/pdf/design/premium/**",
    "./public/brand/gyeon-classic/logos/combination.svg",
  ]) {
    assert.ok(includesBlock.includes(kept), `existing include ${kept} is untouched`);
  }

  // The renderer's resolved template path lands INSIDE that traced directory: the runner joins
  // cwd + src/lib/pdf/design/premium + templateFile, and the renderer's relative templateFile
  // must normalize into src/lib/pdf/chromium-document/design/, where all three package files live.
  const rendererCode = codeOf(RENDERER);
  const templateFileMatch = /path\.join\(("\.\.",\s*"\.\.",\s*"chromium-document",\s*"design",\s*"monthly-invoice-a4\.html")\)/.exec(
    rendererCode,
  );
  assert.ok(templateFileMatch, "the renderer's templateFile is the relative monthly design path");
  const runnerRoot = path.join(ROOT, "src", "lib", "pdf", "design", "premium");
  const resolved = path.join(runnerRoot, "..", "..", "chromium-document", "design", "monthly-invoice-a4.html");
  const tracedDir = path.join(ROOT, "src", "lib", "pdf", "chromium-document", "design");
  assert.equal(path.dirname(path.normalize(resolved)), tracedDir, "resolved template path is inside the traced directory");
  for (const f of ["monthly-invoice-a4.html", "monthly-invoice-data.js", "monthly-invoice-paginate.js"]) {
    assert.ok(readFileSync(path.join(tracedDir, f)).length > 0, `${f} exists in the traced directory`);
  }
});

test("MIV-21 renderer uses the accepted Chromium foundation and never persists", () => {
  const code = codeOf(RENDERER);
  assert.ok(code.includes("renderChromiumDocumentPdf"), "the accepted runner renders");
  assert.ok(code.includes("resolveStoreLogoDataUri"), "the registered logo contract resolves the store logo");
  assert.ok(code.includes("toMonthlyInvoiceDocumentData") && code.includes("buildMonthlyInvoiceChromiumContext"));
  assert.ok(code.includes("monthly-invoice-a4.html"));
});

test("MIV-23 pagination has no hardcoded split preference and avoids one-row final pages", () => {
  const paginate = jsCodeOf(PAGINATE);
  assert.ok(!/preferred/.test(paginate), "the hardcoded preference list is gone");
  assert.ok(!/\[\s*12\s*,\s*11\s*\]/.test(paginate), "no [12, 11] split constants");
  // the two-page choice iterates the MEASURED capacities and only settles for a one-row
  // final page as the fallback when no feasible split avoids it
  assert.ok(paginate.includes("tail >= 2"), "feasible splits require a two-row final page");
  assert.ok(paginate.includes("fallback"), "an unavoidable one-row final page remains the explicit fallback");
  assert.ok(/caps\.first,\s*total\s*-\s*1/.test(paginate), "candidate splits derive from measured capacities");
  // 3+ page plans apply the same orphan rule by pulling one row back from the previous page
  assert.ok(paginate.includes("remaining === 1") && paginate.includes("caps.final >= 2"),
    "multi-page plans steal one row back instead of ending on a one-row page");
  // still purely measurement-driven
  assert.ok(paginate.includes("scrollHeight") && paginate.includes("clientHeight"));
  assert.ok(!/ROWS?_PER_PAGE|MAX_ROWS|CAPACITY\s*=/i.test(paginate));
});

test("MIV-25 monthly-only two-row grand total keeps the amount full-width and unstyled", () => {
  const html = raw(HTML);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

  // the monthly band carries the scoping class and the two-row head/value structure, with the
  // top row holding AMOUNT DUE / 今回ご請求額 / (税込) in order and the value row beneath it
  const band = html.slice(html.indexOf('doc-grand-total monthly-grand-total'), html.indexOf("</section>", html.indexOf('doc-grand-total monthly-grand-total')));
  assert.ok(band.includes('<div class="monthly-grand-total__head">'), "the head row exists");
  const head = band.slice(band.indexOf('monthly-grand-total__head'), band.indexOf('doc-grand-total__value'));
  const iEn = head.indexOf("AMOUNT DUE");
  const iJa = head.indexOf("今回ご請求額");
  const iUnit = head.indexOf("(税込)");
  assert.ok(iEn > 0 && iJa > iEn && iUnit > iJa, "head order is AMOUNT DUE / 今回ご請求額 / (税込)");
  assert.ok(head.includes('<span class="jp-seg">今回ご請求額</span>'), "the label stays an atomic no-wrap segment");
  const iHead = band.indexOf("monthly-grand-total__head");
  const iValue = band.indexOf('doc-grand-total__value');
  assert.ok(iValue > iHead, "the amount row comes AFTER the head row");

  // the scoped stylesheet makes the band one column (two rows) and gives the amount row the
  // full inner width; alignment/size stay inherited from the adopted premium rules
  assert.ok(/\.doc-grand-total\.monthly-grand-total \{[^}]*grid-template-columns: 1fr;/.test(style), "one-column band = two-row layout");
  assert.ok(/\.monthly-grand-total \.doc-grand-total__value \{ width: 100%; \}/.test(style), "the amount row owns the full inner width");

  // the adopted 36px right-aligned amount and 68mm band are inherited, never restyled here:
  // no sizing, no shrinking, no thresholds, no masking, no transforms, no JS measurement
  const styleCode = style.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const forbidden of ["font-size", "transform", "clamp(", "scale", "overflow: hidden", "68mm", "width: 68", "long-amount", "char"]) {
    assert.ok(!styleCode.includes(forbidden), `the scoped style must not contain ${forbidden}`);
  }
  assert.ok(!html.includes("getBoundingClientRect") && !band.includes("<script"), "no JS measurement in the band");

  // the shared premium package is byte-untouched (the 36px / 68mm / right-align authorities)
  const premium: Array<[string, string]> = [
    ["src/lib/pdf/design/premium/doc-tokens.css", "29d0f58e2f7771d7b44a4fbe252a3c7334fe0fb831affd3f32ecc0908e838ca4"],
    ["src/lib/pdf/design/premium/doc-components.css", "6d4d30b3c096f165f2585d3656025c88e43b6ed2c041fcbb8294da4c89750666"],
    ["src/lib/pdf/design/premium/doc-premium.css", "b6182841f2f27b4f671c6681fe376179b17843f86246ccfa8f7143e2d6bee6cf"],
    ["src/lib/pdf/design/premium/concept-b.css", "247de846f5b62ef799495cf906cee7d4e762e95be73c9a9417ce3ebcd2f1d140"],
    ["src/lib/pdf/design/premium/estimate-a4-compact.css", "44e44d8a251c57b00ae5ee95720d5bed41a938babb0dd2e25f42693896afaa51"],
  ];
  for (const [p, expected] of premium) {
    const actual = createHash("sha256").update(readFileSync(path.join(ROOT, p))).digest("hex");
    assert.equal(actual, expected, `${p} must stay byte-identical`);
  }
  // and the premium authorities the band inherits are still what the design adopted
  const premiumCss = raw("src/lib/pdf/design/premium/doc-premium.css") + raw("src/lib/pdf/design/premium/estimate-a4-compact.css");
  assert.ok(premiumCss.includes("font-size: 36px"), "the adopted 36px amount size");
  assert.ok(premiumCss.includes("width: 68mm"), "the adopted 68mm band width");
});

test("MIV-24 Japanese summary and grand-total labels are atomic no-wrap segments", () => {
  const html = raw(HTML);
  // every Japanese label is wrapped in .jp-seg, so breaks happen only BETWEEN segments
  for (const label of ["前月繰越額", "当月小計", "値引き", "消費税", "当月御買上額", "（税込）", "御入金額", "調整額"]) {
    assert.ok(html.includes(`<span class="jp-seg">${label}</span>`), `${label} is an atomic segment`);
  }
  assert.ok(html.includes('<span class="jp-seg">今回ご請求額</span>'), "the grand-total label is an atomic segment");
  // the scoped stylesheet enforces the no-break rule for segments and EN sub-labels
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.ok(/\.doc-summary-v2 \.jp-seg,\s*\.doc-grand-total \.jp-seg,\s*\.doc-grand-total__unit \{\s*white-space: nowrap;/.test(style),
    "jp-seg + grand-total unit are white-space: nowrap");
  assert.ok(style.includes(".doc-summary-v2 .doc-summary-v2__label-en { white-space: nowrap; }"),
    "EN sub-labels stay unbroken so wraps land between EN and JP");
  // the amounts' authored prominence is untouched: summary values carry no styling at all, and
  // the grand-total value gains ONLY the monthly two-row width rule — never size or alignment
  assert.ok(!style.includes("doc-summary-v2__value"), "no summary value-element restyling");
  const valueRules = [...style.matchAll(/[^{}]*doc-grand-total__value[^{]*\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.deepEqual(valueRules, ["width: 100%;"], "the grand-total value carries only the full-width rule");
});
