import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  MOBILE_LIFETIME_CONTRACT,
  parseMobileDeviceRequest,
  parseMobileSessionRequest,
} from "./office-az-inventory-mobile-session-core";
import {
  DEALEROS_INVENTORY_API_BASE_URL_KEY,
  MOBILE_ACCESS_LIFETIME_MS,
  MOBILE_REFRESH_ABSOLUTE_CEILING_MS,
} from "./office-az-inventory-mobile-session-types";

const BASE = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 1,
  requiredLocationIds: ["office-az-warehouse"],
  deviceId: "device-1",
};

test("lifetime and injection key are server constants with no hostname default", () => {
  assert.equal(MOBILE_ACCESS_LIFETIME_MS, 3_600_000);
  assert.equal(MOBILE_REFRESH_ABSOLUTE_CEILING_MS, 43_200_000);
  assert.equal(DEALEROS_INVENTORY_API_BASE_URL_KEY, "DEALEROS_INVENTORY_API_BASE_URL");
  assert.deepEqual(MOBILE_LIFETIME_CONTRACT, {
    accessLifetimeMs: 3_600_000,
    refreshAbsoluteCeilingMs: 43_200_000,
    endpointInjectionKey: "DEALEROS_INVENTORY_API_BASE_URL",
  });
  const source = readFileSync(
    "src/lib/inventory/mobile/office-az-inventory-mobile-session-types.ts",
    "utf8",
  );
  assert.equal(source.includes("https://"), false);
  assert.equal(source.includes("process.env"), false);
});

test("session issue accepts the closed field set and rejects extras", () => {
  assert.deepEqual(parseMobileSessionRequest({ operation: "issue", ...BASE }), {
    ok: true,
    operation: "issue",
    ...BASE,
  });
  assert.deepEqual(
    parseMobileSessionRequest({ operation: "issue", ...BASE, nested: { a: 1 } }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileSessionRequest({ operation: "issue", ...BASE, requestId: "client" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileSessionRequest({
      operation: "issue",
      ...BASE,
      accessLifetimeMs: 99,
    }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileSessionRequest({ operation: "issue", ...BASE, sessionId: "s1" }),
    { ok: false, code: "invalid_request" },
  );
});

test("unknown operations are unknown_operation and JWT material is not a session", () => {
  assert.deepEqual(parseMobileSessionRequest({ operation: "open", ...BASE }), {
    ok: false,
    code: "unknown_operation",
  });
  assert.deepEqual(
    parseMobileSessionRequest({
      operation: "refresh",
      ...BASE,
      sessionId: "eyJhbGciOiJIUzI1NiJ9.abc",
    }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(parseMobileSessionRequest({ actorId: "actor-1" }), {
    ok: false,
    code: "invalid_request",
  });
});

test("refresh and revoke require a Book session id and reject actor/operator collision", () => {
  assert.deepEqual(
    parseMobileSessionRequest({ operation: "refresh", ...BASE, sessionId: "sess-1" }),
    { ok: true, operation: "refresh", sessionId: "sess-1", ...BASE },
  );
  assert.deepEqual(
    parseMobileSessionRequest({ operation: "revoke", ...BASE, sessionId: "sess-1" }),
    { ok: true, operation: "revoke", sessionId: "sess-1", ...BASE },
  );
  assert.deepEqual(
    parseMobileSessionRequest({
      operation: "refresh",
      ...BASE,
      actorId: "same",
      operatorId: "same",
      sessionId: "sess-1",
    }),
    { ok: false, code: "invalid_request" },
  );
});

test("device register requires enrollment code and rejects hardware identifiers", () => {
  const register = {
    operation: "register",
    actorId: "actor-1",
    operatorId: "operator-1",
    expectedAuthorityVersion: 1,
    requiredLocationIds: ["office-az-warehouse"],
    enrollmentCode: "enroll-1",
  };
  assert.deepEqual(parseMobileDeviceRequest(register), { ok: true, ...register });
  assert.deepEqual(
    parseMobileDeviceRequest({ ...register, imei: "123456789012345" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileDeviceRequest({ ...register, serialNumber: "SN" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(parseMobileDeviceRequest({ ...register, operation: "wipe" }), {
    ok: false,
    code: "unknown_operation",
  });
});

test("device revoke requires deviceId and rejects empty locations", () => {
  const revoke = {
    operation: "revoke_device",
    actorId: "actor-1",
    operatorId: "operator-1",
    expectedAuthorityVersion: 1,
    requiredLocationIds: ["office-az-warehouse"],
    deviceId: "device-1",
  };
  assert.deepEqual(parseMobileDeviceRequest(revoke), { ok: true, ...revoke });
  assert.deepEqual(
    parseMobileDeviceRequest({ ...revoke, requiredLocationIds: [] }),
    { ok: false, code: "invalid_request" },
  );
});
