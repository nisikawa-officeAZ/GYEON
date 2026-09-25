import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ACK = "I_ACKNOWLEDGE_FRESH_DISPOSABLE_LOCAL_DATABASE_ONLY";
const LABEL_KEY = "inv001.d5b.dv";
const IMAGE_TAG = "postgres:16";
const EXPECTED_BASE = "5f3a3abdf7f651e2338d7d0c1bf24100078da356";
const EXPECTED_TREE = "33a133dcd1155808c302d7a75804133b4da01d60";
const MIGRATIONS = [
  {
    path: "supabase/migrations/20260920093931_office_az_operator_authority.sql",
    sha256: "2a880998de445c347b53dc8578bd5bfba0e1f66c22816722eef3ae1abf6ac767",
  },
  {
    path: "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql",
    sha256: "1377e6847bbc261b1289fc0856c11c5feb9d270520c1fb4f26c294a4e33bc6ca",
  },
];
// Presence-only check; values are never read.
const FORBIDDEN_CONNECTION_ENV = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "INV001_FOUNDATION_DISPOSABLE_DATABASE_URL",
  "R1B_DB_URL",
  "R1B_API_URL",
  "R1B_ANON_KEY",
  "R1B_SERVICE_ROLE_KEY",
  "C5C_DB_URL",
  "C5D_DB_URL",
  "R12F_DB_URL",
];
const CLIENT_ROLES = ["anon", "authenticated", "service_role"];
const MOBILE_TABLES = ["managed_devices", "enrollment_codes", "sessions", "audit_events"];
const RPC_SIGNATURES = {
  register: "public.office_az_inventory_mobile_register(text,text,text,bigint,text,text)",
  revoke_device: "public.office_az_inventory_mobile_revoke_device(text,text,text,bigint,text)",
  issue: "public.office_az_inventory_mobile_issue(text,text,text,bigint,text,text,text)",
  refresh: "public.office_az_inventory_mobile_refresh(text,text,text,bigint,text,text,bigint,text)",
  revoke: "public.office_az_inventory_mobile_revoke(text,text,text,bigint,text)",
};
const AUTHORITY_BOUND_SIGNATURE =
  "office_az_inventory_mobile_private.current_authority_bound(text,text,text,bigint,text)";
const ASSERTION_KEYS = [
  "a01_rpc_execute_acl",
  "a02_private_tables_and_authority_bound_closed",
  "a03_null_auth_uid_rejected",
  "a04_owner_lifecycle_accepted",
  "a05_replay_fails_closed",
  "a06_cross_user_denied",
  "a07_stale_version_and_ungranted_location_denied",
  "a08_revoked_device_blocks_issue",
  "a09_refresh_absolute_ceiling_clamp",
  "a10_audit_hash_only",
  "a11_capability_constraint_closed_set",
  "a12_cleanup_no_residue",
];

const labelValue = process.env.INV001_D5B_DV_RESOURCE_LABEL ?? "";
const cleanupOnly = process.argv.includes("--cleanup-residue");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function dockerIds(kind) {
  const args = kind === "container"
    ? ["ps", "-aq", "--filter", `label=${LABEL_KEY}=${labelValue}`]
    : ["volume", "ls", "-q", "--filter", `label=${LABEL_KEY}=${labelValue}`];
  const output = run("docker", args);
  return output === "" ? [] : output.split(/\s+/u);
}

function removeResources() {
  const containers = dockerIds("container");
  if (containers.length > 0) run("docker", ["rm", "-f", "--volumes", ...containers]);
  const volumes = dockerIds("volume");
  if (volumes.length > 0) run("docker", ["volume", "rm", ...volumes]);
}

function residue() {
  return { containers: dockerIds("container"), volumes: dockerIds("volume") };
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function loopbackPortClosed(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (closed) => {
      socket.destroy();
      resolvePromise(closed);
    };
    socket.setTimeout(2000, () => finish(false));
    socket.once("connect", () => finish(false));
    socket.once("error", (error) => finish(error && error.code === "ECONNREFUSED"));
  });
}

assert(labelValue !== "" && /^[A-Za-z0-9_.-]+$/u.test(labelValue), "INVALID_RESOURCE_LABEL");

