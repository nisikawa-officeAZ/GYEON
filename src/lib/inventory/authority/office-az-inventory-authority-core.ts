/**
 * Office AZ inventory authority の純粋・決定的な判定コア。
 *
 * 現在時刻、既知拠点、assignment候補をすべて明示入力にし、DB・認証・環境・
 * ネットワークへ依存しない。未知値や不完全な証跡は常にfail closedで拒否する。
 */

import {
  OFFICE_AZ_INVENTORY_AUTHORITY_ROLES,
  OFFICE_AZ_INVENTORY_CAPABILITIES,
  OFFICE_AZ_INVENTORY_OWNER,
  type AuthorizedOfficeAzInventoryAuthority,
  type OfficeAzInventoryAuthorityCandidate,
  type OfficeAzInventoryAuthorityDenialCode,
  type OfficeAzInventoryAuthorityEvaluation,
  type OfficeAzInventoryAuthorityRequest,
  type OfficeAzInventoryAuthorityRole,
  type OfficeAzInventoryCapability,
} from "./office-az-inventory-authority-types";

const WAREHOUSE_OPERATOR_CAPABILITIES = [
  "inventory.quantity.read",
  "inventory.inbound.confirm",
  "inventory.fulfillment.pick",
  "inventory.fulfillment.pack",
  "inventory.fulfillment.ship",
  "inventory.transfer.dispatch",
  "inventory.transfer.receive",
  "inventory.stocktake.count",
] as const satisfies readonly OfficeAzInventoryCapability[];

const WAREHOUSE_MANAGER_CAPABILITIES = [
  ...WAREHOUSE_OPERATOR_CAPABILITIES,
  "inventory.audit.read",
  "inventory.adjust",
  "inventory.fulfillment.return",
  "inventory.fulfillment.restock",
  "inventory.transfer.request",
  "inventory.stocktake.open",
  "inventory.stocktake.complete",
] as const satisfies readonly OfficeAzInventoryCapability[];

const SUPER_ADMIN_CAPABILITIES = [
  ...WAREHOUSE_MANAGER_CAPABILITIES,
  "inventory.snapshot.export",
  "inventory.snapshot.import",
  "inventory.recovery.evaluate",
  "inventory.operator.manage",
] as const satisfies readonly OfficeAzInventoryCapability[];

const SERVICE_CAPABILITIES = [
  "inventory.quantity.read",
  "inventory.reservation.manage",
  "inventory.fulfillment.open",
  "inventory.snapshot.export",
  "inventory.snapshot.import",
  "inventory.recovery.evaluate",
  "inventory.authorization.issue",
] as const satisfies readonly OfficeAzInventoryCapability[];

export const OFFICE_AZ_ROLE_CAPABILITIES: Readonly<
  Record<OfficeAzInventoryAuthorityRole, readonly OfficeAzInventoryCapability[]>
> = {
  office_az_warehouse_operator: WAREHOUSE_OPERATOR_CAPABILITIES,
  office_az_warehouse_manager: WAREHOUSE_MANAGER_CAPABILITIES,
  office_az_inventory_super_admin: SUPER_ADMIN_CAPABILITIES,
  office_az_inventory_service: SERVICE_CAPABILITIES,
};

const TRANSFER_CAPABILITIES: readonly OfficeAzInventoryCapability[] = [
  "inventory.transfer.request",
  "inventory.transfer.dispatch",
  "inventory.transfer.receive",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function isStrictUtcIso(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function isUniqueStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonBlankString) &&
    new Set(value).size === value.length
  );
}

export function isOfficeAzInventoryAuthorityRole(
  value: unknown,
): value is OfficeAzInventoryAuthorityRole {
  return (
    typeof value === "string" &&
    (OFFICE_AZ_INVENTORY_AUTHORITY_ROLES as readonly string[]).includes(value)
  );
}

