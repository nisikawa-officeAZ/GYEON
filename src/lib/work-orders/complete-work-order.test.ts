// GDA-1W-C3 — Focused tests for the complete-work-order server adapter.
//
// Plain `node:test` + `node:assert/strict`. The adapter's single external
// dependency — `createClient` from "@/lib/supabase/server" — is replaced with
// `mock.module`, so every test drives an in-memory fake Supabase client that
// RECORDS all table access and RPC calls. That record is what proves the
// side-effect claims: exactly one RPC on success, zero RPCs on every refusal,
// and no table beyond the four the adapter is allowed to read.
//
// NOTE for the separately authorized verification gate: `mock.module` requires
// Node's module-mock support (`--experimental-test-module-mocks` on the node
// invocation, alongside `--import tsx --test`).

import { strict as assert } from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

// ── Module mock: installed BEFORE the module under test is imported. ─────────

interface FakeUser {
  id: string;
}

interface Scenario {
  user?: FakeUser | null | "error";
  workOrder?: {
    dealer_id: string;
    status: string;
    actual_start_at: string | null;
    deleted_at: string | null;
  } | null;
  workOrderError?: boolean;
  staffRows?: Array<{ status: string; role: string }> | "error";
  memberRows?: Array<{ role: string }> | "error";
  ownerMatches?: boolean | "error";
  rpc?: { data: unknown; error: { message: string } | null };
}

interface CallLog {
  tables: string[];
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

let scenario: Scenario = {};
let log: CallLog = { tables: [], rpcCalls: [] };

function fakeQueryResult(table: string): {
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: (resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) => unknown;
  eq: (column: string, value: unknown) => ReturnType<typeof fakeQueryResult>;
} {
  const resolve = (): { data: unknown; error: { message: string } | null } => {
    if (table === "work_orders") {
      if (scenario.workOrderError) return { data: null, error: { message: "read boom" } };
      return { data: scenario.workOrder ?? null, error: null };
    }
    if (table === "dealer_staff") {
      if (scenario.staffRows === "error") return { data: null, error: { message: "staff boom" } };
      return { data: scenario.staffRows ?? [], error: null };
    }
    if (table === "dealer_members") {
      if (scenario.memberRows === "error") return { data: null, error: { message: "member boom" } };
      return { data: scenario.memberRows ?? [], error: null };
    }
    if (table === "dealers") {
      if (scenario.ownerMatches === "error") return { data: null, error: { message: "owner boom" } };
      return { data: scenario.ownerMatches ? { id: DEALER } : null, error: null };
    }
    return { data: null, error: { message: `unexpected table ${table}` } };
  };
  const builder = {
    eq: () => builder,
    maybeSingle: async () => resolve(),
    // Awaiting the builder itself (list reads) resolves like a thenable.
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled),
  };
  return builder as ReturnType<typeof fakeQueryResult>;
}

const fakeClient = {
  auth: {
    getUser: async () => {
      if (scenario.user === "error") return { data: { user: null }, error: { message: "auth boom" } };
      // undefined = "not specified" -> default actor; an EXPLICIT null must stay
      // null (?? would swallow it and fake a session where the test wants none).
      return { data: { user: scenario.user === undefined ? { id: ACTOR } : scenario.user }, error: null };
    },
  },
  from: (table: string) => {
    log.tables.push(table);
    return { select: () => fakeQueryResult(table) };
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    log.rpcCalls.push({ name, args });
    return scenario.rpc ?? { data: null, error: { message: "no rpc scenario configured" } };
  },
};

mock.module("@/lib/supabase/server", {
  namedExports: { createClient: async () => fakeClient },
});

