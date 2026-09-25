import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

mock.module("server-only", { namedExports: {} });

type Binding = typeof import("./office-az-inventory-mobile-binding");
type Persist = typeof import("./office-az-inventory-mobile-persistence");
let bindAuthorizedMobileOperation: Binding["bindAuthorizedMobileOperation"];
let generateOfficeAzInventoryMobileOpaqueId: Binding["generateOfficeAzInventoryMobileOpaqueId"];
let hashOfficeAzInventoryMobilePublicValue: Binding["hashOfficeAzInventoryMobilePublicValue"];
let MOBILE_OPAQUE_ID_PATTERN: Binding["MOBILE_OPAQUE_ID_PATTERN"];
let createOfficeAzInventoryMobilePersistence: Persist["createOfficeAzInventoryMobilePersistence"];

before(async () => {
  ({
    bindAuthorizedMobileOperation,
    generateOfficeAzInventoryMobileOpaqueId,
    hashOfficeAzInventoryMobilePublicValue,
    MOBILE_OPAQUE_ID_PATTERN,
  } = await import("./office-az-inventory-mobile-binding"));
  ({ createOfficeAzInventoryMobilePersistence } = await import(
    "./office-az-inventory-mobile-persistence"
  ));
});

const HASH = /^[a-f0-9]{64}$/;
const shared = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 3,
  requiredLocationIds: ["office-az-warehouse"],
} as const;

function sha(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sequence(): { generate: () => string; values: string[] } {
  const values: string[] = [];
  let n = 0;
  return {
    values,
    generate: () => {
      n += 1;
      const value = Buffer.alloc(32, n).toString("base64url");
      values.push(value);
      return value;
    },
  };
}

type Call = { method: string; input: Record<string, unknown> };

function fakePort(
  outcome: (method: string) => unknown = (method) => ({ ok: true, operation: method }),
): { port: Parameters<Binding["bindAuthorizedMobileOperation"]>[1]["persistence"]; calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (method: string, operation: string) =>
    async (input: unknown) => {
      calls.push({ method, input: input as Record<string, unknown> });
      const result = outcome(operation);
      if (result instanceof Error) throw result;
      return result as never;
    };
  return {
    calls,
    port: {
      register: record("register", "register"),
      revokeDevice: record("revokeDevice", "revoke_device"),
      issue: record("issue", "issue"),
      refresh: record("refresh", "refresh"),
      revoke: record("revoke", "revoke"),
    },
  };
}

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

test("opaque ids are 32 CSPRNG bytes as unpadded base64url and hash to lowercase SHA-256 hex", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 64; i += 1) {
    const id = generateOfficeAzInventoryMobileOpaqueId();
    assert.match(id, MOBILE_OPAQUE_ID_PATTERN);
    assert.equal(id.includes("="), false);
    assert.equal(Buffer.from(id, "base64url").byteLength, 32);
    assert.equal(seen.has(id), false);
    seen.add(id);
  }
  const value = "AbC_-123";
  assert.equal(hashOfficeAzInventoryMobilePublicValue(value), sha(value));
  assert.match(hashOfficeAzInventoryMobilePublicValue(value), HASH);
  assert.equal(hashOfficeAzInventoryMobilePublicValue("é"), sha("é"));
});

test("register persists hashes only and returns the generated deviceId only on success", async () => {
  const ids = sequence();
  const { port, calls } = fakePort();
  const result = await bindAuthorizedMobileOperation(
    { ok: true, operation: "register", ...shared, enrollmentCode: "enroll-raw" },
    { persistence: port, generateOpaqueId: ids.generate },
  );
  assert.deepEqual(result, {
    ok: true,
    operation: "register",
    accepted: true,
    deviceId: ids.values[0],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].input, {
    ...shared,
    requiredLocationIds: ["office-az-warehouse"],
    enrollmentCodeHash: sha("enroll-raw"),
    deviceIdHash: sha(ids.values[0]),
  });
  const persisted = allStrings(calls[0].input);
  assert.equal(persisted.includes("enroll-raw"), false);
  assert.equal(persisted.includes(ids.values[0]), false);
});

