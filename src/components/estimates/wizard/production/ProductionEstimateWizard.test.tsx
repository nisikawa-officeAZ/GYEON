// B7-2C — ProductionEstimateWizard bootstrap, URL, one-shot and boundary matrix.
//
// Run: node --import tsx --test src/components/estimates/wizard/production/ProductionEstimateWizard.test.tsx
//
// The classifier, the bootstrap decision, the one-shot guard, the navigation seam
// and the URL helpers are pure and injected, so every lifecycle branch — fresh
// mount, reload, copied URL, hostile `ws`, second tab, corrupt record, unavailable
// storage or crypto, Strict-Mode replay, double-clicked start-new, completed
// redirect, failed redirect — is proved by calling the SHIPPING functions. No DOM,
// no router, no network, no Server Action, no database.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ProductionEstimateWizard, {
  WIZARD_SESSION_QUERY_KEY,
  classifyWizardSessionQuery, buildWizardSessionUrl, buildEstimatePath,
  buildEstimatePdfPath, buildPostSavePath,
  decideWizardBootstrap, runOnce, navigateToEstimate,
  type ProductionEstimateWizardProps, type RunOnceGuard, type NavigationSeam,
} from "./ProductionEstimateWizard";
import {
  initializeWizardSession, markWizardSessionPending, markWizardSessionFailed,
  markWizardSessionCompleted,
  type WizardSessionDeps, type WizardSessionStorage,
} from "../save/wizard-idempotency-session";
import type { WizardSaveIntentResult } from "../save/wizard-save-intent-types";
import type { WizardScreenConfiguration } from "../contract/wizard-runtime-inputs";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";

(globalThis as { React?: typeof React }).React = React;

const WRAPPER_SRC = "src/components/estimates/wizard/production/ProductionEstimateWizard.tsx";

/** Comment-stripped source, so documentation may name a hazard the code must not use. */
const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const UUID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const VALID_WS = "ws.0123456789abcdef0123456789abcdef";

// ── A fully COUNTED world ───────────────────────────────────────────────────
//
// Every dependency counts its own use, so "reached nothing" is an observed zero
// rather than an inference from a passing branch.

type Counted = {
  deps: WizardSessionDeps;
  storage: WizardSessionStorage;
  map: Map<string, string>;
  counts: { reads: number; writes: number; crypto: number; replaced: number };
  replaceUrl: (ws: string) => void;
  replacedWith: string[];
};

function countedWorld(): Counted {
  const map = new Map<string, string>();
  const counts = { reads: 0, writes: 0, crypto: 0, replaced: 0 };
  const replacedWith: string[] = [];
  const storage: WizardSessionStorage = {
    getItem: (k) => { counts.reads += 1; return map.get(k) ?? null; },
    setItem: (k, v) => { counts.writes += 1; map.set(k, v); },
  };
  let n = 0;
  const crypto = {
    getRandomValues(a: Uint8Array): Uint8Array { counts.crypto += 1; n += 1; a.fill(0x10 + n); return a; },
  };
  const replaceUrl = (ws: string) => { counts.replaced += 1; replacedWith.push(ws); };
  return { deps: { storage, crypto }, storage, map, counts, replaceUrl, replacedWith };
}

/** A counted world that already holds one persisted `ready` session. */
function seededWorld() {
  const w = countedWorld();
  const init = initializeWizardSession(w.deps, w.replaceUrl);
  if (!init.ok) throw new Error("fixture: initialization must succeed");
  w.counts.reads = 0; w.counts.writes = 0; w.counts.crypto = 0; w.counts.replaced = 0;
  return { ...w, ws: init.session.wizardSessionId, key: init.session.idempotencyKey };
}

const ABSENT = { kind: "absent" } as const;
const INVALID = { kind: "invalid" } as const;
const valid = (wizardSessionId: string) => ({ kind: "valid", wizardSessionId }) as const;

// ── 1-4. The absent / valid / invalid classifier ────────────────────────────

test("1. the query key is exactly `ws`", () => {
  assert.equal(WIZARD_SESSION_QUERY_KEY, "ws");
});

test("2. ABSENT, VALID and INVALID are three DISTINCT results", () => {
  // The whole defect this replaces was these three collapsing into `string | null`.
  assert.deepEqual(classifyWizardSessionQuery(""), { kind: "absent" });
  assert.deepEqual(classifyWizardSessionQuery("?"), { kind: "absent" });
  assert.deepEqual(classifyWizardSessionQuery("?other=1"), { kind: "absent" });
  assert.deepEqual(classifyWizardSessionQuery(`?ws=${VALID_WS}`), { kind: "valid", wizardSessionId: VALID_WS });
  assert.deepEqual(classifyWizardSessionQuery(`ws=${VALID_WS}`), { kind: "valid", wizardSessionId: VALID_WS });
  assert.deepEqual(classifyWizardSessionQuery("?ws="), { kind: "invalid" },
    "an EMPTY ws is present-and-invalid, never absent");
  assert.deepEqual(classifyWizardSessionQuery("?ws=nonsense"), { kind: "invalid" });
});

