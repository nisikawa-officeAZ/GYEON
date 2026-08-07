// B3-B1B I1-R1 — RPC binding + invoice-scoped read-model tests.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/payments/payment-rpc-binding.test.ts
//
// The module graph is mocked BEFORE the actions are imported (same seam as the accepted
// numbering tests): no live Supabase client, no database, no network. Behavior tests prove
// the ONE-RPC financial mutation contract, the side-effect-free idempotent retry, and the
// invoice-scoped union read; source scans prove the forbidden-surface rules.

import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── Mock plumbing ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

type Scenario = {
  auth?:       { dealerId: string; role: string } | { error: string };
  userId?:     string | null;
  dealer?:     { dealer_id: string; role: string } | null;
  rpcData?:    unknown;
  rpcError?:   { message: string } | null;
  allocRows?:  Row[];
  allocError?: { message: string } | null;
  directRows?: Row[];
  directError?: { message: string } | null;
  byIdsRows?:  Row[];
  byIdsError?: { message: string } | null;
};

type Recorded = {
  rpcCalls:        Array<[string, Record<string, unknown>]>;
  fromTables:      string[];
  eqCalls:         Array<[string, string, unknown]>;
  clientCreations: number;
  activityCalls:   number;
  notifyCalls:     number;
  engagementCalls: number;
  dispatchCalls:   number;
};

let scenario: Scenario = {};
let recorded: Recorded;

function resetRecording() {
  recorded = {
    rpcCalls: [], fromTables: [], eqCalls: [], clientCreations: 0,
    activityCalls: 0, notifyCalls: 0, engagementCalls: 0, dispatchCalls: 0,
  };
}
resetRecording();

const DEALER = "11111111-1111-4111-8111-111111111111";
const ACTOR  = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ROW = {
  id: "33333333-3333-4333-8333-333333333333",
  dealer_id: DEALER, invoice_id: null, customer_id: "44444444-4444-4444-8444-444444444444",
  amount: 10000, fee_amount: 0, net_amount: 10000, status: "completed",
  payment_method: "cash", payment_date: "2026-08-15",
};

function fakeClient() {
  recorded.clientCreations += 1;
  function makeBuilder(table: string) {
    const state = { usedIn: false };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "is", "gt", "order", "update", "insert", "delete"]) {
      b[m] = () => b;
    }
    (b as { eq: (c: string, v: unknown) => unknown }).eq = (col: string, val: unknown) => {
      recorded.eqCalls.push([table, col, val]);
      return b;
    };
    (b as { in: () => unknown }).in = () => { state.usedIn = true; return b; };
    (b as { maybeSingle: () => Promise<unknown> }).maybeSingle = async () => ({ data: null, error: null });
    (b as { then: (r: (v: unknown) => void) => void }).then = (resolve: (v: unknown) => void) => {
      if (table === "payment_allocations") {
        resolve({ data: scenario.allocRows ?? [], error: scenario.allocError ?? null });
      } else if (table === "payments" && state.usedIn) {
        resolve({ data: scenario.byIdsRows ?? [], error: scenario.byIdsError ?? null });
      } else if (table === "payments") {
        resolve({ data: scenario.directRows ?? [], error: scenario.directError ?? null });
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
// Registered ONLY to prove zero side-effect traffic — create-payment must not even import these.
mock.module("@/lib/activity/activity-log", {
  namedExports: { createActivityLog: () => { recorded.activityCalls += 1; return Promise.resolve(); } },
});
mock.module("@/lib/notifications/notification", {
  namedExports: { createNotification: () => { recorded.notifyCalls += 1; return Promise.resolve(); } },
});
mock.module("@/lib/customer-engagement/context", {
  namedExports: { createEngagementEvent: async () => { recorded.engagementCalls += 1; return null; } },
});
mock.module("@/lib/customer-engagement/engine/runtime", {
  namedExports: { EngagementWorkflowRuntime: class { async dispatch() { recorded.dispatchCalls += 1; } } },
});

type CreateModule  = typeof import("./create-payment");
type ConvertModule = typeof import("./convert-payment-to-allocated");
type ReadModule    = typeof import("./get-payments");
let createPayment: CreateModule["createPayment"];
let convertPaymentToAllocated: ConvertModule["convertPaymentToAllocated"];
let getPaymentsByInvoice: ReadModule["getPaymentsByInvoice"];

before(async () => {
  createPayment = (await import("./create-payment")).createPayment;
  convertPaymentToAllocated = (await import("./convert-payment-to-allocated")).convertPaymentToAllocated;
  getPaymentsByInvoice = (await import("./get-payments")).getPaymentsByInvoice;
});

function withScenario(s: Scenario) {
  scenario = s;
  resetRecording();
}

function baseFd(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("idempotency_key", "key-abc-123");
  fd.set("amount", "10000");
  fd.set("fee_amount", "0");
  fd.set("payment_date", "2026-08-15");
  fd.set("payment_method", "cash");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const INV = "55555555-5555-4555-8555-555555555555";
const CUS = "44444444-4444-4444-8444-444444444444";

// ─── one-RPC mutation contract ───────────────────────────────────────────────

test("1. legacy_direct: exactly ONE record RPC call, zero table access", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const r = await createPayment(baseFd({ mode: "legacy_direct", invoice_id: INV, allocations: "[]" }));
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal(recorded.rpcCalls.length, 1);
  assert.equal(recorded.rpcCalls[0][0], "record_payment_with_allocations_rpc");
  assert.deepEqual(recorded.fromTables, [], "no direct table access of any kind");
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_mode, "legacy_direct");
  assert.equal(args.p_invoice_id, INV);
  assert.equal(args.p_customer_id, null);
  assert.deepEqual(args.p_allocations, []);
});

test("2. allocated: customer + allocation rows, null invoice", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const allocations = JSON.stringify([
    { invoice_id: INV, allocated_amount: 6000, allocation_order: 0 },
    { invoice_id: CUS, allocated_amount: 4000, allocation_order: 1 },
  ]);
  const r = await createPayment(baseFd({ mode: "allocated", customer_id: CUS, allocations }));
  assert.ok("success" in r, JSON.stringify(r));
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_mode, "allocated");
  assert.equal(args.p_invoice_id, null);
  assert.equal(args.p_customer_id, CUS);
  assert.deepEqual(args.p_allocations, [
    { invoice_id: INV, allocated_amount: 6000, allocation_order: 0 },
    { invoice_id: CUS, allocated_amount: 4000, allocation_order: 1 },
  ]);
});

