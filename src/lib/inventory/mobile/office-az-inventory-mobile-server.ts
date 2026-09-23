import "server-only";

import { resolveOfficeAzInventoryAuthorityForBearerUser } from "../authority/resolve-office-az-inventory-authority";
import type { OfficeAzInventoryAuthorityEvaluation } from "../authority/office-az-inventory-authority-types";
import type { OfficeAzInventoryCapability } from "../authority/office-az-inventory-authority-types";
import {
  parseMobileDeviceRequest,
  parseMobileSessionRequest,
} from "./office-az-inventory-mobile-session-core";
import {
  MOBILE_BOUNDARY_MAX_BODY_BYTES,
  type MobileBoundaryPublicCode,
  type MobileBoundaryResult,
  type MobileDeviceParse,
  type MobileSessionParse,
} from "./office-az-inventory-mobile-session-types";
import { resolveOfficeAzInventoryMobileBearer } from "./resolve-office-az-inventory-mobile-bearer";

function fail(code: MobileBoundaryPublicCode): MobileBoundaryResult {
  return { ok: false, code };
}

export function publicStatusFor(code: MobileBoundaryPublicCode): number {
  switch (code) {
    case "unauthenticated":
    case "session_invalid_or_stale":
      return 401;
    case "operator_authority_not_configured":
    case "operator_inactive":
    case "authorization_denied":
    case "owner_scope_denied":
    case "location_scope_denied":
      return 403;
    case "invalid_request":
      return 400;
    case "unknown_operation":
      return 404;
    case "tenant_context_unavailable":
    case "stale_version":
      return 409;
    case "dependency_not_configured":
      return 503;
    case "downstream_failure":
      return 502;
  }
}

export function mapAuthorityEvaluation(
  evaluation: OfficeAzInventoryAuthorityEvaluation,
): MobileBoundaryPublicCode {
  if (evaluation.tag === "not_configured") return "dependency_not_configured";
  if (evaluation.tag === "authorized") {
    throw new Error("authorized evaluation has no public failure code");
  }
  switch (evaluation.code) {
    case "ZERO_ASSIGNMENT":
      return "operator_authority_not_configured";
    case "MULTIPLE_ASSIGNMENTS":
      return "tenant_context_unavailable";
    case "INACTIVE_OPERATOR":
    case "EXPIRED":
    case "NOT_YET_VALID":
      return "operator_inactive";
    case "OWNER_MISMATCH":
      return "owner_scope_denied";
    case "LOCATION_NOT_GRANTED":
    case "UNKNOWN_LOCATION":
    case "MISSING_LOCATION":
    case "INVALID_TRANSFER_SCOPE":
      return "location_scope_denied";
    case "STALE_AUTHORITY_VERSION":
      return "stale_version";
    case "UNAUTHENTICATED":
      return "unauthenticated";
    case "CAPABILITY_NOT_GRANTED":
    case "ROLE_CAPABILITY_MISMATCH":
    case "UNKNOWN_CAPABILITY":
    case "UNKNOWN_ROLE":
    case "AUTHENTICATED_USER_MISMATCH":
    case "PRINCIPAL_ROLE_MISMATCH":
    case "SELF_ACTION_PROHIBITED":
      return "authorization_denied";
    default:
      return "invalid_request";
  }
}

function capabilityFor(
  parsed: Extract<MobileSessionParse, { ok: true }> | Extract<MobileDeviceParse, { ok: true }>,
): OfficeAzInventoryCapability {
  if (parsed.operation === "register") return "inventory.device.register";
  if (parsed.operation === "revoke" || parsed.operation === "revoke_device") {
    return "inventory.session.revoke";
  }
  return "inventory.session.issue";
}

export function isExactJsonMediaType(headerValue: string | null): boolean {
  if (headerValue === null) return false;
  const mediaType = headerValue.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json";
}

export async function readBoundedJsonBody(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > MOBILE_BOUNDARY_MAX_BODY_BYTES) {
      return { ok: false, status: 413 };
    }
  }
  const body = req.body;
  if (!body) return { ok: false, status: 400 };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MOBILE_BOUNDARY_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(joined)) };
  } catch {
    return { ok: false, status: 400 };
  }
}

async function executeParsed(
  parsed: Extract<MobileSessionParse, { ok: true }> | Extract<MobileDeviceParse, { ok: true }>,
  authorizationHeader: string | null,
): Promise<MobileBoundaryResult> {
  const bearer = await resolveOfficeAzInventoryMobileBearer(authorizationHeader);
  if (bearer.tag === "denied") return fail("unauthenticated");

  const evaluation = await resolveOfficeAzInventoryAuthorityForBearerUser(
    {
      actorId: parsed.actorId,
      operatorId: parsed.operatorId,
      capability: capabilityFor(parsed),
      requiredLocationIds: parsed.requiredLocationIds,
      expectedAuthorityVersion: parsed.expectedAuthorityVersion,
    },
    bearer.userId,
    authorizationHeader,
  );
  if (evaluation.tag !== "authorized") {
    return fail(mapAuthorityEvaluation(evaluation));
  }
  return fail("dependency_not_configured");
}

export async function executeMobileSessionBoundary(
  input: unknown,
  authorizationHeader: string | null,
): Promise<MobileBoundaryResult> {
  try {
    const parsed = parseMobileSessionRequest(input);
    if (!parsed.ok) return fail(parsed.code);
    return await executeParsed(parsed, authorizationHeader);
  } catch {
    return fail("downstream_failure");
  }
}

export async function executeMobileDeviceBoundary(
  input: unknown,
  authorizationHeader: string | null,
): Promise<MobileBoundaryResult> {
  try {
    const parsed = parseMobileDeviceRequest(input);
    if (!parsed.ok) return fail(parsed.code);
    return await executeParsed(parsed, authorizationHeader);
  } catch {
    return fail("downstream_failure");
  }
}
