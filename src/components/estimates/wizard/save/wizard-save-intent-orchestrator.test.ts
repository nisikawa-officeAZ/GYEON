// EW-UI-5A1-B3 — Unit tests for the pure save-intent orchestrator (no database, no server module).
// Run: node --import tsx --test src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts
//
// The Server Action is NEVER imported here — importing it would pull `server-only` into node:test.
// Its guarantees are asserted by inspecting its SOURCE TEXT instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { runWizardSaveIntent, type WizardSaveIntentDeps } from "./wizard-save-intent-orchestrator";
import type {
  WizardSaveFailureReport, WizardSaveIntentResult, WizardSaveIntentValidation,
} from "./wizard-save-intent-types";
import { resolveEstimateSaveActorContext, type EstimateSaveActorContextFailure } from "@/lib/auth/estimate-save-actor-context";
import type { AuthoritativeWizardRuntimeConfiguration } from "@/lib/wizard-catalog/wizard-runtime-config";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import type { ConfigSaveMapperResult } from "./estimate-save-mapper-from-config";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import type { EstimateSaveActionResult } from "./estimate-save-orchestration-types";
import type { EstimateSaveValidationResult } from "./estimate-save-errors";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";

const USER = "u0000000-0000-0000-0000-000000000001";
const DEALER = "d0000000-0000-0000-0000-00000000000a";
const OTHER_DEALER = "d0000000-0000-0000-0000-00000000000b";
const KEY = "abcdefghijklmnop";
const REQ = "req_test000000000000000000000000";

// ── A GENUINE branded actor context, produced by the real P0 core (never cast) ──
async function realActorContext() {
  const r = await resolveEstimateSaveActorContext({
    getUserId: async () => USER,
    getActiveMemberships: async () => ({ ok: true, rows: [{ dealer_id: DEALER, role: "owner" }] }),
    getActiveStaffRole: async () => ({ ok: true, role: null }),
  });
  if (!r.ok) throw new Error("fixtureless actor context must resolve");
  return r;
}

// ── Minimal but structurally complete runtime configuration ──
function runtimeConfig(over: { dealerId?: string; currentRevision?: number } = {}): AuthoritativeWizardRuntimeConfiguration {
  return {
    ok: true,
    dealerId: over.dealerId ?? DEALER,
    shopRank: "shop",
    catalog: DEFAULT_PRICING_CATALOG,
    screenConfig: {
      // B2-E2G: every managed family opted OUT — this fixture configures none of them.
      serviceOfferings: { window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
      maintenanceMenus: [], washMenus: [], roomMenus: [], filmTypes: [], windowAreas: [],
      otherWorkPresets: [], storeGlobalOptions: [], coupons: [], ppfMethods: [], ppfParts: [], ppfTypeGroups: [],
    },
    pricingConfig: {
      ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
    },
    lifecycle: { state: "CATALOG_REVIEWED", currentRevision: over.currentRevision ?? 3, reviewedRevision: over.currentRevision ?? 3 },
  };
}

function completePricing(over: Partial<WizardPricingResult> = {}): WizardPricingResult {
  return {
    status: "success", completeness: "complete", currency: "JPY",
    lines: [], unresolvedItems: [],
    subtotal: 10000, discountTotal: 0, couponTotal: 0, taxableSubtotal: 10000, taxTotal: 1000, grandTotal: 11000,
    warnings: [], errors: [],
    couponState: { status: "none" }, discountIntent: { mode: "none" },
    ...over,
  };
}

const REQUEST = { customer: { mode: "existing", customerId: "c-1" } } as unknown as EstimateSaveRequest;

// A draft object is never inspected by the orchestrator (the validator already reconstructed it), so
// the trace-level identity is what matters here.
const DRAFT = { version: "2.2" } as unknown as EstimateWizardDraftV22;

const okValidation = (): WizardSaveIntentValidation => ({
  ok: true,
  intent: { draft: DRAFT, expectedConfigRevision: 3, idempotencyKey: KEY },
});

// ── Dependency harness with an ordered call trace ──
//
// Tracing WRAPS the implementation rather than being part of it, so a per-test override cannot
// accidentally silence the trace — the ordering assertions stay honest no matter what is overridden.
type Over = Partial<WizardSaveIntentDeps>;
function makeDeps(over: Over = {}): {
  deps: WizardSaveIntentDeps;
  trace: string[];
  seen: Record<string, unknown>;
  reports: WizardSaveFailureReport[];
  reportedAt: string[][];
} {
  const trace: string[] = [];
  const seen: Record<string, unknown> = {};
  const reportedAt: string[][] = [];
  // OBS-1L-B7: every reported record, in order. `reports.length` IS the emitted-event
  // count for the orchestrator-owned portion of a save.
  const reports: WizardSaveFailureReport[] = [];
  const impl: WizardSaveIntentDeps = {
    validateIntent: () => okValidation(),
    resolveActorContext: () => realActorContext(),
    loadRuntimeConfig: async () => runtimeConfig(),
    computePricing: () => completePricing(),
    mapSaveRequest: () => ({ ok: true, request: REQUEST }),
    validateSaveRequest: () => ({ ok: true, issues: [] }),
    persist: async () => ({ ok: false, code: "RPC_NOT_IMPLEMENTED", message: "保存機能は現在準備中です。", stage: "rpc" }),
    requestId: REQ,
    reportFailure: (r) => { reports.push(r); },
    ...over,
  };
  const deps: WizardSaveIntentDeps = {
    validateIntent: (raw) => { trace.push("validateIntent"); seen.raw = raw; return impl.validateIntent(raw); },
    resolveActorContext: () => { trace.push("resolveActorContext"); return impl.resolveActorContext(); },
    loadRuntimeConfig: (ctx) => { trace.push("loadRuntimeConfig"); seen.ctx = ctx; return impl.loadRuntimeConfig(ctx); },
    computePricing: (draft, pricingConfig, catalog, shopRank) => {
      trace.push("computePricing");
      seen.pricingArgs = { draft, pricingConfig, catalog, shopRank };
      return impl.computePricing(draft, pricingConfig, catalog, shopRank);
    },
    mapSaveRequest: (input) => { trace.push("mapSaveRequest"); seen.mapperInput = input; return impl.mapSaveRequest(input); },
    validateSaveRequest: (request) => { trace.push("validateSaveRequest"); return impl.validateSaveRequest(request); },
    persist: (request, context) => {
      trace.push("persist");
      seen.persistArgs = { request, context };
      return impl.persist(request, context);
    },
    requestId: impl.requestId,
    // Deliberately NOT pushed onto `trace`: the existing ordering assertions compare
    // `trace` exactly (deepEqual), and they assert which BUSINESS stages ran. Adding
    // a reporting entry would rewrite eleven unrelated expectations and quietly turn
    // "no dependency ran after validation" into a claim about logging. Reporting is
    // captured in its own array, and its position relative to the business trace is
    // recorded here so ordering is still provable.
    reportFailure: (r) => { reportedAt.push([...trace]); impl.reportFailure(r); },
  };
  return { deps, trace, seen, reports, reportedAt };
}

const run = (over: Over = {}, raw: unknown = {}) => runWizardSaveIntent(raw, makeDeps(over).deps);

/** Assert a plain (detail-free) failure arm. */
function assertFailure(r: WizardSaveIntentResult, failure: string, label: string) {
  assert.equal(r.ok, false, `${label} must fail`);
  if (r.ok) return;
  assert.equal(r.failure, failure, label);
}

// ── 1. Malformed input stops before ANY other dependency ─────────────────────

test("malformed input fails as invalid-intent BEFORE actor resolution", async () => {
  const { deps, trace } = makeDeps({
    validateIntent: () => ({ ok: false, issues: [{ path: "intent.draft", code: "missing-field" }] }),
  });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "invalid-intent");
  assert.equal("issues" in r && r.issues.length, 1, "validator issues are carried");
  assert.deepEqual(trace, ["validateIntent"], "no dependency ran after validation — not even the actor");
});