test("3. unapplied: customer, null invoice, empty allocations", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const r = await createPayment(baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" }));
  assert.ok("success" in r);
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_mode, "unapplied");
  assert.equal(args.p_invoice_id, null);
  assert.equal(args.p_customer_id, CUS);
  assert.deepEqual(args.p_allocations, []);
});

test("4. dealer and actor are server-derived; client-supplied identity fields are ignored", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const fd = baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" });
  fd.set("dealer_id", "99999999-9999-4999-8999-999999999999");
  fd.set("actor", "99999999-9999-4999-8999-999999999999");
  fd.set("p_actor", "99999999-9999-4999-8999-999999999999");
  await createPayment(fd);
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_dealer_id, DEALER, "dealer comes from requireStaffCapability");
  assert.equal(args.p_actor, ACTOR, "actor comes from the session user");
});

test("5. net amount is never client authority (p_net_amount null); status forced completed", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const fd = baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" });
  fd.set("net_amount", "1");
  fd.set("status", "refunded");
  await createPayment(fd);
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_net_amount, null);
  assert.equal(args.p_status, "completed");
});

test("6. blank idempotency key fails closed BEFORE the RPC; identical retry forwards the identical key", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const blank = baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" });
  blank.set("idempotency_key", "   ");
  const r = await createPayment(blank);
  assert.ok("error" in r);
  assert.equal(recorded.rpcCalls.length, 0);

  withScenario({ rpcData: PAYMENT_ROW });
  const fd = baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" });
  await createPayment(fd);
  await createPayment(fd);
  assert.equal(recorded.rpcCalls.length, 2);
  assert.equal(recorded.rpcCalls[0][1].p_idempotency_key, "key-abc-123");
  assert.equal(recorded.rpcCalls[1][1].p_idempotency_key, "key-abc-123");
});

test("7. RPC error -> mapped message and zero side effects", async () => {
  withScenario({ rpcError: { message: "payment_idempotency_conflict" } });
  const r = await createPayment(baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" }));
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /リクエストキー/);
  assert.equal(recorded.activityCalls + recorded.notifyCalls + recorded.engagementCalls + recorded.dispatchCalls, 0);
});

test("8. IDEMPOTENT RETRY: identical calls return the same RPC payment id with ZERO side effects (I1-R1)", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const fd = baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" });
  const r1 = await createPayment(fd);
  const r2 = await createPayment(fd);
  assert.ok("success" in r1 && "success" in r2);
  assert.equal((r1 as { id: string }).id, PAYMENT_ROW.id);
  assert.equal((r2 as { id: string }).id, PAYMENT_ROW.id, "both retries return the SAME RPC-supplied id");
  assert.equal(recorded.rpcCalls.length, 2, "each attempt is exactly one record RPC");
  assert.equal(recorded.rpcCalls[0][0], "record_payment_with_allocations_rpc");
  assert.equal(recorded.rpcCalls[1][0], "record_payment_with_allocations_rpc");
  assert.deepEqual(recorded.fromTables, [], "no pre-read, post-read, or direct write");
  assert.equal(recorded.activityCalls, 0);
  assert.equal(recorded.notifyCalls, 0);
  assert.equal(recorded.engagementCalls, 0);
  assert.equal(recorded.dispatchCalls, 0);
});

