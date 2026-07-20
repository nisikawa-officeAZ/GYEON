// R56E — behavioural tests for the legacy (disabled) save action's idempotency-key contract.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/components/estimates/wizard/save/save-estimate-from-wizard-action.test.ts
//
// The action is a "use server" module that reaches Supabase-backed auth helpers, so the three auth
// boundaries are replaced with mock.module. The gateway MODULE is replaced with a controlled spy so
// the assertion "a malformed key never reaches persistence" is observed, not inferred — and so the
// exact payload handed across the seam can be inspected.
//
// Deliberately NOT mocked: EstimatePersistenceService, buildEstimateSaveRpcPayload and
// validateEstimateSaveRequest all run for real, so the byte-for-byte pass-through is proven through
// the genuine production path rather than a stub of it. No dependency injection and no new
// production export was added to make this testable.
//
// `--experimental-test-module-mocks` is required on Node >= 22 and is NOT permitted in NODE_OPTIONS.

import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";

// ─── Controlled auth boundaries ──────────────────────────────────────────────

type AuthState = {
  user:   { id: string } | null;
  dealer: { dealer_id: string; role: string } | null;
  cap:    { error: string } | Record<string, unknown>;
};

const USER   = "33333333-3333-4333-8333-333333333333";
const DEALER = "11111111-1111-4111-8111-111111111111";

let auth: AuthState;

function resetAuth() {
  auth = { user: { id: USER }, dealer: { dealer_id: DEALER, role: "owner" }, cap: { ok: true } };
}
resetAuth();

mock.module("@/lib/auth/get-current-user", {
  namedExports: { getCurrentUser: async () => auth.user },
});
mock.module("@/lib/auth/get-current-dealer", {
  namedExports: { getCurrentDealer: async () => auth.dealer },
});
mock.module("@/lib/auth/require-staff-capability", {
  namedExports: { requireStaffCapability: async () => auth.cap },
});

// ─── Controlled spy gateway ──────────────────────────────────────────────────
// Replaces the placeholder gateway module. EstimatePersistenceService imports BOTH
// `notImplementedPersistenceGateway` and `EstimatePersistenceNotImplementedError` (used with
// `instanceof`) from here, so both runtime exports must be supplied.

type GatewayCall = { payload: { idempotencyKey?: unknown }; ctx: { idempotencyKey?: unknown } };
const gatewayCalls: GatewayCall[] = [];

class SpyNotImplementedError extends Error {
  readonly code = "RPC_NOT_IMPLEMENTED" as const;
  constructor() {
    super("Estimate persistence RPC is not implemented yet.");
    this.name = "EstimatePersistenceNotImplementedError";
  }
}

mock.module("./estimate-persistence-gateway", {
  namedExports: {
    EstimatePersistenceNotImplementedError: SpyNotImplementedError,
    notImplementedPersistenceGateway: {
      async saveEstimate(payload: GatewayCall["payload"], ctx: GatewayCall["ctx"]) {
        gatewayCalls.push({ payload, ctx });
        return {
          ok: true,
          estimateId: "e-1", estimateNumber: "EST-00001",
          customerId: "c-1", vehicleId: "v-1", replay: false,
        };
      },
    },
  },
});

// ─── Captured logs (must never contain the key) ──────────────────────────────
//
// `logEstimateSaveStage` writes through console.INFO:
//   console.info("[saveEstimateFromWizard]", JSON.stringify(entry));
// Capturing only log/error would leave the canary asserting against an empty buffer — it would pass
// without ever observing the real production channel. Every console channel that could carry a
// diagnostic is therefore intercepted, and ALL of them are restored in `after` so no global stays
// replaced for other test files in the same process.

const CONSOLE_CHANNELS = ["info", "log", "warn", "error", "debug"] as const;
type ConsoleChannel = (typeof CONSOLE_CHANNELS)[number];

const logLines: string[] = [];
const realConsole: Partial<Record<ConsoleChannel, (...a: unknown[]) => void>> = {};

for (const ch of CONSOLE_CHANNELS) {
  realConsole[ch] = console[ch].bind(console);
  console[ch] = (...a: unknown[]) => { logLines.push(a.map(String).join(" ")); };
}

