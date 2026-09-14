// GYEON_SAVED_DOCUMENT_SURFACE_R1 — SavedEstimateDocuments classifier, paths and markup.
//
// Run: node --import tsx --test src/components/estimates/wizard/production/SavedEstimateDocuments.test.tsx
//
// Pure functions and a static server render only: no DOM, no router, no network,
// no Server Action, no PDF renderer, no database. Authored NOT_RUN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SavedEstimateDocuments, {
  classifySavedEstimateCompletion, buildSavedEstimatePdfPath, buildSavedEstimateDetailPath,
  buildSavedDeliveryNotePath, SavedDeliveryNoteChoice,
  type SavedEstimateDocumentsProps,
} from "./SavedEstimateDocuments";
import type { SavedInvoiceSummary } from "./saved-estimate-invoice-controller";
import { buildEstimatePdfPath, buildEstimatePath } from "./ProductionEstimateWizard";

(globalThis as { React?: typeof React }).React = React;

const SURFACE_SRC = "src/components/estimates/wizard/production/SavedEstimateDocuments.tsx";
const WRAPPER_SRC = "src/components/estimates/wizard/production/ProductionEstimateWizard.tsx";

/** Comment-stripped source, so documentation may name a hazard the code must not use. */
const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const UUID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const PDF_PATH = `/pdf?estimateId=${UUID}`;
const DETAIL_PATH = `/estimates/${UUID}`;

const BAD_IDS: unknown[] = [
  "", "not-a-uuid", `${UUID}0`, "../../admin", "..%2Fadmin", `${UUID}/../../admin`,
  null, undefined, 7, {}, [], `${UUID}\n`, "<script>alert(1)</script>",
];

const PROPS_CHOICES: SavedEstimateDocumentsProps = { estimateId: UUID, initialPdfPreview: false };
const PROPS_PDF: SavedEstimateDocumentsProps = { estimateId: UUID, initialPdfPreview: true };

const render = (props: SavedEstimateDocumentsProps): string =>
  renderToStaticMarkup(React.createElement(SavedEstimateDocuments, props));

/** The opening tag carrying a test id, or "" when absent. */
const tagOf = (html: string, testId: string): string =>
  html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? "";

/** Every href / src value in the markup — the complete set of URLs the surface exposes. */
const urlsOf = (html: string): string[] =>
  [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1] as string);

// ── 1-3. The pure classifier ────────────────────────────────────────────────

test("1. the classifier yields saved state for the two existing destinations; default is `estimate`", () => {
  assert.deepEqual(classifySavedEstimateCompletion(UUID),
    { kind: "saved", estimateId: UUID, initialPdfPreview: false });
  assert.deepEqual(classifySavedEstimateCompletion(UUID, "estimate"),
    { kind: "saved", estimateId: UUID, initialPdfPreview: false });
  assert.deepEqual(classifySavedEstimateCompletion(UUID, "pdf"),
    { kind: "saved", estimateId: UUID, initialPdfPreview: true });
  // Nothing executable rides along: an id and a boolean preference only.
  assert.deepEqual(Object.keys(classifySavedEstimateCompletion(UUID, "pdf")).sort(),
    ["estimateId", "initialPdfPreview", "kind"]);
});

test("2. an invalid id blocks FIRST, whatever the destination", () => {
  for (const bad of BAD_IDS) {
    for (const dest of ["estimate", "pdf", "bogus", undefined]) {
      assert.deepEqual(classifySavedEstimateCompletion(bad, dest), { kind: "invalid-estimate-id" },
        `${String(bad)} / ${String(dest)}`);
    }
  }
});

test("3. an unknown destination blocks — never a silent fallback to either surface", () => {
  for (const bad of [
    "", "Estimate", "PDF", "invoice", "delivery-note", "/pdf", "estimate ", null, 0, 1,
    {}, [], true, "__proto__", "constructor",
  ]) {
    assert.deepEqual(classifySavedEstimateCompletion(UUID, bad), { kind: "invalid-destination" }, String(bad));
  }
});

