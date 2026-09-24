import "server-only";
import { types } from "node:util";

export const MOBILE_PERSIST_HASH_PATTERN = /^[a-f0-9]{64}$/;

export const MOBILE_PERSIST_OPERATIONS = [
  "register",
  "revoke_device",
  "issue",
  "refresh",
  "revoke",
] as const;

export type MobilePersistOperation = (typeof MOBILE_PERSIST_OPERATIONS)[number];

export const MOBILE_PERSIST_CODES = [
  "not_configured",
  "invalid_request",
  "invalid_or_stale",
  "failed",
] as const;

export type MobilePersistCode = (typeof MOBILE_PERSIST_CODES)[number];

export type MobilePersistResult =
  | { readonly ok: true; readonly operation: MobilePersistOperation }
  | { readonly ok: false; readonly code: MobilePersistCode };

export type PersistRpcResult = { readonly data: unknown; readonly error: unknown };

export type PersistRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<PersistRpcResult>;
};

type SharedPersistFields = {
  readonly actorId: string;
  readonly operatorId: string;
  readonly expectedAuthorityVersion: number;
  readonly requiredLocationIds: readonly string[];
};

export type RegisterPersistInput = SharedPersistFields & {
  readonly enrollmentCodeHash: string;
  readonly deviceIdHash: string;
};

export type DeviceRevokePersistInput = SharedPersistFields & {
  readonly deviceIdHash: string;
};

export type IssuePersistInput = SharedPersistFields & {
  readonly deviceIdHash: string;
  readonly sessionIdHash: string;
  readonly refreshHash: string;
};

export type RefreshPersistInput = SharedPersistFields & {
  readonly sessionIdHash: string;
  readonly currentRefreshHash: string;
  readonly currentRefreshVersion: number;
  readonly nextRefreshHash: string;
};

export type SessionRevokePersistInput = SharedPersistFields & {
  readonly sessionIdHash: string;
};

export type MobilePersistencePort = {
  register(input: unknown): Promise<MobilePersistResult>;
  revokeDevice(input: unknown): Promise<MobilePersistResult>;
  issue(input: unknown): Promise<MobilePersistResult>;
  refresh(input: unknown): Promise<MobilePersistResult>;
  revoke(input: unknown): Promise<MobilePersistResult>;
};

const RPC = {
  register: "office_az_inventory_mobile_register",
  revoke_device: "office_az_inventory_mobile_revoke_device",
  issue: "office_az_inventory_mobile_issue",
  refresh: "office_az_inventory_mobile_refresh",
  revoke: "office_az_inventory_mobile_revoke",
} as const;

const SHARED_KEYS = [
  "actorId",
  "operatorId",
  "expectedAuthorityVersion",
  "requiredLocationIds",
] as const;

const REGISTER_KEYS = [...SHARED_KEYS, "enrollmentCodeHash", "deviceIdHash"] as const;
const DEVICE_REVOKE_KEYS = [...SHARED_KEYS, "deviceIdHash"] as const;
const ISSUE_KEYS = [...SHARED_KEYS, "deviceIdHash", "sessionIdHash", "refreshHash"] as const;
const REFRESH_KEYS = [
  ...SHARED_KEYS,
  "sessionIdHash",
  "currentRefreshHash",
  "currentRefreshVersion",
  "nextRefreshHash",
] as const;
const SESSION_REVOKE_KEYS = [...SHARED_KEYS, "sessionIdHash"] as const;

const FORBIDDEN_MATERIAL_KEYS = new Set([
  "token",
  "jwt",
  "sessionToken",
  "refreshToken",
  "enrollmentCode",
  "bearer",
  "authorization",
  "__proto__",
  "constructor",
  "prototype",
]);

function fail(code: MobilePersistCode): MobilePersistResult {
  return { ok: false, code };
}

function ok(operation: MobilePersistOperation): MobilePersistResult {
  return { ok: true, operation };
}

function isTrimmedNonEmptyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value === value.trim()
  );
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && MOBILE_PERSIST_HASH_PATTERN.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function rejectIfProxyOrSymbols(value: object): boolean {
  return types.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0;
}

