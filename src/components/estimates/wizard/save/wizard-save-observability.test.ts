// OBS-1L-B7 — behavioural tests for the Estimate Wizard save-path observability adapter.
//
// Run: node --import tsx --test src/components/estimates/wizard/save/wizard-save-observability.test.ts
//
// No database, no network, no provider, no server-only module. Every event is
// captured through the injected sink, which is the SAME seam a future provider
// adapter would occupy — so what these tests observe is what production emits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  reportWizardSaveStage, reportWizardSaveFailure, createWizardSaveFailureReporter,
  WIZARD_SAVE_EVENT, PERSIST_INVARIANT_FAILED, WIZARD_SAVE_MAPS,
} from "./wizard-save-observability";
import {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage,
  type EstimateSaveStage, type EstimateSaveActionErrorCode,
} from "./estimate-save-orchestration-types";
import type { WizardSaveReportableFailure } from "./wizard-save-intent-types";
import {
  OBSERVABILITY_SLUG_PATTERN, OBSERVABILITY_EVENT_KEYS, OBSERVABILITY_FALLBACK_STAGE,
  type ObservabilityEvent,
} from "@/lib/observability/observability-types";

const DEALER = "d0000000-0000-0000-0000-00000000000a";
const REQ = "obs.0123456789abcdef0123456789abcdef";

function collector(): { events: ObservabilityEvent[]; sink: (e: ObservabilityEvent) => void } {
  const events: ObservabilityEvent[] = [];
  return { events, sink: (e) => { events.push(e); } };
}

const ALL_STAGES: EstimateSaveStage[] = [
  "authentication", "dealer_context", "permission", "validation",
  "pricing_completeness", "rpc", "done",
];

const ALL_CODES: EstimateSaveActionErrorCode[] =
  Object.values(ESTIMATE_SAVE_ACTION_ERRORS);

const ALL_FAILURES: WizardSaveReportableFailure[] = [
  "invalid-intent", "unauthenticated", "actor-context-unavailable", "forbidden",
  "tenant-context-unavailable", "runtime-config-unavailable", "stale-config-revision",
  "service-not-offered",
  "server-pricing-failed", "save-mapping-failed", "save-validation-failed", "persist-invariant",
];

// ── 1. Exhaustiveness ───────────────────────────────────────────────────────
//
// The Record types already fail typecheck on a missing key. These restate it at
// runtime so a map that was widened (to Partial, or with an index signature)
// during a future edit is caught even if the type no longer enforces it.

test("every stage, code and failure is mapped — no map has a hole", () => {
  assert.equal(Object.keys(WIZARD_SAVE_MAPS.STAGE_SLUG).length, 7);
  assert.equal(Object.keys(WIZARD_SAVE_MAPS.CODE_SEVERITY).length, 13);
  assert.equal(Object.keys(WIZARD_SAVE_MAPS.PRE_PERSIST).length, 12);

  for (const s of ALL_STAGES) assert.ok(WIZARD_SAVE_MAPS.STAGE_SLUG[s], `stage ${s} unmapped`);
  for (const c of ALL_CODES) assert.ok(WIZARD_SAVE_MAPS.CODE_SEVERITY[c], `code ${c} unmapped`);
  for (const f of ALL_FAILURES) assert.ok(WIZARD_SAVE_MAPS.PRE_PERSIST[f], `failure ${f} unmapped`);

  assert.equal(ALL_CODES.length, 12, "the domain still has exactly 12 action error codes");
});

// ── 2. No stage may sanitize to unknown-stage ───────────────────────────────
//
// This is the defect the stage map exists to prevent. `dealer_context` and
// `pricing_completeness` contain underscores, which the committed slug pattern
// rejects — without the map they would BOTH collapse to `unknown-stage`, merging
// the two stages an operator most needs to tell apart.