after(() => {
  for (const ch of CONSOLE_CHANNELS) {
    const original = realConsole[ch];
    if (original) console[ch] = original;
  }
});

// tsx compiles this package to CJS, where top-level await is unavailable.
type ActionModule = typeof import("./save-estimate-from-wizard-action");
let saveEstimateFromWizardAction: ActionModule["saveEstimateFromWizardAction"];

before(async () => {
  const m = await import("./save-estimate-from-wizard-action");
  saveEstimateFromWizardAction = m.saveEstimateFromWizardAction;
});

beforeEach(() => {
  resetAuth();
  gatewayCalls.length = 0;
  logLines.length = 0;
});

// ─── A complete, valid EstimateSaveRequest ───────────────────────────────────
// Mirrors the shape the real validator accepts, so a rejection can only come from the key.

function validRequest(): Record<string, unknown> {
  return {
    customer: {
      mode: "new", name: "山田太郎", phone: "090-0000-0000", email: "a@example.test",
      postalCode: "1000001", address: "東京都", lineId: "",
      isBusiness: false, tradeRatePercent: null,
      accountsReceivableAllowed: false, closingDay: null, paymentDay: null,
    },
    vehicle: {
      mode: "new", maker: "TOYOTA", model: "CROWN", grade: "", vehicleCode: "", vin: "",
      firstRegistration: "", registrationDate: "", inspectionExpiry: "",
      displacement: "", color: "", plateNumber: "", bodySizeKey: "M",
    },
    services: [{
      lineId: "manual:maintenance:maint-a", category: "maintenance",
      pricingSource: "manual", pricingReferenceId: null,
      manualPricingIdentity: "maintenance:maint-a",
      label: "メンテA", description: null,
      quantity: 1, unitPrice: 5000, subtotal: 5000,
      selectedOptionReferenceIds: [], metadata: {},
    }],
    nonPriceableSelections: [],
    discount: {
      intent: { mode: "none", fixedAmount: null, percentage: null, percentageSupported: false },
      appliedAmount: null,
    },
    coupon: { selectedCouponIds: [], status: "none", appliedAmount: null },
    pricing: {
      currency: "JPY", completeness: "complete",
      subtotal: 5000, discountTotal: 0, couponTotal: 0, taxableSubtotal: 5000,
      taxRatePercent: 10, taxTotal: 500, grandTotal: 5500,
      warnings: [], errors: [], unresolvedItems: [],
    },
    notes: { customerNotes: "", internalMemo: "" },
    metadata: {
      source: "estimate-wizard-v2.2", schemaVersion: "2.2", createdFromWizard: true,
      draftLastUpdatedAt: "2026-01-01T00:00:00.000Z", previewConfirmed: true,
      estimateNumber: null,
    },
  };
}

const K16 = "abcdefghijklmnop";                       // exactly 16
const K64 = "a".repeat(64);                           // exactly 64
const REQ = "req-0001";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (key: unknown, requestId = REQ) =>
  saveEstimateFromWizardAction(validRequest() as any, { requestId, idempotencyKey: key });

// ─── Accepted keys ───────────────────────────────────────────────────────────

test("a valid 16-character key is accepted and reaches the gateway", async () => {
  const res = await call(K16);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(gatewayCalls.length, 1);
});

test("a valid 64-character key is accepted", async () => {
  const res = await call(K64);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(gatewayCalls.length, 1);
});

test("the full legal alphabet is accepted", async () => {
  const res = await call("AZaz09_-AZaz09_-");
  assert.equal(res.ok, true, JSON.stringify(res));
});

// ─── Byte-for-byte pass-through ──────────────────────────────────────────────

test("the payload idempotencyKey equals the input BYTE-FOR-BYTE", async () => {
  const key = "Aa0_-Zz9_-Aa0_-Zz9";
  await call(key);
  assert.equal(gatewayCalls.length, 1);
  const seen = gatewayCalls[0].payload.idempotencyKey;
  assert.equal(seen, key);
  assert.equal(typeof seen, "string");
  assert.equal((seen as string).length, key.length, "no trimming or padding");
  assert.deepEqual([...(seen as string)], [...key], "identical code unit sequence");
});

