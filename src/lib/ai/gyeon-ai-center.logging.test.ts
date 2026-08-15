// OBS-1L-LEGACY — AI Center non-leakage regression test.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/lib/ai/gyeon-ai-center.logging.test.ts
//
// `gyeon-ai-center.ts` is a "use server" module reaching Supabase, admin auth,
// encryption and the audit log. Every one of those boundaries is replaced with
// mock.module BEFORE the module is imported, so this test performs no database,
// network, environment or OpenAI access.
//
// ── WHY THIS TEST IS NOT A SOURCE ASSERTION ─────────────────────────────────
// A grep proves what the file SAYS. This drives the real failing path with a
// Supabase error whose every diagnostic field carries a distinct nonce, captures
// what the process actually logged, and only then asserts absence. It fails
// against the pre-correction implementation — that is what makes it a
// regression test rather than a description of one.

import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── Canary nonces ──────────────────────────────────────────────────────────
// Each occupies a different Supabase diagnostic field. `code` is deliberately a
// real SQLSTATE shape: an operational event must never carry one.

const N_CODE       = "23505";
const N_MESSAGE    = "CANARY-MESSAGE-duplicate-key-value-violates-unique-constraint";
const N_DETAILS    = "CANARY-DETAILS-Key-(id)=(1)-already-exists-山田太郎";
const N_HINT       = "CANARY-HINT-consider-retrying-the-upsert";
const N_CONSTRAINT = "CANARY-CONSTRAINT-gyeon_ai_settings_pkey";
const RAW_KEY      = "sk-CANARY-RAWKEY-0000000000000000000000000000";
const ENCRYPTED    = "CANARY-ENCRYPTED-BLOB-must-never-be-logged";

const ALL_NONCES = [N_CODE, N_MESSAGE, N_DETAILS, N_HINT, N_CONSTRAINT, RAW_KEY, ENCRYPTED];

const FIXED_LABEL = "[AI Center] gyeon_ai_settings upsert failed";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

// ─── Recorder ───────────────────────────────────────────────────────────────

type Recorded = {
  requireSuperAdmin: number;
  fromTables: string[];
  upserts: Array<{ payload: unknown; opts: unknown }>;
  auditCalls: number;
  consoleCalls: Array<{ method: string; args: unknown[] }>;
};

let rec: Recorded;

function resetRecorder() {
  rec = { requireSuperAdmin: 0, fromTables: [], upserts: [], auditCalls: 0, consoleCalls: [] };
}
resetRecorder();

/** The Supabase upsert error, loaded with a nonce in every diagnostic field. */
const upsertError = {
  code:       N_CODE,
  message:    N_MESSAGE,
  details:    N_DETAILS,
  hint:       N_HINT,
  constraint: N_CONSTRAINT,
};

// ─── Boundary mocks (registered before the module under test is imported) ────
//
// Node 26 renamed the mock.module() export option. The previous spelling now
// emits a DeprecationWarning, and a warning in a security regression test is
// noise that trains operators to ignore this file's output.
//
// The installed @types/node (20.19.43) still describes only the OLD option and
// does not yet describe the current one, so calling mock.module() directly with
// the current option would not typecheck. Rather than defeat the type system
// with a cast or a suppression comment — which would also silence any genuine
// future signature change — the call is made through Reflect.apply, which is
// itself fully typed. The runtime therefore receives exactly the current
// option, while the stale declaration is neither trusted nor overridden.
//
// This is a TEST-HARNESS concern only: no mocked boundary, exported function or
// assertion changes.

function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/admin/require-admin", {
  requireSuperAdmin: async () => { rec.requireSuperAdmin += 1; return { id: ADMIN_ID }; },
});

mockModule("@/lib/supabase/admin", {
  createAdminClient: () => ({
    from(table: string) {
      rec.fromTables.push(table);
      return {
        upsert(payload: unknown, opts: unknown) {
          rec.upserts.push({ payload, opts });
          return Promise.resolve({ error: upsertError });
        },
      };
    },
  }),
});

mockModule("@/lib/auth/get-current-user", {
  getCurrentUser: async () => ({ id: USER_ID }),
});

