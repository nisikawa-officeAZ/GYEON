// INV001 D6 disposable security proof orchestrator.
//
// Runs once on a GitHub-hosted runner against a disposable, loopback-only local
// Supabase stack (db, auth, rest, kong) started by the pinned official CLI.
// Two output channels:
//   S: raw child stdout/stderr and HTTP bodies. Bounded memory only, never
//      written to a file or the job log, zeroed after the registry
//      completeness check.
//   P: evidence built from fixed typed fields only, emitted to stdout only
//      after the exact-value and pattern scan is clean.

import { spawn } from "node:child_process";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRaces } from "./concurrency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const EVIDENCE_MARKER = "INV001_P19_D6_DISPOSABLE_SECURITY_PROOF_EVIDENCE_V1";
const CLEANUP_MARKER = "INV001_P19_D6_CLEANUP_RESIDUE_V1";
const ACK = "I_ACKNOWLEDGE_DISPOSABLE_LOOPBACK_SUPABASE_STACK_ONLY";
const EXPECTED_BASE = "b440efea8e023c917d78171804c2a1edfd163647";
const EXPECTED_TREE = "a5591ea3961432a58380261986ae48ca0b7714ee";
const CLI_VERSION = "2.118.0";
const CLI_TARBALL = "supabase_2.118.0_linux_amd64.tar.gz";
const CLI_TARBALL_SHA256 = "f6089a86fb9d9221c958193a277338daddd6822f706929943812fa32e106c86d";
const LABEL_KEY = "inv001.d6";
const CLI_PROJECT_LABEL = "com.supabase.cli.project";
const SYNTHETIC_OWNER = "inv001_d6_synthetic_owner";
// The CLI's fixed, public local-only database default; excluded from the exact scan.
const LOCAL_DB_DEFAULT_CREDENTIAL = "postgres";
const START_EXCLUDE = [
  "realtime", "storage-api", "imgproxy", "mailpit", "postgres-meta",
  "studio", "edge-runtime", "logflare", "vector", "supavisor",
];
const EXPECTED_SERVICES = ["auth", "db", "kong", "rest"];
const MIGRATIONS = [
  {
    path: "supabase/migrations/20260920093931_office_az_operator_authority.sql",
    version: "20260920093931",
    sha256: "2a880998de445c347b53dc8578bd5bfba0e1f66c22816722eef3ae1abf6ac767",
  },
  {
    path: "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql",
    version: "20260924132149",
    sha256: "1377e6847bbc261b1289fc0856c11c5feb9d270520c1fb4f26c294a4e33bc6ca",
  },
  {
    // D6-B F1/F1b forward fix: human-only resolver, knownLocationIds gated.
    path: "supabase/migrations/20260927143257_office_az_inventory_authority_resolver_human_only.sql",
    version: "20260927143257",
    sha256: "a899159f96e95a0708721633a3a419260f8d78ebc3314725acff7b56061eb687",
  },
];
// Presence-only check; values are never read.
const FORBIDDEN_ENV = [
  "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY",
  "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_REF",
  "SUPABASE_HOME", "SUPABASE_EXPERIMENTAL_STACK",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "INV001_FOUNDATION_DISPOSABLE_DATABASE_URL",
  "R1B_DB_URL", "R1B_API_URL", "R1B_ANON_KEY", "R1B_SERVICE_ROLE_KEY",
  "C5C_DB_URL", "C5D_DB_URL", "R12F_DB_URL",
];
const PRIVATE_SCHEMAS = ["office_az_inventory_authority_private", "office_az_inventory_mobile_private"];
const PRIVATE_TABLES = [
  "office_az_inventory_authority_private.locations",
  "office_az_inventory_authority_private.assignments",
  "office_az_inventory_authority_private.capability_grants",
  "office_az_inventory_authority_private.location_grants",
  "office_az_inventory_mobile_private.managed_devices",
  "office_az_inventory_mobile_private.enrollment_codes",
  "office_az_inventory_mobile_private.sessions",
  "office_az_inventory_mobile_private.audit_events",
];
const RESOLVER_SIGNATURE = "public.resolve_office_az_inventory_authority(text,text)";
const AUTHORITY_BOUND_SIGNATURE =
  "office_az_inventory_mobile_private.current_authority_bound(text,text,text,bigint,text)";
