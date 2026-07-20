// OBS-1A — behavioural tests for the observability core.
//
// Run: node --import tsx --test src/lib/observability/observability.test.ts
//
// Pure module: no Supabase, no database, no network, no module mocks, no vendor.
// Every assertion is executable behaviour, not source text — the source-boundary
// guards live in observability-source-guard.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OBSERVABILITY_EVENT_KEYS,
  OBSERVABILITY_FALLBACK_CODE,
  OBSERVABILITY_FALLBACK_EVENT,
  OBSERVABILITY_FALLBACK_REQUEST_ID,
  OBSERVABILITY_FALLBACK_STAGE,
  type ObservabilityEvent,
} from "./observability-types";
import { createObservabilityRequestId } from "./create-observability-request-id";
import { sanitizeObservabilityEvent } from "./sanitize-observability-event";
import { reportObservabilityEvent } from "./report-observability-event";
// TEST-ONLY import of the authoritative idempotency language. Production
// observability files import NO save module; this test needs the real pattern so
// disjointness is proven against the actual authority, not a local copy of it.
import { IDEMPOTENCY_KEY_PATTERN } from "../../components/estimates/wizard/save/wizard-save-intent-types";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function collector(): { events: ObservabilityEvent[]; sink: (e: ObservabilityEvent) => void } {
  const events: ObservabilityEvent[] = [];
  return { events, sink: (e) => { events.push(e); } };
}

const valid = {
  event: "wizard-save", severity: "info", requestId: "obs." + "a".repeat(32),
  stage: "rpc", code: "DUPLICATE_SUBMISSION", dealerId: UUID_A, userId: UUID_B, durationMs: 12,
};

// ─── 1-2. Exact key set; extra keys removed ─────────────────────────────────

test("a sanitized event exposes EXACTLY the allowed keys", () => {
  const e = sanitizeObservabilityEvent(valid);
  assert.deepEqual(Object.keys(e).sort(), [...OBSERVABILITY_EVENT_KEYS].sort());
});

test("optional keys are omitted entirely when absent, never emitted as null", () => {
  const e = sanitizeObservabilityEvent({ event: "a", severity: "info", requestId: "obs." + "c".repeat(32), stage: "b" });
  assert.equal("dealerId" in e, false);
  assert.equal("userId" in e, false);
  assert.equal("durationMs" in e, false);
  assert.deepEqual(Object.keys(e).sort(), ["code", "env", "event", "release", "requestId", "severity", "stage"]);
});

test("caller-invented keys are never carried through", () => {
  const e = sanitizeObservabilityEvent({
    ...valid,
    metadata: { a: 1 }, context: { b: 2 }, tags: ["x"], extra: "y", payload: { c: 3 },
  });
  for (const k of ["metadata", "context", "tags", "extra", "payload"]) {
    assert.equal(k in e, false, `${k} must not survive`);
  }
  assert.deepEqual(Object.keys(e).sort(), [...OBSERVABILITY_EVENT_KEYS].sort());
});

test("env and release are resolved internally and cannot be spoofed by a caller", () => {
  const e = sanitizeObservabilityEvent({ ...valid, env: "SPOOFED", release: "SPOOFED" });
  assert.notEqual(e.env, "SPOOFED");
  assert.notEqual(e.release, "SPOOFED");
});

// ─── 3-4. PII-shaped values and diagnostic fields ───────────────────────────

test("PII-shaped values attached to prohibited fields never appear", () => {
  const e = sanitizeObservabilityEvent({
    ...valid,
    customerName: "山田太郎", email: "a@example.test", phone: "090-0000-0000",
    address: "東京都", vin: "JT1234567890", plateNumber: "品川300",
    estimate: { total: 5500 }, pricing: { grandTotal: 5500 }, notes: "internal memo",
    draft: { version: "2.2" }, cookie: "sb-access-token=abc", token: "secret",
    authorization: "Bearer abc", idempotencyKey: "abcdefghijklmnop",
  });
  const s = JSON.stringify(e);
  for (const leak of ["山田太郎", "a@example.test", "090-0000-0000", "東京都", "JT1234567890",
                      "品川300", "5500", "internal memo", "sb-access-token", "Bearer",
                      "secret", "abcdefghijklmnop"]) {
    assert.equal(s.includes(leak), false, `leaked: ${leak}`);
  }
});