mockModule("@/lib/admin/write-audit-log", {
  writeAuditLog: async () => { rec.auditCalls += 1; },
});

mockModule("./crypto", {
  encryptApiKey: () => ENCRYPTED,
  isEncryptionConfigured: () => true,
});

mockModule("./validate-api-key", {
  validateApiKeyFormat: () => null,   // null = valid
});

mockModule("./gyeon-managed-key", {
  getGyeonManagedApiKey: async () => null,
});

// ─── Console capture (raw arguments, not a joined string) ────────────────────

const CHANNELS = ["error", "warn", "log", "info", "debug"] as const;
const realConsole: Partial<Record<(typeof CHANNELS)[number], (...a: unknown[]) => void>> = {};

for (const ch of CHANNELS) {
  realConsole[ch] = console[ch].bind(console);
  console[ch] = (...args: unknown[]) => { rec.consoleCalls.push({ method: ch, args }); };
}

after(() => {
  for (const ch of CHANNELS) {
    const original = realConsole[ch];
    if (original) console[ch] = original;
  }
});

// tsx compiles this package to CJS, where top-level await is unavailable.
type Mod = typeof import("./gyeon-ai-center");
let saveGyeonOpenAiKey: Mod["saveGyeonOpenAiKey"];

before(async () => {
  const m = await import("./gyeon-ai-center");
  saveGyeonOpenAiKey = m.saveGyeonOpenAiKey;
});

beforeEach(() => { resetRecorder(); });

/** Serialise one console call the way a log collector would see it. */
const renderCall = (c: { method: string; args: unknown[] }): string =>
  c.args.map((a) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" ");

// ─── PRECONDITIONS — the failing path really executed ───────────────────────

test("PRECONDITION: the real failing upsert path executes end to end", async () => {
  const result = await saveGyeonOpenAiKey(RAW_KEY);

  assert.equal(rec.requireSuperAdmin, 1, "requireSuperAdmin was called");
  assert.deepEqual(rec.fromTables, ["gyeon_ai_settings"], "gyeon_ai_settings was selected");
  assert.equal(rec.upserts.length, 1, "upsert was called exactly once");
  assert.equal(rec.consoleCalls.length, 1, "exactly one console call was captured");
  assert.equal(rec.consoleCalls[0].method, "error", "it was console.error");
  assert.ok(
    rec.consoleCalls.some((c) => renderCall(c).includes(FIXED_LABEL)),
    "the fixed AI Center label was observed",
  );
  assert.equal(result.success, false, "the action reported failure");
});

test("PRECONDITION: every nonce really is present on the injected error", () => {
  // If a nonce were absent from the fixture, every absence assertion below would
  // pass vacuously. Prove the canaries exist before proving they do not leak.
  assert.equal(upsertError.code, N_CODE);
  assert.equal(upsertError.message, N_MESSAGE);
  assert.equal(upsertError.details, N_DETAILS);
  assert.equal(upsertError.hint, N_HINT);
  assert.equal(upsertError.constraint, N_CONSTRAINT);
  const fixture = JSON.stringify(upsertError);
  for (const n of [N_CODE, N_MESSAGE, N_DETAILS, N_HINT, N_CONSTRAINT]) {
    assert.ok(fixture.includes(n), `fixture is missing nonce ${n}`);
  }
});

// ─── NON-LEAKAGE — meaningful only because the preconditions passed ─────────

test("no diagnostic nonce reaches any captured console argument", async () => {
  await saveGyeonOpenAiKey(RAW_KEY);
  assert.equal(rec.consoleCalls.length, 1, "the log really happened");

  for (const call of rec.consoleCalls) {
    const rendered = renderCall(call);
    for (const nonce of ALL_NONCES) {
      assert.equal(rendered.includes(nonce), false, `console leaked ${nonce}`);
    }
    // Per-argument, so a non-string argument cannot smuggle a value through.
    for (const arg of call.args) {
      const asText = typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg);
      for (const nonce of ALL_NONCES) {
        assert.equal(asText.includes(nonce), false, `a console argument leaked ${nonce}`);
      }
    }
  }
});

