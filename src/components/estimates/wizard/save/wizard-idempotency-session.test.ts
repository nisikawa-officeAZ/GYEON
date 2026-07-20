// B7-2B — idempotency-session authority tests.
//
// Run: node --import tsx --test src/components/estimates/wizard/save/wizard-idempotency-session.test.ts
//
// Fully deterministic: storage, crypto and the URL callback are injected fakes, so
// there is no DOM, no clock, no randomness and no network. Every ordering claim is
// proven by an explicit call log rather than inferred from a result.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  initializeWizardSession, recoverWizardSession,
  markWizardSessionPending, markWizardSessionFailed, markWizardSessionCompleted,
  isValidEstimateId, isValidWizardSessionId,
  type WizardSessionDeps, type WizardSessionStorage, type WizardSessionCrypto,
  type ValidatedWizardSession,
} from "./wizard-idempotency-session";
import { IDEMPOTENCY_KEY_PATTERN } from "./wizard-save-intent-types";

const WS_PATTERN = /^ws\.[0-9a-f]{32}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const UUID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const MODULE_SRC = "src/components/estimates/wizard/save/wizard-idempotency-session.ts";

// ── Deterministic fakes with an ordered call log ────────────────────────────

type Log = string[];

function fakeStorage(log: Log, over: Partial<WizardSessionStorage> = {}) {
  const map = new Map<string, string>();
  const storage: WizardSessionStorage = {
    getItem: over.getItem ?? ((k) => { log.push(`getItem:${k}`); return map.get(k) ?? null; }),
    setItem: over.setItem ?? ((k, v) => { log.push(`setItem:${k}`); map.set(k, v); }),
  };
  return { storage, map };
}

/** Deterministic byte source: each call fills with a distinct constant. */
function fakeCrypto(log: Log, opts: { throws?: boolean; absent?: boolean } = {}) {
  let call = 0;
  if (opts.absent) return null;
  return {
    getRandomValues(arr: Uint8Array): Uint8Array {
      call += 1;
      log.push(`getRandomValues:${call}`);
      if (opts.throws) throw new Error("crypto failure");
      arr.fill(call === 1 ? 0xab : 0xcd);
      return arr;
    },
  };
}

function harness(over: { storage?: WizardSessionStorage; crypto?: ReturnType<typeof fakeCrypto> } = {}) {
  const log: Log = [];
  const fs = fakeStorage(log);
  const deps: WizardSessionDeps = {
    storage: over.storage ?? fs.storage,
    crypto: over.crypto !== undefined ? over.crypto : fakeCrypto(log),
  };
  const urls: string[] = [];
  const replaceUrl = (ws: string) => { log.push(`replaceUrl:${ws}`); urls.push(ws); };
  return { log, deps, map: fs.map, urls, replaceUrl };
}

const stored = (h: ReturnType<typeof harness>, ws: string) =>
  JSON.parse(h.map.get(`dealeros.ew.idem.v1:${ws}`) as string) as Record<string, unknown>;

// ── 1-5. Initialization ─────────────────────────────────────────────────────

test("1. a new session is READY, never pending", () => {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "ready");
  assert.equal(stored(h, r.session.wizardSessionId).status, "ready");
  assert.notEqual(r.session.status, "pending");
});

test("2. exact ordering: ws → key → setItem → read-back → URL callback", () => {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ws = r.session.wizardSessionId;
  assert.deepEqual(h.log, [
    "getRandomValues:1",                       // 1. session id
    "getRandomValues:2",                       // 2. idempotency key
    `setItem:dealeros.ew.idem.v1:${ws}`,       // 3. persist ready
    `getItem:dealeros.ew.idem.v1:${ws}`,       // 4. verify by read-back
    `replaceUrl:${ws}`,                        // 5. only now the URL
  ]);
});

test("3. the URL callback NEVER runs before a successful read-back", () => {
  // Read-back returns a different value than was written → persist must fail and
  // the ws must never reach the address bar.
  const log: Log = [];
  const storage: WizardSessionStorage = {
    getItem: (k) => { log.push(`getItem:${k}`); return '{"v":1,"key":"deadbeefdeadbeefdeadbeefdeadbeef","status":"ready"}'; },
    setItem: (k) => { log.push(`setItem:${k}`); },
  };
  const h = harness({ storage });
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "persist-failed");
  assert.equal(h.urls.length, 0, "no URL update on read-back mismatch");
  assert.equal(h.log.some((l) => l.startsWith("replaceUrl")), false);
});