test("a THROWING validator is contained as invalid-intent / unreadable-input", async () => {
  const { deps, trace } = makeDeps({ validateIntent: () => { throw new Error("boom"); } });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "invalid-intent");
  assert.deepEqual("issues" in r ? r.issues : [], [{ path: "intent", code: "unreadable-input" }]);
  assert.deepEqual(trace, ["validateIntent"], "the throw was contained; nothing downstream ran");
});

// ── 2/3. Actor failure mapping ───────────────────────────────────────────────

test("all six actor reasons map to exactly the specified public failures", async () => {
  const cases: Array<[EstimateSaveActorContextFailure, string]> = [
    ["unauthenticated", "unauthenticated"],
    ["membership-read-failed", "actor-context-unavailable"],
    ["staff-read-failed", "actor-context-unavailable"],
    ["no-active-membership", "forbidden"],
    ["permission-denied", "forbidden"],
    ["tenant-context-unavailable", "tenant-context-unavailable"],
  ];
  for (const [reason, expected] of cases) {
    const { deps, trace } = makeDeps({ resolveActorContext: async () => ({ ok: false, reason }) });
    const r = await runWizardSaveIntent({}, deps);
    assertFailure(r, expected, `${reason} → ${expected}`);
    assert.equal(JSON.stringify(r).includes(reason) && reason !== expected, false, `internal reason "${reason}" must not leak`);
    assert.deepEqual(trace, ["validateIntent", "resolveActorContext"], "nothing ran after the actor failure");
  }
});

test("multiple membership stays DISTINCT from forbidden", async () => {
  const ambiguous = await run({ resolveActorContext: async () => ({ ok: false, reason: "tenant-context-unavailable" }) });
  const denied = await run({ resolveActorContext: async () => ({ ok: false, reason: "permission-denied" }) });
  assertFailure(ambiguous, "tenant-context-unavailable", "ambiguity");
  assertFailure(denied, "forbidden", "permission");
  assert.notDeepEqual(ambiguous, denied, "the two remain diagnosably different");
});

test("an operational actor read failure is NOT reported as forbidden or unauthenticated", async () => {
  for (const reason of ["membership-read-failed", "staff-read-failed"] as const) {
    const r = await run({ resolveActorContext: async () => ({ ok: false, reason }) });
    assertFailure(r, "actor-context-unavailable", reason);
  }
});