test("the console call is a single fixed label with no interpolated diagnostic", async () => {
  await saveGyeonOpenAiKey(RAW_KEY);
  const call = rec.consoleCalls[0];
  assert.equal(call.args.length, 1, "exactly one argument — a fixed label, nothing appended");
  assert.equal(call.args[0], FIXED_LABEL, "the label is the whole message");
});

test("no raw Error or object was serialized into the log", async () => {
  await saveGyeonOpenAiKey(RAW_KEY);
  for (const call of rec.consoleCalls) {
    for (const arg of call.args) {
      assert.equal(arg instanceof Error, false, "an Error instance was logged");
      assert.equal(typeof arg === "object" && arg !== null, false, "an object was logged");
    }
  }
});

test("no nonce reaches the user-facing result, and no diagnostic code is interpolated", async () => {
  const result = await saveGyeonOpenAiKey(RAW_KEY);
  assert.equal(result.success, false);

  const serialized = JSON.stringify(result);
  for (const nonce of ALL_NONCES) {
    assert.equal(serialized.includes(nonce), false, `the result leaked ${nonce}`);
  }
  assert.equal(serialized.includes("23505"), false, "a SQLSTATE reached the operator");
  // The old shape interpolated `（code）` after the first sentence.
  assert.equal(/（[^）]*\d[^）]*）/.test(serialized), false, "an interpolated diagnostic code remains");
});

test("the controlled Japanese response is exactly the approved copy", async () => {
  const result = await saveGyeonOpenAiKey(RAW_KEY);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(
    result.error,
    "APIキーの保存に失敗しました。接続中のSupabaseプロジェクトに " +
      "gyeon_ai_settings テーブルが存在しない可能性があります。" +
      "対象プロジェクトのSQL Editorでマイグレーション094/095を適用してください。",
  );
});

test("the raw and encrypted API keys never appear in logs or the result", async () => {
  const result = await saveGyeonOpenAiKey(RAW_KEY);
  const everything = JSON.stringify(result) + rec.consoleCalls.map(renderCall).join(" ");
  assert.equal(everything.includes(RAW_KEY), false, "the raw key leaked");
  assert.equal(everything.includes(ENCRYPTED), false, "the encrypted key leaked");
  assert.equal(everything.includes("sk-CANARY"), false, "a key fragment leaked");
});

test("writeAuditLog is NOT called when the upsert fails", async () => {
  await saveGyeonOpenAiKey(RAW_KEY);
  assert.equal(rec.auditCalls, 0, "a failed save must not write an audit entry");
});

test("the upsert payload still carries the encrypted key and the same shape", async () => {
  await saveGyeonOpenAiKey(RAW_KEY);
  const { payload, opts } = rec.upserts[0];
  const p = payload as Record<string, unknown>;
  assert.equal(p.id, 1);
  assert.equal(p.openai_api_key_encrypted, ENCRYPTED, "encryption behaviour unchanged");
  assert.equal(p.last_tested_at, null);
  assert.equal(p.last_test_status, null);
  assert.equal(p.updated_by, USER_ID, "currentUser handling unchanged");
  assert.equal(typeof p.updated_at, "string");
  assert.deepEqual(opts, { onConflict: "id" });
});

// ─── Source guard on the corrected production file ──────────────────────────

test("the production file accesses no Supabase diagnostic field", () => {
  const raw = readFileSync("src/lib/ai/gyeon-ai-center.ts", "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // Tokens are assembled from fragments so this guard never matches its own literals.
  const forbidden = [
    "error." + "code", "error." + "message", "error." + "details",
    "error." + "hint", "error." + "stack", "error." + "cause",
  ];
  for (const token of forbidden) {
    assert.equal(code.includes(token), false, `production file accesses ${token}`);
  }
  assert.equal(/JSON\.stringify\s*\(\s*error/.test(code), false, "serializes the error");
  assert.equal(/console\.[a-z]+\([^)]*,\s*error\s*[,)]/.test(code), false, "passes the raw error to console");
});

test("the file has exactly one console call, and it is the fixed label", () => {
  const raw = readFileSync("src/lib/ai/gyeon-ai-center.ts", "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal((code.match(/console\./g) ?? []).length, 1, "exactly one console call in the file");
  assert.ok(code.includes(FIXED_LABEL), "and it carries the fixed label");
});
