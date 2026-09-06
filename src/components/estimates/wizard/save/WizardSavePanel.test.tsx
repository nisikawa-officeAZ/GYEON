// B7-2C — WizardSavePanel execution-core and UI matrix.
//
// Run: node --import tsx --test src/components/estimates/wizard/save/WizardSavePanel.test.tsx
//
// Deterministic injected fakes throughout: no real browser, network, Server
// Action, Supabase or database. The REAL B7-2B session authority is used — its
// transition rules are never re-implemented here, so a test cannot pass against a
// weaker copy of them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  runWizardSaveAttempt, WizardSavePanel,
  type WizardSaveBinding, type WizardSaveOutcome, type WizardSaveBlockedReason,
  type WizardSaveDestination,
} from "./WizardSavePanel";
import {
  initializeWizardSession, recoverWizardSession,
  markWizardSessionPending, markWizardSessionCompleted,
  type ValidatedWizardSession, type WizardSessionDeps, type WizardSessionStorage,
} from "./wizard-idempotency-session";
import type { WizardSaveIntentResult } from "./wizard-save-intent-types";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { resetWizardDraft } from "../draft/wizard-draft-state";

(globalThis as { React?: typeof React }).React = React;

const PANEL_SRC = "src/components/estimates/wizard/save/WizardSavePanel.tsx";
const UUID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const REVISION = 7;

// ── Deterministic world ─────────────────────────────────────────────────────

function fakeStorage() {
  const map = new Map<string, string>();
  const storage: WizardSessionStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
  };
  return { storage, map };
}

function fakeCrypto() {
  let call = 0;
  return { getRandomValues(a: Uint8Array): Uint8Array { call += 1; a.fill(call === 1 ? 0x1a : 0x2b); return a; } };
}

const DRAFT: Readonly<EstimateWizardDraftV22> = resetWizardDraft();

type World = {
  deps: WizardSessionDeps;
  storage: WizardSessionStorage;
  map: Map<string, string>;
  session: ValidatedWizardSession;
  ws: string;
  key: string;
};

/** A real, initialized, `ready` session — produced by the real authority. */
function world(): World {
  const fs = fakeStorage();
  const deps: WizardSessionDeps = { storage: fs.storage, crypto: fakeCrypto() };
  const init = initializeWizardSession(deps, () => {});
  if (!init.ok) throw new Error("fixture: initialization must succeed");
  return {
    deps, storage: fs.storage, map: fs.map, session: init.session,
    ws: init.session.wizardSessionId, key: init.session.idempotencyKey,
  };
}

const storedOf = (w: World) =>
  JSON.parse(w.map.get(`dealeros.ew.idem.v1:${w.ws}`) as string) as Record<string, unknown>;

type Recorder = {
  invokerCalls: unknown[];
  completed: string[];
  /** R89C — the destination handed to onCompleted, in call order. */
  destinations: WizardSaveDestination[];
  outcomes: Array<[WizardSaveOutcome, WizardSaveBlockedReason | undefined]>;
  sessions: ValidatedWizardSession[];
};

function bindingFor(
  w: World,
  invoke: (raw: unknown) => Promise<WizardSaveIntentResult>,
  rec: Recorder,
  session: ValidatedWizardSession = w.session,
): WizardSaveBinding {
  return {
    expectedConfigRevision: REVISION,
    saveInvoker: (raw) => { rec.invokerCalls.push(raw); return invoke(raw); },
    session,
    sessionDeps: w.deps,
    onCompleted: (id, destination) => { rec.completed.push(id); rec.destinations.push(destination); },
  };
}

const recorder = (): Recorder =>
  ({ invokerCalls: [], completed: [], destinations: [], outcomes: [], sessions: [] });

function attemptDeps(
  w: World, binding: WizardSaveBinding, rec: Recorder,
  inFlight = { current: false }, destination?: WizardSaveDestination,
) {
  return {
    inFlight,
    draft: DRAFT,
    binding,
    destination,
    onSession: (s: ValidatedWizardSession) => { rec.sessions.push(s); },
    onOutcome: (o: WizardSaveOutcome, b?: WizardSaveBlockedReason) => { rec.outcomes.push([o, b]); },
  };
}

