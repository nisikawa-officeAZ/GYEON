import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GDA_UI_ACCOUNTING_S7A — source-contract guard.
//
// The /invoices, /payments, and /points list/summary surfaces adopt the
// accepted TOP v18 presentation (deep navy/black, glass cards, thin blue
// borders, large controlled radii, restrained GYEON blue) established by the
// customers/vehicles (S4), estimates/work-orders (S5), maintenance (S5
// follow-up), and reservations/calendar (S6) conversions. This test reads
// source files as text and asserts the TOP v18 tokens are present on
// headers/cards/modals/empty states/primary actions, that InvoiceTable and
// PaymentTable ship a desktop table + mobile card presentation, that status
// selects were replaced by chips with the exact status values preserved, and
// that every frozen route/prop/callback/status/mode token is unchanged. It
// does not render React and does not touch business data, permissions, or
// the database.

const ROOT = process.cwd();
const read = (relPath: string) => readFileSync(join(ROOT, relPath), "utf8");

// The exact nine-path literal allowlist for GDA_UI_ACCOUNTING_S7A_INSTRUCTION_V1.
// This file is path 9; the other eight are read below.
const PHASE_ALLOWLIST = [
  "src/app/invoices/page.tsx",
  "src/components/invoices/InvoicesClient.tsx",
  "src/components/invoices/InvoiceTable.tsx",
  "src/app/payments/page.tsx",
  "src/components/payments/PaymentsClient.tsx",
  "src/components/payments/PaymentTable.tsx",
  "src/app/points/page.tsx",
  "src/components/points/PointsClient.tsx",
  "src/lib/navigation/gda-accounting-ui.test.ts",
] as const;

const INVOICES_PAGE   = read(PHASE_ALLOWLIST[0]);
const INVOICES_CLIENT = read(PHASE_ALLOWLIST[1]);
const INVOICE_TABLE   = read(PHASE_ALLOWLIST[2]);
const PAYMENTS_PAGE   = read(PHASE_ALLOWLIST[3]);
const PAYMENTS_CLIENT = read(PHASE_ALLOWLIST[4]);
const PAYMENT_TABLE   = read(PHASE_ALLOWLIST[5]);
const POINTS_PAGE     = read(PHASE_ALLOWLIST[6]);
const POINTS_CLIENT   = read(PHASE_ALLOWLIST[7]);

const ALL_SOURCES = [
  INVOICES_PAGE, INVOICES_CLIENT, INVOICE_TABLE,
  PAYMENTS_PAGE, PAYMENTS_CLIENT, PAYMENT_TABLE,
  POINTS_PAGE, POINTS_CLIENT,
];

test("phase scope contract: exactly nine literal paths, this test file included", () => {
  assert.equal(PHASE_ALLOWLIST.length, 9);
  assert.equal(new Set(PHASE_ALLOWLIST).size, 9, "no duplicate paths in the allowlist");
  assert.ok(
    PHASE_ALLOWLIST.includes("src/lib/navigation/gda-accounting-ui.test.ts" as (typeof PHASE_ALLOWLIST)[number]),
    "this test file is itself the ninth allowlisted path"
  );
});

test("protected ScreensPreview.tsx path is never referenced by the S7A surfaces", () => {
  for (const src of ALL_SOURCES) {
    assert.doesNotMatch(src, /ScreensPreview/);
  }
});

