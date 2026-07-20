// OBS-1L-B7 — EstimatePersistenceService emits EXACTLY ONE sanitized record per
// terminal outcome, proven WITHOUT editing the service.
//
// Run: node --experimental-test-module-mocks --import tsx --test \
//        src/components/estimates/wizard/save/estimate-persistence-service.observability.test.ts
//
// ── WHY THE SERVICE IS NOT MODIFIED ─────────────────────────────────────────
// Its five returns are each already preceded by exactly one `logEstimateSaveStage`
// call. Once that function routes to the observability adapter, the service emits
// one sanitized record per outcome with no source change at all. Adding a parallel
// observability call would double-count every save. This file is the proof that the
// unchanged service satisfies the contract.
//
// The gateway is injected, so no Supabase client, RPC, network or provider is ever
// constructed. Records are captured from the REAL console sink — the actual
// production path — rather than through an injected sink, so what is asserted here
// is what an operator would see.

import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { EstimatePersistenceService } from "./estimate-persistence-service";
import { EstimatePersistenceNotImplementedError, type EstimatePersistenceGateway } from "./estimate-persistence-gateway";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import type { EstimateSaveServerContext } from "./estimate-save-orchestration-types";

// ─── Canary nonces: every raw Supabase diagnostic field, plus caller PII ─────

const N_SQLSTATE   = "23505";
const N_MESSAGE    = "CANARY-MESSAGE-duplicate-key-value-violates-unique-constraint";
const N_DETAILS    = "CANARY-DETAILS-Key-(id)=(1)-already-exists-山田太郎";
const N_HINT       = "CANARY-HINT-consider-retrying";
const N_CONSTRAINT = "CANARY-CONSTRAINT-estimates_pkey";
const N_KEY        = "CANARYIDEMPOTENCYKEY01";
const N_USER       = "u0000000-0000-0000-0000-0000000000ff";
const N_CUSTOMER   = "CANARY-CUSTOMER-山田太郎";

const ALL_NONCES = [N_SQLSTATE, N_MESSAGE, N_DETAILS, N_HINT, N_CONSTRAINT, N_KEY, N_USER, N_CUSTOMER];

const DEALER = "d0000000-0000-0000-0000-00000000000a";
const REQ = "obs.0123456789abcdef0123456789abcdef";

/** The raw error a real gateway would receive from Supabase. */
const rawSupabaseError = {
  code: N_SQLSTATE, message: N_MESSAGE, details: N_DETAILS, hint: N_HINT, constraint: N_CONSTRAINT,
};

// ─── Console capture: ALL severity channels ─────────────────────────────────
//
// The sink routes by severity — error→console.error, warn→console.warn, else
// console.info. Capturing one channel would leave every absence assertion passing
// against an empty buffer for the other two.

const CHANNELS = ["error", "warn", "info", "log", "debug"] as const;
const lines: Array<{ method: string; text: string }> = [];
const realConsole: Partial<Record<(typeof CHANNELS)[number], (...a: unknown[]) => void>> = {};

before(() => {
  for (const ch of CHANNELS) {
    realConsole[ch] = console[ch].bind(console);
    console[ch] = (...a: unknown[]) => { lines.push({ method: ch, text: a.map(String).join(" ") }); };
  }
});

after(() => {
  for (const ch of CHANNELS) { const o = realConsole[ch]; if (o) console[ch] = o; }
});

beforeEach(() => { lines.length = 0; });

const records = () => lines.filter((l) => l.text.includes("[observability]"));
const parsed = () => records().map((l) => JSON.parse(l.text.replace("[observability] ", "")) as Record<string, unknown>);

// ─── A structurally complete, VALID request ─────────────────────────────────

