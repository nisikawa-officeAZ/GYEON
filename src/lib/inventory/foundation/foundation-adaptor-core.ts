/**
 * Pure Book adaptor core for the sealed Foundation V2 inventory runtime.
 *
 * Five separate pure surfaces: command dispatch, append-only audit read,
 * snapshot V3 export, snapshot V1/V2/V3 import, and recovery-evidence
 * evaluation. Each surface validates its request, calls the injected
 * `FoundationPort` exactly once with no retry/reorder/batch/reconcile, and
 * returns a closed, fail-closed Book-owned result. No Foundation package,
 * DB, network, environment, filesystem, clock, randomness, React, Next.js,
 * legacy Book core, product mapping, route, UI, or Android dependency is
 * used here. CSV surfaces are intentionally absent.
 */

import {
  FOUNDATION_ADAPTOR_FAILURE_MESSAGES,
  FOUNDATION_INTEGRATION_CONTRACT_VERSION,
  FOUNDATION_PORT_OUTCOME_TAGS,
  isFoundationOwnerIdentity,
  isFoundationRuntimeCommand,
  isFoundationSnapshotImportContract,
  type BookInvocationContext,
  type FoundationAdaptorFailure,
  type FoundationAdaptorFailureCode,
  type FoundationAuditReadRequest,
  type FoundationAuditReadResult,
  type FoundationCommandDispatchRequest,
  type FoundationCommandDispatchResult,
  type FoundationPort,
  type FoundationPortOutcome,
  type FoundationRecoveryEvaluationRequest,
  type FoundationRecoveryEvaluationResult,
  type FoundationSnapshotExportRequest,
  type FoundationSnapshotExportResult,
  type FoundationSnapshotImportRequest,
  type FoundationSnapshotImportResult,
} from "./foundation-adaptor-types.js";

// ---------------------------------------------------------------------------
// Shared validation and classification helpers
// ---------------------------------------------------------------------------

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(code: FoundationAdaptorFailureCode): FoundationAdaptorFailure {
  return { ok: false, code, message: FOUNDATION_ADAPTOR_FAILURE_MESSAGES[code] };
}

function validateBookContext(
  context: unknown,
): FoundationAdaptorFailureCode | null {
  if (!isPlainObject(context)) return "invalid_request";
  if (
    !isNonBlankString(context.bookRequestId) ||
    !isNonBlankString(context.bookActorId) ||
    !isNonBlankString(context.bookOperatorId) ||
    !isNonBlankString(context.bookDealerId) ||
    !isNonBlankString(context.requestedAtIso)
  ) {
    return "invalid_request";
  }
  if (context.integrationContractVersion !== FOUNDATION_INTEGRATION_CONTRACT_VERSION) {
    return "unsupported_contract_version";
  }
  return null;
}

