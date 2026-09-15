import "server-only";

import {
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
  importInventoryRuntimeSnapshot,
  type InventoryRuntimeSnapshot,
  type InventoryRuntimeStore,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";

export const FOUNDATION_PERSISTENCE_CONTRACT =
  "INV001-P24-BOOK-D3A-PERSISTENCE-V1" as const;

export const FOUNDATION_PERSISTENCE_SNAPSHOT_CONTRACTS = [
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
] as const;

export type FoundationPersistenceSnapshotContract =
  (typeof FOUNDATION_PERSISTENCE_SNAPSHOT_CONTRACTS)[number];

export type FoundationPersistenceOwner = "OFFICE_AZ" | "ATTRACTION";

export interface FoundationPersistenceIdentity {
  readonly owner: FoundationPersistenceOwner;
  readonly locationId: string;
  readonly productId: string;
}

export interface FoundationPersistenceRequestIdentity {
  readonly requestId: string;
  readonly idempotencyKey: string;
  /** Lower-case SHA-256 of the complete material request, produced by the later server boundary. */
  readonly requestFingerprint: string;
  readonly actor: string;
  readonly operator: string;
}

export type FoundationPersistenceJson =
  | null
  | boolean
  | number
  | string
  | readonly FoundationPersistenceJson[]
  | { readonly [key: string]: FoundationPersistenceJson };

export interface FoundationPersistenceLoadedRecord {
  readonly tag: "found";
  readonly snapshotContract: FoundationPersistenceSnapshotContract;
  readonly snapshot: unknown;
  readonly revision: number;
}

export type FoundationPersistenceLoadResult =
  | FoundationPersistenceLoadedRecord
  | { readonly tag: "not_found" }
  | { readonly tag: "denied" }
  | { readonly tag: "error" };

export interface FoundationPersistenceInitializeInput {
  readonly contract: typeof FOUNDATION_PERSISTENCE_CONTRACT;
  readonly identity: FoundationPersistenceIdentity;
  readonly requestId: string;
  readonly actor: string;
  readonly operator: string;
  readonly snapshotContract: typeof INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3;
  readonly snapshot: FoundationPersistenceJson;
  readonly evidence: FoundationPersistenceJson;
}

export type FoundationPersistenceInitializeResult =
  | { readonly tag: "initialized"; readonly revision: number }
  | { readonly tag: "already_exists"; readonly revision: number }
  | { readonly tag: "denied" }
  | { readonly tag: "error" };

export interface FoundationPersistenceFinalizeInput {
  readonly contract: typeof FOUNDATION_PERSISTENCE_CONTRACT;
  readonly identity: FoundationPersistenceIdentity;
  readonly request: FoundationPersistenceRequestIdentity;
  readonly expectedRevision: number;
  readonly snapshotContract:
    | typeof INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3
    | null;
  readonly nextSnapshot: FoundationPersistenceJson | null;
  readonly outcome: FoundationPersistenceJson;
  readonly evidence: FoundationPersistenceJson;
}

export type FoundationPersistenceFinalizeResult =
  | {
      readonly tag: "committed" | "recorded" | "replayed";
      readonly revision: number;
      readonly outcome: unknown;
    }
  | { readonly tag: "stale"; readonly revision: number }
  | { readonly tag: "replay_conflict"; readonly revision: number }
  | { readonly tag: "not_found" }
  | { readonly tag: "denied" }
  | { readonly tag: "error" };

/**
 * Server-only transport boundary. D3A does not choose credentials, bind an
 * authenticated user, or expose a browser client. D4/D4A must inject the
 * actual server driver later.
 */
export interface FoundationPersistenceDriver {
  load(
    identity: FoundationPersistenceIdentity,
  ): Promise<FoundationPersistenceLoadResult | unknown>;
  initialize(
    input: FoundationPersistenceInitializeInput,
  ): Promise<FoundationPersistenceInitializeResult | unknown>;
  finalize(
    input: FoundationPersistenceFinalizeInput,
  ): Promise<FoundationPersistenceFinalizeResult | unknown>;
}

export type FoundationPersistenceFailureCode =
  | "invalid_request"
  | "owner_not_enabled"
  | "not_configured"
  | "invalid_persisted_snapshot"
  | "invalid_operation_result"
  | "execution_failed"
  | "stale_revision"
  | "replay_conflict"
  | "driver_denied"
  | "driver_failure"
  | "malformed_driver_result";

const FAILURE_MESSAGES: Readonly<
  Record<FoundationPersistenceFailureCode, string>
> = Object.freeze({
  invalid_request: "Foundation persistence request is invalid.",
  owner_not_enabled: "Foundation persistence owner is not enabled.",
  not_configured: "Foundation persistence aggregate is not configured.",
  invalid_persisted_snapshot: "Foundation persisted snapshot is invalid.",
  invalid_operation_result: "Foundation operation result is invalid.",
  execution_failed: "Foundation operation failed.",
  stale_revision: "Foundation persistence revision is stale.",
  replay_conflict: "Foundation persistence replay identity conflicts.",
  driver_denied: "Foundation persistence driver denied the request.",
  driver_failure: "Foundation persistence driver failed.",
  malformed_driver_result: "Foundation persistence driver returned an invalid result.",
});

export interface FoundationPersistenceFailure {
  readonly ok: false;
  readonly code: FoundationPersistenceFailureCode;
  readonly message: string;
}

export type FoundationPersistenceExecutionResult<T> =
  | {
      readonly ok: true;
      readonly replay: boolean;
      readonly revision: number;
      readonly outcome: T;
    }
  | FoundationPersistenceFailure;

export interface FoundationPersistenceOperationResult<T> {
  readonly outcome: T;
  /** Redacted, non-secret audit evidence. Raw authorization data is forbidden. */
  readonly auditEvidence: unknown;
}

export interface ExecuteFoundationPersistenceInput<T> {
  readonly driver: FoundationPersistenceDriver;
  readonly identity: FoundationPersistenceIdentity;
  readonly request: FoundationPersistenceRequestIdentity;
  readonly execute: (
    store: InventoryRuntimeStore,
  ) =>
    | Promise<FoundationPersistenceOperationResult<T>>
    | FoundationPersistenceOperationResult<T>;
}

export interface InitializeFoundationPersistenceInput {
  readonly driver: FoundationPersistenceDriver;
  readonly identity: FoundationPersistenceIdentity;
  readonly requestId: string;
  readonly actor: string;
  readonly operator: string;
  readonly snapshot: unknown;
  readonly auditEvidence: unknown;
}

function failure(
  code: FoundationPersistenceFailureCode,
): FoundationPersistenceFailure {
  return Object.freeze({ ok: false, code, message: FAILURE_MESSAGES[code] });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  } catch {
    return false;
  }
}