test("frozen finance/protected modules are never imported by the S7A surfaces", () => {
  for (const src of ALL_SOURCES) {
    assert.doesNotMatch(src, /InvoicePdfIssueActions/);
    assert.doesNotMatch(src, /components\/documents\/templates/);
    assert.doesNotMatch(src, /lib\/pdf\//);
    assert.doesNotMatch(src, /lib\/monthly-statements/);
    assert.doesNotMatch(src, /from ["']@?\/?supabase/);
  }
});

// --- TOP v18 tokens on headers, cards, modals, empty states, primary actions ---

test("invoices, payments, and points clients carry the TOP v18 page-header pattern (JA title + EN eyebrow)", () => {
  for (const src of [INVOICES_CLIENT, PAYMENTS_CLIENT, POINTS_CLIENT]) {
    assert.match(src, /text-\[20px\] font-bold text-\[#edf3fc\] md:text-\[22px\]/);
    assert.match(src, /text-\[10px\] font-semibold tracking-\[0\.22em\] text-\[#7788a4\]/);
  }
});

test("invoices and payments clients carry the TOP v18 glass-card, table shell, and primary-action tokens", () => {
  for (const src of [INVOICES_CLIENT, PAYMENTS_CLIENT]) {
    assert.match(src, /border-\[#263955\]/);
    assert.match(src, /bg-\[#111826\]\/90/);
    assert.match(src, /backdrop-blur-xl/);
    // Primary action button (GYEON blue): border-[#2f5db8] bg-[#1c4fd6] ... hover:bg-[#1a45bd]
    assert.match(src, /border-\[#2f5db8\] bg-\[#1c4fd6\]/);
    assert.match(src, /hover:bg-\[#1a45bd\]/);
  }
});

test("invoices and payments modal shells use the shared TOP v18 modal chrome and a close control", () => {
  for (const src of [INVOICES_CLIENT, PAYMENTS_CLIENT]) {
    assert.match(src, /bg-\[#0f172a\]\/80 backdrop-blur-sm/);
    assert.match(src, /rounded-2xl border border-\[#263955\] bg-\[#111826\]/);
    assert.match(src, /aria-label="閉じる"/);
    assert.match(src, /overscroll-contain/);
  }
});

test("InvoiceTable and PaymentTable consume the shared TOP v18 empty-state pattern", () => {
  for (const src of [INVOICE_TABLE, PAYMENT_TABLE]) {
    assert.match(src, /from "@\/components\/ui\/GdaOperationalListSurface"/);
    assert.match(src, /GdaOperationalListEmptyState/);
  }
  assert.match(INVOICE_TABLE, /messageJa=\{invoices\.length === 0 \? "請求書がありません"/);
  assert.match(PAYMENT_TABLE, /messageJa=\{payments\.length === 0 \? "入金記録がありません"/);
});

test("points client consumes the shared TOP v18 empty-state pattern for the history table", () => {
  assert.match(POINTS_CLIENT, /from "@\/components\/ui\/GdaOperationalListSurface"/);
  assert.match(POINTS_CLIENT, /GdaOperationalListEmptyState/);
  assert.match(POINTS_CLIENT, /messageJa="取引履歴はありません"/);
});

// --- InvoiceTable / PaymentTable: desktop table + mobile card presentation ---

test("InvoiceTable and PaymentTable ship both a desktop table and a mobile card presentation", () => {
  for (const src of [INVOICE_TABLE, PAYMENT_TABLE]) {
    assert.match(src, /hidden md:block/);
    assert.match(src, /md:hidden/);
    assert.match(src, /overflow-x-auto/);
    assert.match(src, /min-h-\[44px\]/);
  }
});

// --- Status selects replaced by chips, exact values/callbacks preserved ---

test("InvoiceTable replaces the status <select> with chips driven by INVOICE_STATUSES, preserving filterStatus/onFilterStatus", () => {
  assert.doesNotMatch(INVOICE_TABLE, /<select/);
  assert.match(INVOICE_TABLE, /INVOICE_STATUSES\.map/);
  assert.match(INVOICE_TABLE, /onClick=\{\(\) => onFilterStatus\(""\)\}/);
  assert.match(INVOICE_TABLE, /onClick=\{\(\) => onFilterStatus\(s\.value\)\}/);
  assert.match(INVOICE_TABLE, /filterStatus:\s*string;/);
  assert.match(INVOICE_TABLE, /onFilterStatus:\s*\(s: string\) => void;/);
});

test("PaymentTable replaces the status <select> with chips driven by PAYMENT_STATUSES, preserving filterStatus/onFilterStatus", () => {
  assert.doesNotMatch(PAYMENT_TABLE, /<select/);
  assert.match(PAYMENT_TABLE, /PAYMENT_STATUSES\.map/);
  assert.match(PAYMENT_TABLE, /onClick=\{\(\) => onFilterStatus\(""\)\}/);
  assert.match(PAYMENT_TABLE, /onClick=\{\(\) => onFilterStatus\(s\.value\)\}/);
  assert.match(PAYMENT_TABLE, /filterStatus:\s*string;/);
  assert.match(PAYMENT_TABLE, /onFilterStatus:\s*\(s: string\) => void;/);
});

test("PointsClient replaces the transaction-type <select> filter with chips, preserving fType/applyFilters wiring", () => {
  assert.match(POINTS_CLIENT, /\["all", "earn", "redeem", "adjust"\] as const/);
  assert.match(POINTS_CLIENT, /setFType\(v\); applyFilters\(\{ type: v \}\)/);
  // The customer and date-range filters remain native selects/inputs (not status-shaped).
  assert.match(POINTS_CLIENT, /<select value=\{fCustomer\}/);
  assert.match(POINTS_CLIENT, /type="date" value=\{fFrom\}/);
});

// --- Preserved business rules / badges / values ---

test("InvoiceTable preserves the exact status badge color map and edit-only-while-draft rule", () => {
  assert.match(INVOICE_TABLE, /draft:\s*"bg-slate-600 text-slate-100"/);
  assert.match(INVOICE_TABLE, /issued:\s*"bg-blue-600 text-white"/);
  assert.match(INVOICE_TABLE, /paid:\s*"bg-green-600 text-white"/);
  assert.match(INVOICE_TABLE, /partially_paid:\s*"bg-amber-600 text-white"/);
  assert.match(INVOICE_TABLE, /overdue:\s*"bg-red-600 text-white"/);
  assert.match(INVOICE_TABLE, /cancelled:\s*"bg-slate-700 text-slate-400"/);
  const draftGuardCount = INVOICE_TABLE.split('inv.status === "draft"').length - 1;
  assert.ok(draftGuardCount >= 2, "edit action must remain gated on draft status in both desktop and mobile presentations");
});

test("PaymentTable preserves the exact status and mode badge color maps and the notes-only edit action (no delete)", () => {
  assert.match(PAYMENT_TABLE, /completed:\s*"bg-green-600 text-white"/);
  assert.match(PAYMENT_TABLE, /pending:\s*"bg-amber-600 text-white"/);
  assert.match(PAYMENT_TABLE, /cancelled:\s*"bg-slate-600 text-slate-300"/);
  assert.match(PAYMENT_TABLE, /refunded:\s*"bg-red-700 text-white"/);
  assert.match(PAYMENT_TABLE, /legacy_direct:\s*"bg-slate-700 text-slate-300"/);
  assert.match(PAYMENT_TABLE, /allocated:\s*"bg-blue-900\/60 text-blue-300"/);
  assert.match(PAYMENT_TABLE, /unapplied:\s*"bg-amber-900\/50 text-amber-300"/);
  assert.doesNotMatch(PAYMENT_TABLE, /削除/, "no delete UI is introduced");
  const editCount = PAYMENT_TABLE.split("onEdit(p)").length - 1;
  assert.ok(editCount >= 2, "edit action must appear in both desktop and mobile presentations");
});

test("PointsClient preserves signed-point coloring and customer balance display", () => {
  assert.match(POINTS_CLIENT, /signedPoints\(t\.type, t\.points\)/);
  assert.match(POINTS_CLIENT, /signed >= 0 \? "text-emerald-300" : "text-red-300"/);
  assert.match(POINTS_CLIENT, /c\.points_balance\.toLocaleString\(\)/);
});

test("InvoicesClient and PaymentsClient preserve their exact callback/prop wiring into the table and forms", () => {
  assert.match(INVOICES_CLIENT, /onView=\{\(inv\) => setModal\(\{ mode: "detail", invoice: inv \}\)\}/);
  assert.match(INVOICES_CLIENT, /onEdit=\{\(inv\) => setModal\(\{ mode: "edit",\s*invoice: inv \}\)\}/);
  assert.match(INVOICES_CLIENT, /handleInvoiceChange/);
  assert.match(PAYMENTS_CLIENT, /onView=\{\(p\) => setModal\(\{ mode: "detail", payment: p \}\)\}/);
  assert.match(PAYMENTS_CLIENT, /onEdit=\{\(p\) => setModal\(\{ mode: "edit",\s*payment: p \}\)\}/);
  assert.match(PAYMENTS_CLIENT, /context=\{\{ kind: "global", customers \}\}/);
});

test("invoices and payments page.tsx keep the same data fetch and FeatureGate wiring, only the redundant padding wrapper removed", () => {
  assert.match(INVOICES_PAGE, /getInvoices\(\)/);
  assert.match(INVOICES_PAGE, /<FeatureGate feature="invoices">/);
  assert.doesNotMatch(INVOICES_PAGE, /p-6 max-w-7xl mx-auto/);
  assert.match(PAYMENTS_PAGE, /getPayments\(\)/);
  assert.match(PAYMENTS_PAGE, /<FeatureGate feature="payments">/);
  assert.doesNotMatch(PAYMENTS_PAGE, /p-6 max-w-7xl mx-auto/);
});

test("points page.tsx keeps the same data fetch wiring and no longer imports the shared PageTitle component", () => {
  assert.match(POINTS_PAGE, /getPointCards\(\)/);
  assert.match(POINTS_PAGE, /getPointTransactions\(\)/);
  assert.match(POINTS_PAGE, /getPointsSummary\(\)/);
  assert.doesNotMatch(POINTS_PAGE, /PageTitle/);
});
