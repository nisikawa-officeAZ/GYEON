// B1B-E3 — action-boundary tests for the monthly-invoice artifact action (I1-R1).
//
// Two layers: (1) executable MODULE-MOCKED behavior tests — the real action runs against a
// scripted admin/RLS/renderer seam, proving convergence, fail-closed reads, loser compensation
// order, and zero-side-effect branches by observing actual calls; (2) comment-stripped source
// scans for the structural rules (upsert:false-only, no persisted URLs, order proofs, scoping).
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/monthly-statements/monthly-invoice-artifact-action-boundary.test.ts

import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ACTION = "src/lib/monthly-statements/ensure-monthly-invoice-pdf.ts";
const CORE = "src/lib/monthly-statements/monthly-invoice-artifact-core.ts";
const TYPES = "src/lib/monthly-statements/monthly-statement-types.ts";
const CLIENT = "src/components/monthly-statements/MonthlyStatementDetailClient.tsx";

const raw = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (p: string): string =>
  raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

const action = codeOf(ACTION);

/** The body of one top-level function, sliced between its declaration and the next one. */
function slice(code: string, startMarker: string, endMarker?: string): string {
  const start = code.indexOf(startMarker);
  assert.ok(start >= 0, `marker not found: ${startMarker}`);
  const end = endMarker ? code.indexOf(endMarker, start + startMarker.length) : -1;
  return end >= 0 ? code.slice(start, end) : code.slice(start);
}

const signFn = slice(action, "async function signVerifiedArtifact", "async function resolveRaceWinner");
const winnerFn = slice(action, "async function resolveRaceWinner", "export async function ensureMonthlyInvoicePdf");
const ensureFn = slice(action, "export async function ensureMonthlyInvoicePdf", "export async function getMonthlyInvoicePdfUrl");
const downloadFn = slice(action, "export async function getMonthlyInvoicePdfUrl");

// ═════════════════════════════════════════════════════════════════════════════
// Layer 1 — executable module-mocked behavior
// ═════════════════════════════════════════════════════════════════════════════

const DEALER = "22222222-2222-4222-8222-222222222222";
const STMT = "11111111-1111-4111-8111-111111111111";
const W = "aaaaaaa1-0000-4000-8000-00000000000a";
const W2 = "aaaaaaa2-0000-4000-8000-00000000000b";
const C = "aaaaaaa3-0000-4000-8000-00000000000c";
const P = "aaaaaaa4-0000-4000-8000-00000000000d";

const keyOf = (id: string) => `${DEALER}/monthly_invoice/issued/${STMT}/${id}.pdf`;
const dfRow = (id: string) => ({
  id, dealer_id: DEALER, document_type: "monthly_invoice", document_id: STMT,
  file_path: keyOf(id), mime_type: "application/pdf", status: "active",
});
const issuedStatement = (pointer: string | null) => ({
  id: STMT, dealer_id: DEALER, status: "issued", statement_number: "MIV-2026-00012",
  pdf_document_file_id: pointer, pdf_generated_at: pointer ? "2026-08-08T00:00:00Z" : null,
});

type Step = { match: string; result: unknown };
type Call = { label: string; table?: string; filters?: Array<[string, unknown]>; paths?: string[]; args?: unknown; path?: string };

let script: Step[] = [];
let calls: Call[] = [];
let rlsStatement: { data: unknown; error: unknown } = { data: null, error: null };
let renderCalls = 0;

function take(label: string, info: Omit<Call, "label">): unknown {
  calls.push({ label, ...info });
  const step = script.shift();
  if (!step) throw new Error(`unexpected call ${label}: script exhausted`);
  if (step.match !== label) throw new Error(`unexpected call ${label}: expected ${step.match}`);
  return step.result;
}

