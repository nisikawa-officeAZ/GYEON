// B3-B1B I1 — correction-boundary tests: notes-only update, disabled deletion, and the
// UI mode/deletion contracts (source scans).
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/payments/payment-correction-boundary.test.ts

import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── Mock plumbing ───────────────────────────────────────────────────────────

type Scenario = {
  auth?:        { dealerId: string; role: string } | { error: string };
  updateRows?:  Array<{ id: string }>;
  updateError?: { message: string } | null;
};

type Recorded = {
  clientCreations: number;
  updates:         Array<[string, Record<string, unknown>]>;
  eqCalls:         Array<[string, unknown]>;
};

let scenario: Scenario = {};
let recorded: Recorded;
function resetRecording() {
  recorded = { clientCreations: 0, updates: [], eqCalls: [] };
}
resetRecording();

const DEALER = "11111111-1111-4111-8111-111111111111";
const PAY_ID = "33333333-3333-4333-8333-333333333333";

function fakeClient() {
  recorded.clientCreations += 1;
  const builder = {
    select() { return builder; },
    eq(col: string, val: unknown) { recorded.eqCalls.push([col, val]); return builder; },
    update(payload: Record<string, unknown>) {
      recorded.updates.push(["payments", payload]);
      return builder;
    },
    then(resolve: (v: unknown) => void) {
      resolve({ data: scenario.updateRows ?? [{ id: PAY_ID }], error: scenario.updateError ?? null });
    },
  };
  return {
    from(_table: string) { return builder; },
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

type UpdateModule = typeof import("./update-payment");
type DeleteModule = typeof import("./delete-payment");
let updatePayment: UpdateModule["updatePayment"];
let deletePayment: DeleteModule["deletePayment"];

before(async () => {
  updatePayment = (await import("./update-payment")).updatePayment;
  deletePayment = (await import("./delete-payment")).deletePayment;
});

function withScenario(s: Scenario) {
  scenario = s;
  resetRecording();
}

// ─── notes-only update ───────────────────────────────────────────────────────

test("1. updatePayment writes ONLY notes, internal_memo, updated_at — hostile financial fields never reach the payload", async () => {
  withScenario({});
  const fd = new FormData();
  fd.set("notes", "備考A");
  fd.set("internal_memo", "メモB");
  // hostile financial fields that must be structurally ignored
  for (const [k, v] of Object.entries({
    amount: "1", fee_amount: "1", net_amount: "1", status: "refunded",
    payment_date: "2000-01-01", payment_method: "other", payment_number: "PAY-EVIL",
    reference_no: "EVIL", invoice_id: "evil", customer_id: "evil", dealer_id: "evil",
  })) fd.set(k, v);

  const r = await updatePayment(PAY_ID, fd);
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal(recorded.updates.length, 1);
  const payload = recorded.updates[0][1];
  assert.deepEqual(Object.keys(payload).sort(), ["internal_memo", "notes", "updated_at"]);
  assert.equal(payload.notes, "備考A");
  assert.equal(payload.internal_memo, "メモB");
});

test("2. zero returned rows (missing / cross-dealer) -> not-found error, never silent success", async () => {
  withScenario({ updateRows: [] });
  const fd = new FormData();
  fd.set("notes", "x");
  const r = await updatePayment(PAY_ID, fd);
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /見つかりません/);
  assert.equal(recorded.updates.length, 1, "the single dealer-scoped mutation ran and returned no row");
});

test("2b. a Supabase update error produces an error result", async () => {
  withScenario({ updateError: { message: "update boom" } });
  const fd = new FormData();
  fd.set("notes", "x");
  const r = await updatePayment(PAY_ID, fd);
  assert.ok("error" in r);
});

test("3. exactly ONE mutation, scoped to the server-resolved dealer and payment id (no pre-read)", async () => {
  withScenario({});
  const fd = new FormData();
  fd.set("notes", "x");
  await updatePayment(PAY_ID, fd);
  assert.equal(recorded.updates.length, 1, "single UPDATE, no pre-read sequence");
  assert.ok(recorded.eqCalls.some(([c, v]) => c === "id" && v === PAY_ID));
  assert.ok(recorded.eqCalls.some(([c, v]) => c === "dealer_id" && v === DEALER));
});

test("4. updatePayment denies without any client use when finance capability is missing", async () => {
  withScenario({ auth: { error: "この操作を行う権限がありません" } });
  const fd = new FormData();
  fd.set("notes", "x");
  const r = await updatePayment(PAY_ID, fd);
  assert.ok("error" in r);
  assert.equal(recorded.clientCreations, 0);
});

// ─── disabled deletion ───────────────────────────────────────────────────────

test("5. deletePayment returns the fixed fail-closed error with ZERO calls of any kind", async () => {
  withScenario({});
  const r = await deletePayment(PAY_ID);
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /削除は現在無効/);
  assert.equal(recorded.clientCreations, 0, "no Supabase client");
  assert.equal(recorded.updates.length, 0);
});

test("6. delete-payment.ts imports nothing and calls nothing", () => {
  const src = readFileSync("src/lib/payments/delete-payment.ts", "utf8");
  assert.doesNotMatch(src, /^\s*import /m, "zero imports");
  for (const forbidden of ["createClient", "createAuditLog", "requireStaffCapability", "recalculate", "supabase", "rpc("]) {
    assert.ok(!src.includes(forbidden), `must not reference ${forbidden}`);
  }
});

