import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

mock.module("server-only", { namedExports: {} });

const generatedPath =
  "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql";
const historicalPath =
  "supabase/migrations/20260920093931_office_az_operator_authority.sql";
const historicalSha256 =
  "2a880998de445c347b53dc8578bd5bfba0e1f66c22816722eef3ae1abf6ac767";

const sql = readFileSync(resolve(process.cwd(), generatedPath), "utf8");
const historical = readFileSync(resolve(process.cwd(), historicalPath), "utf8");

type Persist = typeof import("./office-az-inventory-mobile-persistence");
let createOfficeAzInventoryMobilePersistence: Persist["createOfficeAzInventoryMobilePersistence"];
let MOBILE_PERSIST_HASH_PATTERN: Persist["MOBILE_PERSIST_HASH_PATTERN"];

before(async () => {
  ({
    createOfficeAzInventoryMobilePersistence,
    MOBILE_PERSIST_HASH_PATTERN,
  } = await import("./office-az-inventory-mobile-persistence"));
});

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function extractCreateFunction(source: string, signaturePrefix: string): string {
  const start = source.indexOf(`create function ${signaturePrefix}`);
  assert.notEqual(start, -1, signaturePrefix);
  const after = source.slice(start);
  const end = after.indexOf("$function$;");
  assert.notEqual(end, -1, signaturePrefix);
  return after.slice(0, end + "$function$;".length);
}

const HASH_A = sha("enrollment");
const HASH_B = sha("device");
const HASH_C = sha("session");
const HASH_D = sha("refresh-current");
const HASH_E = sha("refresh-next");

const shared = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 3,
  requiredLocationIds: ["office-az-warehouse"],
};

function validRegister() {
  return { ...shared, enrollmentCodeHash: HASH_A, deviceIdHash: HASH_B };
}

function validRefresh() {
  return {
    ...shared,
    sessionIdHash: HASH_C,
    currentRefreshHash: HASH_D,
    currentRefreshVersion: 1,
    nextRefreshHash: HASH_E,
  };
}

function trackingClient() {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return { data: { ok: true, status: "accepted" }, error: null };
      },
    },
  };
}

test("generated migration stays on the reserved empty-file path and historical authority migration is byte-identical", () => {
  assert.equal(generatedPath, "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql");
  assert.equal(
    createHash("sha256").update(historical).digest("hex"),
    historicalSha256,
  );
  assert.match(historical, /inventory\.operator\.manage/);
  assert.doesNotMatch(historical, /inventory\.device\.register/);
});

test("private schema defines four owner-bound tables with FORCE RLS and zero direct grants", () => {
  for (const table of [
    "managed_devices",
    "enrollment_codes",
    "sessions",
    "audit_events",
  ]) {
    assert.match(sql, new RegExp(`create table office_az_inventory_mobile_private\\.${table}`));
    assert.match(
      sql,
      new RegExp(
        `alter table office_az_inventory_mobile_private\\.${table} enable row level security`,
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `alter table office_az_inventory_mobile_private\\.${table} force row level security`,
      ),
    );
    assert.match(sql, new RegExp(`office_az_inventory_mobile_${table === "managed_devices" ? "devices" : table === "enrollment_codes" ? "enrollment" : table === "sessions" ? "sessions" : "audit"}_owner_check`));
  }
  assert.match(sql, /owner = 'OFFICE_AZ'/);
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assert.match(
      sql,
      new RegExp(
        `revoke all on all tables in schema office_az_inventory_mobile_private from ${role}`,
        "i",
      ),
    );
  }
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*office_az_inventory_mobile_private/i);
});

test("callable functions pin SECURITY DEFINER search_path and auth.uid binding", () => {
  for (const name of [
    "office_az_inventory_mobile_register",
    "office_az_inventory_mobile_revoke_device",
    "office_az_inventory_mobile_issue",
    "office_az_inventory_mobile_refresh",
    "office_az_inventory_mobile_revoke",
  ]) {
    assert.match(sql, new RegExp(`create function public\\.${name}\\(`));
    assert.equal((sql.match(new RegExp(`create function public\\.${name}\\(`, "g")) ?? []).length, 1);
  }
  assert.equal((sql.match(/security definer\s+set search_path = ''/g) ?? []).length >= 6, true);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /current_authority_bound/);
});

