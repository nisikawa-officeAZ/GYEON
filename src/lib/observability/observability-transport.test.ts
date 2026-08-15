// OBS-1P — client transport tests.
//
// Run: node --import tsx --test src/lib/observability/observability-transport.test.ts
//
// No network, no DOM, no provider: `fetch` is injected. Every absence assertion
// is preceded by a positive canary proving the call actually happened, so a
// silently-not-sending transport cannot pass by emitting nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sendObservabilityEvent, toTransportBody, isTransportableEvent,
  OBSERVABILITY_EVENT_PATH, TRANSPORTABLE_EVENT, TRANSPORTABLE_CODE, TRANSPORTABLE_STAGES,
  type FetchLike,
} from "./observability-transport";
import type { ObservabilityEvent } from "./observability-types";
// The REAL reporter — imported so the sink-selection wiring is proven
// behaviourally, not merely asserted from source text.
import { reportObservabilityEvent } from "./report-observability-event";

const REQ = "obs.0123456789abcdef0123456789abcdef";

function uiEvent(over: Partial<ObservabilityEvent> = {}): ObservabilityEvent {
  return {
    event: TRANSPORTABLE_EVENT,
    severity: "error",
    requestId: REQ,
    stage: "global-boundary",
    code: TRANSPORTABLE_CODE,
    env: "production",
    release: "8b7d59df3eedd93197347692ed9e786a41591dac",
    ...over,
  };
}

type Call = { url: string; init: Parameters<FetchLike>[1] };

function recorder(impl?: (c: Call) => unknown): { calls: Call[]; fetchImpl: FetchLike } {
  const calls: Call[] = [];
  return {
    calls,
    fetchImpl: (url, init) => { const c = { url, init }; calls.push(c); return impl ? impl(c) : Promise.resolve(); },
  };
}

// ── 1. Exact URL and request init ───────────────────────────────────────────

test("sends to the exact relative path with the exact init", () => {
  const r = recorder();
  sendObservabilityEvent(uiEvent(), r.fetchImpl);

  assert.equal(r.calls.length, 1, "PRECONDITION: a request was actually made");
  const { url, init } = r.calls[0];

  assert.equal(url, "/api/observability/event");
  assert.equal(url, OBSERVABILITY_EVENT_PATH);
  assert.equal(url.startsWith("/"), true, "relative — same-origin by construction");
  assert.equal(/^https?:/.test(url), false, "no absolute URL, no configurable host");

  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "Content-Type": "application/json" },
    "exactly one header — no caller-controlled headers");
  assert.equal(init.credentials, "omit", "cookies are never attached");
  assert.equal(init.keepalive, true, "survives page teardown after a global boundary");
});

// ── 2. Exactly one call, never retried ──────────────────────────────────────

test("exactly one fetch call, and no retry after a rejection", async () => {
  const r = recorder(() => Promise.reject(new Error("network down")));
  sendObservabilityEvent(uiEvent(), r.fetchImpl);

  assert.equal(r.calls.length, 1, "PRECONDITION: the request was attempted");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(r.calls.length, 1, "a failed report is lost, never retried into a storm");
});

// ── 3. Every failure mode is contained ──────────────────────────────────────

test("a REJECTING fetch cannot escape into the caller", async () => {
  const r = recorder(() => Promise.reject(new Error("network down")));
  assert.doesNotThrow(() => { sendObservabilityEvent(uiEvent(), r.fetchImpl); });
  assert.equal(r.calls.length, 1, "PRECONDITION: it really did attempt and reject");
  // An unhandled rejection would surface here as a process-level warning.
  await new Promise((resolve) => setTimeout(resolve, 10));
});

test("a SYNCHRONOUSLY THROWING fetch is contained", () => {
  let called = 0;
  const throwing: FetchLike = () => { called += 1; throw new TypeError("bad argument"); };
  assert.doesNotThrow(() => { sendObservabilityEvent(uiEvent(), throwing); });
  assert.equal(called, 1, "PRECONDITION: the throwing implementation really ran");
});

