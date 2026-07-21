// B7-3 — pure entity-reference core matrix + server-wrapper source guards.
//
// Run: node --import tsx --test src/lib/estimates/dealer-wizard-entity-references.test.ts
//
// The core is exercised at runtime with injected reader spies; the SERVER wrapper
// (which imports `server-only` + `createClient`) is proved by reading its SOURCE,
// because importing it would load server-only modules. Contexts are genuine
// branded values produced by the real pure actor-context resolver — never forged
// with a cast.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveDealerWizardEntityReferences,
  type EntityReadResult,
  type DealerEntityReaders,
} from "./dealer-wizard-entity-references";
import { resolveEstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";
import type { EstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";

const WRAPPER_SRC = "src/lib/estimates/get-dealer-wizard-entity-references.ts";
const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// ── Genuine branded context (no cast, no `any`, no public brand constructor) ──

async function makeContext(dealerId: string): Promise<EstimateSaveActorContext> {
  const res = await resolveEstimateSaveActorContext({
    getUserId: async () => "user-1",
    getActiveMemberships: async () => ({ ok: true, rows: [{ dealer_id: dealerId, role: "owner" }] }),
    getActiveStaffRole: async () => ({ ok: true, role: "owner" }),
  });
  if (!res.ok) throw new Error(`fixture: context must resolve (got ${res.reason})`);
  return res.context;
}

const DEALER = "dealer-aaaa";

const customerRow = (over: Record<string, unknown> = {}) => ({
  id: "c-1", dealer_id: DEALER, last_name: "山田", first_name: "太郎", phone: "090-0000-0000", ...over,
});
const vehicleRow = (over: Record<string, unknown> = {}) => ({
  id: "v-1", dealer_id: DEALER, customer_id: "c-1", maker: "Toyota", model: "Aqua",
  plate_number: "品川 300 あ 12-34", body_size: "M", ...over,
});

/** A reader spy: records the dealerId it received and how many times it ran. */
function spy(result: EntityReadResult | (() => never)) {
  const calls: string[] = [];
  const read = async (dealerId: string): Promise<EntityReadResult> => {
    calls.push(dealerId);
    if (typeof result === "function") return result();  // throw path
    return result;
  };
  return { read, calls };
}

/** A reader spy whose promise REJECTS (network-style) rather than throwing synchronously. */
function spyReject() {
  const calls: string[] = [];
  const read = (dealerId: string): Promise<EntityReadResult> => {
    calls.push(dealerId);
    return Promise.reject(new Error("net"));
  };
  return { read, calls };
}

function readers(
  customers: { read: DealerEntityReaders["readCustomers"] },
  vehicles: { read: DealerEntityReaders["readVehicles"] },
): DealerEntityReaders {
  return { readCustomers: customers.read, readVehicles: vehicles.read };
}

const okRows = (rows: readonly unknown[]): EntityReadResult => ({ ok: true, rows });
const readFail: EntityReadResult = { ok: false };
const throwing = (): never => { throw new Error("boom"); };

// ── Tenant binding ──────────────────────────────────────────────────────────

test("the captured dealerId is passed exactly once to each reader", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(okRows([customerRow()]));
  const v = spy(okRows([vehicleRow()]));
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));

  assert.equal(r.ok, true);
  assert.deepEqual(c.calls, [DEALER], "customer reader: exactly one call, bound tenant");
  assert.deepEqual(v.calls, [DEALER], "vehicle reader: exactly one call, bound tenant");
});

// ── Success shapes ──────────────────────────────────────────────────────────

test("successful EMPTY reads yield empty arrays (never a failure)", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(spy(okRows([])), spy(okRows([]))));
  assert.deepEqual(r, { ok: true, customers: [], vehicles: [] });
});

