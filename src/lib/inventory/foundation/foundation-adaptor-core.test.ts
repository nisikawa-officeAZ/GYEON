import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  dispatchFoundationCommand,
  evaluateFoundationRecoveryEvidence,
  exportFoundationSnapshot,
  importFoundationSnapshot,
  readFoundationAuditLog,
} from "./foundation-adaptor-core.js";
import {
  FOUNDATION_INTEGRATION_CONTRACT_VERSION,
  FOUNDATION_RUNTIME_COMMANDS,
  FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS,
  type BookInvocationContext,
  type FoundationAuditReadRequest,
  type FoundationCommandDispatchRequest,
  type FoundationNativeRequestEnvelope,
  type FoundationPort,
  type FoundationRecoveryEvaluationRequest,
  type FoundationRuntimeCommand,
  type FoundationSnapshotExportRequest,
  type FoundationSnapshotImportRequest,
} from "./foundation-adaptor-types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContext(
  overrides: Partial<BookInvocationContext> = {},
): BookInvocationContext {
  return {
    bookRequestId: "book-request-1",
    bookActorId: "book-actor-1",
    bookOperatorId: "book-operator-1",
    bookDealerId: "book-dealer-1",
    integrationContractVersion: FOUNDATION_INTEGRATION_CONTRACT_VERSION,
    requestedAtIso: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

function makeNative(
  overrides: Partial<FoundationNativeRequestEnvelope> = {},
): FoundationNativeRequestEnvelope {
  return {
    actor: "native-actor-1",
    operator: "native-operator-1",
    ...overrides,
  };
}

interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** Builds a FoundationPort whose every method records its call and returns `respond()`. */
function makeMockPort(respond: () => unknown): {
  port: FoundationPort;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const port = {
    dispatchCommand: (request: unknown) => {
      calls.push({ method: "dispatchCommand", args: [request] });
      return respond();
    },
    readAuditLog: (request: unknown) => {
      calls.push({ method: "readAuditLog", args: [request] });
      return respond();
    },
    exportSnapshot: (request: unknown) => {
      calls.push({ method: "exportSnapshot", args: [request] });
      return respond();
    },
    importSnapshot: (request: unknown) => {
      calls.push({ method: "importSnapshot", args: [request] });
      return respond();
    },
    evaluateRecoveryEvidence: (request: unknown) => {
      calls.push({ method: "evaluateRecoveryEvidence", args: [request] });
      return respond();
    },
  } as unknown as FoundationPort;
  return { port, calls };
}

function success(value: unknown) {
  return { tag: "success", value };
}

// ---------------------------------------------------------------------------
// Book invocation context validation
// ---------------------------------------------------------------------------

describe("book invocation context validation", () => {
  it("fails closed with invalid_request on each missing/blank required context field, without calling the port", async () => {
    const blankFields: Array<keyof BookInvocationContext> = [
      "bookRequestId",
      "bookActorId",
      "bookOperatorId",
      "bookDealerId",
      "requestedAtIso",
    ];
    for (const field of blankFields) {
      const { port, calls } = makeMockPort(() => success({}));
      const request = {
        bookContext: makeContext({ [field]: "   " } as Partial<BookInvocationContext>),
        command: "adjust_inventory" as FoundationRuntimeCommand,
        native: makeNative(),
      };
      const result = await dispatchFoundationCommand(port, request);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "invalid_request");
      assert.equal(calls.length, 0);
    }
  });

  it("fails closed with unsupported_contract_version on any version other than 2.0, without calling the port", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    const request = {
      bookContext: makeContext({
        integrationContractVersion: "1.0" as unknown as typeof FOUNDATION_INTEGRATION_CONTRACT_VERSION,
      }),
      command: "adjust_inventory" as FoundationRuntimeCommand,
      native: makeNative(),
    };
    const result = await dispatchFoundationCommand(port, request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_contract_version");
    assert.equal(calls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Native envelope validation
// ---------------------------------------------------------------------------

describe("native request envelope validation", () => {
  it("fails closed with invalid_request when actor or operator is missing/blank", async () => {
    for (const overrides of [{ actor: "" }, { operator: "   " }]) {
      const { port, calls } = makeMockPort(() => success({}));
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(overrides),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "invalid_request");
      assert.equal(calls.length, 0);
    }
  });

  it("fails closed with invalid_owner when an invalid owner is supplied", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    const result = await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "adjust_inventory",
      native: makeNative({ owner: "NOT_A_REAL_OWNER" as never }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_owner");
    assert.equal(calls.length, 0);
  });

  it("accepts each closed owner identity when supplied", async () => {
    for (const owner of ["OFFICE_AZ", "ATTRACTION"] as const) {
      const { port } = makeMockPort(() => success({ echoedOwner: owner }));
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative({ owner }),
      });
      assert.equal(result.ok, true);
    }
  });

  it("fails closed with invalid_request when a supplied requestId or idempotencyKey is blank", async () => {
    for (const overrides of [{ requestId: "  " }, { idempotencyKey: "" }]) {
      const { port, calls } = makeMockPort(() => success({}));
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(overrides),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "invalid_request");
      assert.equal(calls.length, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

describe("command dispatch", () => {
  it("fails closed with unknown_command for an unrecognized command literal, without calling the port", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    const result = await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "not_a_real_command" as FoundationRuntimeCommand,
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unknown_command");
    assert.equal(calls.length, 0);
  });

  it("has exactly the 18 sealed command literals", () => {
    assert.equal(FOUNDATION_RUNTIME_COMMANDS.length, 18);
    assert.deepEqual(
      [...FOUNDATION_RUNTIME_COMMANDS].sort(),
      [
        "adjust_inventory",
        "authorize_with_evidence",
        "cancel_reservation",
        "confirm_shipment",
        "dispatch_transfer",
        "open_fulfillment",
        "pack_fulfillment",
        "pick_fulfillment",
        "receive_supplier_shipment",
        "receive_transfer",
        "request_transfer",
        "reserve",
        "restock_fulfillment",
        "return_fulfillment",
        "ship_fulfillment",
        "stocktake_complete",
        "stocktake_finalize_line",
        "stocktake_open",
      ].sort(),
    );
  });

  it("dispatches every one of the 18 literal commands exactly once, forwarding the exact command", async () => {
    for (const command of FOUNDATION_RUNTIME_COMMANDS) {
      const { port, calls } = makeMockPort(() => success({ echo: command }));
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command,
        native: makeNative(),
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "dispatchCommand");
      const forwardedRequest = calls[0]!.args[0] as FoundationCommandDispatchRequest;
      assert.equal(forwardedRequest.command, command);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.command, command);
    }
  });

  it("never auto-chains confirm_shipment to ship_fulfillment", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "confirm_shipment",
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
    assert.equal(
      (calls[0]!.args[0] as FoundationCommandDispatchRequest).command,
      "confirm_shipment",
    );
    assert.equal(
      calls.some(
        (call) => (call.args[0] as FoundationCommandDispatchRequest).command === "ship_fulfillment",
      ),
      false,
    );
  });

  it("forwards actor and operator unchanged and never swaps or defaults one from the other", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    const native = makeNative({ actor: "distinct-actor", operator: "distinct-operator" });
    await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "reserve",
      native,
    });
    const forwarded = (calls[0]!.args[0] as FoundationCommandDispatchRequest).native;
    assert.equal(forwarded.actor, "distinct-actor");
    assert.equal(forwarded.operator, "distinct-operator");
    assert.notEqual(forwarded.actor, forwarded.operator);
  });
});

// ---------------------------------------------------------------------------
// Append-only audit read
// ---------------------------------------------------------------------------

describe("append-only audit read", () => {
  it("returns the opaque entries array on success", async () => {
    const entries = [{ event: "one" }, { event: "two" }];
    const { port, calls } = makeMockPort(() => success(entries));
    const result = await readFoundationAuditLog(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "readAuditLog");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.entries, entries);
  });

  it("fails closed with malformed_result when the success value is not an array", async () => {
    const { port } = makeMockPort(() => success({ not: "an array" }));
    const result = await readFoundationAuditLog(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "malformed_result");
  });
});

