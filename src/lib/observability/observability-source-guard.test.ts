// OBS-1A — source-boundary guards.
//
// Run: node --import tsx --test src/lib/observability/observability-source-guard.test.ts
//
// These assert what the observability core may NOT contain, and reconfirm that
// OBS-1A leaves the B7 boundary exactly as it found it. Behavioural proofs live
// in observability.test.ts.
//
// Forbidden tokens are assembled from fragments so this guard file never matches
// its own search terms, and the four implementation files are scanned with
// comments stripped so documentation can name a hazard the code must not use.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = "src/lib/observability/";

/** The four implementation files. The two test files are not production code. */
const IMPL = [
  `${DIR}observability-types.ts`,
  `${DIR}create-observability-request-id.ts`,
  `${DIR}sanitize-observability-event.ts`,
  `${DIR}report-observability-event.ts`,
];

const GUARD = `${DIR}observability-source-guard.test.ts`;
const ALL_SIX = [...IMPL, `${DIR}observability.test.ts`, GUARD];

/**
 * Every file EXCEPT this guard.
 *
 * This file must name the very things it forbids — that is what a boundary
 * assertion is — so scanning itself for those names would always self-match.
 * The same exclusion idiom is used by legacy-save-action-disabled.test.ts.
 */
const NON_GUARD = ALL_SIX.filter((f) => f !== GUARD);

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// ── The core imports nothing it must not ────────────────────────────────────

test("no Supabase, database, RPC, storage or network access", () => {
  const forbidden = [
    "supa" + "base", "createClient", "createAdminClient", ".rpc(",
    // `.from("` is the Supabase table-access form. The bare `.from(` is NOT used
    // as a token: `Array.from(...)` is a legitimate, entirely local call.
    '.from("',
    "fetch(", "XMLHttpRequest", "axios", "http://", "https://",
  ];
  for (const file of IMPL) {
    const code = codeOf(file);
    for (const token of forbidden) {
      assert.equal(code.includes(token), false, `${file} contains ${token}`);
    }
  }
});

test("no monitoring vendor SDK", () => {
  const vendors = ["sen" + "try", "data" + "dog", "bug" + "snag", "roll" + "bar",
                   "open" + "telemetry", "new" + "relic", "post" + "hog", "log" + "tail", "ax" + "iom"];
  for (const file of ALL_SIX) {
    const code = codeOf(file).toLowerCase();
    for (const v of vendors) {
      assert.equal(code.includes(v), false, `${file} references ${v}`);
    }
  }
});

test("no React, Next route or UI code", () => {
  for (const file of IMPL) {
    const code = codeOf(file);
    for (const token of ['from "react"', 'from "next/', "use client", "use server", "JSX", "tsx"]) {
      assert.equal(code.includes(token), false, `${file} contains ${token}`);
    }
  }
});

test("no save gateway, save action or draft recovery", () => {
  const forbidden = [
    "supa" + "basePersistenceGateway", "persistence-gateway", "save-estimate-from-wizard",
    "EstimatePersistenceService", "Screens" + "Preview",
    "draft" + "Recovery", "restore" + "Draft", "auto" + "save",
  ];
  for (const file of NON_GUARD) {
    const code = codeOf(file);
    for (const token of forbidden) {
      assert.equal(code.includes(token), false, `${file} contains ${token}`);
    }
  }
});

test("no browser storage", () => {
  const storage = ["session" + "Storage", "local" + "Storage", "document" + ".cookie"];
  for (const file of ALL_SIX) {
    const code = codeOf(file);
    for (const token of storage) {
      assert.equal(code.includes(token), false, `${file} contains ${token}`);
    }
  }
});

// ── The sanitizer must not READ the leaky diagnostic fields ─────────────────

test("the implementation never reads a diagnostic or secret field", () => {
  // Property-read forms only: the sanitizer must not dereference these anywhere.
  const reads = [
    ".mess" + "age", ".det" + "ails", ".hi" + "nt", ".sta" + "ck", ".ca" + "use",
    ".tok" + "en", ".coo" + "kie", ".idempotency" + "Key",
  ];
  for (const file of IMPL) {
    const code = codeOf(file);
    for (const token of reads) {
      assert.equal(code.includes(token), false, `${file} reads ${token}`);
    }
  }
});

