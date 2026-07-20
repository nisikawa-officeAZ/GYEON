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
import { createHash } from "node:crypto";

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

// ── REL-1: release identity is supplied at build time, and nothing else is ──
//
// The sanitizer's precedence order was already correct; what was missing was a
// value for step 2 and a build that refuses to ship without one. These guards
// pin both halves: the resolver stays honest, and the core stays untouched.

const NEXT_CONFIG = "next.config.ts";
const rawOf = (p: string): string => readFileSync(p, "utf8");

test("the committed sanitizer is byte-identical — REL-1 supplies a value, it does not change resolution", () => {
  const digest = createHash("sha256").update(readFileSync(`${DIR}sanitize-observability-event.ts`)).digest("hex");
  assert.equal(digest, "4fcbb09603f5b012ebb1bc1db92c0b24383c27b0a5549dfd2b557956d4ca9a20",
    "sanitize-observability-event.ts changed; the release precedence must stay as committed");

  // Restated behaviourally, so the pin is not merely a hash to be re-blessed.
  const code = codeOf(`${DIR}sanitize-observability-event.ts`);
  assert.match(code, /VERCEL_GIT_COMMIT_SHA/, "step 1 unchanged");
  assert.match(code, /NEXT_PUBLIC_GIT_COMMIT/, "step 2 unchanged");
  assert.match(code, /return "unknown"/, "the production fallback still exists as the last resort");
});

test("next.config.ts exposes no secret-named value", () => {
  const code = codeOf(NEXT_CONFIG);
  // Assembled from fragments so this guard never matches its own search terms.
  const secretish = ["SERVICE_ROLE" + "_KEY", "ANON" + "_KEY", "KEY_" + "SECRET",
                     "AI_KEY" + "_SECRET", "ACCESS" + "_TOKEN", "CHANNEL" + "_SECRET",
                     "PASS" + "WORD", "PRIVATE" + "_KEY", "OPENAI" + "_API_KEY"];
  for (const token of secretish) {
    assert.equal(code.includes(token), false, `next.config.ts references ${token}`);
  }
  for (const token of ["sk-", "eyJ"]) {   // OpenAI key prefix, JWT prefix
    assert.equal(rawOf(NEXT_CONFIG).includes(token), false, `next.config.ts contains a literal ${token} value`);
  }
});

test("NEXT_PUBLIC_GIT_COMMIT is the ONLY NEXT_PUBLIC_ name next.config.ts introduces", () => {
  const code = codeOf(NEXT_CONFIG);
  const publics = [...new Set([...code.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*/g)].map((m) => m[0]))];
  assert.deepEqual(publics, ["NEXT_PUBLIC_GIT_COMMIT"], `unexpected public variables: ${publics.join(", ")}`);
  // And the env block declares exactly that one key.
  assert.match(code, /env:\s*\{\s*NEXT_PUBLIC_GIT_COMMIT:/, "the env block declares it");
  assert.equal(/VERCEL_GIT_COMMIT_SHA\s*:/.test(code), false, "the Vercel SHA is never re-exported under its own name");
});

test("no package version, clock, random value or dirty-worktree state can become the release", () => {
  const code = codeOf(NEXT_CONFIG);
  for (const token of ["Date.now", "new Date", "Math.random", "randomUUID", "safeRandomUUID",
                       "package.json", "--dirty", "status --porcelain", "describe", "toISOString"]) {
    assert.equal(code.includes(token), false, `${token} must not influence the release`);
  }
});

test("the Git read cannot become shell command interpolation", () => {
  const code = codeOf(NEXT_CONFIG);
  assert.match(code, /execFileSync\("git",\s*\["rev-parse",\s*"HEAD"\]/, "literal argument vector, no shell");
  for (const hazard of ["exec" + "Sync(", "shell:" , "spawn" + "Sync("]) {
    assert.equal(code.includes(hazard), false, `${hazard} permits shell interpretation`);
  }
  assert.equal(/\$\{[^}]*\}\s*"\s*\]/.test(code), false, "no interpolation inside the argument vector");
});

test("OBS-1P is NOT started: no transport, no event route", () => {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  for (const p of [
    "src/app/api/observability",
    `${DIR}observability-transport.ts`,
    `${DIR}observability-transport.test.ts`,
  ]) {
    assert.equal(existsSync(p), false, `${p} belongs to OBS-1P, not REL-1`);
  }
  // The provider seam stays inert.
  assert.match(codeOf(`${DIR}report-observability-event.ts`),
    /const externalProviderSink: ObservabilitySink \| null = null;/,
    "externalProviderSink must remain null");
  // And the sink is still the console, not a network call.
  const reporter = codeOf(`${DIR}report-observability-event.ts`);
  for (const token of ["fetch(", "sendBeacon", "XMLHttpRequest", "navigator."]) {
    assert.equal(reporter.includes(token), false, `${token} is OBS-1P transport work`);
  }
});

test("REL-1 touched no save-path file and no observability runtime file", () => {
  const expected: Record<string, string> = {
    [`${DIR}observability-types.ts`]:              "76b0adb77f12fd60621b3c4998be351936a4527886adb5814905b24f71a5710e",
    [`${DIR}report-observability-event.ts`]:       "9b476c01431df32f1e5957fdcee6e2c2906f7fb569392bf9bc6b3daa286ae557",
    [`${DIR}create-observability-request-id.ts`]:  "458e79ac6acab8993e24dfc8c6ab3bb6d1f7b7de1441951b306f522ed33b874a",
    [`${DIR}ui-error-report.ts`]:                  "3481a829b0e3819278ead8aad25966520fc6251a560f93b90f29762fcebe5971",
    [`${SAVE_DIR}wizard-save-` + "observability.ts"]: "6ff5ae31dd79f6aeafba5b25173c55e04543eee3b51706e8d16dc90a038d0b46",
    [`${SAVE_DIR}estimate-save-orchestration-types.ts`]: "e24785c843aa72eaa19143ccc54e5f991fddc02ad7c3fd003719f6fe92af3e15",
    [`${SAVE_DIR}estimate-persistence-service.ts`]: "341de1e3a49c2c6a93289b4f752e9e8c2ac8f01e4b36de964c60de371c54a40c",
    [`${SAVE_DIR}wizard-save-intent-orchestrator.ts`]: "c3fbd2f05d912b28ae27e7eaa622820fd9824a9b41ddda27666a7e44525a4833",
  };
  for (const [file, digest] of Object.entries(expected)) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), digest,
      `${file} must remain byte-identical during REL-1`);
  }
});