test("populated reads produce EXACTLY the minimal reference keys", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(okRows([customerRow()]));
  const v = spy(okRows([vehicleRow()]));
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.customers[0]).sort(), ["displayName", "id", "phone"]);
  assert.deepEqual(Object.keys(r.vehicles[0]).sort(),
    ["bodySize", "customerId", "displayName", "id", "plateNumber"]);
  assert.equal(r.customers[0].displayName, "山田 太郎");
  assert.equal(r.vehicles[0].customerId, "c-1");
});

// ── Concurrency + settled-outcome precedence ────────────────────────────────

test("BARRIER: the second reader runs BEFORE the first settles (fails if sequential)", async () => {
  const ctx = await makeContext(DEALER);
  // The customer reader returns a manually-controlled pending promise. If the core
  // were sequential (await customers, THEN start vehicles), the vehicle reader
  // would not run until the gate is released — so a non-zero vehicle call count
  // while the gate is still closed is proof the reads started concurrently.
  let releaseCustomer!: (r: EntityReadResult) => void;
  const customerGate = new Promise<EntityReadResult>((res) => { releaseCustomer = res; });
  const customerCalls: string[] = [];
  const vehicleCalls: string[] = [];
  const barrierReaders: DealerEntityReaders = {
    readCustomers: (d) => { customerCalls.push(d); return customerGate; },
    readVehicles: async (d) => { vehicleCalls.push(d); return okRows([vehicleRow()]); },
  };

  const pending = resolveDealerWizardEntityReferences(ctx, barrierReaders);
  // Let queued microtasks drain WITHOUT releasing the gate. No timers/sleeps.
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

  assert.equal(vehicleCalls.length, 1, "vehicle reader ran before the customer gate opened — concurrent");
  assert.equal(customerCalls.length, 1, "customer reader was invoked exactly once");

  releaseCustomer(okRows([customerRow()]));
  const r = await pending;
  assert.equal(r.ok, true, "resolves successfully once the gate is released");
});

// Every mandated precedence combination uses NAMED spies and asserts BOTH readers
// were invoked exactly once — a regression to sequential/short-circuit invocation
// would drop one count to zero.

test("both ok:false → customer-read-failed; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(readFail); const v = spy(readFail);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "customer-read-failed" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("customer ok:false + vehicle throw → customer-read-failed; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(readFail); const v = spy(throwing);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "customer-read-failed" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("customer throw + vehicle ok:false → dependency-threw; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(throwing); const v = spy(readFail);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "dependency-threw" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("customer success + vehicle throw → dependency-threw; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(okRows([customerRow()])); const v = spy(throwing);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "dependency-threw" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("both throw → dependency-threw; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(throwing); const v = spy(throwing);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "dependency-threw" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("customer-only failure → customer-read-failed; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(readFail); const v = spy(okRows([]));
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "customer-read-failed" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("vehicle-only failure → vehicle-read-failed; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spy(okRows([])); const v = spy(readFail);
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "vehicle-read-failed" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

test("a REJECTED promise (not a sync throw) → dependency-threw; both invoked once", async () => {
  const ctx = await makeContext(DEALER);
  const c = spyReject(); const v = spy(okRows([]));
  const r = await resolveDealerWizardEntityReferences(ctx, readers(c, v));
  assert.deepEqual(r, { ok: false, reason: "dependency-threw" });
  assert.equal(c.calls.length, 1); assert.equal(v.calls.length, 1);
});

// ── Row validation → malformed-row (whole operation fails, no partial array) ──

test("malformed customer row fails the whole operation", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow(), { id: "c-2" /* missing fields */ }])), spy(okRows([vehicleRow()]))));
  assert.deepEqual(r, { ok: false, reason: "malformed-row" });
});

test("malformed vehicle row fails the whole operation", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow()])), spy(okRows([{ id: "v-2", dealer_id: DEALER /* no customer_id */ }]))));
  assert.deepEqual(r, { ok: false, reason: "malformed-row" });
});

test("CROSS-DEALER customer row → malformed-row", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow({ dealer_id: "dealer-bbbb" })])), spy(okRows([]))));
  assert.deepEqual(r, { ok: false, reason: "malformed-row" });
});

