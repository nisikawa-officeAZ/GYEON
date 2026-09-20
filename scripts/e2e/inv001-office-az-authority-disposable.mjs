import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ACK = "I_ACKNOWLEDGE_FRESH_DISPOSABLE_LOCAL_DATABASE_ONLY";
const MIGRATION_PATH = "supabase/migrations/20260920093931_office_az_operator_authority.sql";
const MIGRATION_SHA256 = "2a880998de445c347b53dc8578bd5bfba0e1f66c22816722eef3ae1abf6ac767";
const IMAGE_TAG = "postgres:16";
const EXPECTED_BASE = "763d0926c4d8143214d8cb53fb4bd1369519e1fe";
const EXPECTED_TREE = "97fe0c632d3956f40bd26378b9ca25d998044b12";
const REQUIRED_ROLES = ["anon", "authenticated", "service_role"];
const PRIVATE_TABLES = ["locations", "assignments", "capability_grants", "location_grants"];
const labelValue = process.env.INV001_D4A_B2_RESOURCE_LABEL ?? "";
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
    ? ["ps", "-aq", "--filter", `label=inv001.d4a.b2=${labelValue}`]
    : ["volume", "ls", "-q", "--filter", `label=inv001.d4a.b2=${labelValue}`];
  const output = run("docker", args);
  return output === "" ? [] : output.split(/\s+/u);
}

function removeResources() {
  const containers = dockerIds("container");
  if (containers.length > 0) run("docker", ["rm", "-f", ...containers]);
  const volumes = dockerIds("volume");
  if (volumes.length > 0) run("docker", ["volume", "rm", ...volumes]);
}

function residue() {
  return {
    containers: dockerIds("container"),
    volumes: dockerIds("volume"),
  };
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

assert(labelValue !== "" && /^[A-Za-z0-9_.-]+$/u.test(labelValue), "INVALID_RESOURCE_LABEL");

if (cleanupOnly) {
  removeResources();
  const remaining = residue();
  emit({
    marker: "INV001_D4A_B2_CLEANUP_RESIDUE_V1",
    cleanup: remaining.containers.length === 0 && remaining.volumes.length === 0 ? "PASS" : "FAIL",
    residue: remaining,
    secrets_emitted: false,
  });
  process.exit(remaining.containers.length === 0 && remaining.volumes.length === 0 ? 0 : 1);
}

assert(process.env.INV001_D4A_B2_ACK === ACK, "ACK_MISSING_OR_INVALID");
assert(process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_OS === "Linux", "GITHUB_HOSTED_LINUX_REQUIRED");
assert(process.env.DATABASE_URL === undefined, "EXISTING_DATABASE_URL_FORBIDDEN");

const repositoryRoot = process.cwd();
const migrationAbsolutePath = resolve(repositoryRoot, MIGRATION_PATH);
const migration = readFileSync(migrationAbsolutePath);
assert(sha256(migration) === MIGRATION_SHA256, "MIGRATION_SHA256_MISMATCH");
assert(run("git", ["rev-parse", "HEAD^"]) === EXPECTED_BASE, "UNEXPECTED_PR_PARENT_COMMIT");
assert(run("git", ["rev-parse", `${EXPECTED_BASE}^{tree}`]) === EXPECTED_TREE, "UNEXPECTED_BASE_TREE");

const suffix = randomBytes(6).toString("hex");
const containerName = `inv001-d4a-b2-${suffix}`;
const volumeName = `inv001-d4a-b2-${suffix}`;
const tempDirectory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "inv001-d4a-b2-"));
const databaseName = "inv001_d4a_b2_disposable";
const password = randomBytes(32).toString("hex");
let resolvedImageDigest = "";
let mainError = null;
let cleanupError = null;
let validation = {};

function dockerPsql(sql, role = "postgres") {
  const prefix = role === "postgres" ? "" : `set role ${role};\n`;
  return run("docker", [
    "exec", "-i", containerName,
    "psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align",
    "--username", "postgres", "--dbname", databaseName,
  ], { input: `${prefix}${sql}\n` });
}