test("an UNAVAILABLE fetch is contained", () => {
  const saved = (globalThis as { fetch?: unknown }).fetch;
  try {
    delete (globalThis as { fetch?: unknown }).fetch;
    assert.doesNotThrow(() => { sendObservabilityEvent(uiEvent()); });
  } finally {
    if (saved !== undefined) (globalThis as { fetch?: unknown }).fetch = saved;
  }
});

test("a fetch returning a NON-promise is contained", () => {
  const weird: FetchLike = () => undefined;
  assert.doesNotThrow(() => { sendObservabilityEvent(uiEvent(), weird); });
});

// ── 4. The wire body carries exactly four keys ──────────────────────────────

test("the body has exactly the four allowed keys, and no diagnostic or PII", () => {
  const NONCE = "CANARY-山田太郎-090-0000-0000";
  const r = recorder();

  // The event object carries env, release and severity; a copy-based transport
  // would forward them. Push a nonce through every extra field too.
  sendObservabilityEvent(
    {
      ...uiEvent(),
      env: NONCE,
      release: NONCE,
      dealerId: "daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: "ubbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      // Chosen so it is NOT a substring of the hex request id — otherwise the
      // absence assertion below would fail against the transport's own correct
      // output and would have to be weakened to pass.
      durationMs: 987654,
    } as ObservabilityEvent,
    r.fetchImpl,
  );

  assert.equal(r.calls.length, 1, "PRECONDITION: a request was made");
  const body = JSON.parse(r.calls[0].init.body) as Record<string, unknown>;

  assert.deepEqual(Object.keys(body).sort(), ["code", "event", "requestId", "stage"]);
  assert.equal(body.requestId, REQ);
  assert.equal(body.event, "uncaught-ui-error");
  assert.equal(body.stage, "global-boundary");
  assert.equal(body.code, "UNCAUGHT_UI_ERROR");

  const wire = r.calls[0].init.body;
  for (const forbidden of [NONCE, "CANARY", "山田太郎", "env", "release", "severity",
                           "dealerId", "userId", "durationMs", "daaaaaaa", "ubbbbbbb", "987654"]) {
    assert.equal(wire.includes(forbidden), false, `the wire body exposes ${forbidden}`);
  }
});

test("every transportable stage is carried verbatim", () => {
  for (const stage of TRANSPORTABLE_STAGES) {
    const r = recorder();
    sendObservabilityEvent(uiEvent({ stage }), r.fetchImpl);
    assert.equal(r.calls.length, 1, `${stage}: sent`);
    assert.equal((JSON.parse(r.calls[0].init.body) as { stage: string }).stage, stage);
  }
});

// ── 5. Unsupported events do not send ───────────────────────────────────────

test("generic and unattributed events are NOT sent", () => {
  const cases: Array<[Partial<ObservabilityEvent>, string]> = [
    [{ event: "wizard-save" }, "a save-path event never opens the public endpoint"],
    [{ event: "unknown-event" }, "the fallback event name"],
    [{ code: "SAVE_FAILED" }, "a foreign code"],
    [{ code: "UNKNOWN" }, "the fallback code"],
    [{ stage: "rpc" }, "a non-boundary stage"],
    [{ stage: "unknown-stage" }, "the fallback stage"],
    [{ requestId: "obs.unattributed" }, "an unattributable code is not worth a log line"],
    [{ requestId: "req_0123456789abcdef" }, "a legacy-shaped id"],
    [{ requestId: "obs.NOTHEX0123456789abcdef01234567" }, "a non-hex body"],
    [{ requestId: "obs.0123456789ABCDEF0123456789ABCDEF" }, "uppercase hex"],
  ];
  for (const [over, why] of cases) {
    const r = recorder();
    sendObservabilityEvent(uiEvent(over), r.fetchImpl);
    assert.equal(r.calls.length, 0, `must not send: ${why}`);
    assert.equal(isTransportableEvent(uiEvent(over)), false, why);
    assert.equal(toTransportBody(uiEvent(over)), null, why);
  }
});