test("capability closed-set is extended by exactly three values without seed or live grants", () => {
  assert.match(sql, /drop constraint office_az_inventory_capability_grants_capability_check/);
  assert.match(sql, /inventory\.device\.register/);
  assert.match(sql, /inventory\.session\.revoke/);
  assert.match(sql, /inventory\.session\.issue/);
  assert.match(sql, /inventory\.operator\.manage/);
  assert.doesNotMatch(sql, /insert\s+into\s+office_az_inventory_authority_private/i);
  assert.doesNotMatch(sql, /insert\s+into\s+office_az_inventory_authority_private\.capability_grants/i);
});

test("refresh UPDATE SET clause is extracted from the sessions update only", () => {
  const refresh = extractCreateFunction(sql, "public.office_az_inventory_mobile_refresh(");
  const setMatch = refresh.match(
    /update\s+office_az_inventory_mobile_private\.sessions(?:\s+as\s+\w+)?\s+set\s+([\s\S]*?)\s+where\s+/i,
  );
  assert.ok(setMatch, "refresh function must contain sessions UPDATE SET");
  const setClause = setMatch[1];
  assert.doesNotMatch(setClause, /search_path/);
  assert.match(setClause, /refresh_hash\s*=\s*p_next_refresh_hash/);
  assert.match(setClause, /refresh_version\s*=/);
  assert.match(setClause, /access_expires_at\s*=\s*least\(/);
  assert.match(setClause, /session_row\.absolute_expires_at/);
  assert.doesNotMatch(setClause, /(?:^|,)\s*absolute_expires_at\s*=/);
  assert.match(sql, /absolute_expires_at = issued_at \+ interval '12 hours'/);
  assert.match(sql, /interval '1 hour'/);
  assert.match(sql, /interval '12 hours'/);
});

test("source encodes atomic enrollment, compare-and-rotate refresh, replay denial, and redacted audit", () => {
  assert.match(sql, /redeemed_at is null/);
  assert.match(sql, /expires_at > statement_timestamp\(\)/);
  assert.match(sql, /refresh_hash = p_current_refresh_hash/);
  assert.match(sql, /refresh_version = p_current_refresh_version/);
  assert.match(sql, /revoked_at = coalesce\(session_row\.revoked_at, statement_timestamp\(\)\)/);
  assert.match(sql, /create table office_az_inventory_mobile_private\.audit_events/);
  assert.doesNotMatch(sql, /bearer|jwt|session_token|raw_enrollment|request_body/i);
});

test("authority helper locks every matching assignment and continues only for exactly one", () => {
  const helper = extractCreateFunction(
    sql,
    "office_az_inventory_mobile_private.current_authority_bound(",
  );
  assert.match(helper, /language plpgsql/);
  assert.doesNotMatch(helper, /language sql/);
  assert.doesNotMatch(helper, /\blimit\s+1\b/i);
  assert.match(helper, /for assignment_row in/);
  assert.match(helper, /order by assignment\.assignment_id/);
  assert.match(helper, /cardinality\(locked_assignment_ids\) <> 1/);
  const assignmentLock = helper.indexOf("for update of assignment");
  const grantLock = helper.indexOf("for update of grant_row");
  const locationGrantLock = helper.indexOf("for update of location_grant");
  const locationLock = helper.indexOf("for update of location_row");
  assert.ok(
    assignmentLock >= 0 &&
      grantLock > assignmentLock &&
      locationGrantLock > grantLock &&
      locationLock > locationGrantLock,
  );
  assert.match(helper, /location_row\.owner = 'OFFICE_AZ'/);
  assert.match(helper, /location_row\.is_active = true/);
  assert.match(helper, /authenticated_user_id = auth\.uid\(\)/);
  assert.match(helper, /assignment\.status = 'active'/);
  assert.match(helper, /grant_row\.capability = p_capability/);
});

test("SQL helper role/capability closed-set matches accepted TypeScript core mapping", () => {
  const helper = extractCreateFunction(
    sql,
    "office_az_inventory_mobile_private.current_authority_bound(",
  );
  const core = readFileSync(
    resolve(process.cwd(), "src/lib/inventory/authority/office-az-inventory-authority-core.ts"),
    "utf8",
  );
  assert.match(core, /office_az_warehouse_operator: WAREHOUSE_OPERATOR_CAPABILITIES/);
  assert.match(core, /office_az_warehouse_manager: WAREHOUSE_MANAGER_CAPABILITIES/);
  assert.match(core, /office_az_inventory_super_admin: SUPER_ADMIN_CAPABILITIES/);
  assert.match(core, /office_az_inventory_service: SERVICE_CAPABILITIES/);
  assert.match(core, /"inventory\.session\.issue"/);
  assert.match(core, /"inventory\.session\.revoke"/);
  assert.match(core, /"inventory\.device\.register"/);
  const serviceBlock = core.slice(
    core.indexOf("const SERVICE_CAPABILITIES"),
    core.indexOf("export const OFFICE_AZ_ROLE_CAPABILITIES"),
  );
  assert.doesNotMatch(serviceBlock, /inventory\.session\.issue/);
  assert.doesNotMatch(serviceBlock, /inventory\.session\.revoke/);
  assert.doesNotMatch(serviceBlock, /inventory\.device\.register/);
  assert.match(
    helper,
    /locked_role = 'office_az_warehouse_operator'\s+and p_capability = 'inventory\.session\.issue'/,
  );
  assert.match(
    helper,
    /locked_role = 'office_az_warehouse_manager'\s+and p_capability in \('inventory\.session\.issue', 'inventory\.session\.revoke'\)/,
  );
  assert.match(
    helper,
    /locked_role = 'office_az_inventory_super_admin'\s+and p_capability in \(\s*'inventory\.session\.issue',\s*'inventory\.session\.revoke',\s*'inventory\.device\.register'\s*\)/,
  );
  assert.match(helper, /locked_role = 'office_az_inventory_service'/);
  assert.match(helper, /principal_kind = 'human'/);
});

test("private helper execute is revoked from public, anon, authenticated, and service_role", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assert.match(
      sql,
      new RegExp(
        `revoke (?:all|execute) on function office_az_inventory_mobile_private\\.current_authority_bound\\(text, text, text, bigint, text\\) from ${role}`,
        "i",
      ),
    );
  }
  assert.match(
    sql,
    /grant execute on function public\.office_az_inventory_mobile_register\(text, text, text, bigint, text, text\) to authenticated/,
  );
});

