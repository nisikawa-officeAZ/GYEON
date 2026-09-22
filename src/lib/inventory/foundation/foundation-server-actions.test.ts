import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

mock.module("server-only", {
  namedExports: {},
});

mock.module("@nisikawa-officeaz/detaileros-inventory-foundation", {
  namedExports: {
    createInventoryCommandDispatch: () => ({
      dispatch: () => ({}),
      auditLog: () => [],
    }),
    evaluateInventoryRuntimeRecoveryEvidence: () => ({ ok: false }),
    exportInventoryRuntimeSnapshot: () => ({
      contract: "INV001-P18_RUNTIME_SNAPSHOT_V3",
      snapshot: {},
    }),
    importInventoryRuntimeSnapshot: () => ({ ok: false }),
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT: "INV001-P18_RUNTIME_SNAPSHOT_V3",
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1: "INV001-P12_RUNTIME_SNAPSHOT_V1",
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2: "INV001-P17_RUNTIME_SNAPSHOT_V2",
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3: "INV001-P18_RUNTIME_SNAPSHOT_V3",
    isInventoryRuntimeCommand: () => false,
    validateInventoryRuntimeAuditLog: () => ({ ok: false }),
    parseFoundationLegalOwner: () => ({ ok: false }),
    parseFoundationProductId: () => ({ ok: false }),
    parseFoundationProductIdentityRevision: () => ({ ok: false }),
  },
});

const authorityCalls: unknown[] = [];
let authorityResult: unknown = { tag: "denied", code: "ZERO_ASSIGNMENT" };
let authorityThrows = false;

mock.module("../authority/resolve-office-az-inventory-authority.js", {
  namedExports: {
    resolveOfficeAzInventoryAuthority: async (input: unknown) => {
      authorityCalls.push(input);
      if (authorityThrows) throw new Error("hidden resolver detail");
      return authorityResult;
    },
  },
});

type Actions = typeof import("./foundation-server-actions");
let executeFoundationServerBoundary: Actions["executeFoundationServerBoundary"];
let parseFoundationBoundaryRequest: Actions["parseFoundationBoundaryRequest"];

before(async () => {
  ({ executeFoundationServerBoundary, parseFoundationBoundaryRequest } = await import(
    "./foundation-server-actions.js"
  ));
});

beforeEach(() => {
  authorityCalls.length = 0;
  authorityResult = { tag: "denied", code: "ZERO_ASSIGNMENT" };
  authorityThrows = false;
});

const PRODUCT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const baseRequest = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 1,
  requiredLocationIds: ["office-az-warehouse"],
  operation: "audit_read",
};

function authorized() {
  return {
    tag: "authorized",
    authority: {
      authenticatedUserId: "user-1",
      actorId: "actor-1",
      operatorId: "operator-1",
      principalKind: "human",
      status: "active",
      owner: "OFFICE_AZ",
      role: "office_az_warehouse_manager",
      capability: "inventory.audit.read",
      requiredLocationIds: ["office-az-warehouse"],
      authorityVersion: 1,
      validFromIso: "2026-09-01T00:00:00.000Z",
      validUntilIso: null,
      resolvedAtIso: "2026-09-21T00:00:00.000Z",
    },
  };
}

function mockPort() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const port = {
    dispatchCommand: (request: unknown) => {
      calls.push({ method: "dispatchCommand", args: [request] });
      return { tag: "success" as const, value: { accepted: true, secret: "raw" } };
    },
    readAuditLog: (request: unknown) => {
      calls.push({ method: "readAuditLog", args: [request] });
      return { tag: "success" as const, value: [{ raw: "audit" }] };
    },
    exportSnapshot: (request: unknown) => {
      calls.push({ method: "exportSnapshot", args: [request] });
      return { tag: "success" as const, value: { snapshot: true, locations: ["a"] } };
    },
    importSnapshot: (request: unknown) => {
      calls.push({ method: "importSnapshot", args: [request] });
      return { tag: "success" as const, value: { imported: true } };
    },
    evaluateRecoveryEvidence: (request: unknown) => {
      calls.push({ method: "evaluateRecoveryEvidence", args: [request] });
      return { tag: "success" as const, value: { ok: true, evidence: "raw" } };
    },
  };
  return { port, calls };
}

test("source is server-only orchestration and never a public Server Action", () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "foundation-server-actions.ts"),
    "utf8",
  );
  assert.match(source, /import "server-only"/);
  assert.equal(source.includes('"use server"'), false);
  assert.match(source, /resolveOfficeAzInventoryAuthority/);
  assert.match(source, /createFoundationRuntimePackagePort/);
  assert.match(source, /executeWithFoundationPersistence/);
  assert.match(source, /resolveFoundationProduct/);
  assert.equal(source.includes("getCurrentDealer"), false);
  assert.equal(source.includes("requireStaffCapability"), false);
  assert.equal(source.includes("createAdminClient"), false);
  assert.equal(source.includes("getSession"), false);
  assert.equal(source.includes("evaluateOfficeAzInventoryAuthorityAction"), false);
});

test("equal actor and operator fail closed before authority or downstream", async () => {
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    { ...baseRequest, operatorId: "actor-1" },
    { port },
  );
  assert.deepEqual(result, { ok: false, code: "invalid_request" });
  assert.equal(authorityCalls.length, 0);
  assert.equal(calls.length, 0);
});