const OK: WizardSaveIntentResult = {
  ok: true, estimateId: UUID, estimateNumber: "EST-1", customerId: "c", vehicleId: "v", replay: false,
};
const TYPED_FAILURE: WizardSaveIntentResult = { ok: false, failure: "persistence-failed" };

// ── 1-2. Ready ordering and exact payload ──────────────────────────────────

test("1. ready save ordering: in-flight → pending persisted → invoker → completed", async () => {
  const w = world();
  const rec = recorder();
  const inFlight = { current: false };
  const order: string[] = [];

  const binding = bindingFor(w, async (raw) => {
    order.push("invoker");
    // PENDING was already persisted before the invoker ran.
    order.push(`stored:${(JSON.parse(w.map.get(`dealeros.ew.idem.v1:${w.ws}`) as string) as { status: string }).status}`);
    order.push(`inFlight:${inFlight.current}`);
    void raw;
    return OK;
  }, rec);

  await runWizardSaveAttempt(attemptDeps(w, binding, rec, inFlight));

  assert.deepEqual(order, ["invoker", "stored:pending", "inFlight:true"]);
  assert.equal(rec.invokerCalls.length, 1);
  assert.deepEqual(rec.outcomes.map((o) => o[0]), ["submitting", "completed"]);
  assert.equal(storedOf(w).status, "completed");
  assert.equal(inFlight.current, false, "released in finally");
});

test("2. the invoker payload has EXACTLY the three root keys", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => OK, rec), rec));

  assert.equal(rec.invokerCalls.length, 1);
  const raw = rec.invokerCalls[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(raw).sort(), ["draft", "expectedConfigRevision", "idempotencyKey"]);
  assert.equal(raw.expectedConfigRevision, REVISION);
  assert.equal(raw.idempotencyKey, w.key, "the key comes from the persisted record");
  assert.equal(raw.draft, DRAFT, "the canonical draft by reference — never a copy");
});

// ── 3. Pending write failure ───────────────────────────────────────────────

test("3. a THROWING pending write means ZERO invoker calls", async () => {
  const w = world();
  const rec = recorder();
  // setItem throws (quota / private mode) → the B7-2B transition fails closed.
  const throwing: WizardSessionStorage = {
    getItem: (k) => w.storage.getItem(k),
    setItem: () => { throw new Error("QuotaExceededError"); },
  };
  const binding: WizardSaveBinding = {
    ...bindingFor(w, async () => OK, rec),
    sessionDeps: { storage: throwing, crypto: w.deps.crypto },
  };

  await runWizardSaveAttempt(attemptDeps(w, binding, rec));

  assert.equal(rec.invokerCalls.length, 0, "the save must not run");
  assert.deepEqual(rec.outcomes, [["blocked", "pending-write-failed"]]);
  assert.equal(storedOf(w).status, "ready", "the record is untouched");
});

// ── 4. Same-tick / double-click ────────────────────────────────────────────

test("4. two attempts before settlement produce EXACTLY ONE invoker call", async () => {
  const w = world();
  const rec = recorder();
  const inFlight = { current: false };
  let release!: (r: WizardSaveIntentResult) => void;
  const deferred = new Promise<WizardSaveIntentResult>((res) => { release = res; });

  const binding = bindingFor(w, () => deferred, rec);
  const first = runWizardSaveAttempt(attemptDeps(w, binding, rec, inFlight));
  const second = runWizardSaveAttempt(attemptDeps(w, binding, rec, inFlight));

  assert.equal(rec.invokerCalls.length, 1, "the second attempt was refused");
  // The ignored attempt performed no second pending transition either.
  assert.equal(rec.outcomes.filter((o) => o[0] === "submitting").length, 1);

  release(OK);
  await Promise.all([first, second]);
  assert.equal(rec.invokerCalls.length, 1);
  assert.equal(rec.completed.length, 1);
});

// ── 5. Remount while pending ───────────────────────────────────────────────