test("3. a valid ws is read alongside the onboarding handoff parameters", () => {
  assert.deepEqual(classifyWizardSessionQuery(`?customer_id=c&ws=${VALID_WS}&vehicle_id=v`),
    { kind: "valid", wizardSessionId: VALID_WS });
});

/** Every present-but-invalid form. Reused by the zero-reach proof below. */
const HOSTILE_WS = [
  "", " ", "ws.", "ws", "nonsense",
  "ws.1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A",          // uppercase hex
  "ws.0123456789abcdef0123456789abcde",            // 31 hex
  "ws.0123456789abcdef0123456789abcdef0",          // 33 hex
  "ws.0123456789abcdef0123456789abcdez",           // non-hex
  `${VALID_WS} `, ` ${VALID_WS}`, `${VALID_WS}\n`,
  "../../etc/passwd", "<script>alert(1)</script>",
  `${VALID_WS}/../../admin`, "ws.0123456789abcdef0123456789abcdef%00",
];

test("4. every present-but-malformed or hostile ws classifies INVALID, never absent", () => {
  for (const bad of HOSTILE_WS) {
    assert.deepEqual(classifyWizardSessionQuery(`?ws=${encodeURIComponent(bad)}`), { kind: "invalid" },
      `misclassified ${JSON.stringify(bad)}`);
  }
  assert.equal(classifyWizardSessionQuery.length, 1, "one parameter: a search string — no storage, no crypto");
});

// ── 5. Present-invalid ws reaches NOTHING ───────────────────────────────────

test("5. an INVALID ws blocks and reaches zero storage, crypto, init and URL work", () => {
  for (const bad of HOSTILE_WS) {
    const w = countedWorld();
    const before = w.map.size;

    const d = decideWizardBootstrap(w.deps, classifyWizardSessionQuery(`?ws=${encodeURIComponent(bad)}`), w.replaceUrl);

    assert.equal(d.kind, "blocked", `${JSON.stringify(bad)} was not blocked`);
    if (d.kind === "blocked") assert.equal(d.reason, "invalid-session-id", JSON.stringify(bad));
    assert.equal(w.counts.reads, 0, `${JSON.stringify(bad)}: storage was read`);
    assert.equal(w.counts.writes, 0, `${JSON.stringify(bad)}: storage was written`);
    assert.equal(w.counts.crypto, 0, `${JSON.stringify(bad)}: crypto was called`);
    assert.equal(w.counts.replaced, 0, `${JSON.stringify(bad)}: the URL was rewritten`);
    assert.equal(w.map.size, before, `${JSON.stringify(bad)}: a record was minted`);
  }
});

test("5b. ANTI-VACUITY: the same counted world does record activity on the absent branch", () => {
  // Without this, every zero above could mean the counters were simply never wired.
  const w = countedWorld();
  decideWizardBootstrap(w.deps, ABSENT, w.replaceUrl);
  assert.ok(w.counts.crypto > 0 && w.counts.writes > 0 && w.counts.reads > 0 && w.counts.replaced > 0,
    "the counters are live");
});

test("5c. an invalid ws is LEFT in the URL, not silently rewritten", () => {
  const w = countedWorld();
  decideWizardBootstrap(w.deps, INVALID, w.replaceUrl);
  assert.deepEqual(w.replacedWith, [], "rewriting would destroy the evidence of how this happened");
});

// ── 6-8. URL construction ───────────────────────────────────────────────────

test("6. stamping ws PRESERVES every other query parameter and the hash", () => {
  const out = buildWizardSessionUrl("/estimates/new?customer_id=c-1&vehicle_id=v-2#step4", VALID_WS);
  const q = new URLSearchParams(out.slice(out.indexOf("?") + 1, out.indexOf("#")));
  assert.equal(q.get("customer_id"), "c-1", "preselection survives");
  assert.equal(q.get("vehicle_id"), "v-2");
  assert.equal(q.get("ws"), VALID_WS);
  assert.ok(out.startsWith("/estimates/new?"));
  assert.ok(out.endsWith("#step4"), "the hash survives");
});

