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

// ── OBS-1L-B7: the save path has exactly one operational channel ─────────────
//
// These guard the B7 boundary from src/lib/observability's side. Tokens are
// assembled from fragments so this file never matches its own search terms, and
// production sources are scanned with comments stripped so a comment may name a
// hazard the code must not contain.

const SAVE_DIR = "src/components/estimates/wizard/save/";
const SAVE_PRODUCTION = [
  `${SAVE_DIR}estimate-save-orchestration-types.ts`,
  `${SAVE_DIR}wizard-save-observability.ts`,
  `${SAVE_DIR}wizard-save-intent-orchestrator.ts`,
  `${SAVE_DIR}save-estimate-from-wizard-` + "intent-action.ts",
  `${SAVE_DIR}supabase-persistence` + "-gateway.ts",
  `${SAVE_DIR}estimate-persistence-service.ts`,
  `${SAVE_DIR}save-estimate-from-wizard-` + "action.ts",
];

// The two action module names above are ASSEMBLED FROM FRAGMENTS on purpose. The
// authoritative intent action and the legacy action are both guarded elsewhere by
// zero-importer tests that flag ANY file spelling their module name contiguously —
// including a guard file that merely names them. Spelling them whole here reported
// this file as an importer and turned two unrelated boundary tests red.

test("the legacy [saveEstimateFromWizard] channel no longer exists in production code", () => {
  const legacy = "saveEstimate" + "FromWizard" + "]";
  for (const file of SAVE_PRODUCTION) {
    assert.equal(codeOf(file).includes(legacy), false,
      `${file} still writes the legacy channel; it carried the complete log entry, including userId`);
  }
});

test("only the observability core may write a console line on the save path", () => {
  // The single permitted sink is report-observability-event.ts's severity router.
  for (const file of SAVE_PRODUCTION) {
    const code = codeOf(file);
    for (const channel of ["error", "warn", "info", "log", "debug"]) {
      assert.equal(code.includes("console" + "." + channel), false,
        `${file} writes console.${channel} directly instead of emitting a sanitized event`);
    }
  }
});

test("no save-path production file reads a leaky diagnostic field", () => {
  for (const file of SAVE_PRODUCTION) {
    const code = codeOf(file);
    for (const field of ["details", "hint", "constraint", "stack", "cause"]) {
      assert.equal(code.includes("error" + "." + field), false, `${file} reads error.${field}`);
    }
  }
});

test("the private req_ request-id generator is gone from the authoritative action", () => {
  const action = codeOf(`${SAVE_DIR}save-estimate-from-wizard-` + "intent-action.ts");
  const legacyPrefix = "req" + "_";
  assert.equal(action.includes(legacyPrefix), false,
    "req_ shares the idempotency alphabet, so it was never a boundary — obs. is");
  assert.match(action, /createObservabilityRequestId\(\)/, "the shared core generates the id");
  assert.equal(/getRandomValues/.test(action), false, "no private generator remains");
  // The id must never be derived from the replay token.
  assert.equal(/requestId[^\n]*idempotencyKey|idempotencyKey[^\n]*requestId/.test(action), false);
});

test("the emitted userId field is never populated by the save path", () => {
  // EstimateSaveLogEntry and EstimateSaveServerContext may still CARRY userId —
  // they are internal contexts. What must never happen is a userId being handed to
  // the adapter, which is the only thing that could put it in an event.
  const types = codeOf(`${SAVE_DIR}estimate-save-orchestration-types.ts`);
  const adapter = codeOf(`${SAVE_DIR}wizard-save-` + "observability.ts");
  assert.equal(/userId\s*:/.test(adapter), false, "the adapter has no userId field to populate");
  assert.equal(/entry\.userId/.test(types), false, "the single emission site never reads userId");
});