test("no known stage sanitizes to unknown-stage", () => {
  for (const stage of ALL_STAGES) {
    const { events, sink } = collector();
    reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage, errorCode: null }, sink);

    assert.equal(events.length, 1, `${stage}: an event was emitted`);
    assert.notEqual(events[0].stage, OBSERVABILITY_FALLBACK_STAGE, `${stage} collapsed to unknown-stage`);
    assert.match(events[0].stage, OBSERVABILITY_SLUG_PATTERN, `${stage} is not a valid slug`);
  }
});

test("the two underscore stages map to their kebab slugs", () => {
  const seen: Record<string, string> = {};
  for (const stage of ALL_STAGES) {
    const { events, sink } = collector();
    reportWizardSaveStage({ requestId: REQ, dealerId: null, stage, errorCode: null }, sink);
    seen[stage] = events[0].stage;
  }
  assert.equal(seen.dealer_context, "dealer-context");
  assert.equal(seen.pricing_completeness, "pricing-completeness");
  assert.equal(seen.authentication, "authentication");
  assert.equal(seen.rpc, "rpc");
  assert.equal(seen.done, "done");
});

test("every pre-persist stage is a valid slug too", () => {
  for (const failure of ALL_FAILURES) {
    const { events, sink } = collector();
    reportWizardSaveFailure(REQ, { failure }, sink);
    assert.equal(events.length, 1);
    assert.notEqual(events[0].stage, OBSERVABILITY_FALLBACK_STAGE, `${failure} collapsed`);
    assert.match(events[0].stage, OBSERVABILITY_SLUG_PATTERN);
  }
});

// ── 3. Severity ─────────────────────────────────────────────────────────────

test("DUPLICATE_SUBMISSION is info and is NEVER error", () => {
  const { events, sink } = collector();
  reportWizardSaveStage(
    { requestId: REQ, dealerId: DEALER, stage: "rpc", errorCode: "DUPLICATE_SUBMISSION" },
    sink,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].severity, "info",
    "an idempotent retry is the replay protection WORKING — alerting on it would page an operator for correct behaviour");
  assert.notEqual(events[0].severity, "error");
});

test("the full code→severity contract holds end to end", () => {
  const expected: Record<string, string> = {
    UNAUTHENTICATED: "info", DEALER_CONTEXT_REQUIRED: "warn", PERMISSION_DENIED: "warn",
    VALIDATION_ERROR: "info", PRICING_INCOMPLETE: "info", CUSTOMER_NOT_FOUND: "warn",
    VEHICLE_NOT_FOUND: "warn", DUPLICATE_SUBMISSION: "info", ESTIMATE_NUMBER_FAILED: "error",
    SAVE_FAILED: "error", RPC_NOT_IMPLEMENTED: "info", UNKNOWN_SAVE_ERROR: "error",
  };
  for (const code of ALL_CODES) {
    const { events, sink } = collector();
    reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage: "rpc", errorCode: code }, sink);
    assert.equal(events[0].severity, expected[code], `${code} severity`);
    assert.equal(events[0].code, code, `${code} is carried as the stable code`);
  }
});

test("a success (null code) is info and carries a null code", () => {
  const { events, sink } = collector();
  reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage: "done", errorCode: null }, sink);
  assert.equal(events[0].severity, "info");
  assert.equal(events[0].code, null);
  assert.equal(events[0].stage, "done");
});

test("severity is NOT derived from the code — five VALIDATION_ERROR failures differ", () => {
  const severityOf = (failure: WizardSaveReportableFailure) => {
    const { events, sink } = collector();
    reportWizardSaveFailure(REQ, { failure }, sink);
    return { severity: events[0].severity, code: events[0].code };
  };
  // All five carry VALIDATION_ERROR...
  for (const f of ["invalid-intent", "stale-config-revision", "service-not-offered", "save-mapping-failed", "save-validation-failed"] as const) {
    assert.equal(severityOf(f).code, "VALIDATION_ERROR", `${f} code`);
  }
  // ...but a stale revision is a real race worth noticing, while the rest are ordinary
  // correctable rejections. Deriving severity from the code would flatten that.
  assert.equal(severityOf("stale-config-revision").severity, "warn");
  assert.equal(severityOf("invalid-intent").severity, "info");
  assert.equal(severityOf("service-not-offered").severity, "info");
  assert.equal(severityOf("save-mapping-failed").severity, "info");
  assert.equal(severityOf("save-validation-failed").severity, "info");
});