test("the sanitizer never spreads, serializes or enumerates its input", () => {
  const code = codeOf(`${DIR}sanitize-observability-event.ts`);
  assert.equal(/\.\.\.\s*input/.test(code), false, "input is never spread");
  assert.equal(/JSON\.stringify\s*\(\s*input/.test(code), false, "input is never serialized");
  assert.equal(/Object\.(keys|values|entries|assign)\s*\(\s*input/.test(code), false, "input is never enumerated");
  assert.equal(/for\s*\(\s*const\s+\w+\s+in\s+input/.test(code), false, "input is never for-in'd");
  // It builds the event from an explicit literal instead.
  assert.match(code, /const sanitized: ObservabilityEvent = \{/, "reconstructs an allowlisted literal");
});

test("the event type is closed: no index signature or bag-shaped field", () => {
  const code = codeOf(`${DIR}observability-types.ts`);
  assert.equal(/\[\s*key\s*:\s*string\s*\]/.test(code), false, "no index signature");
  assert.equal(/\[\s*k\s*:\s*string\s*\]/.test(code), false, "no index signature");
  for (const bag of ["metadata", "context:", "tags", "extra", "payload", "Record<string, unknown>"]) {
    assert.equal(code.includes(bag), false, `event contract exposes ${bag}`);
  }
});

test("the id generator uses only Web Crypto", () => {
  const code = codeOf(`${DIR}create-observability-request-id.ts`);
  assert.match(code, /getRandomValues/);
  for (const token of ["Date.now", "new Date", "Math.random", "randomUUID", "safeRandomUUID", "++"]) {
    assert.equal(code.includes(token), false, `id generator uses ${token}`);
  }
});

test("no external provider is wired in this phase", () => {
  const code = codeOf(`${DIR}report-observability-event.ts`);
  assert.match(code, /const externalProviderSink: ObservabilitySink \| null = null;/,
    "the provider seam exists and is explicitly null");
});

test("no type-checking escape hatches anywhere", () => {
  // Assembled from fragments so this guard does not match its own search terms.
  const hatches = ["as " + "any", "@ts-" + "ignore", "@ts-" + "expect-error", "@ts-" + "nocheck"];
  for (const file of ALL_SIX) {
    const raw = readFileSync(file, "utf8");
    for (const token of hatches) {
      assert.equal(raw.includes(token), false, `${file} contains ${token}`);
    }
  }
});

// ── OBS-1A leaves the B7 boundary untouched ────────────────────────────────

test("the real gateway still has zero production importers", () => {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const MODULE = "supabase-persistence" + "-gateway";
  const importers = walk("src").filter((f) => {
    if (f.includes(MODULE)) return false;                 // the gateway and its own test
    const code = codeOf(f);
    return new RegExp(`from\\s*["'][^"']*${MODULE}["']`).test(code)
        || new RegExp(`import\\s*\\(\\s*["'][^"']*${MODULE}["']`).test(code);
  });
  assert.deepEqual(importers, [], `found importers: ${importers.join(", ")}`);
});

test("the authoritative intent action still has zero importers and stays placeholder-bound", () => {
  // Assembled from fragments, matching the convention in
  // legacy-save-action-disabled.test.ts and wizard-save-intent-orchestrator.test.ts:
  // those guards scan every file under src/ for this module name as PLAIN TEXT, so
  // any file spelling it contiguously — including this one — is reported as an importer.
  const ACTION = "save-estimate-from-wizard" + "-intent-action";
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const importers = walk("src").filter((f) => {
    if (f.includes(ACTION)) return false;
    return new RegExp(`from\\s*["'][^"']*${ACTION}["']`).test(codeOf(f));
  });
  assert.deepEqual(importers, [], `found importers: ${importers.join(", ")}`);

  const action = codeOf(`src/components/estimates/wizard/save/${ACTION}.ts`);
  assert.match(action, /new EstimatePersistenceService\(\s*notImplementedPersistenceGateway\s*\)/);
});

test("the legacy save action remains placeholder-bound", () => {
  const legacy = codeOf("src/components/estimates/wizard/save/save-estimate-from-wizard-action.ts");
  assert.match(legacy, /new EstimatePersistenceService\(\s*notImplementedPersistenceGateway\s*\)/);
  assert.equal(legacy.includes("supa" + "basePersistenceGateway"), false);
});

test("the save barrel exports neither the real gateway nor the intent action", () => {
  const barrel = codeOf("src/components/estimates/wizard/save/index.ts");
  assert.equal(barrel.includes("supabase-persistence" + "-gateway"), false);
  assert.equal(barrel.includes("intent-action"), false);
});

test("the production dev-preview route guard is untouched", () => {
  const guard = readFileSync("src/app/admin/dev-preview/estimate-wizard/page.tsx", "utf8");
  assert.match(guard, /NODE_ENV === "production"\)\s*notFound\(\)/);
});