test("issue returns exact policy-duration payload and persists hashes only", async () => {
  const ids = sequence();
  const { port, calls } = fakePort();
  const result = await bindAuthorizedMobileOperation(
    { ok: true, operation: "issue", ...shared, deviceId: "device-raw" },
    { persistence: port, generateOpaqueId: ids.generate },
  );
  assert.deepEqual(result, {
    ok: true,
    operation: "issue",
    accepted: true,
    sessionId: ids.values[0],
    refreshToken: ids.values[1],
    refreshVersion: 1,
    accessLifetimeMs: 3_600_000,
    refreshAbsoluteCeilingMs: 43_200_000,
  });
  assert.deepEqual(calls[0].input, {
    ...shared,
    requiredLocationIds: ["office-az-warehouse"],
    deviceIdHash: sha("device-raw"),
    sessionIdHash: sha(ids.values[0]),
    refreshHash: sha(ids.values[1]),
  });
  for (const value of allStrings(result)) assert.doesNotMatch(value, HASH);
  for (const raw of ["device-raw", ...ids.values]) {
    assert.equal(allStrings(calls[0].input).includes(raw), false);
  }
});

test("refresh response has exactly five keys and no lifetime, cap, or expiry field", async () => {
  const ids = sequence();
  const { port, calls } = fakePort();
  const result = await bindAuthorizedMobileOperation(
    {
      ok: true,
      operation: "refresh",
      ...shared,
      sessionId: "session-raw",
      refreshToken: "refresh-current-raw",
      refreshVersion: 7,
    },
    { persistence: port, generateOpaqueId: ids.generate },
  );
  assert.deepEqual(result, {
    ok: true,
    operation: "refresh",
    accepted: true,
    refreshToken: ids.values[0],
    refreshVersion: 8,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "accepted",
    "ok",
    "operation",
    "refreshToken",
    "refreshVersion",
  ]);
  assert.deepEqual(calls[0].input, {
    ...shared,
    requiredLocationIds: ["office-az-warehouse"],
    sessionIdHash: sha("session-raw"),
    currentRefreshHash: sha("refresh-current-raw"),
    currentRefreshVersion: 7,
    nextRefreshHash: sha(ids.values[0]),
  });
});

test("near the absolute ceiling refresh still returns no fixed lifetime, matching D5B SQL", async () => {
  const sql = readFileSync(
    "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql",
    "utf8",
  );
  const refreshFn = sql.slice(sql.indexOf("create function public.office_az_inventory_mobile_refresh("));
  const body = refreshFn.slice(0, refreshFn.indexOf("$function$;"));
  assert.match(
    body,
    /access_expires_at\s*=\s*least\(\s*statement_timestamp\(\)\s*\+\s*interval '1 hour',\s*session_row\.absolute_expires_at\s*\)/,
  );

  const nearCeilingPort = fakePort(() => ({ ok: true, operation: "refresh" }));
  const result = await bindAuthorizedMobileOperation(
    {
      ok: true,
      operation: "refresh",
      ...shared,
      sessionId: "session-near-ceiling",
      refreshToken: "refresh-near-ceiling",
      refreshVersion: 11,
    },
    { persistence: nearCeilingPort.port, generateOpaqueId: sequence().generate },
  );
  assert.equal(result.ok, true);
  for (const key of [
    "accessLifetimeMs",
    "accessLifetimeCapMs",
    "refreshAbsoluteCeilingMs",
    "accessExpiresAt",
    "absoluteExpiresAt",
    "expiresAt",
    "expiresIn",
    "remainingMs",
  ]) {
    assert.equal(key in result, false, key);
  }
});

test("revoke and revoke_device return the three-key acknowledgement and generate nothing", async () => {
  let generated = 0;
  const generate = () => {
    generated += 1;
    return Buffer.alloc(32, 9).toString("base64url");
  };
  const { port, calls } = fakePort();
  assert.deepEqual(
    await bindAuthorizedMobileOperation(
      { ok: true, operation: "revoke", ...shared, sessionId: "session-raw" },
      { persistence: port, generateOpaqueId: generate },
    ),
    { ok: true, operation: "revoke", accepted: true },
  );
  assert.deepEqual(
    await bindAuthorizedMobileOperation(
      { ok: true, operation: "revoke_device", ...shared, deviceId: "device-raw" },
      { persistence: port, generateOpaqueId: generate },
    ),
    { ok: true, operation: "revoke_device", accepted: true },
  );
  assert.equal(generated, 0);
  assert.deepEqual(calls[0].input, {
    ...shared,
    requiredLocationIds: ["office-az-warehouse"],
    sessionIdHash: sha("session-raw"),
  });
  assert.deepEqual(calls[1].input, {
    ...shared,
    requiredLocationIds: ["office-az-warehouse"],
    deviceIdHash: sha("device-raw"),
  });
});