test("4. ws and key are generated together — exactly two getRandomValues calls", () => {
  const h = harness();
  initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(h.log.filter((l) => l.startsWith("getRandomValues")).length, 2);
});

test("5. generated grammars are lowercase hex and satisfy the shared key authority", () => {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.session.wizardSessionId, WS_PATTERN);
  assert.match(r.session.idempotencyKey, HEX32);
  assert.equal(r.session.idempotencyKey, r.session.idempotencyKey.toLowerCase());
  assert.equal(r.session.idempotencyKey.length, 32);
  // The AUTHORITY, imported — not a local copy.
  assert.match(r.session.idempotencyKey, IDEMPOTENCY_KEY_PATTERN);
  // The two ids are distinct values and the key is never URL-shaped.
  assert.notEqual(r.session.idempotencyKey, r.session.wizardSessionId);
  assert.equal(WS_PATTERN.test(r.session.idempotencyKey), false);
});

// ── 6-7. Storage shape and non-leakage ──────────────────────────────────────

test("6. exact storage key and exact record keys", () => {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ws = r.session.wizardSessionId;

  assert.deepEqual([...h.map.keys()], [`dealeros.ew.idem.v1:${ws}`]);
  assert.deepEqual(Object.keys(stored(h, ws)).sort(), ["key", "status", "v"]);
  assert.equal(stored(h, ws).v, 1);

  // Completed adds exactly one key and no more.
  markWizardSessionPending(h.deps, ws);
  markWizardSessionCompleted(h.deps, ws, UUID);
  assert.deepEqual(Object.keys(stored(h, ws)).sort(), ["estimateId", "key", "status", "v"]);
});

test("7. CANARY: no sensitive value can reach storage", () => {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ws = r.session.wizardSessionId;
  markWizardSessionPending(h.deps, ws);
  markWizardSessionCompleted(h.deps, ws, UUID);

  // PRECONDITION: something really was persisted, so absence is meaningful.
  const serialized = h.map.get(`dealeros.ew.idem.v1:${ws}`) as string;
  assert.ok(serialized.length > 0, "a record was written");
  assert.ok(serialized.includes(r.session.idempotencyKey), "the key IS present, as designed");

  for (const forbidden of ["draft", "customer", "vehicle", "notes", "price", "total",
                           "dealerId", "dealer_id", "tenantId", "tenant_id",
                           "userId", "user_id", "role",
                           "requestId", "obs.", "error", "message", "stack", "cause"]) {
    assert.equal(serialized.includes(forbidden), false, `storage leaks ${forbidden}`);
  }
});

// ── 8-11. Recovery ──────────────────────────────────────────────────────────

test("8. valid recovery reuses the IDENTICAL key", () => {
  const h = harness();
  const init = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(init.ok, true);
  if (!init.ok) return;

  const rec = recoverWizardSession(h.deps, init.session.wizardSessionId);
  assert.equal(rec.ok, true);
  if (!rec.ok) return;
  assert.equal(rec.session.idempotencyKey, init.session.idempotencyKey);
  assert.equal(rec.session.status, "ready");
});

test("9. valid ws with NO record generates nothing — the duplicate-tab case", () => {
  const h = harness();
  const orphan = "ws.11111111111111111111111111111111";
  const r = recoverWizardSession(h.deps, orphan);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "missing-record");
  assert.equal(h.log.filter((l) => l.startsWith("getRandomValues")).length, 0,
    "ZERO crypto calls — the crypto probe runs only for a VALID record, so a copied "
    + "URL never consumes generation");
  assert.equal(h.log.filter((l) => l.startsWith("setItem")).length, 0, "nothing written");
  assert.equal(h.urls.length, 0, "no URL change");
});

test("10. a record deleted mid-session yields the same missing-record result", () => {
  const h = harness();
  const init = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(init.ok, true);
  if (!init.ok) return;
  const ws = init.session.wizardSessionId;

  h.map.delete(`dealeros.ew.idem.v1:${ws}`);
  const before = h.log.filter((l) => l.startsWith("getRandomValues")).length;

  const r = recoverWizardSession(h.deps, ws);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "missing-record");
  assert.equal(h.log.filter((l) => l.startsWith("getRandomValues")).length, before, "no new key");
});

