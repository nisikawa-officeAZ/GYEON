import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  INVENTORY_RUNTIME_COMMANDS,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
  exportInventoryRuntimeSnapshot,
  importInventoryRuntimeSnapshot,
  type InventoryRuntimeSnapshot,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";
import { createInventoryInMemoryStore } from "../../../../node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryInMemoryStore.js";
import { buildMobileInventoryAcceptedEnvelopeRecord } from "../../../../node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/pure/mobileInventoryMutationEnvelope.js";
import {
  FOUNDATION_RUNTIME_COMMANDS,
  FOUNDATION_SNAPSHOT_EXPORT_CONTRACT,
  FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS,
} from "./foundation-adaptor-types";

const WRAPPER =
  "src/lib/inventory/foundation/foundation-runtime-package.ts";

const raw = readFileSync(WRAPPER, "utf8");
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const serverOnlyEmptyModule = pathToFileURL(
  path.resolve("node_modules/next/dist/compiled/server-only/empty.js"),
).href;

type ResolveResult = { readonly shortCircuit?: boolean; readonly url: string };
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => ResolveResult,
) => ResolveResult;

const registerHooks = (
  nodeModule as unknown as {
    registerHooks(hooks: { readonly resolve: ResolveHook }): void;
  }
).registerHooks;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: serverOnlyEmptyModule };
    }
    return nextResolve(specifier, context);
  },
});

const packageModulePromise = import("./foundation-runtime-package");

function occurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

/** Every top-level snapshot field the package silently defaults when null. */
const PACKAGE_DEFAULTED_REQUIRED_SNAPSHOT_FIELDS = [
  "ownerBalances",
  "quantityStreams",
  "acceptedNativeCommands",
  "inventory",
  "reservationBook",
  "transfers",
  "fulfillments",
  "productCatalog",
  "csvPreviews",
] as const;

const FOUNDATION_PACKAGE_NAME =
  "@nisikawa-officeaz/detaileros-inventory-foundation";
const FOUNDATION_PACKAGE_VERSION = "0.2.1";
const FOUNDATION_PACKAGE_SHASUM =
  "0b6e34a28bea08610f924850dda441c8f82ac4eb";
const FOUNDATION_PACKAGE_INTEGRITY =
  "sha512-J6kqe5Q6ERq2K/U1IEaHisvUIVfVgGVE3M31CclZYU88mreXf2hfT3prYSdHtLLGdg0YPLtmvj153QmxWhQA7Q==";
const FOUNDATION_PACKAGE_TARBALL =
  `https://npm.pkg.github.com/download/${FOUNDATION_PACKAGE_NAME}/` +
  `${FOUNDATION_PACKAGE_VERSION}/${FOUNDATION_PACKAGE_SHASUM}`;

test("Book pins the exact Foundation 0.2.1 registry artifact", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    readonly packages?: Readonly<
      Record<
        string,
        {
          readonly dependencies?: Readonly<Record<string, string>>;
          readonly version?: string;
          readonly resolved?: string;
          readonly integrity?: string;
        }
      >
    >;
  };

  assert.equal(
    manifest.dependencies?.[FOUNDATION_PACKAGE_NAME],
    FOUNDATION_PACKAGE_VERSION,
  );
  assert.equal(
    lock.packages?.[""]?.dependencies?.[FOUNDATION_PACKAGE_NAME],
    FOUNDATION_PACKAGE_VERSION,
  );
  assert.deepEqual(
    lock.packages?.[`node_modules/${FOUNDATION_PACKAGE_NAME}`],
    {
      version: FOUNDATION_PACKAGE_VERSION,
      resolved: FOUNDATION_PACKAGE_TARBALL,
      integrity: FOUNDATION_PACKAGE_INTEGRITY,
    },
  );
});