test("Supabase/Error diagnostic fields are never read or emitted", () => {
  const e = sanitizeObservabilityEvent({
    ...valid,
    message: "duplicate key value violates unique constraint",
    details: "Key (dealer_id, idempotency_key)=(x, y) already exists.",
    hint: "consider retrying", stack: "Error: at foo (bar.ts:1:1)",
    cause: new Error("inner"), sqlState: "23505", constraint: "estimates_dealer_idempotency_key_uidx",
  });
  const s = JSON.stringify(e);
  for (const leak of ["duplicate key", "Key (dealer_id", "already exists", "consider retrying",
                      "bar.ts", "inner", "23505", "estimates_dealer_idempotency_key_uidx"]) {
    assert.equal(s.includes(leak), false, `leaked: ${leak}`);
  }
  for (const k of ["message", "details", "hint", "stack", "cause", "sqlState", "constraint"]) {
    assert.equal(k in e, false, `${k} must not be a key`);
  }
});

test("a raw Error instance sanitizes to a well-formed event and leaks nothing", () => {
  const err = new Error("customer 山田太郎 not found");
  const e = sanitizeObservabilityEvent(err);
  assert.equal(JSON.stringify(e).includes("山田太郎"), false);
  assert.equal(e.event, OBSERVABILITY_FALLBACK_EVENT);
  assert.equal(e.severity, "error");
});

// ─── 5. Hostile and exotic inputs never throw ───────────────────────────────

test("circular, primitive, null and hostile inputs never throw", () => {
  const circular: Record<string, unknown> = { event: "a", severity: "info" };
  circular.self = circular;

  const throwingGetter = {
    get event(): string { throw new Error("hostile getter"); },
    get severity(): string { throw new Error("hostile getter"); },
    get requestId(): string { throw new Error("hostile getter"); },
  };

  const inputs: unknown[] = [
    circular, throwingGetter, null, undefined, 42, "string", true, Symbol("s"),
    [], [1, 2, 3], new Map(), new Set(), new Date(0), () => undefined,
    Object.create(null), new Proxy({}, { get() { throw new Error("hostile proxy"); } }),
  ];
  for (const input of inputs) {
    const e = sanitizeObservabilityEvent(input);
    assert.equal(typeof e.event, "string");
    assert.equal(typeof e.requestId, "string");
    assert.deepEqual(Object.keys(e).sort().filter((k) => ["env", "release"].includes(k)), ["env", "release"]);
  }
});

test("a hostile getter degrades to fallbacks rather than propagating", () => {
  const e = sanitizeObservabilityEvent({ get event(): string { throw new Error("x"); } });
  assert.equal(e.event, OBSERVABILITY_FALLBACK_EVENT);
  assert.equal(e.stage, OBSERVABILITY_FALLBACK_STAGE);
  assert.equal(e.requestId, OBSERVABILITY_FALLBACK_REQUEST_ID);
});

// ─── 6-8. Field validation ──────────────────────────────────────────────────

test("dealerId/userId are included only when UUID-shaped", () => {
  assert.equal(sanitizeObservabilityEvent({ ...valid, dealerId: UUID_A }).dealerId, UUID_A);
  for (const bad of ["not-a-uuid", "", "1234", UUID_A + "x", 42, null, {}, "-".repeat(36)]) {
    const e = sanitizeObservabilityEvent({ ...valid, dealerId: bad, userId: bad });
    assert.equal("dealerId" in e, false, `dealerId accepted: ${String(bad)}`);
    assert.equal("userId" in e, false, `userId accepted: ${String(bad)}`);
  }
});

test("durationMs is included only when finite and non-negative", () => {
  assert.equal(sanitizeObservabilityEvent({ ...valid, durationMs: 0 }).durationMs, 0);
  assert.equal(sanitizeObservabilityEvent({ ...valid, durationMs: 1.5 }).durationMs, 1.5);
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "12", null, {}]) {
    assert.equal("durationMs" in sanitizeObservabilityEvent({ ...valid, durationMs: bad }), false,
      `durationMs accepted: ${String(bad)}`);
  }
});

