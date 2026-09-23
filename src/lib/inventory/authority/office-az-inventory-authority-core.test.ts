import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  OFFICE_AZ_ROLE_CAPABILITIES,
  evaluateOfficeAzInventoryAuthority,
  isOfficeAzInventoryAuthorityRole,
  isOfficeAzInventoryCapability,
  isOfficeAzRoleCapabilityCompatible,
} from "./office-az-inventory-authority-core";
import {
  OFFICE_AZ_INVENTORY_AUTHORITY_ROLES,
  OFFICE_AZ_INVENTORY_CAPABILITIES,
  type OfficeAzInventoryAuthorityRole,
  type OfficeAzInventoryCapability,
} from "./office-az-inventory-authority-types";

const LOCATIONS = ["loc-logistics", "loc-studio", "loc-office-az"] as const;
const NOW = "2026-09-20T00:00:00.000Z";

function candidate(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    source: "server_resolved",
    authenticatedUserId: "auth-user-1",
    actorId: "actor-1",
    operatorId: "operator-1",
    principalKind: "human",
    status: "active",
    owner: "OFFICE_AZ",
    role: "office_az_warehouse_operator",
    capabilities: ["inventory.quantity.read"],
    allowedLocationIds: [LOCATIONS[0]],
    validFromIso: "2026-01-01T00:00:00.000Z",
    validUntilIso: "2027-01-01T00:00:00.000Z",
    authorityVersion: 7,
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authenticatedUserId: "auth-user-1",
    actorId: "actor-1",
    operatorId: "operator-1",
    owner: "OFFICE_AZ",
    capability: "inventory.quantity.read",
    requiredLocationIds: [LOCATIONS[0]],
    expectedAuthorityVersion: 7,
    requestedAtIso: NOW,
    ...overrides,
  };
}

function codeOf(
  candidates: readonly unknown[],
  ...inputs: [requestInput?: unknown, knownLocations?: readonly unknown[]]
): string {
  const requestInput = inputs.length >= 1 ? inputs[0] : request();
  const knownLocations = inputs.length >= 2 ? inputs[1] : LOCATIONS;
  const result = evaluateOfficeAzInventoryAuthority(
    candidates,
    requestInput,
    knownLocations ?? LOCATIONS,
  );
  if (result.tag === "authorized") {
    assert.fail("expected an explicit denial or not-configured result");
  }
  return result.code;
}

test("role and capability vocabularies are exact, closed, and fail closed", () => {
  assert.equal(OFFICE_AZ_INVENTORY_AUTHORITY_ROLES.length, 4);
  assert.equal(OFFICE_AZ_INVENTORY_CAPABILITIES.length, 25);
  assert.equal(isOfficeAzInventoryAuthorityRole("office_az_warehouse_operator"), true);
  assert.equal(isOfficeAzInventoryAuthorityRole("warehouse_manager"), false);
  assert.equal(isOfficeAzInventoryCapability("inventory.quantity.read"), true);
  assert.equal(isOfficeAzInventoryCapability("inventory.manage"), false);
  assert.equal(isOfficeAzInventoryCapability({}), false);
});

test("every configured role/capability family is compatible and widening is denied", () => {
  for (const role of OFFICE_AZ_INVENTORY_AUTHORITY_ROLES) {
    for (const capability of OFFICE_AZ_ROLE_CAPABILITIES[role]) {
      assert.equal(isOfficeAzRoleCapabilityCompatible(role, capability), true);
    }
  }
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_operator",
      "inventory.adjust",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_manager",
      "inventory.operator.manage",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_inventory_super_admin",
      "inventory.fulfillment.open",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_operator",
      "inventory.device.register",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_operator",
      "inventory.session.revoke",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_manager",
      "inventory.device.register",
    ),
    false,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_manager",
      "inventory.session.revoke",
    ),
    true,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_inventory_super_admin",
      "inventory.device.register",
    ),
    true,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_operator",
      "inventory.session.issue",
    ),
    true,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_warehouse_manager",
      "inventory.session.issue",
    ),
    true,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_inventory_super_admin",
      "inventory.session.issue",
    ),
    true,
  );
  assert.equal(
    isOfficeAzRoleCapabilityCompatible(
      "office_az_inventory_service",
      "inventory.session.issue",
    ),
    false,
  );
});

