import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SavedEstimateDocuments from "./SavedEstimateDocuments";
import { createSavedInvoiceController, parseSavedInvoice, type SavedInvoiceState } from "./saved-estimate-invoice-controller";

(globalThis as { React?: typeof React }).React = React;
const estimate = "e1111111-1111-4111-8111-111111111111";
const invoice = "f1111111-1111-4111-8111-111111111111";
const item = "a1111111-1111-4111-8111-111111111111";
const row = () => ({
  id: invoice, estimate_id: estimate, deleted_at: null, invoice_number: "INV-001", status: "draft",
  issue_date: "2026-09-14", due_date: null, delivery_date: null, total: 2200, content_version: 1,
  invoice_items: [{ id: item, invoice_id: invoice, item_name: "用品", quantity: 2, unit_price: 1000, line_total: 2000, sort_order: 1 }],
});
function harness(create: (id: string) => Promise<unknown> = async () => ({ success: true, id: invoice }), read: (id: string) => Promise<unknown> = async () => row()) {
  const states: SavedInvoiceState[] = [], creates: string[] = [], reads: string[] = [];
  const controller = createSavedInvoiceController(estimate, {
    create: async id => { creates.push(id); return create(id); },
    read: async id => { reads.push(id); return read(id); },
  }, state => states.push(state));
  return { controller, states, creates, reads };
}
const last = (h: ReturnType<typeof harness>) => h.states.at(-1);
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(r => { resolve = r; });
  return { promise, resolve };
};

test("explicit create then dealer-scoped readback; repeat only reads the same confirmed ID", async () => {
  const h = harness(); assert.equal(h.creates.length, 0);
  await h.controller.run(); await h.controller.run();
  assert.deepEqual(h.creates, [estimate]); assert.deepEqual(h.reads, [invoice, invoice]);
  const state = last(h); assert.equal(state?.kind, "ready");
  if (state?.kind === "ready") { assert.equal(state.invoice.total, 2200); assert.equal(state.invoice.status, "draft"); assert.equal(state.invoice.deliveryDate, null); }
});

test("two rapid clicks produce one create/read sequence", async () => {
  const d = deferred(), h = harness(() => d.promise);
  const a = h.controller.run(); await h.controller.run();
  assert.deepEqual(h.creates, [estimate]); assert.equal(last(h)?.kind, "pending");
  d.resolve({ success: true, id: invoice }); await a;
  assert.deepEqual(h.reads, [invoice]); assert.equal(last(h)?.kind, "ready");
});

test("approval and permission denials keep saved estimate separate and never read", async () => {
  for (const error of ["承認済みの見積のみ請求書を作成できます", "denied"]) {
    const h = harness(async () => ({ error })); await h.controller.run();
    assert.equal(h.reads.length, 0);
    const state = last(h); assert.equal(state?.kind, "error");
    if (state?.kind === "error") assert.match(state.message, /承認|権限/);
  }
});

test("failed/unknown creation has no guessed invoice ID and explicit retry uses same estimate", async () => {
  for (const response of [null, [], {}, { success: true, id: "../../admin" }, { success: true, id: invoice, error: "conflict" }]) {
    const h = harness(async () => response);
    await h.controller.run(); await h.controller.run();
    assert.deepEqual(h.creates, [estimate, estimate]); assert.equal(h.reads.length, 0); assert.equal(last(h)?.kind, "error");
  }
  const h = harness(async () => { throw Error("private secret"); });
  await h.controller.run(); assert.doesNotMatch(JSON.stringify(last(h)), /private secret/);
  const unknown = harness(async () => ({ error: "請求書の作成結果を確認できません。同じ見積から再度確認してください。" }));
  await unknown.controller.run();
  assert.match(JSON.stringify(last(unknown)), /作成結果を確認できません/);
  assert.equal(unknown.reads.length, 0);
});

test("read failure retains confirmed identity and retries read without another creation", async () => {
  let count = 0;
  const h = harness(undefined, async () => { if (count++ === 0) throw Error("offline"); return row(); });
  await h.controller.run(); assert.equal(last(h)?.kind, "error");
  await h.controller.run(); assert.equal(last(h)?.kind, "ready");
  assert.deepEqual(h.creates, [estimate]); assert.deepEqual(h.reads, [invoice, invoice]);
});

