import "server-only";

import { resolveOfficeAzInventoryAuthority } from "../authority/resolve-office-az-inventory-authority.js";
import type {
  OfficeAzInventoryAuthorityEvaluation,
  OfficeAzInventoryCapability,
} from "../authority/office-az-inventory-authority-types.js";
import { executeWithFoundationPersistence } from "./foundation-persistence-adaptor.js";
import { resolveFoundationProduct } from "./foundation-product-mapping.js";
import {
  dispatchFoundationCommand,
  evaluateFoundationRecoveryEvidence,
  exportFoundationSnapshot,
  importFoundationSnapshot,
  readFoundationAuditLog,
} from "./foundation-adaptor-core.js";
import { createFoundationRuntimePackagePort } from "./foundation-runtime-package.js";
import {
  FOUNDATION_INTEGRATION_CONTRACT_VERSION,
  isFoundationRuntimeCommand,
  isFoundationSnapshotImportContract,
  type BookInvocationContext,
  type FoundationNativeRequestEnvelope,
  type FoundationPort,
  type FoundationRuntimeCommand,
  type FoundationSnapshotImportContract,
} from "./foundation-adaptor-types.js";
import type { FoundationProductMappingStore } from "./foundation-product-mapping.js";
import type { FoundationRuntimePackageDependencies } from "./foundation-runtime-package.js";

export const FOUNDATION_BOUNDARY_MAX_BODY_BYTES = 32768;

export const FOUNDATION_BOUNDARY_PUBLIC_CODES = [
  "unauthenticated",
  "session_invalid_or_stale",
  "tenant_context_unavailable",
  "operator_authority_not_configured",
  "operator_inactive",
  "authorization_denied",
  "owner_scope_denied",
  "location_scope_denied",
  "product_mapping_not_configured",
  "invalid_request",
  "unknown_operation",
  "replay_conflict",
  "stale_version",
  "dependency_not_configured",
  "downstream_failure",
] as const;

export type FoundationBoundaryPublicCode =
  (typeof FOUNDATION_BOUNDARY_PUBLIC_CODES)[number];

export type FoundationBoundaryOperation =
  | "quantity_query"
  | "command"
  | "audit_read"
  | "snapshot_export"
  | "snapshot_import"
  | "recovery_evaluate";

const REQUEST_KEYS = new Set([
  "actorId",
  "operatorId",
  "expectedAuthorityVersion",
  "requiredLocationIds",
  "operation",
  "command",
  "bookProductId",
  "expectedMappingRevision",
  "snapshotContract",
]);

const SERVICE_ONLY_COMMANDS = new Set<FoundationRuntimeCommand>([
  "reserve",
  "cancel_reservation",
  "confirm_shipment",
  "open_fulfillment",
  "authorize_with_evidence",
]);

const COMMAND_CAPABILITY: Readonly<
  Record<FoundationRuntimeCommand, OfficeAzInventoryCapability>
> = {
  authorize_with_evidence: "inventory.authorization.issue",
  receive_supplier_shipment: "inventory.inbound.confirm",
  adjust_inventory: "inventory.adjust",
  reserve: "inventory.reservation.manage",
  cancel_reservation: "inventory.reservation.manage",
  confirm_shipment: "inventory.reservation.manage",
  open_fulfillment: "inventory.fulfillment.open",
  pick_fulfillment: "inventory.fulfillment.pick",
  pack_fulfillment: "inventory.fulfillment.pack",
  ship_fulfillment: "inventory.fulfillment.ship",
  return_fulfillment: "inventory.fulfillment.return",
  restock_fulfillment: "inventory.fulfillment.restock",
  request_transfer: "inventory.transfer.request",
  dispatch_transfer: "inventory.transfer.dispatch",
  receive_transfer: "inventory.transfer.receive",
  stocktake_open: "inventory.stocktake.open",
  stocktake_finalize_line: "inventory.stocktake.count",
  stocktake_complete: "inventory.stocktake.complete",
};

const OPERATION_CAPABILITY: Readonly<
  Record<Exclude<FoundationBoundaryOperation, "command">, OfficeAzInventoryCapability>
