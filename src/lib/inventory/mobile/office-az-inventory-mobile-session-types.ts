/**
 * D5A Book-hosted mobile session/device contract.
 * Persist, token issuance, hostname, and Android source are out of scope.
 */

export const DEALEROS_INVENTORY_API_BASE_URL_KEY =
  "DEALEROS_INVENTORY_API_BASE_URL" as const;

export const MOBILE_ACCESS_LIFETIME_MS = 60 * 60 * 1000;
export const MOBILE_REFRESH_ABSOLUTE_CEILING_MS = 12 * 60 * 60 * 1000;

export const MOBILE_DEVICE_MANAGEMENT = "COMPANY_MANAGED" as const;

export const MOBILE_SESSION_OPERATIONS = ["issue", "refresh", "revoke"] as const;
export const MOBILE_DEVICE_OPERATIONS = ["register", "revoke_device"] as const;

export type MobileSessionOperation = (typeof MOBILE_SESSION_OPERATIONS)[number];
export type MobileDeviceOperation = (typeof MOBILE_DEVICE_OPERATIONS)[number];
export type MobileBoundaryOperation =
  | MobileSessionOperation
  | MobileDeviceOperation;

export const MOBILE_BOUNDARY_PUBLIC_CODES = [
  "unauthenticated",
  "session_invalid_or_stale",
  "tenant_context_unavailable",
  "operator_authority_not_configured",
  "operator_inactive",
  "authorization_denied",
  "owner_scope_denied",
  "location_scope_denied",
  "invalid_request",
  "unknown_operation",
  "stale_version",
  "dependency_not_configured",
  "downstream_failure",
] as const;

export type MobileBoundaryPublicCode =
  (typeof MOBILE_BOUNDARY_PUBLIC_CODES)[number];

export const MOBILE_BOUNDARY_MAX_BODY_BYTES = 32768;

export type MobileBoundaryResult =
  | { readonly ok: true; readonly operation: MobileBoundaryOperation; readonly accepted: true }
  | { readonly ok: false; readonly code: MobileBoundaryPublicCode };

export type MobileSessionParse =
  | {
      readonly ok: true;
      readonly operation: MobileSessionOperation;
      readonly actorId: string;
      readonly operatorId: string;
      readonly expectedAuthorityVersion: number;
      readonly requiredLocationIds: readonly string[];
      readonly deviceId: string;
      readonly sessionId?: string;
    }
  | { readonly ok: false; readonly code: "invalid_request" | "unknown_operation" };

export type MobileDeviceParse =
  | {
      readonly ok: true;
      readonly operation: "register";
      readonly actorId: string;
      readonly operatorId: string;
      readonly expectedAuthorityVersion: number;
      readonly requiredLocationIds: readonly string[];
      readonly enrollmentCode: string;
    }
  | {
      readonly ok: true;
      readonly operation: "revoke_device";
      readonly actorId: string;
      readonly operatorId: string;
      readonly expectedAuthorityVersion: number;
      readonly requiredLocationIds: readonly string[];
      readonly deviceId: string;
    }
  | { readonly ok: false; readonly code: "invalid_request" | "unknown_operation" };