// ── 4. Path helpers ─────────────────────────────────────────────────────────

test("4. the PDF and detail paths use ONLY a validated id, are encoded, and match the host helpers", () => {
  assert.equal(buildSavedEstimatePdfPath(UUID), PDF_PATH);
  assert.equal(buildSavedEstimatePdfPath(UUID), buildEstimatePdfPath(UUID), "the same existing authenticated route");
  assert.equal(buildSavedEstimateDetailPath(UUID), DETAIL_PATH);
  assert.equal(buildSavedEstimateDetailPath(UUID), buildEstimatePath(UUID));
  for (const bad of BAD_IDS) {
    assert.equal(buildSavedEstimatePdfPath(bad), null, `pdf accepted ${String(bad)}`);
    assert.equal(buildSavedEstimateDetailPath(bad), null, `detail accepted ${String(bad)}`);
  }
});

// ── 5-8. The rendered surface ───────────────────────────────────────────────

test("5. plain save: 保存完了, three choices, no preview, and the ONLY URL is the labelled detail fallback", () => {
  const html = render(PROPS_CHOICES);
  assert.ok(html.includes('data-testid="saved-estimate-documents"'), "PRECONDITION: the surface rendered");
  assert.ok(html.includes("保存完了"));
  assert.match(tagOf(html, "saved-estimate-status"), /role="status"/);
  for (const id of ["saved-document-estimate-pdf", "saved-document-delivery-note", "saved-document-invoice"]) {
    assert.ok(html.includes(`data-testid="${id}"`), `${id} is offered`);
  }
  assert.equal(html.includes("<iframe"), false, "plain save shows the choices, not the preview");
  assert.equal(html.includes("saved-estimate-pdf-preview"), false);
  assert.match(tagOf(html, "saved-document-estimate-pdf"), /aria-pressed="false"/);
  assert.deepEqual(urlsOf(html), [DETAIL_PATH], "no other URL — no draft payload, no invented id");
  assert.ok(html.includes("書類発行ではありません"), "the detail link is labelled as NOT issuance");
  for (const leak of ["save-submit", "wizard-save-panel", "/invoices/", "/delivery", "/work-orders/"]) {
    assert.equal(html.includes(leak), false, `surface renders ${leak}`);
  }
});

test("6. the 保存してPDFを開く intent opens the inline titled preview on the SAME surface", () => {
  const html = render(PROPS_PDF);
  assert.ok(html.includes('data-testid="saved-estimate-documents"'), "the host is never left");
  assert.ok(html.includes("保存完了"));

  const iframe = tagOf(html, "saved-estimate-pdf-iframe");
  assert.ok(iframe.length > 0, "the inline preview rendered");
  assert.match(iframe, /title="見積書PDFプレビュー"/, "titled for accessibility");
  assert.ok(iframe.includes(`src="${PDF_PATH}"`), "the existing authenticated /pdf route with ONLY the saved id");

  const link = tagOf(html, "saved-estimate-pdf-new-tab");
  assert.ok(link.includes(`href="${PDF_PATH}"`), "the new-tab fallback targets the same route");
  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noopener noreferrer"/);

  assert.match(tagOf(html, "saved-document-estimate-pdf"), /aria-pressed="true"/);
  assert.deepEqual(new Set(urlsOf(html)), new Set([PDF_PATH, DETAIL_PATH]), "exactly two URLs, both from the saved id");
  // Both intents share one surface; only the initial preview differs.
  for (const id of ["saved-document-estimate-pdf", "saved-document-delivery-note", "saved-document-invoice"]) {
    assert.ok(html.includes(`data-testid="${id}"`), `${id} is still offered`);
  }
});