function isNonBlankBounded(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value === value.trim()
  );
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSnapshotContract(
  value: unknown,
): value is FoundationPersistenceSnapshotContract {
  return (
    typeof value === "string" &&
    (FOUNDATION_PERSISTENCE_SNAPSHOT_CONTRACTS as readonly string[]).includes(
      value,
    )
  );
}

function validIdentity(value: unknown): value is FoundationPersistenceIdentity {
  if (!isPlainRecord(value)) return false;
  return (
    (value.owner === "OFFICE_AZ" || value.owner === "ATTRACTION") &&
    isNonBlankBounded(value.locationId) &&
    isNonBlankBounded(value.productId)
  );
}

function validRequestIdentity(
  value: unknown,
): value is FoundationPersistenceRequestIdentity {
  if (!isPlainRecord(value)) return false;
  return (
    isNonBlankBounded(value.requestId) &&
    isNonBlankBounded(value.idempotencyKey) &&
    typeof value.requestFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(value.requestFingerprint) &&
    isNonBlankBounded(value.actor) &&
    isNonBlankBounded(value.operator)
  );
}

function validDriver(value: unknown): value is FoundationPersistenceDriver {
  if (!isPlainRecord(value)) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return ["load", "initialize", "finalize"].every((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor !== undefined &&
        descriptor.get === undefined &&
        descriptor.set === undefined &&
        typeof descriptor.value === "function"
      );
    });
  } catch {
    return false;
  }
}

function cloneJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
  depth = 0,
): FoundationPersistenceJson | null | undefined {
  if (depth > 64) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "object") return undefined;

  const objectValue = value as object;
  if (seen.has(objectValue)) return undefined;
  seen.add(objectValue);
  try {
    if (Object.getOwnPropertySymbols(objectValue).length > 0) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(objectValue);
    if (Array.isArray(objectValue)) {
      const length = objectValue.length;
      const result: FoundationPersistenceJson[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined
        ) {
          return undefined;
        }
        const nested = cloneJsonValue(descriptor.value, seen, depth + 1);
        if (nested === undefined) return undefined;
        result.push(nested);
      }
      return result;
    }
    if (!isPlainRecord(objectValue)) return undefined;
    const result: Record<string, FoundationPersistenceJson> = {};
    for (const key of Object.keys(descriptors)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return undefined;
      }
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable) continue;
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        return undefined;
      }
      const nested = cloneJsonValue(descriptor.value, seen, depth + 1);
      if (nested === undefined) return undefined;
      result[key] = nested;
    }
    return result;
  } catch {
    return undefined;
  } finally {
    seen.delete(objectValue);
  }
}

const FORBIDDEN_AUDIT_KEY =
  /(?:authorization|cookie|password|secret|session|token|email|phone|address)/i;

function containsForbiddenAuditKey(value: FoundationPersistenceJson): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenAuditKey);
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_AUDIT_KEY.test(key) || containsForbiddenAuditKey(nested)) {
        return true;
      }
    }
  }
  return false;
}