test("7. stamping ws twice REPLACES rather than appends", () => {
  const first = buildWizardSessionUrl("/estimates/new", "ws.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const second = buildWizardSessionUrl(first, "ws.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  assert.equal((second.match(/ws=/g) ?? []).length, 1);
  assert.equal(new URLSearchParams(second.slice(second.indexOf("?") + 1)).get("ws"),
    "ws.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
});

test("8. the idempotency KEY never enters the URL — only the authority-free ws", () => {
  const w = countedWorld();
  const d = decideWizardBootstrap(w.deps, ABSENT, w.replaceUrl);
  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  const url = buildWizardSessionUrl("/estimates/new?customer_id=c", w.replacedWith[0] as string);
  assert.equal(url.includes(d.session.idempotencyKey), false, "a shared link cannot carry save identity");
  assert.ok(url.includes(d.session.wizardSessionId));
});

// ── 9. The estimate path ────────────────────────────────────────────────────

test("9. the estimate path is built ONLY from a validated uuid, and is encoded", () => {
  assert.equal(buildEstimatePath(UUID), `/estimates/${UUID}`);
  for (const bad of [
    "", "not-a-uuid", `${UUID}0`, "../../admin", "..%2Fadmin",
    `${UUID}/../../admin`, null, undefined, 7, {}, [], `${UUID}\n`,
  ]) {
    assert.equal(buildEstimatePath(bad), null, `accepted ${String(bad)}`);
  }
});

// ── 10-14. ABSENT ws: the only minting branch ───────────────────────────────

test("10. absent ws → ONE ready session, persisted, URL replaced after persistence", () => {
  const w = countedWorld();
  const d = decideWizardBootstrap(w.deps, ABSENT, w.replaceUrl);

  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.equal(d.session.status, "ready");
  assert.equal(w.map.size, 1, "exactly one stored session");
  assert.ok(w.map.has(`dealeros.ew.idem.v1:${d.session.wizardSessionId}`));
  assert.deepEqual(w.replacedWith, [d.session.wizardSessionId], "replaced exactly once");
  assert.equal(w.counts.replaced, 1);
});

test("11. absent ws + UNAVAILABLE storage → blocked, nothing persisted, no URL change", () => {
  const replaced: string[] = [];
  for (const storage of [null, undefined, {} as unknown as WizardSessionStorage]) {
    const d = decideWizardBootstrap(
      { storage, crypto: countedWorld().deps.crypto }, ABSENT, (ws) => { replaced.push(ws); });
    assert.equal(d.kind, "blocked");
    if (d.kind === "blocked") assert.equal(d.reason, "persist-failed");
  }
  assert.deepEqual(replaced, [], "the URL is never stamped without a durable record");
});

test("12. absent ws + UNAVAILABLE crypto → blocked, and nothing is written", () => {
  const w = countedWorld();
  for (const crypto of [null, undefined, { getRandomValues: () => { throw new Error("blocked"); } }]) {
    const d = decideWizardBootstrap({ storage: w.storage, crypto }, ABSENT, w.replaceUrl);
    assert.equal(d.kind, "blocked");
    if (d.kind === "blocked") assert.equal(d.reason, "crypto-unavailable");
  }
  assert.equal(w.map.size, 0, "no record — a predictable key is never substituted");
  assert.equal(w.counts.replaced, 0);
});

test("13. a no-op storage (the write only APPEARS to succeed) still blocks", () => {
  const noop: WizardSessionStorage = { getItem: () => null, setItem: () => {} };
  const d = decideWizardBootstrap({ storage: noop, crypto: countedWorld().deps.crypto }, ABSENT, () => {});
  assert.equal(d.kind, "blocked");
  if (d.kind === "blocked") assert.equal(d.reason, "persist-failed", "read-back verification catches it");
});

test("14. a THROWING url replacer does not yield an active session", () => {
  const w = countedWorld();
  const d = decideWizardBootstrap(w.deps, ABSENT, () => { throw new Error("history blocked"); });
  assert.equal(d.kind, "blocked");
  if (d.kind === "blocked") assert.equal(d.reason, "persist-failed");
});

// ── 15-20. VALID ws: recovery only, never minting ───────────────────────────

const NEVER_REPLACE = () => { throw new Error("a valid ws must never replace the URL"); };

test("15. valid READY recovery: same ws, same key, active, mints nothing", () => {
  const w = seededWorld();
  const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);

  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.equal(d.session.wizardSessionId, w.ws);
  assert.equal(d.session.idempotencyKey, w.key, "byte-identical key across reload");
  assert.equal(d.session.status, "ready");
  assert.equal(w.map.size, 1, "no second record");
  assert.equal(w.counts.writes, 0, "recovery writes nothing");
  assert.equal(w.counts.replaced, 0);
});

test("16. valid PENDING recovery: same ws, same key, active, nothing runs automatically", () => {
  const w = seededWorld();
  markWizardSessionPending(w.deps, w.ws);
  const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);

  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.equal(d.session.status, "pending");
  assert.equal(d.session.wizardSessionId, w.ws);
  assert.equal(d.session.idempotencyKey, w.key);
});

