/**
 * Office AZ inventory authority の純粋な閉集合契約。
 *
 * DB・認証・UI から値を取得する責務は持たず、server resolver が同一時点で
 * 解決した候補を評価コアへ渡すための型だけを定義する。
 */

export const OFFICE_AZ_INVENTORY_OWNER = "OFFICE_AZ" as const;

export type OfficeAzInventoryOwner = typeof OFFICE_AZ_INVENTORY_OWNER;

export const OFFICE_AZ_INVENTORY_AUTHORITY_ROLES = [
  "office_az_warehouse_operator",
  "office_az_warehouse_manager",
  "office_az_inventory_super_admin",
  "office_az_inventory_service",
] as const;

export type OfficeAzInventoryAuthorityRole =
  (typeof OFFICE_AZ_INVENTORY_AUTHORITY_ROLES)[number];

export const OFFICE_AZ_INVENTORY_CAPABILITIES = [
  "inventory.quantity.read",
  "inventory.audit.read",
  "inventory.inbound.confirm",
  "inventory.adjust",
  "inventory.reservation.manage",
  "inventory.fulfillment.open",
  "inventory.fulfillment.pick",
  "inventory.fulfillment.pack",
  "inventory.fulfillment.ship",
  "inventory.fulfillment.return",
  "inventory.fulfillment.restock",
  "inventory.transfer.request",
  "inventory.transfer.dispatch",
  "inventory.transfer.receive",
  "inventory.stocktake.open",
  "inventory.stocktake.count",
  "inventory.stocktake.complete",
  "inventory.snapshot.export",
  "inventory.snapshot.import",
  "inventory.recovery.evaluate",
  "inventory.authorization.issue",
  "inventory.operator.manage",
  "inventory.device.register",
  "inventory.session.revoke",
  "inventory.session.issue",
] as const;

export type OfficeAzInventoryCapability =
  (typeof OFFICE_AZ_INVENTORY_CAPABILITIES)[number];

export const OFFICE_AZ_INVENTORY_OPERATOR_STATUSES = [
  "active",
  "suspended",
  "revoked",
] as const;

export type OfficeAzInventoryOperatorStatus =
  (typeof OFFICE_AZ_INVENTORY_OPERATOR_STATUSES)[number];

export const OFFICE_AZ_INVENTORY_PRINCIPAL_KINDS = ["human", "service"] as const;

export type OfficeAzInventoryPrincipalKind =
  (typeof OFFICE_AZ_INVENTORY_PRINCIPAL_KINDS)[number];

/** server resolver が作る候補。ブラウザ値をこの形へ直接変換してはならない。 */
export interface OfficeAzInventoryAuthorityCandidate {
  readonly source: "server_resolved";
  readonly authenticatedUserId: string;
  readonly actorId: string;
  readonly operatorId: string;
  readonly principalKind: OfficeAzInventoryPrincipalKind;
  readonly status: OfficeAzInventoryOperatorStatus;
  readonly owner: OfficeAzInventoryOwner;
  readonly role: OfficeAzInventoryAuthorityRole;
  readonly capabilities: readonly OfficeAzInventoryCapability[];
  readonly allowedLocationIds: readonly string[];
  readonly validFromIso: string;
  readonly validUntilIso: string | null;
  readonly authorityVersion: number;
}

/** 1回の権限判定に必要な、呼出側が要求する完全な境界。 */
export interface OfficeAzInventoryAuthorityRequest {
  readonly authenticatedUserId: string;
  readonly actorId: string;
  readonly operatorId: string;
  readonly owner: OfficeAzInventoryOwner;
  readonly capability: OfficeAzInventoryCapability;
  readonly requiredLocationIds: readonly string[];
  readonly expectedAuthorityVersion: number;
  readonly requestedAtIso: string;
  readonly targetOperatorId?: string;
}

export interface AuthorizedOfficeAzInventoryAuthority {
  readonly authenticatedUserId: string;
  readonly actorId: string;
  readonly operatorId: string;
  readonly principalKind: "human";
  readonly status: "active";
  readonly owner: OfficeAzInventoryOwner;
  readonly role: Exclude<
    OfficeAzInventoryAuthorityRole,
    "office_az_inventory_service"
  >;
  readonly capability: OfficeAzInventoryCapability;
  readonly requiredLocationIds: readonly string[];
  readonly authorityVersion: number;
  readonly validFromIso: string;
  readonly validUntilIso: string | null;
  readonly resolvedAtIso: string;
}

export const OFFICE_AZ_INVENTORY_AUTHORITY_DENIAL_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "BROWSER_SUPPLIED_AUTHORITY",
  "ZERO_ASSIGNMENT",
  "MULTIPLE_ASSIGNMENTS",
  "INVALID_AUTHORITY_RECORD",
  "UNKNOWN_ROLE",
  "PRINCIPAL_ROLE_MISMATCH",
  "AUTHENTICATED_USER_MISMATCH",
  "ACTOR_OPERATOR_MISMATCH",
  "ACTOR_OPERATOR_COLLISION",
  "SELF_ACTION_PROHIBITED",
  "INACTIVE_OPERATOR",
  "OWNER_MISMATCH",
  "UNKNOWN_CAPABILITY",
  "ROLE_CAPABILITY_MISMATCH",
  "CAPABILITY_NOT_GRANTED",
  "MISSING_AUTHORITY_VERSION",
  "STALE_AUTHORITY_VERSION",
  "NOT_YET_VALID",
  "EXPIRED",
  "MISSING_LOCATION",
  "INVALID_TRANSFER_SCOPE",
  "UNKNOWN_LOCATION",
  "LOCATION_NOT_GRANTED",
] as const;

export type OfficeAzInventoryAuthorityDenialCode =
  (typeof OFFICE_AZ_INVENTORY_AUTHORITY_DENIAL_CODES)[number];

export type OfficeAzInventoryAuthorityEvaluation =
  | {
      readonly tag: "authorized";
      readonly authority: AuthorizedOfficeAzInventoryAuthority;
    }
  | {
      readonly tag: "denied";
      readonly code: OfficeAzInventoryAuthorityDenialCode;
    }
  | {
      readonly tag: "not_configured";
      readonly code: "SERVICE_AUTHORITY_NOT_CONFIGURED";
    };
