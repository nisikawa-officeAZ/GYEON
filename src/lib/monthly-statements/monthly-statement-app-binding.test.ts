// B3-B1B I2 — executable behavior tests for the monthly-statement application binding.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/monthly-statements/monthly-statement-app-binding.test.ts
//
// The module graph is mocked BEFORE the actions are imported (accepted seam): no live
// Supabase client, no database, no network. The accepted PURE cores run for real inside
// the detail read model, so the closing-formula assertions execute genuine core code.

import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── Mock plumbing ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

type Scenario = {
  auth?:            { dealerId: string; role: string } | { error: string };
  userId?:          string | null;
  dealer?:          { dealer_id: string; role: string } | null;
  rpcData?:         unknown;
  rpcError?:        { message: string } | null;
  statementRow?:    Row | null;
  linesRows?:       Row[];
  receiptsRows?:    Row[];
  capturedRows?:    Row[];
  adjustmentsRows?: Row[];
  paymentsRows?:    Row[];
  prevRows?:        Row[];
  deleteRows?:      Row[];
  deleteError?:     { message: string } | null;
  adjInsertRows?:   Row[];
  adjDeleteRows?:   Row[];
  adjLookup?:       Row | null;
};

type Recorded = {
  rpcCalls:        Array<[string, Record<string, unknown>]>;
  fromTables:      string[];
  eqCalls:         Array<[string, string, unknown]>;
  inserts:         Array<[string, Row]>;
  deletes:         string[];
  clientCreations: number;
};

let scenario: Scenario = {};
let recorded: Recorded;
function resetRecording() {
  recorded = { rpcCalls: [], fromTables: [], eqCalls: [], inserts: [], deletes: [], clientCreations: 0 };
}
resetRecording();

const DEALER = "11111111-1111-4111-8111-111111111111";
const ACTOR  = "22222222-2222-4222-8222-222222222222";
const CUS    = "44444444-4444-4444-8444-444444444444";
const STMT   = "66666666-6666-4666-8666-666666666666";

function fakeClient() {
  recorded.clientCreations += 1;
  function makeBuilder(table: string) {
    const state = { usedIn: false, usedLt: false, usedDelete: false, usedInsert: false };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lte", "order", "limit", "is", "update"]) b[m] = () => b;
    (b as { eq: (c: string, v: unknown) => unknown }).eq = (col: string, val: unknown) => {
      recorded.eqCalls.push([table, col, val]); return b;
    };
    (b as { lt: (c: string, v: unknown) => unknown }).lt = () => { state.usedLt = true; return b; };
    (b as { in: (c: string, v: unknown) => unknown }).in = () => { state.usedIn = true; return b; };
    (b as { delete: () => unknown }).delete = () => { state.usedDelete = true; recorded.deletes.push(table); return b; };
    (b as { insert: (p: Row) => unknown }).insert = (payload: Row) => {
      state.usedInsert = true; recorded.inserts.push([table, payload]); return b;
    };
    (b as { maybeSingle: () => Promise<unknown> }).maybeSingle = async () => {
      if (table === "monthly_statements") return { data: scenario.statementRow ?? null, error: null };
      if (table === "monthly_statement_adjustments") return { data: scenario.adjLookup ?? null, error: null };
      return { data: null, error: null };
    };
    (b as { then: (r: (v: unknown) => void) => void }).then = (resolve: (v: unknown) => void) => {
      if (table === "monthly_statements" && state.usedDelete) {
        resolve({ data: scenario.deleteRows ?? [], error: scenario.deleteError ?? null });
      } else if (table === "monthly_statements" && state.usedLt) {
        resolve({ data: scenario.prevRows ?? [], error: null });
      } else if (table === "monthly_statement_lines") {
        resolve({ data: scenario.linesRows ?? [], error: null });
      } else if (table === "monthly_statement_receipts" && state.usedIn) {
        resolve({ data: scenario.capturedRows ?? [], error: null });
      } else if (table === "monthly_statement_receipts") {
        resolve({ data: scenario.receiptsRows ?? [], error: null });
      } else if (table === "monthly_statement_adjustments" && state.usedInsert) {
        resolve({ data: scenario.adjInsertRows ?? [{ id: "adj-new" }], error: null });
      } else if (table === "monthly_statement_adjustments" && state.usedDelete) {
        resolve({ data: scenario.adjDeleteRows ?? [], error: null });
      } else if (table === "monthly_statement_adjustments") {
        resolve({ data: scenario.adjustmentsRows ?? [], error: null });
      } else if (table === "payments") {
        resolve({ data: scenario.paymentsRows ?? [], error: null });
      } else {
        resolve({ data: [], error: null });
      }
    };
    return b;
  }
  return {
    auth: {
      getUser: async () => ({ data: { user: scenario.userId === null ? null : { id: scenario.userId ?? ACTOR } } }),
    },
    from(table: string) { recorded.fromTables.push(table); return makeBuilder(table); },
    async rpc(name: string, args: Record<string, unknown>) {
      recorded.rpcCalls.push([name, args]);
      return { data: scenario.rpcData ?? null, error: scenario.rpcError ?? null };
    },
  };
}

