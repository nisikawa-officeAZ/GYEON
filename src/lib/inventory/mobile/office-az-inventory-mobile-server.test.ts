import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

mock.module("server-only", { namedExports: {} });

const authorityCalls: Array<{
  input: unknown;
  authenticatedUserId: string;
  authorizationHeader: string | null;
}> = [];
let authorityResult: unknown = { tag: "authorized", authority: { role: "office_az_inventory_super_admin" } };
let cookieResolverCalls = 0;

mock.module("../authority/resolve-office-az-inventory-authority", {
  namedExports: {
    resolveOfficeAzInventoryAuthority: async () => {
      cookieResolverCalls += 1;
      throw new Error("cookie authority resolver must not be used");
    },
    resolveOfficeAzInventoryAuthorityForBearerUser: async (
      input: unknown,
      authenticatedUserId: string,
      authorizationHeader: string | null,
    ) => {
      authorityCalls.push({ input, authenticatedUserId, authorizationHeader });
      return authorityResult;
    },
  },
});

let bearerResult: unknown = { tag: "authenticated", userId: "auth-user-1" };
mock.module("./resolve-office-az-inventory-mobile-bearer", {
  namedExports: {
    resolveOfficeAzInventoryMobileBearer: async () => bearerResult,
  },
});

type Server = typeof import("./office-az-inventory-mobile-server");
let executeMobileSessionBoundary: Server["executeMobileSessionBoundary"];
let executeMobileDeviceBoundary: Server["executeMobileDeviceBoundary"];
let createMobileBoundaryExecutor: Server["createMobileBoundaryExecutor"];

before(async () => {
  ({ executeMobileSessionBoundary, executeMobileDeviceBoundary, createMobileBoundaryExecutor } =
    await import("./office-az-inventory-mobile-server"));
});

beforeEach(() => {
  authorityCalls.length = 0;
  cookieResolverCalls = 0;
  authorityResult = { tag: "authorized", authority: { role: "office_az_inventory_super_admin" } };
  bearerResult = { tag: "authenticated", userId: "auth-user-1" };
});

const sharedAuthority = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 1,
  requiredLocationIds: ["office-az-warehouse"],
};

const sessionIssue = {
  operation: "issue",
  ...sharedAuthority,
  deviceId: "device-1",
};

const sessionRefresh = {
  operation: "refresh",
  ...sharedAuthority,
  sessionId: "sess-1",
  refreshToken: "refresh-1",
  refreshVersion: 1,
};

const sessionRevoke = {
  operation: "revoke",
  ...sharedAuthority,
  sessionId: "sess-1",
};

type PersistCall = { method: string; input: Record<string, unknown> };

function injectedExecutor(outcome: unknown = "accept") {
  const calls: PersistCall[] = [];
  let generated = 0;
  const handler = (method: string, operation: string) => async (input: unknown) => {
    calls.push({ method, input: input as Record<string, unknown> });
    return (outcome === "accept" ? { ok: true, operation } : outcome) as never;
  };
  const executor = createMobileBoundaryExecutor({
    persistence: {
      register: handler("register", "register"),
      revokeDevice: handler("revokeDevice", "revoke_device"),
      issue: handler("issue", "issue"),
      refresh: handler("refresh", "refresh"),
      revoke: handler("revoke", "revoke"),
    },
    generateOpaqueId: () => {
      generated += 1;
      return Buffer.alloc(32, generated).toString("base64url");
    },
  });
  return { executor, calls, generatedCount: () => generated };
}

test("unauthenticated bearer fails before authority with no token in the result", async () => {
  bearerResult = { tag: "denied", code: "UNAUTHENTICATED" };
  const result = await executeMobileSessionBoundary(sessionIssue, "Bearer stolen");
  assert.deepEqual(result, { ok: false, code: "unauthenticated" });
  assert.deepEqual(authorityCalls, []);
  assert.equal(JSON.stringify(result).includes("stolen"), false);
});

test("passed session issue returns dependency_not_configured and never invents a session", async () => {
  const first = await executeMobileSessionBoundary(sessionIssue, "Bearer ok");
  const second = await executeMobileSessionBoundary(sessionIssue, "Bearer ok");
  assert.deepEqual(first, { ok: false, code: "dependency_not_configured" });
  assert.deepEqual(second, { ok: false, code: "dependency_not_configured" });
  assert.equal("sessionId" in first, false);
  assert.equal(JSON.stringify(first).includes("Bearer"), false);
  assert.equal(cookieResolverCalls, 0);
  assert.equal(authorityCalls[0]?.authenticatedUserId, "auth-user-1");
  assert.equal(authorityCalls[0]?.authorizationHeader, "Bearer ok");
  assert.deepEqual(
    (authorityCalls[0]?.input as { capability: string }).capability,
    "inventory.session.issue",
  );
});