> = {
  quantity_query: "inventory.quantity.read",
  audit_read: "inventory.audit.read",
  snapshot_export: "inventory.snapshot.export",
  snapshot_import: "inventory.snapshot.import",
  recovery_evaluate: "inventory.recovery.evaluate",
};

const PRODUCT_REQUIRED_OPERATIONS = new Set<FoundationBoundaryOperation>([
  "quantity_query",
  "command",
]);

export type FoundationBoundarySuccess = {
  readonly ok: true;
  readonly operation: FoundationBoundaryOperation;
  readonly command?: FoundationRuntimeCommand;
  readonly accepted: true;
};

export type FoundationBoundaryFailure = {
  readonly ok: false;
  readonly code: FoundationBoundaryPublicCode;
};

export type FoundationBoundaryResult =
  | FoundationBoundarySuccess
  | FoundationBoundaryFailure;

export type FoundationBoundaryAuthorityResolver = (
  input: unknown,
) => Promise<OfficeAzInventoryAuthorityEvaluation>;

export type FoundationBoundaryOptions = {
  readonly resolveAuthority?: FoundationBoundaryAuthorityResolver;
  readonly port?: FoundationPort | null;
  readonly store?: FoundationRuntimePackageDependencies["store"];
  readonly mappingStore?: FoundationProductMappingStore | null;
  readonly requestedAtIso?: string;
  readonly requestId?: string;
};

type ParsedBoundaryRequest = {
  readonly actorId: string;
  readonly operatorId: string;
  readonly expectedAuthorityVersion: number;
  readonly requiredLocationIds: readonly string[];
  readonly operation: FoundationBoundaryOperation;
  readonly command?: FoundationRuntimeCommand;
  readonly bookProductId?: string;
  readonly expectedMappingRevision?: number;
  readonly snapshotContract?: FoundationSnapshotImportContract;
};

type ParsedBoundaryResult =
  | { readonly ok: true; readonly value: ParsedBoundaryRequest }
  | { readonly ok: false; readonly code: "invalid_request" | "unknown_operation" };

const MAX_ID_LENGTH = 512;
const BOOK_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fail(code: FoundationBoundaryPublicCode): FoundationBoundaryFailure {
  return { ok: false, code };
}

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

function parseRequiredLocationIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const locations: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isTrimmedNonEmptyId(item) || seen.has(item)) return null;
    seen.add(item);
    locations.push(item);
  }
  return locations;
}

function isBoundaryOperation(value: unknown): value is FoundationBoundaryOperation {
  return (
    value === "quantity_query" ||
    value === "command" ||
    value === "audit_read" ||
    value === "snapshot_export" ||
    value === "snapshot_import" ||
    value === "recovery_evaluate"
  );
}

export function parseFoundationBoundaryRequest(
  input: unknown,
): ParsedBoundaryResult {
  if (!isPlainRecord(input)) return { ok: false, code: "invalid_request" };
  if (!Object.keys(input).every((key) => REQUEST_KEYS.has(key))) {
    return { ok: false, code: "invalid_request" };
  }
  if (
    !isTrimmedNonEmptyId(input.actorId) ||
    !isTrimmedNonEmptyId(input.operatorId) ||
    !isPositiveSafeInteger(input.expectedAuthorityVersion)
  ) {
    return { ok: false, code: "invalid_request" };
  }
  const requiredLocationIds = parseRequiredLocationIds(input.requiredLocationIds);
  if (requiredLocationIds === null || requiredLocationIds.length === 0) {
    return { ok: false, code: "invalid_request" };
  }
  if (!("operation" in input)) return { ok: false, code: "invalid_request" };
  if (!isBoundaryOperation(input.operation)) {
    return { ok: false, code: "unknown_operation" };
  }

  if (input.operation === "command") {
    if (!("command" in input)) return { ok: false, code: "invalid_request" };
    if (!isFoundationRuntimeCommand(input.command)) {
      return { ok: false, code: "unknown_operation" };
    }
  } else if ("command" in input) {
    return { ok: false, code: "invalid_request" };
  }

  if (input.operation === "snapshot_import") {
    if (!isFoundationSnapshotImportContract(input.snapshotContract)) {
      return { ok: false, code: "invalid_request" };
    }
  } else if ("snapshotContract" in input) {
    return { ok: false, code: "invalid_request" };
  }

  if ("bookProductId" in input && !BOOK_UUID.test(String(input.bookProductId))) {
    return { ok: false, code: "invalid_request" };
  }
  if (
    "expectedMappingRevision" in input &&
    !isPositiveSafeInteger(input.expectedMappingRevision)
  ) {
    return { ok: false, code: "invalid_request" };
  }

  return {
    ok: true,
    value: {
      actorId: input.actorId,
      operatorId: input.operatorId,
      expectedAuthorityVersion: input.expectedAuthorityVersion,
      requiredLocationIds,
      operation: input.operation,
      ...("command" in input && isFoundationRuntimeCommand(input.command)
        ? { command: input.command }
        : {}),
      ...("bookProductId" in input && typeof input.bookProductId === "string"
        ? { bookProductId: input.bookProductId }
        : {}),
      ...("expectedMappingRevision" in input &&
      isPositiveSafeInteger(input.expectedMappingRevision)
        ? { expectedMappingRevision: input.expectedMappingRevision }
        : {}),
      ...("snapshotContract" in input &&
      isFoundationSnapshotImportContract(input.snapshotContract)
        ? { snapshotContract: input.snapshotContract }
        : {}),
    },
  };
}

