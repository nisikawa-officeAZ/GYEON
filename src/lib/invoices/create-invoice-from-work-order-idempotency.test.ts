// GDA-3B — Focused behavior tests for createInvoiceFromWorkOrder's replay guard.
//
// Plain `node:test` + `node:assert/strict`. Every external dependency —
// `requireStaffCapability`, `getCurrentDealer`, and `createClient` — is
// replaced with `mock.module`, so no real DB, Supabase, Auth, Storage, LINE,
// EC, network, or clock service is ever contacted. An in-memory fake Supabase
// client RECORDS all table access, which is what proves the "zero downstream
// writes on replay" and "exactly one insert on first call" claims.
//
// Run: node --experimental-test-module-mocks --import tsx/dist/loader.mjs
//        --test src/lib/invoices/create-invoice-from-work-order-idempotency.test.ts

import { strict as assert } from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

// ── Module mocks: installed BEFORE the module under test is imported. ────────

interface Scenario {
  authError?: string; // when set, requireStaffCapability fails closed
  dealer?: { dealer_id: string } | null;
  existingInvoice?: { id: string } | null;
  existingLookupError?: boolean;
  workOrder?: {
    id: string;
    customer_id: string | null;
    vehicle_id: string | null;
    title: string | null;
    actual_end_at: string | null;
    estimate_id: string | null;
    estimates: {
      id: string;
      estimate_number: string | null;
      title: string | null;
      tax_rate: number;
      discount_amount: number;
      estimate_items: Array<{
        category: string; item_name: string; description: string | null;
        quantity: number; unit_price: number; discount_rate: number;
        line_total: number; sort_order: number;
      }>;
    } | null;
  } | null;
  workOrderError?: boolean;
  insertInvoiceError?: boolean;
  insertItemsError?: boolean;
}

interface CallLog {
  tables: string[];
  invoiceSelectEqs: Array<{ column: string; value: unknown }>;
  invoiceInserts: Array<Record<string, unknown>>;
  itemInserts: Array<Record<string, unknown>>;
  invoiceDeletes: Array<string>;
  workOrderFetches: number;
}

let scenario: Scenario = {};
let log: CallLog = {
  tables: [],
  invoiceSelectEqs: [],
  invoiceInserts: [],
  itemInserts: [],
  invoiceDeletes: [],
  workOrderFetches: 0,
};

const DEALER = "22222222-2222-4222-8222-222222222222";
const WORK_ORDER = "33333333-3333-4333-8333-333333333333";
const EXISTING_INVOICE = "44444444-4444-4444-8444-444444444444";
const NEW_INVOICE = "55555555-5555-4555-8555-555555555555";

function makeInvoicesSelectBuilder() {
  const eqs: Array<{ column: string; value: unknown }> = [];
  const builder = {
    eq(column: string, value: unknown) {
      eqs.push({ column, value });
      log.invoiceSelectEqs.push({ column, value });
      return builder;
    },
    async maybeSingle() {
      if (scenario.existingLookupError) {
        return { data: null, error: { message: "lookup boom" } };
      }
      return { data: scenario.existingInvoice ?? null, error: null };
    },
  };
  return builder;
}

function makeInvoicesInsertBuilder(row: Record<string, unknown>) {
  log.invoiceInserts.push(row);
  const builder = {
    select() {
      return builder;
    },
    async single() {
      if (scenario.insertInvoiceError) {
        return { data: null, error: { message: "insert boom" } };
      }
      return { data: { id: NEW_INVOICE }, error: null };
    },
  };
  return builder;
}

function makeInvoicesDeleteBuilder() {
  const builder = {
    eq(_column: string, value: unknown) {
      log.invoiceDeletes.push(String(value));
      return Promise.resolve({ data: null, error: null });
    },
  };
  return builder;
}