test("persist-invariant is an error carrying its own internal code", () => {
  const { events, sink } = collector();
  reportWizardSaveFailure(REQ, { failure: "persist-invariant", dealerId: DEALER }, sink);
  assert.equal(events[0].severity, "error");
  assert.equal(events[0].code, PERSIST_INVARIANT_FAILED);
  assert.equal(events[0].stage, "rpc");
  // It must not be confusable with a code the service itself can produce.
  assert.equal(ALL_CODES.includes(PERSIST_INVARIANT_FAILED as EstimateSaveActionErrorCode), false);
});

// ── PPF-OFFERING-R1-B: service-not-offered mapping ──────────────────────────

test("service-not-offered maps to stage service-offering, code VALIDATION_ERROR, severity info", () => {
  const { events, sink } = collector();
  reportWizardSaveFailure(REQ, { failure: "service-not-offered", dealerId: DEALER }, sink);
  assert.equal(events.length, 1);
  assert.equal(events[0].stage, "service-offering");
  assert.equal(events[0].code, "VALIDATION_ERROR");
  assert.equal(events[0].severity, "info");
  assert.equal(events[0].dealerId, DEALER);
});

test("service-not-offered's event carries only allowlisted keys and no PPF/customer/vehicle/draft content", () => {
  const { events, sink } = collector();
  reportWizardSaveFailure(REQ, { failure: "service-not-offered", dealerId: DEALER }, sink);
  assert.deepEqual(
    Object.keys(events[0]).sort(),
    ["code", "dealerId", "env", "event", "release", "requestId", "severity", "stage"],
  );
  const serialized = JSON.stringify(events[0]);
  for (const forbidden of ["ppf", "installationMethod", "selectedPartIds", "draft", "customer", "vehicle"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `payload exposes ${forbidden}`);
  }
});

// ── 4. Event identity ───────────────────────────────────────────────────────

test("every emission uses the single event name wizard-save", () => {
  const { events, sink } = collector();
  reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage: "rpc", errorCode: "SAVE_FAILED" }, sink);
  reportWizardSaveFailure(REQ, { failure: "forbidden" }, sink);
  assert.equal(events.length, 2);
  for (const e of events) assert.equal(e.event, WIZARD_SAVE_EVENT);
  assert.equal(WIZARD_SAVE_EVENT, "wizard-save");
});

test("exactly one event per adapter call", () => {
  const { events, sink } = collector();
  for (const stage of ALL_STAGES) {
    reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage, errorCode: null }, sink);
  }
  assert.equal(events.length, ALL_STAGES.length, "one call, one record — never zero, never two");
});

// ── 5. dealerId is UUID-only; userId can never appear ───────────────────────

test("a UUID dealerId is carried; a non-UUID one is omitted entirely", () => {
  const uuid = collector();
  reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage: "rpc", errorCode: null }, uuid.sink);
  assert.equal(uuid.events[0].dealerId, DEALER);

  for (const bad of ["dealer-42", "", "  ", "NOT-A-UUID", "山田太郎", DEALER + "x"]) {
    const c = collector();
    reportWizardSaveStage({ requestId: REQ, dealerId: bad, stage: "rpc", errorCode: null }, c.sink);
    assert.equal(c.events.length, 1, "PRECONDITION: the event was emitted");
    assert.equal("dealerId" in c.events[0], false, `non-UUID dealerId ${JSON.stringify(bad)} leaked`);
  }

  const nul = collector();
  reportWizardSaveStage({ requestId: REQ, dealerId: null, stage: "rpc", errorCode: null }, nul.sink);
  assert.equal("dealerId" in nul.events[0], false, "a null tenant is omitted, never stringified");
});