test("9. create-payment.ts imports no side-effect module at all (deferred by contract)", () => {
  const src = readFileSync("src/lib/payments/create-payment.ts", "utf8");
  for (const forbidden of [
    "createActivityLog", "createNotification", "createEngagementEvent", "EngagementWorkflowRuntime",
    "activity/activity-log", "notifications/notification", "customer-engagement",
  ]) {
    assert.ok(!src.includes(forbidden), `must not reference ${forbidden}`);
  }
});

test("10. authorization denial fails closed before any client or RPC use", async () => {
  withScenario({ auth: { error: "この操作を行う権限がありません" } });
  const r = await createPayment(baseFd({ mode: "unapplied", customer_id: CUS, allocations: "[]" }));
  assert.ok("error" in r);
  assert.equal(recorded.rpcCalls.length, 0);
  assert.equal(recorded.clientCreations, 0);
});

test("11. mode-shape gates fail closed before the RPC", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  assert.ok("error" in await createPayment(baseFd({ mode: "legacy_direct", allocations: "[]" })), "legacy without invoice");
  assert.ok("error" in await createPayment(baseFd({ mode: "allocated", customer_id: CUS, allocations: "[]" })), "allocated without allocations");
  assert.ok("error" in await createPayment(baseFd({ mode: "unapplied", customer_id: CUS, allocations: JSON.stringify([{ invoice_id: INV, allocated_amount: 1, allocation_order: 0 }]) })), "unapplied with allocations");
  assert.ok("error" in await createPayment(baseFd({ mode: "evil", customer_id: CUS, allocations: "[]" })), "unknown mode");
  assert.equal(recorded.rpcCalls.length, 0);
});

// ─── conversion ──────────────────────────────────────────────────────────────

test("12. conversion: exactly ONE convert RPC call with server-derived identity", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  const r = await convertPaymentToAllocated(PAYMENT_ROW.id, [
    { invoice_id: INV, allocated_amount: 10000, allocation_order: 0 },
  ]);
  assert.ok("success" in r, JSON.stringify(r));
  assert.equal(recorded.rpcCalls.length, 1);
  assert.equal(recorded.rpcCalls[0][0], "convert_payment_to_allocated_rpc");
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_dealer_id, DEALER);
  assert.equal(args.p_actor, ACTOR);
  assert.equal(args.p_payment_id, PAYMENT_ROW.id);
  assert.deepEqual(recorded.fromTables, [], "no direct table writes");
});

test("13. conversion rejects malformed allocation sets before the RPC", async () => {
  withScenario({ rpcData: PAYMENT_ROW });
  assert.ok("error" in await convertPaymentToAllocated(PAYMENT_ROW.id, []));
  assert.ok("error" in await convertPaymentToAllocated(PAYMENT_ROW.id, [
    { invoice_id: INV, allocated_amount: -5, allocation_order: 0 },
  ]));
  assert.ok("error" in await convertPaymentToAllocated(PAYMENT_ROW.id, [
    { invoice_id: INV, allocated_amount: 1, allocation_order: 0 },
    { invoice_id: INV, allocated_amount: 2, allocation_order: 1 },
  ]));
  assert.equal(recorded.rpcCalls.length, 0);
});

test("14. conversion RPC errors are surfaced without fallback mutation", async () => {
  withScenario({ rpcError: { message: "payment_rpc_conversion_missing_original_invoice" } });
  const r = await convertPaymentToAllocated(PAYMENT_ROW.id, [
    { invoice_id: INV, allocated_amount: 10000, allocation_order: 0 },
  ]);
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /元の請求書/);
  assert.deepEqual(recorded.fromTables, []);
});

// ─── invoice-scoped union read (I1-R1) ───────────────────────────────────────

function paymentRow(id: string, over: Row = {}): Row {
  return {
    id, dealer_id: DEALER, invoice_id: null, customer_id: CUS,
    amount: 10000, fee_amount: 0, net_amount: 10000, status: "completed",
    payment_method: "cash", payment_date: "2026-08-10", created_at: "2026-08-10T00:00:00Z",
    ...over,
  };
}

test("15. visibility: a legacy-direct payment appears with invoice_context_amount = amount", async () => {
  withScenario({ directRows: [paymentRow("p-direct", { invoice_id: INV, amount: 5000 })] });
  const rows = await getPaymentsByInvoice(INV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "p-direct");
  assert.equal(rows[0].invoice_context_amount, 5000);
});

