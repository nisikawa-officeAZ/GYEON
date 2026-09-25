import "server-only";
import { createHash, randomBytes } from "node:crypto";

import type {
  MobilePersistencePort,
  MobilePersistOperation,
  MobilePersistResult,
} from "./office-az-inventory-mobile-persistence";
import {
  MOBILE_ACCESS_LIFETIME_MS,
  MOBILE_REFRESH_ABSOLUTE_CEILING_MS,
  type MobileBoundaryPublicCode,
  type MobileBoundaryResult,
  type MobileDeviceParse,
  type MobileSessionParse,
} from "./office-az-inventory-mobile-session-types";

export const MOBILE_OPAQUE_ID_BYTES = 32;
export const MOBILE_OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AuthorizedMobileParse =
  | Extract<MobileSessionParse, { ok: true }>
  | Extract<MobileDeviceParse, { ok: true }>;

export type MobileBindingDependencies = {
  readonly persistence: MobilePersistencePort;
  readonly generateOpaqueId: () => string;
};

/** 32 CSPRNG bytes as unpadded base64url; the raw value leaves only in the owning success response. */
export function generateOfficeAzInventoryMobileOpaqueId(): string {
  return randomBytes(MOBILE_OPAQUE_ID_BYTES).toString("base64url");
}

/** SHA-256 of the exact UTF-8 public string as lowercase 64-character hex. */
export function hashOfficeAzInventoryMobilePublicValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fail(code: MobileBoundaryPublicCode): MobileBoundaryResult {
  return { ok: false, code };
}

function mapPersistFailure(result: MobilePersistResult): MobileBoundaryPublicCode {
  if (result.ok) return "downstream_failure";
  switch (result.code) {
    case "not_configured":
      return "dependency_not_configured";
    case "invalid_request":
      return "invalid_request";
    case "invalid_or_stale":
      return "session_invalid_or_stale";
    default:
      return "downstream_failure";
  }
}

function isAcceptedFor(
  result: MobilePersistResult,
  operation: MobilePersistOperation,
): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    result.ok === true &&
    result.operation === operation
  );
}

async function persistOnce(
  call: () => Promise<MobilePersistResult>,
  operation: MobilePersistOperation,
): Promise<MobileBoundaryPublicCode | null> {
  let result: MobilePersistResult;
  try {
    result = await call();
  } catch {
    return "downstream_failure";
  }
  if (isAcceptedFor(result, operation)) return null;
  if (typeof result !== "object" || result === null) return "downstream_failure";
  return mapPersistFailure(result);
}

function generateChecked(generate: () => string): string | null {
  const value = generate();
  return typeof value === "string" && MOBILE_OPAQUE_ID_PATTERN.test(value) ? value : null;
}

/**
 * Runs only after Bearer authentication and an `authorized` authority result.
 * Raw public values are hashed before persistence and are never logged or stored.
 */
export async function bindAuthorizedMobileOperation(
  parsed: AuthorizedMobileParse,
  deps: MobileBindingDependencies,
): Promise<MobileBoundaryResult> {
  if (parsed.requiredLocationIds.length !== 1) return fail("invalid_request");
  const shared = {
    actorId: parsed.actorId,
    operatorId: parsed.operatorId,
    expectedAuthorityVersion: parsed.expectedAuthorityVersion,
    requiredLocationIds: [parsed.requiredLocationIds[0]],
  };
  const hash = hashOfficeAzInventoryMobilePublicValue;

  try {
    switch (parsed.operation) {
      case "register": {
        const deviceId = generateChecked(deps.generateOpaqueId);
        if (deviceId === null) return fail("downstream_failure");
        const failure = await persistOnce(
          () =>
            deps.persistence.register({
              ...shared,
              enrollmentCodeHash: hash(parsed.enrollmentCode),
              deviceIdHash: hash(deviceId),
            }),
          "register",
        );
        if (failure !== null) return fail(failure);
        return { ok: true, operation: "register", accepted: true, deviceId };
      }
      case "revoke_device": {
        const failure = await persistOnce(
          () =>
            deps.persistence.revokeDevice({
              ...shared,
              deviceIdHash: hash(parsed.deviceId),
            }),
          "revoke_device",
        );
        if (failure !== null) return fail(failure);
        return { ok: true, operation: "revoke_device", accepted: true };
      }
      case "issue": {
        const sessionId = generateChecked(deps.generateOpaqueId);
        const refreshToken = generateChecked(deps.generateOpaqueId);
        if (sessionId === null || refreshToken === null || sessionId === refreshToken) {
          return fail("downstream_failure");
        }
        const failure = await persistOnce(
          () =>
            deps.persistence.issue({
              ...shared,
              deviceIdHash: hash(parsed.deviceId),
              sessionIdHash: hash(sessionId),
              refreshHash: hash(refreshToken),
            }),
          "issue",
        );
        if (failure !== null) return fail(failure);
        return {
          ok: true,
          operation: "issue",
          accepted: true,
          sessionId,
          refreshToken,
          refreshVersion: 1,
          accessLifetimeMs: MOBILE_ACCESS_LIFETIME_MS,
          refreshAbsoluteCeilingMs: MOBILE_REFRESH_ABSOLUTE_CEILING_MS,
        };
      }
      case "refresh": {
        const nextRefreshVersion = parsed.refreshVersion + 1;
        if (!Number.isSafeInteger(nextRefreshVersion)) return fail("invalid_request");
        const refreshToken = generateChecked(deps.generateOpaqueId);
        if (refreshToken === null || refreshToken === parsed.refreshToken) {
          return fail("downstream_failure");
        }
        const failure = await persistOnce(
          () =>
            deps.persistence.refresh({
              ...shared,
              sessionIdHash: hash(parsed.sessionId),
              currentRefreshHash: hash(parsed.refreshToken),
              currentRefreshVersion: parsed.refreshVersion,
              nextRefreshHash: hash(refreshToken),
            }),
          "refresh",
        );
        if (failure !== null) return fail(failure);
        return {
          ok: true,
          operation: "refresh",
          accepted: true,
          refreshToken,
          refreshVersion: nextRefreshVersion,
        };
      }
      case "revoke": {
        const failure = await persistOnce(
          () =>
            deps.persistence.revoke({
              ...shared,
              sessionIdHash: hash(parsed.sessionId),
            }),
          "revoke",
        );
        if (failure !== null) return fail(failure);
        return { ok: true, operation: "revoke", accepted: true };
      }
    }
  } catch {
    return fail("downstream_failure");
  }
  return fail("downstream_failure");
}