test("code accepts null and stable codes; anything else becomes UNKNOWN", () => {
  assert.equal(sanitizeObservabilityEvent({ ...valid, code: null }).code, null);
  assert.equal(sanitizeObservabilityEvent({ ...valid, code: undefined }).code, null);
  assert.equal(sanitizeObservabilityEvent({ ...valid, code: "VALIDATION_ERROR" }).code, "VALIDATION_ERROR");
  for (const bad of ["lowercase", "has space", "duplicate key value violates", 42, {}, "_LEADING"]) {
    assert.equal(sanitizeObservabilityEvent({ ...valid, code: bad }).code, OBSERVABILITY_FALLBACK_CODE,
      `code accepted: ${String(bad)}`);
  }
});

test("event/stage accept safe slugs and fall back otherwise; severity fails closed to error", () => {
  assert.equal(sanitizeObservabilityEvent({ ...valid, event: "wizard-save-v2" }).event, "wizard-save-v2");
  for (const bad of ["Has Space", "UPPER", "-leading", "a".repeat(65), 42, null, "山田"]) {
    assert.equal(sanitizeObservabilityEvent({ ...valid, event: bad }).event, OBSERVABILITY_FALLBACK_EVENT);
    assert.equal(sanitizeObservabilityEvent({ ...valid, stage: bad }).stage, OBSERVABILITY_FALLBACK_STAGE);
  }
  for (const bad of ["fatal", "INFO", "", 42, null, undefined]) {
    assert.equal(sanitizeObservabilityEvent({ ...valid, severity: bad }).severity, "error");
  }
  for (const good of ["info", "warn", "error"] as const) {
    assert.equal(sanitizeObservabilityEvent({ ...valid, severity: good }).severity, good);
  }
});

// ─── 9. Release precedence ──────────────────────────────────────────────────

test("release precedence: VERCEL_GIT_COMMIT_SHA > NEXT_PUBLIC_GIT_COMMIT > test > development > unknown", () => {
  const saved = {
    v: process.env.VERCEL_GIT_COMMIT_SHA,
    p: process.env.NEXT_PUBLIC_GIT_COMMIT,
    n: process.env.NODE_ENV,
  };
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  };
  try {
    set("VERCEL_GIT_COMMIT_SHA", "sha-vercel"); set("NEXT_PUBLIC_GIT_COMMIT", "sha-public");
    assert.equal(sanitizeObservabilityEvent(valid).release, "sha-vercel", "1st: vercel sha wins");

    set("VERCEL_GIT_COMMIT_SHA", undefined);
    assert.equal(sanitizeObservabilityEvent(valid).release, "sha-public", "2nd: public sha");

    set("NEXT_PUBLIC_GIT_COMMIT", undefined); set("NODE_ENV", "test");
    assert.equal(sanitizeObservabilityEvent(valid).release, "test", "3rd: test");

    set("NODE_ENV", "development");
    assert.equal(sanitizeObservabilityEvent(valid).release, "development", "4th: development");

    set("NODE_ENV", "production");
    assert.equal(sanitizeObservabilityEvent(valid).release, "unknown", "5th: unknown");

    // Empty strings must not satisfy a precedence step.
    set("VERCEL_GIT_COMMIT_SHA", ""); set("NEXT_PUBLIC_GIT_COMMIT", "");
    assert.equal(sanitizeObservabilityEvent(valid).release, "unknown", "empty vars are not sources");
  } finally {
    set("VERCEL_GIT_COMMIT_SHA", saved.v); set("NEXT_PUBLIC_GIT_COMMIT", saved.p); set("NODE_ENV", saved.n);
  }
});

test("release is never the package.json version", () => {
  assert.notEqual(sanitizeObservabilityEvent(valid).release, "0.1.0");
});

// ─── 10-12. Request id ──────────────────────────────────────────────────────

test("createObservabilityRequestId returns obs. + 32 lowercase hex", () => {
  for (let i = 0; i < 50; i++) {
    assert.match(createObservabilityRequestId(), /^obs\.[0-9a-f]{32}$/);
  }
});

test("ids are unique across many calls (real entropy, not a counter or clock)", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(createObservabilityRequestId());
  assert.equal(seen.size, 500, "no collisions and no constant value");
});