try {
  removeResources();
  run("docker", ["pull", IMAGE_TAG]);
  const repoDigests = JSON.parse(run("docker", ["image", "inspect", IMAGE_TAG, "--format", "{{json .RepoDigests}}"]));
  resolvedImageDigest = repoDigests.find((value) => /^postgres@sha256:[0-9a-f]{64}$/u.test(value)) ?? "";
  assert(resolvedImageDigest !== "", "POSTGRES_IMAGE_DIGEST_UNRESOLVED");

  run("docker", ["volume", "create", "--label", `inv001.d4a.b2=${labelValue}`, volumeName]);
  run("docker", [
    "run", "--detach", "--name", containerName,
    "--label", `inv001.d4a.b2=${labelValue}`,
    "--mount", `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", `POSTGRES_DB=${databaseName}`,
    resolvedImageDigest,
  ]);

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      run("docker", ["exec", containerName, "pg_isready", "--username", "postgres", "--dbname", databaseName]);
      ready = true;
      break;
    } catch {
      run("sleep", ["1"]);
    }
  }
  assert(ready, "POSTGRES_START_TIMEOUT");
  const binding = run("docker", ["port", containerName, "5432/tcp"]);
  assert(/^127\.0\.0\.1:\d+$/u.test(binding), "NON_LOOPBACK_OR_NON_EPHEMERAL_BINDING");

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
  dockerPsql(migration.toString("utf8"));

  const zeroCounts = dockerPsql(`
    select concat_ws(',',
      (select count(*) from office_az_inventory_authority_private.locations),
      (select count(*) from office_az_inventory_authority_private.assignments),
      (select count(*) from office_az_inventory_authority_private.capability_grants),
      (select count(*) from office_az_inventory_authority_private.location_grants));
  `);
  assert(zeroCounts === "0,0,0,0", "FRESH_APPLY_NOT_ZERO_ASSIGNMENT");

  const rlsState = dockerPsql(`
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'office_az_inventory_authority_private'
      and c.relname in ('locations','assignments','capability_grants','location_grants')
      and c.relrowsecurity and c.relforcerowsecurity;
  `);
  assert(rlsState === "4", "RLS_FORCE_RLS_INCOMPLETE");
  assert(dockerPsql("select count(*) from pg_policies where schemaname = 'office_az_inventory_authority_private';") === "0", "PRIVATE_POLICY_SURFACE_NOT_CLOSED");

  assert(dockerPsql(`
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    where n.nspname = 'office_az_inventory_authority_private'
      and c.relname in ('locations','assignments','capability_grants','location_grants')
      and acl.grantee = 0
      and acl.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE');
  `) === "0", "PRIVATE_TABLE_PRIVILEGE_LEAK_PUBLIC");
  for (const role of REQUIRED_ROLES) {
    for (const table of PRIVATE_TABLES) {
      const privileges = dockerPsql(`select has_table_privilege('${role}', 'office_az_inventory_authority_private.${table}', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE');`);
      assert(privileges === "f", `PRIVATE_TABLE_PRIVILEGE_LEAK_${role}_${table}`);
    }
  }
  assert(dockerPsql("select has_function_privilege('authenticated', 'public.resolve_office_az_inventory_authority(text,text)', 'EXECUTE');") === "t", "AUTHENTICATED_RPC_EXECUTE_MISSING");
  assert(dockerPsql(`
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public'
      and p.proname = 'resolve_office_az_inventory_authority'
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE';
  `) === "0", "RPC_EXECUTE_LEAK_PUBLIC");
  for (const role of ["anon", "service_role"]) {
    assert(dockerPsql(`select has_function_privilege('${role}', 'public.resolve_office_az_inventory_authority(text,text)', 'EXECUTE');`) === "f", `RPC_EXECUTE_LEAK_${role}`);
  }

  const zeroRpc = dockerPsql(`
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
    select public.resolve_office_az_inventory_authority('actor-1','operator-1')::text;
  `, "authenticated").split("\n").at(-1);
  assert(zeroRpc.includes('"candidates": []') && zeroRpc.includes('"knownLocationIds": []'), "ZERO_ASSIGNMENT_RPC_CONTRACT_FAILED");

  dockerPsql(`
    insert into office_az_inventory_authority_private.locations(location_id)
      values ('warehouse-a'), ('warehouse-b');
    insert into office_az_inventory_authority_private.assignments(
      assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
      role, status, valid_from, valid_until, authority_version
    ) values
      ('10000000-0000-4000-8000-000000000001', 'human', '00000000-0000-4000-8000-000000000001',
       'actor-1', 'operator-1', 'office_az_warehouse_operator', 'active', now() - interval '1 hour', null, 1);
    insert into office_az_inventory_authority_private.capability_grants values
      ('10000000-0000-4000-8000-000000000001', 'inventory.quantity.read');
    insert into office_az_inventory_authority_private.location_grants values
      ('10000000-0000-4000-8000-000000000001', 'warehouse-a');
  `);

  const oneRpc = dockerPsql(`
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
    select public.resolve_office_az_inventory_authority('actor-1','operator-1')::text;
  `, "authenticated").split("\n").at(-1);
  assert(oneRpc.includes('"inventory.quantity.read"') && oneRpc.includes('"warehouse-a"'), "ONE_ASSIGNMENT_RPC_CONTRACT_FAILED");

  dockerPsql(`
    insert into office_az_inventory_authority_private.assignments(
      assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
      role, status, valid_from, valid_until, authority_version
    ) values
      ('10000000-0000-4000-8000-000000000002', 'human', '00000000-0000-4000-8000-000000000001',
       'actor-1', 'operator-1', 'office_az_warehouse_manager', 'suspended', now() - interval '1 hour', null, 2);
    insert into office_az_inventory_authority_private.capability_grants values
      ('10000000-0000-4000-8000-000000000002', 'inventory.audit.read');
    insert into office_az_inventory_authority_private.location_grants values
      ('10000000-0000-4000-8000-000000000002', 'warehouse-b');
  `);
  const multipleCount = dockerPsql(`
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
    select jsonb_array_length(public.resolve_office_az_inventory_authority('actor-1','operator-1')->'candidates');
  `, "authenticated").split("\n").at(-1);
  assert(multipleCount === "2", "MULTIPLE_ASSIGNMENTS_COLLAPSED");

  const wrongIdentityCount = dockerPsql(`
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', false);
    select jsonb_array_length(public.resolve_office_az_inventory_authority('actor-1','operator-1')->'candidates');
  `, "authenticated").split("\n").at(-1);
  assert(wrongIdentityCount === "0", "AUTH_UID_BINDING_FAILED");

  dockerPsql(`
    delete from office_az_inventory_authority_private.capability_grants
      where assignment_id = '10000000-0000-4000-8000-000000000001';
    delete from office_az_inventory_authority_private.location_grants
      where assignment_id = '10000000-0000-4000-8000-000000000001';
  `);
  const revokedRpc = dockerPsql(`
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
    select public.resolve_office_az_inventory_authority('actor-1','operator-1')::text;
  `, "authenticated").split("\n").at(-1);
  assert(revokedRpc.includes('"capabilities": []') && revokedRpc.includes('"allowedLocationIds": []'), "GRANT_REVOCATION_NOT_REFLECTED");

  dockerPsql(`
    do $$ begin
      begin
        insert into office_az_inventory_authority_private.assignments(
          assignment_id, owner, principal_kind, authenticated_user_id, actor_id, operator_id,
          role, status, valid_from, authority_version
        ) values (
          '10000000-0000-4000-8000-000000000099', 'ATTRACTION', 'human',
          '00000000-0000-4000-8000-000000000001', 'actor-x', 'operator-x',
          'unknown-role', 'active', now(), 1
        );
        raise exception 'hostile closed-set row accepted';
      exception when check_violation then null;
      end;
      begin
        insert into office_az_inventory_authority_private.assignments(
          assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
          role, status, valid_from, authority_version
        ) values (
          '10000000-0000-4000-8000-000000000098', 'human',
          '00000000-0000-4000-8000-000000000001', 'actor-x', 'operator-x',
          'unknown-role', 'active', now(), 1
        );
        raise exception 'unknown role accepted';
      exception when check_violation then null;
      end;
      begin
        insert into office_az_inventory_authority_private.capability_grants
          values ('10000000-0000-4000-8000-000000000001', 'inventory.unknown');
        raise exception 'unknown capability accepted';
      exception when check_violation then null;
      end;
    end $$;
  `);

  dockerPsql(`
    delete from office_az_inventory_authority_private.location_grants;
    delete from office_az_inventory_authority_private.capability_grants;
    delete from office_az_inventory_authority_private.assignments;
    delete from office_az_inventory_authority_private.locations;
  `);
  assert(dockerPsql(`select (select count(*) from office_az_inventory_authority_private.assignments) + (select count(*) from office_az_inventory_authority_private.locations);`) === "0", "FIXTURE_CLEANUP_FAILED");

  validation = {
    migration_apply_once: "PASS",
    fresh_zero_assignment: "PASS",
    unauthenticated_and_direct_acl_denial: "PASS",
    zero_one_multiple_assignment_preserved: "PASS",
    auth_uid_binding: "PASS",
    grant_revoke_reflected: "PASS",
    closed_sets_fail_closed: "PASS",
    rls_force_rls_no_open_policies: "PASS",
    service_role_raw_table_access_denied: "PASS",
    fixture_cleanup: "PASS",
  };
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
const cleanupPass = cleanupError === null
  && remaining.containers.length === 0
  && remaining.volumes.length === 0
  && !tempDirectoryPresent;
const passed = mainError === null && cleanupPass;

emit({
  marker: "INV001_P19_STUDIO_D4A_B2_DISPOSABLE_DB_VALIDATION_RESULT_V1",
  status: passed ? "PASS" : "BLOCKED_OR_FAILED",
  base_commit: EXPECTED_BASE,
  base_tree: EXPECTED_TREE,
  migration_path: MIGRATION_PATH,
  migration_sha256: MIGRATION_SHA256,
  postgres_image_tag: IMAGE_TAG,
  resolved_postgres_image_digest: resolvedImageDigest || null,
  runtime: {
    github_actions: true,
    runner_os: "Linux",
    dedicated_container: true,
    dedicated_volume: true,
    loopback_ephemeral_port: true,
    existing_database_url_used: false,
  },
  validation,
  cleanup: {
    status: cleanupPass ? "PASS" : "FAIL",
    container_residue_count: remaining.containers.length,
    volume_residue_count: remaining.volumes.length,
    temporary_directory_present: tempDirectoryPresent,
    error: cleanupError,
  },
  failure: mainError,
  secrets_emitted: false,
});

process.exit(passed ? 0 : 1);