test("CROSS-DEALER vehicle row → malformed-row", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([])), spy(okRows([vehicleRow({ dealer_id: "dealer-bbbb" })]))));
  assert.deepEqual(r, { ok: false, reason: "malformed-row" });
});

test("NULL dealer_id → malformed-row (never treated as the bound tenant)", async () => {
  const ctx = await makeContext(DEALER);
  const r = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow({ dealer_id: null })])), spy(okRows([]))));
  assert.deepEqual(r, { ok: false, reason: "malformed-row" });
});

test("malformed nullable display fields → malformed-row", async () => {
  const ctx = await makeContext(DEALER);
  // phone as a number is not string|null.
  const a = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow({ phone: 123 })])), spy(okRows([]))));
  assert.deepEqual(a, { ok: false, reason: "malformed-row" });
  // last_name as null violates the non-null string requirement.
  const b = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([customerRow({ last_name: null })])), spy(okRows([]))));
  assert.deepEqual(b, { ok: false, reason: "malformed-row" });
  // body_size as an object is not string|null.
  const c = await resolveDealerWizardEntityReferences(ctx,
    readers(spy(okRows([])), spy(okRows([vehicleRow({ body_size: {} })]))));
  assert.deepEqual(c, { ok: false, reason: "malformed-row" });
});

// ── Empty / whitespace-only identifiers are all malformed-row ───────────────
// The identifier is validated, never trimmed into acceptance: a blank or
// whitespace-only id/customer_id/dealer_id fails the whole operation.

const BLANKS = ["", " ", "\t", "\n"] as const;

for (const blank of BLANKS) {
  const label = JSON.stringify(blank);

  test(`customer id ${label} → malformed-row`, async () => {
    const ctx = await makeContext(DEALER);
    const r = await resolveDealerWizardEntityReferences(ctx,
      readers(spy(okRows([customerRow({ id: blank })])), spy(okRows([]))));
    assert.deepEqual(r, { ok: false, reason: "malformed-row" });
  });

  test(`customer dealer_id ${label} → malformed-row`, async () => {
    const ctx = await makeContext(DEALER);
    const r = await resolveDealerWizardEntityReferences(ctx,
      readers(spy(okRows([customerRow({ dealer_id: blank })])), spy(okRows([]))));
    assert.deepEqual(r, { ok: false, reason: "malformed-row" });
  });

  test(`vehicle id ${label} → malformed-row`, async () => {
    const ctx = await makeContext(DEALER);
    const r = await resolveDealerWizardEntityReferences(ctx,
      readers(spy(okRows([])), spy(okRows([vehicleRow({ id: blank })]))));
    assert.deepEqual(r, { ok: false, reason: "malformed-row" });
  });

  test(`vehicle customer_id ${label} → malformed-row`, async () => {
    const ctx = await makeContext(DEALER);
    const r = await resolveDealerWizardEntityReferences(ctx,
      readers(spy(okRows([])), spy(okRows([vehicleRow({ customer_id: blank })]))));
    assert.deepEqual(r, { ok: false, reason: "malformed-row" });
  });

  test(`vehicle dealer_id ${label} → malformed-row`, async () => {
    const ctx = await makeContext(DEALER);
    const r = await resolveDealerWizardEntityReferences(ctx,
      readers(spy(okRows([])), spy(okRows([vehicleRow({ dealer_id: blank })]))));
    assert.deepEqual(r, { ok: false, reason: "malformed-row" });
  });
}

// ── Order + duplicate preservation ──────────────────────────────────────────

test("row ORDER is preserved for both lists", async () => {
  const ctx = await makeContext(DEALER);
  const cs = [customerRow({ id: "c-1" }), customerRow({ id: "c-2" }), customerRow({ id: "c-3" })];
  const vs = [vehicleRow({ id: "v-3" }), vehicleRow({ id: "v-1" }), vehicleRow({ id: "v-2" })];
  const r = await resolveDealerWizardEntityReferences(ctx, readers(spy(okRows(cs)), spy(okRows(vs))));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.customers.map((x) => x.id), ["c-1", "c-2", "c-3"]);
  assert.deepEqual(r.vehicles.map((x) => x.id), ["v-3", "v-1", "v-2"]);
});

