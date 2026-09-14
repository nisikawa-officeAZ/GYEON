import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedInvoiceIssueControls } from "./SavedEstimateInvoice";
import { createSavedInvoiceController, parseSavedInvoice, safeInvoicePdfUrl, type SavedInvoiceState, type SavedInvoiceActions } from "./saved-estimate-invoice-controller";
(globalThis as { React?: typeof React }).React = React;
const eid = "e1111111-1111-4111-8111-111111111111", iid = "f1111111-1111-4111-8111-111111111111";
const row = () => ({ id: iid, estimate_id: eid, invoice_number: "INV-1", deleted_at: null,
  status: "draft", content_version: 1, issue_date: "2026-09-14", due_date: null, delivery_date: null as string | null, total: 100, invoice_items: [] });
function setup(overrides: Partial<SavedInvoiceActions> = {}) {
  let db = row(); const states: SavedInvoiceState[] = [], calls: unknown[][] = [];
  const actions: SavedInvoiceActions = {
    create: async id => { calls.push(["create", id]); return { success: true, id: iid }; },
    read: async id => { calls.push(["read", id]); return { ...db }; },
    saveDate: async (...args) => { calls.push(["save", ...args]); db = { ...db, delivery_date: args[2], content_version: 2 }; return { success: true }; },
    issue: async (...args) => { calls.push(["issue", ...args]); db = { ...db, status: "issued" }; return { kind: "issued", signedUrl: "https://storage.example/invoice.pdf" }; },
    download: async id => { calls.push(["download", id]); return { kind: "already_issued", signedUrl: "https://storage.example/invoice.pdf" }; }, ...overrides,
  };
  const controller = createSavedInvoiceController(eid, actions, s => states.push(s));
  return { controller, states, calls, actions, set: (p: Record<string, unknown>) => { db = { ...db, ...p }; }, last: () => states.at(-1) };
}
test("date save is separate from explicit confirmation; issue then download reuse identity", async () => {
  const h = setup(); await h.controller.run();
  await h.controller.issue(true); assert.equal(h.calls.filter(c => c[0] === "issue").length, 0);
  await h.controller.saveDeliveryDate("2026-09-14");
  assert.deepEqual(h.calls.find(c => c[0] === "save"), ["save", iid, eid, "2026-09-14", 1]);
  await h.controller.issue(false); assert.equal(h.calls.filter(c => c[0] === "issue").length, 0);
  await h.controller.issue(true); assert.deepEqual(h.calls.find(c => c[0] === "issue"), ["issue", iid, 2]);
  await h.controller.issue(true); await h.controller.saveDeliveryDate("2026-09-15"); await h.controller.download();
  assert.equal(h.calls.filter(c => c[0] === "issue").length, 1); assert.equal(h.calls.filter(c => c[0] === "save").length, 1);
  assert.equal(h.calls.filter(c => c[0] === "create").length, 1);
  assert.match(JSON.stringify(h.last()), /invoice.pdf/);
});
test("invalid date/version and cancelled invoices cannot mutate or download", async () => {
  const h = setup(); await h.controller.run();
  for (const date of ["", "2026-02-30", "2026-9-14", "today"]) await h.controller.saveDeliveryDate(date);
  assert.equal(h.calls.filter(c => c[0] === "save").length, 0);
  for (const content_version of [undefined, null, 0, -1, 1.1, "1", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parseSavedInvoice({ ...row(), content_version }, iid, eid), null);
  }
  h.set({ status: "cancelled", delivery_date: "2026-09-14" }); await h.controller.run();
  await h.controller.issue(true); await h.controller.saveDeliveryDate("2026-09-15"); await h.controller.download();
  assert.ok(h.calls.every(c => ["create", "read"].includes(c[0] as string)));
});
test("rapid operations share one lock; stale action after unmount cannot publish/read", async () => {
  let finish!: (v: unknown) => void;
  const p = new Promise(r => { finish = r; }); let saves = 0;
  const h = setup({ saveDate: async () => { saves++; return p; } }); await h.controller.run();
  const pending = h.controller.saveDeliveryDate("2026-09-14");
  await h.controller.saveDeliveryDate("2026-09-15"); await h.controller.issue(true); await h.controller.run();
  assert.equal(saves, 1); h.controller.cancel(); finish({ success: true }); await pending;
  assert.equal(h.calls.filter(c => c[0] === "read").length, 1); assert.equal(h.last()?.kind, "pending");
});
test("lost issue response reads persisted state, offers download, never retries issue automatically", async () => {
  const h = setup({ issue: async () => { h.set({ status: "issued" }); throw Error("private token"); } });
  h.set({ delivery_date: "2026-09-14" }); await h.controller.run(); await h.controller.issue(true);
  assert.match(JSON.stringify(h.last()), /発行済みです/); assert.doesNotMatch(JSON.stringify(h.last()), /private token|pdfUrl/);
  await h.controller.download(); assert.match(JSON.stringify(h.last()), /pdfUrl/);
  assert.equal(h.calls.filter(c => c[0] === "create").length, 1);
});
test("read failure after issue holds known identity and blocks further writes until readback", async () => {
  let broken = false, issues = 0;
  const h = setup({ issue: async () => { issues++; broken = true; throw Error("offline"); },
    read: async () => { if (broken) throw Error("offline"); return { ...row(), delivery_date: "2026-09-14" }; } });
  await h.controller.run(); await h.controller.issue(true); await h.controller.issue(true);
  assert.equal(issues, 1); assert.equal(h.last()?.kind, "error");
  broken = false; await h.controller.run(); assert.equal(h.last()?.kind, "ready");
  assert.equal(h.calls.filter(c => c[0] === "create").length, 1);
});
test("conflict refreshes current version and date without automatic re-issue", async () => {
  let issues = 0;
  const h = setup({ issue: async () => { issues++; h.set({ content_version: 3, delivery_date: "2026-09-15" }); return { kind: "conflict" }; } });
  h.set({ delivery_date: "2026-09-14" }); await h.controller.run(); await h.controller.issue(true);
  assert.equal(issues, 1); const state = h.last(); assert.equal(state?.kind, "ready");
  if (state?.kind === "ready") { assert.equal(state.invoice.contentVersion, 3); assert.equal(state.invoice.deliveryDate, "2026-09-15"); assert.equal(state.pdfUrl, undefined); }
});
test("false save success and unsafe PDF response cannot become success links", async () => {
  const h = setup({ saveDate: async () => ({ success: true }), issue: async () => ({ kind: "issued", signedUrl: "javascript:alert(1)" }) });
  await h.controller.run(); await h.controller.saveDeliveryDate("2026-09-14"); assert.match(JSON.stringify(h.last()), /一致しない/);
  h.set({ delivery_date: "2026-09-14" }); await h.controller.run(); await h.controller.issue(true);
  assert.doesNotMatch(JSON.stringify(h.last()), /pdfUrl|javascript/);
  for (const url of ["javascript:alert(1)", "data:text/html,x", "http://example.com", "//example.com", "https://user:pass@example.com", null]) assert.equal(safeInvoicePdfUrl(url), undefined);
});
test("cleanup failure is not hidden by a successful concurrent issuer", async () => {
  const h = setup({ issue: async () => { h.set({ status: "issued" }); return { kind: "cleanup_failed", message: "secret" }; } });
  h.set({ delivery_date: "2026-09-14" }); await h.controller.run(); await h.controller.issue(true);
  assert.match(JSON.stringify(h.last()), /管理者の確認/); assert.doesNotMatch(JSON.stringify(h.last()), /secret|pdfUrl/);
});
test("delivery-note link derives only from an issued readback with a saved date, mutating nothing", async () => {
  const { buildSavedDeliveryNotePath } = await import("./SavedEstimateDocuments");
  const h = setup(); await h.controller.run();
  let state = h.last(); assert.equal(state?.kind, "ready");
  if (state?.kind === "ready") assert.equal(buildSavedDeliveryNotePath(state.invoice), null, "draft without date: no link");
  await h.controller.saveDeliveryDate("2026-09-14");
  state = h.last();
  if (state?.kind === "ready") assert.equal(buildSavedDeliveryNotePath(state.invoice), null, "saved date alone never activates");
  await h.controller.issue(true);
  state = h.last(); assert.equal(state?.kind, "ready");
  const before = h.calls.length;
  if (state?.kind === "ready") {
    assert.equal(buildSavedDeliveryNotePath(state.invoice), `/pdf/delivery-note?invoiceId=${iid}`);
  }
  assert.equal(h.calls.length, before, "deriving the link performs no action call");
  assert.equal(h.calls.filter(c => c[0] === "issue").length, 1, "the link never issues");
});

test("SSR controls require valid saved date plus fresh unchecked consent; cancelled has no controls", () => {
  const h = setup(), invoice = parseSavedInvoice(row(), iid, eid)!;
  const html = renderToStaticMarkup(<SavedInvoiceIssueControls invoice={invoice} actions={h.actions} controller={h.controller} />);
  assert.match(html, /type="date"/); assert.match(html, /納品日を保存/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>請求書を確定発行/);
  const saved = renderToStaticMarkup(<SavedInvoiceIssueControls invoice={{ ...invoice, deliveryDate: "2026-09-14" }} actions={h.actions} controller={h.controller} />);
  assert.doesNotMatch(saved, /checked=""/); assert.match(saved, /<button[^>]*disabled=""[^>]*>請求書を確定発行/);
  assert.equal(renderToStaticMarkup(<SavedInvoiceIssueControls invoice={{ ...invoice, status: "cancelled" }} actions={h.actions} controller={h.controller} />), "");
  assert.equal(h.calls.length, 0);
});