mock.module("@/lib/supabase/server", {
  namedExports: { createClient: async () => fakeClient() },
});
mock.module("@/lib/auth/require-staff-capability", {
  namedExports: {
    requireStaffCapability: async () => scenario.auth ?? { dealerId: DEALER, role: "owner" },
    AUTHORIZATION_DENIED: "この操作を行う権限がありません",
  },
});
mock.module("@/lib/auth/get-current-dealer", {
  namedExports: {
    getCurrentDealer: async () => (scenario.dealer === null ? null : (scenario.dealer ?? { dealer_id: DEALER, role: "owner" })),
  },
});

type CreateModule  = typeof import("./create-monthly-statement-draft");
type AbandonModule = typeof import("./abandon-monthly-statement-draft");
type DetailModule  = typeof import("./get-monthly-statement-detail");
type AdjModule     = typeof import("./statement-adjustment-actions");
let createMonthlyStatementDraft: CreateModule["createMonthlyStatementDraft"];
let abandonMonthlyStatementDraft: AbandonModule["abandonMonthlyStatementDraft"];
let getMonthlyStatementDetail: DetailModule["getMonthlyStatementDetail"];
let addStatementAdjustment: AdjModule["addStatementAdjustment"];

before(async () => {
  createMonthlyStatementDraft = (await import("./create-monthly-statement-draft")).createMonthlyStatementDraft;
  abandonMonthlyStatementDraft = (await import("./abandon-monthly-statement-draft")).abandonMonthlyStatementDraft;
  getMonthlyStatementDetail = (await import("./get-monthly-statement-detail")).getMonthlyStatementDetail;
  addStatementAdjustment = (await import("./statement-adjustment-actions")).addStatementAdjustment;
});

function detailOf(r: Awaited<ReturnType<typeof getMonthlyStatementDetail>>) {
  if (!("success" in r)) throw new Error("expected success: " + JSON.stringify(r));
  return r.detail;
}

function withScenario(s: Scenario) {
  scenario = s;
  resetRecording();
}

const DRAFT_ROW: Row = {
  id: STMT, dealer_id: DEALER, customer_id: CUS, statement_number: "MIV-2026-08-00001",
  status: "draft", period_start: "2026-07-26", period_end: "2026-08-25",
  closing_date: "2026-08-25", payment_due_date: "2026-09-10",
  opening_balance: 0, current_subtotal: 0, current_discount: 0, current_tax: 0, current_total: 0,
  payments_received_total: 0, allocated_payments_total: 0, unapplied_credit_total: 0,
  adjustments_total: 0, closing_balance: 0,
  customer_snapshot: {}, dealer_snapshot: {}, billing_terms_snapshot: {}, tax_summary_snapshot: {},
};

// ─── draft creation ──────────────────────────────────────────────────────────

test("1. draft creation: exactly ONE D1 RPC call with server-derived dealer/actor and the exact 4 args", async () => {
  withScenario({ rpcData: DRAFT_ROW });
  const r = await createMonthlyStatementDraft(CUS, "2026-08-01");
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal((r as { statement: { id: string } }).statement.id, STMT);
  assert.equal(recorded.rpcCalls.length, 1);
  assert.equal(recorded.rpcCalls[0][0], "create_monthly_statement_draft_rpc");
  const args = recorded.rpcCalls[0][1];
  assert.deepEqual(Object.keys(args).sort(), ["p_actor", "p_customer_id", "p_dealer_id", "p_reference_date"]);
  assert.equal(args.p_dealer_id, DEALER, "dealer from requireStaffCapability");
  assert.equal(args.p_actor, ACTOR, "actor from the session user");
  assert.equal(args.p_customer_id, CUS);
  assert.equal(args.p_reference_date, "2026-08-01");
  assert.deepEqual(recorded.fromTables, [], "no app-side statement/line table access at all");
});