test("17. valid FAILED recovery: same ws, same key, active", () => {
  const w = seededWorld();
  markWizardSessionPending(w.deps, w.ws);
  markWizardSessionFailed(w.deps, w.ws);
  const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);

  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.equal(d.session.status, "failed");
  assert.equal(d.session.wizardSessionId, w.ws);
  assert.equal(d.session.idempotencyKey, w.key);
});

test("18. recovery CANNOT invoke a save — the decision receives no invoker at all", () => {
  // Structural, not observational: `decideWizardBootstrap(deps, query, replaceUrl)`
  // has no parameter through which a saver could arrive, so no recovered status —
  // ready, pending or failed — can auto-submit. There is nothing to submit with.
  assert.equal(decideWizardBootstrap.length, 3, "exactly three parameters, none of them a saver");

  const w = seededWorld();
  for (const advance of [() => {}, () => markWizardSessionPending(w.deps, w.ws),
                         () => markWizardSessionFailed(w.deps, w.ws)]) {
    advance();
    const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);
    assert.equal(d.kind, "active");
    // The decision carries a session and nothing executable.
    if (d.kind === "active") assert.deepEqual(Object.keys(d).sort(), ["kind", "session"]);
  }
  assert.equal(w.map.size, 1, "and still exactly one session throughout");
});

test("19. COPIED URL / second tab: valid ws, no record → missing-session, mints NOTHING", () => {
  const w = countedWorld();
  const d = decideWizardBootstrap(w.deps, valid(VALID_WS), NEVER_REPLACE);

  assert.equal(d.kind, "missing-session");
  assert.equal(w.map.size, 0, "a copied URL can never produce a second key");
  assert.equal(w.counts.writes, 0);
  assert.equal(w.counts.replaced, 0);
});

test("20. a CORRUPT record is a hard stop, never a silent re-mint", () => {
  const corrupt = [
    "not json", "[]", "null", "{}", '{"v":2,"key":"aaaaaaaaaaaaaaaa","status":"ready"}',
    '{"v":1,"key":"short","status":"ready"}',
    '{"v":1,"key":"aaaaaaaaaaaaaaaa","status":"bogus"}',
    '{"v":1,"key":"aaaaaaaaaaaaaaaa","status":"ready","extra":1}',
    '{"v":1,"key":"aaaaaaaaaaaaaaaa","status":"completed"}',
    '{"v":1,"key":"aaaaaaaaaaaaaaaa","status":"completed","estimateId":"../../admin"}',
  ];
  for (const raw of corrupt) {
    const w = countedWorld();
    w.map.set(`dealeros.ew.idem.v1:${VALID_WS}`, raw);
    const d = decideWizardBootstrap(w.deps, valid(VALID_WS), NEVER_REPLACE);
    assert.equal(d.kind, "blocked", `not blocked for ${raw}`);
    if (d.kind === "blocked") assert.equal(d.reason, "corrupt-record", raw);
    assert.equal(w.map.get(`dealeros.ew.idem.v1:${VALID_WS}`), raw, "the corrupt record is not overwritten");
    assert.equal(w.counts.writes, 0);
  }
});

test("21. a THROWING storage read → blocked storage-unavailable, no replacement session", () => {
  const throwing: WizardSessionStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };
  const replaced: string[] = [];
  const d = decideWizardBootstrap({ storage: throwing, crypto: countedWorld().deps.crypto },
    valid(VALID_WS), (ws) => { replaced.push(ws); });
  assert.equal(d.kind, "blocked");
  if (d.kind === "blocked") assert.equal(d.reason, "storage-unavailable");
  assert.deepEqual(replaced, []);
});

// ── 22-23. COMPLETED is redirect-only ───────────────────────────────────────

test("22. a COMPLETED record redirects and NEVER becomes active", () => {
  const w = seededWorld();
  markWizardSessionPending(w.deps, w.ws);
  assert.equal(markWizardSessionCompleted(w.deps, w.ws, UUID).ok, true,
    "PRECONDITION: the completion was recorded");

  const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);
  assert.equal(d.kind, "completed");
  assert.notEqual(d.kind, "active", "a completed session must not mount an editable wizard");
  if (d.kind === "completed") assert.equal(d.estimateId, UUID);
});

