import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
  type InventoryRuntimeSnapshot,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";
import { createInventoryInMemoryStore } from "../../../../node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryInMemoryStore.js";
import {
  FOUNDATION_PERSISTENCE_CONTRACT,
  executeWithFoundationPersistence,
  initializeFoundationPersistence,
  type FoundationPersistenceDriver,
  type FoundationPersistenceFinalizeInput,
  type FoundationPersistenceIdentity,
  type FoundationPersistenceInitializeInput,
} from "./foundation-persistence-adaptor.js";

const MIGRATION =
  "supabase/migrations/20260915111456_foundation_inventory_runtime.sql";
const migration = readFileSync(MIGRATION, "utf8");

const identity: FoundationPersistenceIdentity = Object.freeze({
  owner: "OFFICE_AZ",
  locationId: "GYEON_WAREHOUSE",
  productId: "foundation-product-1",
});

const request = Object.freeze({
  requestId: "request-1",
  idempotencyKey: "idempotency-1",
  requestFingerprint: "a".repeat(64),
  actor: "actor-1",
  operator: "operator-1",
});

function snapshot(): InventoryRuntimeSnapshot {
  return createInventoryInMemoryStore().snapshot();
}

function withoutRevision(value: InventoryRuntimeSnapshot) {
  const { revision: _revision, ...next } = value;
  return next;
}

function driver(overrides: Partial<FoundationPersistenceDriver> = {}): {
  readonly value: FoundationPersistenceDriver;
  readonly loads: FoundationPersistenceIdentity[];
  readonly initializes: FoundationPersistenceInitializeInput[];
  readonly finalizes: FoundationPersistenceFinalizeInput[];
} {
  const loads: FoundationPersistenceIdentity[] = [];
  const initializes: FoundationPersistenceInitializeInput[] = [];
  const finalizes: FoundationPersistenceFinalizeInput[] = [];
  const initial = snapshot();
  const value: FoundationPersistenceDriver = {
    async load(input) {
      loads.push(input);
      return {
        tag: "found",
        snapshotContract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
        snapshot: initial,
        revision: 0,
      };
    },
    async initialize(input) {
      initializes.push(input);
      return { tag: "initialized", revision: 0 };
    },
    async finalize(input) {
      finalizes.push(input);
      return {
        tag: input.nextSnapshot === null ? "recorded" : "committed",
        revision: input.nextSnapshot === null ? 0 : 1,
        outcome: input.outcome,
      };
    },
    ...overrides,
  };
  return { value, loads, initializes, finalizes };
}

test("initialization accepts only a caller-supplied validated V3 revision-zero snapshot", async () => {
  const fake = driver();
  const result = await initializeFoundationPersistence({
    driver: fake.value,
    identity,
    requestId: "bootstrap-1",
    actor: "actor-1",
    operator: "operator-1",
    snapshot: snapshot(),
    auditEvidence: { code: "BOOTSTRAP" },
  });

  assert.deepEqual(result, {
    ok: true,
    replay: false,
    revision: 0,
    outcome: null,
  });
  assert.equal(fake.initializes.length, 1);
  assert.equal(fake.initializes[0]!.contract, FOUNDATION_PERSISTENCE_CONTRACT);
  assert.equal(
    fake.initializes[0]!.snapshotContract,
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
  );
});