test("11. a malformed ws performs NO storage access and NO generation", () => {
  for (const bad of ["", "ws.", "ws.SHORT", "ws.ABCDEF01234567890123456789ABCDEF",
                     "ws.0123456789abcdef0123456789abcde",     // 31
                     "ws.0123456789abcdef0123456789abcdef0",   // 33
                     "WS.0123456789abcdef0123456789abcdef",
                     "0123456789abcdef0123456789abcdef",
                     "../../etc/passwd", "<script>"]) {
    const h = harness();
    const r = recoverWizardSession(h.deps, bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (r.ok) continue;
    assert.equal(r.reason, "invalid-session-id", JSON.stringify(bad));
    assert.deepEqual(h.log, [], `${JSON.stringify(bad)} touched storage or crypto`);
  }
});

// ── 12-13. Corrupt records and storage failure ──────────────────────────────

test("12. malformed JSON, array, null, v:2, extra keys and bad statuses all fail closed", () => {
  const ws = "ws.22222222222222222222222222222222";
  const key = "abcdefabcdefabcdefabcdefabcdefab";
  const corrupt = [
    "not json", "{", "[]", '["a"]', "null", "true", "42", '"str"',
    `{"v":2,"key":"${key}","status":"ready"}`,
    `{"v":1,"key":"${key}","status":"ready","extra":1}`,
    `{"v":1,"key":"${key}","status":"unknown"}`,
    `{"v":1,"key":"${key}"}`,
    `{"v":1,"status":"ready"}`,
    `{"v":1,"key":"short","status":"ready"}`,
    `{"v":1,"key":"has space here 1234567890","status":"ready"}`,
    `{"v":1,"key":"${key}","status":"completed"}`,                       // missing estimateId
    `{"v":1,"key":"${key}","status":"completed","estimateId":"not-a-uuid"}`,
    `{"v":1,"key":"${key}","status":"ready","estimateId":"${UUID}"}`,    // estimateId on wrong arm
  ];
  for (const raw of corrupt) {
    const log: Log = [];
    const storage: WizardSessionStorage = { getItem: () => raw, setItem: () => { log.push("set"); } };
    const r = recoverWizardSession({ storage, crypto: null }, ws);
    assert.equal(r.ok, false, raw);
    if (r.ok) continue;
    assert.equal(r.reason, "corrupt-record", raw);
  }
});

test("13. absent storage, throwing getItem/setItem, and read-back mismatch all fail closed", () => {
  const ws = "ws.33333333333333333333333333333333";

  // Absent storage.
  assert.equal(recoverWizardSession({ storage: null, crypto: null }, ws).ok, false);
  assert.equal(
    (recoverWizardSession({ storage: null, crypto: null }, ws) as { reason: string }).reason,
    "storage-unavailable",
  );

  // getItem throws.
  const throwsGet: WizardSessionStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => {},
  };
  const g = recoverWizardSession({ storage: throwsGet, crypto: null }, ws);
  assert.equal(g.ok, false);
  if (!g.ok) assert.equal(g.reason, "storage-unavailable");

  // setItem throws (quota) during initialization.
  const log: Log = [];
  const throwsSet: WizardSessionStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); },
  };
  const h = harness({ storage: throwsSet });
  const i = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(i.ok, false);
  if (!i.ok) assert.equal(i.reason, "persist-failed");
  assert.equal(h.urls.length, 0, "no URL update when the write throws");
  assert.equal(log.length, 0);
});

// ── 13b. Initialization storage-failure coverage (explicit, per mode) ───────
//
// Every mode must return failure, return NO validated session, leave the URL
// unchanged, and NEVER persist `pending` — a new session is only ever `ready`.

test("13b. initialization fails closed for every storage failure mode", () => {
  const written: string[] = [];

  const modes: Array<[string, WizardSessionStorage | null]> = [
    ["storage absent", null],
    ["getItem throws during read-back", {
      getItem: () => { throw new Error("blocked"); },
      setItem: (_k, v) => { written.push(v); },
    }],
    ["setItem throws", {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
    }],
    ["read-back mismatch", {
      getItem: () => '{"v":1,"key":"deadbeefdeadbeefdeadbeefdeadbeef","status":"ready"}',
      setItem: (_k, v) => { written.push(v); },
    }],
  ];

  for (const [label, storage] of modes) {
    written.length = 0;
    const urls: string[] = [];
    const log: Log = [];
    const r = initializeWizardSession(
      { storage, crypto: fakeCrypto(log) },
      (ws) => { urls.push(ws); },
    );

    assert.equal(r.ok, false, `${label}: must fail`);
    if (!r.ok) assert.equal(r.reason, "persist-failed", label);
    assert.equal("session" in r, false, `${label}: no validated session is returned`);
    assert.equal(urls.length, 0, `${label}: the URL replacer did not run`);
    // Whatever reached setItem (if anything) was `ready` — never `pending`.
    for (const v of written) {
      assert.equal(JSON.parse(v).status, "ready", `${label}: pending must never be persisted`);
    }
  }
});