// ---------------------------------------------------------------------------
// Snapshot V3 export
// ---------------------------------------------------------------------------

describe("snapshot V3 export", () => {
  it("tags a successful export with the fixed V3 export contract identity", async () => {
    const snapshotValue = { quantityStreams: {} };
    const { port, calls } = makeMockPort(() => success(snapshotValue));
    const result = await exportFoundationSnapshot(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "exportSnapshot");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contract, "INV001-P18_RUNTIME_SNAPSHOT_V3");
      assert.deepEqual(result.snapshot, snapshotValue);
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot V1/V2/V3 import
// ---------------------------------------------------------------------------

describe("snapshot V1/V2/V3 import", () => {
  it("accepts exactly the three historical/current snapshot contract identities", async () => {
    assert.deepEqual(
      [...FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS].sort(),
      [
        "INV001-P12_RUNTIME_SNAPSHOT_V1",
        "INV001-P17_RUNTIME_SNAPSHOT_V2",
        "INV001-P18_RUNTIME_SNAPSHOT_V3",
      ].sort(),
    );
    for (const contract of FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS) {
      const { port, calls } = makeMockPort(() => success({ imported: true }));
      const result = await importFoundationSnapshot(port, {
        bookContext: makeContext(),
        snapshotContract: contract,
        native: makeNative(),
      });
      assert.equal(calls.length, 1);
      assert.equal(
        (calls[0]!.args[0] as FoundationSnapshotImportRequest).snapshotContract,
        contract,
      );
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.contract, contract);
    }
  });

  it("rejects any other snapshot contract identity before calling the port", async () => {
    const { port, calls } = makeMockPort(() => success({}));
    const result = await importFoundationSnapshot(port, {
      bookContext: makeContext(),
      snapshotContract: "INV001-P9_RUNTIME_SNAPSHOT_V0" as never,
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_snapshot_contract");
    assert.equal(calls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Recovery-evidence evaluation
// ---------------------------------------------------------------------------

describe("recovery-evidence evaluation", () => {
  it("returns the opaque evaluation value on success", async () => {
    const evaluation = { recoverable: true };
    const { port, calls } = makeMockPort(() => success(evaluation));
    const result = await evaluateFoundationRecoveryEvidence(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "evaluateRecoveryEvidence");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.evaluation, evaluation);
  });

  it("maps an invalid_recovery port outcome to an invalid_recovery failure", async () => {
    const { port } = makeMockPort(() => ({ tag: "invalid_recovery", reason: "stale evidence" }));
    const result = await evaluateFoundationRecoveryEvidence(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_recovery");
  });
});

// ---------------------------------------------------------------------------
// Closed port-outcome classification: every recognized tag
// ---------------------------------------------------------------------------

describe("closed port outcome classification", () => {
  const cases: Array<{ outcome: unknown; expectedCode: string; label: string }> = [
    { outcome: { tag: "denied", reason: "not authorized" }, expectedCode: "authorization_denied", label: "denied" },
    {
      outcome: { tag: "replay_conflict", reason: "conflicting payload" },
      expectedCode: "replay_conflict",
      label: "replay_conflict",
    },
    {
      outcome: { tag: "stale_version", reason: "aggregate advanced" },
      expectedCode: "stale_version",
      label: "stale_version",
    },
    { outcome: { tag: "unknown" }, expectedCode: "unknown_result", label: "unknown tag variant" },
  ];

  for (const testCase of cases) {
    it(`maps the recognized "${testCase.label}" outcome to ${testCase.expectedCode}`, async () => {
      const { port } = makeMockPort(() => testCase.outcome);
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, testCase.expectedCode);
    });
  }

  it("fails closed as malformed_result for every known tag missing its required field", async () => {
    const malformedOutcomes: unknown[] = [
      { tag: "success" },
      { tag: "denied" },
      { tag: "denied", reason: "" },
      { tag: "denied", reason: 42 },
      { tag: "replay_conflict" },
      { tag: "stale_version" },
      { tag: "invalid_recovery" },
    ];
    for (const outcome of malformedOutcomes) {
      const { port } = makeMockPort(() => outcome);
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "malformed_result");
    }
  });

  it("fails closed as unknown_result for a non-object or unrecognized-tag response", async () => {
    const unknownResponses: unknown[] = [null, undefined, 42, "string", [], { tag: "totally_unrecognized" }];
    for (const response of unknownResponses) {
      const { port } = makeMockPort(() => response);
      const result = await dispatchFoundationCommand(port, {
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "unknown_result");
    }
  });

  it("does not omit an opaque success value that is falsy but present", async () => {
    const { port } = makeMockPort(() => ({ tag: "success", value: 0 }));
    const result = await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "adjust_inventory",
      native: makeNative(),
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.result, 0);
  });
});

// ---------------------------------------------------------------------------
// Sanitized thrown/rejected transport failures
// ---------------------------------------------------------------------------

describe("sanitized thrown/rejected transport failures", () => {
  it("converts a synchronous throw into a fixed, sanitized transport_failure with no leaked payload", async () => {
    const port = {
      dispatchCommand: () => {
        throw new Error("leaked-secret-token-do-not-expose");
      },
      readAuditLog: () => success([]),
      exportSnapshot: () => success({}),
      importSnapshot: () => success({}),
      evaluateRecoveryEvidence: () => success({}),
    } as unknown as FoundationPort;

    const result = await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "adjust_inventory",
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "transport_failure");
      assert.equal(result.message, "Foundation port transport failed unexpectedly.");
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes("leaked-secret-token-do-not-expose"), false);
      assert.equal(Object.keys(result).sort().join(","), "code,message,ok");
    }
  });

  it("converts a rejected promise into the same fixed, sanitized transport_failure", async () => {
    const port = {
      dispatchCommand: () => success({}),
      readAuditLog: () => Promise.reject(new Error("leaked-rejection-detail")),
      exportSnapshot: () => success({}),
      importSnapshot: () => success({}),
      evaluateRecoveryEvidence: () => success({}),
    } as unknown as FoundationPort;

    const result = await readFoundationAuditLog(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "transport_failure");
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes("leaked-rejection-detail"), false);
    }
  });

  it("sanitizes a thrown non-Error value the same way", async () => {
    const port = {
      dispatchCommand: () => success({}),
      readAuditLog: () => success([]),
      exportSnapshot: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw { secretApiKey: "sk-leaked-value" };
      },
      importSnapshot: () => success({}),
      evaluateRecoveryEvidence: () => success({}),
    } as unknown as FoundationPort;

    const result = await exportFoundationSnapshot(port, {
      bookContext: makeContext(),
      native: makeNative(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "transport_failure");
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes("sk-leaked-value"), false);
    }
  });
});

// ---------------------------------------------------------------------------
// Exact one-call / no-retry behavior for all five surfaces
// ---------------------------------------------------------------------------

describe("exact one-call, no-retry behavior for all five surfaces", () => {
  it("calls the port exactly once for command dispatch, even on a malformed outcome", async () => {
    const { port, calls } = makeMockPort(() => ({ tag: "denied" }));
    await dispatchFoundationCommand(port, {
      bookContext: makeContext(),
      command: "adjust_inventory",
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
  });

  it("calls the port exactly once for audit read, even on a malformed outcome", async () => {
    const { port, calls } = makeMockPort(() => ({ tag: "unknown_tag_value" }));
    await readFoundationAuditLog(port, { bookContext: makeContext(), native: makeNative() });
    assert.equal(calls.length, 1);
  });

  it("calls the port exactly once for snapshot export, even on a transport failure", async () => {
    let attempts = 0;
    const port = {
      dispatchCommand: () => success({}),
      readAuditLog: () => success([]),
      exportSnapshot: () => {
        attempts += 1;
        throw new Error("boom");
      },
      importSnapshot: () => success({}),
      evaluateRecoveryEvidence: () => success({}),
    } as unknown as FoundationPort;
    await exportFoundationSnapshot(port, { bookContext: makeContext(), native: makeNative() });
    assert.equal(attempts, 1);
  });

  it("calls the port exactly once for snapshot import, even on a denied outcome", async () => {
    const { port, calls } = makeMockPort(() => ({ tag: "denied", reason: "no" }));
    await importFoundationSnapshot(port, {
      bookContext: makeContext(),
      snapshotContract: "INV001-P18_RUNTIME_SNAPSHOT_V3",
      native: makeNative(),
    });
    assert.equal(calls.length, 1);
  });

  it("calls the port exactly once for recovery evaluation, even on a stale_version outcome", async () => {
    const { port, calls } = makeMockPort(() => ({ tag: "stale_version", reason: "advanced" }));
    await evaluateFoundationRecoveryEvidence(port, { bookContext: makeContext(), native: makeNative() });
    assert.equal(calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Exact request forwarding to the port: bookContext and native identity
// ---------------------------------------------------------------------------

describe("exact request forwarding to the port (bookContext and native identity)", () => {
  it("forwards the exact distinct bookContext and native object to dispatchCommand exactly once", async () => {
    const bookContext = makeContext({ bookRequestId: "distinct-context-dispatch" });
    const native = makeNative({ actor: "distinct-native-dispatch" });
    const { port, calls } = makeMockPort(() => success({}));
    await dispatchFoundationCommand(port, { bookContext, command: "adjust_inventory", native });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "dispatchCommand");
    const forwarded = calls[0]!.args[0] as FoundationCommandDispatchRequest;
    assert.equal(forwarded.bookContext, bookContext);
    assert.equal(forwarded.native, native);
    assert.equal(forwarded.command, "adjust_inventory");
  });

  it("forwards the exact distinct bookContext and native object to readAuditLog exactly once", async () => {
    const bookContext = makeContext({ bookRequestId: "distinct-context-audit" });
    const native = makeNative({ actor: "distinct-native-audit" });
    const { port, calls } = makeMockPort(() => success([]));
    await readFoundationAuditLog(port, { bookContext, native });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "readAuditLog");
    const forwarded = calls[0]!.args[0] as FoundationAuditReadRequest;
    assert.equal(forwarded.bookContext, bookContext);
    assert.equal(forwarded.native, native);
  });

  it("forwards the exact distinct bookContext and native object to exportSnapshot exactly once", async () => {
    const bookContext = makeContext({ bookRequestId: "distinct-context-export" });
    const native = makeNative({ actor: "distinct-native-export" });
    const { port, calls } = makeMockPort(() => success({}));
    await exportFoundationSnapshot(port, { bookContext, native });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "exportSnapshot");
    const forwarded = calls[0]!.args[0] as FoundationSnapshotExportRequest;
    assert.equal(forwarded.bookContext, bookContext);
    assert.equal(forwarded.native, native);
  });

  it("forwards the exact distinct bookContext and native object to importSnapshot exactly once", async () => {
    const bookContext = makeContext({ bookRequestId: "distinct-context-import" });
    const native = makeNative({ actor: "distinct-native-import" });
    const { port, calls } = makeMockPort(() => success({}));
    await importFoundationSnapshot(port, {
      bookContext,
      snapshotContract: "INV001-P18_RUNTIME_SNAPSHOT_V3",
      native,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "importSnapshot");
    const forwarded = calls[0]!.args[0] as FoundationSnapshotImportRequest;
    assert.equal(forwarded.bookContext, bookContext);
    assert.equal(forwarded.native, native);
    assert.equal(forwarded.snapshotContract, "INV001-P18_RUNTIME_SNAPSHOT_V3");
  });

  it("forwards the exact distinct bookContext and native object to evaluateRecoveryEvidence exactly once", async () => {
    const bookContext = makeContext({ bookRequestId: "distinct-context-recovery" });
    const native = makeNative({ actor: "distinct-native-recovery" });
    const { port, calls } = makeMockPort(() => success({}));
    await evaluateFoundationRecoveryEvidence(port, { bookContext, native });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "evaluateRecoveryEvidence");
    const forwarded = calls[0]!.args[0] as FoundationRecoveryEvaluationRequest;
    assert.equal(forwarded.bookContext, bookContext);
    assert.equal(forwarded.native, native);
  });
});

// ---------------------------------------------------------------------------
// Malformed runtime-unknown callers: fail closed, never throw, never call the port
// ---------------------------------------------------------------------------

describe("malformed runtime input safety (fail closed, never throws)", () => {
  type SurfaceResult = { readonly ok: boolean; readonly code?: string };

  const surfaces: Array<{
    name: string;
    call: (port: FoundationPort, request: unknown) => Promise<SurfaceResult>;
    validRequest: () => Record<string, unknown>;
  }> = [
    {
      name: "dispatchFoundationCommand",
      call: (port, request) => dispatchFoundationCommand(port, request as never),
      validRequest: () => ({
        bookContext: makeContext(),
        command: "adjust_inventory",
        native: makeNative(),
      }),
    },
    {
      name: "readFoundationAuditLog",
      call: (port, request) => readFoundationAuditLog(port, request as never),
      validRequest: () => ({ bookContext: makeContext(), native: makeNative() }),
    },
    {
      name: "exportFoundationSnapshot",
      call: (port, request) => exportFoundationSnapshot(port, request as never),
      validRequest: () => ({ bookContext: makeContext(), native: makeNative() }),
    },
    {
      name: "importFoundationSnapshot",
      call: (port, request) => importFoundationSnapshot(port, request as never),
      validRequest: () => ({
        bookContext: makeContext(),
        snapshotContract: "INV001-P18_RUNTIME_SNAPSHOT_V3",
        native: makeNative(),
      }),
    },
    {
      name: "evaluateFoundationRecoveryEvidence",
      call: (port, request) => evaluateFoundationRecoveryEvidence(port, request as never),
      validRequest: () => ({ bookContext: makeContext(), native: makeNative() }),
    },
  ];

  const malformedRequests: Array<{ label: string; make: (valid: Record<string, unknown>) => unknown }> = [
    { label: "missing request (undefined)", make: () => undefined },
    { label: "null request", make: () => null },
    {
      label: "request missing bookContext",
      make: (valid) => {
        const { bookContext, ...rest } = valid;
        return rest;
      },
    },
    {
      label: "request with null bookContext",
      make: (valid) => ({ ...valid, bookContext: null }),
    },
    {
      label: "request missing native",
      make: (valid) => {
        const { native, ...rest } = valid;
        return rest;
      },
    },
    {
      label: "request with null native",
      make: (valid) => ({ ...valid, native: null }),
    },
  ];

  for (const surface of surfaces) {
    for (const malformed of malformedRequests) {
      it(`${surface.name}: fails closed with invalid_request and never calls the port for ${malformed.label}`, async () => {
        const { port, calls } = makeMockPort(() => success({}));
        const request = malformed.make(surface.validRequest());
        const result = await surface.call(port, request);
        assert.equal(result.ok, false);
        assert.equal(result.code, "invalid_request");
        assert.equal(calls.length, 0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// CSV and legacy Book core absence (source contract)
// ---------------------------------------------------------------------------

describe("csv and legacy-core absence (source contract)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const typesSource = readFileSync(path.join(here, "foundation-adaptor-types.ts"), "utf8");
  const coreSource = readFileSync(path.join(here, "foundation-adaptor-core.ts"), "utf8");

  it("never declares a CSV-named export, type, command, or import", () => {
    const declarationPatterns = [
      /export (const|type|interface|function) \w*csv\w*/i,
      /from ["'][^"']*csv[^"']*["']/i,
      /:\s*\w*Csv\w*/,
    ];
    for (const source of [typesSource, coreSource]) {
      for (const pattern of declarationPatterns) {
        assert.equal(pattern.test(source), false, `unexpected CSV declaration match for ${pattern}`);
      }
    }
    assert.equal(
      FOUNDATION_RUNTIME_COMMANDS.some((command) => /csv/i.test(command)),
      false,
    );
  });

  it("never imports a legacy Book inventory core, a Foundation package, or a forbidden runtime dependency", () => {
    const forbiddenPatterns = [
      /office-az-inventory-core/i,
      /office-az-channel-contracts-core/i,
      /from ["']next/i,
      /from ["']react/i,
      /@supabase/i,
      /from ["']node:fs["']/i,
      /require\(/,
      /Math\.random/,
      /Date\.now/,
      /process\.env/,
    ];
    for (const source of [typesSource, coreSource]) {
      for (const pattern of forbiddenPatterns) {
        assert.equal(pattern.test(source), false, `unexpected match for ${pattern} in source`);
      }
    }
  });

  it("imports the core module from exactly the sibling types module and nothing else", () => {
    const importLines = coreSource
      .split("\n")
      .filter((line) => line.trim().startsWith("import ") || line.trim().startsWith("} from"));
    for (const line of importLines) {
      if (line.includes(" from ")) {
        assert.match(line, /from "\.\/foundation-adaptor-types\.js"/);
      }
    }
  });
});