test("23. only a validated id can navigate; an invalid one navigates ZERO times", () => {
  const seen: string[] = [];
  const spy: NavigationSeam = (p) => { seen.push(p); };

  assert.deepEqual(navigateToEstimate(spy, UUID), { kind: "navigated", path: `/estimates/${UUID}` });
  assert.deepEqual(seen, [`/estimates/${UUID}`], "exactly one navigation");

  for (const bad of ["", "../../admin", `${UUID}0`, null, undefined, 7, `${UUID}\n`]) {
    assert.deepEqual(navigateToEstimate(spy, bad), { kind: "invalid-estimate-id" }, String(bad));
  }
  assert.equal(seen.length, 1, "no raw invalid value ever became a URL");
});

test("24. a THROWING navigator yields redirect-failed rather than a silent hang", () => {
  const outcome = navigateToEstimate(() => { throw new Error("navigation blocked"); }, UUID);
  assert.deepEqual(outcome, { kind: "redirect-failed" });
});

// ── 25-27. The one-shot guard ───────────────────────────────────────────────

test("25. runOnce executes the operation EXACTLY once per guard", () => {
  const guard: RunOnceGuard = { current: false };
  let runs = 0;
  assert.equal(runOnce(guard, () => { runs += 1; }), true);
  assert.equal(runOnce(guard, () => { runs += 1; }), false);
  assert.equal(runOnce(guard, () => { runs += 1; }), false);
  assert.equal(runs, 1);
});

test("26. STRICT-MODE REPLAY: the shipping helper called twice with one guard bootstraps once", () => {
  // This models React 19's development effect replay by doing exactly what the
  // effect does — calling the same shipping `runOnce` with the same ref cell.
  const w = countedWorld();
  const guard: RunOnceGuard = { current: false };
  let bootstrapCallbacks = 0;
  const bootstrap = () => {
    bootstrapCallbacks += 1;
    decideWizardBootstrap(w.deps, ABSENT, w.replaceUrl);
  };

  runOnce(guard, bootstrap);
  runOnce(guard, bootstrap);          // the replay

  assert.equal(bootstrapCallbacks, 1, "bootstrap callback count");
  assert.equal(w.counts.replaced, 1, "URL replacement count");
  assert.equal(w.map.size, 1, "one stored session only");
  assert.deepEqual([...w.map.keys()].length, 1);
  // Initialization count: exactly two crypto draws (one session id, one key).
  assert.equal(w.counts.crypto, 2, "a single initialization");
});

test("27. DOUBLE-CLICKED start-new: two same-tick calls, one initialization", () => {
  const w = countedWorld();
  const guard: RunOnceGuard = { current: false };
  let attempts = 0;
  const startNew = () => {
    attempts += 1;
    initializeWizardSession(w.deps, w.replaceUrl);
  };

  runOnce(guard, startNew);
  runOnce(guard, startNew);

  assert.equal(attempts, 1, "exactly one initialization attempt");
  assert.equal(w.counts.replaced, 1, "exactly one URL replacement");
  assert.equal(w.replacedWith.length, 1);
  assert.equal(w.map.size, 1, "exactly one stored session");
});

test("28. a FAILING operation does not reset the latch", () => {
  // A throw is not evidence that nothing happened: initialization can fail after
  // persisting. Auto-retrying would mint a second key over a durable first one.
  const guard: RunOnceGuard = { current: false };
  let runs = 0;
  assert.throws(() => runOnce(guard, () => { runs += 1; throw new Error("boom"); }));
  assert.equal(runOnce(guard, () => { runs += 1; }), false, "the latch stayed set");
  assert.equal(runs, 1);
});

test("29. the bootstrap and start-new guards are SEPARATE instances", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /const bootstrapGuard = useRef\(false\)/);
  assert.match(code, /const startNewGuard = useRef\(false\)/);
  assert.match(code, /runOnce\(bootstrapGuard,/, "the effect uses the shipping helper");
  assert.match(code, /runOnce\(startNewGuard,/, "and so does the operator action");
  // Neither guard is React state: a state update is invisible to a second
  // synchronous caller in the same tick.
  assert.equal(/useState\([^)]*[Gg]uard/.test(code), false, "guards are refs, not state");
});

// ── 30-31. Server render and hydration safety ───────────────────────────────

let saveInvocations = 0;
const SC: WizardScreenConfiguration = {
  // B2-E2G: every managed family opted OUT — this fixture configures none of them.
  serviceOfferings: { window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
  filmTypes: [], windowAreas: [], maintenanceMenus: [], washMenus: [], roomMenus: [],
  otherWorkPresets: [], storeGlobalOptions: [], coupons: [], ppfMethods: [], ppfParts: [], ppfTypeGroups: [],
};
const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};

