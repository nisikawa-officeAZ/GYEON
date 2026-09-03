/**
 * Book-owned pure boundary types for the sealed Foundation V2 inventory runtime.
 *
 * This module defines no business rules. It only shapes the injected port,
 * the Book invocation context, and the closed fail-closed result unions that
 * the pure adaptor core (`foundation-adaptor-core.ts`) validates against.
 */

// ---------------------------------------------------------------------------
// Foundation integration contract version
// ---------------------------------------------------------------------------

/**
 * The proven Foundation integration contract version (SPEC_INVENTORY_001
 * Foundation Integration Contract V2, `"version": "2.0"`). This is distinct
 * from any package/runtime release version and from a per-aggregate
 * optimistic-concurrency version carried in a native request envelope.
 */
export const FOUNDATION_INTEGRATION_CONTRACT_VERSION = "2.0" as const;

export type FoundationIntegrationContractVersion =
  typeof FOUNDATION_INTEGRATION_CONTRACT_VERSION;

export function isFoundationIntegrationContractVersion(
  value: unknown,
): value is FoundationIntegrationContractVersion {
  return value === FOUNDATION_INTEGRATION_CONTRACT_VERSION;
}

// ---------------------------------------------------------------------------
// Foundation owner identity (closed union; P0 dual legal owners)
// ---------------------------------------------------------------------------

export const FOUNDATION_OWNER_IDENTITIES = ["OFFICE_AZ", "ATTRACTION"] as const;

export type FoundationOwnerIdentity = (typeof FOUNDATION_OWNER_IDENTITIES)[number];