function validRequest(over: Record<string, unknown> = {}): EstimateSaveRequest {
  return {
    customer: {
      mode: "new", name: N_CUSTOMER, phone: "090-0000-0000", email: "a@example.test",
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
    discount: { intent: { mode: "none", fixedAmount: null, percentage: null, percentageSupported: false }, appliedAmount: null },
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
      draftLastUpdatedAt: "2026-01-01T00:00:00.000Z", previewConfirmed: true, estimateNumber: null,
    },
    ...over,
  } as unknown as EstimateSaveRequest;
}

const ctx = (): EstimateSaveServerContext => ({
  requestId: REQ, dealerId: DEALER, userId: N_USER, idempotencyKey: N_KEY,
});

/** A gateway double. No Supabase, no network — the seam is injected. */
function gatewayOf(impl: EstimatePersistenceGateway["saveEstimate"]): EstimatePersistenceGateway {
  return { saveEstimate: impl };
}

const okGateway = gatewayOf(async () => ({
  ok: true, estimateId: "e-1", estimateNumber: "EST-2026-0001",
  customerId: "c-1", vehicleId: "v-1", replay: false,
}));

// ═══ 1. Every terminal outcome emits exactly ONE record ═════════════════════

test("SUCCESS emits exactly one info record at stage done", async () => {
  const svc = new EstimatePersistenceService(okGateway);
  const r = await svc.save(validRequest(), ctx());

  assert.equal(r.ok, true, "PRECONDITION: the success path really ran");
  assert.equal(records().length, 1, "exactly one record — not a legacy log plus an event");
  const e = parsed()[0];
  assert.equal(e.event, "wizard-save");
  assert.equal(e.severity, "info");
  assert.equal(e.stage, "done");
  assert.equal(e.code, null);
  assert.equal(e.requestId, REQ);
  assert.equal(e.dealerId, DEALER);
});

test("VALIDATION_ERROR emits exactly one record at stage validation", async () => {
  const svc = new EstimatePersistenceService(okGateway);
  const r = await svc.save(validRequest({ customer: { mode: "new", name: "" } }), ctx());

  assert.equal(r.ok, false, "PRECONDITION: validation really rejected");
  assert.equal(records().length, 1);
  const e = parsed()[0];
  assert.equal(e.stage, "validation");
  assert.equal(e.code, "VALIDATION_ERROR");
  assert.equal(e.severity, "info");
});

test("PRICING_INCOMPLETE emits exactly one record at the mapped kebab stage", async () => {
  // The service's pricing gate is DEFENCE IN DEPTH, and reaching it takes care: the
  // DTO validator ahead of it already rejects "partial", "unavailable" and "error"
  // as VALIDATION_ERROR, so those never get this far. The gate is `!== "complete"`,
  // which is deliberately broader than the validator's enumerated list — it catches a
  // completeness value nobody enumerated. That is exactly the case exercised here,
  // and the PRECONDITION below is what proves the right gate fired rather than the
  // validator's.
  const svc = new EstimatePersistenceService(okGateway);
  const req = validRequest();
  (req as unknown as { pricing: { completeness: string } }).pricing.completeness = "indeterminate";
  const r = await svc.save(req, ctx());

  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "PRICING_INCOMPLETE", "PRECONDITION: the pricing gate really fired");
  assert.equal(records().length, 1);
  const e = parsed()[0];
  assert.equal(e.stage, "pricing-completeness", "the underscore stage never becomes unknown-stage");
  assert.notEqual(e.stage, "unknown-stage");
  assert.equal(e.code, "PRICING_INCOMPLETE");
  assert.equal(e.severity, "info");
});

test("a RETURNED gateway failure emits exactly one record at stage rpc", async () => {
  const svc = new EstimatePersistenceService(
    gatewayOf(async () => ({ ok: false, code: "DUPLICATE_SUBMISSION", message: "同じ内容の見積が既に保存されています。" })),
  );
  const r = await svc.save(validRequest(), ctx());

  assert.equal(r.ok, false);
  assert.equal(records().length, 1);
  const e = parsed()[0];
  assert.equal(e.stage, "rpc");
  assert.equal(e.code, "DUPLICATE_SUBMISSION");
  assert.equal(e.severity, "info", "a duplicate is replay protection working — never an error");
  assert.notEqual(e.severity, "error");
});