test("the generic core still owns no Estimate Wizard business vocabulary", () => {
  // The dependency direction is domain adapter -> generic core, never the reverse.
  for (const file of IMPL) {
    const code = codeOf(file);
    for (const token of ["Estimate" + "SaveStage", "Wizard" + "SaveIntentFailure",
                         "ESTIMATE_SAVE_" + "ACTION_ERRORS", "estimates/" + "wizard"]) {
      assert.equal(code.includes(token), false, `${file} imports domain vocabulary — direction reversed`);
    }
  }
});

// ── OBS-1L-B7-F1: the legacy action DISCARDS its client-supplied request id ──
//
// The sanitizer validates the SHAPE of a correlation id, not its PROVENANCE, so it
// cannot reject a client-fabricated but perfectly formed obs.<32 hex> value. The
// only fail-closed treatment for a client-reachable legacy path is to never read
// the value at all — which is a SOURCE property, and so is guarded here.

test("the legacy action never reads meta.requestId in any form", () => {
  const legacy = codeOf(`${SAVE_DIR}save-estimate-from-wizard-` + "action.ts");
  // Assembled from fragments so this guard never matches its own assertion strings.
  const meta = "meta";
  const prop = "request" + "Id";
  for (const form of [`${meta}.${prop}`, `${meta}?.${prop}`, `${meta}!.${prop}`, `${meta}["${prop}"]`]) {
    assert.equal(legacy.includes(form), false, `the legacy action reads ${form}`);
  }
  // The property must still EXIST in the parameter shape: ScreensPreview is frozen
  // and passes it, so removing it would break a callsite this phase may not touch.
  assert.match(legacy, /requestId\?:\s*string/,
    "the parameter property is retained for the frozen callsite");
});

test("the legacy action uses the canonical unattributed literal, not a generated id", () => {
  const legacy = codeOf(`${SAVE_DIR}save-estimate-from-wizard-` + "action.ts");
  assert.match(legacy, /OBSERVABILITY_FALLBACK_REQUEST_ID/,
    "it reports under the canonical fail-closed literal");
  assert.match(legacy, /const\s+requestId\s*=\s*OBSERVABILITY_FALLBACK_REQUEST_ID/,
    "and that literal IS its request id");
  // Minting a real id here would manufacture the appearance of a trustworthy
  // correlation for a disabled, client-reachable path.
  assert.equal(legacy.includes("createObservability" + "RequestId"), false,
    "the legacy action must NOT generate a trusted obs.* id");
  assert.equal(/getRandomValues|randomUUID/.test(legacy), false, "no private generator either");
  // Never DERIVED from the replay token. A blanket "same line" check would be a
  // FALSE POSITIVE here: the persistence context legitimately carries requestId and
  // idempotencyKey as sibling properties on one line. What must not exist is an
  // ASSIGNMENT of requestId from anything client-supplied — and since requestId is a
  // const bound to the canonical literal, there is exactly one assignment.
  assert.equal((legacy.match(/requestId\s*=/g) ?? []).length, 1, "requestId is assigned exactly once");
  assert.equal(/requestId\s*=[^\n;]*idempotencyKey/.test(legacy), false, "never derived from the key");
  assert.equal(/requestId\s*=[^\n;]*meta/.test(legacy), false, "never derived from client meta");
  // The literal is imported from the core, never re-declared, so it cannot drift.
  assert.match(legacy, /import \{ OBSERVABILITY_FALLBACK_REQUEST_ID \} from "@\/lib\/observability\/observability-types"/);
  assert.equal(/["']obs\.unattributed["']/.test(legacy), false, "the literal is not hand-copied");
});

test("ONLY the authoritative intent action generates a trusted request id", () => {
  const authoritative = codeOf(`${SAVE_DIR}save-estimate-from-wizard-` + "intent-action.ts");
  assert.match(authoritative, /createObservabilityRequestId\(\)/, "the authoritative action still generates its own");
  // It is immune by CONSTRUCTION, not by validation: there is no requestId parameter.
  assert.match(authoritative, /saveEstimateFromWizardIntentAction\(\s*raw:\s*unknown\s*\)/,
    "its only parameter is the raw intent, so no client id can enter");
  assert.equal(authoritative.includes("meta" + "." + "request" + "Id"), false);
});
