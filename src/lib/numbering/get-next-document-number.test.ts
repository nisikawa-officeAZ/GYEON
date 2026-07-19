// R56D — executable behaviour tests for the dealer-bound, fail-closed allocator.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/numbering/get-next-document-number.test.ts
//
// The module under test builds its own Supabase client via `createClient()`, which
// calls next/headers `cookies()` and throws outside a request context. Both of its
// dependencies are therefore replaced with `mock.module` BEFORE the module is
// imported. Nothing is stubbed inside production code: the seam is the module graph,
// not an injection parameter. (An exported injectable variant was rejected — in a
// "use server" file every export is a callable server action, so exporting one that
// accepts a Supabase client would be a real security regression.)
//
// `--experimental-test-module-mocks` is required on Node >= 22 and is NOT permitted
// in NODE_OPTIONS, so it must be passed on the command line.
//
// NO live Supabase client, NO database, NO network.

import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── Mock plumbing ───────────────────────────────────────────────────────────

type SeqRow = {
  prefix: string; padding: number; reset_policy: string;
  fiscal_year: number; current_number: number;
};

type Scenario = {
  dealer?:      { dealer_id: string; role: string } | null;
  configData?:  Partial<SeqRow> | null;
  configError?: unknown;
  configThrow?: boolean;
  rpcData?:     unknown;
  rpcError?:    unknown;
  rpcThrow?:    boolean;
  clientThrow?: boolean;
};

type Recorded = {
  eqCalls:      Array<[string, unknown]>;
  rpcCalls:     Array<[string, Record<string, unknown>]>;
  selectTables: string[];
  dealerLookups: number;
};

let scenario: Scenario = {};
let recorded: Recorded;

function resetRecording() {
  recorded = { eqCalls: [], rpcCalls: [], selectTables: [], dealerLookups: 0 };
}
resetRecording();

function fakeClient() {
  const builder = {
    select() { return builder; },
    eq(col: string, val: unknown) { recorded.eqCalls.push([col, val]); return builder; },
    async maybeSingle() {
      if (scenario.configThrow) throw new Error("config boom");
      return { data: scenario.configData ?? null, error: scenario.configError ?? null };
    },
  };
  return {
    from(table: string) { recorded.selectTables.push(table); return builder; },
    async rpc(name: string, args: Record<string, unknown>) {
      recorded.rpcCalls.push([name, args]);
      if (scenario.rpcThrow) throw new Error("rpc boom");
      return { data: scenario.rpcData ?? null, error: scenario.rpcError ?? null };
    },
  };
}

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => {
      if (scenario.clientThrow) throw new Error("client boom");
      return fakeClient();
    },
  },
});

mock.module("@/lib/auth/get-current-dealer", {
  namedExports: {
    getCurrentDealer: async () => {
      recorded.dealerLookups += 1;
      return scenario.dealer ?? null;
    },
  },
});

// Imported in a `before` hook rather than at top level: tsx compiles this file to
// CJS (the package is not type: module), where top-level await is unavailable. The
// mock.module registrations above already ran, so the graph is mocked on first import.
type NumberingModule = typeof import("./get-next-document-number");
let getNextDocumentNumberForDealer: NumberingModule["getNextDocumentNumberForDealer"];
let getNextDocumentNumber:          NumberingModule["getNextDocumentNumber"];

before(async () => {
  const m = await import("./get-next-document-number");
  getNextDocumentNumberForDealer = m.getNextDocumentNumberForDealer;
  getNextDocumentNumber          = m.getNextDocumentNumber;
});

const DEALER = "11111111-1111-4111-8111-111111111111";

function withScenario(s: Scenario) {
  scenario = s;
  resetRecording();
}

// A complete stored config, so a test that is not about defaults is explicit.
const STORED: SeqRow = {
  prefix: "EST", padding: 5, reset_policy: "never",
  fiscal_year: 0, current_number: 41,
};

// ─── 1-3. Tenant binding ─────────────────────────────────────────────────────

test("the exact dealerId is used in the config query", async () => {
  withScenario({ configData: STORED, rpcData: 7 });
  await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.deepEqual(recorded.selectTables, ["document_sequences"]);
  assert.deepEqual(recorded.eqCalls, [["dealer_id", DEALER], ["sequence_type", "estimate"]]);
});

test("the exact dealerId is sent as p_dealer_id", async () => {
  withScenario({ configData: STORED, rpcData: 7 });
  await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.equal(recorded.rpcCalls.length, 1);
  const [name, args] = recorded.rpcCalls[0];
  assert.equal(name, "get_next_document_number");
  assert.equal(args.p_dealer_id, DEALER);
  assert.equal(args.p_sequence_type, "estimate");
});

test("the safe function never resolves a dealer independently", async () => {
  withScenario({ dealer: { dealer_id: "OTHER-DEALER", role: "owner" }, configData: STORED, rpcData: 7 });
  await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.equal(recorded.dealerLookups, 0, "getCurrentDealer must never be called");
  assert.equal(recorded.rpcCalls[0][1].p_dealer_id, DEALER, "and never the other dealer");
});

// ─── 4. Legitimate missing row ───────────────────────────────────────────────

test("no sequence row: defaults are sent and the RPC's 1 is formatted", async () => {
  withScenario({ configData: null, rpcData: 1 });
  const out = await getNextDocumentNumberForDealer("estimate", DEALER);
  const args = recorded.rpcCalls[0][1];
  assert.equal(args.p_prefix, "EST");
  assert.equal(args.p_padding, 5);
  assert.equal(args.p_reset_policy, "never");
  assert.equal(args.p_fiscal_year, 0);
  assert.equal(out, "EST-00001");
});

