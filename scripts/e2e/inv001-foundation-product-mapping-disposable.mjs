#!/usr/bin/env node

/**
 * INV001-P24 D3B Gate C disposable verification harness.
 *
 * This file is authored in B1 but MUST NOT be executed before the separate Gate C.
 * Gate C later proves fresh-runtime, genuine-claim, concurrency, rollback, RLS/grant/advisor
 * and cleanup assertions against one acknowledged loopback disposable database.
 * It never prints the connection string or password.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HARNESS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(
  HARNESS_DIRECTORY,
  "../..",
  "supabase/migrations/20260919103125_foundation_product_mapping.sql",
);
const EXPECTED_MIGRATION_SHA256 =
  "281a34011b826871b31377d13182968ee3b87717c18475501433df80931d0cdc";
const REQUIRED_ACK = "I_ACKNOWLEDGE_FRESH_DISPOSABLE_LOCAL_DATABASE_ONLY";
const databaseUrl = process.env.INV001_FOUNDATION_DISPOSABLE_DATABASE_URL;
const applyAck = process.env.INV001_FOUNDATION_DISPOSABLE_APPLY_ACK;

function stop(message) {
  process.stderr.write(
    JSON.stringify({
      marker: "INV001_P24_D3B_GATE_C_DISPOSABLE_EVIDENCE_V1",
      status: "BLOCKED",
      error_code: message,
      cleanup: {
        schemaDropped: false,
        sentinelDeleted: false,
        schemaAbsent: null,
        sentinelAbsent: null,
      },
      secrets_emitted: false,
    }) + "\n",
  );
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
if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  stop("NON_POSTGRES_DATABASE_FORBIDDEN");
}
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
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
  if (result.error != null || result.status == null) {
    throw new Error("PSQL_EXECUTION_FAILED");
  }
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

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

const FOUNDATION_PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUCCESSOR_FOUNDATION_PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const BOOK_PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SENTINEL_SKU = "INV001-D3B-GATE-C-SENTINEL";
const EVIDENCE_B = "b".repeat(64);
const EVIDENCE_C = "c".repeat(64);
const DATABASE_ROLES = Object.freeze(["anon", "authenticated", "service_role"]);

function applyConfirmedMapping({
  owner = "OFFICE_AZ",
  lifecycle = "active",
  identityRevision = 2,
  expectedMappingRevision = 1,
  eventKind = "change",
  successor = null,
  evidence = EVIDENCE_B,
} = {}) {
  const successorSql = successor == null ? "null" : `'${successor}'`;
  return query(`
    select foundation_product_mapping_private.apply_confirmed_mapping(
      '${eventKind}', '${FOUNDATION_PRODUCT_ID}', '${BOOK_PRODUCT_ID}'::uuid,
      '${owner}', '${lifecycle}', ${identityRevision}, ${expectedMappingRevision},
      'gate-c-user', 'gate-c-dealer', 'server_resolved', 'OFFICE_AZ_ADMIN',
      'gate-c-request', '${evidence}', '{}'::jsonb, ${successorSql}
    )->>'tag'
  `);
}

function concurrentApplySql() {
  return (
    "select foundation_product_mapping_private.apply_confirmed_mapping(" +
    "'change', '" +
    FOUNDATION_PRODUCT_ID +
    "', '" +
    BOOK_PRODUCT_ID +
    "'::uuid, 'OFFICE_AZ', 'active', 2, 1, " +
    "'gate-c-concurrency-user', 'gate-c-dealer', 'server_resolved', " +
    "'OFFICE_AZ_ADMIN', 'gate-c-concurrency-request', '" +
    EVIDENCE_C +
    "', '{}'::jsonb, null)->>'tag'"
  );
}

function recordMappingEvent({
  eventKind,
  lifecycle,
  identityRevision = 2,
  mappingRevision = 1,
  owner = "OFFICE_AZ",
  successor = null,
} = {}) {
  const successorSql = successor == null ? "null" : `'${successor}'`;
  return query(`
    select foundation_product_mapping_private.record_mapping_event(
      '${eventKind}', '${FOUNDATION_PRODUCT_ID}', '${BOOK_PRODUCT_ID}'::uuid,
      '${owner}', '${lifecycle}', ${identityRevision}, ${mappingRevision},
      'gate-c-user', 'gate-c-dealer', 'server_resolved', 'OFFICE_AZ_ADMIN',
      'gate-c-request', '${EVIDENCE_B}', '{}'::jsonb, ${successorSql}
    )->>'tag'
  `);
}

function serviceRoleCandidateSql() {
  return (
    "select foundation_product_mapping_private.record_mapping_event(" +
    "'candidate', '" +
    FOUNDATION_PRODUCT_ID +
    "', '" +
    BOOK_PRODUCT_ID +
    "'::uuid, 'OFFICE_AZ', 'active', 1, 0, " +
    "'gate-c-role-user', 'gate-c-dealer', 'server_resolved', " +
    "'OFFICE_AZ_ADMIN', 'gate-c-role-request', '" +
    EVIDENCE_B +
    "', '{}'::jsonb, null)->>'tag'"
  );
}

function roleQuery(role, statement, { expectFailure = false, claims = null } = {}) {
  assert(DATABASE_ROLES.includes(role), "UNSUPPORTED_TEST_ROLE");
  const claimStatement =
    claims == null
      ? ""
      : "set local \"request.jwt.claims\" = '" +
        JSON.stringify(claims).replaceAll("'", "''") +
        "';";
  return psql(
    [
      "-A",
      "-t",
      "-q",
      "-c",
      "begin; set local role " +
        role +
        "; " +
        claimStatement +
        " " +
        statement +
        "; rollback;",
    ],
    { expectFailure },
  );
}

function asyncRoleQuery(role, statement) {
  assert(DATABASE_ROLES.includes(role), "UNSUPPORTED_TEST_ROLE");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "psql",
      [
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        ...connectionArgs,
        "-A",
        "-t",
        "-q",
        "-c",
        "begin; set local role " + role + "; " + statement + "; commit;",
      ],
      {
        env: pgEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", () => reject(new Error("CONCURRENCY_PROCESS_FAILED")));
    child.on("close", (status) => {
      if (status !== 0) reject(new Error("CONCURRENCY_QUERY_FAILED"));
      else resolve(stdout.trim());
    });
  });
}

function applyMigration() {
  const sql = readFileSync(MIGRATION, "utf8");
  psql(["-c", sql]);
}

let ownsMappingSchema = false;
let ownsSentinelProduct = false;

function cleanupOwnedResources() {
  let schemaDropped = !ownsMappingSchema;
  let sentinelDeleted = !ownsSentinelProduct;

  if (ownsMappingSchema) {
    try {
      query("drop schema if exists foundation_product_mapping_private cascade");
      schemaDropped = true;
    } catch {
      schemaDropped = false;
    }
  }
  if (ownsSentinelProduct) {
    try {
      query(
        "delete from public.gyeon_products where id = '" +
          BOOK_PRODUCT_ID +
          "'::uuid and sku = '" +
          SENTINEL_SKU +
          "'",
      );
      sentinelDeleted = true;
    } catch {
      sentinelDeleted = false;
    }
  }

  let schemaAbsent = false;
  let sentinelAbsent = false;
  try {
    schemaAbsent =
      query(
        "select count(*) from pg_namespace where nspname = " +
          "'foundation_product_mapping_private'",
      ) === "0";
  } catch {
    schemaAbsent = false;
  }
  try {
    sentinelAbsent =
      query(
        "select count(*) from public.gyeon_products where id = '" +
          BOOK_PRODUCT_ID +
          "'::uuid or sku = '" +
          SENTINEL_SKU +
          "'",
      ) === "0";
  } catch {
    sentinelAbsent = false;
  }

  return Object.freeze({
    schemaDropped,
    sentinelDeleted,
    schemaAbsent,
    sentinelAbsent,
  });
}

function fixedErrorCode(error) {
  const message = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
  return /^[A-Z0-9_]+$/.test(message) ? message : "UNCLASSIFIED_GATE_C_FAILURE";
}

try {
  // fresh-runtime
  const databaseVersion = query("show server_version");
  assert(
    query(
      "select count(*) from pg_roles where rolname in ('anon', 'authenticated', 'service_role')",
    ) === "3",
    "REQUIRED_SUPABASE_ROLES_MISSING",
  );
  assert(
    query(
      "select count(*) from pg_namespace where nspname = " +
        "'foundation_product_mapping_private'",
    ) === "0",
    "MAPPING_SCHEMA_NOT_FRESH",
  );
  assert(
    query(
      "select count(*) from public.gyeon_products where id = '" +
        BOOK_PRODUCT_ID +
        "'::uuid or sku = '" +
        SENTINEL_SKU +
        "'",
    ) === "0",
    "SENTINEL_PRODUCT_NOT_FRESH",
  );
  ownsMappingSchema = true;
  applyMigration();
  assert(
    query("select extname from pg_extension where extname = 'plpgsql' limit 1").length >= 0,
    "FRESH_RUNTIME_UNAVAILABLE",
  );
  assert(
    query("select nspname from pg_namespace where nspname = 'foundation_product_mapping_private'") ===
      "foundation_product_mapping_private",
    "MAPPING_SCHEMA_MISSING",
  );

  // genuine-claim / RLS / grant / advisor
  assert(
    query("select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'foundation_product_mapping_private' and c.relname = 'current_mappings'") === "t",
    "RLS_NOT_FORCED_CURRENT",
  );
  assert(
    query("select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'foundation_product_mapping_private' and c.relname = 'mapping_events'") === "t",
    "RLS_NOT_FORCED_EVENTS",
  );
  assert(
    query("select count(*) from pg_policies where schemaname = 'foundation_product_mapping_private'") === "0",
    "RAW_TABLE_POLICY_PRESENT",
  );

  // Harness-owned sentinel. Existing rows are never reused.
  ownsSentinelProduct = true;
  query(
    "insert into public.gyeon_products (id, sku, product_name) values ('" +
      BOOK_PRODUCT_ID +
      "'::uuid, '" +
      SENTINEL_SKU +
      "', 'INV001 D3B Gate C Sentinel')",
  );

  // Actual Supabase database roles run in separate psql sessions.
  const directPrivateRead =
    "select count(*) from foundation_product_mapping_private.current_mappings";
  for (const role of ["anon", "authenticated"]) {
    assert(
      roleQuery(role, directPrivateRead, { expectFailure: true }) === "DENIED",
      "UNPRIVILEGED_PRIVATE_TABLE_ACCESS_ALLOWED",
    );
    assert(
      roleQuery(role, serviceRoleCandidateSql(), { expectFailure: true }) === "DENIED",
      "UNPRIVILEGED_FUNCTION_EXECUTE_ALLOWED",
    );
  }
  assert(
    roleQuery("service_role", directPrivateRead, { expectFailure: true }) === "DENIED",
    "SERVICE_ROLE_RAW_TABLE_ACCESS_ALLOWED",
  );
  assert(
    roleQuery("service_role", serviceRoleCandidateSql()) === "recorded",
    "SERVICE_ROLE_FUNCTION_EXECUTE_DENIED",
  );
  for (const role of ["anon", "authenticated"]) {
    assert(
      roleQuery(role, directPrivateRead, {
        expectFailure: true,
        claims: {
          role: "service_role",
          sub: "00000000-0000-4000-8000-000000000001",
        },
      }) === "DENIED",
      "REQUEST_CLAIM_BYPASSED_DATABASE_ROLE",
    );
  }

  assert(
    applyConfirmedMapping({ eventKind: "confirm", expectedMappingRevision: 0 }) === "accepted",
    "INITIAL_MAPPING_CONFIRM_FAILED",
  );
  const acceptedState = query(`select concat_ws('|', legal_owner, foundation_lifecycle,
    foundation_identity_revision, mapping_revision, evidence_reference,
    coalesce(successor_foundation_product_id, 'NULL'))
    from foundation_product_mapping_private.current_mappings
    where foundation_product_id = '${FOUNDATION_PRODUCT_ID}'`);
  const acceptedEventCount = query(
    "select count(*) from foundation_product_mapping_private.mapping_events",
  );

  assert(
    applyConfirmedMapping({ owner: "ATTRACTION" }) === "denied",
    "OWNER_CHANGE_WAS_NOT_DENIED",
  );
  assert(
    applyConfirmedMapping({ identityRevision: 1 }) === "denied",
    "LOWER_IDENTITY_REVISION_WAS_NOT_DENIED",
  );
  assert(
    applyConfirmedMapping({ lifecycle: "superseded" }) === "denied",
    "SUPERSEDED_WITHOUT_SUCCESSOR_WAS_NOT_DENIED",
  );
  assert(
    applyConfirmedMapping({ successor: SUCCESSOR_FOUNDATION_PRODUCT_ID }) === "denied",
    "NON_SUPERSEDED_SUCCESSOR_WAS_NOT_DENIED",
  );
  assert(
    applyConfirmedMapping({
      lifecycle: "superseded",
      successor: FOUNDATION_PRODUCT_ID,
    }) === "denied",
    "SELF_SUCCESSOR_WAS_NOT_DENIED",
  );
  assert(
    recordMappingEvent({ eventKind: "suspend", lifecycle: "retired" }) === "denied" &&
      recordMappingEvent({ eventKind: "retire", lifecycle: "suspended" }) === "denied" &&
      recordMappingEvent({
        eventKind: "supersede",
        lifecycle: "active",
        successor: SUCCESSOR_FOUNDATION_PRODUCT_ID,
      }) === "denied",
    "EVENT_LIFECYCLE_MISMATCH_WAS_NOT_DENIED",
  );
  assert(
    query(`select concat_ws('|', legal_owner, foundation_lifecycle,
      foundation_identity_revision, mapping_revision, evidence_reference,
      coalesce(successor_foundation_product_id, 'NULL'))
      from foundation_product_mapping_private.current_mappings
      where foundation_product_id = '${FOUNDATION_PRODUCT_ID}'`) === acceptedState,
    "DENIAL_MUTATED_CURRENT_MAPPING",
  );
  assert(
    query("select count(*) from foundation_product_mapping_private.mapping_events") ===
      acceptedEventCount,
    "DENIAL_APPENDED_MAPPING_EVENT",
  );

  const beforeCandidateState = acceptedState;
  assert(
    recordMappingEvent({ eventKind: "candidate", lifecycle: "active" }) === "recorded" &&
      recordMappingEvent({ eventKind: "rejection", lifecycle: "active" }) === "recorded",
    "NON_MUTATING_EVIDENCE_EVENT_FAILED",
  );
  assert(
    query(`select concat_ws('|', legal_owner, foundation_lifecycle,
      foundation_identity_revision, mapping_revision, evidence_reference,
      coalesce(successor_foundation_product_id, 'NULL'))
      from foundation_product_mapping_private.current_mappings
      where foundation_product_id = '${FOUNDATION_PRODUCT_ID}'`) === beforeCandidateState,
    "CANDIDATE_OR_REJECTION_MUTATED_CURRENT_MAPPING",
  );

  // Two independent service_role connections contend on the same pair/revision.
  const concurrencyRevisionBefore = Number(
    query(
      "select mapping_revision from " +
        "foundation_product_mapping_private.current_mappings where " +
        "foundation_product_id = '" +
        FOUNDATION_PRODUCT_ID +
        "'",
    ),
  );
  const concurrencyEventCountBefore = Number(
    query("select count(*) from foundation_product_mapping_private.mapping_events"),
  );
  const conflictStatement = concurrentApplySql();
  const conflictResults = await Promise.all([
    asyncRoleQuery("service_role", conflictStatement),
    asyncRoleQuery("service_role", conflictStatement),
  ]);
  const concurrencyOutcomes = conflictResults.toSorted();
  assert(
    JSON.stringify(concurrencyOutcomes) === JSON.stringify(["accepted", "stale"]),
    "CONCURRENCY_OUTCOME_MISMATCH",
  );
  const concurrencyRevisionAfter = Number(
    query(
      "select mapping_revision from " +
        "foundation_product_mapping_private.current_mappings where " +
        "foundation_product_id = '" +
        FOUNDATION_PRODUCT_ID +
        "'",
    ),
  );
  const concurrencyEventCountAfter = Number(
    query("select count(*) from foundation_product_mapping_private.mapping_events"),
  );
  assert(
    concurrencyRevisionAfter === concurrencyRevisionBefore + 1,
    "CONCURRENCY_REVISION_NOT_EXACTLY_ONE",
  );
  assert(
    concurrencyEventCountAfter === concurrencyEventCountBefore + 1,
    "CONCURRENCY_EVENT_NOT_EXACTLY_ONE",
  );

  const cleanupOutcome = cleanupOwnedResources();
  assert(cleanupOutcome.schemaAbsent, "CLEANUP_LEFT_MAPPING_SCHEMA");
  assert(cleanupOutcome.sentinelAbsent, "CLEANUP_LEFT_SENTINEL_PRODUCT");

  process.stdout.write(
    JSON.stringify({
      marker: "INV001_P24_D3B_GATE_C_DISPOSABLE_EVIDENCE_V1",
      status: "PASS",
      migration_sha256: migrationSha256,
      database: {
        engine: "PostgreSQL",
        version: databaseVersion,
        target: "loopback_disposable_only",
        supabase_roles_present: true,
      },
      matrix: {
        fresh_runtime: "PASS",
        rls_forced: "PASS",
        raw_table_policies_absent: "PASS",
        anon_private_access_denied: "PASS",
        authenticated_private_access_denied: "PASS",
        service_role_raw_table_access_denied: "PASS",
        service_role_function_execute_allowed: "PASS",
        request_claim_cannot_escalate_role: "PASS",
        owner_revision_lifecycle_rollback: "PASS",
        candidate_rejection_non_mutating: "PASS",
      },
      concurrency: {
        connections: 2,
        role: "service_role",
        same_pair_and_expected_revision: true,
        outcomes: concurrencyOutcomes,
        revision_delta: concurrencyRevisionAfter - concurrencyRevisionBefore,
        event_delta: concurrencyEventCountAfter - concurrencyEventCountBefore,
      },
      cleanup: cleanupOutcome,
      secrets_emitted: false,
    }) + "\n",
  );
} catch (error) {
  const cleanupOutcome = cleanupOwnedResources();
  process.stderr.write(
    JSON.stringify({
      marker: "INV001_P24_D3B_GATE_C_DISPOSABLE_EVIDENCE_V1",
      status: "FAIL",
      error_code: fixedErrorCode(error),
      cleanup: cleanupOutcome,
      secrets_emitted: false,
    }) + "\n",
  );
  process.exitCode = 1;
}