test("the actor context is resolved exactly ONCE on the full path", async () => {
  const { deps, trace } = makeDeps();
  await runWizardSaveIntent({}, deps);
  assert.equal(trace.filter((t) => t === "resolveActorContext").length, 1);
});

test("a throwing actor dependency is contained", async () => {
  const { deps, trace } = makeDeps({ resolveActorContext: async () => { throw new Error("db down"); } });
  const r = await runWizardSaveIntent({}, deps);
  assertFailure(r, "actor-context-unavailable", "thrown actor");
  assert.deepEqual(trace, ["validateIntent", "resolveActorContext"]);
});

// ── 4/5/6. Runtime configuration ─────────────────────────────────────────────

test("a runtime failure maps to runtime-config-unavailable and leaks NO internal reason", async () => {
  const reasons = [
    "no-dealer", "rank-unavailable", "catalog-read-failed", "lifecycle-read-failed", "lifecycle-missing",
    "review-required", "revision-mismatch", "missing-required-globals", "duplicate-code",
    // B2-E2B: "window-film-no-film-types" was removed from the runtime failure union. A missing
    // optional product line no longer fails the runtime at all, so there is no such reason to map.
    "malformed-catalog-row", "invalid-rank-category",
    // B2-E2G: an UNREADABLE service-offering map is a typed runtime failure (never coerced to
    // all-OFF), so it must map to the same public code and leak no more than the others.
    "service-offerings-read-failed",
    "pricing-catalog-failed", "config-build-failed",
  ] as const;
  for (const reason of reasons) {
    const { deps, trace } = makeDeps({ loadRuntimeConfig: async () => ({ ok: false, reason }) });
    const r = await runWizardSaveIntent({}, deps);
    assertFailure(r, "runtime-config-unavailable", reason);
    assert.equal(JSON.stringify(r).includes(reason), false, `runtime reason "${reason}" must not leak`);
    assert.deepEqual(Object.keys(r).sort(), ["failure", "ok"], "no detail carried");
    assert.deepEqual(trace, ["validateIntent", "resolveActorContext", "loadRuntimeConfig"]);
  }
});

test("a throwing runtime loader is contained", async () => {
  const r = await run({ loadRuntimeConfig: async () => { throw new Error("boom"); } });
  assertFailure(r, "runtime-config-unavailable", "thrown runtime");
});

test("an actor/runtime dealer MISMATCH fails closed before pricing", async () => {
  const { deps, trace } = makeDeps({ loadRuntimeConfig: async () => runtimeConfig({ dealerId: OTHER_DEALER }) });
  const r = await runWizardSaveIntent({}, deps);
  assertFailure(r, "tenant-context-unavailable", "cross-tenant configuration");
  assert.equal(trace.includes("computePricing"), false, "pricing never ran");
  assert.equal(trace.includes("persist"), false);
});

test("the runtime loader receives the resolved actor context", async () => {
  const { deps, seen } = makeDeps();
  await runWizardSaveIntent({}, deps);
  const ctx = seen.ctx as { dealerId: string; userId: string };
  assert.equal(ctx.dealerId, DEALER);
  assert.equal(ctx.userId, USER);
});

// ── 7. Stale revision ────────────────────────────────────────────────────────

test("a stale expectedConfigRevision stops BEFORE pricing", async () => {
  const { deps, trace } = makeDeps({ loadRuntimeConfig: async () => runtimeConfig({ currentRevision: 9 }) });
  const r = await runWizardSaveIntent({}, deps);
  assertFailure(r, "stale-config-revision", "revision 3 vs 9");
  assert.deepEqual(trace, ["validateIntent", "resolveActorContext", "loadRuntimeConfig"], "pricing never ran");
});

test("a matching revision proceeds", async () => {
  const { deps, trace } = makeDeps({ loadRuntimeConfig: async () => runtimeConfig({ currentRevision: 3 }) });
  await runWizardSaveIntent({}, deps);
  assert.ok(trace.includes("computePricing"));
});

// ── 8/9. Server repricing ────────────────────────────────────────────────────

test("pricing receives the EXACT runtime values by reference", async () => {
  const rt = runtimeConfig();
  const { deps, seen } = makeDeps({ loadRuntimeConfig: async () => rt });
  await runWizardSaveIntent({}, deps);
  const args = seen.pricingArgs as { draft: unknown; pricingConfig: unknown; catalog: unknown; shopRank: unknown };
  if (!rt.ok) return;
  assert.equal(args.pricingConfig, rt.pricingConfig, "same pricingConfig reference — not rebuilt");
  assert.equal(args.catalog, rt.catalog, "same catalog reference — never a default/fixture");
  assert.equal(args.shopRank, rt.shopRank, "server rank");
  assert.equal(args.draft, DRAFT, "the VALIDATED draft, not the raw input");
});