export function mapAuthorityEvaluation(
  evaluation: OfficeAzInventoryAuthorityEvaluation,
): FoundationBoundaryPublicCode {
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
    case "CAPABILITY_NOT_GRANTED":
    case "ROLE_CAPABILITY_MISMATCH":
    case "UNKNOWN_CAPABILITY":
    case "UNKNOWN_ROLE":
    case "AUTHENTICATED_USER_MISMATCH":
    case "PRINCIPAL_ROLE_MISMATCH":
    case "SELF_ACTION_PROHIBITED":
      return "authorization_denied";
    case "UNAUTHENTICATED":
      return "unauthenticated";
    case "INVALID_REQUEST":
    case "BROWSER_SUPPLIED_AUTHORITY":
    case "ACTOR_OPERATOR_MISMATCH":
    case "ACTOR_OPERATOR_COLLISION":
    case "INVALID_AUTHORITY_RECORD":
    case "MISSING_AUTHORITY_VERSION":
    default:
      return "invalid_request";
  }
}

function capabilityFor(request: ParsedBoundaryRequest): OfficeAzInventoryCapability | null {
  if (request.operation === "command") {
    if (!request.command) return null;
    return COMMAND_CAPABILITY[request.command];
  }
  return OPERATION_CAPABILITY[request.operation];
}

export function bindFoundationPort(
  store: FoundationRuntimePackageDependencies["store"],
): FoundationPort {
  return createFoundationRuntimePackagePort({ store });
}

export { executeWithFoundationPersistence };

function resolvePort(options: FoundationBoundaryOptions | undefined): FoundationPort | null {
  if (options?.port) return options.port;
  if (options?.store) return bindFoundationPort(options.store);
  return null;
}

function accepted(
  operation: FoundationBoundaryOperation,
  command?: FoundationRuntimeCommand,
): FoundationBoundarySuccess {
  return command
    ? { ok: true, operation, command, accepted: true }
    : { ok: true, operation, accepted: true };
}

function serverRequestId(options: FoundationBoundaryOptions | undefined): string {
  if (options?.requestId && isTrimmedNonEmptyId(options.requestId)) {
    return options.requestId;
  }
  return crypto.randomUUID();
}