test("positive vectors authorize every allowed human role/capability family", () => {
  const humanRoles = OFFICE_AZ_INVENTORY_AUTHORITY_ROLES.filter(
    (role) => role !== "office_az_inventory_service",
  );
  for (const role of humanRoles) {
    for (const capability of OFFICE_AZ_ROLE_CAPABILITIES[role]) {
      const transfer = capability.startsWith("inventory.transfer.");
      const locations = transfer ? [LOCATIONS[0], LOCATIONS[1]] : [LOCATIONS[0]];
      const targetOperatorId =
        capability === "inventory.operator.manage" ? "operator-2" : undefined;
      const result = evaluateOfficeAzInventoryAuthority(
        [
          candidate({
            role,
            capabilities: [capability],
            allowedLocationIds: locations,
          }),
        ],
        request({ capability, requiredLocationIds: locations, targetOperatorId }),
        LOCATIONS,
      );
      assert.equal(result.tag, "authorized", `${role} / ${capability}`);
      assert.ok(result.tag === "authorized");
      assert.equal(result.authority.role, role);
      assert.equal(result.authority.capability, capability);
    }
  }
});

test("service role stays NOT_CONFIGURED even for an otherwise compatible capability", () => {
  const result = evaluateOfficeAzInventoryAuthority(
    [
      candidate({
        principalKind: "service",
        role: "office_az_inventory_service",
        capabilities: ["inventory.fulfillment.open"],
      }),
    ],
    request({ capability: "inventory.fulfillment.open" }),
    LOCATIONS,
  );
  assert.deepEqual(result, {
    tag: "not_configured",
    code: "SERVICE_AUTHORITY_NOT_CONFIGURED",
  });
});

test("zero and multiple assignments fail closed", () => {
  assert.equal(codeOf([]), "ZERO_ASSIGNMENT");
  assert.equal(codeOf([candidate(), candidate()]), "MULTIPLE_ASSIGNMENTS");
});

test("browser authority, malformed records, unknown roles, and mixed principals deny", () => {
  assert.equal(codeOf([candidate({ source: "browser" })]), "BROWSER_SUPPLIED_AUTHORITY");
  assert.equal(codeOf([null]), "INVALID_AUTHORITY_RECORD");
  assert.equal(codeOf([candidate({ role: "admin" })]), "UNKNOWN_ROLE");
  assert.equal(
    codeOf([
      candidate({
        principalKind: "service",
        role: "office_az_warehouse_operator",
      }),
    ]),
    "PRINCIPAL_ROLE_MISMATCH",
  );
  assert.equal(
    codeOf([
      candidate({
        principalKind: "human",
        role: "office_az_inventory_service",
      }),
    ]),
    "PRINCIPAL_ROLE_MISMATCH",
  );
});

test("actor/operator linkage, separation, and self-management deny hostile requests", () => {
  assert.equal(
    codeOf([candidate()], request({ authenticatedUserId: "forged-user" })),
    "AUTHENTICATED_USER_MISMATCH",
  );
  assert.equal(
    codeOf([candidate()], request({ actorId: "forged-actor" })),
    "ACTOR_OPERATOR_MISMATCH",
  );
  assert.equal(
    codeOf([candidate({ actorId: "operator-1" })], request({ actorId: "operator-1" })),
    "ACTOR_OPERATOR_COLLISION",
  );
  assert.equal(
    codeOf(
      [
        candidate({
          role: "office_az_inventory_super_admin",
          capabilities: ["inventory.operator.manage"],
        }),
      ],
      request({
        capability: "inventory.operator.manage",
        targetOperatorId: "operator-1",
      }),
    ),
    "SELF_ACTION_PROHIBITED",
  );
});

test("inactive, cross-owner, unknown, incompatible, and absent capability deny", () => {
  for (const status of ["suspended", "revoked", "pending", undefined]) {
    assert.equal(codeOf([candidate({ status })]), "INACTIVE_OPERATOR");
  }
  assert.equal(codeOf([candidate({ owner: "ATTRACTION" })]), "OWNER_MISMATCH");
  assert.equal(
    codeOf([candidate()], request({ capability: "inventory.manage" })),
    "UNKNOWN_CAPABILITY",
  );
  assert.equal(
    codeOf([candidate()], request({ capability: "inventory.adjust" })),
    "ROLE_CAPABILITY_MISMATCH",
  );
  assert.equal(
    codeOf([candidate({ capabilities: [] })]),
    "CAPABILITY_NOT_GRANTED",
  );
});