// The module under test loads AFTER mock.module registration above. A typed
// module variable initialized in a root `before` hook replaces the previous
// top-level `await import(...)`: CJS output (the repo has no "type": "module")
// cannot contain top-level await, but the hook body may await freely, and
// node:test runs root `before` prior to every registered test.
let completeWorkOrder: typeof import("./complete-work-order")["completeWorkOrder"];
before(async () => {
  ({ completeWorkOrder } = await import("./complete-work-order"));
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTOR = "11111111-1111-4111-8111-111111111111";
const DEALER = "22222222-2222-4222-8222-222222222222";
const WORK_ORDER = "33333333-3333-4333-8333-333333333333";
const REPORT = "44444444-4444-4444-8444-444444444444";
const FP = "a".repeat(64);

const validCommand = () => ({
  workOrderId: WORK_ORDER,
  idempotencyKey: "intent-key-0123456789",
  actualEndAt: new Date(Date.now() - 60_000).toISOString(),
  performedItems: [{ category: "コーティング", itemName: "GYEON施工", description: null }],
});

const completableOrder = () => ({
  dealer_id: DEALER,
  status: "in_progress",
  actual_start_at: null,
  deleted_at: null,
});

const rpcRow = (overrides: Record<string, unknown> = {}) => ({
  work_order_id: WORK_ORDER,
  completion_report_id: REPORT,
  report_number: "REP-00001",
  performed_work_version: 1,
  request_fingerprint: FP,
  outcome: "created",
  created: true,
  replayed: false,
  ...overrides,
});

const okScenario = (overrides: Scenario = {}): Scenario => ({
  workOrder: completableOrder(),
  staffRows: [{ status: "active", role: "staff" }],
  rpc: { data: [rpcRow()], error: null },
  ...overrides,
});

beforeEach(() => {
  scenario = {};
  log = { tables: [], rpcCalls: [] };
});

// ── Authorization paths ──────────────────────────────────────────────────────

describe("authorization", () => {
  it("an active dealer_staff row authorizes and the RPC runs exactly once", async () => {
    scenario = okScenario();
    const result = await completeWorkOrder(validCommand());
    assert.deepEqual(result, { ok: true, result: rpcRow() });
    assert.equal(log.rpcCalls.length, 1);
    assert.equal(log.rpcCalls[0]?.name, "complete_work_order_v1");
  });

  it("a blocking staff row denies with NO fallback even when member and owner would authorize", async () => {
    for (const staffRows of [
      [{ status: "disabled", role: "owner" }],
      [{ status: "invited", role: "manager" }],
      [{ status: "active", role: "readonly" }],
      [
        { status: "active", role: "owner" },
        { status: "active", role: "staff" },
      ],
    ]) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({
        staffRows,
        memberRows: [{ role: "owner" }],
        ownerMatches: true,
      });
      const result = await completeWorkOrder(validCommand());
      assert.deepEqual(result, { ok: false, code: "PERMISSION_DENIED" });
      assert.equal(log.rpcCalls.length, 0);
      // The blocking row forbids the fallback READS, not merely the outcome.
      assert.equal(log.tables.includes("dealer_members"), false);
      assert.equal(log.tables.includes("dealers"), false);
    }
  });

  it("with no staff row, an active member editing role authorizes", async () => {
    scenario = okScenario({ staffRows: [], memberRows: [{ role: "manager" }] });
    const result = await completeWorkOrder(validCommand());
    assert.equal(result.ok, true);
    assert.equal(log.rpcCalls.length, 1);
  });

  it("with no staff row and no active membership, the dealer owner authorizes", async () => {
    scenario = okScenario({ staffRows: [], memberRows: [], ownerMatches: true });
    const result = await completeWorkOrder(validCommand());
    assert.equal(result.ok, true);
    assert.equal(log.rpcCalls.length, 1);
  });

  it("a readonly membership without ownership denies", async () => {
    scenario = okScenario({ staffRows: [], memberRows: [{ role: "readonly" }], ownerMatches: false });
    assert.deepEqual(await completeWorkOrder(validCommand()), {
      ok: false,
      code: "PERMISSION_DENIED",
    });
    assert.equal(log.rpcCalls.length, 0);
  });

  it("no session maps to UNAUTHENTICATED without an RPC", async () => {
    for (const user of [null, "error"] as const) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({ user });
      assert.deepEqual(await completeWorkOrder(validCommand()), {
        ok: false,
        code: "UNAUTHENTICATED",
      });
      assert.equal(log.rpcCalls.length, 0);
    }
  });

  it("actor-context read failures fail closed as PERMISSION_DENIED", async () => {
    for (const broken of [
      { staffRows: "error" as const },
      { staffRows: [], memberRows: "error" as const },
      { staffRows: [], memberRows: [], ownerMatches: "error" as const },
    ]) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario(broken);
      assert.deepEqual(await completeWorkOrder(validCommand()), {
        ok: false,
        code: "PERMISSION_DENIED",
      });
      assert.equal(log.rpcCalls.length, 0);
    }
  });
});

