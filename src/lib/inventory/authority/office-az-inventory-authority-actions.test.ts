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

const cleanRequest = {
  actorId: "actor-1",
  operatorId: "operator-1",
  capability: "inventory.quantity.read",
  requiredLocationIds: ["office-az-warehouse"],
  expectedAuthorityVersion: 1,
};

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
