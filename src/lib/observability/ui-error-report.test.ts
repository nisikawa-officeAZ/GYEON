// OBS-1B — behavioural tests for the pure UI-error reporting controller.
//
// Run: node --import tsx --test src/lib/observability/ui-error-report.test.ts
//
// This file proves the EXACTLY-ONCE contract. Server rendering cannot execute
// useEffect, so the boundary components' effects are deliberately NOT simulated
// here or anywhere: the decision logic lives in this pure module precisely so it
// can be proven directly rather than through a faked effect.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  reportUiErrorOnce,
  UI_ERROR_CODE,
  UI_ERROR_EVENT,
  type UiErrorBoundaryStage,
  type UiErrorReportLatch,
} from "./ui-error-report";
import { OBSERVABILITY_EVENT_KEYS, type ObservabilityEvent } from "./observability-types";
import { createObservabilityRequestId } from "./create-observability-request-id";

function collector(): { events: ObservabilityEvent[]; sink: (e: ObservabilityEvent) => void } {
  const events: ObservabilityEvent[] = [];
  return { events, sink: (e) => { events.push(e); } };
}

const latch = (): UiErrorReportLatch => ({ current: null });
const STAGES: UiErrorBoundaryStage[] = ["global-boundary", "app-boundary", "estimates-boundary"];

// ─── 1. Exact event vocabulary ──────────────────────────────────────────────

test("emits the exact canonical vocabulary for every boundary stage", () => {
  for (const stage of STAGES) {
    const { events, sink } = collector();
    const code = createObservabilityRequestId();
    reportUiErrorOnce(latch(), code, stage, sink);

    assert.equal(events.length, 1);
    const e = events[0];
    assert.equal(e.event, "uncaught-ui-error");
    assert.equal(e.event, UI_ERROR_EVENT);
    assert.equal(e.severity, "error");
    assert.equal(e.requestId, code);
    assert.equal(e.stage, stage);
    assert.equal(e.code, "UNCAUGHT_UI_ERROR");
    assert.equal(e.code, UI_ERROR_CODE);
    assert.match(e.requestId, /^obs\.[0-9a-f]{32}$/);
  }
});

test("the emitted event carries no optional identity or timing field", () => {
  const { events, sink } = collector();
  reportUiErrorOnce(latch(), createObservabilityRequestId(), "app-boundary", sink);
  const e = events[0];
  assert.equal("dealerId" in e, false);
  assert.equal("userId" in e, false);
  assert.equal("durationMs" in e, false);
  // Only the allowlisted keys, and only the ones this controller can produce.
  assert.deepEqual(Object.keys(e).sort(), ["code", "env", "event", "release", "requestId", "severity", "stage"]);
  for (const k of Object.keys(e)) {
    assert.ok(([...OBSERVABILITY_EVENT_KEYS] as string[]).includes(k), `unexpected key: ${k}`);
  }
});

test("env and release come from the committed sanitizer, not this controller", () => {
  const { events, sink } = collector();
  reportUiErrorOnce(latch(), createObservabilityRequestId(), "app-boundary", sink);
  assert.equal(typeof events[0].env, "string");
  assert.equal(typeof events[0].release, "string");
  assert.notEqual(events[0].env, "");
  assert.notEqual(events[0].release, "");
});

// ─── 2-3. Exactly once, per incident ────────────────────────────────────────

test("repeated calls with the same latch and support code emit exactly ONE event", () => {
  const { events, sink } = collector();
  const l = latch();
  const code = createObservabilityRequestId();
  for (let i = 0; i < 25; i++) reportUiErrorOnce(l, code, "global-boundary", sink);
  assert.equal(events.length, 1, "an incident reports once regardless of effect re-runs");
});

test("Strict Mode double invocation still yields exactly one event", () => {
  // React 19 development Strict Mode invokes an effect, cleans up, and invokes
  // it again. The latch survives that because the component instance owns it.
  const { events, sink } = collector();
  const l = latch();
  const code = createObservabilityRequestId();
  reportUiErrorOnce(l, code, "estimates-boundary", sink);   // first invocation
  reportUiErrorOnce(l, code, "estimates-boundary", sink);   // Strict Mode re-invocation
  assert.equal(events.length, 1);
});

test("a different support code on the same latch emits a second event", () => {
  const { events, sink } = collector();
  const l = latch();
  const first = createObservabilityRequestId();
  const second = createObservabilityRequestId();
  assert.notEqual(first, second);

  reportUiErrorOnce(l, first, "app-boundary", sink);
  reportUiErrorOnce(l, first, "app-boundary", sink);
  reportUiErrorOnce(l, second, "app-boundary", sink);

  assert.equal(events.length, 2, "a genuinely new incident reports again");
  assert.deepEqual(events.map((e) => e.requestId), [first, second]);
});