// ── Command validation: refused BEFORE any I/O ───────────────────────────────

describe("invalid commands", () => {
  it("rejects a malformed work order id with no Supabase access at all", async () => {
    scenario = okScenario();
    const result = await completeWorkOrder({ ...validCommand(), workOrderId: "not-a-uuid" });
    assert.deepEqual(result, { ok: false, code: "VALIDATION_ERROR" });
    assert.equal(log.tables.length, 0);
    assert.equal(log.rpcCalls.length, 0);
  });

  it("rejects a short idempotency key, monetary items, and an unparsable instant", async () => {
    scenario = okScenario();
    const bads = [
      { ...validCommand(), idempotencyKey: "short" },
      {
        ...validCommand(),
        performedItems: [
          { category: "c", itemName: "n", description: null, unitPrice: 1000 } as never,
        ],
      },
      { ...validCommand(), performedItems: [] },
      { ...validCommand(), actualEndAt: "yesterday-ish" },
      { ...validCommand(), actualEndAt: new Date(Date.now() + 10 * 60_000).toISOString() },
    ];
    for (const bad of bads) {
      log = { tables: [], rpcCalls: [] };
      assert.deepEqual(await completeWorkOrder(bad), { ok: false, code: "VALIDATION_ERROR" });
      assert.equal(log.tables.length, 0);
      assert.equal(log.rpcCalls.length, 0);
    }
  });

  it("maps a missing or soft-deleted work order to coarse NOT_FOUND", async () => {
    for (const workOrder of [
      null,
      { ...completableOrder(), deleted_at: "2026-08-01T00:00:00Z" },
    ]) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({ workOrder });
      assert.deepEqual(await completeWorkOrder(validCommand()), {
        ok: false,
        code: "NOT_FOUND",
      });
      assert.equal(log.rpcCalls.length, 0);
    }
  });

  it("rejects a cancelled order as INVALID_STATE before the RPC", async () => {
    scenario = okScenario({ workOrder: { ...completableOrder(), status: "cancelled" } });
    assert.deepEqual(await completeWorkOrder(validCommand()), {
      ok: false,
      code: "INVALID_STATE",
    });
    assert.equal(log.rpcCalls.length, 0);
  });

  it("rejects an end earlier than the recorded start", async () => {
    scenario = okScenario({
      workOrder: { ...completableOrder(), actual_start_at: new Date().toISOString() },
    });
    const result = await completeWorkOrder({
      ...validCommand(),
      actualEndAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    assert.deepEqual(result, { ok: false, code: "VALIDATION_ERROR" });
    assert.equal(log.rpcCalls.length, 0);
  });

  it("passes an already-completed order THROUGH to the RPC for authoritative resolution", async () => {
    scenario = okScenario({
      workOrder: { ...completableOrder(), status: "completed" },
      rpc: { data: [rpcRow({ outcome: "replayed", created: false, replayed: true })], error: null },
    });
    const result = await completeWorkOrder(validCommand());
    assert.equal(result.ok, true);
    assert.equal(log.rpcCalls.length, 1);
  });
});

// ── RPC payload ──────────────────────────────────────────────────────────────

describe("RPC payload", () => {
  it("sends exactly the four §5.1 inputs, trimmed and normalized", async () => {
    scenario = okScenario();
    await completeWorkOrder({
      ...validCommand(),
      idempotencyKey: "  intent-key-0123456789  ",
      performedItems: [{ category: " コーティング ", itemName: " GYEON施工 ", description: "  " }],
    });
    const call = log.rpcCalls[0];
    assert.ok(call);
    assert.deepEqual(Object.keys(call.args).sort(), [
      "p_actual_end_at",
      "p_idempotency_key",
      "p_performed_items",
      "p_work_order_id",
    ]);
    assert.equal(call.args.p_work_order_id, WORK_ORDER);
    assert.equal(call.args.p_idempotency_key, "intent-key-0123456789"); // trimmed
    // Items carry the exact three client fields — no sortOrder, no monetary key.
    assert.deepEqual(call.args.p_performed_items, [
      { category: "コーティング", itemName: "GYEON施工", description: null },
    ]);
  });
});

// ── Outcome and error mapping ────────────────────────────────────────────────

describe("outcome mapping", () => {
  it("passes created, replayed, and recovered rows through as typed results", async () => {
    const rows = [
      rpcRow(),
      rpcRow({ outcome: "replayed", created: false, replayed: true }),
      rpcRow({ outcome: "recovered", created: false, replayed: true }),
    ];
    for (const row of rows) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({ rpc: { data: [row], error: null } });
      assert.deepEqual(await completeWorkOrder(validCommand()), { ok: true, result: row });
    }
  });

  it("maps every stable 'CODE: text' RPC error to its literal domain code", async () => {
    const codes = [
      "UNAUTHENTICATED",
      "NOT_FOUND",
      "PERMISSION_DENIED",
      "VALIDATION_ERROR",
      "INVALID_STATE",
      "IDEMPOTENCY_CONFLICT",
      "ALREADY_COMPLETED_CONFLICT",
      "RECOVERY_REQUIRED",
      "COMPLETION_STATE_INCONSISTENT",
      "REPORT_NUMBER_FAILED",
    ];
    for (const code of codes) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({
        rpc: { data: null, error: { message: `${code}: some human explanation` } },
      });
      assert.deepEqual(await completeWorkOrder(validCommand()), { ok: false, code });
    }
  });

  it("maps non-domain error text to a stable UNEXPECTED_ERROR carrying no raw SQL", async () => {
    for (const message of [
      'permission denied for table work_orders',
      'duplicate key value violates unique constraint "x"',
      "COMPLETION_FAILED: not a client-facing code",
      "",
    ]) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({ rpc: { data: null, error: { message } } });
      const result = await completeWorkOrder(validCommand());
      assert.deepEqual(result, { ok: false, code: "UNEXPECTED_ERROR" });
      // The failure object exposes ONLY the two stable fields — never message text.
      assert.deepEqual(Object.keys(result).sort(), ["code", "ok"]);
    }
  });

  it("maps malformed RPC rows to UNEXPECTED_ERROR", async () => {
    const malformed = [
      null,
      [],
      [{}],
      [rpcRow({ outcome: "finished" })],
      [rpcRow({ performed_work_version: "1" })],
      [(() => { const r = rpcRow() as Record<string, unknown>; delete r.report_number; return r; })()],
    ];
    for (const data of malformed) {
      log = { tables: [], rpcCalls: [] };
      scenario = okScenario({ rpc: { data, error: null } });
      assert.deepEqual(await completeWorkOrder(validCommand()), {
        ok: false,
        code: "UNEXPECTED_ERROR",
      });
    }
  });
});

// ── Side-effect boundary ─────────────────────────────────────────────────────

describe("side effects", () => {
  it("touches only the four permitted tables and the one RPC on the success path", async () => {
    scenario = okScenario({ staffRows: [], memberRows: [], ownerMatches: true });
    await completeWorkOrder(validCommand());
    assert.deepEqual([...new Set(log.tables)].sort(), [
      "dealer_members",
      "dealer_staff",
      "dealers",
      "work_orders",
    ]);
    assert.deepEqual(
      log.rpcCalls.map((c) => c.name),
      ["complete_work_order_v1"],
    );
  });

  it("never calls the RPC more than once, even for a replay outcome", async () => {
    scenario = okScenario({
      rpc: { data: [rpcRow({ outcome: "replayed", created: false, replayed: true })], error: null },
    });
    await completeWorkOrder(validCommand());
    assert.equal(log.rpcCalls.length, 1);
  });
});
