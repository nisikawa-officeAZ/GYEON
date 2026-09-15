#!/usr/bin/env node

/**
 * INV001-P24 D3A disposable verification harness.
 *
 * This file is authored but MUST NOT be executed before the separate Gate C.
 * It accepts only an explicitly acknowledged loopback PostgreSQL database,
 * applies the one D3A migration, runs persistence/RLS/CAS/replay/concurrency
 * checks, and drops the private schema in a final cleanup. It never prints the
 * connection string or password.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HARNESS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(
  HARNESS_DIRECTORY,
  "../..",
  "supabase/migrations/20260915111456_foundation_inventory_runtime.sql",
);
const EXPECTED_MIGRATION_SHA256 =
  "524c988fcc3cab26708f6a318bbe15c7e2007745445906de34f67d1b5f987ee2";
const REQUIRED_ACK = "I_ACKNOWLEDGE_FRESH_DISPOSABLE_LOCAL_DATABASE_ONLY";
const databaseUrl = process.env.INV001_FOUNDATION_DISPOSABLE_DATABASE_URL;
const applyAck = process.env.INV001_FOUNDATION_DISPOSABLE_APPLY_ACK;

function stop(message) {
  process.stderr.write(`BLOCKED=${message}\n`);
  process.exit(1);
}

if (applyAck !== REQUIRED_ACK) stop("MISSING_EXACT_DISPOSABLE_APPLY_ACK");
if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
  stop("MISSING_DISPOSABLE_DATABASE_URL");
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  stop("INVALID_DISPOSABLE_DATABASE_URL");
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  stop("NON_POSTGRES_DATABASE_URL");
}
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  stop("NON_LOOPBACK_DATABASE_FORBIDDEN");
}
if (!/inv001|disposable/i.test(parsed.pathname)) {
  stop("DATABASE_NAME_MUST_IDENTIFY_INV001_DISPOSABLE_RUNTIME");
}

const migrationBytes = readFileSync(MIGRATION);
const migrationSha256 = createHash("sha256").update(migrationBytes).digest("hex");
if (migrationSha256 !== EXPECTED_MIGRATION_SHA256) {
  stop("MIGRATION_HASH_MISMATCH");
}

const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const databaseUser = decodeURIComponent(parsed.username);
const databasePort = parsed.port || "5432";
const connectionArgs = Object.freeze([
  "--host", parsed.hostname,
  "--port", databasePort,
  "--username", databaseUser,
  "--dbname", databaseName,
]);
const pgEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !key.startsWith("PG") &&
      key !== "INV001_FOUNDATION_DISPOSABLE_DATABASE_URL",
  ),
);
Object.assign(pgEnvironment, {
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGSSLMODE: "disable",
  PGCONNECT_TIMEOUT: "10",
});

function psql(args, { expectFailure = false } = {}) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", ...connectionArgs, ...args], {
    env: pgEnvironment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (expectFailure) {
    if (result.status === 0) throw new Error("EXPECTED_DATABASE_DENIAL_DID_NOT_OCCUR");
    return "DENIED";
  }
  if (result.status !== 0) throw new Error("DATABASE_ASSERTION_FAILED");
  return result.stdout.trim();
}

function query(statement) {
  return psql(["-A", "-t", "-q", "-c", statement]);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function asyncQuery(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-v", "ON_ERROR_STOP=1", ...connectionArgs, "-A", "-t", "-q", "-c", statement], {
      env: pgEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.resume();
    child.on("error", () => reject(new Error("DATABASE_CONCURRENCY_PROCESS_FAILED")));
    child.on("close", (code) => {
      if (code !== 0) reject(new Error("DATABASE_CONCURRENCY_QUERY_FAILED"));
      else resolve(stdout.trim());
    });
  });
}

const emptyStoreModule = await import(
  pathToFileURL(
    path.resolve(
      "node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryInMemoryStore.js",
    ),
  ).href
);
const snapshotModule = await import(
  pathToFileURL(
    path.resolve(
      "node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryRuntimeSnapshot.js",
    ),
  ).href
);
const initialSnapshot = emptyStoreModule.createInventoryInMemoryStore().snapshot();
assert(initialSnapshot.revision === 0, "PACKAGE_EMPTY_SNAPSHOT_REVISION_MISMATCH");

let passed = 0;

function omitSnapshotFields(snapshot, omittedFields) {
  return Object.fromEntries(
    Object.entries(snapshot).filter(([field]) => !omittedFields.includes(field)),
  );
}

const snapshotCompatibilityFixtures = [
  {
    contract: snapshotModule.INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
    snapshot: omitSnapshotFields(initialSnapshot, [
      "fulfillments",
      "productCatalog",
      "csvPreviews",
    ]),
  },
  {
    contract: snapshotModule.INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
    snapshot: omitSnapshotFields(initialSnapshot, [
      "productCatalog",
      "csvPreviews",
    ]),
  },
  {
    contract: snapshotModule.INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
    snapshot: structuredClone(initialSnapshot),
  },
];

for (const { contract, snapshot } of snapshotCompatibilityFixtures) {
  const imported = snapshotModule.importInventoryRuntimeSnapshot({ contract, snapshot });
  assert(imported.ok === true, `PACKAGE_SNAPSHOT_IMPORT_FAILED_${contract}`);
  assert(
    imported.snapshot.revision === snapshot.revision,
    `PACKAGE_SNAPSHOT_REVISION_MISMATCH_${contract}`,
  );
  passed += 1;
}
assert(
  snapshotModule.importInventoryRuntimeSnapshot({
    contract: "UNKNOWN",
    snapshot: initialSnapshot,
  }).ok === false,
  "UNKNOWN_SNAPSHOT_CONTRACT_ACCEPTED",
);
passed += 1;

let foundationSchemaCreatedByThisRun = false;
const owner = "OFFICE_AZ";
const location = "GYEON_WAREHOUSE";
const product = "foundation-disposable-product";

function applySql({
  requestId,
  idempotencyKey,
  fingerprint,
  expectedRevision,
  nextSnapshot,
  outcome,
  evidence,
}) {
  return `select foundation_inventory_private.finalize_runtime_transition(
    ${sqlString(owner)}, ${sqlString(location)}, ${sqlString(product)},
    ${sqlString(requestId)}, ${sqlString(idempotencyKey)}, ${sqlString(fingerprint)},
    'actor-disposable', 'operator-disposable', ${expectedRevision},
    ${nextSnapshot === null ? "null" : sqlString("INV001-P18_RUNTIME_SNAPSHOT_V3")},
    ${nextSnapshot === null ? "null" : jsonSql(nextSnapshot)},
    ${jsonSql(outcome)}, ${jsonSql(evidence)}
  )::text;`;
}

try {
  const preexistingFoundationObjects = Number(query(`
    select
      (select count(*) from pg_catalog.pg_namespace
        where nspname = 'foundation_inventory_private')
      +
      (select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'foundation_inventory_private'
          and c.relname in ('runtime_aggregates','runtime_idempotency','runtime_audit'));
  `));
  assert(
    preexistingFoundationObjects === 0,
    "PREEXISTING_FOUNDATION_SCHEMA_FORBIDDEN",
  );

  psql(["--single-transaction", "-f", MIGRATION]);
  foundationSchemaCreatedByThisRun = true;

  const objectCount = Number(query(`
    select count(*) from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'foundation_inventory_private'
      and c.relname in ('runtime_aggregates','runtime_idempotency','runtime_audit');
  `));
  assert(objectCount === 3, "FOUNDATION_OBJECT_INVENTORY_MISMATCH");
  passed += 1;

  const rlsCount = Number(query(`
    select count(*) from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'foundation_inventory_private'
      and c.relname in ('runtime_aggregates','runtime_idempotency','runtime_audit')
      and c.relrowsecurity and c.relforcerowsecurity;
  `));
  assert(rlsCount === 3, "RLS_OR_FORCE_RLS_MISSING");
  passed += 1;

  psql(["-c", `begin; set local role anon; select * from foundation_inventory_private.runtime_aggregates; rollback;`], { expectFailure: true });
  psql(["-c", `begin; set local role authenticated; insert into foundation_inventory_private.runtime_audit(owner,location_id,product_id,request_id,actor,operator,outcome_type,revision_before,revision_after,evidence) values ('OFFICE_AZ','x','y','z','a','o','recorded',0,0,'{}'); rollback;`], { expectFailure: true });
  passed += 2;

  const initialized = JSON.parse(query(`
    select foundation_inventory_private.initialize_runtime_aggregate(
      ${sqlString(owner)}, ${sqlString(location)}, ${sqlString(product)},
      'bootstrap-1', 'actor-disposable', 'operator-disposable',
      'INV001-P18_RUNTIME_SNAPSHOT_V3', ${jsonSql(initialSnapshot)},
      '{"code":"BOOTSTRAP"}'::jsonb
    )::text;
  `));
  assert(initialized.tag === "initialized" && initialized.revision === 0, "INITIALIZATION_FAILED");
  passed += 1;

  const snapshot1 = { ...initialSnapshot, revision: 1 };
  const first = JSON.parse(query(applySql({
    requestId: "request-1",
    idempotencyKey: "key-1",
    fingerprint: "a".repeat(64),
    expectedRevision: 0,
    nextSnapshot: snapshot1,
    outcome: { ok: true, code: "ACCEPTED" },
    evidence: { code: "ACCEPTED" },
  })));
  assert(first.tag === "committed" && first.revision === 1, "CAS_COMMIT_FAILED");
  passed += 1;

  const replay = JSON.parse(query(applySql({
    requestId: "request-1-replay",
    idempotencyKey: "key-1",
    fingerprint: "a".repeat(64),
    expectedRevision: 0,
    nextSnapshot: snapshot1,
    outcome: { ok: false, code: "MUST_NOT_REPLACE_ORIGINAL" },
    evidence: { code: "REPLAY" },
  })));
  assert(replay.tag === "replayed" && replay.outcome.code === "ACCEPTED", "IDENTICAL_REPLAY_NOT_DETERMINISTIC");
  passed += 1;

  const conflict = JSON.parse(query(applySql({
    requestId: "request-1-conflict",
    idempotencyKey: "key-1",
    fingerprint: "b".repeat(64),
    expectedRevision: 1,
    nextSnapshot: { ...initialSnapshot, revision: 2 },
    outcome: { ok: true },
    evidence: { code: "CONFLICT" },
  })));
  assert(conflict.tag === "replay_conflict", "MATERIAL_REPLAY_CONFLICT_NOT_DENIED");
  assert(Number(query(`select revision from foundation_inventory_private.runtime_aggregates where owner=${sqlString(owner)} and location_id=${sqlString(location)} and product_id=${sqlString(product)};`)) === 1, "REPLAY_CONFLICT_MUTATED_STATE");
  passed += 2;

  const stale = JSON.parse(query(applySql({
    requestId: "request-stale",
    idempotencyKey: "key-stale",
    fingerprint: "c".repeat(64),
    expectedRevision: 0,
    nextSnapshot: { ...initialSnapshot, revision: 1 },
    outcome: { ok: true },
    evidence: { code: "STALE" },
  })));
  assert(stale.tag === "stale" && stale.revision === 1, "STALE_CAS_NOT_DENIED");
  passed += 1;

  const recorded = JSON.parse(query(applySql({
    requestId: "request-denied",
    idempotencyKey: "key-denied",
    fingerprint: "d".repeat(64),
    expectedRevision: 1,
    nextSnapshot: null,
    outcome: { ok: false, code: "AUTHORIZATION_DENIED" },
    evidence: { code: "DENIED" },
  })));
  assert(recorded.tag === "recorded" && recorded.revision === 1, "DENIED_EVIDENCE_NOT_RECORDED");
  assert(Number(query(`select revision from foundation_inventory_private.runtime_aggregates where owner=${sqlString(owner)} and location_id=${sqlString(location)} and product_id=${sqlString(product)};`)) === 1, "DENIAL_MUTATED_STATE");
  passed += 2;

  const snapshot2 = { ...initialSnapshot, revision: 2 };
  const [raceA, raceB] = await Promise.all([
    asyncQuery(applySql({
      requestId: "race-a", idempotencyKey: "race-key-a", fingerprint: "e".repeat(64),
      expectedRevision: 1, nextSnapshot: snapshot2, outcome: { winner: "a" }, evidence: { code: "RACE_A" },
    })),
    asyncQuery(applySql({
      requestId: "race-b", idempotencyKey: "race-key-b", fingerprint: "f".repeat(64),
      expectedRevision: 1, nextSnapshot: snapshot2, outcome: { winner: "b" }, evidence: { code: "RACE_B" },
    })),
  ]);
  const raceTags = [JSON.parse(raceA).tag, JSON.parse(raceB).tag].sort();
  assert(JSON.stringify(raceTags) === JSON.stringify(["committed", "stale"]), "SEPARATE_CONNECTION_CAS_RACE_FAILED");
  passed += 1;

  const staleReplay = JSON.parse(query(applySql({
    requestId: "request-stale-retry",
    idempotencyKey: "key-stale",
    fingerprint: "c".repeat(64),
    expectedRevision: 0,
    nextSnapshot: { ...initialSnapshot, revision: 1 },
    outcome: { ok: false, code: "MUST_NOT_REPLACE_STALE_RESULT" },
    evidence: { code: "STALE_RETRY" },
  })));
  assert(
    staleReplay.tag === "stale" && staleReplay.revision === 1,
    "STALE_REPLAY_NOT_DETERMINISTIC",
  );
  assert(Number(query(`select revision from foundation_inventory_private.runtime_aggregates where owner=${sqlString(owner)} and location_id=${sqlString(location)} and product_id=${sqlString(product)};`)) === 2, "STALE_REPLAY_MUTATED_STATE");
  passed += 2;

  const beforeRollback = query(`
    select revision || '|' ||
      (select count(*) from foundation_inventory_private.runtime_audit) || '|' ||
      (select count(*) from foundation_inventory_private.runtime_idempotency)
    from foundation_inventory_private.runtime_aggregates
    where owner=${sqlString(owner)} and location_id=${sqlString(location)} and product_id=${sqlString(product)};
  `);
  const snapshot3 = { ...initialSnapshot, revision: 3 };
  query(`begin; ${applySql({
    requestId: "rollback", idempotencyKey: "rollback-key", fingerprint: "1".repeat(64),
    expectedRevision: 2, nextSnapshot: snapshot3, outcome: { ok: true }, evidence: { code: "ROLLBACK" },
  })} rollback;`);
  const afterRollback = query(`
    select revision || '|' ||
      (select count(*) from foundation_inventory_private.runtime_audit) || '|' ||
      (select count(*) from foundation_inventory_private.runtime_idempotency)
    from foundation_inventory_private.runtime_aggregates
    where owner=${sqlString(owner)} and location_id=${sqlString(location)} and product_id=${sqlString(product)};
  `);
  assert(beforeRollback === afterRollback, "FORCED_ROLLBACK_LEFT_PARTIAL_STATE");
  passed += 1;

  psql(["-c", `begin; set local role authenticated; update foundation_inventory_private.runtime_audit set outcome_code='tampered'; rollback;`], { expectFailure: true });
  psql(["-c", `begin; set local role authenticated; delete from foundation_inventory_private.runtime_audit; rollback;`], { expectFailure: true });
  passed += 2;

  const legacyTouches = Number(query(`
    select count(*) from pg_catalog.pg_stat_user_tables
    where relname in ('gyeon_products','product_orders','dealer_stock_levels','inventory_movements','audit_logs')
      and (n_tup_ins + n_tup_upd + n_tup_del) > 0;
  `));
  assert(legacyTouches === 0, "LEGACY_OBJECT_MUTATION_DETECTED");
  passed += 1;

  process.stdout.write(`${JSON.stringify({
    marker: "INV001_P24_BOOK_D3A_FOUNDATION_PERSISTENCE_DISPOSABLE_RESULT_V1",
    result: "PASS",
    passed,
    migration: path.basename(MIGRATION),
    migrationSha256,
    loopback: true,
    separateConnectionConcurrency: true,
    cleanupRequired: true,
  })}\n`);
} finally {
  if (foundationSchemaCreatedByThisRun) {
    try {
      psql(["-c", "drop schema foundation_inventory_private cascade;"]);
      process.stdout.write("CLEANUP=PASS\n");
    } catch {
      process.stderr.write("CLEANUP=FAILED\n");
      process.exitCode = 1;
    }
  } else {
    process.stdout.write("CLEANUP=SKIPPED_NOT_OWNED\n");
  }
}