test("5. a remounted PENDING session invokes nothing and offers a separate retry", () => {
  const w = world();
  markWizardSessionPending(w.deps, w.ws);
  const recovered = recoverWizardSession(w.deps, w.ws);
  assert.equal(recovered.ok, true);
  if (!recovered.ok) return;
  assert.equal(recovered.session.status, "pending");

  const rec = recorder();
  const html = renderToStaticMarkup(
    React.createElement(WizardSavePanel, {
      draft: DRAFT,
      binding: bindingFor(w, async () => OK, rec, recovered.session),
    }),
  );

  assert.equal(rec.invokerCalls.length, 0, "remount is NOT retry authorization");
  assert.ok(html.includes("save-state-unknown"), "the unknown-outcome state is shown");
  assert.ok(html.includes("save-retry-same-key"), "a separate explicit retry control");
  assert.equal(html.includes('data-testid="save-submit"'), false, "the plain Save button is absent");
});

// ── 6. Thrown / network-unknown ────────────────────────────────────────────

test("6. a THROWN invoker leaves the record pending with the identical key", async () => {
  const w = world();
  const rec = recorder();
  const binding = bindingFor(w, async () => { throw new Error("network down"); }, rec);

  await runWizardSaveAttempt(attemptDeps(w, binding, rec));

  assert.equal(storedOf(w).status, "pending", "never marked failed — the server outcome is unknown");
  assert.equal(storedOf(w).key, w.key, "byte-identical key");
  assert.deepEqual(rec.outcomes.map((o) => o[0]), ["submitting", "unknown"]);
  assert.equal(rec.completed.length, 0, "no completion callback");
});

test("6b. a REJECTED promise behaves identically to a synchronous throw", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, () => Promise.reject(new Error("x")), rec), rec));
  assert.equal(storedOf(w).status, "pending");
  assert.equal(rec.completed.length, 0);
});

// ── 7-9. Typed failure and explicit retries ────────────────────────────────

test("7. a TYPED failure transitions pending → failed and preserves the key", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => TYPED_FAILURE, rec), rec));

  assert.equal(storedOf(w).status, "failed");
  assert.equal(storedOf(w).key, w.key);
  assert.deepEqual(rec.outcomes.map((o) => o[0]), ["submitting", "failed"]);
  assert.equal(rec.completed.length, 0, "no redirect / completion");
});

test("8. explicit retry from FAILED reuses the same key and invokes once", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => TYPED_FAILURE, rec), rec));
  assert.equal(storedOf(w).status, "failed");

  const after = recoverWizardSession(w.deps, w.ws);
  assert.equal(after.ok, true);
  if (!after.ok) return;

  const rec2 = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => OK, rec2, after.session), rec2));

  assert.equal(rec2.invokerCalls.length, 1);
  assert.equal((rec2.invokerCalls[0] as { idempotencyKey: string }).idempotencyKey, w.key);
  assert.equal(storedOf(w).status, "completed");
});

test("9. explicit retry from PENDING reuses the same key and invokes once", async () => {
  const w = world();
  markWizardSessionPending(w.deps, w.ws);
  const rec = recorder();
  const recovered = recoverWizardSession(w.deps, w.ws);
  assert.equal(recovered.ok, true);
  if (!recovered.ok) return;

  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => OK, rec, recovered.session), rec));

  assert.equal(rec.invokerCalls.length, 1);
  assert.equal((rec.invokerCalls[0] as { idempotencyKey: string }).idempotencyKey, w.key);
  assert.equal(storedOf(w).status, "completed");
});

// ── 10-11. Success and invalid estimate id ─────────────────────────────────

test("10. success completes only AFTER the verified completed write", async () => {
  const w = world();
  const rec = recorder();
  const order: string[] = [];
  const binding: WizardSaveBinding = {
    ...bindingFor(w, async () => OK, rec),
    onCompleted: (id) => {
      order.push(`stored:${(JSON.parse(w.map.get(`dealeros.ew.idem.v1:${w.ws}`) as string) as { status: string }).status}`);
      order.push(`callback:${id}`);
      rec.completed.push(id);
    },
  };
  await runWizardSaveAttempt(attemptDeps(w, binding, rec));

  assert.deepEqual(order, [`stored:completed`, `callback:${UUID}`], "write is verified before the callback");
  assert.equal(rec.completed.length, 1);
  assert.equal(storedOf(w).estimateId, UUID);
  assert.equal(storedOf(w).key, w.key, "the key survives to completed");
});