test("refresh reuse and concurrent refresh stay at the dependency boundary", async () => {
  const [a, b] = await Promise.all([
    executeMobileSessionBoundary(sessionRefresh, "Bearer ok"),
    executeMobileSessionBoundary(sessionRefresh, "Bearer ok"),
  ]);
  assert.deepEqual(a, { ok: false, code: "dependency_not_configured" });
  assert.deepEqual(b, { ok: false, code: "dependency_not_configured" });
});

test("revoke versus request race has no partial Book session state", async () => {
  const [issued, revoked] = await Promise.all([
    executeMobileSessionBoundary(sessionIssue, "Bearer ok"),
    executeMobileSessionBoundary(sessionRevoke, "Bearer ok"),
  ]);
  assert.deepEqual(issued, { ok: false, code: "dependency_not_configured" });
  assert.deepEqual(revoked, { ok: false, code: "dependency_not_configured" });
  assert.deepEqual(
    new Set(authorityCalls.map((call) => (call.input as { capability: string }).capability)),
    new Set(["inventory.session.issue", "inventory.session.revoke"]),
  );
});

test("register and revoke_device use separate capabilities", async () => {
  await executeMobileDeviceBoundary(
    {
      operation: "register",
      actorId: "actor-1",
      operatorId: "operator-1",
      expectedAuthorityVersion: 1,
      requiredLocationIds: ["office-az-warehouse"],
      enrollmentCode: "enroll-1",
    },
    "Bearer ok",
  );
  await executeMobileDeviceBoundary(
    {
      operation: "revoke_device",
      actorId: "actor-1",
      operatorId: "operator-1",
      expectedAuthorityVersion: 1,
      requiredLocationIds: ["office-az-warehouse"],
      deviceId: "device-1",
    },
    "Bearer ok",
  );
  assert.deepEqual(
    authorityCalls.map((call) => (call.input as { capability: string }).capability),
    ["inventory.device.register", "inventory.session.revoke"],
  );
});

test("suspended operator, stale version, and capability deny map to public codes", async () => {
  authorityResult = { tag: "denied", code: "INACTIVE_OPERATOR" };
  assert.deepEqual(await executeMobileSessionBoundary(sessionIssue, "Bearer ok"), {
    ok: false,
    code: "operator_inactive",
  });
  authorityResult = { tag: "denied", code: "STALE_AUTHORITY_VERSION" };
  assert.deepEqual(await executeMobileSessionBoundary(sessionIssue, "Bearer ok"), {
    ok: false,
    code: "stale_version",
  });
  authorityResult = { tag: "denied", code: "CAPABILITY_NOT_GRANTED" };
  assert.deepEqual(await executeMobileDeviceBoundary(
    {
      operation: "register",
      actorId: "actor-1",
      operatorId: "operator-1",
      expectedAuthorityVersion: 1,
      requiredLocationIds: ["office-az-warehouse"],
      enrollmentCode: "enroll-1",
    },
    "Bearer ok",
  ), { ok: false, code: "authorization_denied" });
});

test("wrong owner or location deny after bearer", async () => {
  authorityResult = { tag: "denied", code: "OWNER_MISMATCH" };
  assert.deepEqual(await executeMobileSessionBoundary(sessionIssue, "Bearer ok"), {
    ok: false,
    code: "owner_scope_denied",
  });
  authorityResult = { tag: "denied", code: "LOCATION_NOT_GRANTED" };
  assert.deepEqual(await executeMobileSessionBoundary(sessionIssue, "Bearer ok"), {
    ok: false,
    code: "location_scope_denied",
  });
});

test("quantity-read is not used for issue or refresh", async () => {
  await executeMobileSessionBoundary(sessionIssue, "Bearer ok");
  await executeMobileSessionBoundary(sessionRefresh, "Bearer ok");
  assert.deepEqual(
    authorityCalls.map((call) => (call.input as { capability: string }).capability),
    ["inventory.session.issue", "inventory.session.issue"],
  );
});

test("authenticated user mismatch fails closed without a session", async () => {
  authorityResult = { tag: "denied", code: "AUTHENTICATED_USER_MISMATCH" };
  const result = await executeMobileSessionBoundary(sessionIssue, "Bearer ok");
  assert.deepEqual(result, { ok: false, code: "authorization_denied" });
  assert.equal("sessionId" in result, false);
});

test("client overrides are rejected before bearer and authority", async () => {
  const result = await executeMobileSessionBoundary(
    { ...sessionIssue, idempotencyKey: "k", expiresIn: 9 },
    "Bearer ok",
  );
  assert.deepEqual(result, { ok: false, code: "invalid_request" });
  assert.deepEqual(authorityCalls, []);
});

test("source does not read env or commit a hostname", () => {
  const source = [
    readFileSync("src/lib/inventory/mobile/office-az-inventory-mobile-server.ts", "utf8"),
    readFileSync("src/lib/inventory/mobile/office-az-inventory-mobile-session-types.ts", "utf8"),
    readFileSync("src/lib/inventory/mobile/office-az-inventory-mobile-binding.ts", "utf8"),
  ].join("\n");
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("https://"), false);
  assert.equal(source.includes("console."), false);
  assert.match(source, /dependency_not_configured/);
});