if (cleanupOnly) {
  removeResources();
  const remaining = residue();
  const clean = remaining.containers.length === 0 && remaining.volumes.length === 0;
  emit({
    marker: "INV001_P19_D5B_DV_CLEANUP_RESIDUE_V1",
    cleanup: clean ? "PASS" : "FAIL",
    container_residue_count: remaining.containers.length,
    volume_residue_count: remaining.volumes.length,
    secrets_emitted: false,
  });
  process.exit(clean ? 0 : 1);
}

assert(process.env.INV001_D5B_DV_ACK === ACK, "ACK_MISSING_OR_INVALID");
assert(
  process.env.GITHUB_ACTIONS === "true"
    && process.env.RUNNER_OS === "Linux"
    && process.env.RUNNER_ENVIRONMENT === "github-hosted",
  "GITHUB_HOSTED_LINUX_REQUIRED",
);
const presentConnectionEnv = FORBIDDEN_CONNECTION_ENV.filter((name) => Object.hasOwn(process.env, name));
assert(presentConnectionEnv.length === 0, "HOSTED_OR_SHARED_DB_CONNECTION_ENV_PRESENT");

const repositoryRoot = process.cwd();
const migrationSql = MIGRATIONS.map(({ path, sha256: expected }) => {
  const content = readFileSync(resolve(repositoryRoot, path));
  assert(sha256(content) === expected, `MIGRATION_SHA256_MISMATCH_${path}`);
  return content.toString("utf8");
});
assert(run("git", ["rev-parse", "HEAD^"]) === EXPECTED_BASE, "UNEXPECTED_PR_PARENT_COMMIT");
assert(run("git", ["rev-parse", `${EXPECTED_BASE}^{tree}`]) === EXPECTED_TREE, "UNEXPECTED_BASE_TREE");

const suffix = randomBytes(6).toString("hex");
const containerName = `inv001-d5b-dv-${suffix}`;
const volumeName = `inv001-d5b-dv-${suffix}`;
const tempDirectory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "inv001-d5b-dv-"));
const databaseName = "inv001_d5b_dv_disposable";
const password = randomBytes(32).toString("hex");
let resolvedImageDigest = "";
let boundPort = null;
let mainError = null;
let cleanupError = null;
const assertions = Object.fromEntries(ASSERTION_KEYS.map((key) => [key, "NOT_RUN"]));

function pass(key) {
  assertions[key] = "PASS";
}

function dockerPsql(sql, role = "postgres") {
  const prefix = role === "postgres" ? "" : `set role ${role};\n`;
  return run("docker", [
    "exec", "-i", containerName,
    "psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet",
    "--username", "postgres", "--dbname", databaseName,
  ], { input: `${prefix}${sql}\n` });
}

function expectPermissionDenied(sql, role, code) {
  let denied = false;
  try {
    dockerPsql(sql, role);
  } catch (error) {
    denied = String(error?.stderr ?? "").includes("permission denied");
  }
  assert(denied, code);
}

const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";
const ASSIGNMENT_A = "10000000-0000-4000-8000-00000000000a";
const ASSIGNMENT_B = "10000000-0000-4000-8000-00000000000b";
const A = { uid: USER_A, actor: "actor-a", operator: "operator-a", location: "warehouse-a", version: 1 };
const B = { uid: USER_B, actor: "actor-b", operator: "operator-b", location: "warehouse-a", version: 1 };

const rawValues = [];
function syntheticHash() {
  const raw = randomBytes(32).toString("base64url");
  rawValues.push(raw);
  return sha256(Buffer.from(raw, "utf8"));
}

function lit(value) {
  if (typeof value === "number") {
    assert(Number.isSafeInteger(value), "NON_SAFE_INTEGER_LITERAL");
    return String(value);
  }
  if (value === null) return "null";
  assert(/^[A-Za-z0-9_.:-]*$/u.test(value), "UNSAFE_SQL_LITERAL");
  return `'${value}'`;
}