// ── 13c. A throwing URL replacer ────────────────────────────────────────────

test("13c. a throwing URL replacer fails closed, and the record stays READY", () => {
  const h = harness();
  const thrower = (ws: string) => { h.log.push(`replaceUrl:${ws}`); throw new Error("history blocked"); };

  const r = initializeWizardSession(h.deps, thrower);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "persist-failed");
  assert.equal("session" in r, false, "no validated session is returned");

  // The replacer was attempted only AFTER the verified write.
  const setAt = h.log.findIndex((l) => l.startsWith("setItem"));
  const getAt = h.log.findIndex((l) => l.startsWith("getItem"));
  const urlAt = h.log.findIndex((l) => l.startsWith("replaceUrl"));
  assert.ok(setAt >= 0 && getAt > setAt && urlAt > getAt,
    "ordering held: setItem → read-back → replaceUrl");

  // The verified record remains durable and READY — never pending, and not removed.
  assert.equal(h.map.size, 1, "the record is still present (no cleanup, no removeItem)");
  const [only] = [...h.map.values()];
  const rec = JSON.parse(only) as Record<string, unknown>;
  assert.equal(rec.status, "ready");
  assert.equal(rec.v, 1);
});

// ── 14. Crypto failure ──────────────────────────────────────────────────────

test("14. absent crypto and throwing getRandomValues fail with NO fallback", () => {
  const absent = harness({ crypto: null });
  const a = initializeWizardSession(absent.deps, absent.replaceUrl);
  assert.equal(a.ok, false);
  if (!a.ok) assert.equal(a.reason, "crypto-unavailable");
  assert.equal(absent.map.size, 0, "nothing persisted");
  assert.equal(absent.urls.length, 0, "no URL update");

  const logT: Log = [];
  const throwing = harness({ crypto: fakeCrypto(logT, { throws: true }) });
  const t = initializeWizardSession(throwing.deps, throwing.replaceUrl);
  assert.equal(t.ok, false);
  if (!t.ok) assert.equal(t.reason, "crypto-unavailable");
  assert.equal(throwing.map.size, 0);
  assert.equal(throwing.urls.length, 0);
});

// ── 14b. Valid-record recovery still requires usable crypto ────────────────

test("14b. a VALID stored record with unusable crypto returns crypto-unavailable", () => {
  const ws = "ws.88888888888888888888888888888888";
  const key = "abcdefabcdefabcdefabcdefabcdefab";

  const records: Array<[string, string]> = [
    ["ready", JSON.stringify({ v: 1, key, status: "ready" })],
    ["pending", JSON.stringify({ v: 1, key, status: "pending" })],
    ["failed", JSON.stringify({ v: 1, key, status: "failed" })],
    ["completed", JSON.stringify({ v: 1, key, status: "completed", estimateId: UUID })],
  ];

  for (const [label, raw] of records) {
    for (const [cryptoLabel, crypto] of [
      ["absent", null],
      ["throwing", fakeCrypto([], { throws: true })],
    ] as const) {
      const writes: string[] = [];
      const storage: WizardSessionStorage = {
        getItem: () => raw,
        setItem: (_k, v) => { writes.push(v); },
      };
      const r = recoverWizardSession({ storage, crypto }, ws);

      assert.equal(r.ok, false, `${label} + ${cryptoLabel} crypto`);
      if (!r.ok) assert.equal(r.reason, "crypto-unavailable", `${label} + ${cryptoLabel}`);
      assert.equal(writes.length, 0, `${label} + ${cryptoLabel}: nothing written`);
      // The stored key is untouched — no rotation, no probe value persisted.
      assert.equal((JSON.parse(raw) as { key: string }).key, key);
    }
  }

  // PRECONDITION: the same records recover cleanly with USABLE crypto — without
  // this, the failures above could pass against a recovery that never succeeds.
  for (const [label, raw] of records) {
    const ok = recoverWizardSession(
      { storage: { getItem: () => raw, setItem: () => {} }, crypto: fakeCrypto([]) },
      ws,
    );
    assert.equal(ok.ok, true, `${label} recovers with usable crypto`);
    if (ok.ok) assert.equal(ok.session.idempotencyKey, key);
  }
});

