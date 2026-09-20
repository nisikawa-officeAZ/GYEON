import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

let calls: unknown[] = [];

mock.module("./resolve-office-az-inventory-authority.js", {
  namedExports: {
    resolveOfficeAzInventoryAuthority: async (input: unknown) => {
      calls.push(input);
      return { tag: "denied", code: "ZERO_ASSIGNMENT" };
    },
  },
});

type ActionModule = typeof import("./office-az-inventory-authority-actions");
let action: ActionModule["evaluateOfficeAzInventoryAuthorityAction"];

before(async () => {
  ({ evaluateOfficeAzInventoryAuthorityAction: action } = await import(
    "./office-az-inventory-authority-actions"
  ));
});

beforeEach(() => {
  calls = [];
});

const LOCATION = "office-az-warehouse";
const LONG_ID = "x".repeat(513);
const cleanRequest = {
  actorId: "actor-1",
  operatorId: "operator-1",
  capability: "inventory.quantity.read",
  requiredLocationIds: [LOCATION],
  expectedAuthorityVersion: 1,
};

const hostileCases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["unknown capability", { capability: "inventory.manage" }],
  ["null locations", { requiredLocationIds: null }],
  ["scalar locations", { requiredLocationIds: LOCATION }],
  ["object locations", { requiredLocationIds: { id: LOCATION } }],
  ["blank location", { requiredLocationIds: [""] }],
  ["padded location", { requiredLocationIds: [` ${LOCATION}`] }],
  ["oversized location", { requiredLocationIds: [LONG_ID] }],
  ["duplicate locations", { requiredLocationIds: [LOCATION, LOCATION] }],
  ["version 0", { expectedAuthorityVersion: 0 }],
  ["negative version", { expectedAuthorityVersion: -1 }],
  ["decimal version", { expectedAuthorityVersion: 1.5 }],
  ["unsafe version", { expectedAuthorityVersion: Number.MAX_SAFE_INTEGER + 1 }],
  ["string version", { expectedAuthorityVersion: "1" }],
  ["blank actor", { actorId: "" }],
  ["padded actor", { actorId: " actor-1" }],
  ["oversized actor", { actorId: LONG_ID }],
  ["blank operator", { operatorId: "" }],
  ["padded operator", { operatorId: " operator-1" }],
  ["oversized operator", { operatorId: LONG_ID }],
  ["blank target operator", { targetOperatorId: "" }],
  ["padded target operator", { targetOperatorId: " operator-2" }],
  ["oversized target operator", { targetOperatorId: LONG_ID }],
];

test("action delegates a clean request exactly once and remains read-only", async () => {
  const result = await action(cleanRequest);
  assert.deepEqual(result, { tag: "denied", code: "ZERO_ASSIGNMENT" });
  assert.deepEqual(calls, [cleanRequest]);
});

for (const field of [
  "authenticatedUserId",
  "owner",
  "role",
  "capabilities",
  "allowedLocationIds",
  "requestedAtIso",
]) {
  test(`action rejects browser-supplied ${field}`, async () => {
    const result = await action({ ...cleanRequest, [field]: "attacker-value" });
    assert.deepEqual(result, { tag: "denied", code: "BROWSER_SUPPLIED_AUTHORITY" });
    assert.equal(calls.length, 0);
  });
}

for (const [label, overrides] of hostileCases) {
  test(`action rejects ${label} before resolver`, async () => {
    const result = await action({ ...cleanRequest, ...overrides });
    assert.deepEqual(result, { tag: "denied", code: "BROWSER_SUPPLIED_AUTHORITY" });
    assert.equal(calls.length, 0);
  });
}