function validateNativeEnvelope(
  native: unknown,
): FoundationAdaptorFailureCode | null {
  if (!isPlainObject(native)) return "invalid_request";
  if (!isNonBlankString(native.actor) || !isNonBlankString(native.operator)) {
    return "invalid_request";
  }
  if (native.owner !== undefined && !isFoundationOwnerIdentity(native.owner)) {
    return "invalid_owner";
  }
  if (native.requestId !== undefined && !isNonBlankString(native.requestId)) {
    return "invalid_request";
  }
  if (native.idempotencyKey !== undefined && !isNonBlankString(native.idempotencyKey)) {
    return "invalid_request";
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PortOutcomeClassification =
  | { readonly kind: "recognized"; readonly outcome: FoundationPortOutcome }
  | { readonly kind: "unknown_result" }
  | { readonly kind: "malformed_result" };

/**
 * Runtime-validates every recognized result variant's required fields, not
 * merely its status tag. A known tag with missing/invalid required fields is
 * malformed; an unrecognized or non-object shape is unknown. Both fail
 * closed via the caller.
 */
function classifyPortOutcome(raw: unknown): PortOutcomeClassification {
  if (!isPlainObject(raw)) {
    return { kind: "unknown_result" };
  }
  const tag = raw.tag;
  if (
    typeof tag !== "string" ||
    !(FOUNDATION_PORT_OUTCOME_TAGS as readonly string[]).includes(tag)
  ) {
    return { kind: "unknown_result" };
  }

  switch (tag) {
    case "success": {
      if (!Object.prototype.hasOwnProperty.call(raw, "value")) {
        return { kind: "malformed_result" };
      }
      return { kind: "recognized", outcome: { tag: "success", value: raw.value } };
    }
    case "denied": {
      if (!isNonBlankString(raw.reason)) return { kind: "malformed_result" };
      return { kind: "recognized", outcome: { tag: "denied", reason: raw.reason } };
    }
    case "replay_conflict": {
      if (!isNonBlankString(raw.reason)) return { kind: "malformed_result" };
      return {
        kind: "recognized",
        outcome: { tag: "replay_conflict", reason: raw.reason },
      };
    }
    case "stale_version": {
      if (!isNonBlankString(raw.reason)) return { kind: "malformed_result" };
      return {
        kind: "recognized",
        outcome: { tag: "stale_version", reason: raw.reason },
      };
    }
    case "invalid_recovery": {
      if (!isNonBlankString(raw.reason)) return { kind: "malformed_result" };
      return {
        kind: "recognized",
        outcome: { tag: "invalid_recovery", reason: raw.reason },
      };
    }
    case "unknown": {
      return { kind: "recognized", outcome: { tag: "unknown" } };
    }
    default: {
      return { kind: "unknown_result" };
    }
  }
}

/** Maps a recognized non-success port outcome to its adaptor failure code. */
function nonSuccessOutcomeFailureCode(
  outcome: Exclude<FoundationPortOutcome, { tag: "success" }>,
): FoundationAdaptorFailureCode {
  switch (outcome.tag) {
    case "denied":
      return "authorization_denied";
    case "replay_conflict":
      return "replay_conflict";
    case "stale_version":
      return "stale_version";
    case "invalid_recovery":
      return "invalid_recovery";
    case "unknown":
      return "unknown_result";
  }
}

type PortInvocation =
  | { readonly kind: "outcome"; readonly raw: unknown }
  | { readonly kind: "transport_failure" };

/**
 * Invokes the injected port exactly once. Thrown/rejected values are never
 * inspected, forwarded, or logged — only a fixed sanitized failure is ever
 * produced.
 */
async function invokePortOnce(
  thunk: () => Promise<unknown> | unknown,
): Promise<PortInvocation> {
  try {
    const raw = await Promise.resolve(thunk());
    return { kind: "outcome", raw };
  } catch {
    return { kind: "transport_failure" };
  }
}

// ---------------------------------------------------------------------------
// Surface 1: command dispatch
// ---------------------------------------------------------------------------

export async function dispatchFoundationCommand(
  port: FoundationPort,
  request: FoundationCommandDispatchRequest,
): Promise<FoundationCommandDispatchResult> {
  if (!isPlainObject(request)) return fail("invalid_request");

  const contextFailure = validateBookContext(request.bookContext);
  if (contextFailure) return fail(contextFailure);

  const nativeFailure = validateNativeEnvelope(request.native);
  if (nativeFailure) return fail(nativeFailure);

  if (!isFoundationRuntimeCommand(request.command)) {
    return fail("unknown_command");
  }

  const invocation = await invokePortOnce(() => port.dispatchCommand(request));
  if (invocation.kind === "transport_failure") return fail("transport_failure");

  const classified = classifyPortOutcome(invocation.raw);
  if (classified.kind !== "recognized") return fail(classified.kind);

  const outcome = classified.outcome;
  if (outcome.tag === "success") {
    return { ok: true, command: request.command, result: outcome.value };
  }
  return fail(nonSuccessOutcomeFailureCode(outcome));
}

// ---------------------------------------------------------------------------
// Surface 2: append-only audit read
// ---------------------------------------------------------------------------

export async function readFoundationAuditLog(
  port: FoundationPort,
  request: FoundationAuditReadRequest,
): Promise<FoundationAuditReadResult> {
  if (!isPlainObject(request)) return fail("invalid_request");

  const contextFailure = validateBookContext(request.bookContext);
  if (contextFailure) return fail(contextFailure);

  const nativeFailure = validateNativeEnvelope(request.native);
  if (nativeFailure) return fail(nativeFailure);

  const invocation = await invokePortOnce(() => port.readAuditLog(request));
  if (invocation.kind === "transport_failure") return fail("transport_failure");

  const classified = classifyPortOutcome(invocation.raw);
  if (classified.kind !== "recognized") return fail(classified.kind);

  const outcome = classified.outcome;
  if (outcome.tag === "success") {
    if (!Array.isArray(outcome.value)) return fail("malformed_result");
    return { ok: true, entries: outcome.value };
  }
  return fail(nonSuccessOutcomeFailureCode(outcome));
}

// ---------------------------------------------------------------------------
// Surface 3: snapshot V3 export
// ---------------------------------------------------------------------------

export async function exportFoundationSnapshot(
  port: FoundationPort,
  request: FoundationSnapshotExportRequest,
): Promise<FoundationSnapshotExportResult> {
  if (!isPlainObject(request)) return fail("invalid_request");

  const contextFailure = validateBookContext(request.bookContext);
  if (contextFailure) return fail(contextFailure);

  const nativeFailure = validateNativeEnvelope(request.native);
  if (nativeFailure) return fail(nativeFailure);

  const invocation = await invokePortOnce(() => port.exportSnapshot(request));
  if (invocation.kind === "transport_failure") return fail("transport_failure");

  const classified = classifyPortOutcome(invocation.raw);
  if (classified.kind !== "recognized") return fail(classified.kind);

  const outcome = classified.outcome;
  if (outcome.tag === "success") {
    return {
      ok: true,
      contract: "INV001-P18_RUNTIME_SNAPSHOT_V3",
      snapshot: outcome.value,
    };
  }
  return fail(nonSuccessOutcomeFailureCode(outcome));
}

// ---------------------------------------------------------------------------
// Surface 4: snapshot V1/V2/V3 import
// ---------------------------------------------------------------------------

export async function importFoundationSnapshot(
  port: FoundationPort,
  request: FoundationSnapshotImportRequest,
): Promise<FoundationSnapshotImportResult> {
  if (!isPlainObject(request)) return fail("invalid_request");

  const contextFailure = validateBookContext(request.bookContext);
  if (contextFailure) return fail(contextFailure);

  const nativeFailure = validateNativeEnvelope(request.native);
  if (nativeFailure) return fail(nativeFailure);

  if (!isFoundationSnapshotImportContract(request.snapshotContract)) {
    return fail("invalid_snapshot_contract");
  }

  const invocation = await invokePortOnce(() => port.importSnapshot(request));
  if (invocation.kind === "transport_failure") return fail("transport_failure");

  const classified = classifyPortOutcome(invocation.raw);
  if (classified.kind !== "recognized") return fail(classified.kind);

  const outcome = classified.outcome;
  if (outcome.tag === "success") {
    return {
      ok: true,
      contract: request.snapshotContract,
      imported: outcome.value,
    };
  }
  return fail(nonSuccessOutcomeFailureCode(outcome));
}

// ---------------------------------------------------------------------------
// Surface 5: recovery-evidence evaluation
// ---------------------------------------------------------------------------

export async function evaluateFoundationRecoveryEvidence(
  port: FoundationPort,
  request: FoundationRecoveryEvaluationRequest,
): Promise<FoundationRecoveryEvaluationResult> {
  if (!isPlainObject(request)) return fail("invalid_request");

  const contextFailure = validateBookContext(request.bookContext);
  if (contextFailure) return fail(contextFailure);

  const nativeFailure = validateNativeEnvelope(request.native);
  if (nativeFailure) return fail(nativeFailure);

  const invocation = await invokePortOnce(() => port.evaluateRecoveryEvidence(request));
  if (invocation.kind === "transport_failure") return fail("transport_failure");

  const classified = classifyPortOutcome(invocation.raw);
  if (classified.kind !== "recognized") return fail(classified.kind);

  const outcome = classified.outcome;
  if (outcome.tag === "success") {
    return { ok: true, evaluation: outcome.value };
  }
  return fail(nonSuccessOutcomeFailureCode(outcome));
}