test("a throwing Web Crypto degrades to obs.unattributed instead of throwing", () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues() { throw new Error("no entropy"); } },
    });
    assert.equal(createObservabilityRequestId(), OBSERVABILITY_FALLBACK_REQUEST_ID);

    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
    assert.equal(createObservabilityRequestId(), OBSERVABILITY_FALLBACK_REQUEST_ID);

    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    assert.equal(createObservabilityRequestId(), OBSERVABILITY_FALLBACK_REQUEST_ID);
  } finally {
    if (real) Object.defineProperty(globalThis, "crypto", real);
  }
});

test("the fallback id is a fixed literal, not a timestamp or random value", () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
    const a = createObservabilityRequestId();
    const b = createObservabilityRequestId();
    assert.equal(a, b, "the fallback is constant");
    assert.equal(a, "obs.unattributed");
    assert.equal(/\d{10,}/.test(a), false, "no timestamp");
  } finally {
    if (real) Object.defineProperty(globalThis, "crypto", real);
  }
});

// ─── 14. requestId and idempotencyKey stay structurally separate ────────────

test("DISJOINT 1: every generated observability id is rejected by the idempotency authority", () => {
  // The dot is what makes this true: `.` is absent from ^[A-Za-z0-9_-]{16,64}$.
  for (let i = 0; i < 200; i++) {
    const id = createObservabilityRequestId();
    assert.match(id, /^obs\.[0-9a-f]{32}$/);
    assert.equal(IDEMPOTENCY_KEY_PATTERN.test(id), false,
      `generated id is also a valid idempotency key: ${id}`);
  }
});

test("DISJOINT 2: the fallback id is rejected by the idempotency authority", () => {
  assert.equal(OBSERVABILITY_FALLBACK_REQUEST_ID, "obs.unattributed");
  assert.equal(IDEMPOTENCY_KEY_PATTERN.test(OBSERVABILITY_FALLBACK_REQUEST_ID), false);
});

test("DISJOINT 3: canonical observability ids are accepted by the sanitizer", () => {
  const generated = createObservabilityRequestId();
  assert.equal(sanitizeObservabilityEvent({ ...valid, requestId: generated }).requestId, generated);
  assert.equal(sanitizeObservabilityEvent({ ...valid, requestId: "obs." + "0".repeat(32) }).requestId,
    "obs." + "0".repeat(32));
  assert.equal(sanitizeObservabilityEvent({ ...valid, requestId: "obs.unattributed" }).requestId,
    "obs.unattributed");
});

test("DISJOINT 4: underscore prefixes and arbitrary strings are rejected by the sanitizer", () => {
  // req_ / obs_ are NOT accepted. An underscore prefix is a naming convention, not
  // a boundary — it lives inside the idempotency alphabet, so it separates nothing.
  const rejected: unknown[] = [
    "req_" + "a".repeat(32), "req." + "a".repeat(32), "obs_" + "a".repeat(32),
    "req_unattributed", "obs_unattributed", "obs.", "obs.UNATTRIBUTED",
    "obs." + "A".repeat(32), "obs." + "a".repeat(31), "obs." + "a".repeat(33),
    "obs.abc", "sess.abc", "abc", "", 42, null, undefined, {},
  ];
  for (const bad of rejected) {
    assert.equal(sanitizeObservabilityEvent({ ...valid, requestId: bad }).requestId,
      OBSERVABILITY_FALLBACK_REQUEST_ID, `accepted: ${String(bad)}`);
  }
});

test("DISJOINT 5: real idempotency keys are valid keys, invalid ids, and never emitted", () => {
  const keys = ["abcdefghijklmnop", "a".repeat(64), "AZaz09_-AZaz09_-",
                "req_abcdefghijklm", "obs_abcdefghijklm"];
  for (const key of keys) {
    // It IS a legitimate idempotency key by the authoritative pattern...
    assert.equal(IDEMPOTENCY_KEY_PATTERN.test(key), true, `not a valid key: ${key}`);
    // ...and is therefore NOT a legitimate observability id.
    const e = sanitizeObservabilityEvent({ ...valid, requestId: key });
    assert.equal(e.requestId, OBSERVABILITY_FALLBACK_REQUEST_ID, `key accepted as requestId: ${key}`);
    assert.equal(JSON.stringify(e).includes(key), false, "and the key is emitted nowhere");
  }
});