test("7. delivery note and invoice start GENUINELY disabled, with visible accessible reasons", () => {
  // Static render, no injected actions and no readback yet: the delivery-note
  // control stays disabled until an eligible issued invoice with a valid
  // persisted delivery date has been read back, and the invoice control is
  // disabled because this fixture injects no actions. Neither is permanent.
  for (const html of [render(PROPS_CHOICES), render(PROPS_PDF)]) {
    for (const [id, reasonId] of [
      ["saved-document-delivery-note", "saved-document-delivery-note-reason"],
      ["saved-document-invoice", "saved-document-invoice-reason"],
    ] as const) {
      const button = tagOf(html, id);
      assert.ok(button.startsWith("<button"), `${id} is a button, not a link disguised as issuance`);
      assert.ok(button.includes('disabled=""'), `${id} is disabled`);
      assert.ok(button.includes(`aria-describedby="${reasonId}"`), `${id} points at its reason`);
      assert.ok(html.includes(`id="${reasonId}"`), `${reasonId} is visible text`);
      assert.equal(new RegExp(`<a[^>]*data-testid="${id}"`).test(html), false);
    }
    assert.ok(html.includes("納品日を保存し、確定発行した後に表示できます"),
      "the delivery note becomes available after saving the delivery date and explicit issuance");
    assert.ok(html.includes("この画面からは作成・承認・発行は行われません"),
      "the actionless invoice control promises no side effect");
    assert.equal(html.includes("承認済"), false, "no approval is claimed or implied");
  }
});

test("8. an invalid id or a non-boolean preference is refused defensively", () => {
  for (const bad of ["../../admin", "not-a-uuid", "", `${UUID}0`, "<script>alert(1)</script>"]) {
    const html = render({ estimateId: bad, initialPdfPreview: true });
    assert.ok(html.includes("saved-estimate-documents-invalid"), `${bad}: the invalid state rendered`);
    assert.equal(html.includes("href="), false, `${bad}: no link`);
    assert.equal(html.includes("src="), false, `${bad}: no src`);
    assert.equal(html.includes("<iframe"), false, `${bad}: no preview`);
    assert.equal(html.includes("../../admin"), false, "the raw value is never echoed");
    assert.equal(html.includes("alert(1)"), false);
  }
  // A truthy non-boolean preference is not an intent.
  const html = render({ estimateId: UUID, initialPdfPreview: 1 as unknown as boolean });
  assert.ok(html.includes('data-testid="saved-estimate-documents"'));
  assert.equal(html.includes("<iframe"), false, "only a literal true opens the preview");
});

// ── 9-10. Source boundary ───────────────────────────────────────────────────