const MOBILE_RPC_SIGNATURES = [
  "public.office_az_inventory_mobile_register(text,text,text,bigint,text,text)",
  "public.office_az_inventory_mobile_revoke_device(text,text,text,bigint,text)",
  "public.office_az_inventory_mobile_issue(text,text,text,bigint,text,text,text)",
  "public.office_az_inventory_mobile_refresh(text,text,text,bigint,text,text,bigint,text)",
  "public.office_az_inventory_mobile_revoke(text,text,text,bigint,text)",
];
const DEFINER_FUNCTIONS = [RESOLVER_SIGNATURE, AUTHORITY_BOUND_SIGNATURE, ...MOBILE_RPC_SIGNATURES];
const CLIENT_ROLES = ["anon", "authenticated", "service_role"];
const SNAPSHOT_ROLES = ["postgres", "supabase_admin", "authenticator", "anon", "authenticated", "service_role"];
const ASSERTION_IDS = Array.from({ length: 24 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`);
const ONE_MIB = 1024 * 1024;
const START_LIMIT = 16 * ONE_MIB;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SECRET_FIELD_NAME = /token|secret|password|apikey|api_key|jwt|credential/iu;
const KNOWN_SECRET_FIELDS = new Set([
  "access_token", "refresh_token", "provider_token", "provider_refresh_token", "id_token",
]);
const KNOWN_NON_SECRET_FIELDS = new Set(["token_type", "expires_in", "expires_at", "weak_password"]);
const SECRET_STOP_CODES = new Set([
  "SECRET_CHANNEL_OVERFLOW", "SECRET_CHANNEL_PARSE_FAILED", "SECRET_REGISTRY_INCOMPLETE",
]);

export const P_PATTERNS = [
  ["jwt", /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/gu],
  ["sb_publishable", /sb_publishable_/giu],
  ["sb_secret", /sb_secret_/giu],
  ["bearer", /Bearer /giu],
  ["authorization_header", /Authorization:/giu],
  ["apikey", /apikey/giu],
  ["refresh_token", /refresh_token/giu],
  ["access_token", /access_token/giu],
  ["password", /password/giu],
];

const CANDIDATE_RULES = [
  ["jwt", /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/gu, 0],
  ["sb_key", /sb_(?:publishable|secret)_[A-Za-z0-9_-]+/gu, 0],
  ["bearer_value", /Bearer\s+([A-Za-z0-9._~+/=-]{16,})/giu, 1],
  ["apikey_value", /apikey["']?\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{16,})/giu, 1],
  ["token_field", /"(?:access_token|refresh_token|provider_token|provider_refresh_token|id_token)"\s*:\s*"([^"]+)"/gu, 1],
  ["token_field", /\b(?:access_token|refresh_token)=([^&\s"']+)/gu, 1],
];

// Each identity observation key maps to the exact code the unmodified
// resolver path must produce; the first three characters name the assertion.
export const IDENTITY_EXPECTATIONS = {
  A04_cookie_authorized: "authorized",
  A05_no_cookie: "UNAUTHENTICATED",
  A05_tampered_cookie: "UNAUTHENTICATED",
  A05_signout_cookies_removed: "removed",
  A05_after_signout: "UNAUTHENTICATED",
  A06_cross_user: "ZERO_ASSIGNMENT",
  A07_bearer_identity: "authenticated_same_uid",
  A07_bearer_authority: "authorized",
  A07_malformed_absent: "UNAUTHENTICATED",
  A07_malformed_lowercase_scheme: "UNAUTHENTICATED",
  A07_malformed_double_space: "UNAUTHENTICATED",
  A07_malformed_comma_joined: "UNAUTHENTICATED",
  A07_malformed_basic_scheme: "UNAUTHENTICATED",
  A07_invalid_signature: "UNAUTHENTICATED",
  A07_foreign_user: "AUTHENTICATED_USER_MISMATCH",
  A08_lifecycle_active: "authorized",
  A08_suspended: "INACTIVE_OPERATOR",
  A08_revoked: "INACTIVE_OPERATOR",
  A08_expired: "EXPIRED",
  A08_not_yet_valid: "NOT_YET_VALID",
  A08_stale_version: "STALE_AUTHORITY_VERSION",
  A08_grant_active: "authorized",
  A08_grant_deleted: "CAPABILITY_NOT_GRANTED",
  A13_self_action: "SELF_ACTION_PROHIBITED",
  A14_location_not_granted: "LOCATION_NOT_GRANTED",
  A14_unknown_location: "UNKNOWN_LOCATION",
  A15_service_candidate: "ZERO_ASSIGNMENT",
};

let secretStop = null;

export class HarnessStop extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.code = code;
    this.detail = detail;
    if (SECRET_STOP_CODES.has(code) && secretStop === null) secretStop = this;
  }
}

class AssertionFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function encodedForms(value) {
  const bytes = Buffer.from(value, "utf8");
  return new Set([
    value,
    bytes.toString("base64"),
    bytes.toString("base64url"),
    encodeURIComponent(value),
    `base64-${bytes.toString("base64url")}`,
  ]);
}

export class SecretRegistry {
  #values = new Set();
  #forms = new Set();
  sources = { stack_status_env: 0, harness_generated: 0, child_ipc: 0, auth_http_response: 0 };

  register(value, source, minLength = 12) {
    if (typeof value !== "string" || !Object.hasOwn(this.sources, source)) {
      throw new HarnessStop("SECRET_CHANNEL_PARSE_FAILED", { field_class: "registration_type" });
    }
    if (value.length < minLength) throw new HarnessStop("SECRET_VALUE_TOO_SHORT");
    if (this.#values.has(value)) return;
    this.#values.add(value);
    this.sources[source] += 1;
    for (const form of encodedForms(value)) this.#forms.add(form);
  }

  covers(candidate) {
    if (this.#forms.has(candidate)) return true;
    try {
      return this.#forms.has(decodeURIComponent(candidate));
    } catch {
      return false;
    }
  }

  get size() {
    return this.#values.size;
  }

  values() {
    return [...this.#values];
  }
}

export function extractSecretCandidates(text) {
  const candidates = [];
  for (const [kind, pattern, group] of CANDIDATE_RULES) {
    for (const match of text.matchAll(pattern)) {
      if (match[group]) candidates.push([kind, match[group]]);
    }
  }
  return candidates;
}

export function scanPublishable(text, registryValues) {
  let exactHits = 0;
  const kinds = new Set();
  for (const value of registryValues) {
    for (const form of encodedForms(value)) {
      if (form.length > 0 && text.includes(form)) {
        exactHits += 1;
        kinds.add("registered_value");
        break;
      }
    }
  }
  let patternHits = 0;
  for (const [kind, pattern] of P_PATTERNS) {
    const count = (text.match(pattern) ?? []).length;
    if (count > 0) {
      patternHits += count;
      kinds.add(kind);
    }
  }
  return { exact_hits: exactHits, pattern_hits: patternHits, kinds: [...kinds].sort() };
}

export function serializeEvidence(evidence) {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

export function buildEvidence(state) {
  return {
    marker: EVIDENCE_MARKER,
    status: state.passed ? "PASS" : "BLOCKED_OR_FAILED",
    validation_status: state.validationPass ? "PASS" : "FAIL",
    cleanup_status: state.cleanupPass ? "PASS" : "FAIL",
    secret_scan_status: state.secretPass ? "PASS" : "FAIL",
    base_commit: EXPECTED_BASE,
    base_tree: EXPECTED_TREE,
    cli: {
      version: CLI_VERSION,
      tarball: CLI_TARBALL,
      tarball_sha256: CLI_TARBALL_SHA256,
      tarball_sha256_verified: state.cliVerified,
      help_flags_confirmed: state.cliHelpConfirmed,
      backend: "LEGACY_DOCKER_SUBPROCESS",
      telemetry_disabled: true,
    },
    stack: {
      label: "LOCAL_SUPABASE_IMAGE_ONLY_NOT_HOSTED",
      postgres_major_config: 17,
      running_services: state.runningServices,
    },
    network: {
      host_binding_ipv4: state.hostBinding,
      established_before_start: state.networkBeforeStart,
      loopback_gate_before_tests: state.loopbackGate,
    },
    published_ports: state.publishedPorts,
    images: state.images,
    migrations: MIGRATIONS.map(({ path, sha256 }) => ({ path, sha256 })),
    intervening_migrations_applied: false,
    ownership: {
      mode: "LOCAL_SUPABASE_SYNTHETIC_HOSTED_LIKE_OWNER_ONLY",
      hosted_ownership: "UNPROVEN_UNTIL_O3",
      original: state.originalOwnership,
      synthetic: state.syntheticOwnership,
      schema_owner_reassigned: state.schemaOwnerReassigned,
      auth_prereq_grants_applied: state.authPrereqGrantsApplied,
      acl_invariant: state.aclInvariant,
      acl_entry_count: state.aclEntryCount,
      acl_set_sha256: state.aclSetSha256,
    },
    identity_labels: state.identityLabels,
    synthetic_fixtures_only: true,
    synthetic_user_count: state.syntheticUserCount,
    assertions: state.assertions,
    assertion_failures: state.assertionFailures,
    identity_observations: state.identityObservations,
    http_denials: state.httpDenials,
    races: state.races,
    characterizations: state.characterizations,
    findings: state.findings,
    cleanup: state.cleanup,
    secret_scan: {
      pipeline: "TWO_CHANNEL_S_MEMORY_ONLY_P_PUBLISHABLE",
      registry_size: state.registrySize,
      registry_sources: state.registrySources,
      s_buffers_checked: state.sBuffersChecked,
      unregistered_pattern_matches: state.unregisteredMatches,
      publishable_bytes_scanned: state.publishableBytes,
      exact_hits: state.exactHits,
      pattern_hits: state.patternHits,
      excluded_public_constants: ["local_db_default_credential"],
      s_file_sinks: 0,
      artifact_or_cache_upload: false,
    },
    failure: state.failure,
    secrets_emitted: false,
  };
}

export function buildSampleEvidence() {
  const assertions = Object.fromEntries(ASSERTION_IDS.map((id) => [id, "PASS"]));
  return buildEvidence({
    passed: true,
    validationPass: true,
    cleanupPass: true,
    secretPass: true,
    cliVerified: true,
    cliHelpConfirmed: true,
    runningServices: [...EXPECTED_SERVICES],
    hostBinding: "127.0.0.1",
    networkBeforeStart: true,
    loopbackGate: true,
    publishedPorts: [
      { service: "kong", container_port: "8000/tcp", host_ip: "127.0.0.1", port: 34321 },
      { service: "db", container_port: "5432/tcp", host_ip: "127.0.0.1", port: 34322 },
    ],
    images: EXPECTED_SERVICES.map((service) => ({
      service,
      image_id: `sha256:${"0".repeat(64)}`,
      digest: `public.ecr.aws/supabase/${service}@sha256:${"1".repeat(64)}`,
    })),
    originalOwnership: {
      roles: SNAPSHOT_ROLES.map((role) => ({ role, rolsuper: false, rolbypassrls: false, rolcanlogin: false })),
      owners: Object.fromEntries([...PRIVATE_TABLES, ...PRIVATE_SCHEMAS, ...DEFINER_FUNCTIONS].map((name) => [name, "postgres"])),
    },
    syntheticOwnership: {
      role: SYNTHETIC_OWNER,
      role_attrs: { rolsuper: false, rolbypassrls: true, rolcanlogin: false },
      owned_object_count: 17,
    },
    schemaOwnerReassigned: true,
    authPrereqGrantsApplied: false,
    aclInvariant: true,
    aclEntryCount: 12,
    aclSetSha256: "2".repeat(64),
    identityLabels: ["SSR_LIBRARY_COOKIE_PATH_PROVEN"],
    syntheticUserCount: 3,
    assertions,
    assertionFailures: [],
    identityObservations: { ...IDENTITY_EXPECTATIONS },
    httpDenials: {
      authenticated_private_read_status: 406,
      service_private_read_status: 406,
      anon_resolver_status: 401,
      anon_mobile_rpc_status: 401,
      service_mobile_rpc_status: 403,
      service_resolver_status: 403,
      authenticated_private_insert_status: 406,
      service_private_update_status: 406,
      authenticated_resolver_positive_control_status: 200,
    },
    races: ["C1", "C2", "C3", "C4", "C5"].map((id) => ({
      id,
      pids: [101, 102],
      observer_confirmed: true,
      outcome: "invalid_or_stale",
      cardinality: { sessions_added: 0 },
      pass: true,
    })),
    characterizations: {
      C6: {
        resolver_blocked_by_open_revoke: false,
        status_during_open_revoke: "active",
        status_after_commit: "revoked",
        note: "D4_AUTHORITY_IS_SNAPSHOT_AT_READ_FUTURE_WRITE_PATHS_MUST_RECHECK_AT_WRITE",
      },
      C7: { original_owner_functional: true, resolver_candidate_count: 1, register_status: "accepted" },
    },
    findings: [
      {
        id: "F1",
        classification: "INFORMATION_DISCLOSURE_WITHOUT_AUTHORITY_GRANT",
        service_candidate_returned_to_other_user: false,
        core_result: "ZERO_ASSIGNMENT",
        disposition: "FIXED_BY_FORWARD_MIGRATION_20260927143257",
      },
      {
        id: "F1b",
        classification: "LOCATION_LIST_DISCLOSURE_WITHOUT_MATCHING_HUMAN_ASSIGNMENT",
        known_location_ids_returned_without_human_candidate: false,
        human_positive_control: "object:2:1:human:wh-a,wh-b",
        disposition: "FIXED_BY_FORWARD_MIGRATION_20260927143257",
      },
    ],
    cleanup: {
      containers: 0, volumes: 0, networks: 0, processes: 0, listeners: 0,
      temp_present: false, out_dir_present: false, npmrc_present: false, error: null,
    },
    registrySize: 40,
    registrySources: { stack_status_env: 12, harness_generated: 20, child_ipc: 6, auth_http_response: 2 },
    sBuffersChecked: 300,
    unregisteredMatches: 0,
    publishableBytes: 9000,
    exactHits: 0,
    patternHits: 0,
    failure: null,
  });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function lit(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new HarnessStop("NON_SAFE_INTEGER_LITERAL");
    return String(value);
  }
  if (value === null) return "null";
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]*$/u.test(value)) throw new HarnessStop("UNSAFE_SQL_LITERAL");
  return `'${value}'`;
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
    socket.once("error", (error) => finish(Boolean(error) && error.code === "ECONNREFUSED"));
  });
}

function passThroughEnv() {
  const env = { LANG: "C.UTF-8", NO_COLOR: "1" };
  for (const name of ["PATH", "HOME", "DOCKER_HOST", "DOCKER_CONFIG", "DOCKER_CERT_PATH", "DOCKER_TLS_VERIFY"]) {
    if (Object.hasOwn(process.env, name)) env[name] = process.env[name];
  }
  return env;
}

async function main() {
  const cleanupOnly = process.argv.includes("--cleanup-residue");
  const label = process.env.INV001_D6_RESOURCE_LABEL ?? "";
  if (!/^[0-9]+-[0-9]+$/u.test(label)) {
    process.stderr.write("INVALID_RESOURCE_LABEL\n");
    process.exit(1);
  }
  const runnerTemp = process.env.RUNNER_TEMP ?? "";
  if (runnerTemp === "" || !existsSync(runnerTemp)) {
    process.stderr.write("RUNNER_TEMP_REQUIRED\n");
    process.exit(1);
  }
  const projectId = `inv001-d6-${label}`;
  const networkName = projectId;
  const runRoot = join(runnerTemp, `inv001-d6-${label}`);
  const outDir = join(runRoot, "out");
  const npmrcPath = join(runnerTemp, "inv001-d6-npmrc");
  const cliDir = join(runnerTemp, "inv001-d6-cli");

  const registry = new SecretRegistry();
  const sStats = { checked: 0, unregistered: 0 };
  const trackedChildren = new Set();
  const heldBuffers = [];

  function checkAndZero(buffers, step) {
    try {
      const text = buffers.map((buffer) => buffer.toString("utf8")).join("\n");
      const unmatched = new Map();
      for (const [kind, value] of extractSecretCandidates(text)) {
        if (!registry.covers(value)) unmatched.set(kind, (unmatched.get(kind) ?? 0) + 1);
      }
      sStats.checked += 1;
      if (unmatched.size > 0) {
        const count = [...unmatched.values()].reduce((sum, value) => sum + value, 0);
        sStats.unregistered += count;
        throw new HarnessStop("SECRET_REGISTRY_INCOMPLETE", { step, kinds: [...unmatched.keys()].sort(), count });
      }
    } finally {
      for (const buffer of buffers) buffer.fill(0);
    }
  }

  function captureS(step, command, args, options = {}) {
    const limit = options.limit ?? ONE_MIB;
    return new Promise((resolvePromise) => {
      const out = [];
      const err = [];
      let total = 0;
      let overflow = false;
      let timedOut = false;
      let settled = false;
      let child;
      const settle = (exitCode, spawnFailed) => {
        if (settled) return;
        settled = true;
        const stdout = Buffer.concat(out);
        const stderr = Buffer.concat(err);
        for (const chunk of [...out, ...err]) chunk.fill(0);
        resolvePromise({ step, exitCode, timedOut, overflow, spawnFailed, sBytes: total, stdout, stderr });
      };
      try {
        child = spawn(command, args, {
          stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
          env: options.env ?? passThroughEnv(),
          cwd: options.cwd,
        });
      } catch {
        settle(null, true);
        return;
      }
      trackedChildren.add(child);
      const collect = (sink) => (chunk) => {
        if (overflow) {
          chunk.fill(0);
          return;
        }
        total += chunk.length;
        if (total > limit) {
          overflow = true;
          chunk.fill(0);
          child.kill("SIGKILL");
          return;
        }
        sink.push(chunk);
      };
      child.stdout.on("data", collect(out));
      child.stderr.on("data", collect(err));
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs ?? 120_000);
      child.once("error", () => {
        clearTimeout(timer);
        settle(null, true);
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        settle(code, false);
      });
      if (options.input !== undefined) {
        child.stdin.on("error", () => {});
        child.stdin.end(options.input);
      }
    });
  }

  async function sRun(step, command, args, options = {}) {
    const s = await captureS(step, command, args, options);
    let parsed;
    let parseError = null;
    try {
      if (s.overflow) throw new HarnessStop("SECRET_CHANNEL_OVERFLOW", { step, s_bytes: s.sBytes });
      if (s.spawnFailed) throw new HarnessStop("CHILD_SPAWN_FAILED", { step });
      if (s.timedOut) throw new HarnessStop("CHILD_TIMEOUT", { step, s_bytes: s.sBytes });
      if (!options.allowFailure && s.exitCode !== 0) {
        throw new HarnessStop(options.failCode ?? "CHILD_FAILED", { step, exit_code: s.exitCode, s_bytes: s.sBytes });
      }
      const stdoutText = s.stdout.toString("utf8");
      const stderrText = s.stderr.toString("utf8");
      parsed = options.parse ? options.parse(stdoutText, stderrText, s.exitCode) : stdoutText.trim();
    } catch (error) {
      parseError = error;
    }
    if (options.hold) heldBuffers.push(s);
    else checkAndZero([s.stdout, s.stderr], step);
    if (parseError) throw parseError;
    return parsed;
  }

  function releaseHeld() {
    while (heldBuffers.length > 0) {
      const s = heldBuffers.shift();
      checkAndZero([s.stdout, s.stderr], s.step);
    }
  }

  const docker = (args, step, options = {}) => sRun(step, "docker", args, options);
  const lines = (text) => text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

  // Residue sweep shared by the in-process finally and the workflow's always() step.
  async function sweepAndProve(knownPorts) {
    const errors = [];
    const swallow = async (fn) => {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof HarnessStop && SECRET_STOP_CODES.has(error.code)) throw error;
        errors.push(error instanceof HarnessStop ? error.code : "CLEANUP_STEP_FAILED");
        return "";
      }
    };
    const containerIds = async () => {
      const byLabel = lines(await docker(["ps", "-aq", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`], "cleanup_list_containers"));
      const byName = lines(await docker(["ps", "-a", "--format", "{{.ID}} {{.Names}}"], "cleanup_list_containers"))
        .map((line) => line.split(" "))
        .filter(([, name]) => name !== undefined && name.endsWith(`_${projectId}`))
        .map(([id]) => id);
      return [...new Set([...byLabel, ...byName])];
    };
    const volumeNames = async () => {
      const byLabel = lines(await docker(["volume", "ls", "-q", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`], "cleanup_list_volumes"));
      const byName = lines(await docker(["volume", "ls", "-q"], "cleanup_list_volumes")).filter((name) => name.endsWith(`_${projectId}`));
      return [...new Set([...byLabel, ...byName])];
    };
    const networkIds = async () => {
      const all = lines(await docker(["network", "ls", "--format", "{{.ID}} {{.Name}}"], "cleanup_list_networks"))
        .map((line) => line.split(" "));
      const byName = all.filter(([, name]) => name === networkName || (name ?? "").endsWith(`_${projectId}`)).map(([id]) => id);
      const byLabel = lines(await docker(["network", "ls", "-q", "--filter", `label=${LABEL_KEY}=${label}`], "cleanup_list_networks"));
      const byProject = lines(await docker(["network", "ls", "-q", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`], "cleanup_list_networks"));
      return [...new Set([...byName, ...byLabel, ...byProject])];
    };

    const containers = await swallow(containerIds);
    if (Array.isArray(containers) && containers.length > 0) {
      await swallow(() => docker(["rm", "-f", "--volumes", ...containers], "cleanup_remove_containers"));
    }
    const volumes = await swallow(volumeNames);
    if (Array.isArray(volumes) && volumes.length > 0) {
      await swallow(() => docker(["volume", "rm", "-f", ...volumes], "cleanup_remove_volumes"));
    }
    const networks = await swallow(networkIds);
    if (Array.isArray(networks) && networks.length > 0) {
      await swallow(() => docker(["network", "rm", ...networks], "cleanup_remove_networks"));
    }
    for (const child of trackedChildren) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    await sleep(500);
    try {
      rmSync(runRoot, { recursive: true, force: true });
    } catch {
      errors.push("TEMP_REMOVE_FAILED");
    }

    const countOf = async (fn) => {
      const result = await swallow(fn);
      return Array.isArray(result) ? result.length : -1;
    };
    const aliveProcesses = [...trackedChildren].filter((child) => child.pid !== undefined && child.exitCode === null && child.signalCode === null).length;
    let openListeners = 0;
    for (const port of knownPorts) {
      if (!(await loopbackPortClosed(port))) openListeners += 1;
    }
    return {
      containers: await countOf(containerIds),
      volumes: await countOf(volumeNames),
      networks: await countOf(networkIds),
      processes: aliveProcesses,
      listeners: openListeners,
      temp_present: existsSync(runRoot),
      out_dir_present: existsSync(outDir),
      npmrc_present: existsSync(npmrcPath),
      error: errors.length === 0 ? null : errors[0],
    };
  }

  const cleanupClean = (c) => c.containers === 0 && c.volumes === 0 && c.networks === 0
    && c.processes === 0 && c.listeners === 0 && !c.temp_present && !c.out_dir_present
    && !c.npmrc_present && c.error === null;

  function emitSecretStop() {
    const detail = secretStop.detail ?? {};
    const kinds = Array.isArray(detail.kinds) ? detail.kinds : [];
    const count = Number.isSafeInteger(detail.count) ? detail.count : 0;
    process.stderr.write(`${secretStop.code} kinds=[${kinds.join(",")}] count=${count}\n`);
  }

  if (cleanupOnly) {
    let cleanup;
    try {
      cleanup = await sweepAndProve([]);
    } catch (error) {
      if (secretStop !== null) {
        emitSecretStop();
        process.exit(1);
      }
      process.stderr.write(`${error instanceof HarnessStop ? error.code : "CLEANUP_RESIDUE_FAILED"}\n`);
      process.exit(1);
    }
    const clean = cleanup.containers === 0 && cleanup.volumes === 0 && cleanup.networks === 0
      && cleanup.processes === 0 && !cleanup.temp_present && cleanup.error === null;
    const text = serializeEvidence({
      marker: CLEANUP_MARKER,
      cleanup: clean ? "PASS" : "FAIL",
      containers: cleanup.containers,
      volumes: cleanup.volumes,
      networks: cleanup.networks,
      processes: cleanup.processes,
      temp_present: cleanup.temp_present,
      error: cleanup.error,
      secrets_emitted: false,
    });
    const scan = scanPublishable(text, registry.values());
    if (scan.exact_hits + scan.pattern_hits > 0) {
      process.stderr.write(`SECRET_SCAN_HIT kinds=[${scan.kinds.join(",")}] count=${scan.exact_hits + scan.pattern_hits}\n`);
      process.exit(1);
    }
    process.stdout.write(text);
    process.exit(clean ? 0 : 1);
  }

  const assertions = Object.fromEntries(ASSERTION_IDS.map((id) => [id, "NOT_RUN"]));
  const assertionFailures = [];
  const findings = [];
  const state = {
    cliVerified: false,
    cliHelpConfirmed: false,
    runningServices: [],
    hostBinding: null,
    networkBeforeStart: false,
    loopbackGate: false,
    publishedPorts: [],
    images: [],
    originalOwnership: { roles: [], owners: {} },
    syntheticOwnership: { role: SYNTHETIC_OWNER, role_attrs: null, owned_object_count: 0 },
    schemaOwnerReassigned: false,
    authPrereqGrantsApplied: false,
    aclInvariant: false,
    aclEntryCount: 0,
    aclSetSha256: null,
    identityLabels: [],
    syntheticUserCount: 0,
    identityObservations: {},
    httpDenials: {},
    races: [],
    characterizations: { C6: null, C7: null },
  };
  let failure = null;

  function mark(id, ok, code) {
    if (ok) {
      if (assertions[id] === "NOT_RUN") assertions[id] = "PASS";
      return;
    }
    assertions[id] = "FAIL";
    if (!assertionFailures.some((entry) => entry.id === id && entry.code === code)) assertionFailures.push({ id, code });
  }

  function expect(condition, code) {
    if (!condition) throw new AssertionFailure(code);
  }

  async function assertion(id, body) {
    try {
      await body();
      mark(id, true, null);
    } catch (error) {
      if (error instanceof AssertionFailure) {
        mark(id, false, error.code);
        return;
      }
      assertions[id] = "FAIL";
      throw error;
    }
  }

  const stop = (code) => new HarnessStop(code);
  const portBase = 33000 + randomInt(0, 2400) * 10;
  const ports = {
    api: portBase,
    db: portBase + 1,
    shadow: portBase + 2,
    pooler: portBase + 3,
    studio: portBase + 4,
    smtpWeb: portBase + 5,
    inspector: portBase + 6,
    analytics: portBase + 7,
  };
  const plannedPorts = Object.values(ports);
  const workdir = join(runRoot, "work");
  const supabaseHome = join(runRoot, "home");
  const tempDir = join(runRoot, "tmp");
  const dbContainer = `supabase_db_${projectId}`;
  const repositoryRoot = process.cwd();
  let cliPath = null;
  let configWritten = false;
  const stack = new Map();

  const cliEnv = () => ({
    ...passThroughEnv(),
    SUPABASE_HOME: supabaseHome,
    SUPABASE_TELEMETRY_DISABLED: "1",
    SUPABASE_EXPERIMENTAL_STACK: "0",
    SUPABASE_NO_KEYRING: "1",
    DO_NOT_TRACK: "1",
    TMPDIR: tempDir,
    CI: "true",
  });
  const cli = (args, step, options = {}) => sRun(step, cliPath, args, { env: cliEnv(), ...options });
  const stackFlags = () => ["--workdir", workdir, "--network-id", networkName];

  const psqlArgs = () => [
    "exec", "-i", "-e", "PGPASSWORD", "-e", "PGAPPNAME", dbContainer,
    "psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet",
    "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres",
  ];
  const psqlEnv = (appName) => ({ ...passThroughEnv(), PGPASSWORD: LOCAL_DB_DEFAULT_CREDENTIAL, PGAPPNAME: appName });

  function sql(query, step, appName = "inv001-d6-admin") {
    return docker(psqlArgs(), step, { input: query, env: psqlEnv(appName) });
  }

  function expectDenied(query, step) {
    return docker(psqlArgs(), step, {
      input: query,
      env: psqlEnv("inv001-d6-deny"),
      allowFailure: true,
      parse: (_out, err, code) => code !== 0 && err.includes("permission denied"),
    });
  }

  function claimPrefix(uid) {
    if (!UUID_RE.test(uid)) throw stop("UNSAFE_CLAIM_UID");
    return [
      "set role authenticated;",
      `select set_config('request.jwt.claim.sub', '${uid}', false);`,
      `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`,
      "",
    ].join("\n");
  }

  async function clientSql(uid, body, step) {
    const out = await sql(`${claimPrefix(uid)}${body}`, step, "inv001-d6-client");
    return lines(out);
  }

  function tagged(outLines, tag) {
    const found = outLines.filter((line) => line.startsWith(tag));
    return found.length === 1 ? found[0].slice(tag.length) : null;
  }

  function rpcStatus(text) {
    if (text === null) return "NO_RESULT";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return "UNPARSEABLE_RESULT";
    }
    if (
      parsed === null || typeof parsed !== "object" || Object.keys(parsed).length !== 2
      || typeof parsed.ok !== "boolean"
      || !["accepted", "invalid_or_stale", "failed"].includes(parsed.status)
      || parsed.ok !== (parsed.status === "accepted")
    ) {
      return "RESULT_SHAPE_MISMATCH";
    }
    return parsed.status;
  }

  function harnessSecret(bytes = 32) {
    const value = randomBytes(bytes).toString("base64url");
    registry.register(value, "harness_generated");
    return value;
  }

  function rawHash() {
    return sha256(Buffer.from(harnessSecret(), "utf8"));
  }

  function authHeader(value) {
    const header = `Bearer ${value}`;
    registry.register(header, "harness_generated");
    return header;
  }

  function registerSecretFields(value, source) {
    if (Array.isArray(value)) {
      for (const item of value) registerSecretFields(item, source);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, inner] of Object.entries(value)) {
      if (KNOWN_SECRET_FIELDS.has(key)) {
        if (typeof inner === "string" && inner.length > 0) registry.register(inner, source, 8);
        else if (inner !== null && inner !== undefined && inner !== "") {
          throw new HarnessStop("SECRET_CHANNEL_PARSE_FAILED", { field_class: "known_secret_field_shape" });
        }
        continue;
      }
      if (SECRET_FIELD_NAME.test(key) && !KNOWN_NON_SECRET_FIELDS.has(key)
        && typeof inner === "string" && inner.length > 0) {
        throw new HarnessStop("SECRET_CHANNEL_PARSE_FAILED", { field_class: "unknown_secret_bearing_field" });
      }
      registerSecretFields(inner, source);
    }
  }

  async function httpS(step, method, path, { headers = {}, body } = {}) {
    let response;
    try {
      response = await fetch(`${stack.get("API_URL")}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new HarnessStop("HTTP_REQUEST_FAILED", { step });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > ONE_MIB) {
      const size = buffer.length;
      buffer.fill(0);
      throw new HarnessStop("SECRET_CHANNEL_OVERFLOW", { step, s_bytes: size });
    }
    let data = null;
    let parseError = null;
    try {
      const text = buffer.toString("utf8");
      if (text.length > 0) {
        try {
          data = JSON.parse(text);
        } catch {
          data = undefined;
        }
      }
      if (data !== undefined && data !== null) registerSecretFields(data, "auth_http_response");
    } catch (error) {
      parseError = error;
    }
    checkAndZero([buffer], step);
    if (parseError) throw parseError;
    return { status: response.status, data };
  }

  function parseStatusEnv(stdoutText) {
    const values = new Map();
    for (const line of stdoutText.split("\n")) {
      if (line.trim() === "") continue;
      const match = /^([A-Z][A-Z0-9_]*)=(?:"((?:[^"\\]|\\.)*)"|(-?[0-9]+))$/u.exec(line.trim());
      if (match === null) throw new HarnessStop("SECRET_CHANNEL_PARSE_FAILED", { field_class: "status_env_line" });
      const value = match[2] !== undefined
        ? match[2].replace(/\\(["\\nrt])/gu, (_m, ch) => ({ n: "\n", r: "\r", t: "\t" })[ch] ?? ch)
        : match[3];
      values.set(match[1], value);
    }
    for (const required of ["API_URL", "DB_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
      if (!values.has(required) || values.get(required) === "") {
        throw new HarnessStop("SECRET_CHANNEL_PARSE_FAILED", { field_class: "status_env_missing" });
      }
    }
    for (const value of values.values()) {
      if (value.length >= 12) registry.register(value, "stack_status_env");
    }
    return values;
  }

  function findCliBinary() {
    const binRoot = join(cliDir, "bin");
    const found = [];
    const walk = (dir, depth) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && depth < 2) walk(full, depth + 1);
        else if (entry.isFile() && entry.name === "supabase") found.push(full);
      }
    };
    if (existsSync(binRoot)) walk(binRoot, 0);
    if (found.length !== 1) throw stop("CLI_BINARY_NOT_FOUND");
    if ((statSync(found[0]).mode & 0o111) === 0) throw stop("CLI_BINARY_NOT_EXECUTABLE");
    return found[0];
  }

  const objectsCte = `with objs(kind, name, owner_oid, acl) as (
    select 'table', n.nspname || '.' || c.relname, c.relowner, coalesce(c.relacl, acldefault('r', c.relowner))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname || '.' || c.relname in (${PRIVATE_TABLES.map(lit).join(", ")})
    union all
    select 'schema', n.nspname, n.nspowner, coalesce(n.nspacl, acldefault('n', n.nspowner))
    from pg_namespace n where n.nspname in (${PRIVATE_SCHEMAS.map(lit).join(", ")})
    union all
    select 'function', p.oid::regprocedure::text, p.proowner, coalesce(p.proacl, acldefault('f', p.proowner))
    from pg_proc p where p.oid in (${DEFINER_FUNCTIONS.map((signature) => `'${signature}'::regprocedure`).join(", ")})
  )`;

  async function ownerSnapshot(step) {
    const out = await sql(`${objectsCte}
      select count(*) || '#' || string_agg(kind || '|' || name || '|' || pg_get_userbyid(owner_oid), E'\\n' order by kind, name) from objs;`, step);
    const separator = out.indexOf("#");
    const count = out.slice(0, separator);
    const rest = out.slice(separator + 1);
    if (separator < 0 || Number(count) !== 17) throw stop("INVENTORY_OBJECT_SET_MISMATCH");
    // Function signatures contain commas, so rows are newline-delimited.
    const owners = {};
    for (const entry of rest.split("\n")) {
      const fields = entry.split("|");
      if (fields.length !== 3 || fields[1] === "" || fields[2] === "") throw stop("INVENTORY_OBJECT_SET_MISMATCH");
      owners[fields[1]] = fields[2];
    }
    if (Object.keys(owners).length !== 17) throw stop("INVENTORY_OBJECT_SET_MISMATCH");
    return owners;
  }

  async function aclSet(step) {
    return sql(`${objectsCte}
      select coalesce(string_agg(entry, ',' order by entry), '') from (
        select kind || '|' || name || '|' || case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || '|' || a.privilege_type as entry
        from objs cross join lateral aclexplode(objs.acl) a
        where a.grantee <> objs.owner_oid
      ) as entries;`, step);
  }

  function openSession({ step, appName }) {
    let child;
    const out = [];
    const err = [];
    let total = 0;
    let overflow = false;
    const done = new Promise((resolvePromise) => {
      let settled = false;
      const settle = (code) => {
        if (settled) return;
        settled = true;
        const stdout = Buffer.concat(out);
        const stderr = Buffer.concat(err);
        for (const chunk of [...out, ...err]) chunk.fill(0);
        let resultLines = [];
        let exitCode = code;
        try {
          if (overflow) {
            void new HarnessStop("SECRET_CHANNEL_OVERFLOW", { step, s_bytes: total });
            exitCode = -1;
          }
          resultLines = lines(stdout.toString("utf8"));
          checkAndZero([stdout, stderr], step);
        } catch {
          exitCode = -1;
        }
        resolvePromise({ exitCode, lines: resultLines });
      };
      try {
        child = spawn("docker", psqlArgs(), { stdio: ["pipe", "pipe", "pipe"], env: psqlEnv(appName) });
      } catch {
        settle(null);
        return;
      }
      trackedChildren.add(child);
      const collect = (sink) => (chunk) => {
        if (overflow) {
          chunk.fill(0);
          return;
        }
        total += chunk.length;
        if (total > ONE_MIB) {
          overflow = true;
          chunk.fill(0);
          child.kill("SIGKILL");
          return;
        }
        sink.push(chunk);
      };
      child.stdout.on("data", collect(out));
      child.stderr.on("data", collect(err));
      child.stdin.on("error", () => {});
      child.once("error", () => settle(null));
      child.once("close", (code) => settle(code));
    });
    return {
      write: (text) => {
        if (child && child.stdin.writable) child.stdin.write(text);
      },
      end: () => {
        if (child && child.stdin.writable) child.stdin.end();
      },
      kill: () => {
        if (child) child.kill("SIGKILL");
      },
      done,
    };
  }

  const users = {};
  const ids = {};
  const assignment = {};
  const mobile = {};

  try {
    // Guards: fail closed before any Docker resource exists.
    if (process.env.INV001_D6_ACK !== ACK) throw stop("ACK_MISSING_OR_INVALID");
    if (
      process.env.GITHUB_ACTIONS !== "true"
      || process.env.RUNNER_OS !== "Linux"
      || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    ) {
      throw stop("GITHUB_HOSTED_LINUX_REQUIRED");
    }
    if (FORBIDDEN_ENV.some((name) => Object.hasOwn(process.env, name))) {
      throw stop("HOSTED_OR_SHARED_CONNECTION_ENV_PRESENT");
    }
    const migrationFiles = MIGRATIONS.map(({ path, sha256: expected }) => {
      const content = readFileSync(resolve(repositoryRoot, path));
      if (sha256(content) !== expected) throw stop("MIGRATION_SHA256_MISMATCH");
      return { path, content };
    });
    if (await sRun("git_parent", "git", ["rev-parse", "HEAD^"]) !== EXPECTED_BASE) throw stop("UNEXPECTED_PR_PARENT_COMMIT");
    if (await sRun("git_base_tree", "git", ["rev-parse", `${EXPECTED_BASE}^{tree}`]) !== EXPECTED_TREE) {
      throw stop("UNEXPECTED_BASE_TREE");
    }
    if (sha256(readFileSync(join(cliDir, CLI_TARBALL))) !== CLI_TARBALL_SHA256) throw stop("CLI_CHECKSUM_MISMATCH");
    state.cliVerified = true;
    cliPath = findCliBinary();
    if (existsSync(outDir)) throw stop("OUTPUT_DIRECTORY_PREEXISTS");

    // Pre-state: nothing labeled for this run exists and planned ports are free.
    const preContainers = lines(await docker(["ps", "-aq", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`], "prestate_containers"));
    const preVolumes = lines(await docker(["volume", "ls", "-q", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`], "prestate_volumes"));
    const preNetworks = lines(await docker(["network", "ls", "--format", "{{.Name}}"], "prestate_networks"))
      .filter((name) => name === networkName);
    const preLabeled = lines(await docker(["network", "ls", "-q", "--filter", `label=${LABEL_KEY}=${label}`], "prestate_networks"));
    if (preContainers.length + preVolumes.length + preNetworks.length + preLabeled.length > 0) {
      throw stop("PREEXISTING_LABELED_RESOURCES");
    }
    for (const port of plannedPorts) {
      if (!(await loopbackPortClosed(port))) throw stop("PLANNED_PORT_BUSY");
    }

    // Pinned CLI: identity and the exact flags this harness relies on.
    await cli(["--version"], "cli_version", {
      parse: (out, errText) => {
        if (!new RegExp(`(^|\\s|v)${CLI_VERSION.replaceAll(".", "\\.")}(\\s|$)`, "u").test(`${out}\n${errText}`)) {
          throw stop("CLI_VERSION_MISMATCH");
        }
      },
    });
    const helpText = async (args, step) => cli(args, step, { parse: (out, errText) => `${out}\n${errText}` });
    const rootHelp = await helpText(["--help"], "cli_help_root");
    const startHelp = await helpText(["start", "--help"], "cli_help_start");
    const statusHelp = await helpText(["status", "--help"], "cli_help_status");
    const stopHelp = await helpText(["stop", "--help"], "cli_help_stop");
    const listHelp = await helpText(["migration", "list", "--help"], "cli_help_migration_list");
    const globalHelp = `${rootHelp}\n${startHelp}`;
    const helpOk = globalHelp.includes("--workdir") && globalHelp.includes("--network-id")
      && startHelp.includes("--exclude") && START_EXCLUDE.every((key) => startHelp.includes(key))
      && statusHelp.includes("--output") && stopHelp.includes("--no-backup") && listHelp.includes("--local");
    if (!helpOk) throw stop("CLI_HELP_FLAGS_MISMATCH");
    state.cliHelpConfirmed = true;

    // Run-scoped workdir with exactly the pinned migrations.
    mkdirSync(join(workdir, "supabase", "migrations"), { recursive: true });
    mkdirSync(supabaseHome, { recursive: true });
    mkdirSync(tempDir, { recursive: true });
    let config = readFileSync(join(HERE, "config.toml"), "utf8");
    const replacements = {
      __INV001_D6_PROJECT_ID__: projectId,
      __INV001_D6_API_PORT__: String(ports.api),
      __INV001_D6_DB_PORT__: String(ports.db),
      __INV001_D6_SHADOW_PORT__: String(ports.shadow),
      __INV001_D6_POOLER_PORT__: String(ports.pooler),
      __INV001_D6_STUDIO_PORT__: String(ports.studio),
      __INV001_D6_SMTP_WEB_PORT__: String(ports.smtpWeb),
      __INV001_D6_INSPECTOR_PORT__: String(ports.inspector),
      __INV001_D6_ANALYTICS_PORT__: String(ports.analytics),
    };
    for (const [token, value] of Object.entries(replacements)) config = config.replaceAll(token, value);
    if (config.includes("__INV001_D6_")) throw stop("CONFIG_RENDER_INCOMPLETE");
    writeFileSync(join(workdir, "supabase", "config.toml"), config, { mode: 0o600 });
    configWritten = true;
    for (const { path } of migrationFiles) {
      copyFileSync(resolve(repositoryRoot, path), join(workdir, "supabase", "migrations", path.split("/").at(-1)));
    }
    if (readdirSync(join(workdir, "supabase", "migrations")).length !== MIGRATIONS.length) throw stop("TEMP_MIGRATION_SET_MISMATCH");

    // B1: loopback network before any container.
    await docker([
      "network", "create", "--driver", "bridge",
      "-o", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
      "--label", `${LABEL_KEY}=${label}`,
      networkName,
    ], "network_create");
    const networkOptions = await docker(["network", "inspect", networkName, "--format", "{{json .Options}}"], "network_inspect", {
      parse: (out) => JSON.parse(out.trim()),
    });
    state.hostBinding = networkOptions?.["com.docker.network.bridge.host_binding_ipv4"] ?? null;
    if (state.hostBinding !== "127.0.0.1") throw stop("LOOPBACK_NETWORK_NOT_ESTABLISHED");
    state.networkBeforeStart = true;

    // Start; the start buffer is held until status values are registered.
    let startFailure = null;
    try {
      await cli(["start", ...stackFlags(), "--exclude", START_EXCLUDE.join(",")], "cli_start", {
        limit: START_LIMIT,
        timeoutMs: 15 * 60_000,
        hold: true,
        failCode: "STACK_START_FAILED",
      });
    } catch (error) {
      startFailure = error;
    }
    const statusValues = await cli(["status", ...stackFlags(), "-o", "env"], "cli_status", {
      allowFailure: startFailure !== null,
      parse: (out, _err, code) => (code === 0 ? parseStatusEnv(out) : null),
    });
    releaseHeld();
    if (startFailure !== null) throw startFailure;
    for (const [key, value] of statusValues) stack.set(key, value);
    if (stack.get("API_URL") !== `http://127.0.0.1:${ports.api}`) throw stop("API_URL_NOT_LOOPBACK");
    if (!stack.get("DB_URL").includes(`@127.0.0.1:${ports.db}/`)) throw stop("DB_URL_NOT_LOOPBACK");

    // A01 loopback gate before any identity, HTTP, or SQL test.
    await assertion("A01", async () => {
      const running = lines(await docker(["ps", "--filter", `label=${CLI_PROJECT_LABEL}=${projectId}`, "--format", "{{.Names}}"], "a01_running")).sort();
      const expectedNames = EXPECTED_SERVICES.map((service) => `supabase_${service}_${projectId}`).sort();
      state.runningServices = running.map((name) => name.slice("supabase_".length, -(projectId.length + 1)));
      if (JSON.stringify(running) !== JSON.stringify(expectedNames)) throw stop("UNEXPECTED_RUNNING_SERVICE_SET");
      const onNetwork = lines(await docker(["ps", "-a", "--filter", `network=${networkName}`, "--format", `{{.Names}}|{{.Label "${CLI_PROJECT_LABEL}"}}`], "a01_network_members"));
      if (onNetwork.length === 0 || !onNetwork.every((line) => line.endsWith(`|${projectId}`))) throw stop("UNLABELED_CONTAINER_ON_NETWORK");
      const published = [];
      for (const name of running) {
        const service = name.slice("supabase_".length, -(projectId.length + 1));
        const portMap = await docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", name], "a01_ports", {
          parse: (out) => JSON.parse(out.trim()),
        });
        for (const [containerPort, bindings] of Object.entries(portMap ?? {})) {
          for (const binding of bindings ?? []) {
            if (binding.HostIp !== "127.0.0.1") throw stop("NON_LOOPBACK_PUBLICATION");
            published.push({ service, container_port: containerPort, host_ip: "127.0.0.1", port: Number(binding.HostPort) });
          }
        }
      }
      state.publishedPorts = published;
      const publishedSet = [...new Set(published.map((entry) => entry.port))].sort((a, b) => a - b);
      if (JSON.stringify(publishedSet) !== JSON.stringify([ports.api, ports.db])) throw stop("UNEXPECTED_PUBLISHED_PORT");
      const listeners = lines(await sRun("a01_ss", "ss", ["-H", "-ltn"]));
      for (const line of listeners) {
        const local = line.split(/\s+/u)[3] ?? "";
        const separator = local.lastIndexOf(":");
        const address = local.slice(0, separator);
        const port = Number(local.slice(separator + 1));
        if (plannedPorts.includes(port) && address !== "127.0.0.1") throw stop("NON_LOOPBACK_PUBLICATION");
      }
      state.loopbackGate = true;
      for (const name of running) {
        const service = name.slice("supabase_".length, -(projectId.length + 1));
        const imageId = await docker(["inspect", "--format", "{{.Image}}", name], "a01_image_id");
        if (!/^sha256:[0-9a-f]{64}$/u.test(imageId)) throw stop("IMAGE_ID_UNRESOLVED");
        const repoDigests = await docker(["image", "inspect", "--format", "{{json .RepoDigests}}", imageId], "a01_image_digest", {
          parse: (out) => JSON.parse(out.trim()),
        });
        const digest = (repoDigests ?? []).find((value) => /^[A-Za-z0-9./_-]+@sha256:[0-9a-f]{64}$/u.test(value)) ?? null;
        state.images.push({ service, image_id: imageId, digest });
      }
      expect(state.images.length === 4 && state.images.every((image) => image.digest !== null), "IMAGE_DIGEST_NOT_RECORDED");
    });

    // A02 migrations: the ledger holds exactly the pinned versions.
    await assertion("A02", async () => {
      const ledger = await sql("select coalesce(string_agg(version, ',' order by version), '') from supabase_migrations.schema_migrations;", "a02_ledger");
      if (ledger !== MIGRATIONS.map((m) => m.version).join(",")) throw stop("EXTRA_OR_MISSING_MIGRATION");
      const listing = await cli(["migration", "list", "--local", ...stackFlags()], "a02_migration_list", {
        allowFailure: true,
        parse: (out, errText, code) => (code === 0 ? `${out}\n${errText}` : null),
      });
      expect(listing !== null, "MIGRATION_LIST_COMMAND_FAILED");
      const versions = [...listing.matchAll(/(?<![0-9])([0-9]{14})(?![0-9])/gu)].map((match) => match[1]);
      const counts = new Map();
      for (const version of versions) counts.set(version, (counts.get(version) ?? 0) + 1);
      expect(
        counts.size === MIGRATIONS.length && MIGRATIONS.every((m) => counts.get(m.version) === 2),
        "MIGRATION_LIST_NOT_EXACTLY_PINNED",
      );
    });

    // Synthetic users through the local GoTrue admin API.
    const serviceAuth = authHeader(stack.get("SERVICE_ROLE_KEY"));
    for (const key of ["A", "B", "C"]) {
      const email = `inv001-d6-${randomBytes(8).toString("hex")}@example.invalid`;
      registry.register(email, "harness_generated");
      const secretValue = harnessSecret(24);
      const created = await httpS("auth_admin_create_user", "POST", "/auth/v1/admin/users", {
        headers: { apikey: stack.get("SERVICE_ROLE_KEY"), Authorization: serviceAuth, "Content-Type": "application/json" },
        body: { email, password: secretValue, email_confirm: true },
      });
      const uid = created.data?.id;
      if ((created.status !== 200 && created.status !== 201) || typeof uid !== "string" || !UUID_RE.test(uid)) throw stop("SYNTHETIC_USER_CREATE_FAILED");
      users[key] = { email, password: secretValue, uid };
    }
    state.syntheticUserCount = 3;

    // Fixtures (superuser, disposable cluster only).
    for (const key of ["ok", "life", "expired", "future", "grant", "unknown", "b", "svc", "mobile", "c7"]) {
      assignment[key] = randomUUID();
      ids[key] = { actorId: `actor-d6-${key}`, operatorId: `operator-d6-${key}` };
    }
    for (const key of ["enr1", "enr2", "enr3", "enr7", "dev1", "dev2", "dev3", "dev7"]) mobile[key] = rawHash();
    const row = (key, uid, role, status, validFrom, validUntil, principal = "human") => `(
      ${lit(assignment[key])}, ${lit(principal)}, ${uid === null ? "null" : lit(uid)}, ${lit(ids[key].actorId)}, ${lit(ids[key].operatorId)},
      ${lit(role)}, ${lit(status)}, ${validFrom}, ${validUntil}, 1)`;
    const hourAgo = "now() - interval '1 hour'";
    const grants = (key, capabilities) => capabilities.map((capability) => `(${lit(assignment[key])}, ${lit(capability)})`);
    const mobileCaps = ["inventory.device.register", "inventory.session.issue", "inventory.session.revoke"];
    const enrollment = (key) => `(${lit(mobile[key])}, ${lit(ids[key === "enr7" ? "c7" : "mobile"].actorId)}, ${lit(ids[key === "enr7" ? "c7" : "mobile"].operatorId)}, ${lit(users.C.uid)}, 'wh-a', 1, now() + interval '1 hour')`;
    await sql(`
      begin;
      insert into office_az_inventory_authority_private.locations(location_id, is_active)
        values ('wh-a', true), ('wh-b', true), ('wh-x', false);
      insert into office_az_inventory_authority_private.assignments(
        assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
        role, status, valid_from, valid_until, authority_version
      ) values
        ${row("ok", users.A.uid, "office_az_warehouse_operator", "active", hourAgo, "null")},
        ${row("life", users.A.uid, "office_az_warehouse_operator", "active", hourAgo, "null")},
        ${row("expired", users.A.uid, "office_az_warehouse_operator", "active", "now() - interval '2 hours'", hourAgo)},
        ${row("future", users.A.uid, "office_az_warehouse_operator", "active", "now() + interval '1 hour'", "null")},
        ${row("grant", users.A.uid, "office_az_warehouse_operator", "active", hourAgo, "null")},
        ${row("unknown", users.A.uid, "office_az_warehouse_operator", "active", hourAgo, "null")},
        ${row("b", users.B.uid, "office_az_warehouse_operator", "active", hourAgo, "null")},
        ${row("svc", null, "office_az_inventory_service", "active", hourAgo, "null", "service")},
        ${row("mobile", users.C.uid, "office_az_inventory_super_admin", "active", hourAgo, "null")},
        ${row("c7", users.C.uid, "office_az_inventory_super_admin", "active", hourAgo, "null")};
      insert into office_az_inventory_authority_private.capability_grants(assignment_id, capability) values
        ${[
          ...["ok", "life", "expired", "future", "grant", "unknown", "b", "svc"].flatMap((key) => grants(key, ["inventory.quantity.read"])),
          ...grants("mobile", mobileCaps),
          ...grants("c7", mobileCaps),
        ].join(",\n")};
      insert into office_az_inventory_authority_private.location_grants(assignment_id, location_id) values
        ${["ok", "life", "expired", "future", "grant", "unknown", "b", "svc", "mobile", "c7"].map((key) => `(${lit(assignment[key])}, 'wh-a')`).join(",\n")};
      insert into office_az_inventory_mobile_private.enrollment_codes(
        enrollment_code_hash, actor_id, operator_id, authenticated_user_id, location_id, authority_version, expires_at
      ) values ${["enr1", "enr2", "enr3", "enr7"].map(enrollment).join(",\n")};
      commit;
    `, "fixtures");

    // A03 (part 1): original ownership and role snapshot, recorded never gated.
    const roleRows = await sql(`select string_agg(concat_ws(':', rolname, rolsuper, rolbypassrls, rolcanlogin), ',' order by rolname)
      from pg_roles where rolname in (${SNAPSHOT_ROLES.map(lit).join(", ")});`, "a03_roles");
    state.originalOwnership.roles = roleRows.split(",").filter(Boolean).map((entry) => {
      const [role, rolsuper, rolbypassrls, rolcanlogin] = entry.split(":");
      return { role, rolsuper: rolsuper === "t", rolbypassrls: rolbypassrls === "t", rolcanlogin: rolcanlogin === "t" };
    });
    state.originalOwnership.owners = await ownerSnapshot("a03_original_owners");
    const aclBefore = await aclSet("a03_acl_before");

    // C7: original-owner characterization before reassignment (never PASS/FAIL).
    const c7Lines = await clientSql(users.C.uid, `
      select 'R:' || coalesce(jsonb_array_length(public.resolve_office_az_inventory_authority(${lit(ids.c7.actorId)}, ${lit(ids.c7.operatorId)})->'candidates'), -1);
      select 'M:' || public.office_az_inventory_mobile_register(${lit(ids.c7.actorId)}, ${lit(ids.c7.operatorId)}, 'wh-a', 1, ${lit(mobile.enr7)}, ${lit(mobile.dev7)})::text;
    `, "c7_original_owner");
    const c7Candidates = Number(tagged(c7Lines, "R:"));
    const c7Register = rpcStatus(tagged(c7Lines, "M:"));
    state.characterizations.C7 = {
      original_owner_functional: c7Candidates === 1 && c7Register === "accepted",
      resolver_candidate_count: Number.isSafeInteger(c7Candidates) ? c7Candidates : -1,
      register_status: c7Register,
    };

    // A03 (part 2): synthetic NOLOGIN NOSUPERUSER BYPASSRLS owner, disposable stack only.
    await assertion("A03", async () => {
      await sql(`
        begin;
        create role ${SYNTHETIC_OWNER} nologin nosuperuser bypassrls;
        ${PRIVATE_SCHEMAS.map((schema) => `alter schema ${schema} owner to ${SYNTHETIC_OWNER};`).join("\n")}
        ${PRIVATE_TABLES.map((table) => `alter table ${table} owner to ${SYNTHETIC_OWNER};`).join("\n")}
        ${DEFINER_FUNCTIONS.map((signature) => `alter function ${signature} owner to ${SYNTHETIC_OWNER};`).join("\n")}
        commit;
      `, "a03_synthetic_owner");
      state.schemaOwnerReassigned = true;
      const authAccess = await sql(`select concat_ws(':',
        has_schema_privilege(${lit(SYNTHETIC_OWNER)}, 'auth', 'USAGE'),
        has_function_privilege(${lit(SYNTHETIC_OWNER)}, 'auth.uid()', 'EXECUTE'));`, "a03_auth_prereq");
      if (authAccess !== "t:t") {
        await sql(`grant usage on schema auth to ${SYNTHETIC_OWNER};\ngrant execute on function auth.uid() to ${SYNTHETIC_OWNER};`, "a03_auth_prereq_grant");
        state.authPrereqGrantsApplied = true;
      }
      const aclAfter = await aclSet("a03_acl_after");
      state.aclInvariant = aclBefore === aclAfter;
      state.aclEntryCount = aclBefore === "" ? 0 : aclBefore.split(",").length;
      state.aclSetSha256 = sha256(aclBefore);
      if (!state.aclInvariant) throw stop("INVENTORY_ACL_CHANGED_BY_OWNER_SETUP");
      const attrs = await sql(`select concat_ws(':', rolsuper, rolbypassrls, rolcanlogin) from pg_roles where rolname = ${lit(SYNTHETIC_OWNER)};`, "a03_owner_attrs");
      if (attrs !== "f:t:f") throw stop("SYNTHETIC_OWNER_ATTRIBUTES_MISMATCH");
      state.syntheticOwnership.role_attrs = { rolsuper: false, rolbypassrls: true, rolcanlogin: false };
      const ownersAfter = await ownerSnapshot("a03_synthetic_owners");
      const owned = Object.values(ownersAfter).filter((owner) => owner === SYNTHETIC_OWNER).length;
      state.syntheticOwnership.owned_object_count = owned;
      expect(owned === 17, "SYNTHETIC_OWNERSHIP_INCOMPLETE");
      await sql("notify pgrst, 'reload schema';", "a03_postgrest_reload");
      await sleep(2000);
    });

    // A11 SQL ACL parity (D4A:169-195, DV:328-375) under the real Supabase roles.
    await assertion("A11", async () => {
      const checks = [];
      for (const role of CLIENT_ROLES) {
        for (const schema of PRIVATE_SCHEMAS) checks.push([`has_schema_privilege(${lit(role)}, ${lit(schema)}, 'USAGE')`, "f"]);
        for (const table of PRIVATE_TABLES) checks.push([`has_table_privilege(${lit(role)}, ${lit(table)}, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`, "f"]);
        checks.push([`has_function_privilege(${lit(role)}, '${AUTHORITY_BOUND_SIGNATURE}', 'EXECUTE')`, "f"]);
        for (const signature of [RESOLVER_SIGNATURE, ...MOBILE_RPC_SIGNATURES]) {
          checks.push([`has_function_privilege(${lit(role)}, '${signature}', 'EXECUTE')`, role === "authenticated" ? "t" : "f"]);
        }
      }
      const expected = checks.map(([, value]) => value).join("");
      const actual = await sql(`select ${checks.map(([expr]) => `${expr}::int::text`).join(" || ")};`, "a11_privileges");
      expect(actual.replaceAll("1", "t").replaceAll("0", "f") === expected, "SQL_ACL_PARITY_MISMATCH");
      const publicLeaks = await sql(`${objectsCte}
        select count(*) from objs cross join lateral aclexplode(objs.acl) a
        where a.grantee = 0 and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','USAGE','CREATE','EXECUTE');`, "a11_public");
      expect(publicLeaks === "0", "PUBLIC_PRIVILEGE_LEAK");
      const rls = await sql(`select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname || '.' || c.relname in (${PRIVATE_TABLES.map(lit).join(", ")}) and c.relrowsecurity and c.relforcerowsecurity;`, "a11_rls");
      const policies = await sql(`select count(*) from pg_policies where schemaname in (${PRIVATE_SCHEMAS.map(lit).join(", ")});`, "a11_policies");
      expect(rls === "8" && policies === "0", "FORCE_RLS_OR_POLICY_SURFACE_MISMATCH");
      for (const role of CLIENT_ROLES) {
        expect(await expectDenied(`set role ${role};\nselect count(*) from office_az_inventory_authority_private.assignments;`, "a11_deny_read"), "PRIVATE_READ_NOT_DENIED");
        expect(await expectDenied(`set role ${role};\nselect count(*) from office_az_inventory_mobile_private.sessions;`, "a11_deny_read"), "PRIVATE_READ_NOT_DENIED");
      }
      expect(await expectDenied(`${claimPrefix(users.C.uid)}select office_az_inventory_mobile_private.current_authority_bound('actor-d6-mobile','operator-d6-mobile','wh-a',1,'inventory.session.issue');`, "a11_deny_bound"), "AUTHORITY_BOUND_CALL_NOT_DENIED");
    });

    // A09 / A10 / A13 / A14 over the real PostgREST with a real GoTrue JWT.
    const anonKey = stack.get("ANON_KEY");
    const signIn = await httpS("auth_sign_in_c", "POST", "/auth/v1/token?grant_type=password", {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: { email: users.C.email, password: users.C.password },
    });
    const userJwt = signIn.data?.access_token;
    if (signIn.status !== 200 || typeof userJwt !== "string") throw stop("SIGN_IN_FAILED");
    const userAuth = authHeader(userJwt);
    const anonAuth = authHeader(anonKey);
    const rpcHttp = async (step, name, args, auth = userAuth, apikey = anonKey) => {
      const response = await httpS(step, "POST", `/rest/v1/rpc/office_az_inventory_mobile_${name}`, {
        headers: { apikey, Authorization: auth, "Content-Type": "application/json" },
        body: args,
      });
      if (response.status !== 200) return `HTTP_${response.status}`;
      return rpcStatus(JSON.stringify(response.data));
    };
    const base = (overrides = {}) => ({
      p_actor_id: ids.mobile.actorId,
      p_operator_id: ids.mobile.operatorId,
      p_location_id: "wh-a",
      p_authority_version: 1,
      ...overrides,
    });
    const allFive = async (stepPrefix, session, refresh) => [
      await rpcHttp(`${stepPrefix}_register`, "register", base({ p_enrollment_code_hash: stepPrefix.endsWith("suspended") ? mobile.enr2 : mobile.enr3, p_device_id_hash: stepPrefix.endsWith("suspended") ? mobile.dev2 : mobile.dev3 })),
      await rpcHttp(`${stepPrefix}_revoke_device`, "revoke_device", base({ p_device_id_hash: mobile.dev1 })),
      await rpcHttp(`${stepPrefix}_issue`, "issue", base({ p_device_id_hash: mobile.dev1, p_session_id_hash: rawHash(), p_refresh_hash: rawHash() })),
      await rpcHttp(`${stepPrefix}_refresh`, "refresh", base({ p_session_id_hash: session, p_current_refresh_hash: refresh, p_current_refresh_version: 1, p_next_refresh_hash: rawHash() })),
      await rpcHttp(`${stepPrefix}_revoke`, "revoke", base({ p_session_id_hash: session })),
    ];

    let a09AcceptedUnderSynthetic = false;
    let a14MobileChecked = false;
    await assertion("A09", async () => {
      const session1 = rawHash();
      const refresh1 = rawHash();
      const refresh2 = rawHash();
      expect(await rpcHttp("a09_register", "register", base({ p_enrollment_code_hash: mobile.enr1, p_device_id_hash: mobile.dev1 })) === "accepted", "MOBILE_REGISTER_NOT_ACCEPTED");
      expect(await rpcHttp("a09_issue", "issue", base({ p_device_id_hash: mobile.dev1, p_session_id_hash: session1, p_refresh_hash: refresh1 })) === "accepted", "MOBILE_ISSUE_NOT_ACCEPTED");
      expect(await rpcHttp("a09_refresh", "refresh", base({ p_session_id_hash: session1, p_current_refresh_hash: refresh1, p_current_refresh_version: 1, p_next_refresh_hash: refresh2 })) === "accepted", "MOBILE_REFRESH_NOT_ACCEPTED");
      expect(await rpcHttp("a09_revoke", "revoke", base({ p_session_id_hash: session1 })) === "accepted", "MOBILE_REVOKE_NOT_ACCEPTED");
      a09AcceptedUnderSynthetic = true;
      const session2 = rawHash();
      const refresh3 = rawHash();
      expect(await rpcHttp("a09_issue_second", "issue", base({ p_device_id_hash: mobile.dev1, p_session_id_hash: session2, p_refresh_hash: refresh3 })) === "accepted", "MOBILE_SECOND_ISSUE_NOT_ACCEPTED");

      const ungranted = await rpcHttp("a14_mobile_ungranted", "issue", base({ p_location_id: "wh-b", p_device_id_hash: mobile.dev1, p_session_id_hash: rawHash(), p_refresh_hash: rawHash() }));
      a14MobileChecked = true;
      mark("A14", ungranted === "invalid_or_stale", "MOBILE_UNGRANTED_LOCATION_NOT_DENIED");

      for (const status of ["suspended", "revoked"]) {
        await sql(`update office_az_inventory_authority_private.assignments set status = ${lit(status)} where assignment_id = ${lit(assignment.mobile)};`, `a09_set_${status}`);
        const results = await allFive(`a09_${status}`, session2, refresh3);
        expect(results.every((value) => value === "invalid_or_stale"), `MOBILE_${status.toUpperCase()}_NOT_ALL_STALE`);
      }
      const unchanged = await sql(`select concat_ws(':',
        (select refresh_version from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(session2)}),
        (select revoked_at is null from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(session2)}),
        (select status from office_az_inventory_mobile_private.managed_devices where device_id_hash = ${lit(mobile.dev1)}),
        (select count(*) from office_az_inventory_mobile_private.managed_devices where device_id_hash in (${lit(mobile.dev2)}, ${lit(mobile.dev3)})));`, "a09_unchanged");
      expect(unchanged === "1:t:active:0", "MOBILE_STALE_CALL_MUTATED_STATE");
    });

    await assertion("A10", async () => {
      const serviceKey = stack.get("SERVICE_ROLE_KEY");
      const privateRead = async (step, auth, apikey, profile, table) => (await httpS(step, "GET", `/rest/v1/${table}?select=*`, {
        headers: { apikey, Authorization: auth, "Accept-Profile": profile },
      })).status;
      const denials = state.httpDenials;
      denials.authenticated_private_read_status = await privateRead("a10_auth_private_read", userAuth, anonKey, PRIVATE_SCHEMAS[0], "assignments");
      denials.authenticated_mobile_private_read_status = await privateRead("a10_auth_mobile_read", userAuth, anonKey, PRIVATE_SCHEMAS[1], "sessions");
      denials.service_private_read_status = await privateRead("a10_service_private_read", serviceAuth, serviceKey, PRIVATE_SCHEMAS[0], "assignments");
      denials.service_mobile_private_read_status = await privateRead("a10_service_mobile_read", serviceAuth, serviceKey, PRIVATE_SCHEMAS[1], "sessions");
      const resolverCall = async (step, auth, apikey) => (await httpS(step, "POST", "/rest/v1/rpc/resolve_office_az_inventory_authority", {
        headers: { apikey, Authorization: auth, "Content-Type": "application/json" },
        body: { p_actor_id: ids.mobile.actorId, p_operator_id: ids.mobile.operatorId },
      })).status;
      denials.anon_resolver_status = await resolverCall("a10_anon_resolver", anonAuth, anonKey);
      denials.service_resolver_status = await resolverCall("a10_service_resolver", serviceAuth, serviceKey);
      denials.authenticated_resolver_positive_control_status = await resolverCall("a10_auth_resolver", userAuth, anonKey);
      const issueArgs = base({ p_device_id_hash: mobile.dev1, p_session_id_hash: rawHash(), p_refresh_hash: rawHash() });
      const anonIssue = await rpcHttp("a10_anon_issue", "issue", issueArgs, anonAuth, anonKey);
      const serviceIssue = await rpcHttp("a10_service_issue", "issue", issueArgs, serviceAuth, serviceKey);
      denials.anon_mobile_rpc_status = Number(anonIssue.replace("HTTP_", "")) || 200;
      denials.service_mobile_rpc_status = Number(serviceIssue.replace("HTTP_", "")) || 200;
      const deniedStatus = (value) => Number.isSafeInteger(value) && (value < 200 || value > 299);
      expect(
        [
          denials.authenticated_private_read_status, denials.authenticated_mobile_private_read_status,
          denials.service_private_read_status, denials.service_mobile_private_read_status,
          denials.anon_resolver_status, denials.service_resolver_status,
          denials.anon_mobile_rpc_status, denials.service_mobile_rpc_status,
        ].every(deniedStatus),
        "DATA_API_SURFACE_NOT_DENIED",
      );
      expect(denials.authenticated_resolver_positive_control_status === 200, "DATA_API_POSITIVE_CONTROL_FAILED");
    });

    await assertion("A13", async () => {
      const serviceKey = stack.get("SERVICE_ROLE_KEY");
      const write = async (step, method, auth, apikey, path) => (await httpS(step, method, path, {
        headers: { apikey, Authorization: auth, "Content-Profile": PRIVATE_SCHEMAS[0], "Content-Type": "application/json" },
        body: { assignment_id: randomUUID(), principal_kind: "human", actor_id: "actor-d6-x", operator_id: "operator-d6-x" },
      })).status;
      const denials = state.httpDenials;
      denials.authenticated_private_insert_status = await write("a13_auth_insert", "POST", userAuth, anonKey, "/rest/v1/assignments");
      denials.authenticated_private_update_status = await write("a13_auth_update", "PATCH", userAuth, anonKey, `/rest/v1/assignments?assignment_id=eq.${assignment.mobile}`);
      denials.service_private_insert_status = await write("a13_service_insert", "POST", serviceAuth, serviceKey, "/rest/v1/capability_grants");
      denials.service_private_update_status = await write("a13_service_update", "PATCH", serviceAuth, serviceKey, `/rest/v1/assignments?assignment_id=eq.${assignment.mobile}`);
      expect(
        [denials.authenticated_private_insert_status, denials.authenticated_private_update_status,
          denials.service_private_insert_status, denials.service_private_update_status]
          .every((value) => value < 200 || value > 299),
        "PRIVATE_WRITE_NOT_DENIED",
      );
      const assignmentCount = await sql("select count(*) from office_az_inventory_authority_private.assignments where actor_id = 'actor-d6-x';", "a13_no_write");
      expect(assignmentCount === "0", "PRIVATE_WRITE_PERSISTED");
      const reachable = await sql(`select (
        select coalesce(string_agg(p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text), '')
        from pg_proc p
        where (p.prosrc like '%office_az_inventory_authority_private%' or p.prosrc like '%office_az_inventory_mobile_private%')
          and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      ) = (
        select string_agg(x::text, ',' order by x::text)
        from unnest(array[${[RESOLVER_SIGNATURE, ...MOBILE_RPC_SIGNATURES].map((signature) => `'${signature}'::regprocedure`).join(", ")}]) as x
      );`, "a13_reachable_functions");
      expect(reachable === "t", "CLIENT_REACHABLE_PRIVATE_FUNCTION_SET_MISMATCH");
    });

    await assertion("A14", async () => {
      const rejected = await sql(`do $$ begin
        begin
          insert into office_az_inventory_authority_private.assignments(
            assignment_id, owner, principal_kind, authenticated_user_id, actor_id, operator_id,
            role, status, valid_from, authority_version
          ) values (
            ${lit(randomUUID())}, 'ATTRACTION', 'human', ${lit(users.A.uid)}, 'actor-d6-attr', 'operator-d6-attr',
            'office_az_warehouse_operator', 'active', now(), 1
          );
          raise exception 'foreign owner accepted';
        exception when check_violation then null;
        end;
      end $$;
      select 'ok';`, "a14_foreign_owner");
      expect(rejected === "ok", "FOREIGN_OWNER_NOT_REJECTED");
      expect(a14MobileChecked, "MOBILE_UNGRANTED_LOCATION_NOT_RUN");
    });

    // A15 (D6-B F1/F1b): under the third pinned migration the human-facing
    // resolver returns no service candidate to anyone, returns
    // knownLocationIds = [] when zero human assignments match the caller, and
    // still returns the full active Office AZ location list (not narrowed to
    // location grants) to a matching human. Probe output is a closed shape:
    // jsonb type : key count : candidate count : principalKind : known ids.
    await assertion("A15", async () => {
      const probe = (tag, key) => `
        select ${lit(tag)} || concat_ws(':',
          jsonb_typeof(resolved),
          (select count(*) from jsonb_object_keys(resolved)),
          jsonb_array_length(resolved->'candidates'),
          coalesce(resolved->'candidates'->0->>'principalKind', 'none'),
          (select coalesce(string_agg(value, ',' order by ordinality), 'none')
             from jsonb_array_elements_text(resolved->'knownLocationIds') with ordinality))
        from (select public.resolve_office_az_inventory_authority(${lit(ids[key].actorId)}, ${lit(ids[key].operatorId)}) as resolved) as probe;`;
      const ZERO = "object:2:0:none:none";
      const HUMAN_FULL_ACTIVE = "object:2:1:human:wh-a,wh-b";
      const asB = await clientSql(users.B.uid, `${probe("BSVC:", "svc")}\n${probe("BOK:", "ok")}`, "a15_user_b_probe");
      const asA = await clientSql(users.A.uid, `${probe("ASVC:", "svc")}\n${probe("AOK:", "ok")}`, "a15_user_a_probe");
      const bSvc = tagged(asB, "BSVC:");
      const bOk = tagged(asB, "BOK:");
      const aSvc = tagged(asA, "ASVC:");
      const aOk = tagged(asA, "AOK:");
      const definer = await sql(`select prosecdef::text || ':' || exists (
          select 1 from unnest(proconfig) as setting where setting like 'search_path=%'
        )::text from pg_proc where oid = '${RESOLVER_SIGNATURE}'::regprocedure;`, "a15_resolver_definer");
      const serviceExposed = bSvc !== ZERO || aSvc !== ZERO;
      const locationsExposed = bSvc !== ZERO || bOk !== ZERO || aSvc !== ZERO;
      findings.push({
        id: "F1",
        classification: "INFORMATION_DISCLOSURE_WITHOUT_AUTHORITY_GRANT",
        service_candidate_returned_to_other_user: serviceExposed,
        core_result: "PENDING_IDENTITY_CHILD",
        disposition: "FIXED_BY_FORWARD_MIGRATION_20260927143257",
      });
      findings.push({
        id: "F1b",
        classification: "LOCATION_LIST_DISCLOSURE_WITHOUT_MATCHING_HUMAN_ASSIGNMENT",
        known_location_ids_returned_without_human_candidate: locationsExposed,
        human_positive_control: aOk,
        disposition: "FIXED_BY_FORWARD_MIGRATION_20260927143257",
      });
      expect(!serviceExposed, "F1_SERVICE_CANDIDATE_EXPOSED");
      expect(!locationsExposed, "F1B_KNOWN_LOCATIONS_EXPOSED_WITHOUT_HUMAN_CANDIDATE");
      expect(aOk === HUMAN_FULL_ACTIVE, "HUMAN_RESOLVER_COMPATIBILITY_BOUNDARY_CHANGED");
      expect(definer === "true:true", "RESOLVER_DEFINER_OR_SEARCH_PATH_LOST");
    });

    // A04-A08, A13, A14, A15: genuine SSR-cookie and Bearer identity in an IPC child.
    const observations = new Map();
    const mutations = {
      lifecycle_suspend: `update office_az_inventory_authority_private.assignments set status = 'suspended' where assignment_id = ${lit(assignment.life)};`,
      lifecycle_revoke: `update office_az_inventory_authority_private.assignments set status = 'revoked' where assignment_id = ${lit(assignment.life)};`,
      grant_delete: `delete from office_az_inventory_authority_private.capability_grants where assignment_id = ${lit(assignment.grant)} and capability = 'inventory.quantity.read';`,
    };
    const childResult = await new Promise((resolvePromise) => {
      const out = [];
      const err = [];
      let total = 0;
      let overflow = false;
      let protocolError = null;
      let child;
      try {
        child = spawn(process.execPath, [
          "--experimental-test-module-mocks",
          "--import", "tsx",
          "--test-reporter=tap",
          join(HERE, "identity.test.ts"),
        ], {
          cwd: repositoryRoot,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          env: {
            ...passThroughEnv(),
            TMPDIR: tempDir,
            NODE_ENV: "test",
            INV001_D6_IDENTITY_CHILD: "1",
            NEXT_PUBLIC_SUPABASE_URL: stack.get("API_URL"),
            NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
          },
        });
      } catch {
        resolvePromise({ exitCode: null, protocolError: "IDENTITY_CHILD_SPAWN_FAILED" });
        return;
      }
      trackedChildren.add(child);
      const collect = (sink) => (chunk) => {
        if (overflow) {
          chunk.fill(0);
          return;
        }
        total += chunk.length;
        if (total > ONE_MIB) {
          overflow = true;
          chunk.fill(0);
          child.kill("SIGKILL");
          return;
        }
        sink.push(chunk);
      };
      child.stdout.on("data", collect(out));
      child.stderr.on("data", collect(err));
      const timer = setTimeout(() => {
        protocolError ??= "IDENTITY_CHILD_TIMEOUT";
        child.kill("SIGKILL");
      }, 240_000);
      const reply = (message) => {
        if (child.connected) child.send(message);
      };
      child.on("message", (message) => {
        const kind = message?.t;
        if (kind === "ready") {
          reply({
            t: "fixture",
            users: {
              A: { email: users.A.email, password: users.A.password, uid: users.A.uid },
              B: { email: users.B.email, password: users.B.password, uid: users.B.uid },
            },
            ids,
          });
        } else if (kind === "register") {
          try {
            registry.register(message.v, "child_ipc", 8);
            reply({ t: "ack", id: message.id, ok: true });
          } catch {
            protocolError ??= "CHILD_REGISTRATION_REJECTED";
            reply({ t: "ack", id: message.id, ok: false });
          }
        } else if (kind === "observe") {
          const key = message.key;
          const value = message.value;
          const valid = typeof key === "string" && (Object.hasOwn(IDENTITY_EXPECTATIONS, key) || key === "DONE")
            && typeof value === "string" && /^[A-Za-z_]{1,64}$/u.test(value) && !observations.has(key);
          if (valid) observations.set(key, value);
          else protocolError ??= "INVALID_IDENTITY_OBSERVATION";
          reply({ t: "ack", id: message.id, ok: valid });
        } else if (kind === "mutate" && Object.hasOwn(mutations, message.op)) {
          sql(mutations[message.op], `identity_mutate_${message.op}`)
            .then(() => reply({ t: "ack", id: message.id, ok: true }))
            .catch(() => {
              protocolError ??= "IDENTITY_MUTATION_FAILED";
              reply({ t: "ack", id: message.id, ok: false });
            });
        } else {
          protocolError ??= "UNKNOWN_IDENTITY_MESSAGE";
          reply({ t: "ack", id: message?.id, ok: false });
        }
      });
      child.once("error", () => {
        protocolError ??= "IDENTITY_CHILD_SPAWN_FAILED";
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(out);
        const stderr = Buffer.concat(err);
        for (const chunk of [...out, ...err]) chunk.fill(0);
        if (overflow) {
          stdout.fill(0);
          stderr.fill(0);
          void new HarnessStop("SECRET_CHANNEL_OVERFLOW", { step: "identity_child", s_bytes: total });
          resolvePromise({ exitCode: code, protocolError: "SECRET_CHANNEL_OVERFLOW" });
          return;
        }
        try {
          checkAndZero([stdout, stderr], "identity_child");
        } catch {
          protocolError ??= "SECRET_REGISTRY_INCOMPLETE";
        }
        resolvePromise({ exitCode: code, protocolError });
      });
    });
    if (secretStop !== null) throw secretStop;
    state.identityObservations = Object.fromEntries([...observations].filter(([key]) => key !== "DONE"));
    const childOk = childResult.exitCode === 0 && childResult.protocolError === null && observations.get("DONE") === "complete";
    for (const [key, expected] of Object.entries(IDENTITY_EXPECTATIONS)) {
      const id = key.slice(0, 3);
      const observed = observations.get(key);
      mark(id, childOk && observed === expected, childOk ? `IDENTITY_${key}_MISMATCH` : (childResult.protocolError ?? "IDENTITY_CHILD_FAILED"));
      if (id === "A05" && observed !== undefined && observed !== expected) {
        findings.push({ id: "A05_OBSERVATION", key, observed, expected });
      }
    }
    const f1 = findings.find((finding) => finding.id === "F1");
    if (f1 !== undefined) f1.core_result = observations.get("A15_service_candidate") ?? "NOT_OBSERVED";
    if (assertions.A04 === "PASS") state.identityLabels = ["SSR_LIBRARY_COOKIE_PATH_PROVEN"];

    // A16-A22: races C1-C5 and characterization C6 under synthetic ownership.
    const raceResult = await runRaces({
      uid: users.C.uid,
      stop,
      sql: (query, step) => sql(query, step, "inv001-d6-observer"),
      session: openSession,
      uuid: randomUUID,
      rawHash,
    });
    state.races = raceResult.races;
    state.characterizations.C6 = raceResult.c6;
    raceResult.races.forEach((race, index) => {
      mark(`A${16 + index}`, race.pass, `RACE_${race.id}_OUTCOME_MISMATCH`);
    });
    mark("A21", raceResult.c6 !== null && typeof raceResult.c6.status_during_open_revoke === "string", "C6_NOT_RECORDED");
    mark(
      "A22",
      raceResult.races.length === 5 && raceResult.races.every((race) => race.observer_confirmed
        && Number.isSafeInteger(race.pids[0]) && Number.isSafeInteger(race.pids[1]) && race.pids[0] !== race.pids[1]),
      "RACE_INDEPENDENCE_NOT_PROVEN",
    );

    // A12: FORCE RLS functional under the synthetic hosted-like owner.
    const forceRls = await sql(`select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname || '.' || c.relname in (${PRIVATE_TABLES.map(lit).join(", ")}) and c.relrowsecurity and c.relforcerowsecurity;`, "a12_force_rls");
    const policyCount = await sql(`select count(*) from pg_policies where schemaname in (${PRIVATE_SCHEMAS.map(lit).join(", ")});`, "a12_policies");
    mark(
      "A12",
      assertions.A04 === "PASS" && a09AcceptedUnderSynthetic && assertions.A09 === "PASS"
        && forceRls === "8" && policyCount === "0"
        && state.syntheticOwnership.role_attrs?.rolsuper === false
        && state.syntheticOwnership.role_attrs?.rolbypassrls === true
        && state.characterizations.C7 !== null,
      "SYNTHETIC_OWNER_FUNCTIONAL_PROOF_FAILED",
    );
  } catch (error) {
    if (error instanceof HarnessStop) {
      const detail = error.detail ?? {};
      failure = {
        code: error.code,
        step: typeof detail.step === "string" ? detail.step : null,
        exit_code: Number.isSafeInteger(detail.exit_code) ? detail.exit_code : null,
        s_bytes: Number.isSafeInteger(detail.s_bytes) ? detail.s_bytes : null,
      };
    } else if (error instanceof AssertionFailure) {
      failure = { code: error.code, step: null, exit_code: null, s_bytes: null };
    } else {
      failure = { code: "UNEXPECTED_HARNESS_ERROR", step: null, exit_code: null, s_bytes: null };
    }
  }

  // Cleanup always runs (A23).
  let cleanup;
  try {
    heldBuffers.splice(0).forEach((s) => {
      try {
        checkAndZero([s.stdout, s.stderr], s.step);
      } catch {
        // recorded through secretStop
      }
    });
    if (cliPath !== null && configWritten && existsSync(join(workdir, "supabase", "config.toml"))) {
      try {
        await cli(["stop", "--no-backup", ...stackFlags()], "cleanup_cli_stop", { allowFailure: true, timeoutMs: 5 * 60_000 });
      } catch {
        // the label sweep below is authoritative
      }
    }
    cleanup = await sweepAndProve(plannedPorts);
  } catch (error) {
    cleanup = {
      containers: -1, volumes: -1, networks: -1, processes: -1, listeners: -1,
      temp_present: existsSync(runRoot), out_dir_present: existsSync(outDir), npmrc_present: existsSync(npmrcPath),
      error: error instanceof HarnessStop ? error.code : "CLEANUP_FAILED",
    };
  }
  const cleanupPass = cleanupClean(cleanup);
  mark("A23", cleanupPass, "CLEANUP_RESIDUE_PRESENT");

  if (secretStop !== null) {
    emitSecretStop();
    const record = JSON.stringify({
      failure_step: typeof secretStop.detail?.step === "string" ? secretStop.detail.step : null,
      s_bytes: Number.isSafeInteger(secretStop.detail?.s_bytes) ? secretStop.detail.s_bytes : null,
      cleanup_status: cleanupPass ? "PASS" : "FAIL",
      containers: cleanup.containers,
      volumes: cleanup.volumes,
      networks: cleanup.networks,
    });
    const recordScan = scanPublishable(record, registry.values());
    if (recordScan.exact_hits + recordScan.pattern_hits === 0) process.stderr.write(`${record}\n`);
    process.exit(1);
  }

  const validationPass = failure === null
    && ASSERTION_IDS.slice(0, 22).every((id) => assertions[id] === "PASS");
  mark("A24", sStats.unregistered === 0, "SECRET_REGISTRY_INCOMPLETE");

  const evidenceState = {
    ...state,
    cleanupPass,
    validationPass,
    assertions,
    assertionFailures,
    findings,
    cleanup,
    failure,
    registrySize: registry.size,
    registrySources: { ...registry.sources },
    sBuffersChecked: sStats.checked,
    unregisteredMatches: sStats.unregistered,
    exactHits: 0,
    patternHits: 0,
    publishableBytes: 0,
    secretPass: true,
    passed: validationPass && cleanupPass,
  };
  let text = serializeEvidence(buildEvidence(evidenceState));
  const scan = scanPublishable(text, registry.values());
  if (scan.exact_hits + scan.pattern_hits > 0) {
    process.stderr.write(`SECRET_SCAN_HIT kinds=[${scan.kinds.join(",")}] count=${scan.exact_hits + scan.pattern_hits}\n`);
    process.exit(1);
  }
  evidenceState.publishableBytes = Buffer.byteLength(text, "utf8");
  text = serializeEvidence(buildEvidence(evidenceState));
  const finalScan = scanPublishable(text, registry.values());
  if (finalScan.exact_hits + finalScan.pattern_hits > 0) {
    process.stderr.write(`SECRET_SCAN_HIT kinds=[${finalScan.kinds.join(",")}] count=${finalScan.exact_hits + finalScan.pattern_hits}\n`);
    process.exit(1);
  }
  process.stdout.write(text);
  process.exit(validationPass && cleanupPass && assertions.A24 === "PASS" ? 0 : 1);
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) await main();