test("DISJOINT 6: the two languages share no member (exhaustive over both generators)", () => {
  // Nothing accepted as an observability id may satisfy the idempotency pattern,
  // and nothing satisfying the idempotency pattern may be accepted as an id.
  const observabilityIds = [OBSERVABILITY_FALLBACK_REQUEST_ID,
    ...Array.from({ length: 50 }, () => createObservabilityRequestId())];
  for (const id of observabilityIds) {
    assert.equal(IDEMPOTENCY_KEY_PATTERN.test(id), false, `overlap: ${id}`);
  }
});

// ─── 13. Reporting ──────────────────────────────────────────────────────────

test("reportObservabilityEvent delivers exactly one sanitized event to the sink", () => {
  const { events, sink } = collector();
  reportObservabilityEvent(valid, sink);
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0]).sort(), [...OBSERVABILITY_EVENT_KEYS].sort());
});

test("a throwing sink never escapes into the caller", () => {
  assert.doesNotThrow(() => {
    reportObservabilityEvent(valid, () => { throw new Error("sink exploded"); });
  });
});

test("reporting hostile input never throws", () => {
  const circular: Record<string, unknown> = {}; circular.self = circular;
  for (const input of [circular, null, undefined, 42, "s", [], new Error("boom"),
                       new Proxy({}, { get() { throw new Error("hostile"); } })]) {
    const { events, sink } = collector();
    assert.doesNotThrow(() => { reportObservabilityEvent(input, sink); });
    assert.equal(events.length, 1, "an event is still emitted");
  }
});

test("the emitted event is the reconstruction, never the caller's object", () => {
  const original = { ...valid, secretField: "must-not-survive" };
  const { events, sink } = collector();
  reportObservabilityEvent(original, sink);
  assert.notEqual(events[0], original, "not the same object reference");
  assert.equal("secretField" in events[0], false);
});

// ─── Non-vacuous canary ─────────────────────────────────────────────────────

test("CANARY: a PII nonce pushed through prohibited fields never reaches the sink", () => {
  const nonce = `CANARY-PII-${createObservabilityRequestId()}`;
  const { events, sink } = collector();

  reportObservabilityEvent({
    event: "wizard-save", severity: "error", requestId: "obs." + "b".repeat(32),
    stage: "rpc", code: "SAVE_FAILED", dealerId: UUID_A,
    // every prohibited carrier, all loaded with the same nonce
    message: nonce, details: nonce, hint: nonce, stack: nonce, cause: new Error(nonce),
    customerName: nonce, email: nonce, phone: nonce, address: nonce, vin: nonce,
    plateNumber: nonce, notes: nonce, idempotencyKey: nonce, cookie: nonce, token: nonce,
    metadata: { nested: { deep: nonce } }, tags: [nonce], estimate: { notes: nonce },
  }, sink);

  // 1. The signal was ACTUALLY observed — without this, every absence assertion
  //    below could pass against an empty array.
  assert.equal(events.length, 1, "exactly one event reached the sink");

  // 2. The event is the real thing, carrying its required safe fields.
  const e = events[0];
  assert.equal(e.event, "wizard-save");
  assert.equal(e.severity, "error");
  assert.equal(e.stage, "rpc");
  assert.equal(e.code, "SAVE_FAILED");
  assert.equal(e.dealerId, UUID_A);
  assert.match(e.requestId, /^obs\.[0-9a-f]{32}$/);
  assert.equal(typeof e.env, "string");
  assert.equal(typeof e.release, "string");

  // 3. ONLY NOW is absence meaningful.
  const serialized = JSON.stringify(e);
  assert.equal(serialized.includes(nonce), false, "the nonce must not appear anywhere");
  assert.equal(serialized.includes("CANARY-PII"), false, "not even the nonce prefix");
});

test("CANARY GUARD: a zero-event run fails the canary's own precondition", () => {
  // Proves assertion 1 of the canary is load-bearing: a sink that receives
  // nothing must be detectable, otherwise the canary could pass vacuously.
  const { events } = collector();
  assert.equal(events.length, 0);
  assert.throws(() => { assert.equal(events.length, 1, "exactly one event reached the sink"); });
});
