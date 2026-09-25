import {
  DEALEROS_INVENTORY_API_BASE_URL_KEY,
  MOBILE_ACCESS_LIFETIME_MS,
  MOBILE_DEVICE_OPERATIONS,
  MOBILE_REFRESH_ABSOLUTE_CEILING_MS,
  MOBILE_SESSION_OPERATIONS,
  type MobileDeviceParse,
  type MobileSessionParse,
} from "./office-az-inventory-mobile-session-types";

const MAX_ID_LENGTH = 512;
const SHARED_AUTHORITY_KEYS = [
  "operation",
  "actorId",
  "operatorId",
  "expectedAuthorityVersion",
  "requiredLocationIds",
] as const;
const SESSION_ISSUE_KEYS = new Set([...SHARED_AUTHORITY_KEYS, "deviceId"]);
const SESSION_REFRESH_KEYS = new Set([
  ...SHARED_AUTHORITY_KEYS,
  "sessionId",
  "refreshToken",
  "refreshVersion",
]);
const SESSION_REVOKE_KEYS = new Set([...SHARED_AUTHORITY_KEYS, "sessionId"]);
const DEVICE_REGISTER_KEYS = new Set([
  "operation",
  "actorId",
  "operatorId",
  "expectedAuthorityVersion",
  "requiredLocationIds",
  "enrollmentCode",
]);
const DEVICE_REVOKE_KEYS = new Set([
  "operation",
  "actorId",
  "operatorId",
  "expectedAuthorityVersion",
  "requiredLocationIds",
  "deviceId",
]);
const FORBIDDEN_OVERRIDE_KEYS = new Set([
  "requestId",
  "idempotencyKey",
  "aggregateVersion",
  "accessLifetimeMs",
  "refreshLifetimeMs",
  "expiresIn",
  "token",
  "jwt",
  "sessionToken",
  "hostname",
  DEALEROS_INVENTORY_API_BASE_URL_KEY,
  "imei",
  "serial",
  "serialNumber",
  "hardwareId",
  "androidId",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrimmedNonEmptyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    value === value.trim()
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") && value.includes(".");
}

function isOpaqueValue(value: unknown): value is string {
  return isTrimmedNonEmptyId(value) && !looksLikeJwt(value);
}

function parseLocationIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const locations: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isTrimmedNonEmptyId(item) || seen.has(item)) return null;
    seen.add(item);
    locations.push(item);
  }
  return locations.length > 0 ? locations : null;
}

function hasForbiddenKeys(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => FORBIDDEN_OVERRIDE_KEYS.has(key));
}

function hasUnknownKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(record).some((key) => !allowed.has(key));
}

function parseSharedAuthority(
  record: Record<string, unknown>,
): {
  actorId: string;
  operatorId: string;
  expectedAuthorityVersion: number;
  requiredLocationIds: readonly string[];
} | null {
  if (
    !isTrimmedNonEmptyId(record.actorId) ||
    !isTrimmedNonEmptyId(record.operatorId) ||
    !isPositiveSafeInteger(record.expectedAuthorityVersion)
  ) {
    return null;
  }
  if (record.actorId === record.operatorId) return null;
  const requiredLocationIds = parseLocationIds(record.requiredLocationIds);
  if (!requiredLocationIds) return null;
  return {
    actorId: record.actorId,
    operatorId: record.operatorId,
    expectedAuthorityVersion: record.expectedAuthorityVersion,
    requiredLocationIds,
  };
}

export function parseMobileSessionRequest(input: unknown): MobileSessionParse {
  if (!isPlainRecord(input) || hasForbiddenKeys(input)) {
    return { ok: false, code: "invalid_request" };
  }
  if (typeof input.operation !== "string") {
    return { ok: false, code: "invalid_request" };
  }
  if (
    !(MOBILE_SESSION_OPERATIONS as readonly string[]).includes(input.operation)
  ) {
    return { ok: false, code: "unknown_operation" };
  }
  const shared = parseSharedAuthority(input);
  if (!shared) return { ok: false, code: "invalid_request" };
  if (input.operation === "issue") {
    if (hasUnknownKeys(input, SESSION_ISSUE_KEYS) || !isOpaqueValue(input.deviceId)) {
      return { ok: false, code: "invalid_request" };
    }
    return { ok: true, operation: "issue", deviceId: input.deviceId, ...shared };
  }
  if (input.operation === "refresh") {
    if (
      hasUnknownKeys(input, SESSION_REFRESH_KEYS) ||
      !isOpaqueValue(input.sessionId) ||
      !isOpaqueValue(input.refreshToken) ||
      !isPositiveSafeInteger(input.refreshVersion) ||
      !Number.isSafeInteger(input.refreshVersion + 1)
    ) {
      return { ok: false, code: "invalid_request" };
    }
    return {
      ok: true,
      operation: "refresh",
      sessionId: input.sessionId,
      refreshToken: input.refreshToken,
      refreshVersion: input.refreshVersion,
      ...shared,
    };
  }
  if (
    input.operation !== "revoke" ||
    hasUnknownKeys(input, SESSION_REVOKE_KEYS) ||
    !isOpaqueValue(input.sessionId)
  ) {
    return { ok: false, code: "invalid_request" };
  }
  return { ok: true, operation: "revoke", sessionId: input.sessionId, ...shared };
}

export function parseMobileDeviceRequest(input: unknown): MobileDeviceParse {
  if (!isPlainRecord(input) || hasForbiddenKeys(input)) {
    return { ok: false, code: "invalid_request" };
  }
  if (typeof input.operation !== "string") {
    return { ok: false, code: "invalid_request" };
  }
  if (!(MOBILE_DEVICE_OPERATIONS as readonly string[]).includes(input.operation)) {
    return { ok: false, code: "unknown_operation" };
  }
  const shared = parseSharedAuthority(input);
  if (!shared) return { ok: false, code: "invalid_request" };
  if (input.operation === "register") {
    if (hasUnknownKeys(input, DEVICE_REGISTER_KEYS)) {
      return { ok: false, code: "invalid_request" };
    }
    if (!isOpaqueValue(input.enrollmentCode)) {
      return { ok: false, code: "invalid_request" };
    }
    return { ok: true, operation: "register", enrollmentCode: input.enrollmentCode, ...shared };
  }
  if (hasUnknownKeys(input, DEVICE_REVOKE_KEYS)) {
    return { ok: false, code: "invalid_request" };
  }
  if (!isOpaqueValue(input.deviceId)) {
    return { ok: false, code: "invalid_request" };
  }
  return { ok: true, operation: "revoke_device", deviceId: input.deviceId, ...shared };
}

export const MOBILE_LIFETIME_CONTRACT = Object.freeze({
  accessLifetimeMs: MOBILE_ACCESS_LIFETIME_MS,
  refreshAbsoluteCeilingMs: MOBILE_REFRESH_ABSOLUTE_CEILING_MS,
  endpointInjectionKey: DEALEROS_INVENTORY_API_BASE_URL_KEY,
});