test("SQL and TypeScript reject identical current and next refresh hashes", async () => {
  const refresh = extractCreateFunction(sql, "public.office_az_inventory_mobile_refresh(");
  assert.match(refresh, /p_next_refresh_hash = p_current_refresh_hash/);
  const { calls, client } = trackingClient();
  const port = createOfficeAzInventoryMobilePersistence(client);
  assert.deepEqual(
    await port.refresh({
      ...validRefresh(),
      nextRefreshHash: HASH_D,
    }),
    { ok: false, code: "invalid_request" },
  );
  assert.equal(calls.length, 0);
});

test("absent persistence client maps every operation to not_configured", async () => {
  const port = createOfficeAzInventoryMobilePersistence(null);
  const results = await Promise.all([
    port.register(validRegister()),
    port.revokeDevice({ ...shared, deviceIdHash: HASH_B }),
    port.issue({ ...shared, deviceIdHash: HASH_B, sessionIdHash: HASH_C, refreshHash: HASH_D }),
    port.refresh(validRefresh()),
    port.revoke({ ...shared, sessionIdHash: HASH_C }),
  ]);
  for (const result of results) {
    assert.deepEqual(result, { ok: false, code: "not_configured" });
    assert.equal("sessionId" in result, false);
    assert.equal(JSON.stringify(result).includes("Bearer"), false);
  }
});