test("the wrapper is server-only and imports only the package and D1 types", () => {
  assert.match(raw, /^import "server-only";/);

  const sideEffectImports = [
    ...code.matchAll(/^import\s+["']([^"']+)["'];?/gm),
  ].map((match) => match[1]);
  const fromImports = [
    ...code.matchAll(/\bfrom\s+["']([^"']+)["']/g),
  ].map((match) => match[1]);

  assert.deepEqual(
    [...sideEffectImports, ...fromImports].sort(),
    [
      "server-only",
      "node:util",
      "@nisikawa-officeaz/detaileros-inventory-foundation",
      "./foundation-adaptor-types",
    ].sort(),
  );
  assert.match(raw, /import type \{[\s\S]*FoundationPort[\s\S]*\} from "\.\/foundation-adaptor-types";/);
});

test("the wrapper exposes only the injected-store dependency and D1 factory", () => {
  assert.match(
    code,
    /export interface FoundationRuntimePackageDependencies\s*\{\s*readonly store: InventoryRuntimeStore;\s*\}/,
  );
  assert.match(
    code,
    /export function createFoundationRuntimePackagePort\([\s\S]*?\): FoundationPort/,
  );
  assert.equal(occurrences(code, /createInventoryCommandDispatch\(/g), 1);
  assert.match(
    code,
    /createInventoryCommandDispatch\(dependencies\.store\)/,
  );
});

test("the port implements each D1 surface once", () => {
  for (const method of [
    "dispatchCommand",
    "readAuditLog",
    "exportSnapshot",
    "importSnapshot",
    "evaluateRecoveryEvidence",
  ]) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${method}\\s*\\(`, "g")),
      1,
      `${method} must be implemented exactly once`,
    );
  }
});

test("dispatch forwards the command and complete native envelope exactly once", () => {
  assert.equal(occurrences(code, /runtime\.dispatch\(/g), 1);
  assert.match(
    code,
    /runtime\.dispatch\(\{\s*command: request\.command,\s*payload: request\.native,\s*authorization: request\.native\.authorizationEvidence,\s*\}\)/,
  );
  assert.equal(code.includes('"confirm_shipment"'), false);
  assert.equal(code.includes('"ship_fulfillment"'), false);
});

test("all five package surfaces are bound without replacing the injected store", () => {
  assert.equal(occurrences(code, /runtime\.auditLog\(/g), 2);
  assert.equal(occurrences(code, /exportInventoryRuntimeSnapshot\(/g), 1);
  assert.equal(occurrences(code, /importInventoryRuntimeSnapshot\(/g), 2);
  assert.equal(
    occurrences(code, /evaluateInventoryRuntimeRecoveryEvidence\(/g),
    1,
  );
  assert.match(
    code,
    /contract: request\.snapshotContract,\s*snapshot: request\.native\.payload/,
  );
  assert.equal(code.includes("imported.store"), false);
  assert.equal(code.includes("dependencies.store.commit"), false);
});

test("the package wrapper executes all five D1 surfaces against a real store", async () => {
  const { createFoundationRuntimePackagePort } = await packageModulePromise;
  const store = createInventoryInMemoryStore();
  const port = createFoundationRuntimePackagePort({ store });
  const native = Object.freeze({ actor: "book-actor", operator: "book-operator" });

  const dispatch = await port.dispatchCommand({
    bookContext: {} as never,
    command: "reserve",
    native,
  });
  assert.deepEqual(dispatch, {
    tag: "denied",
    reason: "Foundation package denied authorization.",
  });

  const audit = await port.readAuditLog({
    bookContext: {} as never,
    native,
  });
  assert.equal(audit.tag, "success");
  assert.equal(Array.isArray(audit.tag === "success" ? audit.value : null), true);

  const exported = await port.exportSnapshot({
    bookContext: {} as never,
    native,
  });
  assert.equal(exported.tag, "success");
  if (exported.tag !== "success") assert.fail("snapshot export must succeed");
  assert.equal((exported.value as { readonly revision?: unknown }).revision, 0);

  const imported = await port.importSnapshot({
    bookContext: {} as never,
    snapshotContract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
    native: {
      ...native,
      payload: exported.tag === "success" ? exported.value : null,
    },
  });
  assert.equal(imported.tag, "success");

  const recovery = await port.evaluateRecoveryEvidence({
    bookContext: {} as never,
    native,
  });
  assert.equal(recovery.tag, "success");
});

test("the package wrapper fails closed for malformed snapshot carriers", async () => {
  const { createFoundationRuntimePackagePort } = await packageModulePromise;
  const malformedStore = {
    snapshot: () => ({ revision: 0 }),
    commit: () => false,
  } as never;
  const port = createFoundationRuntimePackagePort({ store: malformedStore });
  const native = Object.freeze({ actor: "book-actor", operator: "book-operator" });

  assert.deepEqual(
    await port.exportSnapshot({ bookContext: {} as never, native }),
    { tag: "unknown" },
  );
  assert.deepEqual(
    await port.importSnapshot({
      bookContext: {} as never,
      snapshotContract: INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
      native: { ...native, payload: { revision: 0 } },
    }),
    { tag: "unknown" },
  );
  assert.deepEqual(
    await port.evaluateRecoveryEvidence({ bookContext: {} as never, native }),
    {
      tag: "invalid_recovery",
      reason: "Foundation package rejected recovery evidence.",
    },
  );
});

test("every package-defaulted required snapshot field fails closed as null: export unknown, recovery invalid_recovery", async () => {
  const { createFoundationRuntimePackagePort } = await packageModulePromise;
  const baseline = createInventoryInMemoryStore().snapshot() as unknown as Record<
    string,
    unknown
  >;
  const native = Object.freeze({ actor: "book-actor", operator: "book-operator" });

  for (const field of PACKAGE_DEFAULTED_REQUIRED_SNAPSHOT_FIELDS) {
    const malformedSnapshot: Record<string, unknown> = {
      ...baseline,
      [field]: null,
    };
    const store = {
      snapshot: () => malformedSnapshot,
      commit: () => false,
    } as never;
    const port = createFoundationRuntimePackagePort({ store });

    assert.deepEqual(
      await port.exportSnapshot({ bookContext: {} as never, native }),
      { tag: "unknown" },
      `export must reject null ${field}`,
    );
    assert.deepEqual(
      await port.evaluateRecoveryEvidence({ bookContext: {} as never, native }),
      {
        tag: "invalid_recovery",
        reason: "Foundation package rejected recovery evidence.",
      },
      `recovery must reject null ${field}`,
    );
  }
});

test("port.importSnapshot succeeds for valid V1, V2, and V3 carriers", async () => {
  const { createFoundationRuntimePackagePort } = await packageModulePromise;
  const store = createInventoryInMemoryStore();
  const port = createFoundationRuntimePackagePort({ store });
  const native = Object.freeze({ actor: "book-actor", operator: "book-operator" });
  const baseline = store.snapshot() as unknown as Record<string, unknown>;

  const v1Payload = {
    ownerBalances: baseline.ownerBalances,
    quantityStreams: baseline.quantityStreams,
    acceptedNativeCommands: baseline.acceptedNativeCommands,
    inventory: baseline.inventory,
    reservationBook: baseline.reservationBook,
    transfers: baseline.transfers,
    stocktakeBook: baseline.stocktakeBook,
    revision: baseline.revision,
  };
  const v2Payload = { ...v1Payload, fulfillments: baseline.fulfillments };
  const v3Payload = {
    ...v2Payload,
    productCatalog: baseline.productCatalog,
    csvPreviews: baseline.csvPreviews,
  };

  const carriers = [
    [INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1, v1Payload],
    [INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2, v2Payload],
    [INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3, v3Payload],
  ] as const;

  for (const [snapshotContract, payload] of carriers) {
    const imported = await port.importSnapshot({
      bookContext: {} as never,
      snapshotContract,
      native: { ...native, payload },
    });
    assert.equal(
      imported.tag,
      "success",
      `${snapshotContract} import must succeed`,
    );
  }
});

test("the public 0.2.1 snapshot helpers strictly round-trip an empty mobile carrier", () => {
  const baseline: InventoryRuntimeSnapshot =
    createInventoryInMemoryStore().snapshot();
  const exported = exportInventoryRuntimeSnapshot({
    ...baseline,
    acceptedMobileMutationEnvelopes: {},
  });

  assert.deepEqual(exported.snapshot.acceptedMobileMutationEnvelopes, {});
  const imported = importInventoryRuntimeSnapshot(exported);
  assert.equal(imported.ok, true);
  if (!imported.ok) assert.fail("empty mobile carrier import must succeed");
  assert.deepEqual(imported.snapshot.acceptedMobileMutationEnvelopes, {});
  assert.deepEqual(exportInventoryRuntimeSnapshot(imported.snapshot), exported);
});

test("the public 0.2.1 snapshot helpers strictly round-trip a non-empty mobile carrier", () => {
  const baseline: InventoryRuntimeSnapshot =
    createInventoryInMemoryStore().snapshot();
  const idempotencyKey = "44444444-4444-4444-8444-444444444444";
  const acceptedRecord = buildMobileInventoryAcceptedEnvelopeRecord({
    envelope: {
      protocol: "DEALEROS_OFFICE_AZ_MOBILE_INVENTORY_MUTATION_API_V1",
      envelopeVersion: 1,
      kind: "mobile.inventory.mutation",
      command: "reserve",
      correlationId: "11111111-1111-4111-8111-111111111111",
      requestId: "22222222-2222-4222-8222-222222222222",
      commandId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey,
      actorId: "55555555-5555-4555-8555-555555555555",
      role: "OFFICE_AZ_ADMIN",
      legalOwner: "OFFICE_AZ",
      sessionId: "66666666-6666-4666-8666-666666666666",
      deviceId: "77777777-7777-4777-8777-777777777777",
      deviceManagement: "COMPANY_MANAGED",
      connectivity: "online",
      occurredAt: "2026-09-18T00:00:00.000Z",
      commandFingerprint: "b".repeat(64),
      serverAuthorityBound: true,
      authorization: {},
      payload: {},
    },
    projectedPayload: { productId: "synthetic-product" },
    authorizationFingerprint: "a".repeat(64),
  });
  const acceptedMobileMutationEnvelopes = {
    [idempotencyKey]: acceptedRecord,
  };
  const exported = exportInventoryRuntimeSnapshot({
    ...baseline,
    acceptedMobileMutationEnvelopes,
  });

  assert.deepEqual(
    exported.snapshot.acceptedMobileMutationEnvelopes,
    acceptedMobileMutationEnvelopes,
  );
  const imported = importInventoryRuntimeSnapshot(exported);
  assert.equal(imported.ok, true);
  if (!imported.ok) assert.fail("non-empty mobile carrier import must succeed");
  assert.deepEqual(
    imported.snapshot.acceptedMobileMutationEnvelopes,
    acceptedMobileMutationEnvelopes,
  );
  assert.deepEqual(exportInventoryRuntimeSnapshot(imported.snapshot), exported);
});

test("an old V3 snapshot with no mobile carrier defaults to an empty carrier", () => {
  const baseline: InventoryRuntimeSnapshot =
    createInventoryInMemoryStore().snapshot();
  const oldV3 = structuredClone(
    exportInventoryRuntimeSnapshot({
      ...baseline,
      acceptedMobileMutationEnvelopes: {},
    }),
  ) as unknown as {
    readonly contract: typeof INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3;
    readonly snapshot: Record<string, unknown>;
  };
  delete oldV3.snapshot.acceptedMobileMutationEnvelopes;

  const imported = importInventoryRuntimeSnapshot(oldV3);
  assert.equal(imported.ok, true);
  if (!imported.ok) assert.fail("old V3 snapshot import must succeed");
  assert.deepEqual(imported.snapshot.acceptedMobileMutationEnvelopes, {});
});

test("a present malformed mobile carrier fails closed", () => {
  const baseline: InventoryRuntimeSnapshot =
    createInventoryInMemoryStore().snapshot();
  const exported = exportInventoryRuntimeSnapshot({
    ...baseline,
    acceptedMobileMutationEnvelopes: {},
  });

  for (const malformedCarrier of [null, [], { malformed: true }]) {
    const malformedV3 = structuredClone(exported) as unknown as {
      readonly contract: typeof INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3;
      readonly snapshot: Record<string, unknown>;
    };
    malformedV3.snapshot.acceptedMobileMutationEnvelopes = malformedCarrier;
    const imported = importInventoryRuntimeSnapshot(malformedV3);
    assert.equal(imported.ok, false);
  }
});

test("the closed outcome conversion is sanitized and never guesses stale version", () => {
  assert.match(code, /case "authorization_required":/);
  assert.match(code, /case "authorization_denied":/);
  assert.match(code, /case "native_command_replay_identity_mismatch":/);
  assert.match(code, /case "store_rejected":/);
  assert.equal(code.includes('"stale_version"'), false);
  assert.equal(code.includes("reason: result.message"), false);
  assert.equal(code.includes("error.message"), false);
  assert.equal(code.includes("cause"), false);
  assert.equal(code.includes("stack"), false);
});

test("partial or malformed package results fail closed before success mapping", () => {
  assert.match(code, /if \(!isPlainObject\(result\)\) return UNKNOWN_OUTCOME/);
  assert.match(code, /result\.command !== expectedCommand/);
  assert.match(code, /typeof result\.replay !== "boolean"/);
  assert.match(code, /!Number\.isSafeInteger\(result\.revision\)/);
  assert.match(code, /!hasOwn\(result, "commandEvidence"\)/);
  assert.match(code, /validateInventoryRuntimeAuditLog\(runtime\.auditLog\(\)\)/);
  assert.match(code, /exported\.contract !== INVENTORY_RUNTIME_SNAPSHOT_CONTRACT/);
  assert.match(code, /!isPlainObject\(imported\.snapshot\)/);
  assert.match(code, /evaluated\.evidence\.roundTripMatched !== true/);
});

test("the wrapper contains no fallback, external I/O, UI, retry, or rule implementation", () => {
  for (const forbidden of [
    "createInventoryInMemoryStore",
    "@supabase",
    "createClient",
    "process.env",
    "fetch(",
    "Date.now",
    "new Date",
    "Math.random",
    "react",
    "next/",
    "office-az-inventory-core",
    "setTimeout",
    "Promise.all",
  ]) {
    assert.equal(code.includes(forbidden), false, `forbidden: ${forbidden}`);
  }
  assert.equal(/\bfor\s*\(/.test(code), false);
  assert.equal(/\bwhile\s*\(/.test(code), false);
});

test("the package and D1 expose the identical sealed 18-command catalogue", () => {
  assert.equal(INVENTORY_RUNTIME_COMMANDS.length, 18);
  assert.deepEqual(
    [...INVENTORY_RUNTIME_COMMANDS],
    [...FOUNDATION_RUNTIME_COMMANDS],
  );
});

test("the package and D1 snapshot contract identities remain aligned", () => {
  assert.equal(
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT,
    FOUNDATION_SNAPSHOT_EXPORT_CONTRACT,
  );
  assert.equal(
    INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
    FOUNDATION_SNAPSHOT_EXPORT_CONTRACT,
  );
  assert.deepEqual(
    [
      INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
      INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
      INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
    ],
    [...FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS],
  );
});