function rpc(uid, name, args) {
  const claim = uid === null ? "" : uid;
  const out = dockerPsql(`
    select set_config('request.jwt.claim.sub', ${lit(claim)}, false);
    select public.office_az_inventory_mobile_${name}(${args.map(lit).join(", ")})::text;
  `, "authenticated").split("\n").at(-1);
  const parsed = JSON.parse(out);
  assert(
    parsed !== null
      && typeof parsed === "object"
      && Object.keys(parsed).length === 2
      && typeof parsed.ok === "boolean"
      && typeof parsed.status === "string",
    `RPC_RESULT_SHAPE_${name}`,
  );
  return `${parsed.ok}:${parsed.status}`;
}

const ACCEPTED = "true:accepted";
const STALE = "false:invalid_or_stale";

function shared(principal, overrides = {}) {
  const p = { ...principal, ...overrides };
  return [p.actor, p.operator, p.location, p.version];
}

try {
  removeResources();
  run("docker", ["pull", IMAGE_TAG]);
  const repoDigests = JSON.parse(run("docker", ["image", "inspect", IMAGE_TAG, "--format", "{{json .RepoDigests}}"]));
  resolvedImageDigest = repoDigests.find((value) => /^postgres@sha256:[0-9a-f]{64}$/u.test(value)) ?? "";
  assert(resolvedImageDigest !== "", "POSTGRES_IMAGE_DIGEST_UNRESOLVED");

  run("docker", ["volume", "create", "--label", `${LABEL_KEY}=${labelValue}`, volumeName]);
  run("docker", [
    "run", "--detach", "--name", containerName,
    "--label", `${LABEL_KEY}=${labelValue}`,
    "--mount", `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", `POSTGRES_DB=${databaseName}`,
    resolvedImageDigest,
  ]);

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      // TCP probe: the image's first-run init server listens on the Unix socket only.
      run("docker", ["exec", containerName, "pg_isready", "--host", "127.0.0.1", "--username", "postgres", "--dbname", databaseName]);
      dockerPsql("select 1;");
      ready = true;
      break;
    } catch {
      run("sleep", ["1"]);
    }
  }
  assert(ready, "POSTGRES_START_TIMEOUT");
  const binding = run("docker", ["port", containerName, "5432/tcp"]);
  const bindingMatch = /^127\.0\.0\.1:(\d+)$/u.exec(binding);
  assert(bindingMatch !== null, "NON_LOOPBACK_OR_NON_EPHEMERAL_BINDING");
  boundPort = Number(bindingMatch[1]);

  dockerPsql(`
    create role anon nologin nobypassrls;
    create role authenticated nologin nobypassrls;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const sql of migrationSql) dockerPsql(sql);

  // a11: extended closed capability set
  dockerPsql(`
    insert into office_az_inventory_authority_private.locations(location_id)
      values ('warehouse-a'), ('warehouse-b');
    insert into office_az_inventory_authority_private.assignments(
      assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
      role, status, valid_from, valid_until, authority_version
    ) values
      (${lit(ASSIGNMENT_A)}, 'human', ${lit(USER_A)}, 'actor-a', 'operator-a',
       'office_az_inventory_super_admin', 'active', now() - interval '1 hour', null, 1),
      (${lit(ASSIGNMENT_B)}, 'human', ${lit(USER_B)}, 'actor-b', 'operator-b',
       'office_az_inventory_super_admin', 'active', now() - interval '1 hour', null, 1);
    insert into office_az_inventory_authority_private.capability_grants values
      (${lit(ASSIGNMENT_A)}, 'inventory.device.register'),
      (${lit(ASSIGNMENT_A)}, 'inventory.session.issue'),
      (${lit(ASSIGNMENT_A)}, 'inventory.session.revoke'),
      (${lit(ASSIGNMENT_B)}, 'inventory.device.register'),
      (${lit(ASSIGNMENT_B)}, 'inventory.session.issue'),
      (${lit(ASSIGNMENT_B)}, 'inventory.session.revoke');
    insert into office_az_inventory_authority_private.location_grants values
      (${lit(ASSIGNMENT_A)}, 'warehouse-a'),
      (${lit(ASSIGNMENT_B)}, 'warehouse-a');
  `);
  dockerPsql(`
    do $$ begin
      begin
        insert into office_az_inventory_authority_private.capability_grants
          values ('10000000-0000-4000-8000-00000000000a', 'inventory.unknown');
        raise exception 'unknown capability accepted';
      exception when check_violation then null;
      end;
    end $$;
  `);
  assert(dockerPsql(`
    select count(*) from office_az_inventory_authority_private.capability_grants
    where capability in ('inventory.device.register','inventory.session.issue','inventory.session.revoke');
  `) === "6", "EXTENDED_CAPABILITIES_NOT_ACCEPTED");
  pass("a11_capability_constraint_closed_set");

  // a01: RPC execute ACL
  assert(dockerPsql(`
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public'
      and p.proname like 'office_az_inventory_mobile_%'
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE';
  `) === "0", "RPC_EXECUTE_LEAK_PUBLIC");
  for (const signature of Object.values(RPC_SIGNATURES)) {
    assert(dockerPsql(`select has_function_privilege('authenticated', '${signature}', 'EXECUTE');`) === "t", `AUTHENTICATED_EXECUTE_MISSING_${signature}`);
    for (const role of ["anon", "service_role"]) {
      assert(dockerPsql(`select has_function_privilege('${role}', '${signature}', 'EXECUTE');`) === "f", `RPC_EXECUTE_LEAK_${role}_${signature}`);
    }
  }
  const probeHash = syntheticHash();
  for (const role of ["anon", "service_role"]) {
    expectPermissionDenied(
      `select public.office_az_inventory_mobile_revoke('actor-a','operator-a','warehouse-a',1,'${probeHash}');`,
      role,
      `RPC_CALL_NOT_DENIED_${role}`,
    );
  }
  pass("a01_rpc_execute_acl");

  // a02: private tables and authority-bound helper closed to client roles
  assert(dockerPsql(`
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'office_az_inventory_mobile_private'
      and c.relname in ('managed_devices','enrollment_codes','sessions','audit_events')
      and c.relrowsecurity and c.relforcerowsecurity;
  `) === "4", "MOBILE_RLS_FORCE_RLS_INCOMPLETE");
  assert(dockerPsql("select count(*) from pg_policies where schemaname = 'office_az_inventory_mobile_private';") === "0", "MOBILE_POLICY_SURFACE_NOT_CLOSED");
  for (const role of CLIENT_ROLES) {
    assert(dockerPsql(`select has_schema_privilege('${role}', 'office_az_inventory_mobile_private', 'USAGE');`) === "f", `MOBILE_SCHEMA_USAGE_LEAK_${role}`);
    for (const table of MOBILE_TABLES) {
      assert(dockerPsql(`select has_table_privilege('${role}', 'office_az_inventory_mobile_private.${table}', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE');`) === "f", `MOBILE_TABLE_PRIVILEGE_LEAK_${role}_${table}`);
    }
    assert(dockerPsql(`select has_function_privilege('${role}', '${AUTHORITY_BOUND_SIGNATURE}', 'EXECUTE');`) === "f", `AUTHORITY_BOUND_EXECUTE_LEAK_${role}`);
    expectPermissionDenied("select count(*) from office_az_inventory_mobile_private.sessions;", role, `MOBILE_TABLE_READ_NOT_DENIED_${role}`);
  }
  expectPermissionDenied(
    `select office_az_inventory_mobile_private.current_authority_bound('actor-a','operator-a','warehouse-a',1,'inventory.session.issue');`,
    "authenticated",
    "AUTHORITY_BOUND_CALL_NOT_DENIED",
  );
  pass("a02_private_tables_and_authority_bound_closed");

  const enrollmentA = syntheticHash();
  const deviceA = syntheticHash();
  const deviceA2 = syntheticHash();
  const sessionA = syntheticHash();
  const sessionA2 = syntheticHash();
  const sessionNearCeiling = syntheticHash();
  const refresh1 = syntheticHash();
  const refresh2 = syntheticHash();
  const refresh3 = syntheticHash();
  const refresh4 = syntheticHash();
  const refresh5 = syntheticHash();
  const refreshCeiling1 = syntheticHash();
  const refreshCeiling2 = syntheticHash();

  dockerPsql(`
    insert into office_az_inventory_mobile_private.enrollment_codes(
      enrollment_code_hash, actor_id, operator_id, authenticated_user_id,
      location_id, authority_version, expires_at
    ) values (${lit(enrollmentA)}, 'actor-a', 'operator-a', ${lit(USER_A)}, 'warehouse-a', 1, now() + interval '1 hour');
  `);

  // a03: null auth.uid() rejected by every RPC
  assert(rpc(null, "register", [...shared(A), enrollmentA, deviceA]) === STALE, "NULL_UID_REGISTER_NOT_REJECTED");
  assert(rpc(null, "revoke_device", [...shared(A), deviceA]) === STALE, "NULL_UID_REVOKE_DEVICE_NOT_REJECTED");
  assert(rpc(null, "issue", [...shared(A), deviceA, sessionA, refresh1]) === STALE, "NULL_UID_ISSUE_NOT_REJECTED");
  assert(rpc(null, "refresh", [...shared(A), sessionA, refresh1, 1, refresh2]) === STALE, "NULL_UID_REFRESH_NOT_REJECTED");
  assert(rpc(null, "revoke", [...shared(A), sessionA]) === STALE, "NULL_UID_REVOKE_NOT_REJECTED");
  assert(dockerPsql(`
    select (select count(*) from office_az_inventory_mobile_private.managed_devices)
      + (select count(*) from office_az_inventory_mobile_private.sessions)
      + (select count(*) from office_az_inventory_mobile_private.audit_events);
  `) === "0", "NULL_UID_SIDE_EFFECT");
  pass("a03_null_auth_uid_rejected");

  // a04 (part 1) and a05: register, enrollment replay, issue, refresh n -> n+1, stale refresh replay
  assert(rpc(USER_A, "register", [...shared(A), enrollmentA, deviceA]) === ACCEPTED, "OWNER_REGISTER_NOT_ACCEPTED");
  assert(rpc(USER_A, "register", [...shared(A), enrollmentA, deviceA2]) === STALE, "ENROLLMENT_REPLAY_NOT_REJECTED");
  assert(rpc(USER_A, "issue", [...shared(A), deviceA, sessionA, refresh1]) === ACCEPTED, "OWNER_ISSUE_NOT_ACCEPTED");
  assert(rpc(USER_A, "refresh", [...shared(A), sessionA, refresh1, 1, refresh2]) === ACCEPTED, "OWNER_REFRESH_NOT_ACCEPTED");
  assert(dockerPsql(`select refresh_version from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(sessionA)};`) === "2", "REFRESH_VERSION_NOT_INCREMENTED");
  assert(rpc(USER_A, "refresh", [...shared(A), sessionA, refresh1, 1, refresh3]) === STALE, "STALE_REFRESH_REPLAY_NOT_REJECTED");

  // a06: cross-user denial (B with own authority, and B claiming A's actor)
  assert(rpc(USER_B, "refresh", [...shared(B), sessionA, refresh2, 2, refresh3]) === STALE, "CROSS_USER_REFRESH_NOT_DENIED");
  assert(rpc(USER_B, "revoke", [...shared(B), sessionA]) === STALE, "CROSS_USER_REVOKE_NOT_DENIED");
  assert(rpc(USER_B, "revoke_device", [...shared(B), deviceA]) === STALE, "CROSS_USER_REVOKE_DEVICE_NOT_DENIED");
  assert(rpc(USER_B, "refresh", [...shared(A), sessionA, refresh2, 2, refresh3]) === STALE, "CROSS_USER_ACTOR_CLAIM_REFRESH_NOT_DENIED");
  assert(rpc(USER_B, "revoke", [...shared(A), sessionA]) === STALE, "CROSS_USER_ACTOR_CLAIM_REVOKE_NOT_DENIED");
  assert(rpc(USER_B, "revoke_device", [...shared(A), deviceA]) === STALE, "CROSS_USER_ACTOR_CLAIM_REVOKE_DEVICE_NOT_DENIED");
  assert(dockerPsql(`
    select concat_ws(',', refresh_version, refresh_hash = ${lit(refresh2)}, revoked_at is null)
    from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(sessionA)};
  `) === "2,t,t", "CROSS_USER_MUTATED_SESSION");
  assert(dockerPsql(`select status from office_az_inventory_mobile_private.managed_devices where device_id_hash = ${lit(deviceA)};`) === "active", "CROSS_USER_MUTATED_DEVICE");
  pass("a06_cross_user_denied");

  // a07: stale authority version and ungranted location
  assert(rpc(USER_A, "refresh", [...shared(A, { version: 2 }), sessionA, refresh2, 2, refresh3]) === STALE, "STALE_AUTHORITY_VERSION_NOT_DENIED");
  assert(rpc(USER_A, "issue", [...shared(A, { version: 2 }), deviceA, sessionA2, refresh4]) === STALE, "STALE_AUTHORITY_VERSION_ISSUE_NOT_DENIED");
  assert(rpc(USER_A, "issue", [...shared(A, { location: "warehouse-b" }), deviceA, sessionA2, refresh4]) === STALE, "UNGRANTED_LOCATION_NOT_DENIED");
  pass("a07_stale_version_and_ungranted_location_denied");

  // a09: refresh keeps access_expires_at <= absolute_expires_at, clamped near the ceiling
  assert(dockerPsql(`
    select count(*) from office_az_inventory_mobile_private.sessions
    where session_id_hash = ${lit(sessionA)} and access_expires_at <= absolute_expires_at;
  `) === "1", "REFRESH_EXCEEDS_ABSOLUTE_CEILING");
  dockerPsql(`
    insert into office_az_inventory_mobile_private.sessions(
      session_id_hash, device_id_hash, actor_id, operator_id, authenticated_user_id,
      location_id, authority_version, refresh_hash, refresh_version,
      issued_at, access_expires_at, absolute_expires_at
    )
    select ${lit(sessionNearCeiling)}, ${lit(deviceA)}, 'actor-a', 'operator-a', ${lit(USER_A)},
      'warehouse-a', 1, ${lit(refreshCeiling1)}, 1,
      issued, issued + interval '1 hour', issued + interval '12 hours'
    from (select now() - interval '11 hours 30 minutes' as issued) as t;
  `);
  assert(rpc(USER_A, "refresh", [...shared(A), sessionNearCeiling, refreshCeiling1, 1, refreshCeiling2]) === ACCEPTED, "NEAR_CEILING_REFRESH_NOT_ACCEPTED");
  assert(dockerPsql(`
    select (access_expires_at = absolute_expires_at)::text
    from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(sessionNearCeiling)};
  `) === "true", "NEAR_CEILING_REFRESH_NOT_CLAMPED");
  pass("a09_refresh_absolute_ceiling_clamp");

  // a04 (part 2) and a05: revoke, refresh after revoke
  assert(rpc(USER_A, "revoke", [...shared(A), sessionA]) === ACCEPTED, "OWNER_REVOKE_NOT_ACCEPTED");
  pass("a04_owner_lifecycle_accepted");
  assert(rpc(USER_A, "refresh", [...shared(A), sessionA, refresh2, 2, refresh5]) === STALE, "REFRESH_AFTER_REVOKE_NOT_REJECTED");
  pass("a05_replay_fails_closed");

  // a08: revoked device blocks issue
  assert(rpc(USER_A, "revoke_device", [...shared(A), deviceA]) === ACCEPTED, "OWNER_REVOKE_DEVICE_NOT_ACCEPTED");
  assert(dockerPsql(`
    select count(*) from office_az_inventory_mobile_private.sessions
    where device_id_hash = ${lit(deviceA)} and revoked_at is null;
  `) === "0", "DEVICE_REVOKE_LEFT_ACTIVE_SESSION");
  assert(rpc(USER_A, "issue", [...shared(A), deviceA, sessionA2, refresh4]) === STALE, "REVOKED_DEVICE_ISSUE_NOT_BLOCKED");
  pass("a08_revoked_device_blocks_issue");

  // a10: audit rows per accepted operation, hash-only storage
  assert(dockerPsql(`
    select string_agg(operation || '=' || n, ',' order by operation)
    from (select operation, count(*) as n from office_az_inventory_mobile_private.audit_events group by operation) as t;
  `) === "issue=1,refresh=2,register=1,revoke=1,revoke_device=1", "AUDIT_ROWS_MISMATCH");
  assert(dockerPsql(`
    select count(*) from office_az_inventory_mobile_private.audit_events
    where (device_id_hash is not null and device_id_hash !~ '^[a-f0-9]{64}$')
       or (session_id_hash is not null and session_id_hash !~ '^[a-f0-9]{64}$')
       or (enrollment_code_hash is not null and enrollment_code_hash !~ '^[a-f0-9]{64}$')
       or authenticated_user_id is null;
  `) === "0", "AUDIT_HASH_FORMAT_VIOLATION");
  const storedText = dockerPsql(`
    select coalesce(string_agg(t, ' '), '') from (
      select row_to_json(x)::text as t from office_az_inventory_mobile_private.managed_devices x
      union all select row_to_json(x)::text from office_az_inventory_mobile_private.enrollment_codes x
      union all select row_to_json(x)::text from office_az_inventory_mobile_private.sessions x
      union all select row_to_json(x)::text from office_az_inventory_mobile_private.audit_events x
    ) as rows;
  `);
  assert(storedText.length > 0, "STORED_ROWS_MISSING");
  assert(rawValues.every((raw) => !storedText.includes(raw)), "RAW_PUBLIC_VALUE_STORED");
  pass("a10_audit_hash_only");

  dockerPsql(`
    delete from office_az_inventory_mobile_private.audit_events;
    delete from office_az_inventory_mobile_private.sessions;
    delete from office_az_inventory_mobile_private.managed_devices;
    delete from office_az_inventory_mobile_private.enrollment_codes;
    delete from office_az_inventory_authority_private.location_grants;
    delete from office_az_inventory_authority_private.capability_grants;
    delete from office_az_inventory_authority_private.assignments;
    delete from office_az_inventory_authority_private.locations;
  `);
} catch (error) {
  mainError = error instanceof Error ? error.message : "UNKNOWN_VALIDATION_ERROR";
} finally {
  try {
    removeResources();
    rmSync(tempDirectory, { recursive: true, force: true });
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : "UNKNOWN_CLEANUP_ERROR";
  }
}

const remaining = residue();
const tempDirectoryPresent = existsSync(tempDirectory);
const portClosed = boundPort === null ? true : await loopbackPortClosed(boundPort);
const cleanupPass = cleanupError === null
  && remaining.containers.length === 0
  && remaining.volumes.length === 0
  && !tempDirectoryPresent
  && portClosed;
if (cleanupPass) pass("a12_cleanup_no_residue");
else assertions.a12_cleanup_no_residue = "FAIL";
const validationPass = mainError === null
  && ASSERTION_KEYS.slice(0, 11).every((key) => assertions[key] === "PASS");
const passed = validationPass && cleanupPass;

emit({
  marker: "INV001_P19_D5B_DV_DISPOSABLE_VALIDATION_EVIDENCE_V1",
  status: passed ? "PASS" : "BLOCKED_OR_FAILED",
  validation_status: validationPass ? "PASS" : "FAIL",
  cleanup_status: cleanupPass ? "PASS" : "FAIL",
  base_commit: EXPECTED_BASE,
  base_tree: EXPECTED_TREE,
  migrations: MIGRATIONS,
  intervening_migrations_applied: false,
  postgres_image_tag: IMAGE_TAG,
  resolved_postgres_image_digest: resolvedImageDigest || null,
  runtime: {
    github_actions: true,
    runner_os: "Linux",
    runner_environment: "github-hosted",
    dedicated_container: true,
    dedicated_volume: true,
    loopback_ephemeral_port: boundPort !== null,
    hosted_connection_env_present: false,
    synthetic_fixtures_only: true,
  },
  assertions,
  cleanup: {
    container_residue_count: remaining.containers.length,
    volume_residue_count: remaining.volumes.length,
    temporary_directory_present: tempDirectoryPresent,
    loopback_port_closed: portClosed,
    error: cleanupError,
  },
  failure: mainError,
  secrets_emitted: false,
});

process.exit(passed ? 0 : 1);