test("strict hash and authority input is required before any RPC", async () => {
  const { calls, client } = trackingClient();
  const port = createOfficeAzInventoryMobilePersistence(client);
  assert.deepEqual(
    await port.register({ ...shared, enrollmentCodeHash: "not-a-hash", deviceIdHash: HASH_B }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    await port.issue({
      ...shared,
      actorId: "operator-1",
      deviceIdHash: HASH_B,
      sessionIdHash: HASH_C,
      refreshHash: HASH_D,
    }),
    { ok: false, code: "invalid_request" },
  );
  assert.equal(MOBILE_PERSIST_HASH_PATTERN.test(HASH_A), true);
  assert.equal(calls.length, 0);
});

test("closed-key parser rejects proxy, getters, extra keys, and raw material without RPC", async () => {
  const { calls, client } = trackingClient();
  const port = createOfficeAzInventoryMobilePersistence(client);
  const proxy = new Proxy(validRegister(), {
    get() {
      throw new Error("proxy");
    },
  });
  assert.deepEqual(await port.register(proxy), { ok: false, code: "invalid_request" });

  const withGetter = Object.defineProperty(validRegister(), "enrollmentCodeHash", {
    get() {
      throw new Error("getter");
    },
    enumerable: true,
    configurable: true,
  });
  assert.deepEqual(await port.register(withGetter), { ok: false, code: "invalid_request" });

  assert.deepEqual(
    await port.register({ ...validRegister(), token: "x" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    await port.register({ ...validRegister(), jwt: "y" }),
    { ok: false, code: "invalid_request" },
  );

  const protoPolluted = Object.defineProperty(validRegister(), "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  assert.deepEqual(await port.register(protoPolluted), { ok: false, code: "invalid_request" });

  const constructorKey = { ...validRegister(), constructor: Object };
  assert.deepEqual(await port.register(constructorKey), { ok: false, code: "invalid_request" });

  const nestedHostile = {
    ...validRegister(),
    requiredLocationIds: Object.assign(["office-az-warehouse"], { token: "nested" }),
  };
  assert.deepEqual(await port.register(nestedHostile), { ok: false, code: "invalid_request" });

  const withSymbol = Object.assign(validRegister(), { [Symbol("extra")]: "x" });
  assert.deepEqual(await port.register(withSymbol), { ok: false, code: "invalid_request" });

  const hidden = validRegister();
  Object.defineProperty(hidden, "actorId", {
    value: "actor-1",
    enumerable: false,
    writable: true,
    configurable: true,
  });
  assert.deepEqual(await port.register(hidden), { ok: false, code: "invalid_request" });

  const proxiedLocations = {
    ...validRegister(),
    requiredLocationIds: new Proxy(["office-az-warehouse"], {}),
  };
  assert.deepEqual(await port.register(proxiedLocations), { ok: false, code: "invalid_request" });

  assert.equal(calls.length, 0);
});

test("accepted RPC returns sanitized ok and stale/error map fail-closed", async () => {
  const portAccepted = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return { data: { ok: true, status: "accepted" }, error: null };
    },
  });
  assert.deepEqual(await portAccepted.register(validRegister()), { ok: true, operation: "register" });

  const portStale = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return { data: { ok: false, status: "invalid_or_stale" }, error: null };
    },
  });
  assert.deepEqual(await portStale.refresh(validRefresh()), { ok: false, code: "invalid_or_stale" });

  const portFailed = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return { data: null, error: { message: "secret jwt eyJabc.def" } };
    },
  });
  const failed = await portFailed.revoke({ ...shared, sessionIdHash: HASH_C });
  assert.deepEqual(failed, { ok: false, code: "failed" });
  assert.equal(JSON.stringify(failed).includes("eyJ"), false);
  assert.equal(JSON.stringify(failed).includes("jwt"), false);
});

test("RPC success and stale require exact own data keys ok and status", async () => {
  const extra = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return { data: { ok: true, status: "accepted", secret: "x" }, error: null };
    },
  });
  assert.deepEqual(await extra.register(validRegister()), { ok: false, code: "failed" });

  const accessor = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return {
        data: Object.defineProperty({ status: "accepted" }, "ok", {
          get() {
            return true;
          },
          enumerable: true,
        }),
        error: null,
      };
    },
  });
  assert.deepEqual(await accessor.register(validRegister()), { ok: false, code: "failed" });

  const proxied = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return {
        data: new Proxy({ ok: true, status: "accepted" }, {}),
        error: null,
      };
    },
  });
  assert.deepEqual(await proxied.register(validRegister()), { ok: false, code: "failed" });

  const arrayData = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return { data: [true, "accepted"], error: null };
    },
  });
  assert.deepEqual(await arrayData.register(validRegister()), { ok: false, code: "failed" });

  const symbolData = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      return {
        data: Object.assign({ ok: true, status: "accepted" }, { [Symbol("extra")]: 1 }),
        error: null,
      };
    },
  });
  assert.deepEqual(await symbolData.register(validRegister()), { ok: false, code: "failed" });

  const hiddenOk = createOfficeAzInventoryMobilePersistence({
    async rpc() {
      const data = { status: "accepted" };
      Object.defineProperty(data, "ok", {
        value: true,
        enumerable: false,
        writable: true,
        configurable: true,
      });
      return { data, error: null };
    },
  });
  assert.deepEqual(await hiddenOk.register(validRegister()), { ok: false, code: "failed" });
});

test("adaptor and migration source contain no env, cookie, hostname, or raw-secret surfaces", () => {
  const adaptor = readFileSync(
    resolve(process.cwd(), "src/lib/inventory/mobile/office-az-inventory-mobile-persistence.ts"),
    "utf8",
  );
  for (const source of [adaptor, sql]) {
    assert.doesNotMatch(source, /process\.env/);
    assert.doesNotMatch(source, /cookies\s*\(/);
    assert.doesNotMatch(source, /createClient\s*\(/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE/);
    assert.doesNotMatch(source, /DEALEROS_INVENTORY_API_BASE_URL/);
    assert.doesNotMatch(source, /console\.(log|info|debug|error)/);
    assert.doesNotMatch(source, /service_role key|hostname/i);
  }
});
