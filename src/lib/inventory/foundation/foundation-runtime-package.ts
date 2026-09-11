import "server-only";

import { isDeepStrictEqual } from "node:util";

import {
  createInventoryCommandDispatch,
  evaluateInventoryRuntimeRecoveryEvidence,
  exportInventoryRuntimeSnapshot,
  importInventoryRuntimeSnapshot,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT,
  isInventoryRuntimeCommand,
  validateInventoryRuntimeAuditLog,
  type InventoryRuntimeSnapshot,
  type InventoryRuntimeStore,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";
import type {
  FoundationPort,
  FoundationPortOutcome,
  FoundationRuntimeCommand,
} from "./foundation-adaptor-types.js";

/** Dependencies whose durable implementation is supplied by the later D3A gate. */
export interface FoundationRuntimePackageDependencies {
  readonly store: InventoryRuntimeStore;
}

const UNKNOWN_OUTCOME = Object.freeze({
  tag: "unknown" as const,
}) satisfies FoundationPortOutcome;

const AUTHORIZATION_DENIED_OUTCOME = Object.freeze({
  tag: "denied" as const,
  reason: "Foundation package denied authorization.",
}) satisfies FoundationPortOutcome;

const REPLAY_CONFLICT_OUTCOME = Object.freeze({
  tag: "replay_conflict" as const,
  reason: "Foundation package reported a replay identity conflict.",
}) satisfies FoundationPortOutcome;

const INVALID_RECOVERY_OUTCOME = Object.freeze({
  tag: "invalid_recovery" as const,
  reason: "Foundation package rejected recovery evidence.",
}) satisfies FoundationPortOutcome;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateRuntimeSnapshot(
  snapshot: InventoryRuntimeSnapshot,
): InventoryRuntimeSnapshot | null {
  const exported = exportInventoryRuntimeSnapshot(snapshot);
  if (
    exported.contract !== INVENTORY_RUNTIME_SNAPSHOT_CONTRACT ||
    !isPlainObject(exported.snapshot)
  ) {
    return null;
  }

  const validated = importInventoryRuntimeSnapshot(exported);
  if (
    !validated.ok ||
    !isPlainObject(validated.snapshot) ||
    !isDeepStrictEqual(exported.snapshot, validated.snapshot)
  ) {
    return null;
  }

  return validated.snapshot;
}

function mapDispatchOutcome(
  result: unknown,
  expectedCommand: FoundationRuntimeCommand,
): FoundationPortOutcome {
  if (!isPlainObject(result)) return UNKNOWN_OUTCOME;

  if (result.ok === true) {
    if (
      result.command !== expectedCommand ||
      !isInventoryRuntimeCommand(result.command) ||
      typeof result.replay !== "boolean" ||
      !Number.isSafeInteger(result.revision) ||
      (result.revision as number) < 0 ||
      !hasOwn(result, "result") ||
      !hasOwn(result, "commandEvidence")
    ) {
      return UNKNOWN_OUTCOME;
    }
    return Object.freeze({ tag: "success", value: result });
  }

  if (
    result.ok !== false ||
    (result.command !== null && !isInventoryRuntimeCommand(result.command)) ||
    typeof result.code !== "string" ||
    result.code.trim().length === 0 ||
    typeof result.message !== "string" ||
    !Number.isSafeInteger(result.revision) ||
    (result.revision as number) < 0 ||
    !hasOwn(result, "denialEvidence") ||
    !hasOwn(result, "result")
  ) {
    return UNKNOWN_OUTCOME;
  }

  switch (result.code) {
    case "authorization_required":
    case "authorization_denied":
      return AUTHORIZATION_DENIED_OUTCOME;
    case "native_command_replay_identity_mismatch":
      return REPLAY_CONFLICT_OUTCOME;
    case "store_rejected":
    default:
      return UNKNOWN_OUTCOME;
  }
}

/**
 * Binds the Book-owned D1 port to the exact pinned Foundation runtime package.
 * The accepted store is always injected; this module never creates a fallback.
 */
export function createFoundationRuntimePackagePort(
  dependencies: FoundationRuntimePackageDependencies,
): FoundationPort {
  const runtime = createInventoryCommandDispatch(dependencies.store);

  const port: FoundationPort = {
    dispatchCommand(request) {
      try {
        const result = runtime.dispatch({
          command: request.command,
          payload: request.native,
          authorization: request.native.authorizationEvidence,
        });
        return mapDispatchOutcome(result, request.command);
      } catch {
        return UNKNOWN_OUTCOME;
      }
    },

    readAuditLog() {
      try {
        const validated = validateInventoryRuntimeAuditLog(runtime.auditLog());
        if (!validated.ok) return UNKNOWN_OUTCOME;
        return Object.freeze({ tag: "success", value: validated.auditLog });
      } catch {
        return UNKNOWN_OUTCOME;
      }
    },

    exportSnapshot() {
      try {
        const validatedSnapshot = validateRuntimeSnapshot(
          dependencies.store.snapshot(),
        );
        if (validatedSnapshot === null) return UNKNOWN_OUTCOME;
        return Object.freeze({ tag: "success", value: validatedSnapshot });
      } catch {
        return UNKNOWN_OUTCOME;
      }
    },

    importSnapshot(request) {
      try {
        const imported = importInventoryRuntimeSnapshot({
          contract: request.snapshotContract,
          snapshot: request.native.payload,
        });
        if (!imported.ok || !isPlainObject(imported.snapshot)) {
          return UNKNOWN_OUTCOME;
        }
        return Object.freeze({ tag: "success", value: imported.snapshot });
      } catch {
        return UNKNOWN_OUTCOME;
      }
    },

    evaluateRecoveryEvidence() {
      try {
        const snapshot = dependencies.store.snapshot();
        if (validateRuntimeSnapshot(snapshot) === null) {
          return INVALID_RECOVERY_OUTCOME;
        }

        const evaluated = evaluateInventoryRuntimeRecoveryEvidence({
          snapshot,
          auditLog: runtime.auditLog(),
        });
        if (!evaluated.ok) return INVALID_RECOVERY_OUTCOME;
        if (
          !isPlainObject(evaluated.evidence) ||
          evaluated.evidence.contract !== INVENTORY_RUNTIME_SNAPSHOT_CONTRACT ||
          !Number.isSafeInteger(evaluated.evidence.snapshotRevision) ||
          (evaluated.evidence.snapshotRevision as number) < 0 ||
          !Number.isSafeInteger(evaluated.evidence.acceptedMutationCount) ||
          (evaluated.evidence.acceptedMutationCount as number) < 0 ||
          evaluated.evidence.roundTripMatched !== true
        ) {
          return UNKNOWN_OUTCOME;
        }
        return Object.freeze({ tag: "success", value: evaluated.evidence });
      } catch {
        return UNKNOWN_OUTCOME;
      }
    },
  };

  return Object.freeze(port);
}