function normalizeAuditEvidence(value: unknown): FoundationPersistenceJson | null {
  const normalized = cloneJsonValue(value);
  if (
    normalized === undefined ||
    normalized === null ||
    Array.isArray(normalized) ||
    typeof normalized !== "object" ||
    containsForbiddenAuditKey(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeOutcome(
  value: unknown,
): FoundationPersistenceJson | undefined {
  return cloneJsonValue(value);
}

function validatePersistedSnapshot(
  contract: FoundationPersistenceSnapshotContract,
  snapshot: unknown,
  expectedRevision: number,
): InventoryRuntimeSnapshot | null {
  const normalized = cloneJsonValue(snapshot);
  if (normalized === undefined) return null;
  const imported = importInventoryRuntimeSnapshot({ contract, snapshot: normalized });
  if (!imported.ok || imported.snapshot.revision !== expectedRevision) return null;
  return imported.snapshot;
}

function createBufferedStore(initial: InventoryRuntimeSnapshot): {
  readonly store: InventoryRuntimeStore;
  readonly pendingSnapshot: () => InventoryRuntimeSnapshot | null;
} {
  let current = initial;
  let pending: InventoryRuntimeSnapshot | null = null;

  const store: InventoryRuntimeStore = Object.freeze({
    snapshot() {
      return current;
    },
    commit(
      expectedRevision: number,
      next: Parameters<InventoryRuntimeStore["commit"]>[1],
    ) {
      if (
        pending !== null ||
        !isRevision(expectedRevision) ||
        expectedRevision !== current.revision
      ) {
        return false;
      }
      const nextJson = cloneJsonValue(next);
      if (nextJson === undefined || !isPlainRecord(nextJson)) return false;
      const candidate = {
        ...nextJson,
        revision: expectedRevision + 1,
      };
      const imported = importInventoryRuntimeSnapshot({
        contract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
        snapshot: candidate,
      });
      if (!imported.ok) return false;
      pending = imported.snapshot;
      current = imported.snapshot;
      return true;
    },
  });

  return Object.freeze({ store, pendingSnapshot: () => pending });
}

function classifyLoad(value: unknown): FoundationPersistenceLoadResult | null {
  const normalized = cloneJsonValue(value);
  if (!isPlainRecord(normalized) || typeof normalized.tag !== "string") return null;
  if (
    normalized.tag === "not_found" ||
    normalized.tag === "denied" ||
    normalized.tag === "error"
  ) {
    return { tag: normalized.tag };
  }
  if (
    normalized.tag === "found" &&
    isSnapshotContract(normalized.snapshotContract) &&
    Object.prototype.hasOwnProperty.call(normalized, "snapshot") &&
    isRevision(normalized.revision)
  ) {
    return {
      tag: "found",
      snapshotContract: normalized.snapshotContract,
      snapshot: normalized.snapshot,
      revision: normalized.revision,
    };
  }
  return null;
}

function classifyInitialize(
  value: unknown,
): FoundationPersistenceInitializeResult | null {
  const normalized = cloneJsonValue(value);
  if (!isPlainRecord(normalized) || typeof normalized.tag !== "string") return null;
  if (normalized.tag === "denied" || normalized.tag === "error") {
    return { tag: normalized.tag };
  }
  if (
    (normalized.tag === "initialized" || normalized.tag === "already_exists") &&
    isRevision(normalized.revision)
  ) {
    return { tag: normalized.tag, revision: normalized.revision };
  }
  return null;
}

function classifyFinalize(
  value: unknown,
): FoundationPersistenceFinalizeResult | null {
  const normalized = cloneJsonValue(value);
  if (!isPlainRecord(normalized) || typeof normalized.tag !== "string") return null;
  if (
    normalized.tag === "not_found" ||
    normalized.tag === "denied" ||
    normalized.tag === "error"
  ) {
    return { tag: normalized.tag };
  }
  if (
    (normalized.tag === "stale" || normalized.tag === "replay_conflict") &&
    isRevision(normalized.revision)
  ) {
    return { tag: normalized.tag, revision: normalized.revision };
  }
  if (
    (normalized.tag === "committed" ||
      normalized.tag === "recorded" ||
      normalized.tag === "replayed") &&
    isRevision(normalized.revision) &&
    Object.prototype.hasOwnProperty.call(normalized, "outcome")
  ) {
    return {
      tag: normalized.tag,
      revision: normalized.revision,
      outcome: normalized.outcome,
    };
  }
  return null;
}

export async function initializeFoundationPersistence(
  input: InitializeFoundationPersistenceInput,
): Promise<FoundationPersistenceExecutionResult<null>> {
  if (
    !isPlainRecord(input) ||
    !validDriver(input.driver) ||
    !validIdentity(input.identity) ||
    !isNonBlankBounded(input.requestId) ||
    !isNonBlankBounded(input.actor) ||
    !isNonBlankBounded(input.operator)
  ) {
    return failure("invalid_request");
  }
  if (input.identity.owner !== "OFFICE_AZ") return failure("owner_not_enabled");

  const evidence = normalizeAuditEvidence(input.auditEvidence);
  const snapshotJson = cloneJsonValue(input.snapshot);
  if (evidence === null || snapshotJson === undefined) {
    return failure("invalid_request");
  }
  const snapshot = validatePersistedSnapshot(
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
    snapshotJson,
    0,
  );
  if (snapshot === null) return failure("invalid_persisted_snapshot");
  const normalizedSnapshot = cloneJsonValue(snapshot);
  if (normalizedSnapshot === undefined) return failure("invalid_persisted_snapshot");

  let raw: unknown;
  try {
    raw = await input.driver.initialize({
      contract: FOUNDATION_PERSISTENCE_CONTRACT,
      identity: input.identity,
      requestId: input.requestId,
      actor: input.actor,
      operator: input.operator,
      snapshotContract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
      snapshot: normalizedSnapshot,
      evidence,
    });
  } catch {
    return failure("driver_failure");
  }
  const result = classifyInitialize(raw);
  if (result === null) return failure("malformed_driver_result");
  if (result.tag === "denied") return failure("driver_denied");
  if (result.tag === "error") return failure("driver_failure");
  if (result.revision !== 0) return failure("malformed_driver_result");
  return Object.freeze({ ok: true, replay: result.tag === "already_exists", revision: 0, outcome: null });
}

export async function executeWithFoundationPersistence<T>(
  input: ExecuteFoundationPersistenceInput<T>,
): Promise<FoundationPersistenceExecutionResult<T>> {
  if (
    !isPlainRecord(input) ||
    !validDriver(input.driver) ||
    !validIdentity(input.identity) ||
    !validRequestIdentity(input.request) ||
    typeof input.execute !== "function"
  ) {
    return failure("invalid_request");
  }
  if (input.identity.owner !== "OFFICE_AZ") return failure("owner_not_enabled");

  let rawLoad: unknown;
  try {
    rawLoad = await input.driver.load(input.identity);
  } catch {
    return failure("driver_failure");
  }
  const loaded = classifyLoad(rawLoad);
  if (loaded === null) return failure("malformed_driver_result");
  if (loaded.tag === "not_found") return failure("not_configured");
  if (loaded.tag === "denied") return failure("driver_denied");
  if (loaded.tag === "error") return failure("driver_failure");

  const snapshot = validatePersistedSnapshot(
    loaded.snapshotContract,
    loaded.snapshot,
    loaded.revision,
  );
  if (snapshot === null) return failure("invalid_persisted_snapshot");
  const buffered = createBufferedStore(snapshot);

  let operation: FoundationPersistenceOperationResult<T>;
  try {
    operation = await input.execute(buffered.store);
  } catch {
    return failure("execution_failed");
  }
  if (!isPlainRecord(operation) || !Object.prototype.hasOwnProperty.call(operation, "outcome")) {
    return failure("invalid_operation_result");
  }
  const outcome = normalizeOutcome(operation.outcome);
  const evidence = normalizeAuditEvidence(operation.auditEvidence);
  if (outcome === undefined || evidence === null) {
    return failure("invalid_operation_result");
  }

  const pending = buffered.pendingSnapshot();
  const pendingJson = pending === null ? null : cloneJsonValue(pending);
  if (pending !== null && pendingJson === undefined) {
    return failure("invalid_operation_result");
  }

  let rawFinalize: unknown;
  try {
    rawFinalize = await input.driver.finalize({
      contract: FOUNDATION_PERSISTENCE_CONTRACT,
      identity: input.identity,
      request: input.request,
      expectedRevision: loaded.revision,
      snapshotContract:
        pending === null ? null : INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
      nextSnapshot: pendingJson ?? null,
      outcome,
      evidence,
    });
  } catch {
    return failure("driver_failure");
  }

  const finalized = classifyFinalize(rawFinalize);
  if (finalized === null) return failure("malformed_driver_result");
  if (finalized.tag === "not_found") return failure("not_configured");
  if (finalized.tag === "denied") return failure("driver_denied");
  if (finalized.tag === "error") return failure("driver_failure");
  if (finalized.tag === "stale") return failure("stale_revision");
  if (finalized.tag === "replay_conflict") return failure("replay_conflict");
  if (
    (finalized.tag === "committed" && pending === null) ||
    (finalized.tag === "recorded" && pending !== null) ||
    (finalized.tag === "committed" &&
      finalized.revision !== loaded.revision + 1) ||
    (finalized.tag === "recorded" &&
      finalized.revision !== loaded.revision) ||
    (finalized.tag === "replayed" &&
      finalized.revision > loaded.revision)
  ) {
    return failure("malformed_driver_result");
  }
  const returnedOutcome = normalizeOutcome(finalized.outcome);
  if (returnedOutcome === undefined) return failure("malformed_driver_result");
  return Object.freeze({
    ok: true,
    replay: finalized.tag === "replayed",
    revision: finalized.revision,
    outcome: returnedOutcome as T,
  });
}