export function isOfficeAzInventoryCapability(
  value: unknown,
): value is OfficeAzInventoryCapability {
  return (
    typeof value === "string" &&
    (OFFICE_AZ_INVENTORY_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function isOfficeAzRoleCapabilityCompatible(
  role: unknown,
  capability: unknown,
): boolean {
  if (!isOfficeAzInventoryAuthorityRole(role)) return false;
  if (!isOfficeAzInventoryCapability(capability)) return false;
  return (OFFICE_AZ_ROLE_CAPABILITIES[role] as readonly string[]).includes(capability);
}

function denied(
  code: OfficeAzInventoryAuthorityDenialCode,
): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code };
}

function classifyCandidate(
  raw: unknown,
): OfficeAzInventoryAuthorityCandidate | null {
  return isPlainObject(raw) ? (raw as unknown as OfficeAzInventoryAuthorityCandidate) : null;
}

function validateRequest(
  raw: unknown,
): OfficeAzInventoryAuthorityRequest | null {
  if (!isPlainObject(raw)) return null;
  if (
    !isNonBlankString(raw.authenticatedUserId) ||
    !isNonBlankString(raw.actorId) ||
    !isNonBlankString(raw.operatorId) ||
    !isStrictUtcIso(raw.requestedAtIso) ||
    !isPositiveVersion(raw.expectedAuthorityVersion) ||
    !isUniqueStringArray(raw.requiredLocationIds)
  ) {
    return null;
  }
  if (
    raw.targetOperatorId !== undefined &&
    !isNonBlankString(raw.targetOperatorId)
  ) {
    return null;
  }
  return raw as unknown as OfficeAzInventoryAuthorityRequest;
}

/**
 * 1回の要求を、同一読取スナップショット由来のassignment候補で評価する。
 * 候補0件・複数件は曖昧なfallbackをせず明示的に拒否する。
 */
export function evaluateOfficeAzInventoryAuthority(
  candidates: readonly unknown[],
  requestInput: unknown,
  knownLocationIdsInput: readonly unknown[],
): OfficeAzInventoryAuthorityEvaluation {
  const request = validateRequest(requestInput);
  if (!request || !isUniqueStringArray(knownLocationIdsInput)) {
    return denied("INVALID_REQUEST");
  }
  const knownLocationIds = knownLocationIdsInput;

  if (candidates.length === 0) return denied("ZERO_ASSIGNMENT");
  if (candidates.length !== 1) return denied("MULTIPLE_ASSIGNMENTS");

  const candidate = classifyCandidate(candidates[0]);
  if (!candidate) return denied("INVALID_AUTHORITY_RECORD");
  if (candidate.source !== "server_resolved") {
    return denied("BROWSER_SUPPLIED_AUTHORITY");
  }

  if (!isOfficeAzInventoryAuthorityRole(candidate.role)) {
    return denied("UNKNOWN_ROLE");
  }
  if (candidate.principalKind !== "human" && candidate.principalKind !== "service") {
    return denied("INVALID_AUTHORITY_RECORD");
  }
  const serviceRole = candidate.role === "office_az_inventory_service";
  if ((candidate.principalKind === "service") !== serviceRole) {
    return denied("PRINCIPAL_ROLE_MISMATCH");
  }

  if (
    !isNonBlankString(candidate.authenticatedUserId) ||
    !isNonBlankString(candidate.actorId) ||
    !isNonBlankString(candidate.operatorId)
  ) {
    return denied("INVALID_AUTHORITY_RECORD");
  }
  if (candidate.authenticatedUserId !== request.authenticatedUserId) {
    return denied("AUTHENTICATED_USER_MISMATCH");
  }
  if (
    candidate.actorId !== request.actorId ||
    candidate.operatorId !== request.operatorId
  ) {
    return denied("ACTOR_OPERATOR_MISMATCH");
  }
  if (candidate.actorId === candidate.operatorId) {
    return denied("ACTOR_OPERATOR_COLLISION");
  }
  if (
    request.targetOperatorId !== undefined &&
    request.targetOperatorId === candidate.operatorId
  ) {
    return denied("SELF_ACTION_PROHIBITED");
  }

  // service経路は対応capabilityを定義しても、証明方式が承認されるまで常に停止する。
  if (serviceRole) {
    return {
      tag: "not_configured",
      code: "SERVICE_AUTHORITY_NOT_CONFIGURED",
    };
  }

  if (candidate.status !== "active") return denied("INACTIVE_OPERATOR");
  if (candidate.owner !== OFFICE_AZ_INVENTORY_OWNER || request.owner !== candidate.owner) {
    return denied("OWNER_MISMATCH");
  }

  if (!isOfficeAzInventoryCapability(request.capability)) {
    return denied("UNKNOWN_CAPABILITY");
  }
  if (
    request.capability === "inventory.operator.manage" &&
    request.targetOperatorId === undefined
  ) {
    return denied("INVALID_REQUEST");
  }
  if (!isOfficeAzRoleCapabilityCompatible(candidate.role, request.capability)) {
    return denied("ROLE_CAPABILITY_MISMATCH");
  }
  if (
    !Array.isArray(candidate.capabilities) ||
    !candidate.capabilities.every(isOfficeAzInventoryCapability) ||
    new Set(candidate.capabilities).size !== candidate.capabilities.length
  ) {
    return denied("INVALID_AUTHORITY_RECORD");
  }
  if (!(candidate.capabilities as readonly string[]).includes(request.capability)) {
    return denied("CAPABILITY_NOT_GRANTED");
  }

  if (!isPositiveVersion(candidate.authorityVersion)) {
    return denied("MISSING_AUTHORITY_VERSION");
  }
  if (candidate.authorityVersion !== request.expectedAuthorityVersion) {
    return denied("STALE_AUTHORITY_VERSION");
  }
  if (
    !isStrictUtcIso(candidate.validFromIso) ||
    (candidate.validUntilIso !== null && !isStrictUtcIso(candidate.validUntilIso))
  ) {
    return denied("INVALID_AUTHORITY_RECORD");
  }
  const requestedAt = Date.parse(request.requestedAtIso as string);
  if (requestedAt < Date.parse(candidate.validFromIso)) return denied("NOT_YET_VALID");
  if (
    candidate.validUntilIso !== null &&
    requestedAt >= Date.parse(candidate.validUntilIso)
  ) {
    return denied("EXPIRED");
  }

  if (request.requiredLocationIds.length === 0) return denied("MISSING_LOCATION");
  if (
    isOfficeAzInventoryCapability(request.capability) &&
    (TRANSFER_CAPABILITIES as readonly string[]).includes(request.capability) &&
    request.requiredLocationIds.length !== 2
  ) {
    return denied("INVALID_TRANSFER_SCOPE");
  }
  if (!isUniqueStringArray(candidate.allowedLocationIds)) {
    return denied("INVALID_AUTHORITY_RECORD");
  }
  if (
    candidate.allowedLocationIds.some(
      (locationId) => !(knownLocationIds as readonly string[]).includes(locationId),
    ) ||
    request.requiredLocationIds.some(
      (locationId) => !(knownLocationIds as readonly string[]).includes(locationId),
    )
  ) {
    return denied("UNKNOWN_LOCATION");
  }
  if (
    request.requiredLocationIds.some(
      (locationId) =>
        !(candidate.allowedLocationIds as readonly string[]).includes(locationId),
    )
  ) {
    return denied("LOCATION_NOT_GRANTED");
  }

  const authority: AuthorizedOfficeAzInventoryAuthority = {
    authenticatedUserId: candidate.authenticatedUserId,
    actorId: candidate.actorId,
    operatorId: candidate.operatorId,
    principalKind: "human",
    status: "active",
    owner: OFFICE_AZ_INVENTORY_OWNER,
    role: candidate.role,
    capability: request.capability,
    requiredLocationIds: [...request.requiredLocationIds],
    authorityVersion: candidate.authorityVersion,
    validFromIso: candidate.validFromIso,
    validUntilIso: candidate.validUntilIso,
    resolvedAtIso: request.requestedAtIso,
  };
  return { tag: "authorized", authority };
}