test("2. malformed AND impossible reference dates fail closed before any client or RPC use", async () => {
  withScenario({ rpcData: DRAFT_ROW });
  assert.ok("error" in await createMonthlyStatementDraft(CUS, "2026-8-1"), "malformed shape");
  assert.ok("error" in await createMonthlyStatementDraft(CUS, "evil"), "non-date");
  assert.ok("error" in await createMonthlyStatementDraft("", "2026-08-01"), "blank customer");
  assert.ok("error" in await createMonthlyStatementDraft(CUS, "2026-02-30"), "impossible day");
  assert.ok("error" in await createMonthlyStatementDraft(CUS, "2026-13-01"), "impossible month");
  assert.ok("error" in await createMonthlyStatementDraft(CUS, "2026-02-29"), "non-leap Feb 29");
  assert.equal(recorded.rpcCalls.length, 0, "zero RPC calls across every rejection");
  assert.equal(recorded.clientCreations, 0, "zero Supabase clients across every rejection");
});

test("2b. a real leap day (2028-02-29) is accepted and reaches exactly one RPC call", async () => {
  withScenario({ rpcData: DRAFT_ROW });
  const r = await createMonthlyStatementDraft(CUS, "2028-02-29");
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal(recorded.rpcCalls.length, 1);
  assert.equal(recorded.rpcCalls[0][1].p_reference_date, "2028-02-29");
});

test("3. unauthorized draft creation stops before client/RPC use", async () => {
  withScenario({ auth: { error: "この操作を行う権限がありません" } });
  const r = await createMonthlyStatementDraft(CUS, "2026-08-01");
  assert.ok("error" in r);
  assert.equal(recorded.clientCreations, 0);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("4. accepted statement_draft_* errors are mapped fail-closed", async () => {
  withScenario({ rpcError: { message: "statement_draft_no_eligible_invoices" } });
  const r = await createMonthlyStatementDraft(CUS, "2026-08-01");
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /請求対象の請求書がありません/);
});

// ─── abandonment ─────────────────────────────────────────────────────────────

test("5. abandonment: ONE dealer/id/draft-scoped DELETE with a returned-row check", async () => {
  withScenario({ deleteRows: [{ id: STMT }] });
  const r = await abandonMonthlyStatementDraft(STMT);
  assert.ok("success" in r, JSON.stringify(r));
  assert.deepEqual(recorded.deletes, ["monthly_statements"], "exactly one DELETE");
  assert.ok(recorded.eqCalls.some(([t, c, v]) => t === "monthly_statements" && c === "id" && v === STMT));
  assert.ok(recorded.eqCalls.some(([t, c, v]) => t === "monthly_statements" && c === "dealer_id" && v === DEALER));
  assert.ok(recorded.eqCalls.some(([t, c, v]) => t === "monthly_statements" && c === "status" && v === "draft"));
  assert.equal(recorded.inserts.length, 0, "no separate line/receipt/adjustment cleanup — cascades own it");
});

test("6. abandonment fails closed on zero returned rows (missing, cross-dealer, issued, or voided)", async () => {
  withScenario({ deleteRows: [] });
  const r = await abandonMonthlyStatementDraft(STMT);
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /下書き/);
  // an issued/voided statement can never match eq(status,'draft'), so the same zero-row
  // fail-closed path covers it; the DB no-hard-delete trigger stays the final guard.
});

test("7. unauthorized abandonment stops before client use", async () => {
  withScenario({ auth: { error: "この操作を行う権限がありません" } });
  const r = await abandonMonthlyStatementDraft(STMT);
  assert.ok("error" in r);
  assert.equal(recorded.clientCreations, 0);
});

// ─── detail read model: draft preview ────────────────────────────────────────

const PREVIEW_LINES: Row[] = [
  { id: "l1", statement_id: STMT, sort_order: 0, delivery_date: "2026-08-05", invoice_number: "INV-1",
    work_description_snapshot: "施工", subtotal_snapshot: 30000, discount_snapshot: 0,
    tax_rate_snapshot: 10, tax_snapshot: 3000, total_snapshot: 33000 },
];
const PREVIEW_PAYMENT: Row = {
  id: "pay-1", dealer_id: DEALER, customer_id: CUS, status: "completed",
  payment_date: "2026-08-15", amount: 10000, invoice_id: null,
  payment_number: "PAY-1", payment_method: "cash",
  payment_allocations: [{ allocated_amount: 6000 }],
};