function makeAdmin() {
  return {
    from(table: string) {
      const state = { table, op: "select", filters: [] as Array<[string, unknown]> };
      const builder = {
        select() { return builder; },
        insert(payload: unknown) { state.op = "insert"; (state as { payload?: unknown }).payload = payload; return builder; },
        delete() { state.op = "delete"; return builder; },
        eq(col: string, val: unknown) { state.filters.push([col, val]); return builder; },
        maybeSingle() {
          return Promise.resolve(take(`${state.table}:${state.op}:single`, { table: state.table, filters: state.filters }));
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(take(`${state.table}:${state.op}`, { table: state.table, filters: state.filters }))
            .then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          exists: (p: string) => {
            const r = take("storage:exists", { path: p }) as { __throw?: unknown; data?: unknown; error?: unknown };
            if (r && r.__throw !== undefined) return Promise.reject(r.__throw);
            return Promise.resolve(r);
          },
          upload: (p: string) => Promise.resolve(take("storage:upload", { path: p })),
          remove: (paths: string[]) => Promise.resolve(take("storage:remove", { paths })),
          createSignedUrl: (p: string, _ttl: number, opts?: unknown) =>
            Promise.resolve(take("storage:sign", { path: p, args: opts })),
        };
      },
    },
    rpc: (name: string, args: unknown) => Promise.resolve(take(`rpc:${name}`, { args })),
  };
}

function makeRls() {
  return {
    from() {
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        maybeSingle() { return Promise.resolve(rlsStatement); },
      };
      return builder;
    },
  };
}

mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => makeRls() } });
mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => makeAdmin() } });
mock.module("@/lib/auth/require-staff-capability", {
  namedExports: {
    requireStaffCapability: async () => ({ dealerId: DEALER, role: "owner" }),
    AUTHORIZATION_DENIED: "この操作を行う権限がありません",
  },
});
mock.module("@/lib/pdf/brand-profile", { namedExports: { getBrandProfile: async () => ({}) } });
mock.module("@/lib/pdf/render-monthly-invoice-document", {
  namedExports: {
    renderMonthlyInvoiceDocumentPdf: async () => { renderCalls += 1; return Buffer.from("pdf"); },
  },
});

type ActionModule = typeof import("./ensure-monthly-invoice-pdf");
let ensureMonthlyInvoicePdf: ActionModule["ensureMonthlyInvoicePdf"];
let getMonthlyInvoicePdfUrl: ActionModule["getMonthlyInvoicePdfUrl"];

before(async () => {
  const mod = await import("./ensure-monthly-invoice-pdf");
  ensureMonthlyInvoicePdf = mod.ensureMonthlyInvoicePdf;
  getMonthlyInvoicePdfUrl = mod.getMonthlyInvoicePdfUrl;
});

function reset(steps: Step[], statement: unknown, statementError: unknown = null) {
  script = [...steps];
  calls = [];
  renderCalls = 0;
  rlsStatement = { data: statement, error: statementError };
}

const PRESENT = { data: true, error: null };
const SIGNED = { data: { signedUrl: "https://signed.example/artifact" }, error: null };
const EMPTY_LIST = { data: [], error: null };
const freshPathPrefix: Step[] = [
  { match: "document_files:select:single", result: { data: null, error: null } },   // no candidate
  { match: "monthly_statement_lines:select", result: EMPTY_LIST },
  { match: "monthly_statement_receipts:select", result: EMPTY_LIST },
  { match: "monthly_statement_adjustments:select", result: EMPTY_LIST },
  { match: "storage:upload", result: { error: null } },
];