test("NO emitted record can contain userId", () => {
  const c = collector();
  for (const stage of ALL_STAGES) {
    reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage, errorCode: "SAVE_FAILED" }, c.sink);
  }
  for (const failure of ALL_FAILURES) {
    reportWizardSaveFailure(REQ, { failure, dealerId: DEALER }, c.sink);
  }
  assert.equal(c.events.length, ALL_STAGES.length + ALL_FAILURES.length, "PRECONDITION: records were captured");
  for (const e of c.events) {
    assert.equal("userId" in e, false, "userId is never a field the adapter can populate");
  }
});

test("an emitted record exposes only allowlisted keys", () => {
  const { events, sink } = collector();
  reportWizardSaveStage({ requestId: REQ, dealerId: DEALER, stage: "done", errorCode: null }, sink);
  for (const k of Object.keys(events[0])) {
    assert.ok(([...OBSERVABILITY_EVENT_KEYS] as string[]).includes(k), `unexpected key: ${k}`);
  }
  assert.deepEqual(
    Object.keys(events[0]).sort(),
    ["code", "dealerId", "env", "event", "release", "requestId", "severity", "stage"],
  );
});

// ── 6. Non-vacuous PII canary ───────────────────────────────────────────────

test("CANARY: PII pushed at every writable field cannot reach a record", () => {
  const NONCE = "CANARY-PII-山田太郎-090-0000-0000-VIN12345";
  const { events, sink } = collector();

  // The only caller-controlled strings are requestId and dealerId. Push the nonce
  // into both, and a full PII-shaped tenant value too.
  reportWizardSaveStage({ requestId: NONCE, dealerId: NONCE, stage: "validation", errorCode: "VALIDATION_ERROR" }, sink);
  reportWizardSaveFailure(NONCE, { failure: "save-validation-failed", dealerId: NONCE }, sink);

  // 1. PRECONDITION — the records were ACTUALLY observed. Without this, every
  //    absence assertion below would pass against an empty array.
  assert.equal(events.length, 2, "two records reached the sink");

  // 2. The records are real and carry their required safe fields.
  for (const e of events) {
    assert.equal(e.event, "wizard-save");
    assert.equal(e.stage, "validation");
    assert.equal(e.code, "VALIDATION_ERROR");
    assert.equal(typeof e.env, "string");
    assert.equal(typeof e.release, "string");
  }

  // 3. ONLY NOW is absence meaningful.
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes(NONCE), false, "the nonce must not appear anywhere");
  assert.equal(serialized.includes("CANARY-PII"), false, "not even the nonce prefix");
  assert.equal(serialized.includes("山田太郎"), false);
  assert.equal(serialized.includes("VIN12345"), false);
  for (const e of events) {
    assert.equal(e.requestId, "obs.unattributed", "a malformed request id fails closed");
    assert.equal("dealerId" in e, false, "a non-UUID tenant is dropped, not truncated");
  }
});

test("CANARY GUARD: a zero-event run fails the canary's own precondition", () => {
  const { events } = collector();
  assert.throws(() => { assert.equal(events.length, 2, "two records reached the sink"); });
});

// ── 7. The request id is bound once, at the boundary ────────────────────────

test("createWizardSaveFailureReporter binds one id to every record it emits", () => {
  const { events, sink } = collector();
  const report = createWizardSaveFailureReporter(REQ, sink);
  report({ failure: "forbidden" });
  report({ failure: "save-validation-failed", dealerId: DEALER });

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.requestId), [REQ, REQ],
    "every record from one save attempt shares one correlation id by construction");
});