test("14c. transitions inherit the crypto check and perform NO write", () => {
  const ws = "ws.99999999999999999999999999999999";
  const key = "abcdefabcdefabcdefabcdefabcdefab";
  const raw = JSON.stringify({ v: 1, key, status: "ready" });

  for (const [label, crypto] of [
    ["absent", null],
    ["throwing", fakeCrypto([], { throws: true })],
  ] as const) {
    const writes: string[] = [];
    const storage: WizardSessionStorage = { getItem: () => raw, setItem: (_k, v) => { writes.push(v); } };
    const r = markWizardSessionPending({ storage, crypto }, ws);
    assert.equal(r.ok, false, label);
    if (!r.ok) assert.equal(r.reason, "crypto-unavailable", label);
    assert.equal(writes.length, 0, `${label}: no write attempted`);
  }
});

// ── 14d. Adversarial crypto providers ──────────────────────────────────────
//
// A dependency can be runtime-invalid in ways its TYPE forbids, which is exactly
// the case a fail-closed check must survive. The `as unknown as` casts below exist
// ONLY to construct those invalid shapes in the fixture — the module under test
// contains no cast, and no `any`, `ts-ignore` or `ts-expect-error` is used.
//
// The critical row is "returns a non-Uint8Array": the previous implementation fell
// back to its own untouched zero-filled buffer and produced
// "00000000000000000000000000000000" as a well-formed id, so two sessions could
// share one idempotency key.

type AdversarialCrypto = [label: string, crypto: WizardSessionCrypto | null];

function adversarialCryptoCases(): AdversarialCrypto[] {
  return [
    ["absent", null],
    ["getRandomValues not callable",
      { getRandomValues: "nope" } as unknown as WizardSessionCrypto],
    ["getRandomValues throws",
      { getRandomValues: () => { throw new Error("blocked"); } } as unknown as WizardSessionCrypto],
    ["returns a non-Uint8Array",
      { getRandomValues: () => ({ length: 16 }) } as unknown as WizardSessionCrypto],
    ["returns a plain array",
      { getRandomValues: () => new Array(16).fill(1) } as unknown as WizardSessionCrypto],
    ["returns a SHORT Uint8Array",
      { getRandomValues: () => new Uint8Array(8) } as unknown as WizardSessionCrypto],
    ["returns a LONG Uint8Array",
      { getRandomValues: () => new Uint8Array(32) } as unknown as WizardSessionCrypto],
  ];
}

test("14d. INITIALIZATION rejects every adversarial crypto provider", () => {
  for (const [label, crypto] of adversarialCryptoCases()) {
    const writes: string[] = [];
    const urls: string[] = [];
    const storage: WizardSessionStorage = {
      getItem: () => null,
      setItem: (_k, v) => { writes.push(v); },
    };

    const r = initializeWizardSession({ storage, crypto }, (ws) => { urls.push(ws); });

    assert.equal(r.ok, false, `${label}: must fail`);
    if (!r.ok) assert.equal(r.reason, "crypto-unavailable", label);
    assert.equal("session" in r, false, `${label}: no validated session`);
    assert.equal(writes.length, 0, `${label}: nothing persisted`);
    assert.equal(urls.length, 0, `${label}: the URL replacer did not run`);
  }
});

test("14e. VALID-RECORD RECOVERY rejects every adversarial crypto provider", () => {
  const ws = "ws.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const key = "abcdefabcdefabcdefabcdefabcdefab";
  const raw = JSON.stringify({ v: 1, key, status: "ready" });

  for (const [label, crypto] of adversarialCryptoCases()) {
    const writes: string[] = [];
    const storage: WizardSessionStorage = {
      getItem: () => raw,
      setItem: (_k, v) => { writes.push(v); },
    };

    const r = recoverWizardSession({ storage, crypto }, ws);

    assert.equal(r.ok, false, `${label}: must fail`);
    if (!r.ok) assert.equal(r.reason, "crypto-unavailable", label);
    assert.equal(writes.length, 0, `${label}: no write`);
    // The stored key is never rotated by a failed probe.
    assert.equal((JSON.parse(raw) as { key: string }).key, key, `${label}: key unrotated`);
  }

  // PRECONDITION: a CONFORMING provider recovers the same record cleanly. Without
  // this, every rejection above could pass against a recovery that always fails.
  const ok = recoverWizardSession(
    { storage: { getItem: () => raw, setItem: () => {} }, crypto: fakeCrypto([]) },
    ws,
  );
  assert.equal(ok.ok, true, "a conforming provider still recovers");
  if (ok.ok) assert.equal(ok.session.idempotencyKey, key);
});