test("the strict context also carries the exact key, distinct from requestId", async () => {
  await call(K16, REQ);
  const ctx = gatewayCalls[0].ctx;
  assert.equal(ctx.idempotencyKey, K16);
  assert.notEqual(ctx.idempotencyKey, REQ, "the key is never derived from requestId");
});

// ─── Rejected keys ───────────────────────────────────────────────────────────

const REJECTED: Array<[string, unknown]> = [
  ["15 characters",        "a".repeat(15)],
  ["65 characters",        "a".repeat(65)],
  ["null",                 null],
  ["undefined",            undefined],
  ["empty string",         ""],
  ["whitespace only",      "   "],
  ["tab/newline only",     "\t\n"],
  ["leading whitespace",   `  ${K16}`],
  ["trailing whitespace",  `${K16}  `],
  ["surrounding space",    ` ${K16} `],
  ["illegal '!'",          "aaaaaaaaaaaaaaa!"],
  ["illegal '.'",          "aaaaaaaaaaaaaaa."],
  ["illegal '/'",          "aaaaaaaaaaaaaa/x"],
  ["embedded newline",     "aaaaaaaaaaaaaaa\n"],
  ["non-ASCII",            "アアアアアアアアアアアアアアアア"],
  ["number",               12345678901234567],
  ["boolean",              true],
  ["object",               {}],
  ["array",                []],
  ["String object",        new String(K16)],
];

for (const [label, value] of REJECTED) {
  test(`rejected: ${label}`, async () => {
    const res = await call(value);
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "VALIDATION_ERROR");
    assert.equal(res.stage, "validation");
    assert.equal(res.message, "入力内容に不備があります。");
    assert.equal(gatewayCalls.length, 0, "an invalid key must never reach the gateway");
  });
}

test("a missing meta object is rejected", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await saveEstimateFromWizardAction(validRequest() as any);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "VALIDATION_ERROR");
    assert.equal(res.stage, "validation");
  }
  assert.equal(gatewayCalls.length, 0);
});

test("a whitespace-padded but otherwise valid key is REJECTED, never trimmed", async () => {
  const res = await call(`  ${K16}  `);
  assert.equal(res.ok, false);
  assert.equal(gatewayCalls.length, 0, "trimming would have made this succeed");
});

// ─── No fallback generation ──────────────────────────────────────────────────

test("no UUID, timestamp or requestId fallback is generated for an invalid key", async () => {
  for (const bad of [null, undefined, "", "   ", "short", 42]) {
    gatewayCalls.length = 0;
    const res = await call(bad);
    assert.equal(res.ok, false);
    assert.equal(gatewayCalls.length, 0, "no substituted key was manufactured");
  }
});

test("the accepted key is never replaced by a generated value", async () => {
  await call(K16);
  const seen = String(gatewayCalls[0].payload.idempotencyKey);
  assert.equal(seen, K16);
  assert.equal(/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(seen), false, "not a UUID");
  assert.equal(/^\d{13}$/.test(seen), false, "not a timestamp");
  assert.notEqual(seen, REQ, "not the requestId");
});

// ─── Failure ordering: authorization always wins ─────────────────────────────

test("UNAUTHENTICATED wins over an invalid key", async () => {
  auth.user = null;
  const res = await call("bad");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "UNAUTHENTICATED");
    assert.equal(res.stage, "authentication");
  }
  assert.equal(gatewayCalls.length, 0);
});

test("DEALER_CONTEXT_REQUIRED wins over an invalid key", async () => {
  auth.dealer = null;
  const res = await call("bad");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "DEALER_CONTEXT_REQUIRED");
    assert.equal(res.stage, "dealer_context");
  }
  assert.equal(gatewayCalls.length, 0);
});

test("PERMISSION_DENIED wins over an invalid key", async () => {
  auth.cap = { error: "権限がありません。" };
  const res = await call("bad");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "PERMISSION_DENIED");
    assert.equal(res.stage, "permission");
  }
  assert.equal(gatewayCalls.length, 0);
});