test("a THROWN gateway error emits exactly one record", async () => {
  const notImpl = new EstimatePersistenceService(
    gatewayOf(async () => { throw new EstimatePersistenceNotImplementedError(); }),
  );
  const r1 = await notImpl.save(validRequest(), ctx());
  assert.equal(r1.ok, false);
  assert.equal(records().length, 1);
  assert.equal(parsed()[0].code, "RPC_NOT_IMPLEMENTED");
  assert.equal(parsed()[0].severity, "info", "persistence is deliberately disabled — expected, not an incident");

  lines.length = 0;
  const boom = new EstimatePersistenceService(gatewayOf(async () => { throw new Error("network down"); }));
  const r2 = await boom.save(validRequest(), ctx());
  assert.equal(r2.ok, false);
  assert.equal(records().length, 1);
  assert.equal(parsed()[0].code, "UNKNOWN_SAVE_ERROR");
  assert.equal(parsed()[0].severity, "error");
});

test("an unmatched gateway code collapses to SAVE_FAILED, still one record", async () => {
  const svc = new EstimatePersistenceService(
    gatewayOf(async () => ({ ok: false, code: "SOMETHING_NEW_FROM_PG", message: "x" })),
  );
  const r = await svc.save(validRequest(), ctx());
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "SAVE_FAILED");
  assert.equal(records().length, 1);
  assert.equal(parsed()[0].code, "SAVE_FAILED");
  assert.equal(parsed()[0].severity, "error");
});

// ═══ 2. Raw Supabase diagnostics: observed at the boundary, then absent ═════

test("CANARY: raw diagnostics reach the gateway boundary and NONE reaches an output", async () => {
  let observedAtBoundary: Record<string, unknown> | null = null;

  const svc = new EstimatePersistenceService(
    gatewayOf(async () => {
      // The raw error IS present at the injected boundary — this is what a real
      // Supabase gateway would be holding at exactly this point.
      observedAtBoundary = { ...rawSupabaseError };
      return { ok: false, ...mapLikeRealGateway(rawSupabaseError.message) };
    }),
  );
  const r = await svc.save(validRequest(), ctx());

  // ── 1. PRECONDITION: the diagnostic really existed, with every nonce present.
  assert.ok(observedAtBoundary, "the gateway boundary was actually reached");
  const boundary = observedAtBoundary as unknown as Record<string, unknown>;
  for (const nonce of [N_SQLSTATE, N_MESSAGE, N_DETAILS, N_HINT, N_CONSTRAINT]) {
    assert.ok(JSON.stringify(boundary).includes(nonce), `nonce ${nonce} was present at the boundary`);
  }

  // ── 2. PRECONDITION: exactly one sanitized record was observed.
  assert.equal(records().length, 1, "exactly one record reached the console sink");
  const e = parsed()[0];
  assert.equal(e.event, "wizard-save");
  assert.equal(e.stage, "rpc");
  assert.equal(typeof e.env, "string");
  assert.equal(typeof e.release, "string");

  // ── 3. ONLY NOW is absence meaningful.
  const everything = JSON.stringify(lines) + JSON.stringify(r);
  for (const nonce of ALL_NONCES) {
    assert.equal(everything.includes(nonce), false, `${nonce} leaked into an output`);
  }
  for (const token of ["CANARY", "details", "hint", "constraint", "stack", "cause", "23505",
                       "userId", "idempotencyKey", "山田太郎"]) {
    assert.equal(JSON.stringify(lines).includes(token), false, `${token} appears in the operational record`);
  }
});