test("incomplete / error / unresolved pricing all fail closed as server-pricing-failed", async () => {
  const bad: Array<[string, Partial<WizardPricingResult>]> = [
    ["status incomplete", { status: "incomplete" }],
    ["status error", { status: "error" }],
    ["completeness partial", { completeness: "partial" }],
    ["completeness unavailable", { completeness: "unavailable" }],
    ["completeness error", { completeness: "error" }],
    ["errors present", { errors: [{ code: "X", category: null, sourceId: null, message: "m" }] }],
    ["unresolved present", { unresolvedItems: [{ code: "Y", category: "coating", sourceId: null, message: "m" }] }],
  ];
  for (const [label, over] of bad) {
    const { deps, trace } = makeDeps({ computePricing: () => completePricing(over) });
    const r = await runWizardSaveIntent({}, deps);
    assertFailure(r, "server-pricing-failed", label);
    assert.equal(trace.includes("mapSaveRequest"), false, `${label}: mapper never ran`);
    assert.equal(trace.includes("persist"), false, `${label}: persistence never ran`);
  }
});

test("a throwing pricing dependency is contained", async () => {
  const r = await run({ computePricing: () => { throw new Error("boom"); } });
  assertFailure(r, "server-pricing-failed", "thrown pricing");
});

// ── 10/11. Mapping ───────────────────────────────────────────────────────────

test("the mapper receives the same draft and the exact runtime inputs", async () => {
  const rt = runtimeConfig();
  const { deps, seen } = makeDeps({ loadRuntimeConfig: async () => rt });
  await runWizardSaveIntent({}, deps);
  const input = seen.mapperInput as { draft: unknown; pricingConfig: unknown; catalog: unknown; shopRank: unknown };
  if (!rt.ok) return;
  assert.equal(input.draft, DRAFT);
  assert.equal(input.pricingConfig, rt.pricingConfig);
  assert.equal(input.catalog, rt.catalog);
  assert.equal(input.shopRank, rt.shopRank);
});

test("a mapper failure carries stable CODES only — never messages", async () => {
  const failed: ConfigSaveMapperResult = {
    ok: false,
    reason: "null-aggregate-total",
    issues: [
      { code: "null-aggregate-total", message: "内部メッセージ — 露出禁止" },
      { code: "negative-amount", message: "another internal message" },
    ],
  };
  const { deps, trace } = makeDeps({ mapSaveRequest: () => failed });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "save-mapping-failed");
  assert.deepEqual("mappingCodes" in r ? r.mappingCodes : [], ["null-aggregate-total", "negative-amount"]);
  const blob = JSON.stringify(r);
  assert.equal(blob.includes("内部メッセージ"), false, "mapper message must not leak");
  assert.equal(blob.includes("another internal message"), false);
  assert.equal("saveIssues" in r, false, "unrelated detail is unrepresentable");
  assert.equal(trace.includes("persist"), false, "persistence never ran");
});

test("a throwing mapper yields mapping-failed as the single code", async () => {
  const { deps, trace } = makeDeps({ mapSaveRequest: () => { throw new Error("boom"); } });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "save-mapping-failed");
  assert.deepEqual("mappingCodes" in r ? r.mappingCodes : [], ["mapping-failed"]);
  assert.equal(trace.includes("persist"), false);
});

// ── 12/13. DTO validation ────────────────────────────────────────────────────

test("a DTO validation failure carries ONLY saveIssues", async () => {
  const failed: EstimateSaveValidationResult = {
    ok: false,
    issues: [{ code: "CUSTOMER_REQUIRED", field: "customer", message: "お客様が選択されていません。" }],
  };
  const { deps, trace } = makeDeps({ validateSaveRequest: () => failed });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "save-validation-failed");
  assert.deepEqual("saveIssues" in r ? r.saveIssues : [], failed.issues);
  assert.equal("mappingCodes" in r, false, "mapping codes are unrepresentable here");
  assert.equal("issues" in r, false, "validator issues are unrepresentable here");
  assert.equal(trace.includes("persist"), false, "persistence never ran after a DTO failure");
});

test("a throwing DTO validator yields an empty stable issue array", async () => {
  const { deps, trace } = makeDeps({ validateSaveRequest: () => { throw new Error("boom"); } });
  const r = await runWizardSaveIntent({}, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.failure, "save-validation-failed");
  assert.deepEqual("saveIssues" in r ? r.saveIssues : ["x"], []);
  assert.equal(trace.includes("persist"), false);
});

// ── 14/15. Persistence ───────────────────────────────────────────────────────

test("the disabled gateway result maps to persistence-unavailable", async () => {
  const r = await run();
  assertFailure(r, "persistence-unavailable", "RPC_NOT_IMPLEMENTED");
});

test("a duplicate submission maps to persistence-conflict", async () => {
  const r = await run({
    persist: async () => ({ ok: false, code: "DUPLICATE_SUBMISSION", message: "同じ内容の見積が既に保存されています。", stage: "rpc" }),
  });
  assertFailure(r, "persistence-conflict", "DUPLICATE_SUBMISSION");
});

test("every other persistence error code maps to persistence-failed", async () => {
  for (const code of [
    "SAVE_FAILED", "UNKNOWN_SAVE_ERROR", "CUSTOMER_NOT_FOUND", "VEHICLE_NOT_FOUND",
    "ESTIMATE_NUMBER_FAILED", "VALIDATION_ERROR", "PRICING_INCOMPLETE",
    "UNAUTHENTICATED", "DEALER_CONTEXT_REQUIRED", "PERMISSION_DENIED",
  ] as const) {
    const r = await run({ persist: async () => ({ ok: false, code, message: "x", stage: "rpc" }) });
    assertFailure(r, "persistence-failed", code);
  }
});