test("8. draft preview closing balance uses payments_received_total (never the allocated component)", async () => {
  withScenario({
    statementRow: DRAFT_ROW,
    linesRows: PREVIEW_LINES,
    paymentsRows: [PREVIEW_PAYMENT],
    capturedRows: [],
    adjustmentsRows: [{ id: "a1", signed_amount: 500, reason: "調整", statement_id: STMT }],
    prevRows: [{ id: "prev", closing_balance: 2000 }],
  });
  const r = await getMonthlyStatementDetail(STMT);
  assert.ok("success" in r, JSON.stringify(r));
  const t = detailOf(r).totals;
  assert.equal(t.source, "draft_preview");
  assert.equal(t.opening_balance, 2000, "predecessor closing balance");
  assert.equal(t.current_total, 33000);
  assert.equal(t.payments_received_total, 10000, "customer-level receipt, not the allocation sum");
  assert.equal(t.allocated_payments_total, 6000);
  assert.equal(t.unapplied_credit_total, 4000);
  assert.equal(t.adjustments_total, 500);
  assert.equal(t.closing_balance, 2000 + 33000 - 10000 + 500, "closing = opening + current - RECEIVED + adjustments");
  assert.notEqual(t.closing_balance, 2000 + 33000 - 6000 + 500, "the allocated-based formula would differ");
  assert.equal(t.reconciles, true);
});

test("9. draft preview excludes payments captured by a NON-VOIDED statement and readmits voided membership", async () => {
  withScenario({
    statementRow: DRAFT_ROW,
    linesRows: PREVIEW_LINES,
    paymentsRows: [PREVIEW_PAYMENT],
    capturedRows: [{ payment_id: "pay-1", monthly_statements: { status: "issued" } }],
    adjustmentsRows: [],
    prevRows: [],
  });
  let r = await getMonthlyStatementDetail(STMT);
  assert.ok("success" in r);
  let t = detailOf(r).totals;
  assert.equal(t.payments_received_total, 0, "issued-captured payment is excluded");

  withScenario({
    statementRow: DRAFT_ROW,
    linesRows: PREVIEW_LINES,
    paymentsRows: [PREVIEW_PAYMENT],
    capturedRows: [{ payment_id: "pay-1", monthly_statements: { status: "voided" } }],
    adjustmentsRows: [],
    prevRows: [],
  });
  r = await getMonthlyStatementDetail(STMT);
  assert.ok("success" in r);
  t = detailOf(r).totals;
  assert.equal(t.payments_received_total, 10000, "voided membership releases the payment");
});

// ─── detail read model: issued/voided stored totals ──────────────────────────

test("10. issued detail displays STORED totals and never consults live payment data", async () => {
  withScenario({
    statementRow: {
      ...DRAFT_ROW, status: "issued", issued_at: "2026-08-26T00:00:00Z", issued_by: ACTOR,
      opening_balance: 0, current_subtotal: 30000, current_tax: 3000, current_total: 33000,
      payments_received_total: 10000, allocated_payments_total: 10000, unapplied_credit_total: 0,
      adjustments_total: 500, closing_balance: 23500,
    },
    linesRows: PREVIEW_LINES,
    receiptsRows: [{ id: "r1", statement_id: STMT, payment_id: "pay-1", payment_date_snapshot: "2026-08-15",
      payment_number_snapshot: "PAY-1", payment_method_snapshot: "cash",
      amount_snapshot: 10000, allocated_amount_snapshot: 10000, unapplied_amount_snapshot: 0 }],
    adjustmentsRows: [],
    // hostile live data that MUST NOT be consulted:
    paymentsRows: [{ ...PREVIEW_PAYMENT, amount: 99999 }],
  });
  const r = await getMonthlyStatementDetail(STMT);
  assert.ok("success" in r, JSON.stringify(r));
  const d = detailOf(r);
  assert.equal(d.totals.source, "stored");
  assert.equal(d.totals.payments_received_total, 10000, "stored value, not live 99999");
  assert.equal(d.totals.closing_balance, 23500, "stored closing balance");
  assert.equal(d.totals.reconciles, true, "identity verified over the stored triple");
  assert.ok(!recorded.fromTables.includes("payments"), "live payments are NEVER queried for issued statements");
  assert.equal(d.receipts.length, 1, "persisted receipt snapshots are the receipt view");
});

test("11. an inconsistent stored receipt triple is surfaced as reconciles=false", async () => {
  withScenario({
    statementRow: {
      ...DRAFT_ROW, status: "issued",
      payments_received_total: 10, allocated_payments_total: 5, unapplied_credit_total: 4,
      closing_balance: 0, current_total: 0,
    },
    linesRows: [], receiptsRows: [], adjustmentsRows: [],
  });
  const r = await getMonthlyStatementDetail(STMT);
  assert.ok("success" in r);
  assert.equal(detailOf(r).totals.reconciles, false);
});

test("12. non-finite stored money fails closed", async () => {
  withScenario({
    statementRow: { ...DRAFT_ROW, status: "issued", closing_balance: Number.NaN },
    linesRows: [], receiptsRows: [], adjustmentsRows: [],
  });
  const r = await getMonthlyStatementDetail(STMT);
  assert.ok("error" in r, "NaN monetary data must never render");
});