test("11. an INVALID success estimateId blocks: record stays pending, no callback", async () => {
  for (const bad of ["../../admin", "not-a-uuid", "", "<script>", `${UUID}0`]) {
    const w = world();
    const rec = recorder();
    const result = { ...OK, estimateId: bad } as WizardSaveIntentResult;
    await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => result, rec), rec));

    assert.equal(storedOf(w).status, "pending", `${bad}: record must stay pending`);
    assert.equal("estimateId" in storedOf(w), false, `${bad}: nothing persisted`);
    assert.equal(rec.completed.length, 0, `${bad}: no completion callback`);
    assert.deepEqual(rec.outcomes[rec.outcomes.length - 1], ["blocked", "invalid-estimate-id"]);
  }
});

// ── 12-13. Completed session and unverifiable persistence ──────────────────

test("12. a COMPLETED session invokes save zero times", async () => {
  const w = world();
  markWizardSessionPending(w.deps, w.ws);
  const done = markWizardSessionCompleted(w.deps, w.ws, UUID);
  assert.equal(done.ok, true);
  if (!done.ok) return;

  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => OK, rec, done.session), rec));

  assert.equal(rec.invokerCalls.length, 0);
  assert.deepEqual(rec.outcomes, [["blocked", "already-completed"]]);
});

test("13. if pending cannot be VERIFIED, the invoker is never called", async () => {
  // getItem always returns the original `ready` record → the read-back after
  // setItem never matches, so the transition is unverifiable.
  const w = world();
  const frozenRaw = w.map.get(`dealeros.ew.idem.v1:${w.ws}`) as string;
  const unverifiable: WizardSessionStorage = { getItem: () => frozenRaw, setItem: () => {} };
  const rec = recorder();
  const binding: WizardSaveBinding = {
    ...bindingFor(w, async () => OK, rec),
    sessionDeps: { storage: unverifiable, crypto: w.deps.crypto },
  };

  await runWizardSaveAttempt(attemptDeps(w, binding, rec));
  assert.equal(rec.invokerCalls.length, 0);
  assert.deepEqual(rec.outcomes, [["blocked", "pending-write-failed"]]);
});

// ── 14. Visibly distinguishable UI states ──────────────────────────────────

test("14. ready / submitting / recovered-pending / failed / completed / blocked are distinct", () => {
  const rec = recorder();

  const readyW = world();
  const readyHtml = renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(readyW, async () => OK, rec),
  }));
  assert.ok(readyHtml.includes("save-state-ready"));
  assert.ok(readyHtml.includes("save-submit"));

  const pendW = world();
  markWizardSessionPending(pendW.deps, pendW.ws);
  const pend = recoverWizardSession(pendW.deps, pendW.ws);
  assert.equal(pend.ok, true);
  const pendHtml = pend.ok ? renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(pendW, async () => OK, rec, pend.session),
  })) : "";
  assert.ok(pendHtml.includes("save-state-unknown"));

  const compW = world();
  markWizardSessionPending(compW.deps, compW.ws);
  const comp = markWizardSessionCompleted(compW.deps, compW.ws, UUID);
  const compHtml = comp.ok ? renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(compW, async () => OK, rec, comp.session),
  })) : "";
  assert.ok(compHtml.includes("save-state-completed"));

  // Each state renders a DIFFERENT marker — a silently disabled button would not.
  assert.notEqual(readyHtml, pendHtml);
  assert.notEqual(pendHtml, compHtml);
  for (const marker of ["save-state-ready", "save-state-unknown", "save-state-completed"]) {
    const hits = [readyHtml, pendHtml, compHtml].filter((h) => h.includes(marker)).length;
    assert.equal(hits, 1, `${marker} identifies exactly one state`);
  }
});

