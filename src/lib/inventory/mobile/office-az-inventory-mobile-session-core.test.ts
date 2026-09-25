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

const SHARED = {
  actorId: "actor-1",
  operatorId: "operator-1",
  expectedAuthorityVersion: 1,
  requiredLocationIds: ["office-az-warehouse"],
};
const BASE = { ...SHARED, deviceId: "device-1" };
const REFRESH = {
  operation: "refresh",
  ...SHARED,
  sessionId: "sess-1",
  refreshToken: "refresh-1",
  refreshVersion: 1,
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
  for (const extra of [
    { nested: { a: 1 } },
    { requestId: "client" },
    { accessLifetimeMs: 99 },
    { sessionId: "s1" },
    { refreshToken: "r1" },
    { refreshVersion: 1 },
  ]) {
    assert.deepEqual(parseMobileSessionRequest({ operation: "issue", ...BASE, ...extra }), {
      ok: false,
      code: "invalid_request",
    });
  }
  assert.deepEqual(parseMobileSessionRequest({ operation: "issue", ...SHARED }), {
    ok: false,
    code: "invalid_request",
  });
});

test("unknown operations are unknown_operation and JWT material is not a session", () => {
  assert.deepEqual(parseMobileSessionRequest({ operation: "open", ...BASE }), {
    ok: false,
    code: "unknown_operation",
  });
  assert.deepEqual(
    parseMobileSessionRequest({ ...REFRESH, sessionId: "eyJhbGciOiJIUzI1NiJ9.abc" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileSessionRequest({ ...REFRESH, refreshToken: "eyJhbGciOiJIUzI1NiJ9.abc" }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(parseMobileSessionRequest({ actorId: "actor-1" }), {
    ok: false,
    code: "invalid_request",
  });
});

test("refresh requires sessionId, refreshToken, and a positive safe refreshVersion", () => {
  assert.deepEqual(parseMobileSessionRequest(REFRESH), { ok: true, ...REFRESH });
  for (const bad of [
    { refreshToken: undefined },
    { refreshToken: "" },
    { refreshToken: " padded" },
    { refreshVersion: 0 },
    { refreshVersion: 1.5 },
    { refreshVersion: "1" },
    { refreshVersion: Number.MAX_SAFE_INTEGER },
    { sessionId: undefined },
  ]) {
    const input: Record<string, unknown> = { ...REFRESH, ...bad };
    for (const key of Object.keys(bad)) {
      if ((bad as Record<string, unknown>)[key] === undefined) delete input[key];
    }
    assert.deepEqual(parseMobileSessionRequest(input), { ok: false, code: "invalid_request" });
  }
  assert.deepEqual(
    parseMobileSessionRequest({ ...REFRESH, actorId: "same", operatorId: "same" }),
    { ok: false, code: "invalid_request" },
  );
});

test("refresh and revoke reject a leftover deviceId and other unknown keys", () => {
  assert.deepEqual(parseMobileSessionRequest({ ...REFRESH, deviceId: "device-1" }), {
    ok: false,
    code: "invalid_request",
  });
  const revoke = { operation: "revoke", ...SHARED, sessionId: "sess-1" };
  assert.deepEqual(parseMobileSessionRequest(revoke), { ok: true, ...revoke });
  for (const extra of [
    { deviceId: "device-1" },
    { refreshToken: "refresh-1" },
    { refreshVersion: 1 },
    { expiresIn: 9 },
  ]) {
    assert.deepEqual(parseMobileSessionRequest({ ...revoke, ...extra }), {
      ok: false,
      code: "invalid_request",
    });
  }
  assert.deepEqual(parseMobileSessionRequest({ operation: "revoke", ...SHARED }), {
    ok: false,
    code: "invalid_request",
  });
});

test("device register requires enrollment code and rejects hardware identifiers", () => {
  const register = {
    operation: "register",
    ...SHARED,
    enrollmentCode: "enroll-1",
  };
  assert.deepEqual(parseMobileDeviceRequest(register), { ok: true, ...register });
  for (const extra of [
    { imei: "123456789012345" },
    { serialNumber: "SN" },
    { deviceId: "client-chosen" },
  ]) {
    assert.deepEqual(parseMobileDeviceRequest({ ...register, ...extra }), {
      ok: false,
      code: "invalid_request",
    });
  }
  assert.deepEqual(parseMobileDeviceRequest({ ...register, operation: "wipe" }), {
    ok: false,
    code: "unknown_operation",
  });
});

test("device revoke requires deviceId and rejects empty locations", () => {
  const revoke = {
    operation: "revoke_device",
    ...SHARED,
    deviceId: "device-1",
  };
  assert.deepEqual(parseMobileDeviceRequest(revoke), { ok: true, ...revoke });
  assert.deepEqual(
    parseMobileDeviceRequest({ ...revoke, requiredLocationIds: [] }),
    { ok: false, code: "invalid_request" },
  );
  assert.deepEqual(
    parseMobileDeviceRequest({ ...revoke, sessionId: "sess-1" }),
    { ok: false, code: "invalid_request" },
  );
});