test("DUPLICATE customer and vehicle IDs remain present (not de-duplicated)", async () => {
  const ctx = await makeContext(DEALER);
  const cs = [customerRow({ id: "dup" }), customerRow({ id: "dup" })];
  const vs = [vehicleRow({ id: "dupv" }), vehicleRow({ id: "dupv" })];
  const r = await resolveDealerWizardEntityReferences(ctx, readers(spy(okRows(cs)), spy(okRows(vs))));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.customers.map((x) => x.id), ["dup", "dup"]);
  assert.deepEqual(r.vehicles.map((x) => x.id), ["dupv", "dupv"]);
});

test("no failure ever returns a partial array", async () => {
  const ctx = await makeContext(DEALER);
  // customers valid+populated, vehicles fail → result carries NO customers array.
  const r = await resolveDealerWizardEntityReferences(ctx, readers(spy(okRows([customerRow()])), spy(readFail)));
  assert.equal(r.ok, false);
  assert.equal("customers" in r, false);
  assert.equal("vehicles" in r, false);
});

// ── Server-wrapper source guards (comment-stripped executable code) ──────────

test("wrapper: first executable import is server-only, and it delegates to the pure core", () => {
  const raw = readFileSync(WRAPPER_SRC, "utf8");
  assert.match(raw, /^import "server-only";/, "server-only must be the first executable import");
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /resolveDealerWizardEntityReferences\(/, "delegates decisions to the pure core");
});

test("wrapper: exactly one createClient call, explicitly typed and shared", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.equal((code.match(/createClient\(/g) ?? []).length, 1, "exactly one createClient() call");
  assert.match(code, /let supabase: Awaited<ReturnType<typeof createClient>>;/, "explicit typed binding");
  // Both reader closures use the same `supabase` binding.
  assert.equal((code.match(/supabase\s*\n?\s*\.from\(/g) ?? code.match(/supabase\.from\(/g) ?? []).length, 2,
    "both reads go through the one shared client");
});

test("wrapper: createClient failure maps to dependency-threw", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /catch\s*\{[\s\S]*?return \{ ok: false, reason: "dependency-threw" \};[\s\S]*?\}/,
    "a client-construction failure returns the typed dependency-threw");
});

test("wrapper: no admin/service-role client, no legacy loaders", () => {
  const code = codeOf(WRAPPER_SRC);
  for (const forbidden of ["createAdminClient", "service_role", "SERVICE_ROLE",
                           "getCurrentDealer", "getCustomers", "getVehicles"]) {
    assert.equal(code.includes(forbidden), false, `wrapper references ${forbidden}`);
  }
});

test("wrapper: exact minimal projections, dealer/deleted/order wiring, Array.isArray required", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /\.select\("id, dealer_id, last_name, first_name, phone"\)/, "customer projection");
  assert.match(code,
    /\.select\("id, dealer_id, customer_id, maker, model, plate_number, body_size"\)/, "vehicle projection");
  assert.equal((code.match(/\.eq\("dealer_id", dealerId\)/g) ?? []).length, 2, "dealer predicate on both");
  assert.equal((code.match(/\.is\("deleted_at", null\)/g) ?? []).length, 2, "deleted_at null on both");
  assert.equal((code.match(/\.order\("created_at", \{ ascending: false \}\)/g) ?? []).length, 2, "order on both");
  assert.equal((code.match(/Array\.isArray\(data\)/g) ?? []).length, 2, "Array.isArray(data) on both reads");
  assert.equal(code.includes("data ?? []"), false, "the data ?? [] shortcut is forbidden");
  assert.equal(/\.select\("\*"\)/.test(code), false, "no full-row projection");
  assert.equal((code.match(/\.select\(/g) ?? []).length, 2, "exactly two selects, both minimal");
});