function ownEnumerableDataDescriptor(
  value: object,
  name: string,
): PropertyDescriptor | null {
  const desc = Object.getOwnPropertyDescriptor(value, name);
  if (
    !desc ||
    desc.enumerable !== true ||
    desc.get ||
    desc.set ||
    !Object.prototype.hasOwnProperty.call(desc, "value")
  ) {
    return null;
  }
  return desc;
}

function readClosedRecord(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value)) {
      return null;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    if (rejectIfProxyOrSymbols(value)) return null;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== allowed.length) return null;
    const allowedSet = new Set(allowed);
    for (const name of names) {
      if (!allowedSet.has(name) || FORBIDDEN_MATERIAL_KEYS.has(name)) return null;
      if (!ownEnumerableDataDescriptor(value, name)) return null;
    }
    const out: Record<string, unknown> = Object.create(null);
    for (const name of allowed) {
      const desc = ownEnumerableDataDescriptor(value, name);
      if (!desc) return null;
      out[name] = desc.value;
    }
    return out;
  } catch {
    return null;
  }
}

function parseSingleLocation(value: unknown): string | null {
  try {
    if (
      !Array.isArray(value) ||
      types.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }
    if (rejectIfProxyOrSymbols(value)) return null;
    if (value.length !== 1) return null;
    const names = Object.getOwnPropertyNames(value).filter((name) => name !== "length");
    if (names.length !== 1 || names[0] !== "0") return null;
    const desc = ownEnumerableDataDescriptor(value, "0");
    if (!desc || !isTrimmedNonEmptyId(desc.value)) return null;
    return desc.value;
  } catch {
    return null;
  }
}

function parseShared(record: Record<string, unknown>): {
  actorId: string;
  operatorId: string;
  locationId: string;
  expectedAuthorityVersion: number;
} | null {
  const locationId = parseSingleLocation(record.requiredLocationIds);
  if (
    !isTrimmedNonEmptyId(record.actorId) ||
    !isTrimmedNonEmptyId(record.operatorId) ||
    record.actorId === record.operatorId ||
    !isPositiveSafeInteger(record.expectedAuthorityVersion) ||
    locationId === null
  ) {
    return null;
  }
  return {
    actorId: record.actorId,
    operatorId: record.operatorId,
    locationId,
    expectedAuthorityVersion: record.expectedAuthorityVersion,
  };
}

function exactStatusObject(
  data: unknown,
  expectedOk: boolean,
  expectedStatus: string,
): boolean {
  try {
    if (data === null || typeof data !== "object" || Array.isArray(data) || types.isProxy(data)) {
      return false;
    }
    const proto = Object.getPrototypeOf(data);
    if (proto !== Object.prototype && proto !== null) return false;
    if (rejectIfProxyOrSymbols(data)) return false;
    const names = Object.getOwnPropertyNames(data);
    if (names.length !== 2) return false;
    if (!names.includes("ok") || !names.includes("status")) return false;
    const okDesc = ownEnumerableDataDescriptor(data, "ok");
    const statusDesc = ownEnumerableDataDescriptor(data, "status");
    return (
      okDesc !== null &&
      statusDesc !== null &&
      okDesc.value === expectedOk &&
      statusDesc.value === expectedStatus
    );
  } catch {
    return false;
  }
}

async function invoke(
  client: PersistRpcClient | null,
  operation: MobilePersistOperation,
  args: Record<string, unknown>,
): Promise<MobilePersistResult> {
  if (client === null) return fail("not_configured");
  try {
    const result = await client.rpc(RPC[operation], args);
    if (result === null || typeof result !== "object" || Array.isArray(result) || types.isProxy(result)) {
      return fail("failed");
    }
    if (rejectIfProxyOrSymbols(result)) return fail("failed");
    const names = Object.getOwnPropertyNames(result);
    if (names.length !== 2 || !names.includes("data") || !names.includes("error")) {
      return fail("failed");
    }
    const dataDesc = ownEnumerableDataDescriptor(result, "data");
    const errorDesc = ownEnumerableDataDescriptor(result, "error");
    if (!dataDesc || !errorDesc) return fail("failed");
    if (errorDesc.value) return fail("failed");
    if (exactStatusObject(dataDesc.value, true, "accepted")) return ok(operation);
    if (exactStatusObject(dataDesc.value, false, "invalid_or_stale")) {
      return fail("invalid_or_stale");
    }
    return fail("failed");
  } catch {
    return fail("failed");
  }
}

