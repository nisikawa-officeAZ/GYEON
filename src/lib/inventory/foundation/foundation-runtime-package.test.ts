import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  INVENTORY_RUNTIME_COMMANDS,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V1,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V2,
  INVENTORY_RUNTIME_SNAPSHOT_CONTRACT_V3,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";
import {
  FOUNDATION_RUNTIME_COMMANDS,
  FOUNDATION_SNAPSHOT_EXPORT_CONTRACT,
  FOUNDATION_SNAPSHOT_IMPORT_CONTRACTS,
} from "./foundation-adaptor-types.js";

const WRAPPER =
  "src/lib/inventory/foundation/foundation-runtime-package.ts";

const raw = readFileSync(WRAPPER, "utf8");
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

function occurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

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
      "@nisikawa-officeaz/detaileros-inventory-foundation",
      "./foundation-adaptor-types.js",
    ].sort(),
  );
  assert.match(raw, /import type \{[\s\S]*FoundationPort[\s\S]*\} from "\.\/foundation-adaptor-types\.js";/);
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
  assert.equal(occurrences(code, /importInventoryRuntimeSnapshot\(/g), 1);
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