test("persist failures map to stable public codes and never return generated raw values", async () => {
  const cases: Array<[unknown, string]> = [
    [{ ok: false, code: "not_configured" }, "dependency_not_configured"],
    [{ ok: false, code: "invalid_request" }, "invalid_request"],
    [{ ok: false, code: "invalid_or_stale" }, "session_invalid_or_stale"],
    [{ ok: false, code: "failed" }, "downstream_failure"],
    [{ ok: true, operation: "register" }, "downstream_failure"],
    [null, "downstream_failure"],
    [new Error("boom"), "downstream_failure"],
  ];
  for (const [outcome, code] of cases) {
    const ids = sequence();
    const { port } = fakePort(() => outcome);
    const result = await bindAuthorizedMobileOperation(
      { ok: true, operation: "issue", ...shared, deviceId: "device-raw" },
      { persistence: port, generateOpaqueId: ids.generate },
    );
    assert.deepEqual(result, { ok: false, code });
    const text = JSON.stringify(result);
    for (const raw of [...ids.values, "device-raw"]) assert.equal(text.includes(raw), false);
    assert.doesNotMatch(text, /[a-f0-9]{64}/);
  }
});

test("replay and identity collision surface as session_invalid_or_stale without raw values", async () => {
  const ids = sequence();
  const { port } = fakePort(() => ({ ok: false, code: "invalid_or_stale" }));
  const replay = await bindAuthorizedMobileOperation(
    {
      ok: true,
      operation: "refresh",
      ...shared,
      sessionId: "session-raw",
      refreshToken: "reused-refresh",
      refreshVersion: 2,
    },
    { persistence: port, generateOpaqueId: ids.generate },
  );
  const collision = await bindAuthorizedMobileOperation(
    { ok: true, operation: "register", ...shared, enrollmentCode: "enroll-raw" },
    { persistence: port, generateOpaqueId: ids.generate },
  );
  assert.deepEqual(replay, { ok: false, code: "session_invalid_or_stale" });
  assert.deepEqual(collision, { ok: false, code: "session_invalid_or_stale" });
});

test("default null persistence client stays dependency_not_configured", async () => {
  const result = await bindAuthorizedMobileOperation(
    { ok: true, operation: "issue", ...shared, deviceId: "device-raw" },
    {
      persistence: createOfficeAzInventoryMobilePersistence(null),
      generateOpaqueId: generateOfficeAzInventoryMobileOpaqueId,
    },
  );
  assert.deepEqual(result, { ok: false, code: "dependency_not_configured" });
});

test("location cardinality and malformed generator output fail closed before persistence", async () => {
  const { port, calls } = fakePort();
  assert.deepEqual(
    await bindAuthorizedMobileOperation(
      {
        ok: true,
        operation: "issue",
        ...shared,
        requiredLocationIds: ["a", "b"],
        deviceId: "device-raw",
      },
      { persistence: port, generateOpaqueId: sequence().generate },
    ),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    await bindAuthorizedMobileOperation(
      { ok: true, operation: "register", ...shared, enrollmentCode: "enroll-raw" },
      { persistence: port, generateOpaqueId: () => "short" },
    ),
    { ok: false, code: "downstream_failure" },
  );
  const same = Buffer.alloc(32, 4).toString("base64url");
  assert.deepEqual(
    await bindAuthorizedMobileOperation(
      { ok: true, operation: "issue", ...shared, deviceId: "device-raw" },
      { persistence: port, generateOpaqueId: () => same },
    ),
    { ok: false, code: "downstream_failure" },
  );
  assert.equal(calls.length, 0);
});

test("binding source never reads env, logs, or commits a hostname", () => {
  const source = readFileSync(
    "src/lib/inventory/mobile/office-az-inventory-mobile-binding.ts",
    "utf8",
  );
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("console."), false);
  assert.equal(source.includes("https://"), false);
  assert.match(source, /randomBytes\(MOBILE_OPAQUE_ID_BYTES\)\.toString\("base64url"\)/);
});