const fakeClient = {
  from(table: string) {
    log.tables.push(table);
    if (table === "invoices") {
      return {
        select: () => makeInvoicesSelectBuilder(),
        insert: (row: Record<string, unknown>) => makeInvoicesInsertBuilder(row),
        delete: () => makeInvoicesDeleteBuilder(),
      };
    }
    if (table === "work_orders") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              async single() {
                log.workOrderFetches += 1;
                if (scenario.workOrderError) return { data: null, error: { message: "wo boom" } };
                return { data: scenario.workOrder ?? null, error: null };
              },
            }),
          }),
        }),
      };
    }
    if (table === "invoice_items") {
      return {
        insert: (rows: Array<Record<string, unknown>>) => {
          log.itemInserts.push(...rows);
          return Promise.resolve({
            data: null,
            error: scenario.insertItemsError ? { message: "items boom" } : null,
          });
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  },
};

// Node 26 renamed the mock.module() export option; the previous spelling now
// emits a deprecation warning. The installed @types/node does not yet
// describe the current option, so the call is made through Reflect.apply —
// itself fully typed — rather than defeating the type system with a cast.
// This is a test-harness concern only: no mocked boundary or assertion changes.
function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/supabase/server", { createClient: async () => fakeClient });

mockModule("@/lib/auth/require-staff-capability", {
  requireStaffCapability: async () => {
    if (scenario.authError) return { error: scenario.authError };
    return { dealerId: DEALER, role: "owner" };
  },
});

mockModule("@/lib/auth/get-current-dealer", {
  getCurrentDealer: async () => scenario.dealer,
});

mockModule("@/lib/activity/activity-log", {
  createActivityLog: async () => {
    throw new Error("createActivityLog must not be called by createInvoiceFromWorkOrder");
  },
});

mockModule("@/lib/numbering/get-next-document-number", {
  getNextDocumentNumber: async () => {
    throw new Error("getNextDocumentNumber must not be called by createInvoiceFromWorkOrder");
  },
});

// The module under test loads AFTER mock.module registration above. A root
// `before` hook (not a top-level await) matches this repository's Node
// 26-compatible mock registration pattern for CJS output.
let createInvoiceFromWorkOrder: typeof import("./create-invoice")["createInvoiceFromWorkOrder"];
before(async () => {
  ({ createInvoiceFromWorkOrder } = await import("./create-invoice"));
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const completeWorkOrderRow = () => ({
  id: WORK_ORDER,
  customer_id: "cust-1",
  vehicle_id: "veh-1",
  title: "GYEONコーティング",
  actual_end_at: "2026-08-15T10:00:00Z",
  estimate_id: "est-1",
  estimates: {
    id: "est-1",
    estimate_number: "EST-00001",
    title: "見積",
    tax_rate: 10,
    discount_amount: 0,
    estimate_items: [
      {
        category: "コーティング", item_name: "GYEON施工", description: null,
        quantity: 1, unit_price: 30000, discount_rate: 0, line_total: 30000, sort_order: 0,
      },
    ],
  },
});

beforeEach(() => {
  scenario = { dealer: { dealer_id: DEALER } };
  log = {
    tables: [],
    invoiceSelectEqs: [],
    invoiceInserts: [],
    itemInserts: [],
    invoiceDeletes: [],
    workOrderFetches: 0,
  };
});

// ── Authorization occurs before data access ──────────────────────────────────

describe("authorization ordering", () => {
  it("denies with zero table access when finance capability is refused", async () => {
    scenario.authError = "この操作を行う権限がありません";
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { error: "この操作を行う権限がありません" });
    assert.equal(log.tables.length, 0);
  });

  it("fails with 認証エラー and zero table access when dealer resolution fails", async () => {
    scenario.dealer = null;
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { error: "認証エラー" });
    assert.equal(log.tables.length, 0);
  });
});

// ── Existence lookup scoping ─────────────────────────────────────────────────

describe("existence lookup scoping", () => {
  it("scopes the existence lookup by both dealer_id and work_order_id before any other table read", async () => {
    scenario.existingInvoice = { id: EXISTING_INVOICE };
    await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(log.invoiceSelectEqs, [
      { column: "dealer_id", value: DEALER },
      { column: "work_order_id", value: WORK_ORDER },
    ]);
    // The existence lookup is the first (and, on a match, only) table touch.
    assert.equal(log.tables[0], "invoices");
  });
});

// ── Fail closed on lookup error ──────────────────────────────────────────────

describe("lookup error fail-closed", () => {
  it("fails closed with zero downstream writes when the existence lookup errors", async () => {
    scenario.existingLookupError = true;
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { error: "請求書の確認に失敗しました" });
    assert.equal(log.tables.length, 1, "only the failed lookup itself touched a table");
    assert.equal(log.workOrderFetches, 0);
    assert.equal(log.invoiceInserts.length, 0);
    assert.equal(log.itemInserts.length, 0);
    assert.equal(log.invoiceDeletes.length, 0);
  });
});

// ── Existing row: replay with zero downstream side effects ─────────────────

describe("existing invoice replay", () => {
  it("returns the existing id with alreadyExists true and performs no downstream action", async () => {
    scenario.existingInvoice = { id: EXISTING_INVOICE };
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { success: true, id: EXISTING_INVOICE, alreadyExists: true });
    assert.equal(log.workOrderFetches, 0, "no work-order fetch on replay");
    assert.equal(log.invoiceInserts.length, 0, "no invoice insert on replay");
    assert.equal(log.itemInserts.length, 0, "no item insert on replay");
    assert.equal(log.invoiceDeletes.length, 0, "no delete on replay");
    assert.deepEqual(log.tables, ["invoices"], "no numbering or activity-log table/call on replay");
  });
});

// ── Missing row: existing create path, exactly one insert ──────────────────

describe("first-call creation", () => {
  it("follows the existing create path, performs exactly one invoice insert, and returns alreadyExists false", async () => {
    scenario.existingInvoice = null;
    scenario.workOrder = completeWorkOrderRow();
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.ok(!("error" in result), "expected success");
    if (!("error" in result)) {
      assert.equal(result.id, NEW_INVOICE);
      assert.equal(result.alreadyExists, false);
    }
    assert.equal(log.workOrderFetches, 1);
    assert.equal(log.invoiceInserts.length, 1);
    assert.equal(log.invoiceInserts[0]?.work_order_id, WORK_ORDER);
    assert.equal(log.invoiceInserts[0]?.dealer_id, DEALER);
    assert.equal(log.invoiceInserts[0]?.status, "draft");
    assert.equal(log.itemInserts.length, 1);
  });

  it("maps a missing work order to a stable Japanese not-found error with no insert", async () => {
    scenario.existingInvoice = null;
    scenario.workOrder = null;
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { error: "作業指示書が見つかりません" });
    assert.equal(log.invoiceInserts.length, 0);
  });

  it("rolls back the invoice when item insert fails", async () => {
    scenario.existingInvoice = null;
    scenario.workOrder = completeWorkOrderRow();
    scenario.insertItemsError = true;
    const result = await createInvoiceFromWorkOrder(WORK_ORDER);
    assert.deepEqual(result, { error: "明細の保存に失敗しました" });
    assert.equal(log.invoiceInserts.length, 1);
    assert.deepEqual(log.invoiceDeletes, [NEW_INVOICE]);
  });
});
