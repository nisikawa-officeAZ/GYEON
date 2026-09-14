import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as dates from "./invoice-delivery-date";
import * as issueCore from "./invoice-issuance-core";
const iid = "f1111111-1111-4111-8111-111111111111", eid = "e1111111-1111-4111-8111-111111111111";
function load(path: string, modules: Record<string, unknown>) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8"), exports: Record<string, (...args: any[]) => Promise<any>> = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; }, console });
  return exports;
}
function saveAction(options: { denied?: boolean; data?: unknown; error?: unknown } = {}) {
  const calls: unknown[][] = [];
  const query: Record<string, any> = {};
  for (const method of ["from", "update", "eq", "is", "select"]) query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query; };
  query.maybeSingle = async () => ({ data: options.data === undefined ? { id: iid } : options.data, error: options.error ?? null });
  const run = load("./save-invoice-delivery-date.ts", {
    "@/lib/supabase/server": { createClient: async () => query },
    "@/lib/auth/require-staff-capability": { requireStaffCapability: async (c: string) => { assert.equal(c, "finance"); return options.denied ? { error: "denied" } : { dealerId: "tenant-a" }; } },
    "./invoice-delivery-date": dates,
  }).saveInvoiceDeliveryDate;
  return { run, calls };
}
test("date-only action writes exactly one column and all caller/source/version/draft guards", async () => {
  const a = saveAction(); assert.equal((await a.run(iid, eid, "2026-09-14", 4)).success, true);
  assert.equal(JSON.stringify(a.calls), JSON.stringify([
    ["from", "invoices"], ["update", { delivery_date: "2026-09-14" }],
    ["eq", "id", iid], ["eq", "estimate_id", eid], ["eq", "dealer_id", "tenant-a"],
    ["eq", "status", "draft"], ["is", "deleted_at", null], ["eq", "content_version", 4], ["select", "id"],
  ]));
});
test("auth and malformed date/identity/version reject before querying", async () => {
  const denied = saveAction({ denied: true }); assert.ok((await denied.run(iid, eid, "2026-09-14", 1)).error); assert.equal(denied.calls.length, 0);
  for (const args of [[iid, eid, "2026-02-30", 1], [iid, eid, "", 1], [iid, eid, "2026-09-14", 0],
    [iid, eid, "2026-09-14", "1"], [iid, eid, "2026-09-14", Number.MAX_SAFE_INTEGER + 1], ["bad", eid, "2026-09-14", 1]]) {
    const a = saveAction(); assert.ok((await a.run(...args)).error); assert.equal(a.calls.length, 0);
  }
});
test("zero-row CAS, wrong return ID and DB error never report success or expose errors", async () => {
  for (const options of [{ data: null }, { data: { id: eid } }, { error: { message: "private db detail" } }]) {
    const a = saveAction(options), result = await a.run(iid, eid, "2026-09-14", 1);
    assert.ok(result.error); assert.doesNotMatch(JSON.stringify(result), /private db detail/);
  }
});
function issuer(initialVersion: number, fullVersion: number, deletedAt: string | null = null) {
  let adminReads = 0, renders = 0;
  const scoped: any = {}; for (const m of ["from", "select", "eq"]) scoped[m] = () => scoped;
  scoped.maybeSingle = async () => ({ data: { id: iid, status: "draft", deleted_at: deletedAt, pdf_file_path: null, invoice_number: "INV-1", content_version: initialVersion } });
  const full: any = {}; for (const m of ["from", "select", "eq"]) full[m] = () => full;
  full.single = async () => { adminReads++; return { data: { content_version: fullVersion, status: "draft", deleted_at: null } }; };
  const run = load("./issue-invoice.ts", {
    "node:crypto": { randomUUID: () => { throw Error("unexpected artifact allocation"); } },
    "@/lib/auth/get-current-dealer": { getCurrentDealer: async () => ({ dealer_id: "tenant-a" }) },
    "@/lib/auth/require-staff-capability": { requireStaffCapability: async () => ({ dealerId: "tenant-a" }) },
    "@/lib/supabase/server": { createClient: async () => scoped },
    "@/lib/supabase/admin": { createAdminClient: () => full },
    "@/lib/pdf/render-invoice-document": { renderInvoiceDocumentPdf: () => { renders++; throw Error("unexpected render"); } },
    "@/lib/pdf/brand-profile": {}, "@/lib/invoices/invoice-issuance-core": issueCore,
    "@/lib/invoices/invoice-issuance-snapshot": { validateIssuanceSnapshot: () => ({ kind: "invalid", reason: "test-sentinel" }) },
  }).issueInvoice;
  return { run, counts: () => ({ adminReads, renders }) };
}
test("issuance rejects stale initial and rendering snapshots before PDF side effects", async () => {
  const initial = issuer(2, 2); assert.equal((await initial.run(iid, 1)).kind, "conflict"); assert.deepEqual(initial.counts(), { adminReads: 0, renders: 0 });
  const full = issuer(1, 2); assert.equal((await full.run(iid, 1)).kind, "conflict"); assert.deepEqual(full.counts(), { adminReads: 1, renders: 0 });
  const deleted = issuer(1, 1, "2026-09-14"); assert.equal((await deleted.run(iid, 1)).kind, "conflict"); assert.equal(deleted.counts().adminReads, 0);
});
test("bad optional expected-version rejected; old one-argument callers still reach original snapshot validator", async () => {
  for (const version of [null, "1", 0, NaN, 1.5]) {
    const a = issuer(1, 1); assert.equal((await a.run(iid, version)).kind, "validation_error"); assert.equal(a.counts().renders, 0);
  }
  const legacy = issuer(2, 3); assert.equal((await legacy.run(iid)).kind, "validation_error");
  assert.equal(legacy.counts().adminReads, 1); // Original snapshot validator, not the new version conflict.
});