test("BT-1 23505 loser with an unpointed winner ATTACHES the winner before ready", async () => {
  reset([
    ...freshPathPrefix,
    { match: "document_files:insert", result: { error: { code: "23505" } } },
    { match: "storage:remove", result: { error: null } },                            // loser's own object only
    { match: "monthly_statements:select:single", result: { data: issuedStatement(null), error: null } },
    { match: "document_files:select:single", result: { data: dfRow(W), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "rpc:attach_monthly_statement_pdf_rpc", result: { data: null, error: null } },
    { match: "document_files:select:single", result: { data: dfRow(W), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "storage:sign", result: SIGNED },
  ], issuedStatement(null));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "ready");
  assert.equal(renderCalls, 1, "rendered exactly once");
  assert.equal(script.length, 0, "the exact scripted sequence ran");
  const iAttach = calls.findIndex((c) => c.label === "rpc:attach_monthly_statement_pdf_rpc");
  const iSign = calls.findIndex((c) => c.label === "storage:sign");
  assert.ok(iAttach >= 0 && iSign > iAttach, "winner attach happened BEFORE signing");
  const removed = calls.find((c) => c.label === "storage:remove");
  const uploaded = calls.find((c) => c.label === "storage:upload");
  assert.deepEqual(removed?.paths, [uploaded?.path], "the loser removed ONLY its own uploaded object");
});

test("BT-2 winner attach conflict performs exactly one bounded pointer re-read, then signs", async () => {
  reset([
    ...freshPathPrefix,
    { match: "document_files:insert", result: { error: { code: "23505" } } },
    { match: "storage:remove", result: { error: null } },
    { match: "monthly_statements:select:single", result: { data: issuedStatement(null), error: null } },
    { match: "document_files:select:single", result: { data: dfRow(W), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "rpc:attach_monthly_statement_pdf_rpc", result: { error: { message: "monthly_pdf_pointer_conflict" } } },
    { match: "monthly_statements:select:single", result: { data: { pdf_document_file_id: W2 }, error: null } },
    { match: "document_files:select:single", result: { data: dfRow(W2), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "storage:sign", result: SIGNED },
  ], issuedStatement(null));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "ready");
  assert.equal(script.length, 0);
  const statementReads = calls.filter((c) => c.label === "monthly_statements:select:single");
  assert.equal(statementReads.length, 2, "initial winner read + exactly ONE conflict re-read");
});

test("BT-3 a candidate read error stops with zero render/upload/write/RPC side effects", async () => {
  reset([
    { match: "document_files:select:single", result: { data: null, error: { message: "boom" } } },
  ], issuedStatement(null));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "persistence_error");
  assert.equal(renderCalls, 0);
  assert.equal(script.length, 0);
  for (const c of calls) {
    assert.ok(!c.label.startsWith("storage:") && !c.label.startsWith("rpc:")
      && c.label !== "document_files:insert" && c.label !== "document_files:delete",
      `forbidden side effect after read error: ${c.label}`);
  }
});

test("BT-4 a pointed document-row read error is persistence_error, never artifact_missing", async () => {
  reset([
    { match: "document_files:select:single", result: { data: null, error: { message: "boom" } } },
  ], issuedStatement(P));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "persistence_error");
});

test("BT-5a a winner statement read error fails closed", async () => {
  reset([
    ...freshPathPrefix,
    { match: "document_files:insert", result: { error: { code: "23505" } } },
    { match: "storage:remove", result: { error: null } },
    { match: "monthly_statements:select:single", result: { data: null, error: { message: "boom" } } },
  ], issuedStatement(null));
  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "persistence_error");
  assert.equal(script.length, 0);
});

test("BT-5b a winner active-row read error fails closed", async () => {
  reset([
    ...freshPathPrefix,
    { match: "document_files:insert", result: { error: { code: "23505" } } },
    { match: "storage:remove", result: { error: null } },
    { match: "monthly_statements:select:single", result: { data: issuedStatement(null), error: null } },
    { match: "document_files:select:single", result: { data: null, error: { message: "boom" } } },
  ], issuedStatement(null));
  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "persistence_error");
  assert.equal(script.length, 0);
});