export function createOfficeAzInventoryMobilePersistence(
  client: PersistRpcClient | null,
): MobilePersistencePort {
  return {
    async register(input) {
      const record = readClosedRecord(input, REGISTER_KEYS);
      const shared = record ? parseShared(record) : null;
      if (
        !record ||
        !shared ||
        !isHash(record.enrollmentCodeHash) ||
        !isHash(record.deviceIdHash)
      ) {
        return fail("invalid_request");
      }
      return invoke(client, "register", {
        p_actor_id: shared.actorId,
        p_operator_id: shared.operatorId,
        p_location_id: shared.locationId,
        p_authority_version: shared.expectedAuthorityVersion,
        p_enrollment_code_hash: record.enrollmentCodeHash,
        p_device_id_hash: record.deviceIdHash,
      });
    },
    async revokeDevice(input) {
      const record = readClosedRecord(input, DEVICE_REVOKE_KEYS);
      const shared = record ? parseShared(record) : null;
      if (!record || !shared || !isHash(record.deviceIdHash)) {
        return fail("invalid_request");
      }
      return invoke(client, "revoke_device", {
        p_actor_id: shared.actorId,
        p_operator_id: shared.operatorId,
        p_location_id: shared.locationId,
        p_authority_version: shared.expectedAuthorityVersion,
        p_device_id_hash: record.deviceIdHash,
      });
    },
    async issue(input) {
      const record = readClosedRecord(input, ISSUE_KEYS);
      const shared = record ? parseShared(record) : null;
      if (
        !record ||
        !shared ||
        !isHash(record.deviceIdHash) ||
        !isHash(record.sessionIdHash) ||
        !isHash(record.refreshHash)
      ) {
        return fail("invalid_request");
      }
      return invoke(client, "issue", {
        p_actor_id: shared.actorId,
        p_operator_id: shared.operatorId,
        p_location_id: shared.locationId,
        p_authority_version: shared.expectedAuthorityVersion,
        p_device_id_hash: record.deviceIdHash,
        p_session_id_hash: record.sessionIdHash,
        p_refresh_hash: record.refreshHash,
      });
    },
    async refresh(input) {
      const record = readClosedRecord(input, REFRESH_KEYS);
      const shared = record ? parseShared(record) : null;
      if (
        !record ||
        !shared ||
        !isHash(record.sessionIdHash) ||
        !isHash(record.currentRefreshHash) ||
        !isHash(record.nextRefreshHash) ||
        !isPositiveSafeInteger(record.currentRefreshVersion) ||
        record.currentRefreshHash === record.nextRefreshHash
      ) {
        return fail("invalid_request");
      }
      return invoke(client, "refresh", {
        p_actor_id: shared.actorId,
        p_operator_id: shared.operatorId,
        p_location_id: shared.locationId,
        p_authority_version: shared.expectedAuthorityVersion,
        p_session_id_hash: record.sessionIdHash,
        p_current_refresh_hash: record.currentRefreshHash,
        p_current_refresh_version: record.currentRefreshVersion,
        p_next_refresh_hash: record.nextRefreshHash,
      });
    },
    async revoke(input) {
      const record = readClosedRecord(input, SESSION_REVOKE_KEYS);
      const shared = record ? parseShared(record) : null;
      if (!record || !shared || !isHash(record.sessionIdHash)) {
        return fail("invalid_request");
      }
      return invoke(client, "revoke", {
        p_actor_id: shared.actorId,
        p_operator_id: shared.operatorId,
        p_location_id: shared.locationId,
        p_authority_version: shared.expectedAuthorityVersion,
        p_session_id_hash: record.sessionIdHash,
      });
    },
  };
}