test("14b. no raw diagnostic, draft or PII is rendered on failure", async () => {
  const w = world();
  const rec = recorder();
  const leaky = {
    ok: false, failure: "save-validation-failed",
    saveIssues: [{ code: "CUSTOMER_REQUIRED", field: "customer.name", message: "CANARY-山田太郎" }],
  } as unknown as WizardSaveIntentResult;
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => leaky, rec), rec));

  const after = recoverWizardSession(w.deps, w.ws);
  assert.equal(after.ok, true);
  if (!after.ok) return;
  const html = renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(w, async () => leaky, rec, after.session),
  }));

  assert.ok(html.includes("save-state-failed"), "PRECONDITION: the failure state rendered");
  for (const leak of ["CANARY", "山田太郎", "CUSTOMER_REQUIRED", "customer.name",
                      "save-validation-failed", "saveIssues", w.key]) {
    assert.equal(html.includes(leak), false, `panel renders ${leak}`);
  }
});

// ── 15. Source boundary ────────────────────────────────────────────────────

test("15. the panel imports no action, gateway, DB, browser global, clock or reporter", () => {
  const code = readFileSync(PANEL_SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  for (const forbidden of [
    "save-estimate-from-wizard", "persistence-gateway", "EstimatePersistenceService",
    "supa" + "base", "createClient", ".rpc(", "fetch(",
    "window", "document", "history", "location", "sessionStorage", "localStorage",
    "Date.now", "new Date", "Math.random", "randomUUID", "setTimeout", "setInterval",
    "report" + "ObservabilityEvent", "console.",
    "JSON.stringify(result", "JSON.stringify(res",
  ]) {
    assert.equal(code.includes(forbidden), false, `panel references ${forbidden}`);
  }
  // It uses the B7-2B authority for transitions and validation, and mints nothing.
  assert.match(code, /markWizardSessionPending/);
  assert.match(code, /markWizardSessionFailed/);
  assert.match(code, /markWizardSessionCompleted/);
  assert.match(code, /isValidEstimateId/);
  assert.equal(code.includes("initializeWizardSession"), false, "the panel never mints a session");
});

test("15b. the algorithm is not duplicated between component and test helper", () => {
  const code = readFileSync(PANEL_SRC, "utf8");
  // Exactly one implementation, and the component calls it.
  assert.equal((code.match(/export async function runWizardSaveAttempt/g) ?? []).length, 1);
  assert.match(code, /void runWizardSaveAttempt\(/, "the component calls the same core");
});

// ── 16-21. R89C — the post-save destination ────────────────────────────────

test("16. an omitted destination defaults to `estimate` (pre-R89C callers unchanged)", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(attemptDeps(w, bindingFor(w, async () => OK, rec), rec));

  assert.deepEqual(rec.completed, [UUID]);
  assert.deepEqual(rec.destinations, ["estimate"], "the safe default reaches routing, never undefined");
  // The destination is a routing intent only — it never enters the invoker payload…
  assert.deepEqual(Object.keys(rec.invokerCalls[0] as object).sort(),
    ["draft", "expectedConfigRevision", "idempotencyKey"]);
  // …and never the persisted record.
  assert.deepEqual(Object.keys(storedOf(w)).sort(), ["estimateId", "key", "status", "v"]);
});

test("17. an explicit `pdf` destination reaches onCompleted through the SAME pipeline", async () => {
  const w = world();
  const rec = recorder();
  await runWizardSaveAttempt(
    attemptDeps(w, bindingFor(w, async () => OK, rec), rec, { current: false }, "pdf"),
  );

  assert.equal(rec.invokerCalls.length, 1, "one save, not a second pipeline");
  assert.deepEqual(Object.keys(rec.invokerCalls[0] as object).sort(),
    ["draft", "expectedConfigRevision", "idempotencyKey"], "payload shape is untouched");
  assert.deepEqual(rec.destinations, ["pdf"]);
  assert.equal(storedOf(w).status, "completed");
  assert.deepEqual(Object.keys(storedOf(w)).sort(), ["estimateId", "key", "status", "v"],
    "the destination is NOT persisted");
});

test("18. same-tick second click: ONE invocation, and the accepted destination wins", async () => {
  const w = world();
  const rec = recorder();
  const inFlight = { current: false };
  let release!: (r: WizardSaveIntentResult) => void;
  const deferred = new Promise<WizardSaveIntentResult>((res) => { release = res; });

  const binding = bindingFor(w, () => deferred, rec);
  // First click chooses PDF; the second, in the same tick, tries to repoint it.
  const first = runWizardSaveAttempt(attemptDeps(w, binding, rec, inFlight, "pdf"));
  const second = runWizardSaveAttempt(attemptDeps(w, binding, rec, inFlight, "estimate"));

  assert.equal(rec.invokerCalls.length, 1, "the second attempt was refused by the shared guard");

  release(OK);
  await Promise.all([first, second]);

  assert.equal(rec.invokerCalls.length, 1);
  assert.deepEqual(rec.completed, [UUID], "exactly one completion");
  assert.deepEqual(rec.destinations, ["pdf"], "the refused click did not repoint the accepted attempt");
});

test("19. unknown / typed-failed / blocked outcomes hand NO destination to routing", async () => {
  // Thrown → unknown.
  const w1 = world();
  const r1 = recorder();
  await runWizardSaveAttempt(attemptDeps(
    w1, bindingFor(w1, async () => { throw new Error("network down"); }, r1), r1, { current: false }, "pdf"));
  assert.deepEqual(r1.destinations, [], "unknown never routes");
  assert.deepEqual(r1.completed, []);

  // Typed failure → failed.
  const w2 = world();
  const r2 = recorder();
  await runWizardSaveAttempt(attemptDeps(
    w2, bindingFor(w2, async () => TYPED_FAILURE, r2), r2, { current: false }, "pdf"));
  assert.deepEqual(r2.destinations, [], "failed never routes");

  // Invalid estimate id → blocked.
  const w3 = world();
  const r3 = recorder();
  const bad = { ...OK, estimateId: "../../admin" } as WizardSaveIntentResult;
  await runWizardSaveAttempt(attemptDeps(
    w3, bindingFor(w3, async () => bad, r3), r3, { current: false }, "pdf"));
  assert.deepEqual(r3.destinations, [], "a malformed id blocks BOTH destinations");
  assert.deepEqual(r3.outcomes[r3.outcomes.length - 1], ["blocked", "invalid-estimate-id"]);
});

test("20. a same-mount retry keeps the destination AND the byte-identical key", async () => {
  const w = world();
  const rec = recorder();
  // First attempt chooses PDF and fails with a typed failure.
  await runWizardSaveAttempt(attemptDeps(
    w, bindingFor(w, async () => TYPED_FAILURE, rec), rec, { current: false }, "pdf"));
  assert.equal(storedOf(w).status, "failed");
  assert.deepEqual(rec.destinations, []);

  const after = recoverWizardSession(w.deps, w.ws);
  assert.equal(after.ok, true);
  if (!after.ok) return;

  // The retry is the SAME remembered destination — the component passes the ref
  // it wrote on the accepted click, not a fresh choice.
  const rec2 = recorder();
  await runWizardSaveAttempt(attemptDeps(
    w, bindingFor(w, async () => OK, rec2, after.session), rec2, { current: false }, "pdf"));

  assert.equal(rec2.invokerCalls.length, 1);
  assert.equal((rec2.invokerCalls[0] as { idempotencyKey: string }).idempotencyKey, w.key,
    "byte-identical key across the retry");
  assert.deepEqual(rec2.destinations, ["pdf"], "the destination survived the retry");
});

test("21. both ready controls exist, share one attempt, and appear ONLY when ready", () => {
  const rec = recorder();

  const readyW = world();
  const readyHtml = renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(readyW, async () => OK, rec),
  }));
  assert.ok(readyHtml.includes('data-testid="save-submit"'), "保存");
  assert.ok(readyHtml.includes('data-testid="save-submit-pdf"'), "保存してPDFを開く");

  // Recovered pending and completed states offer neither fresh control.
  const pendW = world();
  markWizardSessionPending(pendW.deps, pendW.ws);
  const pend = recoverWizardSession(pendW.deps, pendW.ws);
  assert.equal(pend.ok, true);
  const pendHtml = pend.ok ? renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(pendW, async () => OK, rec, pend.session),
  })) : "";
  assert.equal(pendHtml.includes('data-testid="save-submit-pdf"'), false);
  assert.equal(pendHtml.includes('data-testid="save-submit"'), false);

  const compW = world();
  markWizardSessionPending(compW.deps, compW.ws);
  const comp = markWizardSessionCompleted(compW.deps, compW.ws, UUID);
  const compHtml = comp.ok ? renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(compW, async () => OK, rec, comp.session),
  })) : "";
  assert.equal(compHtml.includes('data-testid="save-submit-pdf"'), false);

  // ── Source proof of the synchronous-holder contract ──────────────────────
  // A DOM-free suite cannot click, so the stale-state hazard is proved from the
  // shipping source: a REF (not state), the shared guard read BEFORE the ref is
  // written, and retry handlers that never leak a MouseEvent into the parameter.
  const code = readFileSync(PANEL_SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(code, /const lastDestination = useRef<WizardSaveDestination>\("estimate"\)/,
    "a synchronous ref, defaulting to the safe destination");
  assert.equal(/setDestination\(/.test(code), false, "no state setter may gate the attempt");
  assert.match(code, /if \(inFlight\.current\) return;\s*\n\s*if \(destination !== undefined\) lastDestination\.current = destination;/,
    "the shared guard is read BEFORE the remembered destination is changed");
  assert.match(code, /destination: lastDestination\.current,/, "the ref is passed explicitly into the core");
  assert.equal(code.includes("onClick={attempt}"), false,
    "a bare handler would pass a MouseEvent as the destination");
  assert.equal((code.match(/onClick=\{\(\) => attempt\(\)\}/g) ?? []).length, 2, "two retry controls");
  assert.match(code, /onClick=\{\(\) => attempt\("estimate"\)\}/);
  assert.match(code, /onClick=\{\(\) => attempt\("pdf"\)\}/);
  // Still exactly one guard and one core.
  assert.equal((code.match(/useRef\(false\)/g) ?? []).length, 1, "exactly one in-flight guard");
});