// ─── 5-9. Fail-closed paths ──────────────────────────────────────────────────

test("config-query error returns null and never calls the RPC", async () => {
  withScenario({ configError: { message: "denied" }, rpcData: 7 });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
  assert.equal(recorded.rpcCalls.length, 0, "the RPC must not be reached");
});

test("config-query thrown exception returns null", async () => {
  withScenario({ configThrow: true, rpcData: 7 });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("RPC error returns null", async () => {
  withScenario({ configData: STORED, rpcError: { message: "FORBIDDEN" } });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
});

test("RPC thrown exception returns null", async () => {
  withScenario({ configData: STORED, rpcThrow: true });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
});

test("RPC null returns null", async () => {
  withScenario({ configData: STORED, rpcData: null });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
});

test("client construction failure returns null", async () => {
  withScenario({ clientThrow: true });
  assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
});

// ─── 10. Invalid RPC results ─────────────────────────────────────────────────

for (const [label, value] of [
  ["string",          "7"],
  ["NaN",             Number.NaN],
  ["Infinity",        Number.POSITIVE_INFINITY],
  ["-Infinity",       Number.NEGATIVE_INFINITY],
  ["fractional",      7.5],
  ["zero",            0],
  ["negative",        -7],
  ["unsafe integer",  Number.MAX_SAFE_INTEGER + 2],
  ["boolean",         true],
  ["object",          { next: 7 }],
] as Array<[string, unknown]>) {
  test(`invalid RPC result (${label}) returns null`, async () => {
    withScenario({ configData: STORED, rpcData: value });
    assert.equal(await getNextDocumentNumberForDealer("estimate", DEALER), null);
  });
}

// ─── 11. Only the RPC integer is formatted ───────────────────────────────────

test("only the RPC integer is formatted — current_number is never used", async () => {
  withScenario({ configData: STORED, rpcData: 7 });   // stored current_number = 41
  const out = await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.equal(out, "EST-00007");
  assert.match(out ?? "", /00007/);
  assert.equal(/00042/.test(out ?? ""), false, "must never format current_number + 1");
});

test("stored prefix/padding/policy are honoured, with the RPC integer", async () => {
  withScenario({
    configData: { prefix: "Q", padding: 3, reset_policy: "yearly", fiscal_year: 2026, current_number: 99 },
    rpcData: 12,
  });
  const out = await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.match(out ?? "", /^Q-\d{4}-012$/);
  assert.equal(/100/.test((out ?? "").split("-").pop() ?? ""), false, "not current_number + 1");
});

// ─── 12. Blank dealer id ─────────────────────────────────────────────────────

for (const [label, value] of [["empty", ""], ["whitespace", "   "]] as Array<[string, string]>) {
  test(`blank dealerId (${label}) returns null with no query and no RPC`, async () => {
    withScenario({ configData: STORED, rpcData: 7 });
    assert.equal(await getNextDocumentNumberForDealer("estimate", value), null);
    assert.equal(recorded.selectTables.length, 0, "no config query");
    assert.equal(recorded.rpcCalls.length, 0, "no RPC");
  });
}

// ─── 13-14. Legacy wrapper ───────────────────────────────────────────────────

test("legacy wrapper: null dealer returns null", async () => {
  withScenario({ dealer: null, configData: STORED, rpcData: 7 });
  assert.equal(await getNextDocumentNumber("estimate"), null);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("legacy wrapper: resolves its own dealer and delegates to the shared implementation", async () => {
  withScenario({ dealer: { dealer_id: DEALER, role: "owner" }, configData: STORED, rpcData: 7 });
  const out = await getNextDocumentNumber("estimate");
  assert.equal(recorded.dealerLookups, 1);
  assert.equal(recorded.rpcCalls[0][1].p_dealer_id, DEALER);
  assert.equal(out, "EST-00007");
});

test("the legacy fallback is reachable ONLY through the wrapper", async () => {
  // Identical failing scenario through both entry points.
  const failing: Scenario = {
    dealer: { dealer_id: DEALER, role: "owner" },
    configData: STORED,            // current_number = 41
    rpcError: { message: "rpc down" },
  };

  withScenario(failing);
  const viaWrapper = await getNextDocumentNumber("estimate");
  assert.equal(viaWrapper, "EST-00042", "the legacy wrapper still returns the unpersisted +1");

  withScenario(failing);
  const viaSafe = await getNextDocumentNumberForDealer("estimate", DEALER);
  assert.equal(viaSafe, null, "the dealer-bound function fails closed on the SAME failure");
});

test("the dealer-bound function never returns a fallback on any failure mode", async () => {
  const failures: Scenario[] = [
    { configData: STORED, rpcError: { message: "x" } },
    { configData: STORED, rpcThrow: true },
    { configData: STORED, rpcData: null },
    { configData: STORED, rpcData: 0 },
    { configData: STORED, rpcData: "41" },
    { configError: { message: "x" } },
    { configThrow: true },
    { clientThrow: true },
  ];
  for (const f of failures) {
    withScenario(f);
    const out = await getNextDocumentNumberForDealer("estimate", DEALER);
    assert.equal(out, null, `expected null for ${JSON.stringify(f)}`);
  }
});