export async function executeFoundationServerBoundary(
  input: unknown,
  options?: FoundationBoundaryOptions,
): Promise<FoundationBoundaryResult> {
  const parsedResult = parseFoundationBoundaryRequest(input);
  if (!parsedResult.ok) return fail(parsedResult.code);
  const parsed = parsedResult.value;
  if (parsed.actorId === parsed.operatorId) return fail("invalid_request");

  if (parsed.operation === "command" && parsed.command) {
    if (SERVICE_ONLY_COMMANDS.has(parsed.command)) {
      return fail("dependency_not_configured");
    }
  }

  const capability = capabilityFor(parsed);
  if (!capability) return fail("unknown_operation");

  try {
    const resolveAuthority =
      options?.resolveAuthority ?? resolveOfficeAzInventoryAuthority;
    const evaluation = await resolveAuthority({
      actorId: parsed.actorId,
      operatorId: parsed.operatorId,
      capability,
      requiredLocationIds: parsed.requiredLocationIds,
      expectedAuthorityVersion: parsed.expectedAuthorityVersion,
    });

    if (evaluation.tag !== "authorized") {
      return fail(mapAuthorityEvaluation(evaluation));
    }

    let foundationProductId: string | undefined;
    if (PRODUCT_REQUIRED_OPERATIONS.has(parsed.operation)) {
      if (!parsed.bookProductId || !parsed.expectedMappingRevision) {
        return fail("product_mapping_not_configured");
      }
      if (!options?.mappingStore) return fail("product_mapping_not_configured");
      const mapped = resolveFoundationProduct(options.mappingStore, {
        bookProductId: parsed.bookProductId,
        expectedMappingRevision: parsed.expectedMappingRevision,
      });
      if (!mapped.ok) return fail("product_mapping_not_configured");
      foundationProductId = mapped.foundationProductId;
    }

    if (parsed.operation === "quantity_query") {
      return fail("dependency_not_configured");
    }

    const port = resolvePort(options);
    if (!port) return fail("dependency_not_configured");

    const requestId = serverRequestId(options);
    const requestedAtIso = options?.requestedAtIso ?? new Date().toISOString();
    const bookContext: BookInvocationContext = {
      bookRequestId: requestId,
      bookActorId: evaluation.authority.actorId,
      bookOperatorId: evaluation.authority.operatorId,
      bookDealerId: "OFFICE_AZ",
      integrationContractVersion: FOUNDATION_INTEGRATION_CONTRACT_VERSION,
      requestedAtIso,
    };
    const native: FoundationNativeRequestEnvelope = {
      actor: evaluation.authority.actorId,
      operator: evaluation.authority.operatorId,
      owner: "OFFICE_AZ",
      locationId: parsed.requiredLocationIds[0],
      ...(foundationProductId ? { productId: foundationProductId } : {}),
      requestId,
      idempotencyKey: `inv001-d4:${requestId}`,
    };

    if (parsed.operation === "command" && parsed.command) {
      const result = await dispatchFoundationCommand(port, {
        bookContext,
        command: parsed.command,
        native,
      });
      if (!result.ok) {
        if (result.code === "replay_conflict") return fail("replay_conflict");
        if (result.code === "stale_version") return fail("stale_version");
        if (result.code === "authorization_denied") return fail("authorization_denied");
        return fail("downstream_failure");
      }
      return accepted(parsed.operation, parsed.command);
    }

    if (parsed.operation === "audit_read") {
      const result = await readFoundationAuditLog(port, { bookContext, native });
      if (!result.ok) return fail("downstream_failure");
      return accepted(parsed.operation);
    }

    if (parsed.operation === "snapshot_export") {
      const result = await exportFoundationSnapshot(port, { bookContext, native });
      if (!result.ok) return fail("downstream_failure");
      return accepted(parsed.operation);
    }

    if (parsed.operation === "snapshot_import" && parsed.snapshotContract) {
      const result = await importFoundationSnapshot(port, {
        bookContext,
        snapshotContract: parsed.snapshotContract,
        native,
      });
      if (!result.ok) return fail("downstream_failure");
      return accepted(parsed.operation);
    }

    const result = await evaluateFoundationRecoveryEvidence(port, {
      bookContext,
      native,
    });
    if (!result.ok) return fail("downstream_failure");
    return accepted(parsed.operation);
  } catch {
    return fail("downstream_failure");
  }
}

export function publicStatusFor(code: FoundationBoundaryPublicCode): number {
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
    case "product_mapping_not_configured":
    case "replay_conflict":
    case "stale_version":
      return 409;
    case "dependency_not_configured":
      return 503;
    case "downstream_failure":
      return 502;
  }
}
