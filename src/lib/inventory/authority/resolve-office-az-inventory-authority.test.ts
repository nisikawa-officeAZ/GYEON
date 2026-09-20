import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_A = "office-az-warehouse";
let currentUser: { id: string } | null = { id: USER_ID };
let rpcData: unknown;
let rpcError: unknown = null;
let rpcThrows = false;
let rpcCalls: Array<[string, Record<string, unknown>]> = [];

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    source: "server_resolved",
    authenticatedUserId: USER_ID,
    actorId: "actor-1",
    operatorId: "operator-1",
    principalKind: "human",
    status: "active",
    owner: "OFFICE_AZ",
    role: "office_az_warehouse_operator",
    capabilities: ["inventory.quantity.read"],
    allowedLocationIds: [LOCATION_A],
    validFromIso: "2026-01-01T00:00:00.000Z",
    validUntilIso: null,
    authorityVersion: 1,
    ...overrides,
  };
}

mock.module("@/lib/auth/get-current-user", {
  namedExports: { getCurrentUser: async () => currentUser },
});
mock.module("server-only", { defaultExport: {} });
mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (rpcThrows) throw new Error("hidden database detail");
        return { data: rpcData, error: rpcError };
      },
    }),
  },
});

type ResolverModule = typeof import("./resolve-office-az-inventory-authority");
let resolveAuthority: ResolverModule["resolveOfficeAzInventoryAuthority"];

before(async () => {
  ({ resolveOfficeAzInventoryAuthority: resolveAuthority } = await import(
    "./resolve-office-az-inventory-authority"
  ));
});

beforeEach(() => {
  currentUser = { id: USER_ID };
  rpcData = { candidates: [candidate()], knownLocationIds: [LOCATION_A] };
  rpcError = null;
  rpcThrows = false;
  rpcCalls = [];
});

function request(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "actor-1",
    operatorId: "operator-1",
    capability: "inventory.quantity.read",
    requiredLocationIds: [LOCATION_A],
    expectedAuthorityVersion: 1,
    ...overrides,
  };
}

test("authenticated identity is request-scoped and RPC runs exactly once", async () => {
  const result = await resolveAuthority(request());
  assert.equal(result.tag, "authorized");
  assert.deepEqual(rpcCalls, [[
    "resolve_office_az_inventory_authority",
    { p_actor_id: "actor-1", p_operator_id: "operator-1" },
  ]]);
  if (result.tag === "authorized") {
    assert.equal(result.authority.authenticatedUserId, USER_ID);
    assert.match(result.authority.resolvedAtIso, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("browser authority fields are rejected before RPC", async () => {
  const result = await resolveAuthority(request({ authenticatedUserId: "attacker" }));
  assert.deepEqual(result, { tag: "denied", code: "INVALID_REQUEST" });
  assert.equal(rpcCalls.length, 0);
});

test("zero and multiple assignments remain fail-closed", async () => {
  rpcData = { candidates: [], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "ZERO_ASSIGNMENT" });
  rpcData = { candidates: [candidate(), candidate()], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "MULTIPLE_ASSIGNMENTS" });
});

for (const [label, overrides, code] of [
  ["suspended", { status: "suspended" }, "INACTIVE_OPERATOR"],
  ["revoked", { status: "revoked" }, "INACTIVE_OPERATOR"],
  ["not-yet-valid", { validFromIso: "2099-01-01T00:00:00.000Z" }, "NOT_YET_VALID"],
  ["expired", { validUntilIso: "2026-01-02T00:00:00.000Z" }, "EXPIRED"],
] as const) {
  test(`${label} candidate is denied`, async () => {
    rpcData = { candidates: [candidate(overrides)], knownLocationIds: [LOCATION_A] };
    assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code });
  });
}

test("missing and stale versions are denied", async () => {
  rpcData = { candidates: [candidate({ authorityVersion: 0 })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "MISSING_AUTHORITY_VERSION" });
  rpcData = { candidates: [candidate({ authorityVersion: 2 })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "STALE_AUTHORITY_VERSION" });
});

test("unknown and non-granted locations are denied", async () => {
  assert.deepEqual(
    await resolveAuthority(request({ requiredLocationIds: ["unknown"] })),
    { tag: "denied", code: "UNKNOWN_LOCATION" },
  );
  rpcData = { candidates: [candidate({ allowedLocationIds: [] })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "LOCATION_NOT_GRANTED" });
});

test("transfer requires exactly two distinct known granted locations", async () => {
  rpcData = {
    candidates: [candidate({
      role: "office_az_warehouse_manager",
      capabilities: ["inventory.transfer.request"],
      allowedLocationIds: [LOCATION_A, "office-az-store"],
    })],
    knownLocationIds: [LOCATION_A, "office-az-store"],
  };
  assert.deepEqual(
    await resolveAuthority(request({ capability: "inventory.transfer.request" })),
    { tag: "denied", code: "INVALID_TRANSFER_SCOPE" },
  );
  const result = await resolveAuthority(request({
    capability: "inventory.transfer.request",
    requiredLocationIds: [LOCATION_A, "office-az-store"],
  }));
  assert.equal(result.tag, "authorized");
});

test("actor collision, self action, capability mismatch and non-grant are denied", async () => {
  rpcData = { candidates: [candidate({ actorId: "operator-1" })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(
    await resolveAuthority(request({ actorId: "operator-1" })),
    { tag: "denied", code: "ACTOR_OPERATOR_COLLISION" },
  );
  rpcData = { candidates: [candidate()], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(
    await resolveAuthority(request({ targetOperatorId: "operator-1" })),
    { tag: "denied", code: "SELF_ACTION_PROHIBITED" },
  );
  assert.deepEqual(
    await resolveAuthority(request({ capability: "inventory.adjust" })),
    { tag: "denied", code: "ROLE_CAPABILITY_MISMATCH" },
  );
  rpcData = { candidates: [candidate({ capabilities: [] })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(
    await resolveAuthority(request()),
    { tag: "denied", code: "CAPABILITY_NOT_GRANTED" },
  );
});

test("service authority is explicitly not configured", async () => {
  rpcData = { candidates: [candidate({
    principalKind: "service",
    role: "office_az_inventory_service",
  })], knownLocationIds: [LOCATION_A] };
  assert.deepEqual(await resolveAuthority(request()), {
    tag: "not_configured",
    code: "SERVICE_AUTHORITY_NOT_CONFIGURED",
  });
});

test("unauthenticated, RPC error, throw and malformed payload fail closed", async () => {
  currentUser = null;
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "INVALID_REQUEST" });
  currentUser = { id: USER_ID };
  rpcError = { message: "secret" };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "INVALID_AUTHORITY_RECORD" });
  rpcError = null;
  rpcThrows = true;
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "INVALID_AUTHORITY_RECORD" });
  rpcThrows = false;
  rpcData = { candidates: [], knownLocationIds: [], extra: true };
  assert.deepEqual(await resolveAuthority(request()), { tag: "denied", code: "INVALID_AUTHORITY_RECORD" });
});