test("browser-supplied authority fields are rejected before resolver", async () => {
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    { ...baseRequest, role: "owner" },
    { port },
  );
  assert.deepEqual(result, { ok: false, code: "invalid_request" });
  assert.equal(authorityCalls.length, 0);
  assert.equal(calls.length, 0);
});

test("dealer role strings are not an authority input", () => {
  assert.deepEqual(parseFoundationBoundaryRequest({ ...baseRequest, role: "manager" }), {
    ok: false,
    code: "invalid_request",
  });
});

for (const command of [
  "reserve",
  "cancel_reservation",
  "confirm_shipment",
  "open_fulfillment",
  "authorize_with_evidence",
] as const) {
  test(`service-only ${command} fails closed with zero calls`, async () => {
    const { port, calls } = mockPort();
    const result = await executeFoundationServerBoundary(
      {
        ...baseRequest,
        operation: "command",
        command,
        bookProductId: PRODUCT,
        expectedMappingRevision: 1,
      },
      { port },
    );
    assert.deepEqual(result, { ok: false, code: "dependency_not_configured" });
    assert.equal(authorityCalls.length, 0);
    assert.equal(calls.length, 0);
  });
}

test("missing grants map to operator_authority_not_configured with zero downstream", async () => {
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(baseRequest, { port });
  assert.deepEqual(result, {
    ok: false,
    code: "operator_authority_not_configured",
  });
  assert.equal(authorityCalls.length, 1);
  assert.equal(calls.length, 0);
});

test("unauthenticated resolver denial maps to 401 public code with zero downstream", async () => {
  authorityResult = { tag: "denied", code: "UNAUTHENTICATED" };
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(baseRequest, { port });
  assert.deepEqual(result, { ok: false, code: "unauthenticated" });
  assert.equal(authorityCalls.length, 1);
  assert.equal(calls.length, 0);
});

test("unknown operation is unknown_operation before resolver", async () => {
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    { ...baseRequest, operation: "generic_proxy" },
    { port },
  );
  assert.deepEqual(result, { ok: false, code: "unknown_operation" });
  assert.equal(authorityCalls.length, 0);
  assert.equal(calls.length, 0);
});

test("unknown command is unknown_operation before resolver", async () => {
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    {
      ...baseRequest,
      operation: "command",
      command: "not_a_foundation_command",
      bookProductId: PRODUCT,
      expectedMappingRevision: 1,
    },
    { port },
  );
  assert.deepEqual(result, { ok: false, code: "unknown_operation" });
  assert.equal(authorityCalls.length, 0);
  assert.equal(calls.length, 0);
});

test("client-owned request metadata is rejected before resolver", async () => {
  const { port, calls } = mockPort();
  for (const extra of [
    { requestId: "client-req" },
    { idempotencyKey: "client-key" },
    { aggregateVersion: 3 },
    { authorizationEvidence: { token: "x" } },
    { recoveryEvidence: { raw: true } },
    { payload: { secret: 1 } },
  ]) {
    const result = await executeFoundationServerBoundary({ ...baseRequest, ...extra }, { port });
    assert.deepEqual(result, { ok: false, code: "invalid_request" });
  }
  assert.equal(authorityCalls.length, 0);
  assert.equal(calls.length, 0);
});

test("command without mapping store fails after auth with zero downstream", async () => {
  authorityResult = authorized();
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    {
      actorId: "actor-1",
      operatorId: "operator-1",
      expectedAuthorityVersion: 1,
      requiredLocationIds: ["office-az-warehouse"],
      operation: "command",
      command: "receive_supplier_shipment",
      bookProductId: PRODUCT,
      expectedMappingRevision: 1,
    },
    { port },
  );
  assert.deepEqual(result, {
    ok: false,
    code: "product_mapping_not_configured",
  });
  assert.equal(calls.length, 0);
});

test("authorized audit read invokes exactly one downstream surface and returns a sanitized DTO", async () => {
  authorityResult = authorized();
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(baseRequest, {
    port,
    requestedAtIso: "2026-09-21T00:00:00.000Z",
    requestId: "server-req-1",
  });
  assert.deepEqual(result, { ok: true, operation: "audit_read", accepted: true });
  assert.equal("result" in result, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "readAuditLog");
  const request = calls[0]?.args[0] as {
    bookContext: { bookRequestId: string };
    native: { requestId: string; idempotencyKey: string; aggregateVersion?: unknown };
  };
  assert.equal(request.bookContext.bookRequestId, "server-req-1");
  assert.equal(request.native.requestId, "server-req-1");
  assert.equal(request.native.idempotencyKey, "inv001-d4:server-req-1");
  assert.equal("aggregateVersion" in request.native, false);
});

test("quantity query never invents a numeric zero or calls a port", async () => {
  authorityResult = authorized();
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(
    {
      ...baseRequest,
      operation: "quantity_query",
      bookProductId: PRODUCT,
      expectedMappingRevision: 1,
    },
    {
      port,
      mappingStore: {
        available: false,
        current: [],
        events: [],
        bookProducts: [],
      },
    },
  );
  assert.deepEqual(result, {
    ok: false,
    code: "product_mapping_not_configured",
  });
  assert.equal(calls.length, 0);
});

test("thrown resolver failures map to downstream_failure without a raw message", async () => {
  authorityThrows = true;
  const { port, calls } = mockPort();
  const result = await executeFoundationServerBoundary(baseRequest, { port });
  assert.deepEqual(result, { ok: false, code: "downstream_failure" });
  assert.equal(JSON.stringify(result).includes("hidden"), false);
  assert.equal(calls.length, 0);
});