test("initialization rejects malformed or non-zero snapshots without calling the driver", async () => {
  const fake = driver();
  for (const invalid of [{ revision: 0 }, { ...snapshot(), revision: 2 }]) {
    const result = await initializeFoundationPersistence({
      driver: fake.value,
      identity,
      requestId: "bootstrap-1",
      actor: "actor-1",
      operator: "operator-1",
      snapshot: invalid,
      auditEvidence: { code: "BOOTSTRAP" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_persisted_snapshot");
  }
  assert.equal(fake.initializes.length, 0);
});

test("ATTRACTION remains representable but disabled without invoking persistence", async () => {
  const fake = driver();
  const result = await executeWithFoundationPersistence({
    driver: fake.value,
    identity: { ...identity, owner: "ATTRACTION" },
    request,
    execute: () => ({ outcome: { ok: true }, auditEvidence: { code: "X" } }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "owner_not_enabled");
  assert.equal(fake.loads.length, 0);
  assert.equal(fake.finalizes.length, 0);
});

test("a valid runtime commit is buffered then sent once with exact CAS identity", async () => {
  const fake = driver();
  const result = await executeWithFoundationPersistence({
    driver: fake.value,
    identity,
    request,
    execute(store) {
      const current = store.snapshot();
      assert.equal(current.revision, 0);
      assert.equal(store.commit(0, withoutRevision(current)), true);
      assert.equal(store.commit(1, withoutRevision(store.snapshot())), false);
      return {
        outcome: { ok: true, command: "reserve" },
        auditEvidence: { code: "ACCEPTED", replay: false },
      };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    replay: false,
    revision: 1,
    outcome: { ok: true, command: "reserve" },
  });
  assert.equal(fake.loads.length, 1);
  assert.equal(fake.finalizes.length, 1);
  const finalized = fake.finalizes[0]!;
  assert.equal(finalized.expectedRevision, 0);
  const nextSnapshot = finalized.nextSnapshot;
  assert.ok(
    nextSnapshot !== null &&
      typeof nextSnapshot === "object" &&
      !Array.isArray(nextSnapshot),
  );
  assert.equal(
    (nextSnapshot as { readonly revision?: unknown }).revision,
    1,
  );
  assert.equal(finalized.snapshotContract, INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3);
  assert.deepEqual(finalized.identity, identity);
  assert.deepEqual(finalized.request, request);
});

test("a denied/non-mutating runtime result records evidence without a snapshot write", async () => {
  const fake = driver();
  const result = await executeWithFoundationPersistence({
    driver: fake.value,
    identity,
    request,
    execute: () => ({
      outcome: { ok: false, code: "authorization_denied" },
      auditEvidence: { code: "DENIED" },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(fake.finalizes.length, 1);
  assert.equal(fake.finalizes[0]!.nextSnapshot, null);
  assert.equal(fake.finalizes[0]!.snapshotContract, null);
});

test("identical replay returns the driver-stored deterministic outcome", async () => {
  const fake = driver({
    async finalize(input) {
      return {
        tag: "replayed",
        revision: 0,
        outcome: { ok: true, original: input.request.idempotencyKey },
      };
    },
  });
  const result = await executeWithFoundationPersistence({
    driver: fake.value,
    identity,
    request,
    execute: () => ({
      outcome: { ok: true, ignoredCandidate: true },
      auditEvidence: { code: "REPLAY" },
    }),
  });
  assert.deepEqual(result, {
    ok: true,
    replay: true,
    revision: 0,
    outcome: { ok: true, original: "idempotency-1" },
  });
});

test("impossible successful driver revisions fail closed", async () => {
  for (const [tag, revision] of [
    ["committed", 2],
    ["recorded", 1],
    ["replayed", 1],
  ] as const) {
    const fake = driver({
      async finalize(input) {
        return { tag, revision, outcome: input.outcome };
      },
    });
    const result = await executeWithFoundationPersistence({
      driver: fake.value,
      identity,
      request,
      execute(store) {
        if (tag === "committed") {
          const current = store.snapshot();
          assert.equal(store.commit(0, withoutRevision(current)), true);
        }
        return { outcome: { ok: true }, auditEvidence: { code: "HOSTILE_DRIVER" } };
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "malformed_driver_result");
  }
});

test("stale CAS and material replay conflict fail closed", async () => {
  for (const [tag, code] of [
    ["stale", "stale_revision"],
    ["replay_conflict", "replay_conflict"],
  ] as const) {
    const fake = driver({
      async finalize() {
        return { tag, revision: 4 };
      },
    });
    const result = await executeWithFoundationPersistence({
      driver: fake.value,
      identity,
      request,
      execute: () => ({ outcome: { ok: true }, auditEvidence: { code: "X" } }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
});

test("not-configured, malformed snapshots, thrown drivers and malformed replies are sanitized", async () => {
  const getterReply = Object.defineProperty({}, "tag", {
    enumerable: true,
    get() {
      throw new Error("secret getter detail");
    },
  });
  const cases: Array<{
    readonly load: FoundationPersistenceDriver["load"];
    readonly code: string;
  }> = [
    { load: async () => ({ tag: "not_found" }), code: "not_configured" },
    {
      load: async () => ({
        tag: "found",
        snapshotContract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
        snapshot: { revision: 0 },
        revision: 0,
      }),
      code: "invalid_persisted_snapshot",
    },
    { load: async () => ({ tag: "invented" }), code: "malformed_driver_result" },
    { load: async () => getterReply, code: "malformed_driver_result" },
    {
      load: async () => {
        throw new Error("secret connection detail");
      },
      code: "driver_failure",
    },
  ];
  for (const item of cases) {
    const fake = driver({ load: item.load });
    const result = await executeWithFoundationPersistence({
      driver: fake.value,
      identity,
      request,
      execute: () => ({ outcome: { ok: true }, auditEvidence: { code: "X" } }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, item.code);
      assert.equal(result.message.includes("secret"), false);
    }
  }
});

test("hostile, cyclic, non-finite and secret-bearing evidence never reaches the driver", async () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const prototypeKey = JSON.parse('{"__proto__":{"polluted":true}}');
  for (const evidence of [
    cyclic,
    prototypeKey,
    { value: Number.NaN },
    { accessToken: "must-not-persist" },
    { nested: { cookie: "must-not-persist" } },
  ]) {
    const fake = driver();
    const result = await executeWithFoundationPersistence({
      driver: fake.value,
      identity,
      request,
      execute: () => ({ outcome: { ok: true }, auditEvidence: evidence }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_operation_result");
    assert.equal(fake.finalizes.length, 0);
  }
});

test("migration creates only private Foundation-specific state, idempotency and audit objects", () => {
  assert.match(migration, /create schema if not exists foundation_inventory_private/);
  for (const table of ["runtime_aggregates", "runtime_idempotency", "runtime_audit"]) {
    assert.match(migration, new RegExp(`create table foundation_inventory_private\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table foundation_inventory_private\\.${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(`alter table foundation_inventory_private\\.${table} force row level security`),
    );
  }
  assert.doesNotMatch(
    migration,
    /\b(?:gyeon_products|product_orders|dealer_stock_levels|inventory_movements|audit_logs)\b/i,
  );
});

test("migration provides atomic CAS, deterministic replay and conflict evidence", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revision = p_expected_revision/);
  assert.match(migration, /p_expected_revision \+ 1/);
  assert.match(migration, /v_idempotency\.request_fingerprint = p_request_fingerprint/);
  assert.match(migration, /v_idempotency\.result_tag = 'stale'/);
  assert.match(migration, /v_current_revision, 'stale', p_outcome/);
  assert.match(migration, /authorization\|cookie\|password\|secret\|session\|token/);
  assert.match(migration, /'tag', 'replayed'/);
  assert.match(migration, /'tag', 'replay_conflict'/);
  assert.match(migration, /'tag', 'stale'/);
  assert.match(migration, /insert into foundation_inventory_private\.runtime_audit/);
  assert.match(migration, /insert into foundation_inventory_private\.runtime_idempotency/);
});

test("migration is deny-by-default and exposes only fixed-search-path service functions", () => {
  assert.match(
    migration,
    /revoke all on all tables in schema foundation_inventory_private[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on all sequences in schema foundation_inventory_private[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.equal((migration.match(/security definer/g) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 3);
  assert.equal((migration.match(/to service_role;/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|execute)[\s\S]*to (?:anon|authenticated)/i);
  assert.match(migration, /p_owner is distinct from 'OFFICE_AZ'/);
});

test("the adaptor is server-only, injected, and contains no credential, retry, logging or legacy fallback", () => {
  const source = readFileSync(
    "src/lib/inventory/foundation/foundation-persistence-adaptor.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /interface FoundationPersistenceDriver/);
  assert.doesNotMatch(source, /createClient|createAdminClient|SUPABASE_|service_role/i);
  assert.doesNotMatch(source, /console\.|setTimeout|retry|gyeon_products|product_orders|dealer_stock_levels/i);
});

test("disposable harness binds reviewed bytes, sanitizes libpq routing, and owns cleanup", () => {
  const harness = readFileSync(
    "scripts/e2e/inv001-foundation-persistence-disposable.mjs",
    "utf8",
  );
  assert.match(
    harness,
    /EXPECTED_MIGRATION_SHA256\s*=\s*\n\s*"524c988fcc3cab26708f6a318bbe15c7e2007745445906de34f67d1b5f987ee2"/,
  );
  assert.match(harness, /migrationSha256 !== EXPECTED_MIGRATION_SHA256/);
  assert.match(harness, /MIGRATION_HASH_MISMATCH/);
  assert.match(harness, /fileURLToPath\(import\.meta\.url\)/);
  assert.match(harness, /!key\.startsWith\("PG"\)/);
  assert.match(harness, /PREEXISTING_FOUNDATION_SCHEMA_FORBIDDEN/);
  assert.match(harness, /foundationSchemaCreatedByThisRun/);
  assert.doesNotMatch(harness, /const pgEnvironment = \{\s*\.\.\.process\.env/);
});