test("a throwing persistence dependency is contained as persistence-failed", async () => {
  const r = await run({ persist: async () => { throw new Error("boom"); } });
  assertFailure(r, "persistence-failed", "thrown persistence");
});

test("persistence receives the SERVER-resolved tenant, user, requestId and the intent key", async () => {
  const { deps, seen } = makeDeps();
  await runWizardSaveIntent({}, deps);
  const args = seen.persistArgs as { request: unknown; context: Record<string, unknown> };
  assert.equal(args.request, REQUEST, "the mapper-produced DTO, never a client-supplied one");
  assert.deepEqual(args.context, { requestId: REQ, dealerId: DEALER, userId: USER, idempotencyKey: KEY });
});

// ── Success arm shape ────────────────────────────────────────────────────────

test("a success is the EXTRACTED success arm — it cannot contain an inner failure", async () => {
  const success: EstimateSaveActionResult = {
    ok: true, estimateId: "e-1", estimateNumber: "EST-1", customerId: "c-1", vehicleId: "v-1", replay: false,
  };
  const r = await run({ persist: async () => success });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r, success, "returned directly — never nested under an ok:true wrapper");
  assert.equal("outcome" in r, false, "no nested outcome field exists");
  assert.equal("failure" in r, false);
  assert.deepEqual(Object.keys(r).sort(), ["customerId", "estimateId", "estimateNumber", "ok", "replay", "vehicleId"]);
});