test("readback refuses missing, deleted, cross-source, malformed status/amount/items", async () => {
  for (const bad of [null, { ...row(), id: estimate }, { ...row(), estimate_id: invoice },
    { ...row(), deleted_at: "2026-09-14" }, { ...row(), status: "unknown" }, { ...row(), total: NaN },
    { ...row(), invoice_items: null }, { ...row(), invoice_items: [{ ...row().invoice_items[0], invoice_id: estimate }] },
    { ...row(), invoice_items: [row().invoice_items[0], row().invoice_items[0]] }]) {
    assert.equal(parseSavedInvoice(bad, invoice, estimate), null);
    const h = harness(undefined, async () => bad); await h.controller.run(); assert.equal(last(h)?.kind, "error");
  }
});

test("existing issued and cancelled states are displayed as returned, never turned back into draft", async () => {
  for (const status of ["issued", "paid", "partially_paid", "overdue", "cancelled"]) {
    const h = harness(undefined, async () => ({ ...row(), status })); await h.controller.run();
    const state = last(h); assert.equal(state?.kind, "ready");
    if (state?.kind === "ready") assert.equal(state.invoice.status, status);
  }
});

test("unmounted/stale pending result cannot publish or proceed to read; controller can reactivate", async () => {
  const d = deferred(), h = harness(() => d.promise);
  const run = h.controller.run(); h.controller.cancel();
  d.resolve({ success: true, id: invoice }); await run;
  assert.deepEqual(h.states, [{ kind: "pending" }]); assert.equal(h.reads.length, 0);
  await h.controller.run(); assert.equal(last(h)?.kind, "ready");
});

test("invalid saved estimate never invokes either action", async () => {
  for (const id of ["", "../../admin", "not-a-uuid"]) {
    let calls = 0;
    await createSavedInvoiceController(id, { create: async () => ++calls, read: async () => ++calls }, () => { calls++; }).run();
    assert.equal(calls, 0);
  }
});

test("SSR connected invoice control is enabled, disconnected is disabled; neither auto-creates", () => {
  let calls = 0;
  const actions = { create: async () => ++calls, read: async () => ++calls };
  const html = renderToStaticMarkup(<SavedEstimateDocuments estimateId={estimate} initialPdfPreview={false} invoiceActions={actions} />);
  const button = html.match(/<button[^>]*data-testid="saved-document-invoice"[^>]*>/)?.[0];
  assert.ok(button); assert.doesNotMatch(button, / disabled=""/);
  assert.match(html, /請求書の下書きを作成・確認/); assert.match(html, /保存完了/); assert.equal(calls, 0);
  const disabled = renderToStaticMarkup(<SavedEstimateDocuments estimateId={estimate} initialPdfPreview={false} />);
  assert.match(disabled.match(/<button[^>]*data-testid="saved-document-invoice"[^>]*>/)?.[0] ?? "", / disabled=""/);
});

test("server route injects canonical actions; saved-only keyed child; no client server import or automatic issue", () => {
  const base = "src/components/estimates/wizard/production/";
  const route = readFileSync("src/app/estimates/new/page.tsx", "utf8");
  assert.match(route, /invoiceActions=\{\{ create: createInvoiceFromEstimate, read: getInvoice,/);
  assert.match(route, /saveDate: saveInvoiceDeliveryDate, issue: issueInvoice, download: getIssuedInvoicePdfUrl/);
  const host = readFileSync(base + "ProductionEstimateWizard.tsx", "utf8");
  assert.match(host, /invoiceActions=\{props.invoiceActions\}/);
  assert.match(host, /invoiceActions: _invoiceActions/);
  const surface = readFileSync(base + "SavedEstimateDocuments.tsx", "utf8");
  assert.match(surface, /SavedEstimateInvoice key=\{estimateId\}/);
  for (const path of ["SavedEstimateInvoice.tsx", "saved-estimate-invoice-controller.ts"]) {
    const code = readFileSync(base + path, "utf8");
    assert.doesNotMatch(code, /@\/lib\/invoices|issueInvoice|createClient|\.rpc\(|fetch\(|localStorage|sessionStorage/);
  }
});