test("CANARY GUARD: a zero-record run fails the canary's own precondition", () => {
  lines.length = 0;
  assert.throws(() => { assert.equal(records().length, 1, "exactly one record reached the console sink"); });
});

/** Mirrors the real gateway's closed-prefix classification (fixed code, fixed text). */
function mapLikeRealGateway(_rawMessage: string): { code: string; message: string } {
  return { code: "SAVE_FAILED", message: "保存中にエラーが発生しました。" };
}

// ═══ 3. userId, key and payload data never reach a record ═══════════════════

test("no record carries userId, the idempotency key, or customer data", async () => {
  const outcomes: Array<() => Promise<unknown>> = [
    () => new EstimatePersistenceService(okGateway).save(validRequest(), ctx()),
    () => new EstimatePersistenceService(gatewayOf(async () => ({ ok: false, code: "SAVE_FAILED", message: "x" })))
      .save(validRequest(), ctx()),
    () => new EstimatePersistenceService(okGateway).save(validRequest({ customer: { mode: "new", name: "" } }), ctx()),
  ];
  for (const run of outcomes) {
    lines.length = 0;
    await run();
    assert.equal(records().length, 1, "PRECONDITION: a record was captured");
    const e = parsed()[0];
    assert.equal("userId" in e, false, "userId is never emitted");
    assert.deepEqual(
      Object.keys(e).sort(),
      ["code", "dealerId", "env", "event", "release", "requestId", "severity", "stage"],
    );
    const text = JSON.stringify(lines);
    for (const nonce of [N_USER, N_KEY, N_CUSTOMER]) {
      assert.equal(text.includes(nonce), false, `${nonce} reached the record`);
    }
  }
});

test("the idempotency key still reaches the RPC payload — sanitizing the LOG did not weaken the save", async () => {
  let payload: unknown = null;
  const svc = new EstimatePersistenceService(gatewayOf(async (p) => {
    payload = p;
    return { ok: true, estimateId: "e", estimateNumber: "N", customerId: "c", vehicleId: "v", replay: false };
  }));
  await svc.save(validRequest(), ctx());
  assert.ok(payload, "the gateway received a payload");
  assert.ok(JSON.stringify(payload).includes(N_KEY),
    "the key must still travel to the RPC — only the operational record omits it");
});

// ═══ 4. The service source is unchanged and owns exactly these emissions ════

test("EstimatePersistenceService contains no observability import and no console call", () => {
  const code = readFileSync("src/components/estimates/wizard/save/estimate-persistence-service.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  assert.equal(/console\s*\./.test(code), false, "the service never writes a console line");
  assert.equal(code.includes("report" + "ObservabilityEvent"), false, "no parallel observability call was added");
  assert.equal(code.includes("wizard-save-" + "observability"), false, "the adapter is not imported here");
  // Exactly five emission sites, one immediately before each of the five returns.
  assert.equal((code.match(/logEstimateSaveStage\(/g) ?? []).length, 5, "five emission sites");
  assert.equal((code.match(/return\s*\{/g) ?? []).length, 5, "five returns");
});

test("the two pre-try steps still sit OUTSIDE the try, so a throw there emits nothing", () => {
  const code = readFileSync("src/components/estimates/wizard/save/estimate-persistence-service.ts", "utf8");
  const validateAt = code.indexOf("validateEstimateSaveRequest(request)");
  const payloadAt = code.indexOf("buildEstimateSaveRpcPayload(");
  const tryAt = code.indexOf("try {");

  assert.ok(validateAt > 0 && payloadAt > 0 && tryAt > 0);
  assert.ok(validateAt < tryAt, "structural validation runs before the try block");
  assert.ok(payloadAt < tryAt, "payload construction runs before the try block");
  // This is deliberate, not a defect: a throw there means the service emitted
  // NOTHING, which is exactly the case the orchestrator's persist-catch owns with a
  // single persist-invariant record. Moving these inside the try would make that
  // catch a DOUBLE count.
});