test("a replayed idempotent save is still a success", async () => {
  const r = await run({
    persist: async () => ({ ok: true, estimateId: "e-1", estimateNumber: "EST-1", customerId: "c-1", vehicleId: "v-1", replay: true }),
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.replay, true);
});

// ── Exact ordered trace ──────────────────────────────────────────────────────

test("the exact ordered call trace reaches disabled persistence", async () => {
  const { deps, trace } = makeDeps();
  const r = await runWizardSaveIntent({ any: "raw" }, deps);
  assert.deepEqual(trace, [
    "validateIntent",
    "resolveActorContext",
    "loadRuntimeConfig",
    "computePricing",
    "mapSaveRequest",
    "validateSaveRequest",
    "persist",
  ], "exact order, each stage exactly once");
  assertFailure(r, "persistence-unavailable", "terminates at the disabled gateway");
});

test("the raw input is handed to the validator unchanged and nowhere else", async () => {
  const raw = { marker: "raw-input" };
  const { deps, seen } = makeDeps();
  await runWizardSaveIntent(raw, deps);
  assert.equal(seen.raw, raw, "validator sees the raw value");
  assert.equal(seen.mapperInput !== undefined && (seen.mapperInput as { draft: unknown }).draft, DRAFT, "mapper sees the VALIDATED draft");
});

// ── Source guards ────────────────────────────────────────────────────────────

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ORCH_SRC = "src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts";
const ACTION_SRC = "src/components/estimates/wizard/save/save-estimate-from-wizard-intent-action.ts";
const ACTION_MODULE = "save-estimate-from-wizard-intent-action";

test("the orchestrator source contains NO prohibited runtime dependency", () => {
  const code = codeOf(ORCH_SRC);
  assert.equal(/"use server"|'use server'/.test(code), false, "not a server action");
  assert.equal(/server-only/.test(code), false);
  assert.equal(/@\/lib\/supabase|createClient|supabase/i.test(code), false, "no Supabase");
  assert.equal(/from\s+["']react["']|useState|useEffect/.test(code), false, "no React");
  assert.equal(/next\/navigation|next\/headers|revalidatePath|redirect\(/.test(code), false, "no route API");
  assert.equal(/DEFAULT_PRICING_CATALOG|fixture|FIXTURE/.test(code), false, "no default/fixture catalog");
  assert.equal(/Date\.now|new Date\(|Math\.random|crypto\./.test(code), false, "no clock or randomness");
  assert.equal(/supabasePersistenceGateway|notImplementedPersistenceGateway|EstimatePersistenceService/.test(code), false, "no persistence implementation");
  assert.equal(/service_role|SERVICE_ROLE|user_metadata|app_metadata/.test(code), false);
});

test("the orchestrator imports the persistence CONTRACT only as a type", () => {
  const code = codeOf(ORCH_SRC);
  // The one runtime import is the stable error-code map; everything else is `import type`.
  const runtimeImports = (code.match(/^import\s+(?!type)/gm) ?? []).length;
  assert.equal(runtimeImports, 1, "exactly one runtime import (the error-code constants)");
  assert.match(code, /import\s+\{\s*ESTIMATE_SAVE_ACTION_ERRORS\s*\}/);
});

test("the action begins with \"use server\"", () => {
  const raw = readFileSync(ACTION_SRC, "utf8");
  assert.match(raw, /^["']use server["'];/, "first statement is the server directive");
});

test("B7-1: the action wires the REAL gateway, exactly once, and nothing else changed", () => {
  const code = codeOf(ACTION_SRC);
  const REAL = "supabase" + "PersistenceGateway";

  assert.ok(code.includes(REAL), "binds the real gateway");
  assert.match(code, new RegExp(`new EstimatePersistenceService\\(\\s*${REAL}\\s*\\)`),
    "constructed with the real gateway");
  assert.equal((code.match(/new EstimatePersistenceService\(/g) ?? []).length, 1,
    "exactly one construction — no second, differently-bound instance");

  // The placeholder is fully removed rather than left imported: keeping it would
  // let a later edit re-bind it behind a branch and make persistence silently
  // conditional, which is far harder to notice than an unbound action.
  assert.equal(code.includes("notImplementedPersistenceGateway"), false,
    "the placeholder is no longer imported or referenced");

  // Arming persistence must not have moved work INTO the action. Numbering and the
  // RPC still live behind the gateway and the migration, never here.
  assert.equal(/getNextDocumentNumber|\.rpc\(/.test(code), false, "no numbering or RPC call of its own");
  assert.equal(/createAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(code), false,
    "no service-role surface leaks into the action");
});

test("the action references NO legacy auth or arg-less provider", () => {
  const code = codeOf(ACTION_SRC);
  for (const forbidden of [
    "getCurrentUser", "getCurrentDealer", "getCurrentStaff", "requireStaffCapability",
    "getAuthoritativeShopRank", "getAuthoritativeDealerPricingCatalog",
  ]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`).test(code), false, `must not reference ${forbidden}`);
  }
  // The arg-less runtime loader must not be used — only the dealer-bound one.
  assert.equal(/getAuthoritativeWizardRuntimeConfig\b(?!ForDealer)/.test(code), false, "no arg-less runtime loader");
  assert.match(code, /getAuthoritativeWizardRuntimeConfigForDealer/, "uses the dealer-bound loader");
  assert.match(code, /getEstimateSaveActorContext/, "uses the coherent actor context");
});

test("the action uses no service-role/secret client and no JWT claim-bag authorization", () => {
  const code = codeOf(ACTION_SRC);
  assert.equal(/service_role|SERVICE_ROLE|serviceRole|createAdminClient|SECRET_KEY/.test(code), false);
  assert.equal(/user_metadata|app_metadata/.test(code), false);
});

test("the action generates its own requestId and does not accept one", () => {
  const code = codeOf(ACTION_SRC);
  // OBS-1L-B7: the private generator is GONE. The id now comes from the committed
  // observability core, whose grammar (obs.<32 hex> | obs.unattributed) is provably
  // disjoint from the idempotency alphabet — `.` is not a legal key character, so a
  // replay token can never be mistaken for, or reused as, a correlation id.
  assert.match(code, /createObservabilityRequestId\(\)/, "server-generated, from the shared core");
  assert.equal(/globalThis\.crypto\.getRandomValues/.test(code), false, "no private generator remains");
  assert.equal(/"req_" \+ ""|req_unattributed|`req_/.test(code), false, "no req_ vocabulary remains");
  assert.match(code, /saveEstimateFromWizardIntentAction\(\s*raw:\s*unknown\s*\)/, "the ONLY parameter is the raw intent");
  assert.equal(/lib\/uuid|safeRandomUUID/.test(code), false, "does not import the frozen uuid helper");
  assert.equal(/Date\.now|new Date\(/.test(code), false, "no clock data in the id");
  // The request id must never be derived from the idempotency key.
  assert.equal(/requestId[^\n]*idempotencyKey|idempotencyKey[^\n]*requestId/.test(code), false);
});

// ── Zero importers ───────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    out.push(`${e.parentPath ?? dir}/${e.name}`);
  }
  return out;
}

test("the new action has ZERO importers anywhere in src/", () => {
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${ACTION_MODULE}.ts`)) continue;             // the action itself
    if (file.endsWith("wizard-save-intent-orchestrator.test.ts")) continue; // this test (source text only)
    if (readFileSync(file, "utf8").includes(ACTION_MODULE)) importers.push(file);
  }
  assert.deepEqual(importers, [], `the action must remain unmounted; found importers: ${importers.join(", ")}`);
});

test("the save barrel does not re-export the new action and has no wildcard export", () => {
  const barrel = readFileSync("src/components/estimates/wizard/save/index.ts", "utf8");
  assert.equal(barrel.includes(ACTION_MODULE), false, "not re-exported from index.ts");
  assert.equal(/export\s+\*/.test(barrel), false, "no wildcard export could pick it up");
});

test("ScreensPreview and every route/page still ignore the new action", () => {
  const preview = readFileSync("src/components/estimates/wizard/screens/ScreensPreview.tsx", "utf8");
  assert.equal(preview.includes(ACTION_MODULE), false, "ScreensPreview does not import it");
  for (const file of walk("src/app")) {
    assert.equal(readFileSync(file, "utf8").includes(ACTION_MODULE), false, `${file} must not import the action`);
  }
});

// ── OBS-1L-B7: exactly one operational record, and who owns it ───────────────
//
// Ownership splits at ONE line — the call to `deps.persist`:
//   • before it  → the orchestrator reports (these tests)
//   • inside it  → EstimatePersistenceService reports (its own test file)
//   • after it   → the orchestrator remaps SILENTLY
// Double-counting is the failure mode these tests exist to catch: a save reported
// twice makes every operational count wrong in a way nothing else would surface.

/** Every pre-persist failure, with the exact reported vocabulary it must produce. */
const PRE_PERSIST_CASES: ReadonlyArray<{
  label: string; over: Over; raw?: unknown; failure: string; reported: string; dealerId?: string;
}> = [
  { label: "validator throws", over: { validateIntent: () => { throw new Error("boom"); } },
    failure: "invalid-intent", reported: "invalid-intent" },
  { label: "validator rejects",
    over: { validateIntent: () => ({ ok: false, issues: [{ path: "intent.draft", code: "missing-field" }] }) },
    failure: "invalid-intent", reported: "invalid-intent" },
  { label: "actor resolution throws", over: { resolveActorContext: async () => { throw new Error("boom"); } },
    failure: "actor-context-unavailable", reported: "actor-context-unavailable" },
  { label: "unauthenticated", over: { resolveActorContext: async () => ({ ok: false, reason: "unauthenticated" }) },
    failure: "unauthenticated", reported: "unauthenticated" },
  { label: "membership read failed", over: { resolveActorContext: async () => ({ ok: false, reason: "membership-read-failed" }) },
    failure: "actor-context-unavailable", reported: "actor-context-unavailable" },
  { label: "staff read failed", over: { resolveActorContext: async () => ({ ok: false, reason: "staff-read-failed" }) },
    failure: "actor-context-unavailable", reported: "actor-context-unavailable" },
  { label: "no active membership", over: { resolveActorContext: async () => ({ ok: false, reason: "no-active-membership" }) },
    failure: "forbidden", reported: "forbidden" },
  { label: "permission denied", over: { resolveActorContext: async () => ({ ok: false, reason: "permission-denied" }) },
    failure: "forbidden", reported: "forbidden" },
  { label: "tenant ambiguous", over: { resolveActorContext: async () => ({ ok: false, reason: "tenant-context-unavailable" }) },
    failure: "tenant-context-unavailable", reported: "tenant-context-unavailable" },
  { label: "runtime load throws", over: { loadRuntimeConfig: async () => { throw new Error("boom"); } },
    failure: "runtime-config-unavailable", reported: "runtime-config-unavailable", dealerId: DEALER },
  { label: "runtime not ok", over: { loadRuntimeConfig: async () => ({ ok: false, reason: "catalog-unavailable" }) as never },
    failure: "runtime-config-unavailable", reported: "runtime-config-unavailable", dealerId: DEALER },
  { label: "tenant mismatch", over: { loadRuntimeConfig: async () => runtimeConfig({ dealerId: OTHER_DEALER }) },
    failure: "tenant-context-unavailable", reported: "tenant-context-unavailable", dealerId: DEALER },
  { label: "stale revision", over: { loadRuntimeConfig: async () => runtimeConfig({ currentRevision: 999 }) },
    failure: "stale-config-revision", reported: "stale-config-revision", dealerId: DEALER },
  { label: "pricing throws", over: { computePricing: () => { throw new Error("boom"); } },
    failure: "server-pricing-failed", reported: "server-pricing-failed", dealerId: DEALER },
  { label: "pricing incomplete",
    over: { computePricing: () => ({ ...completePricing(), completeness: "partial" }) as WizardPricingResult },
    failure: "server-pricing-failed", reported: "server-pricing-failed", dealerId: DEALER },
  { label: "mapper throws", over: { mapSaveRequest: () => { throw new Error("boom"); } },
    failure: "save-mapping-failed", reported: "save-mapping-failed", dealerId: DEALER },
  { label: "mapper rejects",
    over: { mapSaveRequest: () => ({ ok: false, reason: "mapping-failed", issues: [] }) as ConfigSaveMapperResult },
    failure: "save-mapping-failed", reported: "save-mapping-failed", dealerId: DEALER },
  { label: "DTO validator throws", over: { validateSaveRequest: () => { throw new Error("boom"); } },
    failure: "save-validation-failed", reported: "save-validation-failed", dealerId: DEALER },
  { label: "DTO validator rejects",
    over: { validateSaveRequest: () => ({ ok: false, issues: [{ field: "customer.name", code: "CUSTOMER_REQUIRED", message: "x" }] }) as EstimateSaveValidationResult },
    failure: "save-validation-failed", reported: "save-validation-failed", dealerId: DEALER },
];

test("every pre-persist failure reports EXACTLY ONE record with the correct vocabulary", async () => {
  for (const c of PRE_PERSIST_CASES) {
    const h = makeDeps(c.over);
    const r = await runWizardSaveIntent(c.raw ?? {}, h.deps);

    assert.equal(r.ok, false, c.label);
    if (!r.ok) assert.equal(r.failure, c.failure, `${c.label}: public failure`);

    assert.equal(h.reports.length, 1, `${c.label}: exactly one record`);
    assert.equal(h.reports[0].failure, c.reported, `${c.label}: reported vocabulary`);
    assert.equal(h.reports[0].dealerId, c.dealerId, `${c.label}: dealerId presence`);

    // The record is emitted BEFORE the failing return, and never after a later stage.
    assert.equal(h.trace.includes("persist"), false, `${c.label}: persistence was never entered`);
  }
});

test("all 19 pre-persist branches are covered and none is a duplicate of another", () => {
  assert.equal(PRE_PERSIST_CASES.length, 19, "one case per pre-persist return branch");
  const kinds = new Set(PRE_PERSIST_CASES.map((c) => c.reported));
  assert.equal(kinds.size, 10, "exactly the ten pre-persist failure values are exercised");
});

test("BOTH save-validation-failed branches report once and never reach persistence", async () => {
  const branches: Over[] = [
    { validateSaveRequest: () => { throw new Error("boom"); } },
    { validateSaveRequest: () => ({ ok: false, issues: [{ field: "customer.name", code: "CUSTOMER_REQUIRED", message: "x" }] }) as EstimateSaveValidationResult },
  ];
  for (const over of branches) {
    const h = makeDeps(over);
    const r = await runWizardSaveIntent({}, h.deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.failure, "save-validation-failed");
    assert.equal(h.reports.length, 1, "one record");
    assert.equal(h.reports[0].failure, "save-validation-failed",
      "owned by the orchestrator, NOT by the persistence service");
    assert.equal(h.trace.includes("persist"), false, "deps.persist was never called");
    // Reported after DTO validation ran, so the record describes the stage that failed.
    assert.deepEqual(h.reportedAt[0].at(-1), "validateSaveRequest");
  }
});

test("EVERY post-persist outcome reports ZERO additional records", async () => {
  const outcomes: EstimateSaveActionResult[] = [
    { ok: true, estimateId: "e1", estimateNumber: "EST-1", customerId: "c1", vehicleId: "v1", replay: false },
    { ok: false, code: "RPC_NOT_IMPLEMENTED", message: "x", stage: "rpc" },
    { ok: false, code: "DUPLICATE_SUBMISSION", message: "x", stage: "rpc" },
    { ok: false, code: "SAVE_FAILED", message: "x", stage: "rpc" },
    { ok: false, code: "VALIDATION_ERROR", message: "x", stage: "validation" },
    { ok: false, code: "ESTIMATE_NUMBER_FAILED", message: "x", stage: "rpc" },
  ];
  for (const outcome of outcomes) {
    const h = makeDeps({ persist: async () => outcome });
    await runWizardSaveIntent({}, h.deps);
    assert.equal(h.trace.includes("persist"), true, "persistence WAS entered");
    assert.equal(h.reports.length, 0,
      `the service already reported ${outcome.ok ? "success" : outcome.code}; remapping must stay silent`);
  }
});

test("a persist THROW reports exactly one persist-invariant and returns public persistence-failed", async () => {
  const h = makeDeps({ persist: async () => { throw new Error("seam exploded"); } });
  const r = await runWizardSaveIntent({}, h.deps);

  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.failure, "persistence-failed", "the caller sees the PUBLIC failure");
  assert.equal(h.reports.length, 1, "exactly one record");
  assert.equal(h.reports[0].failure, "persist-invariant",
    "the INTERNAL code — the service emitted nothing because it threw before returning");
  assert.equal(h.reports[0].dealerId, DEALER);
});

test("a THROWING reporter cannot alter the business result or skip a stage", async () => {
  const exploding: Over = { reportFailure: () => { throw new Error("reporting outage"); } };

  // A pre-persist failure keeps its exact typed result.
  const bad = makeDeps({ ...exploding, validateSaveRequest: () => ({ ok: false, issues: [] }) as EstimateSaveValidationResult });
  const r1 = await runWizardSaveIntent({}, bad.deps);
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.equal(r1.failure, "save-validation-failed", "unchanged by a throwing reporter");
  assert.equal(bad.trace.includes("persist"), false);

  // A SUCCESS still succeeds — the case where a logging defect would otherwise
  // surface to the operator as a failed save.
  const good = makeDeps({
    ...exploding,
    persist: async () => ({ ok: true, estimateId: "e1", estimateNumber: "EST-1", customerId: "c1", vehicleId: "v1", replay: false }),
  });
  const r2 = await runWizardSaveIntent({}, good.deps);
  assert.equal(r2.ok, true, "a reporting outage must never fail a save that worked");
});

test("the reporter payload is CLOSED — no userId, key, issues, draft or pricing can ride in", async () => {
  const h = makeDeps({ validateSaveRequest: () => ({ ok: false, issues: [{ field: "customer.name", code: "CUSTOMER_REQUIRED", message: "山田太郎" }] }) as EstimateSaveValidationResult });
  await runWizardSaveIntent({}, h.deps);

  assert.equal(h.reports.length, 1, "PRECONDITION: a record was actually captured");
  const serialized = JSON.stringify(h.reports[0]);
  assert.deepEqual(Object.keys(h.reports[0]).sort(), ["dealerId", "failure"]);
  for (const forbidden of [USER, KEY, "山田太郎", "issues", "userId", "idempotencyKey", "message", "draft", "pricing"]) {
    assert.equal(serialized.includes(forbidden), false, `payload exposes ${forbidden}`);
  }
});

test("the orchestrator imports no reporting implementation, console, Supabase or transport", () => {
  const code = readFileSync("src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const token of ["console" + ".", "report" + "ObservabilityEvent", "wizard-save-" + "observability",
                       "@/lib/" + "observability", "supa" + "base", "fetch("]) {
    assert.equal(code.includes(token), false, `the pure core must not reference ${token}`);
  }
  assert.equal(/reportFailure\??\s*:/.test(code), true, "reporting arrives only as an injected dependency");
});