export function isFoundationOwnerIdentity(
  value: unknown,
): value is FoundationOwnerIdentity {
  return (
    typeof value === "string" &&
    (FOUNDATION_OWNER_IDENTITIES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Sealed runtime commands (exact 18-literal catalogue)
// ---------------------------------------------------------------------------

export const FOUNDATION_RUNTIME_COMMANDS = [
  "authorize_with_evidence",
  "receive_supplier_shipment",
  "adjust_inventory",
  "reserve",
  "cancel_reservation",
  "confirm_shipment",
  "open_fulfillment",
  "pick_fulfillment",
  "pack_fulfillment",
  "ship_fulfillment",
  "return_fulfillment",
  "restock_fulfillment",
  "request_transfer",
  "dispatch_transfer",
  "receive_transfer",
  "stocktake_open",
  "stocktake_finalize_line",
  "stocktake_complete",
] as const;

export type FoundationRuntimeCommand = (typeof FOUNDATION_RUNTIME_COMMANDS)[number];

export function isFoundationRuntimeCommand(
  value: unknown,
): value is FoundationRuntimeCommand {
  return (
    typeof value === "string" &&
    (FOUNDATION_RUNTIME_COMMANDS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Snapshot contract identities (export is V3-only; import accepts V1/V2/V3)
// ---------------------------------------------------------------------------

export const FOUNDATION_SNAPSHOT_EXPORT_CONTRACT =
  "INV001-P18_RUNTIME_SNAPSHOT_V3" as const;

export type FoundationSnapshotExportContract =
  typeof FOUNDATION_SNAPSHOT_EXPORT_CONTRACT;

export const FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS = [
  "INV001-P12_RUNTIME_SNAPSHOT_V1",
  "INV001-P17_RUNTIME_SNAPSHOT_V2",
  "INV001-P18_RUNTIME_SNAPSHOT_V3",
] as const;

export type FoundationSnapshotImportContract =
  (typeof FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS)[number];

export function isFoundationSnapshotImportContract(
  value: unknown,
): value is FoundationSnapshotImportContract {
  return (
    typeof value === "string" &&
    (FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Opaque native Foundation values
// ---------------------------------------------------------------------------

/**
 * A value whose internal shape is owned by the Foundation runtime, not by
 * this Book adaptor. The adaptor forwards it without inspecting or
 * recalculating its meaning.
 */
export type FoundationOpaqueValue = unknown;

/**
 * The proven native Foundation request value. `actor` and `operator` are
 * always present and are forwarded unchanged and never defaulted from one
 * another. Every other field is optional because Foundation command payloads
 * do not universally require owner/location/product/request/idempotency/
 * version/authorization/recovery context; when supplied, it is preserved
 * unchanged and forwarded as-is.
 */
export interface FoundationNativeRequestEnvelope {
  readonly actor: string;
  readonly operator: string;
  readonly owner?: FoundationOwnerIdentity;
  readonly locationId?: FoundationOpaqueValue;
  readonly productId?: FoundationOpaqueValue;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  /** Per-aggregate optimistic-concurrency version; distinct from the integration contract version. */
  readonly aggregateVersion?: FoundationOpaqueValue;
  readonly authorizationEvidence?: FoundationOpaqueValue;
  readonly recoveryEvidence?: FoundationOpaqueValue;
  readonly payload?: FoundationOpaqueValue;
}

// ---------------------------------------------------------------------------
// Book invocation context (Book-owned; never native Foundation fields)
// ---------------------------------------------------------------------------

/**
 * Book-owned invocation metadata. None of these fields are native Foundation
 * fields; they identify the Book-side caller and request, and are carried
 * alongside — never merged into — the nested native request value.
 */
export interface BookInvocationContext {
  readonly bookRequestId: string;
  readonly bookActorId: string;
  readonly bookOperatorId: string;
  readonly bookDealerId: string;
  readonly integrationContractVersion: FoundationIntegrationContractVersion;
  readonly requestedAtIso: string;
}

// ---------------------------------------------------------------------------
// Per-surface port requests
// ---------------------------------------------------------------------------

export interface FoundationCommandDispatchRequest {
  readonly bookContext: BookInvocationContext;
  readonly command: FoundationRuntimeCommand;
  readonly native: FoundationNativeRequestEnvelope;
}

export interface FoundationAuditReadRequest {
  readonly bookContext: BookInvocationContext;
  readonly native: FoundationNativeRequestEnvelope;
}

export interface FoundationSnapshotExportRequest {
  readonly bookContext: BookInvocationContext;
  readonly native: FoundationNativeRequestEnvelope;
}

export interface FoundationSnapshotImportRequest {
  readonly bookContext: BookInvocationContext;
  readonly snapshotContract: FoundationSnapshotImportContract;
  readonly native: FoundationNativeRequestEnvelope;
}

export interface FoundationRecoveryEvaluationRequest {
  readonly bookContext: BookInvocationContext;
  readonly native: FoundationNativeRequestEnvelope;
}

// ---------------------------------------------------------------------------
// Injected Foundation port (pure boundary; Book-owned contract)
// ---------------------------------------------------------------------------

/**
 * The pure port promises exactly the closed `FoundationPortOutcome` shape
 * below for every method. Real transport/package binding is out of scope for
 * this pure contract; only the shape of the boundary is defined here.
 */
export interface FoundationPort {
  dispatchCommand(
    request: FoundationCommandDispatchRequest,
  ): Promise<FoundationPortOutcome> | FoundationPortOutcome;

  readAuditLog(
    request: FoundationAuditReadRequest,
  ): Promise<FoundationPortOutcome> | FoundationPortOutcome;

  exportSnapshot(
    request: FoundationSnapshotExportRequest,
  ): Promise<FoundationPortOutcome> | FoundationPortOutcome;

  importSnapshot(
    request: FoundationSnapshotImportRequest,
  ): Promise<FoundationPortOutcome> | FoundationPortOutcome;

  evaluateRecoveryEvidence(
    request: FoundationRecoveryEvaluationRequest,
  ): Promise<FoundationPortOutcome> | FoundationPortOutcome;
}

// ---------------------------------------------------------------------------
// Closed port outcome union (what the injected port promises to return)
// ---------------------------------------------------------------------------

export const FOUNDATION_PORT_OUTCOME_TAGS = [
  "success",
  "denied",
  "replay_conflict",
  "stale_version",
  "invalid_recovery",
  "unknown",
] as const;

export type FoundationPortOutcomeTag = (typeof FOUNDATION_PORT_OUTCOME_TAGS)[number];

export interface FoundationPortSuccessOutcome {
  readonly tag: "success";
  readonly value: FoundationOpaqueValue;
}

export interface FoundationPortDeniedOutcome {
  readonly tag: "denied";
  readonly reason: string;
}

export interface FoundationPortReplayConflictOutcome {
  readonly tag: "replay_conflict";
  readonly reason: string;
}

export interface FoundationPortStaleVersionOutcome {
  readonly tag: "stale_version";
  readonly reason: string;
}

export interface FoundationPortInvalidRecoveryOutcome {
  readonly tag: "invalid_recovery";
  readonly reason: string;
}

export interface FoundationPortUnknownOutcome {
  readonly tag: "unknown";
}

export type FoundationPortOutcome =
  | FoundationPortSuccessOutcome
  | FoundationPortDeniedOutcome
  | FoundationPortReplayConflictOutcome
  | FoundationPortStaleVersionOutcome
  | FoundationPortInvalidRecoveryOutcome
  | FoundationPortUnknownOutcome;

// ---------------------------------------------------------------------------
// Closed Book-owned adaptor failure (sanitized; fixed code/message only)
// ---------------------------------------------------------------------------

export const FOUNDATION_ADAPTOR_FAILURE_CODES = [
  "invalid_request",
  "unsupported_contract_version",
  "invalid_owner",
  "unknown_command",
  "invalid_snapshot_contract",
  "malformed_result",
  "unknown_result",
  "authorization_denied",
  "replay_conflict",
  "stale_version",
  "invalid_recovery",
  "transport_failure",
] as const;

export type FoundationAdaptorFailureCode =
  (typeof FOUNDATION_ADAPTOR_FAILURE_CODES)[number];

/**
 * Fixed, safe messages only. Never populated from a caught error, stack,
 * cause, token, or secret.
 */
export const FOUNDATION_ADAPTOR_FAILURE_MESSAGES: Readonly<
  Record<FoundationAdaptorFailureCode, string>
> = {
  invalid_request: "Foundation adaptor request is missing a required field.",
  unsupported_contract_version:
    "Foundation integration contract version is not supported.",
  invalid_owner: "Foundation owner identity is invalid.",
  unknown_command: "Foundation runtime command is not recognized.",
  invalid_snapshot_contract:
    "Foundation snapshot contract identity is not recognized.",
  malformed_result: "Foundation port returned a malformed result.",
  unknown_result: "Foundation port returned an unrecognized result.",
  authorization_denied:
    "Foundation port denied authorization for this request.",
  replay_conflict:
    "Foundation port reported a replay conflict for this request.",
  stale_version:
    "Foundation port reported a stale aggregate version for this request.",
  invalid_recovery:
    "Foundation port reported invalid recovery evidence for this request.",
  transport_failure: "Foundation port transport failed unexpectedly.",
};

export interface FoundationAdaptorFailure {
  readonly ok: false;
  readonly code: FoundationAdaptorFailureCode;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Per-surface closed results
// ---------------------------------------------------------------------------

export interface FoundationCommandDispatchSuccess {
  readonly ok: true;
  readonly command: FoundationRuntimeCommand;
  readonly result: FoundationOpaqueValue;
}

export type FoundationCommandDispatchResult =
  | FoundationCommandDispatchSuccess
  | FoundationAdaptorFailure;

export interface FoundationAuditReadSuccess {
  readonly ok: true;
  readonly entries: readonly FoundationOpaqueValue[];
}

export type FoundationAuditReadResult =
  | FoundationAuditReadSuccess
  | FoundationAdaptorFailure;

export interface FoundationSnapshotExportSuccess {
  readonly ok: true;
  readonly contract: FoundationSnapshotExportContract;
  readonly snapshot: FoundationOpaqueValue;
}

export type FoundationSnapshotExportResult =
  | FoundationSnapshotExportSuccess
  | FoundationAdaptorFailure;

export interface FoundationSnapshotImportSuccess {
  readonly ok: true;
  readonly contract: FoundationSnapshotImportContract;
  readonly imported: FoundationOpaqueValue;
}

export type FoundationSnapshotImportResult =
  | FoundationSnapshotImportSuccess
  | FoundationAdaptorFailure;

export interface FoundationRecoveryEvaluationSuccess {
  readonly ok: true;
  readonly evaluation: FoundationOpaqueValue;
}

export type FoundationRecoveryEvaluationResult =
  | FoundationRecoveryEvaluationSuccess
  | FoundationAdaptorFailure;