test("7. update-payment.ts has no pre-read and never imports financial helpers", () => {
  const src = readFileSync("src/lib/payments/update-payment.ts", "utf8");
  for (const forbidden of ["calculateNetAmount", "recalculateInvoicePayment", "b3_recalc_invoice_payment", "getNextDocumentNumber", "maybeSingle"]) {
    assert.ok(!src.includes(forbidden), `must not reference ${forbidden}`);
  }
});

test("7b. PaymentUpdateInput is redefined as notes/internal_memo only", () => {
  const src = readFileSync("src/lib/payments/payment-types.ts", "utf8");
  const idx = src.indexOf("export type PaymentUpdateInput");
  assert.ok(idx > 0);
  const block = src.slice(idx, src.indexOf("};", idx));
  assert.ok(block.includes("notes"), "notes present");
  assert.ok(block.includes("internal_memo"), "internal_memo present");
  for (const forbidden of ["amount", "status", "payment_date", "invoice_id", "reference_no", "payment_number", "payment_method"]) {
    assert.ok(!block.includes(forbidden), `PaymentUpdateInput must not carry ${forbidden}`);
  }
});

// ─── UI contracts (source scans over the allowlisted components) ─────────────

// Comments are stripped first so every assertion anchors on real code, never on prose.
function stripTs(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/[^\n]*$/gm, "");
}
const UI = {
  form:    stripTs(readFileSync("src/components/payments/PaymentForm.tsx", "utf8")),
  client:  stripTs(readFileSync("src/components/payments/PaymentsClient.tsx", "utf8")),
  section: stripTs(readFileSync("src/components/payments/PaymentSection.tsx", "utf8")),
  table:   stripTs(readFileSync("src/components/payments/PaymentTable.tsx", "utf8")),
  detail:  stripTs(readFileSync("src/components/payments/PaymentDetail.tsx", "utf8")),
  editor:  stripTs(readFileSync("src/components/payments/AllocationEditor.tsx", "utf8")),
};

test("8. delete controls are absent from every allowlisted payment component", () => {
  for (const [name, src] of Object.entries(UI)) {
    assert.ok(!src.includes("deletePayment"), `${name} must not import deletePayment`);
    assert.ok(!src.includes("delete-payment"), `${name} must not reference delete-payment`);
    assert.ok(!src.includes("onDeleted"), `${name} must not wire a delete callback`);
  }
});

test("9. global creation never offers legacy_direct and never passes an empty invoice id", () => {
  assert.ok(!UI.client.includes("legacy_direct"), "PaymentsClient has no legacy_direct");
  assert.ok(!UI.client.includes('invoiceId=""'), "the old empty-invoice modal is gone");
  assert.ok(UI.client.includes('kind: "global"'), "global flow context");
  assert.ok(UI.client.includes("getPayableCustomers"), "customers come from the allowlisted read helper");
});

test("10. legacy_direct exists only behind the invoice context in PaymentForm; invoice-detail flow is fixed to it", () => {
  const idx = UI.form.indexOf('fd.set("mode", "legacy_direct")');
  assert.ok(idx > 0, "PaymentForm sets legacy_direct");
  const guard = UI.form.lastIndexOf('context.kind === "invoice"', idx);
  assert.ok(guard > 0 && idx - guard < 200, "legacy_direct is set only inside the invoice-context branch");
  assert.ok(UI.section.includes('kind: "invoice"'), "PaymentSection pins the invoice context");
  assert.ok(!UI.section.includes('kind: "global"'), "PaymentSection never opens the global flow");
});

test("11. mode defaults follow the open-invoice contract and unapplied requires explicit choice", () => {
  assert.ok(UI.form.includes('setMode("allocated")'), "allocated default exists");
  assert.ok(UI.form.includes('setMode("unapplied")'), "unapplied fallback exists");
  const defaultBlock = UI.form.slice(UI.form.indexOf("invoices.length > 0"), UI.form.indexOf("setInvoicesLoading(false)"));
  assert.ok(defaultBlock.includes('setMode("allocated")'), "open invoices -> allocated default");
  assert.ok(UI.form.includes("明示的に前受金を選択"), "explicit unapplied choice is surfaced");
});

test("12. conversion is offered only for legacy-direct payments and requires the original-invoice allocation", () => {
  assert.ok(UI.detail.includes('mode === "legacy_direct"'), "conversion gate on derived mode");
  assert.ok(UI.detail.includes("元の請求書への割当が必要です"), "original-invoice UX guard");
  const convertSrc = readFileSync("src/lib/payments/convert-payment-to-allocated.ts", "utf8");
  assert.ok(convertSrc.includes("payment_rpc_conversion_missing_original_invoice"), "RPC rule surfaced in mapping");
});

test("13. no allowlisted component performs direct financial writes or TypeScript recalculation", () => {
  for (const [name, src] of Object.entries(UI)) {
    for (const forbidden of ["recalculateInvoicePayment", "b3_recalc_invoice_payment", ".insert(", "supabase/admin", "getNextDocumentNumber"]) {
      assert.ok(!src.includes(forbidden), `${name} must not contain ${forbidden}`);
    }
  }
});

test("14. PaymentSection displays the invoice-applied amount and shows the total when they differ", () => {
  assert.ok(UI.section.includes("invoice_context_amount"), "context amount is the displayed amount");
  assert.ok(UI.section.includes("入金総額"), "the full payment amount is shown when different");
});

test("15. allocation client math is advisory only and the editor rejects malformed input", () => {
  assert.ok(UI.editor.includes("割当合計が入金額を超えています"), "over-payment rejection");
  assert.ok(UI.editor.includes("同じ請求書への割当が重複しています"), "duplicate rejection");
  assert.ok(UI.editor.includes("割当額は正の数値で入力してください"), "non-positive rejection");
});