test("deployed executor keeps the null persistence client and stays 503", () => {
  const server = readFileSync(
    "src/lib/inventory/mobile/office-az-inventory-mobile-server.ts",
    "utf8",
  );
  assert.match(server, /createOfficeAzInventoryMobilePersistence\(null\)/);
  assert.equal(server.includes("createOfficeAzInventoryMobileBearerClient"), false);
});

test("identity generation happens only after bearer and authorized authority", async () => {
  const unauth = injectedExecutor();
  bearerResult = { tag: "denied", code: "UNAUTHENTICATED" };
  assert.deepEqual(await unauth.executor.executeMobileSessionBoundary(sessionIssue, "Bearer x"), {
    ok: false,
    code: "unauthenticated",
  });
  assert.equal(unauth.generatedCount(), 0);
  assert.equal(unauth.calls.length, 0);

  bearerResult = { tag: "authenticated", userId: "auth-user-1" };
  const denied = injectedExecutor();
  authorityResult = { tag: "denied", code: "CAPABILITY_NOT_GRANTED" };
  assert.deepEqual(
    await denied.executor.executeMobileDeviceBoundary(
      { operation: "register", ...sharedAuthority, enrollmentCode: "enroll-1" },
      "Bearer ok",
    ),
    { ok: false, code: "authorization_denied" },
  );
  assert.equal(denied.generatedCount(), 0);
  assert.equal(denied.calls.length, 0);

  const invalid = injectedExecutor();
  authorityCalls.length = 0;
  authorityResult = { tag: "authorized", authority: { role: "office_az_inventory_super_admin" } };
  assert.deepEqual(
    await invalid.executor.executeMobileSessionBoundary(
      { ...sessionRefresh, deviceId: "device-1" },
      "Bearer ok",
    ),
    { ok: false, code: "invalid_request" },
  );
  assert.equal(invalid.generatedCount(), 0);
  assert.deepEqual(authorityCalls, []);
});

test("authorized operations reach the injected port with hashes and return exact payloads", async () => {
  const { executor, calls } = injectedExecutor();
  const issued = await executor.executeMobileSessionBoundary(sessionIssue, "Bearer ok");
  assert.deepEqual(Object.keys(issued).sort(), [
    "accepted",
    "accessLifetimeMs",
    "ok",
    "operation",
    "refreshAbsoluteCeilingMs",
    "refreshToken",
    "refreshVersion",
    "sessionId",
  ]);
  const refreshed = await executor.executeMobileSessionBoundary(sessionRefresh, "Bearer ok");
  assert.deepEqual(Object.keys(refreshed).sort(), [
    "accepted",
    "ok",
    "operation",
    "refreshToken",
    "refreshVersion",
  ]);
  assert.equal((refreshed as { refreshVersion: number }).refreshVersion, 2);
  assert.deepEqual(await executor.executeMobileSessionBoundary(sessionRevoke, "Bearer ok"), {
    ok: true,
    operation: "revoke",
    accepted: true,
  });
  const registered = await executor.executeMobileDeviceBoundary(
    { operation: "register", ...sharedAuthority, enrollmentCode: "enroll-1" },
    "Bearer ok",
  );
  assert.deepEqual(Object.keys(registered).sort(), ["accepted", "deviceId", "ok", "operation"]);
  assert.deepEqual(
    calls.map((call) => call.method),
    ["issue", "refresh", "revoke", "register"],
  );
  for (const call of calls) {
    for (const [key, value] of Object.entries(call.input)) {
      if (key.endsWith("Hash")) assert.match(String(value), /^[a-f0-9]{64}$/);
    }
    const text = JSON.stringify(call.input);
    for (const raw of ["device-1", "sess-1", "refresh-1", "enroll-1", "Bearer ok"]) {
      assert.equal(text.includes(raw), false);
    }
  }
});

test("injected persist failures map to stable public codes with no raw identity", async () => {
  for (const [outcome, code] of [
    [{ ok: false, code: "invalid_or_stale" }, "session_invalid_or_stale"],
    [{ ok: false, code: "failed" }, "downstream_failure"],
    [{ ok: false, code: "not_configured" }, "dependency_not_configured"],
  ] as const) {
    const { executor } = injectedExecutor(outcome);
    const result = await executor.executeMobileSessionBoundary(sessionIssue, "Bearer ok");
    assert.deepEqual(result, { ok: false, code });
  }
});

test("multiple locations are rejected before persistence after authorization", async () => {
  const { executor, calls, generatedCount } = injectedExecutor();
  const result = await executor.executeMobileSessionBoundary(
    { ...sessionIssue, requiredLocationIds: ["office-az-warehouse", "office-az-annex"] },
    "Bearer ok",
  );
  assert.deepEqual(result, { ok: false, code: "invalid_request" });
  assert.equal(calls.length, 0);
  assert.equal(generatedCount(), 0);
});