test("14f. a non-conforming provider can NEVER yield an all-zero identifier", () => {
  // The specific fail-open the old fallback allowed: the module read its own
  // untouched buffer and emitted 32 zeros as a valid id.
  const ZEROS = "0".repeat(32);
  const nonConforming = { getRandomValues: () => ({ length: 16 }) } as unknown as WizardSessionCrypto;

  const writes: string[] = [];
  const urls: string[] = [];
  const r = initializeWizardSession(
    { storage: { getItem: () => null, setItem: (_k, v) => { writes.push(v); } }, crypto: nonConforming },
    (w) => { urls.push(w); },
  );

  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "crypto-unavailable");
  assert.equal(writes.length, 0, "no zero-derived key was persisted");
  assert.equal(urls.length, 0, `no ws.${ZEROS} reached the URL`);
  assert.equal(writes.join("").includes(ZEROS), false, "the all-zero identifier never appears");
});

// ── 15. Session isolation ───────────────────────────────────────────────────

test("15. a session stored under ws A is NOT recoverable using ws B", () => {
  const h = harness();
  const a = initializeWizardSession(h.deps, h.replaceUrl);
  assert.equal(a.ok, true);
  if (!a.ok) return;

  const wsB = "ws.44444444444444444444444444444444";
  assert.notEqual(wsB, a.session.wizardSessionId);
  const r = recoverWizardSession(h.deps, wsB);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "missing-record");
});

// ── 16-21. Transitions ──────────────────────────────────────────────────────

function started(): { h: ReturnType<typeof harness>; ws: string; key: string } {
  const h = harness();
  const r = initializeWizardSession(h.deps, h.replaceUrl);
  if (!r.ok) throw new Error("fixture: initialization must succeed");
  return { h, ws: r.session.wizardSessionId, key: r.session.idempotencyKey };
}

test("16. ready → pending preserves the key", () => {
  const { h, ws, key } = started();
  const r = markWizardSessionPending(h.deps, ws);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "pending");
  assert.equal(r.session.idempotencyKey, key, "byte-identical");
  assert.equal(stored(h, ws).key, key);
});

test("17. failed → explicit pending retry preserves the key", () => {
  const { h, ws, key } = started();
  markWizardSessionPending(h.deps, ws);
  markWizardSessionFailed(h.deps, ws);
  const r = markWizardSessionPending(h.deps, ws);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "pending");
  assert.equal(r.session.idempotencyKey, key, "retry NEVER rotates the key");
});

test("18. pending → explicit pending retry preserves the key", () => {
  const { h, ws, key } = started();
  markWizardSessionPending(h.deps, ws);
  const r = markWizardSessionPending(h.deps, ws);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "pending");
  assert.equal(r.session.idempotencyKey, key);
});

test("19. pending → failed preserves the key", () => {
  const { h, ws, key } = started();
  markWizardSessionPending(h.deps, ws);
  const r = markWizardSessionFailed(h.deps, ws);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "failed");
  assert.equal(r.session.idempotencyKey, key);
});

test("20. a thrown / network-unknown outcome remains PENDING with the same key", () => {
  const { h, ws, key } = started();
  markWizardSessionPending(h.deps, ws);
  // The save threw: the SERVER outcome is unknown, so no transition is made.
  const rec = recoverWizardSession(h.deps, ws);
  assert.equal(rec.ok, true);
  if (!rec.ok) return;
  assert.equal(rec.session.status, "pending", "unknown outcome stays pending, not failed");
  assert.equal(rec.session.idempotencyKey, key);
});

test("21. pending → completed accepts a valid UUID and exposes it", () => {
  const { h, ws, key } = started();
  markWizardSessionPending(h.deps, ws);
  const r = markWizardSessionCompleted(h.deps, ws, UUID);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.session.status, "completed");
  assert.equal(r.session.idempotencyKey, key);
  if (r.session.status === "completed") assert.equal(r.session.estimateId, UUID);
});

// ── 22-23. Estimate-id validation ───────────────────────────────────────────

const BAD_IDS = [
  "../../admin", "not-a-uuid", "", "<script>alert(1)</script>",
  "3f1a7c2e9b444d618a0f5c7e2d9b1a33",                       // ungrouped
  "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a3",                    // 35
  "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a334",                  // 37
  " 3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33",
  "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33\n",
  "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1aZZ",
];