// Fully typed — no cast, so every required prop of the real wrapper is checked by
// the compiler. A prop dropped, renamed or made optional breaks THIS file.
const PROPS: ProductionEstimateWizardProps = {
  shopRank: "detailer",
  screenConfig: SC,
  catalog: makePricingCatalog(),
  pricingConfig: PC,
  customers: [],
  vehicles: [],
  saveInvoker: async (): Promise<WizardSaveIntentResult> => {
    saveInvocations += 1;
    throw new Error("no render path may invoke save");
  },
  expectedConfigRevision: 3,
};

test("30. the SERVER render is the booting placeholder only — no wizard, no save surface", () => {
  const html = renderToStaticMarkup(React.createElement(ProductionEstimateWizard, PROPS));
  assert.ok(html.includes("bootstrap-booting"), "PRECONDITION: the booting state rendered");
  for (const absent of [
    "bootstrap-active", "wizard-save-panel", "save-submit",
    "bootstrap-completed-redirect", "bootstrap-missing-session", "bootstrap-blocked",
  ]) {
    assert.equal(html.includes(absent), false, `server render leaked ${absent}`);
  }
  assert.equal(saveInvocations, 0, "the server render invoked save");
});

test("31. importing and server-rendering the module touches NO browser global", () => {
  // ── The fail-loud SSR precondition ─────────────────────────────────────
  // `window` and `document` are the load-bearing DOM globals: the shipping module
  // reaches storage, crypto and navigation ONLY through `window.*` inside contained
  // helpers, so their absence during import + render is what proves nothing was read
  // at module scope. This stays fail-loud — if a runtime ever defines either, the
  // test fails rather than passing vacuously.
  //
  // Bare `sessionStorage`/`localStorage`/`history`/`location` are deliberately NOT
  // required absent. Node 26 exposes `sessionStorage` as a lazy global, and its mere
  // presence is irrelevant: the module never touches these as bare globals. The
  // source assertion below proves that directly, which is a stronger guarantee than
  // an absence check that a future runtime can invalidate for reasons unrelated to us.
  for (const global of ["window", "document"]) {
    assert.equal(global in globalThis, false, `${global} exists — this test proves nothing`);
  }

  // 1-2. Import already happened (top of file) with no window; render succeeds with
  // no window and no document. Either would throw ReferenceError if the module read
  // a browser API at module scope or during render.
  const html = renderToStaticMarkup(React.createElement(ProductionEstimateWizard, PROPS));
  assert.ok(html.length > 0);
  // 3-4. Only the booting placeholder; no active wizard, no save surface.
  assert.ok(html.includes("bootstrap-booting"), "SSR is the booting placeholder");
  for (const absent of ["bootstrap-active", "wizard-save-panel", "save-submit"]) {
    assert.equal(html.includes(absent), false, `server render leaked ${absent}`);
  }
  // 5. The saver was never invoked by any render path.
  assert.equal(saveInvocations, 0, "the server render invoked save");

  // ── The narrow bare-global source assertion ────────────────────────────
  // Absence-in-globalThis proved nothing about the module once Node started
  // defining these names. This proves the real invariant at the source: production
  // code accesses browser storage and navigation ONLY as `window.<x>`, never as a
  // bare global or through `globalThis`.
  //
  // Scoped to EXECUTABLE access forms (`.method(` / `[...]`), and every pattern uses
  // a `(?<![\w.])` lookbehind so a name reached via `window.` — the authorized
  // contained form — is not matched. That lookbehind is also why the safe fixed
  // string "location-unavailable" and identifiers like `safeSessionStorage` do not
  // false-positive: the former is followed by `-` (not `.`/`[`) and the latter is
  // preceded by a word char.
  const prod = codeOf(WRAPPER_SRC);
  const FORBIDDEN: Array<[string, RegExp]> = [
    ["bare sessionStorage member",  /(?<![\w.])sessionStorage\s*(\.|\[)/],
    ["bare localStorage member",    /(?<![\w.])localStorage\s*(\.|\[)/],
    ["bare history member",         /(?<![\w.])history\s*(\.|\[)/],
    ["bare location member",        /(?<![\w.])location\s*(\.|\[)/],
    ["globalThis storage/nav",      /globalThis\s*\.\s*(sessionStorage|localStorage|history|location)\b/],
    ["globalThis storage/nav index", /globalThis\s*\[\s*["'](sessionStorage|localStorage|history|location)["']\s*\]/],
  ];
  for (const [label, re] of FORBIDDEN) {
    assert.equal(re.test(prod), false, `production uses a ${label}`);
  }

  // Anti-vacuity: the lookbehind must still PERMIT the authorized contained forms,
  // and they must actually be present — otherwise the scan proves nothing because
  // the module simply contains no browser access at all.
  for (const permitted of [
    /window\s*\.\s*sessionStorage/, /window\s*\.\s*crypto/,
    /window\s*\.\s*location/, /window\s*\.\s*history/,
  ]) {
    assert.match(prod, permitted, `PRECONDITION: the authorized contained form ${permitted} is present`);
  }
  // And prove the lookbehind does its job: the exact authorized `window.location.assign`
  // and `window.history.replaceState` forms are NOT caught by the bare-member patterns.
  assert.match(prod, /window\s*\.\s*location\s*\.\s*assign\(/, "the authorized navigate form exists");
  assert.equal(/(?<![\w.])location\s*\.\s*assign\(/.test("const x = location.assign(p)"), true,
    "self-check: the pattern DOES catch a genuinely bare location.assign");
});

// ── 32-35. Source boundary ──────────────────────────────────────────────────

test("32. the public props contain no session, deps, completion or navigation seam", () => {
  const code = codeOf(WRAPPER_SRC);
  const start = code.indexOf("export interface ProductionEstimateWizardProps");
  assert.ok(start >= 0, "PRECONDITION: the interface was located");
  const block = code.slice(start, code.indexOf("\n}", start));

  for (const forbidden of ["session", "sessionDeps", "onCompleted", "navigate"]) {
    assert.equal(block.includes(forbidden), false,
      `${forbidden} is not constructible by a Server Component and must not be public`);
  }
  // What must remain.
  assert.match(block, /extends\s+WizardHostRuntimeInputs\s*,\s*WizardExistingEntityInputs\s*,\s*WizardPreselectionInputs\b/);
  assert.match(block, /readonly saveInvoker: WizardSaveIntentInvoker;/, "required saver");
  assert.match(block, /readonly expectedConfigRevision: number;/, "required revision");
  assert.equal(/saveInvoker\?:|expectedConfigRevision\?:/.test(block), false, "neither may be optional");
});

test("33. every active boundary uses the NON-COMPLETED session type", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code,
    /export type ActiveWizardSession = Exclude<ValidatedWizardSession, \{ readonly status: "completed" \} *>/,
    "derived from the branded union rather than redeclared");
  assert.match(code, /readonly kind: "active"; readonly session: ActiveWizardSession/, "the decision arm");
  assert.match(code, /readonly kind: "active"; readonly session: ActiveWizardSession; readonly deps: WizardSessionDeps/,
    "the bootstrap state arm");
  assert.match(code, /readonly session: ActiveWizardSession;\s*\n\s*readonly sessionDeps: WizardSessionDeps;/,
    "the ready child requires both");
  // The completed arm carries an id, not a mounted wizard.
  assert.match(code, /readonly kind: "completed"; readonly estimateId: string/);
});

test("34. the wrapper imports no Server Action, gateway, Supabase or fetch", () => {
  const code = codeOf(WRAPPER_SRC);
  for (const forbidden of [
    "save-estimate-from-wizard", "saveEstimateFrom" + "Wizard",
    "persistence-gateway", "EstimatePersistenceService",
    "supa" + "base", "createClient", ".rpc(", "fetch(", "server-only", "use server",
    "Date.now", "new Date", "Math.random", "randomUUID",
  ]) {
    assert.equal(code.includes(forbidden), false, `wrapper references ${forbidden}`);
  }
  // The saver arrives as a structural TYPE, never as an imported action.
  assert.match(code, /import type \{ WizardSaveIntentInvoker \}/);
  // Every browser read lives below the contained helpers — never at module scope.
  const moduleScope = code.slice(0, code.indexOf("function safeSessionStorage"));
  assert.ok(moduleScope.length > 0, "PRECONDITION: the helper boundary was located");
  for (const global of ["window.", "document.", "history.", "location."]) {
    assert.equal(moduleScope.includes(global), false, `module scope reads ${global}`);
  }
});

// ── 36-40. R89C — the PDF post-save destination ─────────────────────────────

test("36. the PDF path is built ONLY from a validated uuid, and is encoded", () => {
  assert.equal(buildEstimatePdfPath(UUID), `/pdf?estimateId=${UUID}`);
  for (const bad of [
    "", "not-a-uuid", `${UUID}0`, "../../admin", "..%2Fadmin",
    `${UUID}/../../admin`, null, undefined, 7, {}, [], `${UUID}\n`,
  ]) {
    assert.equal(buildEstimatePdfPath(bad), null, `accepted ${String(bad)}`);
  }
});

test("37. buildPostSavePath routes the two literals and FAILS CLOSED on anything else", () => {
  assert.equal(buildPostSavePath(UUID, "estimate"), `/estimates/${UUID}`);
  assert.equal(buildPostSavePath(UUID, "pdf"), `/pdf?estimateId=${UUID}`);

  // An unrecognized runtime destination is never silently coerced to either arm.
  for (const bad of [
    "", "Estimate", "PDF", "line", "invoice", "/pdf", "estimate ", null, undefined, 0, 1,
    {}, [], true, "__proto__", "constructor",
  ]) {
    assert.equal(buildPostSavePath(UUID, bad), null, `accepted destination ${String(bad)}`);
  }
  // A bad id blocks BOTH destinations.
  for (const dest of ["estimate", "pdf"]) {
    assert.equal(buildPostSavePath("../../admin", dest), null, `${dest} accepted a bad id`);
  }
});

test("38. navigation: pdf routes to /pdf, estimate is unchanged, and the default is estimate", () => {
  const seen: string[] = [];
  const spy: NavigationSeam = (p) => { seen.push(p); };

  // Default (the completed-session reload caller) — byte-identical to before.
  assert.deepEqual(navigateToEstimate(spy, UUID), { kind: "navigated", path: `/estimates/${UUID}` });
  assert.deepEqual(navigateToEstimate(spy, UUID, "estimate"), { kind: "navigated", path: `/estimates/${UUID}` });
  assert.deepEqual(navigateToEstimate(spy, UUID, "pdf"), { kind: "navigated", path: `/pdf?estimateId=${UUID}` });

  assert.deepEqual(seen, [`/estimates/${UUID}`, `/estimates/${UUID}`, `/pdf?estimateId=${UUID}`]);
});

test("39. an INVALID destination navigates ZERO times and is its own outcome", () => {
  const seen: string[] = [];
  const spy: NavigationSeam = (p) => { seen.push(p); };

  for (const bad of ["", "PDF", "line", "/pdf", null, 7, {}, []]) {
    assert.deepEqual(navigateToEstimate(spy, UUID, bad), { kind: "invalid-destination" }, String(bad));
  }
  assert.equal(seen.length, 0, "no unknown destination ever became a URL");

  // An invalid id is still reported as an invalid ID, whatever the destination.
  for (const dest of ["estimate", "pdf", "bogus"]) {
    assert.deepEqual(navigateToEstimate(spy, "../../admin", dest), { kind: "invalid-estimate-id" }, dest);
  }
  assert.equal(seen.length, 0);
});

test("40. a COMPLETED reload still routes to estimate DETAIL, and saves nothing", () => {
  const w = seededWorld();
  markWizardSessionPending(w.deps, w.ws);
  markWizardSessionCompleted(w.deps, w.ws, UUID);
  const writesBefore = w.counts.writes;

  const d = decideWizardBootstrap(w.deps, valid(w.ws), NEVER_REPLACE);
  assert.equal(d.kind, "completed");
  if (d.kind !== "completed") return;

  // The reload branch carries no destination, so the default applies.
  const seen: string[] = [];
  assert.deepEqual(
    navigateToEstimate((p) => { seen.push(p); }, d.estimateId),
    { kind: "navigated", path: `/estimates/${UUID}` },
  );
  assert.deepEqual(seen, [`/estimates/${UUID}`], "never the PDF route — the preference is not persisted");
  assert.equal(w.counts.writes, writesBefore, "the bootstrap wrote nothing: no re-save");
});

test("35. initialization appears exactly twice, and the ws branch only recovers", () => {
  const code = codeOf(WRAPPER_SRC);

  assert.equal((code.match(/initializeWizardSession\(/g) ?? []).length, 2,
    "minting must not spread beyond the absent-ws branch and start-new");
  assert.match(code, /const startNewEstimate = useCallback\(/, "the explicit operator action exists");
  assert.match(code, /recoverWizardSession\(deps, query\.wizardSessionId\)/, "the valid branch recovers");
  // Start-new is reachable from exactly one operator surface.
  assert.equal((code.match(/onClick=\{startNewEstimate\}/g) ?? []).length, 1);
  assert.match(code, /data-testid="bootstrap-start-new"/);
  // The URL is replaced, never pushed — Back must not re-enter a stale session.
  assert.equal(code.includes("history.pushState"), false, "history is replaced, never pushed");
  assert.ok(code.includes("history.replaceState"));
});