test("9. the surface saves nothing, navigates nowhere, reads no browser global and imports no host", () => {
  const code = codeOf(SURFACE_SRC);
  for (const forbidden of [
    "saveInvoker", "runWizardSaveAttempt", "markWizardSession", "initializeWizardSession",
    "recoverWizardSession", "onCompleted", "save-estimate-from-wizard", "persistence-gateway",
    "supa" + "base", "createClient", ".rpc(", "fetch(", "server-only", "use server",
    "create-invoice", "createInvoice", "work_order", "Date.now", "new Date", "Math.random",
    "randomUUID", "globalThis", "setTimeout",
  ]) {
    assert.equal(code.includes(forbidden), false, `surface references ${forbidden}`);
  }
  // Executable access to a browser global in any form. The lookbehind excludes
  // test ids such as `saved-document-choices`, which are followed by `-` or `"`.
  for (const global of ["window", "document", "history", "location", "sessionStorage", "localStorage", "navigator"]) {
    assert.equal(new RegExp(`(?<![\\w."'-])${global}\\s*(\\.|\\[|\\()`).test(code), false,
      `surface accesses bare ${global}`);
  }
  assert.match(code, /import \{ isValidEstimateId \} from "\.\.\/save\/wizard-idempotency-session"/,
    "validation comes from the session authority");
  assert.equal(code.includes("./ProductionEstimateWizard"), false, "no host import — no cycle");
  assert.equal(code.includes("../EstimateWizard"), false);
  assert.match(codeOf(WRAPPER_SRC), /from "\.\/SavedEstimateDocuments"/, "the host imports the surface, one direction only");

  // Repeated preview clicks only flip local presentation state: exactly one
  // handler, on the estimate-PDF choice. The delivery-note control has none —
  // it activates only through the invoice readback — and the invoice child
  // owns its own handlers behind injected actions.
  assert.equal((code.match(/onClick=\{\(\) => setPreview\("estimate-pdf"\)\}/g) ?? []).length, 1);
  assert.equal((code.match(/onClick=/g) ?? []).length, 1, "no handler on the delivery-note control in this surface");
  assert.equal((code.match(/encodeURIComponent\(/g) ?? []).length, 3, "every URL segment is encoded");
  assert.equal((code.match(/isValidEstimateId\(/g) ?? []).length, 4, "classifier + all three path helpers validate");
});

test("11. the delivery-note link exists ONLY for an issued+ readback with a valid persisted date", () => {
  const IID = "9b2c4d6e-1f35-4a71-9c40-2d8e6f1a5b77";
  const summary = (over: Partial<SavedInvoiceSummary> = {}): SavedInvoiceSummary => ({
    id: IID, number: "INV-00031", status: "issued", issueDate: "2026-09-01", dueDate: null,
    deliveryDate: "2026-08-01", contentVersion: 2, total: 104500, items: [], ...over,
  });
  const DN_PATH = `/pdf/delivery-note?invoiceId=${IID}`;
  assert.equal(buildSavedDeliveryNotePath(summary()), DN_PATH);
  for (const status of ["paid", "partially_paid", "overdue"] as const) {
    assert.equal(buildSavedDeliveryNotePath(summary({ status })), DN_PATH, status);
  }
  // fail-closed: no readback, wrong status, missing/invalid date, invalid id
  assert.equal(buildSavedDeliveryNotePath(null), null);
  for (const status of ["draft", "cancelled"] as const) {
    assert.equal(buildSavedDeliveryNotePath(summary({ status })), null, status);
  }
  for (const deliveryDate of [null, "", "2026-02-30", "2026-8-1", "2026-08-01T05:00:00.000Z"]) {
    assert.equal(buildSavedDeliveryNotePath(summary({ deliveryDate })), null, String(deliveryDate));
  }
  for (const id of ["", "not-a-uuid", "../../admin", `${IID}0`]) {
    assert.equal(buildSavedDeliveryNotePath(summary({ id })), null, id);
  }

  // eligible → a plain new-tab anchor to the authenticated route; nothing else in the markup
  const ready = renderToStaticMarkup(React.createElement(SavedDeliveryNoteChoice, { invoice: summary() }));
  const anchor = tagOf(ready, "saved-document-delivery-note");
  assert.ok(anchor.startsWith("<a"), "the active control is a link, not a mutating button");
  assert.ok(anchor.includes(`href="${DN_PATH}"`));
  assert.match(anchor, /target="_blank"/);
  assert.match(anchor, /rel="noopener noreferrer"/);
  assert.equal(ready.includes("onClick"), false);
  assert.ok(ready.includes("表示のみで、保存・再発行は行いません"));

  // ineligible → a genuinely disabled control with the accurate guidance, and NO URL
  for (const invoice of [null, summary({ status: "draft" }), summary({ deliveryDate: null })]) {
    const blocked = renderToStaticMarkup(React.createElement(SavedDeliveryNoteChoice, { invoice }));
    const button = tagOf(blocked, "saved-document-delivery-note");
    assert.ok(button.startsWith("<button"));
    assert.ok(button.includes('disabled=""'));
    assert.match(button, /aria-disabled="true"/);
    assert.equal(blocked.includes("href="), false);
    assert.ok(blocked.includes("確定発行した後に表示できます"));
  }
});

test("10. importing and server-rendering the surface touches NO browser global", () => {
  for (const global of ["window", "document"]) {
    assert.equal(global in globalThis, false, `${global} exists — this test proves nothing`);
  }
  const html = render(PROPS_PDF);
  assert.ok(html.length > 0);
  assert.ok(html.includes("保存完了"));
});