test("16. visibility: an allocated payment (null invoice_id) appears with ONLY its allocated amount", async () => {
  withScenario({
    allocRows:  [{ payment_id: "p-alloc", allocated_amount: 3000 }],
    byIdsRows:  [paymentRow("p-alloc", { amount: 10000 })],
    directRows: [],
  });
  const rows = await getPaymentsByInvoice(INV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "p-alloc");
  assert.equal(rows[0].invoice_context_amount, 3000, "the invoice-specific applied amount");
  assert.equal(rows[0].amount, 10000, "the full payment amount stays intact");
});

test("17. visibility: every sub-query is invoice- and dealer-scoped", async () => {
  withScenario({
    allocRows:  [{ payment_id: "p-alloc", allocated_amount: 3000 }],
    byIdsRows:  [paymentRow("p-alloc")],
    directRows: [paymentRow("p-direct", { invoice_id: INV })],
  });
  await getPaymentsByInvoice(INV);
  assert.ok(recorded.eqCalls.some(([t, c, v]) => t === "payment_allocations" && c === "invoice_id" && v === INV));
  assert.ok(recorded.eqCalls.some(([t, c, v]) => t === "payment_allocations" && c === "dealer_id" && v === DEALER));
  const paymentDealerScopes = recorded.eqCalls.filter(([t, c, v]) => t === "payments" && c === "dealer_id" && v === DEALER);
  assert.equal(paymentDealerScopes.length, 2, "both payment sub-queries are dealer-scoped");
});

test("18. visibility: a payment reachable through both paths is returned once (direct wins)", async () => {
  withScenario({
    allocRows:  [{ payment_id: "p-both", allocated_amount: 2000 }],
    byIdsRows:  [paymentRow("p-both", { amount: 7000 })],
    directRows: [paymentRow("p-both", { invoice_id: INV, amount: 7000 })],
  });
  const rows = await getPaymentsByInvoice(INV);
  assert.equal(rows.length, 1, "deduplicated");
  assert.equal(rows[0].invoice_context_amount, 7000, "the direct row's full amount wins");
});

test("19. visibility: deterministic ordering (payment_date desc, nulls last, created_at desc)", async () => {
  withScenario({
    directRows: [
      paymentRow("p-old",  { invoice_id: INV, payment_date: "2026-08-01" }),
      paymentRow("p-null", { invoice_id: INV, payment_date: null }),
      paymentRow("p-new",  { invoice_id: INV, payment_date: "2026-08-20" }),
    ],
  });
  const rows = await getPaymentsByInvoice(INV);
  assert.deepEqual(rows.map((r) => r.id), ["p-new", "p-old", "p-null"]);
});

test("20. visibility: a failed sub-query fails CLOSED (empty, never partial)", async () => {
  withScenario({
    allocError: { message: "boom" },
    directRows: [paymentRow("p-direct", { invoice_id: INV })],
  });
  assert.deepEqual(await getPaymentsByInvoice(INV), [], "allocation failure hides nothing partially");

  withScenario({
    allocRows:   [{ payment_id: "p-alloc", allocated_amount: 3000 }],
    byIdsRows:   [paymentRow("p-alloc")],
    directError: { message: "boom" },
  });
  assert.deepEqual(await getPaymentsByInvoice(INV), [], "direct failure hides nothing partially");
});

// ─── forbidden-surface source scans ──────────────────────────────────────────

const ACTION_FILES = [
  "src/lib/payments/create-payment.ts",
  "src/lib/payments/convert-payment-to-allocated.ts",
  "src/lib/payments/get-payment-allocations.ts",
  "src/lib/payments/get-payments.ts",
  "src/lib/payments/update-payment.ts",
  "src/lib/payments/delete-payment.ts",
];

test("21. no admin client, service role, numbering allocation, or TS recalculation anywhere", () => {
  for (const f of ACTION_FILES) {
    const src = readFileSync(f, "utf8");
    for (const forbidden of [
      "supabase/admin", "createAdminClient", "SERVICE_ROLE", "service_role",
      "getNextDocumentNumber", "recalculateInvoicePayment", "b3_recalc_invoice_payment",
    ]) {
      assert.ok(!src.includes(forbidden), `${f} must not contain ${forbidden}`);
    }
  }
});

test("22. create/convert perform no direct financial table writes in source", () => {
  for (const f of ["src/lib/payments/create-payment.ts", "src/lib/payments/convert-payment-to-allocated.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!src.includes(".from("), `${f} never touches a table directly`);
    assert.ok(!src.includes(".insert("), `${f} never inserts`);
    assert.ok(!src.includes(".delete("), `${f} never deletes`);
  }
});