test("BT-6 a candidate pointer-conflict loser deletes its own row FIRST, then its object, never the winner", async () => {
  reset([
    { match: "document_files:select:single", result: { data: dfRow(C), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "rpc:attach_monthly_statement_pdf_rpc", result: { error: { message: "monthly_pdf_pointer_conflict" } } },
    { match: "document_files:delete", result: { data: [{ id: C }], error: null } },
    { match: "storage:remove", result: { error: null } },
    { match: "monthly_statements:select:single", result: { data: issuedStatement(W), error: null } },
    { match: "document_files:select:single", result: { data: dfRow(W), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "storage:sign", result: SIGNED },
  ], issuedStatement(null));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "ready");
  assert.equal(renderCalls, 0, "convergence never renders");
  assert.equal(script.length, 0);
  const deletes = calls.filter((c) => c.label === "document_files:delete");
  assert.equal(deletes.length, 1, "exactly one row deletion — the loser's own");
  assert.deepEqual(deletes[0].filters, [["id", C], ["dealer_id", DEALER]], "exact row + dealer predicates");
  const iDelete = calls.findIndex((c) => c.label === "document_files:delete");
  const iRemove = calls.findIndex((c) => c.label === "storage:remove");
  assert.ok(iDelete >= 0 && iRemove > iDelete, "row deletion proven BEFORE object removal");
  assert.deepEqual(calls[iRemove].paths, [keyOf(C)], "removed ONLY the loser's own object");
});

test("BT-7 a zero-row cleanup deletion never removes the object", async () => {
  reset([
    { match: "document_files:select:single", result: { data: dfRow(C), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "rpc:attach_monthly_statement_pdf_rpc", result: { error: { message: "monthly_pdf_pointer_conflict" } } },
    { match: "document_files:delete", result: { data: [], error: null } },
  ], issuedStatement(null));

  const result = await ensureMonthlyInvoicePdf(STMT);
  assert.equal(result.kind, "cleanup_failed");
  assert.equal(script.length, 0);
  assert.ok(!calls.some((c) => c.label === "storage:remove"), "bytes were NOT removed while the row may still exist");
});

test("BT-8 download signs with download disposition and the initial-read error fails closed", async () => {
  reset([
    { match: "document_files:select:single", result: { data: dfRow(P), error: null } },
    { match: "storage:exists", result: PRESENT },
    { match: "storage:sign", result: SIGNED },
  ], issuedStatement(P));
  const ok = await getMonthlyInvoicePdfUrl(STMT);
  assert.equal(ok.kind, "ready");
  const sign = calls.find((c) => c.label === "storage:sign");
  assert.deepEqual(sign?.args, { download: true }, "createSignedUrl carries download disposition");

  reset([], null, { message: "boom" });
  const err = await getMonthlyInvoicePdfUrl(STMT);
  assert.equal(err.kind, "persistence_error", "download statement read error fails closed");
});

// ═════════════════════════════════════════════════════════════════════════════
// Layer 2 — structural source scans
// ═════════════════════════════════════════════════════════════════════════════

test("AB-1 upsert:false only — the upsert:true legacy can never return", () => {
  assert.ok(action.includes("upsert: false"));
  assert.ok(!action.includes("upsert: true"));
});

test("AB-2 no URL is ever persisted; signing carries download disposition", () => {
  assert.ok(action.includes("public_url: null"));
  assert.ok(action.includes("signed_url_expires_at: null"));
  assert.ok(!/insert\([^)]*signedUrl/.test(action) && !/update\([^)]*signedUrl/.test(action));
  assert.ok(action.includes("{ download: true }"), "download disposition on the ONE signing site");
});

test("AB-3 the pointer is written ONLY by the attach RPC — never a direct table write", () => {
  assert.ok(action.includes('rpc("attach_monthly_statement_pdf_rpc"'));
  assert.ok(!/from\("monthly_statements"\)\s*\.\s*(update|insert|delete|upsert)/.test(action));
  assert.ok(!/\.update\(/.test(action), "no table update anywhere in the action");
});

test("AB-4 no financial column is ever written", () => {
  for (const token of [
    "opening_balance:", "closing_balance:", "current_total:", "current_subtotal:",
    "payments_received_total:", "adjustments_total:", 'status: "issued"', 'status: "voided"',
  ]) {
    assert.ok(!action.includes(token), `financial write token forbidden: ${token}`);
  }
});

test("AB-5 every admin document_files/monthly_statements statement is dealer-scoped", () => {
  const chains = action.split(/(?=\.from\(")/).filter((c) => c.startsWith('.from("document_files")') || c.startsWith('.from("monthly_statements")'));
  assert.ok(chains.length >= 7, `expected several scoped chains, found ${chains.length}`);
  for (const chain of chains) {
    const head = chain.slice(0, chain.indexOf(";") > 0 ? chain.indexOf(";") : chain.length);
    assert.ok(
      head.includes('eq("dealer_id"') || head.includes("dealer_id: dealerId"),
      `chain missing dealer scope: ${head.slice(0, 120)}`,
    );
  }
});

test("AB-6 fail-closed reads: every read checks error separately, as persistence_error", () => {
  for (const errName of ["statementError", "rowError", "candidateError", "stmtError", "winnerError", "rereadError"]) {
    const site = action.indexOf(`error: ${errName}`);
    assert.ok(site >= 0, `read error binding missing: ${errName}`);
    const guard = action.slice(site, site + 700);
    assert.ok(new RegExp(`if \\(${errName}\\) return fail\\("persistence_error"\\)`).test(guard),
      `${errName} must fail closed as persistence_error before any data use`);
  }
  // and the download path's statement read too
  assert.ok(downloadFn.includes("error: statementError"));
});

test("AB-7 pointed chain order: row lookup → error gate → canonical validation → exists → sign", () => {
  const iLookup = signFn.indexOf('from("document_files")');
  const iErrGate = signFn.indexOf("if (rowError)");
  const iValidate = signFn.indexOf("resolveSignableMonthlyArtifact");
  const iExists = signFn.indexOf("probeObjectExistence");
  const iSign = signFn.indexOf("createSignedUrl");
  assert.ok(iLookup >= 0 && iErrGate > iLookup && iValidate > iErrGate && iExists > iValidate && iSign > iExists);
  for (const forbidden of ["renderMonthlyInvoiceDocumentPdf", ".upload(", "attach_monthly_statement_pdf_rpc", ".delete()"]) {
    assert.ok(!signFn.includes(forbidden), `pointed chain must not contain ${forbidden}`);
  }
});

test("AB-8 winner convergence: complete row read → validate → exists → attach → sign; one re-read on conflict", () => {
  const iRead = winnerFn.indexOf('select("id, dealer_id, document_type, document_id, file_path, mime_type, status")');
  const iValidate = winnerFn.indexOf("resolveSignableMonthlyArtifact");
  const iExists = winnerFn.indexOf("probeObjectExistence");
  const iAttach = winnerFn.indexOf("attach_monthly_statement_pdf_rpc");
  const iSign = winnerFn.indexOf("signVerifiedArtifact", iAttach);
  assert.ok(iRead >= 0 && iValidate > iRead && iExists > iValidate && iAttach > iExists && iSign > iAttach,
    "read < validate < exists < attach < sign");
  assert.equal((winnerFn.match(/from\("monthly_statements"\)/g) ?? []).length, 2,
    "initial pointer read + exactly ONE conflict re-read");
  assert.equal(winnerFn.indexOf("resolveRaceWinner(", "async function resolveRaceWinner".length), -1, "no recursion");
  for (const forbidden of ["renderMonthlyInvoiceDocumentPdf", ".upload(", ".delete()", ".remove(", "while ("]) {
    assert.ok(!winnerFn.includes(forbidden), `winner resolution must not contain ${forbidden}`);
  }
});

test("AB-9 render happens at most once, only in the ensure fresh path, after any cleanup", () => {
  assert.equal((action.match(/renderMonthlyInvoiceDocumentPdf\(/g) ?? []).length, 1);
  assert.ok(ensureFn.includes("renderMonthlyInvoiceDocumentPdf("));
  assert.ok(!downloadFn.includes("renderMonthlyInvoiceDocumentPdf"));
  const iCleanupDelete = ensureFn.indexOf('decision === "retry_required"');
  const iRender = ensureFn.indexOf("renderMonthlyInvoiceDocumentPdf");
  assert.ok(iRender > iCleanupDelete, "the fresh render sits strictly AFTER the candidate branches");
});

test("AB-10 unpointed chain order: validate → exists → attach; retry exits before attach and cleanup", () => {
  const candidateBlock = slice(ensureFn, "if (candidate?.id)", "const [linesRes");
  const iValidate = candidateBlock.indexOf("resolveSignableMonthlyArtifact");
  const iExists = candidateBlock.indexOf("probeObjectExistence");
  const iRetry = candidateBlock.indexOf('decision === "retry_required"');
  const iAttach = candidateBlock.indexOf("attach_monthly_statement_pdf_rpc");
  const iDelete = candidateBlock.indexOf(".delete()");
  assert.ok(iValidate >= 0 && iExists > iValidate && iRetry > iExists && iAttach > iRetry && iDelete > iAttach);
  assert.ok(!candidateBlock.includes("renderMonthlyInvoiceDocumentPdf"), "the candidate block never renders");
  const retryReturn = candidateBlock.slice(iRetry, candidateBlock.indexOf("\n", iRetry + 60));
  assert.ok(retryReturn.includes('fail("storage_error")'), "probe_unavailable exits as storage_error");
});

test("AB-11 candidate conflict compensation: exact-row delete proven before object removal, then ONE winner pass", () => {
  const candidateBlock = slice(ensureFn, "if (candidate?.id)", "const [linesRes");
  const conflictBlock = slice(candidateBlock, "isPointerConflict", "isStatementNotIssued");
  const iDelete = conflictBlock.indexOf(".delete()");
  const iCheck = conflictBlock.indexOf('!== 1) return fail("cleanup_failed")');
  const iRemove = conflictBlock.indexOf(".remove([candidatePath])");
  const iWinner = conflictBlock.indexOf("resolveRaceWinner");
  assert.ok(iDelete >= 0 && iCheck > iDelete && iRemove > iCheck && iWinner > iRemove,
    "delete → exactly-one check → object removal → winner resolution");
  assert.ok(conflictBlock.includes('eq("id", candidateId)') && conflictBlock.includes('eq("dealer_id", dealerId)'));
});

test("AB-12 fresh-path compensation: row deletion proven (exactly one row) before bytes are removed", () => {
  const compFn = slice(ensureFn, "async function compensateOwnArtifact", "const { error: insertError }");
  const iDelete = compFn.indexOf(".delete()");
  const iCheck = compFn.indexOf('!== 1) return "incomplete"');
  const iRemove = compFn.indexOf(".remove([filePath])");
  assert.ok(iDelete >= 0 && iCheck > iDelete && iRemove > iCheck, "delete → proven → remove, in that order");
  assert.ok(compFn.includes('eq("id", documentFileId)') && compFn.includes('eq("dealer_id", dealerId)'));
  const loserBlock = slice(ensureFn, "isActiveArtifactUniqueViolation", "return resolveRaceWinner");
  assert.ok(loserBlock.includes("compensateOwnArtifact(false)"), "the 23505 loser owns no row — object-only compensation");
});

test("AB-13 bounded control flow: no while/unbounded loops, no self-recursion", () => {
  assert.ok(!/\bwhile\s*\(/.test(action) && !/for\s*\(\s*;\s*;\s*\)/.test(action));
  assert.equal(ensureFn.indexOf("ensureMonthlyInvoicePdf(", 60), -1);
  assert.equal(downloadFn.indexOf("getMonthlyInvoicePdfUrl(", 60), -1);
});

test("AB-14 download path: exists-guarded sign chain only; single signing site", () => {
  assert.ok(downloadFn.includes('requireStaffCapability("finance")'));
  assert.ok(downloadFn.includes("signVerifiedArtifact"));
  for (const forbidden of [".upload(", "attach_monthly_statement_pdf_rpc", ".insert(", ".delete()"]) {
    assert.ok(!downloadFn.includes(forbidden), `download must not contain ${forbidden}`);
  }
  assert.equal((action.match(/createSignedUrl/g) ?? []).length, 1, "one signing site, inside the guarded chain");
});

test("AB-15 authorization and RLS scope gate precede any admin authority", () => {
  const iGate = ensureFn.indexOf('requireStaffCapability("finance")');
  const iRls = ensureFn.indexOf("createClient()");
  const iAdmin = ensureFn.indexOf("createAdminClient()");
  assert.ok(iGate >= 0 && iRls > iGate && iAdmin > iRls);
  const iIssuedCheck = ensureFn.indexOf('status !== "issued"');
  assert.ok(iIssuedCheck > iRls && iIssuedCheck < iAdmin);
});

test("AB-16 UI: gating, tones, reliable navigation (no post-await window.open), no regenerate", () => {
  const client = raw(CLIENT);
  const clientCode = codeOf(CLIENT);
  assert.ok(/isIssued && !hasPdfPointer[\s\S]{0,600}?請求書PDFを作成/.test(client));
  assert.ok(/\(isIssued \|\| isVoided\) && hasPdfPointer[\s\S]{0,600}?PDFをダウンロード/.test(client));
  assert.ok(!clientCode.includes("再生成") && !/regenerate/i.test(clientCode), "no regenerate control");
  assert.ok(clientCode.includes("window.location.assign(result.signedUrl)"), "browser-reliable navigation");
  assert.ok(!clientCode.includes("window.open"), "no post-await window.open anywhere");
  assert.ok(client.includes('? "operator" : "retry"') && client.includes('tone === "operator"'));
  assert.ok(!client.includes("createAdminClient") && !client.includes("SERVICE_ROLE"));
});

test("AB-17 MonthlyStatementDB carries the two optional pointer columns", () => {
  const types = raw(TYPES);
  assert.ok(/pdf_document_file_id\?:\s*string \| null;/.test(types));
  assert.ok(/pdf_generated_at\?:\s*string \| null;/.test(types));
});

test("AB-18 imports: the frozen renderer only; no legacy upsert modules; the pure core stays pure", () => {
  assert.ok(action.includes('from "@/lib/pdf/render-monthly-invoice-document"'));
  for (const forbidden of ["generate-invoice-pdf", "generate-pdf-and-upload", "issue-invoice", "next/headers"]) {
    assert.ok(!action.includes(forbidden), `forbidden import: ${forbidden}`);
  }
  const core = codeOf(CORE);
  for (const forbidden of ["supabase", "createClient", "fetch(", "storage."]) {
    assert.ok(!core.includes(forbidden), `the pure core must not contain ${forbidden}`);
  }
});