// ─── adjustments ─────────────────────────────────────────────────────────────

test("13. adjustment add: server-resolved scope, one INSERT, draft-only", async () => {
  withScenario({ statementRow: { id: STMT, dealer_id: DEALER, customer_id: CUS, status: "draft" } });
  const r = await addStatementAdjustment(STMT, -500, "値引き");
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal(recorded.inserts.length, 1);
  const [table, payload] = recorded.inserts[0];
  assert.equal(table, "monthly_statement_adjustments");
  assert.equal(payload.dealer_id, DEALER, "dealer from the server-resolved statement row");
  assert.equal(payload.customer_id, CUS, "customer from the server-resolved statement row");
  assert.equal(payload.created_by, ACTOR, "actor from the session");
  assert.equal(payload.signed_amount, -500);
});

test("14. adjustment add fails closed on zero amount, blank reason, or a non-draft parent", async () => {
  withScenario({ statementRow: { id: STMT, dealer_id: DEALER, customer_id: CUS, status: "draft" } });
  assert.ok("error" in await addStatementAdjustment(STMT, 0, "reason"));
  assert.ok("error" in await addStatementAdjustment(STMT, Number.NaN, "reason"));
  assert.ok("error" in await addStatementAdjustment(STMT, 100, "   "));
  assert.equal(recorded.inserts.length, 0);

  withScenario({ statementRow: { id: STMT, dealer_id: DEALER, customer_id: CUS, status: "issued" } });
  const r = await addStatementAdjustment(STMT, 100, "遅すぎる調整");
  assert.ok("error" in r);
  assert.equal(recorded.inserts.length, 0);
});

// ─── source boundaries ───────────────────────────────────────────────────────

// Comments are stripped first so every scan anchors on real code, never on prose.
function stripTs(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/[^\n]*$/gm, "");
}

const NEW_SOURCE_FILES = [
  "src/lib/monthly-statements/create-monthly-statement-draft.ts",
  "src/lib/monthly-statements/abandon-monthly-statement-draft.ts",
  "src/lib/monthly-statements/get-monthly-statements.ts",
  "src/lib/monthly-statements/get-monthly-statement-detail.ts",
  "src/lib/monthly-statements/statement-adjustment-actions.ts",
  "src/app/monthly-statements/page.tsx",
  "src/app/monthly-statements/[id]/page.tsx",
  "src/components/monthly-statements/MonthlyStatementsClient.tsx",
  "src/components/monthly-statements/MonthlyStatementDetailClient.tsx",
];

test("15. no new module touches customer-billing, admin client, LINE, PDF, Storage, or numbering", () => {
  for (const f of NEW_SOURCE_FILES) {
    const src = stripTs(readFileSync(f, "utf8"));
    for (const forbidden of [
      "customer-billing", "statement-preview", "StatementPreviewPanel",
      "supabase/admin", "createAdminClient", "SERVICE_ROLE", "service_role",
      "line_link", "line_user_id", "liff", "LINE_CHANNEL",
      "/pdf/", "renderStatementPdf", "document_files", "storage.", "Storage",
      "getNextDocumentNumber",
    ]) {
      assert.ok(!src.includes(forbidden), `${f} must not contain ${forbidden}`);
    }
  }
});

test("16. application code never inserts statements or lines and never issues from the client boundary directly", () => {
  for (const f of NEW_SOURCE_FILES) {
    const src = stripTs(readFileSync(f, "utf8"));
    assert.ok(!/insert\(\s*[\s\S]{0,80}monthly_statements\b/.test(src), `${f}: no statement INSERT`);
    assert.ok(!src.includes('from("monthly_statement_lines").insert') && !/monthly_statement_lines[\s\S]{0,60}insert\(/.test(src),
      `${f}: no line INSERT`);
    assert.ok(!src.includes("issue_monthly_statement_rpc"), `${f}: issuance goes only through the accepted server action`);
  }
  const detailClient = stripTs(readFileSync("src/components/monthly-statements/MonthlyStatementDetailClient.tsx", "utf8"));
  assert.ok(detailClient.includes("issueMonthlyStatement"), "the issue button calls the existing accepted action");
  assert.ok(detailClient.includes("isDraft && ("), "issue/abandon controls are draft-gated");
  assert.ok(detailClient.includes("採番されます（欠番になります）"), "abandonment warns about the burned number");
  assert.ok(detailClient.includes("当月入金 ＝ 充当 ＋ 前受金"), "the reconciliation identity is displayed");
});