test("CANARY GUARD: the positive case really does send", () => {
  // Without this, every "must not send" assertion above could pass against a
  // transport that never sends anything at all.
  const r = recorder();
  sendObservabilityEvent(uiEvent(), r.fetchImpl);
  assert.equal(r.calls.length, 1);
  assert.equal(isTransportableEvent(uiEvent()), true);
  assert.notEqual(toTransportBody(uiEvent()), null);
});

// ── 6. No recursive reporting ───────────────────────────────────────────────

test("a transport failure produces NO observability event of its own", () => {
  const code = readFileSync("src/lib/observability/observability-transport.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // A transport failure reported through the transport is an infinite loop under
  // exactly the condition that triggers it.
  assert.equal(code.includes("report" + "ObservabilityEvent"), false,
    "the transport must never call the reporter");
  assert.equal(/console\s*\./.test(code), false, "and must not write its own console line");
});

// ── 7. The REAL reporter binding, exercised behaviourally ───────────────────
//
// Everything above tests the transport in isolation. That would still pass if
// `reportObservabilityEvent` never selected it — the wiring, which is the whole
// point of OBS-1P, would be unproven. These tests call the REAL reporter with no
// injected sink and observe which side actually received the event.
//
// Each test simulates a runtime by defining/deleting `window` and `document`,
// and restores every global in `finally` so no later test inherits a fake browser.

type Harness = {
  fetchCalls: Array<{ url: string; body: string }>;
  consoleLines: string[];
};

function withRuntime(kind: "browser" | "server", run: (h: Harness) => void): void {
  const g = globalThis as Record<string, unknown>;
  const hadWindow = "window" in g;
  const hadDocument = "document" in g;
  const savedWindow = g.window;
  const savedDocument = g.document;
  const savedFetch = g.fetch;

  const CHANNELS = ["error", "warn", "info", "log", "debug"] as const;
  const realConsole: Partial<Record<(typeof CHANNELS)[number], (...a: unknown[]) => void>> = {};

  const h: Harness = { fetchCalls: [], consoleLines: [] };

  try {
    if (kind === "browser") {
      g.window = {};
      g.document = {};
    } else {
      delete g.window;
      delete g.document;
    }

    g.fetch = ((url: string, init: { body: string }) => {
      h.fetchCalls.push({ url, body: init.body });
      return Promise.resolve();
    }) as unknown;

    for (const ch of CHANNELS) {
      realConsole[ch] = console[ch].bind(console);
      console[ch] = (...a: unknown[]) => { h.consoleLines.push(a.map(String).join(" ")); };
    }

    run(h);
  } finally {
    for (const ch of CHANNELS) { const o = realConsole[ch]; if (o) console[ch] = o; }
    if (hadWindow) g.window = savedWindow; else delete g.window;
    if (hadDocument) g.document = savedDocument; else delete g.document;
    if (savedFetch !== undefined) g.fetch = savedFetch; else delete g.fetch;
  }
}

const observabilityLines = (h: Harness) => h.consoleLines.filter((l) => l.includes("[observability]"));

test("BROWSER + valid UI event: the real reporter sends via fetch and writes no console line", () => {
  withRuntime("browser", (h) => {
    // No injected sink — the reporter must choose the transport on its own.
    reportObservabilityEvent({
      event: TRANSPORTABLE_EVENT,
      severity: "error",
      requestId: REQ,
      stage: "global-boundary",
      code: TRANSPORTABLE_CODE,
    });

    // PRECONDITION: the request really happened.
    assert.equal(h.fetchCalls.length, 1, "exactly one request reached the transport");
    assert.equal(h.fetchCalls[0].url, "/api/observability/event");

    const body = JSON.parse(h.fetchCalls[0].body) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["code", "event", "requestId", "stage"]);
    assert.deepEqual(body, {
      requestId: REQ,
      event: "uncaught-ui-error",
      stage: "global-boundary",
      code: "UNCAUGHT_UI_ERROR",
    });

    // ONLY NOW is absence meaningful: the code must not ALSO sit in the user's
    // own console, which is the dead end OBS-1P exists to escape.
    assert.equal(observabilityLines(h).length, 0, "no browser console observability line");
  });
});