test("independent latches are independent incidents", () => {
  const { events, sink } = collector();
  const code = createObservabilityRequestId();
  reportUiErrorOnce(latch(), code, "app-boundary", sink);
  reportUiErrorOnce(latch(), code, "app-boundary", sink);
  assert.equal(events.length, 2, "two mounted boundaries each own their latch");
});

// ─── 4. Latch ordering ──────────────────────────────────────────────────────

test("the latch is set BEFORE the sink is invoked", () => {
  const l = latch();
  const code = createObservabilityRequestId();
  let latchAtDelivery: string | null = "not-observed";
  reportUiErrorOnce(l, code, "app-boundary", () => { latchAtDelivery = l.current; });
  assert.equal(latchAtDelivery, code, "the latch was already set when the sink ran");
  assert.equal(l.current, code);
});

test("a throwing sink still leaves the latch closed, so no storm can follow", () => {
  const l = latch();
  const code = createObservabilityRequestId();
  let calls = 0;
  const throwing = () => { calls += 1; throw new Error("sink exploded"); };

  assert.doesNotThrow(() => { reportUiErrorOnce(l, code, "global-boundary", throwing); });
  assert.equal(l.current, code);

  // Subsequent effect re-runs must not retry delivery.
  reportUiErrorOnce(l, code, "global-boundary", throwing);
  reportUiErrorOnce(l, code, "global-boundary", throwing);
  assert.equal(calls, 1, "a failing sink is attempted once, never repeatedly");
});

// ─── 5. A throwing sink never escapes ───────────────────────────────────────

test("reporting failure can never break reset or navigation", () => {
  for (const stage of STAGES) {
    assert.doesNotThrow(() => {
      reportUiErrorOnce(latch(), createObservabilityRequestId(), stage, () => {
        throw new Error("provider outage");
      });
    });
  }
});

// ─── 6. No prohibited field can be produced ─────────────────────────────────

test("no prohibited field appears in any emitted event", () => {
  const { events, sink } = collector();
  reportUiErrorOnce(latch(), createObservabilityRequestId(), "estimates-boundary", sink);
  const serialized = JSON.stringify(events[0]);
  for (const forbidden of ["message", "details", "hint", "stack", "cause", "digest",
                           "route", "url", "metadata", "dealerId", "userId", "durationMs"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `event exposes ${forbidden}`);
  }
});

test("the controller signature offers nowhere to put a raw Error", () => {
  // A compile-time guarantee, restated at runtime: passing an Error would have to
  // occupy the supportCode slot, and the sanitizer rejects it as a requestId.
  const { events, sink } = collector();
  const err = Object.assign(new Error("CANARY-MESSAGE-should-not-appear"), {
    digest: "CANARY-DIGEST-should-not-appear",
  });
  reportUiErrorOnce(latch(), String(err), "app-boundary", sink);

  assert.equal(events.length, 1);
  const serialized = JSON.stringify(events[0]);
  assert.equal(serialized.includes("CANARY-MESSAGE"), false);
  assert.equal(serialized.includes("CANARY-DIGEST"), false);
  assert.equal(events[0].requestId, "obs.unattributed", "a non-obs value fails closed");
});

// ─── 7. Non-vacuous PII canary ──────────────────────────────────────────────

test("CANARY: a PII nonce cannot ride into a UI error event", () => {
  const nonce = `CANARY-PII-${createObservabilityRequestId()}`;
  const { events, sink } = collector();

  // The only caller-controlled string is the support code. Push the nonce there.
  reportUiErrorOnce(latch(), nonce, "global-boundary", sink);

  // 1. The signal was ACTUALLY observed — without this, every absence assertion
  //    below would pass against an empty array.
  assert.equal(events.length, 1, "exactly one event reached the sink");

  // 2. The event is real and carries its required safe fields.
  const e = events[0];
  assert.equal(e.event, "uncaught-ui-error");
  assert.equal(e.severity, "error");
  assert.equal(e.stage, "global-boundary");
  assert.equal(e.code, "UNCAUGHT_UI_ERROR");
  assert.equal(typeof e.env, "string");
  assert.equal(typeof e.release, "string");

  // 3. ONLY NOW is absence meaningful.
  const serialized = JSON.stringify(e);
  assert.equal(serialized.includes(nonce), false, "the nonce must not appear anywhere");
  assert.equal(serialized.includes("CANARY-PII"), false, "not even the nonce prefix");
  assert.equal(e.requestId, "obs.unattributed", "the malformed code failed closed");
});

test("CANARY GUARD: a zero-event run fails the canary's own precondition", () => {
  const { events } = collector();
  assert.equal(events.length, 0);
  assert.throws(() => { assert.equal(events.length, 1, "exactly one event reached the sink"); });
});