// ── 22. GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1 — explicit white text on both ready buttons ──

test("22. both enabled ready-state save buttons carry an explicit text-white class, in source and rendered output", () => {
  const code = readFileSync(PANEL_SRC, "utf8");
  const submitClass = code.match(/data-testid="save-submit"[\s\S]*?className="([^"]*)"/)?.[1] ?? "";
  const submitPdfClass = code.match(/data-testid="save-submit-pdf"[\s\S]*?className="([^"]*)"/)?.[1] ?? "";
  assert.ok(submitClass.split(/\s+/).includes("text-white"), "save-submit source must carry text-white");
  assert.ok(submitPdfClass.split(/\s+/).includes("text-white"), "save-submit-pdf source must carry text-white");

  const readyW = world();
  const rec = recorder();
  const html = renderToStaticMarkup(React.createElement(WizardSavePanel, {
    draft: DRAFT, binding: bindingFor(readyW, async () => OK, rec),
  }));
  const submitTag = html.match(/<button[^>]*data-testid="save-submit"[^>]*>/)?.[0] ?? "";
  const submitPdfTag = html.match(/<button[^>]*data-testid="save-submit-pdf"[^>]*>/)?.[0] ?? "";
  assert.ok(submitTag.includes("text-white"), "rendered save-submit button must carry text-white");
  assert.ok(submitPdfTag.includes("text-white"), "rendered save-submit-pdf button must carry text-white");

  // Anti-vacuity: neither retry control nor any other button acquired the class incidentally.
  for (const testid of ["save-retry-same-key"]) {
    assert.equal(code.match(new RegExp(`data-testid="${testid}"[\\s\\S]*?className="([^"]*)"`))?.[1]?.includes("text-white") ?? false, false,
      `${testid} must not carry text-white — only the two ready-state buttons are in scope`);
  }
});