test("SERVER + the same event: zero fetch calls, exactly one [observability] line", () => {
  withRuntime("server", (h) => {
    assert.equal("window" in (globalThis as Record<string, unknown>), false, "PRECONDITION: server runtime");
    assert.equal("document" in (globalThis as Record<string, unknown>), false);

    reportObservabilityEvent({
      event: TRANSPORTABLE_EVENT,
      severity: "error",
      requestId: REQ,
      stage: "global-boundary",
      code: TRANSPORTABLE_CODE,
    });

    // PRECONDITION: a record really was emitted somewhere.
    const lines = observabilityLines(h);
    assert.equal(lines.length, 1, "exactly one operational record");
    assert.ok(lines[0].includes(REQ), "carrying the searchable support code");

    // This is what stops the route from looping back into the transport.
    assert.equal(h.fetchCalls.length, 0, "the server never posts to its own endpoint");
  });
});

test("BROWSER + injected sink: the sink wins, fetch and console both see nothing", () => {
  withRuntime("browser", (h) => {
    const received: unknown[] = [];

    reportObservabilityEvent(
      {
        event: TRANSPORTABLE_EVENT,
        severity: "error",
        requestId: REQ,
        stage: "app-boundary",
        code: TRANSPORTABLE_CODE,
      },
      (e) => { received.push(e); },
    );

    // PRECONDITION: the injected sink really received a sanitized event.
    assert.equal(received.length, 1, "exactly one event reached the injected sink");
    const e = received[0] as Record<string, unknown>;
    assert.equal(e.event, "uncaught-ui-error");
    assert.equal(e.requestId, REQ);
    assert.equal(typeof e.env, "string");
    assert.equal(typeof e.release, "string");

    // An injected sink outranks the runtime default — this is what keeps every
    // committed behavioural test asserting against an array, not a network call.
    assert.equal(h.fetchCalls.length, 0, "no request was made");
    assert.equal(observabilityLines(h).length, 0, "no console line either");
  });
});

test("BROWSER + non-transportable event: falls back to the console, never the endpoint", () => {
  withRuntime("browser", (h) => {
    reportObservabilityEvent({
      event: "wizard-save",
      severity: "error",
      requestId: REQ,
      stage: "rpc",
      code: "SAVE_FAILED",
    });

    // PRECONDITION: the event was emitted somewhere.
    assert.equal(observabilityLines(h).length, 1, "the console received it");
    // A generic event must not open the public endpoint to arbitrary payloads.
    assert.equal(h.fetchCalls.length, 0, "only the one closed UI event is transportable");
  });
});

test("CANARY GUARD: the harness really does observe both channels", () => {
  // Without this, every zero-call assertion above could pass against a harness
  // that was silently capturing nothing.
  withRuntime("browser", (h) => {
    (globalThis as { fetch?: (u: string, i: { body: string }) => unknown }).fetch?.("/probe", { body: "{}" });
    console.error("[observability] probe");
    assert.equal(h.fetchCalls.length, 1, "fetch capture works");
    assert.equal(observabilityLines(h).length, 1, "console capture works");
  });
});

// ── 8. Source boundaries ────────────────────────────────────────────────────

test("fetch is the only transport, with no alternate and no configurable host", () => {
  const code = readFileSync("src/lib/observability/observability-transport.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  assert.equal(code.includes("send" + "Beacon"), false, "no beacon — it cannot set application/json");
  assert.equal(code.includes("XML" + "HttpRequest"), false);
  assert.equal(code.includes("Web" + "Socket"), false);
  assert.equal(code.includes("Image" + "("), false, "no pixel transport");
  assert.equal(/https?:\/\//.test(code), false, "no absolute URL anywhere");
  assert.equal(/process\.env/.test(code), false, "no environment-configurable endpoint");
  assert.equal(code.includes("supa" + "base"), false, "no database access");
  assert.equal(/setTimeout|setInterval|retry|backoff/i.test(code), false, "no retry machinery");
  assert.match(code, /credentials: "omit"/);
  assert.match(code, /keepalive: true/);
});