test("22. invalid estimate ids are rejected and never persisted", () => {
  for (const bad of BAD_IDS) {
    const { h, ws } = started();
    markWizardSessionPending(h.deps, ws);
    const r = markWizardSessionCompleted(h.deps, ws, bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (r.ok) continue;
    assert.equal(r.reason, "invalid-estimate-id", JSON.stringify(bad));
    assert.equal(stored(h, ws).status, "pending", "the record is untouched");
    assert.equal("estimateId" in stored(h, ws), false);
    assert.equal(isValidEstimateId(bad), false);
  }
  assert.equal(isValidEstimateId(UUID), true, "PRECONDITION: a real UUID IS accepted");
});

test("23. completed RECOVERY re-validates the stored UUID", () => {
  const ws = "ws.55555555555555555555555555555555";
  const key = "abcdefabcdefabcdefabcdefabcdefab";
  for (const bad of BAD_IDS) {
    const raw = JSON.stringify({ v: 1, key, status: "completed", estimateId: bad });
    const storage: WizardSessionStorage = { getItem: () => raw, setItem: () => {} };
    const r = recoverWizardSession({ storage, crypto: null }, ws);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.reason, "corrupt-record", bad);
  }
  // PRECONDITION: the same shape with a VALID id recovers cleanly — with USABLE
  // crypto, because recovery now proves crypto is available before returning.
  const good = JSON.stringify({ v: 1, key, status: "completed", estimateId: UUID });
  const ok = recoverWizardSession(
    { storage: { getItem: () => good, setItem: () => {} }, crypto: fakeCrypto([]) },
    ws,
  );
  assert.equal(ok.ok, true);
  if (ok.ok && ok.session.status === "completed") assert.equal(ok.session.estimateId, UUID);
});

// ── 24. Invalid transitions ─────────────────────────────────────────────────

test("24. invalid transitions reject, and NOTHING transitions out of completed", () => {
  // failed / completed cannot be reached from ready.
  const a = started();
  const f = markWizardSessionFailed(a.h.deps, a.ws);
  assert.equal(f.ok, false);
  if (!f.ok) assert.equal(f.reason, "invalid-transition");

  const b = started();
  const c = markWizardSessionCompleted(b.h.deps, b.ws, UUID);
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.reason, "invalid-transition");

  // completed is terminal.
  const t = started();
  markWizardSessionPending(t.h.deps, t.ws);
  markWizardSessionCompleted(t.h.deps, t.ws, UUID);
  for (const [label, fn] of [
    ["pending", () => markWizardSessionPending(t.h.deps, t.ws)],
    ["failed", () => markWizardSessionFailed(t.h.deps, t.ws)],
    ["completed", () => markWizardSessionCompleted(t.h.deps, t.ws, UUID)],
  ] as const) {
    const r = fn();
    assert.equal(r.ok, false, `completed → ${label} must reject`);
    if (!r.ok) assert.equal(r.reason, "invalid-transition", label);
  }
  assert.equal(stored(t.h, t.ws).status, "completed", "the terminal record is unchanged");

  // Transitions on a missing record fail rather than create one.
  const missing = markWizardSessionPending(
    { storage: { getItem: () => null, setItem: () => {} }, crypto: null },
    "ws.66666666666666666666666666666666",
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, "missing-record");
});

// ── 25. Every write is read back ────────────────────────────────────────────

test("25. every transition write is verified by read-back", () => {
  const { h, ws } = started();
  const before = h.log.length;
  markWizardSessionPending(h.deps, ws);
  const after = h.log.slice(before);
  const setIdx = after.findIndex((l) => l.startsWith("setItem"));
  assert.ok(setIdx >= 0, "PRECONDITION: a write occurred");
  assert.ok(
    after.slice(setIdx + 1).some((l) => l.startsWith("getItem")),
    "a read-back follows every write",
  );

  // A silently no-op setItem must be caught by the read-back.
  //
  // The earlier version of this proof used `getItem: () => null`, which exits as
  // missing-record BEFORE any write is attempted — so it proved nothing about
  // read-back verification. A valid pre-existing `ready` record is required to
  // reach the write boundary at all.
  const noopWs = "ws.77777777777777777777777777777777";
  const noopKey = "abcdefabcdefabcdefabcdefabcdefab";
  const readyRecord = JSON.stringify({ v: 1, key: noopKey, status: "ready" });
  const trace: Log = [];
  const noop: WizardSessionStorage = {
    getItem: (k) => { trace.push(`getItem:${k}`); return readyRecord; },   // never changes
    setItem: (k) => { trace.push(`setItem:${k}`); },                       // silently does nothing
  };
  const r = markWizardSessionPending({ storage: noop, crypto: fakeCrypto([]) }, noopWs);

  // The write was ATTEMPTED, and a read-back followed it.
  const setAt = trace.findIndex((l) => l.startsWith("setItem"));
  assert.ok(setAt >= 0, "the transition write was attempted");
  assert.ok(trace.slice(setAt + 1).some((l) => l.startsWith("getItem")), "read-back followed setItem");

  assert.equal(r.ok, false, "a no-op write cannot report success");
  if (!r.ok) assert.equal(r.reason, "persist-failed");

  // The stored record is untouched: still ready, same key.
  // Named distinctly from the earlier `after` log slice in this same scope — two
  // `const after` declarations in one block is a redeclaration error.
  const storedAfterNoop = JSON.parse(readyRecord) as Record<string, unknown>;
  assert.equal(storedAfterNoop.status, "ready", "the record remains ready");
  assert.equal(storedAfterNoop.key, noopKey, "the idempotency key is unchanged");
});