test("an invalid bound id fails closed to obs.unattributed", () => {
  for (const bad of ["req_0123456789abcdef", "unspecified", "", "obs.NOTHEX", "abcdefghijklmnop"]) {
    const { events, sink } = collector();
    createWizardSaveFailureReporter(bad, sink)({ failure: "forbidden" });
    assert.equal(events.length, 1, "PRECONDITION: a record was emitted");
    assert.equal(events[0].requestId, "obs.unattributed", `${bad} must not be trusted as a correlation id`);
  }
});

// ── 8. logEstimateSaveStage routes here, and nowhere else ───────────────────

test("logEstimateSaveStage no longer writes the legacy channel and drops userId", () => {
  const CHANNELS = ["info", "log", "warn", "error", "debug"] as const;
  const lines: string[] = [];
  const real: Partial<Record<(typeof CHANNELS)[number], (...a: unknown[]) => void>> = {};
  for (const ch of CHANNELS) {
    real[ch] = console[ch].bind(console);
    console[ch] = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  }
  try {
    logEstimateSaveStage({
      requestId: REQ, dealerId: DEALER, userId: "u0000000-0000-0000-0000-000000000001",
      stage: "pricing_completeness", validationOk: true, errorCode: "PRICING_INCOMPLETE",
    });
  } finally {
    for (const ch of CHANNELS) { const o = real[ch]; if (o) console[ch] = o; }
  }

  // PRECONDITION: a real record was written to a real channel.
  assert.equal(lines.length, 1, "exactly one operational record — not a legacy log PLUS an event");
  assert.ok(lines[0].includes("[observability]"), "written through the observability sink");

  assert.equal(lines[0].includes("saveEstimateFromWizard"), false, "the legacy channel is gone");
  assert.equal(lines[0].includes("u0000000-0000-0000-0000-000000000001"), false, "userId never reaches the log");
  assert.equal(lines[0].includes("userId"), false);
  assert.equal(lines[0].includes("validationOk"), false);
  assert.ok(lines[0].includes('"stage":"pricing-completeness"'), "the underscore stage was mapped");
  assert.ok(lines[0].includes('"code":"PRICING_INCOMPLETE"'));
  assert.ok(lines[0].includes(DEALER), "the UUID tenant is carried");
});

// ── 9. Source boundaries ────────────────────────────────────────────────────

const ADAPTER = "src/components/estimates/wizard/save/wizard-save-" + "observability.ts";
const TYPES = "src/components/estimates/wizard/save/estimate-save-orchestration-types.ts";
const codeOf = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("the adapter type-imports the domain and value-imports only the core", () => {
  const code = codeOf(ADAPTER);
  // A value import back into the types module would close a runtime cycle: that
  // module value-imports THIS one.
  assert.equal(/import\s*\{[^}]*ESTIMATE_SAVE_ACTION_ERRORS/.test(code), false,
    "no value import of the domain constant — that would be a runtime cycle");
  assert.match(code, /import type \{[^}]*EstimateSaveStage/, "domain stage type is type-only");
  assert.match(code, /import \{ reportObservabilityEvent \}/, "emits only through the core");
  assert.equal(/console\s*\./.test(code), false, "the adapter never writes a console line itself");
  assert.equal(/Partial</.test(code), false, "no Partial map");
  assert.equal(/\[key:\s*string\]/.test(code), false, "no index signature");
});

test("the types module holds exactly one emission call and no console", () => {
  const code = codeOf(TYPES);
  assert.equal(/console\s*\./.test(code), false, "console.info is gone");
  assert.equal(code.includes("saveEstimateFromWizard"), false, "the legacy prefix is gone");
  assert.equal((code.match(/reportWizardSaveStage\(/g) ?? []).length, 1, "exactly one adapter call");
  // The entry must be built field by field, never forwarded whole.
  assert.equal(/\.\.\.entry/.test(code), false, "never spread");
  assert.equal(/JSON\.stringify\(\s*entry\s*\)/.test(code), false, "never serialized");
  assert.equal(/entry\.userId|entry\.validationOk/.test(code), false, "userId/validationOk are never read");
});