test("the key check runs only after ALL THREE gates pass", async () => {
  // Same malformed key, walking the gates open one at a time.
  auth.user = null;
  assert.equal(((await call("bad")) as { stage?: string }).stage, "authentication");

  resetAuth(); auth.dealer = null;
  assert.equal(((await call("bad")) as { stage?: string }).stage, "dealer_context");

  resetAuth(); auth.cap = { error: "x" };
  assert.equal(((await call("bad")) as { stage?: string }).stage, "permission");

  resetAuth();
  assert.equal(((await call("bad")) as { stage?: string }).stage, "validation");
});

// ─── The key value is never leaked ───────────────────────────────────────────

test("the malformed key never appears in the result or in ANY captured console channel", async () => {
  const CANARY_PREFIX = "SECRET-LEAK-CANARY";
  const secret = `${CANARY_PREFIX}-!!!-9f3c`;   // '!' makes it malformed, so it must be rejected
  const res = await call(secret);
  assert.equal(res.ok, false);

  // ── The log channel must actually have been observed. Without this, every "absent" ────
  // ── assertion below could pass vacuously against an empty buffer.                  ────
  assert.ok(logLines.length > 0, "at least one console line was captured");
  const stageLines = logLines.filter((l) => l.includes("[saveEstimateFromWizard]"));
  assert.ok(stageLines.length > 0, "a real save-stage log line was captured (console.info)");

  const validationLine = stageLines.find((l) => l.includes('"stage":"validation"'));
  assert.ok(validationLine, "the captured log identifies the validation stage");
  assert.match(validationLine, /"errorCode":"VALIDATION_ERROR"/,
    "the captured log carries the stable VALIDATION_ERROR code");

  // ── Neither the full key nor its canary prefix may appear anywhere. ────────────────────
  const serialized = JSON.stringify(res);
  assert.equal(serialized.includes(secret), false, "full key not in the result");
  assert.equal(serialized.includes(CANARY_PREFIX), false, "no partial echo in the result");
  assert.equal(/issues/.test(serialized), false, "no issues array is attached");

  const logged = logLines.join("\n");
  assert.equal(logged.includes(secret), false, "full key not in any captured channel");
  assert.equal(logged.includes(CANARY_PREFIX), false, "no partial echo in any captured channel");
  assert.equal(validationLine.includes(CANARY_PREFIX), false,
    "the stage log itself carries ids/stage/outcome only");
});

test("console.info is the channel actually captured (guards against a vacuous canary)", async () => {
  logLines.length = 0;
  await call("aaaaaaaaaaaaaaa!");   // rejected -> logEstimateSaveStage fires
  assert.ok(
    logLines.some((l) => l.includes("[saveEstimateFromWizard]")),
    "logEstimateSaveStage writes via console.info and the harness intercepts it",
  );
});

test("a rejection carries no per-field diagnostic", async () => {
  const res = await call("aaaaaaaaaaaaaaa!");
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal("issues" in res && res.issues !== undefined, false,
      "R60B architect correction: no issues, no { path, code }");
  }
});

// ─── The valid path reaches only the controlled gateway ──────────────────────

test("only the controlled test gateway is reached; production binds the placeholder", async () => {
  await call(K16);
  assert.equal(gatewayCalls.length, 1, "exactly one gateway invocation");

  // Source-level: the shipped action binds the placeholder and never the real gateway.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    "src/components/estimates/wizard/save/save-estimate-from-wizard-action.ts", "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(src, /new EstimatePersistenceService\(\s*notImplementedPersistenceGateway\s*\)/,
    "production stays bound to the disabled gateway");
  assert.equal(src.includes("supabase" + "PersistenceGateway"), false,
    "the real gateway is never imported or bound");
  // Line-scoped: `requestId?.trim()` is legitimate and unrelated, so assert only that no trim is
  // ever applied to the KEY expression itself.
  assert.equal(/(idempotencyKey|rawKey)[^\n]*\.trim\(\)/.test(src), false,
    "the key is never trimmed");
  assert.match(src, /typeof rawKey !== "string" \|\| !IDEMPOTENCY_KEY_PATTERN\.test\(rawKey\)/,
    "the key is checked against the single shared pattern authority");
  assert.equal(/idempotencyKey\s*[?]{2}|idempotencyKey\s*\|\|/.test(src), false,
    "no null-coalescing or OR fallback on the key");
});