// ── 26-27. Source guards ────────────────────────────────────────────────────

test("26. no forbidden identifier source, framework, DB, network or save import", () => {
  const code = readFileSync(MODULE_SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  for (const forbidden of [
    "randomUUID", "Math.random", "Date.now", "new Date", "performance.now",
    "createWizardRowId", "safe-random-uuid", "lib/uuid",
    "from \"react\"", "useState", "useEffect",
    "supa" + "base", "createClient", ".rpc(", "fetch(",
    "saveEstimateFromWizard", "persistence-gateway", "reportObservabilityEvent",
  ]) {
    assert.equal(code.includes(forbidden), false, `module references ${forbidden}`);
  }

  // No browser global is read at module scope (or anywhere).
  for (const global of ["window.", "document.", "globalThis.", "sessionStorage", "localStorage", "history."]) {
    assert.equal(code.includes(global), false, `module reads the browser global ${global}`);
  }

  // No counter-based identity.
  assert.equal(/\+\+|counter|sequence/i.test(code), false, "no counter-derived identity");
  // 16 random bytes per identifier, exactly as specified.
  assert.match(code, /ID_BYTES = 16/);
});

test("27. the shared IDEMPOTENCY_KEY_PATTERN is IMPORTED, never redeclared", () => {
  const code = readFileSync(MODULE_SRC, "utf8");
  assert.match(code, /import \{ IDEMPOTENCY_KEY_PATTERN \} from "\.\/wizard-save-intent-types"/,
    "imported from the single authority");
  assert.equal(/IDEMPOTENCY_KEY_PATTERN\s*=/.test(code), false, "never assigned locally");
  assert.equal(code.includes("[A-Za-z0-9_-]{16,64}"), false, "the authority's regex is never copied");

  // The session-id and estimate-id grammars ARE local, by design.
  assert.match(code, /WIZARD_SESSION_ID_PATTERN = \/\^ws\\\./);
  assert.match(code, /ESTIMATE_ID_PATTERN =/);
});

// ── Branding ────────────────────────────────────────────────────────────────

test("the validated session cannot be forged by an ordinary object literal", () => {
  const code = readFileSync(MODULE_SRC, "utf8");
  // The brand is declared but never exported, and never assigned at runtime.
  assert.match(code, /declare const WIZARD_SESSION_BRAND: unique symbol/);
  assert.equal(/export .*WIZARD_SESSION_BRAND/.test(code), false, "the brand is not exported");
  assert.equal(/export type SessionBrand/.test(code), false, "the brand type is not exported");
  // No unsafe public constructor.
  for (const unsafe of ["export function createValidatedSession", "export const createValidatedSession"]) {
    assert.equal(code.includes(unsafe), false, `${unsafe} would defeat the brand`);
  }

  // Runtime shape check: non-completed arms carry no estimateId.
  const { h, ws } = started();
  const r = markWizardSessionPending(h.deps, ws);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("estimateId" in (r.session as unknown as Record<string, unknown>), false);
});

test("isValidWizardSessionId agrees with the recovery grammar", () => {
  assert.equal(isValidWizardSessionId("ws.0123456789abcdef0123456789abcdef"), true);
  for (const bad of ["", "ws.", "WS.0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef", 42]) {
    assert.equal(isValidWizardSessionId(bad), false, JSON.stringify(bad));
  }
});

// A compile-time reminder that the exported type is the branded one.
export type _SessionTypeIsExported = ValidatedWizardSession;