test("missing, stale, future, expired, and malformed authority time/version deny", () => {
  assert.equal(
    codeOf([candidate({ authorityVersion: null })]),
    "MISSING_AUTHORITY_VERSION",
  );
  assert.equal(
    codeOf([candidate()], request({ expectedAuthorityVersion: 8 })),
    "STALE_AUTHORITY_VERSION",
  );
  assert.equal(
    codeOf([candidate({ validFromIso: "2026-10-01T00:00:00.000Z" })]),
    "NOT_YET_VALID",
  );
  assert.equal(
    codeOf([candidate({ validUntilIso: NOW })]),
    "EXPIRED",
  );
  assert.equal(
    codeOf([candidate({ validFromIso: "2026-02-30T00:00:00.000Z" })]),
    "INVALID_AUTHORITY_RECORD",
  );
});

test("missing, unknown, out-of-scope, and one-ended transfer locations deny", () => {
  assert.equal(
    codeOf([candidate()], request({ requiredLocationIds: [] })),
    "MISSING_LOCATION",
  );
  assert.equal(
    codeOf([candidate()], request({ requiredLocationIds: ["loc-unknown"] })),
    "UNKNOWN_LOCATION",
  );
  assert.equal(
    codeOf([candidate()], request({ requiredLocationIds: [LOCATIONS[1]] })),
    "LOCATION_NOT_GRANTED",
  );
  assert.equal(
    codeOf(
      [
        candidate({
          role: "office_az_warehouse_operator",
          capabilities: ["inventory.transfer.dispatch"],
          allowedLocationIds: [LOCATIONS[0], LOCATIONS[1]],
        }),
      ],
      request({
        capability: "inventory.transfer.dispatch",
        requiredLocationIds: [LOCATIONS[0]],
      }),
    ),
    "INVALID_TRANSFER_SCOPE",
  );
  assert.equal(
    codeOf(
      [
        candidate({
          role: "office_az_warehouse_operator",
          capabilities: ["inventory.transfer.dispatch"],
          allowedLocationIds: [LOCATIONS[0]],
        }),
      ],
      request({
        capability: "inventory.transfer.dispatch",
        requiredLocationIds: [LOCATIONS[0], LOCATIONS[1]],
      }),
    ),
    "LOCATION_NOT_GRANTED",
  );
});

test("hostile input shapes never throw and return explicit denial", () => {
  const hostile: unknown[] = [null, undefined, "authority", [], {}, 1, true];
  for (const value of hostile) {
    assert.doesNotThrow(() =>
      evaluateOfficeAzInventoryAuthority([candidate()], value, LOCATIONS),
    );
    assert.equal(codeOf([candidate()], value), "INVALID_REQUEST");
  }
});

test("the core is pure and imports only its sibling type contract", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "src/lib/inventory/authority/office-az-inventory-authority-core.ts",
    ),
    "utf8",
  );
  const imports = source.match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm) ?? [];
  assert.equal(imports.length, 1);
  assert.match(imports[0], /office-az-inventory-authority-types"/);
  for (const forbidden of [
    "@supabase",
    "process.env",
    "fetch(",
    "Date.now",
    "new Date()",
    "node:fs",
    "node:path",
    "react",
    "next/",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("test fixtures cover every exact role and capability constant", () => {
  const roles = new Set<OfficeAzInventoryAuthorityRole>(
    OFFICE_AZ_INVENTORY_AUTHORITY_ROLES,
  );
  const capabilities = new Set<OfficeAzInventoryCapability>(
    OFFICE_AZ_INVENTORY_CAPABILITIES,
  );
  assert.deepEqual(new Set(Object.keys(OFFICE_AZ_ROLE_CAPABILITIES)), roles);
  const configured = new Set(
    Object.values(OFFICE_AZ_ROLE_CAPABILITIES).flatMap((values) => values),
  );
  assert.deepEqual(configured, capabilities);
});
