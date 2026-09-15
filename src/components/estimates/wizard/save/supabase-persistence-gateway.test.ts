// R56B — source guards for the hardened real persistence gateway.
//
// B7-1: the gateway is BOUND — by exactly one file, the authoritative intent action, which is
// itself unreachable (no route, page, component or barrel imports it). The legacy action remains
// bound to the placeholder gateway and still writes nothing.
// Run: node --import tsx --test src/components/estimates/wizard/save/supabase-persistence-gateway.test.ts
//
// The gateway begins with `import "server-only"`, so it is NEVER imported here. Its guarantees are
// asserted by inspecting SOURCE TEXT.
//
// Context: the RPC is now service-role-only, because the browser client and the Next.js server
// client share the SAME public URL + anon key — an `authenticated` EXECUTE grant was never a server
// boundary. This file pins the gateway to the server-only principal and to non-leaking error mapping.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SAVE_DIR = "src/components/estimates/wizard/save/";
const GATEWAY = `${SAVE_DIR}supabase-persistence` + "-gateway.ts";

// ── Server-only principal ────────────────────────────────────────────────────

test("the gateway is server-only and uses the admin (service-role) client", () => {
  const raw = readFileSync(GATEWAY, "utf8");
  assert.match(raw, /^import\s+["']server-only["'];/, "first statement is the server-only import");

  const code = codeOf(GATEWAY);
  assert.match(code, /import\s*\{\s*createAdminClient\s*\}\s*from\s*["']@\/lib\/supabase\/admin["']/,
    "imports the admin client");
  assert.match(code, /const\s+supabase\s*=\s*createAdminClient\(\)/, "constructs the admin client");
  assert.equal(/@\/lib\/supabase\/server/.test(code), false,
    "no longer uses the normal authenticated server client");
  assert.equal(/@\/lib\/supabase\/client/.test(code), false, "never the browser client");
});

test("the gateway calls the atomic RPC exactly once, with server-resolved context", () => {
  const code = codeOf(GATEWAY);
  assert.equal((code.match(/\.rpc\(/g) ?? []).length, 1, "exactly one RPC call");
  assert.match(code, /\.rpc\(\s*["']save_estimate_from_wizard["']/, "calls the atomic save RPC");
  assert.match(code, /p_dealer_id:\s*ctx\.dealerId/, "dealer id comes from the server context");
  assert.match(code, /p_actor_user_id:\s*ctx\.userId/, "actor id comes from the server context");
  // The payload must never carry a dealer id.
  assert.equal(/p_dealer_id:\s*payload/.test(code), false, "dealer id is never taken from the payload");
});

// ── Error mapping: new codes, fixed messages, no raw leakage ─────────────────

test("the gateway maps UNAUTHENTICATED and PERMISSION_DENIED", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /"UNAUTHENTICATED"/, "UNAUTHENTICATED is a known prefix");
  assert.match(code, /"PERMISSION_DENIED"/, "PERMISSION_DENIED is a known prefix");
  assert.match(code, /prefix === "UNAUTHENTICATED"[\s\S]{0,160}code:\s*"UNAUTHENTICATED"/,
    "UNAUTHENTICATED maps to its stable code");
  assert.match(code, /prefix === "PERMISSION_DENIED"[\s\S]{0,160}code:\s*"PERMISSION_DENIED"/,
    "PERMISSION_DENIED maps to its stable code");
});

test("every mapped branch returns a FIXED operator-safe message, never the raw text", () => {
  const code = codeOf(GATEWAY);
  // No branch may interpolate the raw message into what the caller receives.
  assert.equal(/message:\s*rawMessage/.test(code), false, "raw message never returned");
  assert.equal(/message:\s*msg\b/.test(code), false, "raw message never returned");
  assert.equal(/message:\s*`[^`]*\$\{\s*(msg|rawMessage|error)/.test(code), false,
    "no interpolation of raw error text into a client message");
  assert.equal(/message:\s*error\./.test(code), false, "never the Supabase error object");
  // The catch-all exists and is fixed.
  assert.match(code, /return\s*\{\s*code:\s*"SAVE_FAILED",\s*message:\s*"[^"]+"\s*\}/,
    "unmatched errors collapse to a fixed SAVE_FAILED message");
});

test("the gateway never forwards Postgres detail/hint/row data", () => {
  const code = codeOf(GATEWAY);
  assert.equal(/error\.details|error\.hint/.test(code), false,
    "details/hint can echo failing row values (PII) and must never be read");
  assert.equal(/JSON\.stringify\(\s*error\s*\)/.test(code), false, "no whole-error serialization");
});

// ── OBS-1L-B7: the gateway logs and reports NOTHING ─────────────────────────
//
// This test previously read `if (/console\.error/.test(code)) { ...assertions... }`.
// That guard made it self-defeating: deleting the diagnostic — the very outcome the
// contract wanted — made the body never execute, so the test reported green while
// proving nothing at all. It is now UNCONDITIONAL. A reintroduced diagnostic of any
// shape, gated or not, fails here.

test("the gateway contains NO console call of any kind — unconditionally", () => {
  const code = codeOf(GATEWAY);
  // Assembled from fragments so this guard file never matches its own search terms.
  for (const channel of ["error", "warn", "info", "log", "debug", "trace"]) {
    assert.equal(code.includes("console" + "." + channel), false,
      `the gateway must not call console.${channel}`);
  }
  assert.equal(/console\s*\[/.test(code), false, "no computed console channel either");
  assert.equal(code.includes("process.env.NODE_ENV"), false,
    "no environment-gated diagnostic remains — the gate was the old diagnostic's only home");
});

test("the gateway never reads a Supabase diagnostic field except message-for-classification", () => {
  const code = codeOf(GATEWAY);
  // `error.message` survives for CLOSED-PREFIX classification only: startsWith/=== against
  // a fixed list, returning a FIXED code and FIXED text. Every other field is forbidden.
  for (const field of ["code", "details", "hint", "constraint", "stack", "cause"]) {
    assert.equal(code.includes("error" + "." + field), false,
      `error.${field} must never be read — it can echo failing-row values or a SQLSTATE`);
  }
  assert.equal(/JSON\.stringify\(\s*error\s*\)/.test(code), false, "no whole-error serialization");
  assert.equal(/\$\{\s*error/.test(code), false, "no interpolation of the error object");

  // The one permitted read, and the only one.
  assert.equal((code.match(/error\.message/g) ?? []).length, 1, "exactly one read of error.message");
  assert.match(code, /mapRpcError\(\s*error\.message\s*\)/, "and it is the classification call");
});

test("the gateway emits no observability event — the service owns the terminal record", () => {
  const code = codeOf(GATEWAY);
  assert.equal(code.includes("report" + "ObservabilityEvent"), false, "no direct emission");
  assert.equal(code.includes("logEstimate" + "SaveStage"), false, "no stage record");
  assert.equal(code.includes("wizard-save-" + "observability"), false, "the adapter is not imported");
});

// ── R56D: the numbering allocation is DEALER-BOUND and FAIL-CLOSED ───────────
// These replace the R56B defect-pins (which asserted the gateway called the bare
// allocator, and that the allocator still contained getCurrentDealer/fallbackNum).
// Those were deliberate records of the open blocker; R56D closes it, so they are
// now inverted into positive assertions.

const ALLOCATOR = "src/lib/numbering/get-next-document-number.ts";

test("the gateway performs NO pre-allocation — numbering happens inside the RPC", () => {
  const code = codeOf(GATEWAY);
  // B7-0A: pre-allocating in a separate committed RPC is what burned a number on every
  // replay, conflict and rejected save. No numbering call of any shape may remain.
  assert.equal(/getNextDocumentNumberForDealer/.test(code), false,
    "the dealer-bound allocator is no longer imported or called");
  assert.equal(/getNextDocumentNumber/.test(code), false,
    "no numbering allocator of any arity remains");
  assert.equal(/@\/lib\/numbering/.test(code), false, "the numbering module is not imported");
  assert.equal(/getCurrentDealer/.test(code), false, "the gateway never resolves a dealer itself");
});

test("the gateway calls the atomic RPC exactly once with exactly three arguments", () => {
  const code = codeOf(GATEWAY);
  assert.equal((code.match(/\.rpc\(/g) ?? []).length, 1, "exactly one RPC call");
  assert.match(code, /\.rpc\(\s*["']save_estimate_from_wizard["']/, "the atomic save RPC");
  assert.match(code, /p_dealer_id:\s*ctx\.dealerId/, "dealer id from the server context");
  assert.match(code, /p_actor_user_id:\s*ctx\.userId/, "actor id from the server context");
  assert.match(code, /p_payload:\s*payload/, "the canonical payload");
  // The parameter no longer exists in the RPC; supplying it would be a hard error.
  assert.equal(/p_estimate_number/.test(code), false, "no p_estimate_number is ever sent");
  // Exactly three p_ arguments, no more.
  const args = code.match(/p_[a-z_]+:/g) ?? [];
  assert.deepEqual([...args].sort(), ["p_actor_user_id:", "p_dealer_id:", "p_payload:"]);
});

test("the gateway never manufactures an estimate number", () => {
  const code = codeOf(GATEWAY);
  assert.equal(/Date\.now\(|Math\.random\(|randomUUID\(|safeRandomUUID/.test(code), false,
    "no timestamp, random or UUID fallback");
  assert.equal(/estimate_number\s*\?\?/.test(code), false,
    "no ?? fallback for the persisted number");
  assert.equal(/estimateNumber:\s*""/.test(code), false, "never an empty-string number");
  // The number can only come from the RPC result.
  assert.match(code, /estimateNumber:\s*r\.estimate_number/,
    "the returned number is exactly the RPC's persisted value");
});

test("a missing, blank or non-string estimate_number fails closed as SAVE_FAILED", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /typeof r\.estimate_number !== "string" \|\| r\.estimate_number\.trim\(\) === ""/,
    "the success arm requires a real number string");
  assert.match(code, /typeof r\.estimate_number[\s\S]{0,200}code:\s*"SAVE_FAILED"/,
    "and maps the absence to the fixed SAVE_FAILED result");
});

test("ESTIMATE_NUMBER_FAILED remains a mapped RPC code", () => {
  const code = codeOf(GATEWAY);
  // The RPC still raises it — numbering config unusable, allocation or formatting failed.
  assert.match(code, /"ESTIMATE_NUMBER_FAILED"/, "still a known RPC prefix");
});

test("the allocator uses the authenticated server client, never the admin client", () => {
  const allocator = codeOf(ALLOCATOR);
  assert.match(allocator, /@\/lib\/supabase\/server/,
    "numbering runs as the authenticated principal (104 grants EXECUTE to authenticated only)");
  assert.equal(/createAdminClient|@\/lib\/supabase\/admin/.test(allocator), false,
    "service_role holds no EXECUTE on get_next_document_number and auth.uid() would be NULL");
});

test("the dealer-bound allocator cannot reach the legacy +1 fallback", () => {
  const allocator = codeOf(ALLOCATOR);
  // Isolate the dealer-bound function body: from its signature to the start of the
  // legacy wrapper's export. The +1 fallback must not appear anywhere inside it.
  const start = allocator.indexOf("export async function getNextDocumentNumberForDealer");
  const end   = allocator.indexOf("export async function getNextDocumentNumber(");
  assert.ok(start >= 0, "the dealer-bound allocator exists");
  assert.ok(end > start, "the legacy wrapper is declared after the dealer-bound allocator");
  const safeBody = allocator.slice(start, end);

  assert.equal(/fallbackNum/.test(safeBody), false, "no fallback identifier in the safe path");
  assert.equal(/current_number\s*\+\s*1|currentNumber\s*\+\s*1/.test(safeBody), false,
    "no local +1 arithmetic in the safe path");
  assert.equal(/Date\.now\(|Math\.random\(|randomUUID\(/.test(safeBody), false,
    "no invented number in the safe path");
  // The safe path formats only the RPC-derived value.
  assert.match(safeBody, /formatDocumentNumber\(\s*cfg\.prefix\s*,\s*next\s*,/,
    "formats only the integer returned by the authoritative RPC");
});

test("the legacy fallback is retained only in the one-argument wrapper, and marked as debt", () => {
  const allocator = codeOf(ALLOCATOR);
  const wrapperStart = allocator.indexOf("export async function getNextDocumentNumber(");
  assert.ok(wrapperStart >= 0, "the legacy wrapper exists");
  assert.match(allocator.slice(wrapperStart), /fallbackNum/,
    "the fallback lives inside the legacy wrapper");
  // Comments are stripped by codeOf, so assert the debt marker on the RAW text.
  const raw = readFileSync(ALLOCATOR, "utf8");
  assert.match(raw, /LEGACY COMPATIBILITY FALLBACK[\s\S]{0,80}FORBIDDEN FOR NEW CALLERS/,
    "the fallback is explicitly marked as legacy debt");
});

test("exactly one implementation calls the numbering RPC", () => {
  const allocator = codeOf(ALLOCATOR);
  assert.equal((allocator.match(/\.rpc\(\s*["']get_next_document_number["']/g) ?? []).length, 1,
    "a single shared RPC call site — no duplicated allocator");
});

test("the legacy dealer-bound allocator and the production route guard are untouched", () => {
  // The numbering RPC already accepts p_dealer_id and already authorizes on it
  // (046 + 104), so R56D is a pure TypeScript correction.
  const allocator = codeOf(ALLOCATOR);
  assert.match(allocator, /p_dealer_id:\s*dealerId/, "passes the caller's dealer id straight through");
  const guard = readFileSync("src/app/admin/dev-preview/estimate-wizard/page.tsx", "utf8");
  assert.match(guard, /NODE_ENV === "production"\)\s*notFound\(\)/,
    "the production route guard is untouched");
});

// ── The gateway is bound ONLY by the authoritative action ───────────────────

test("the gateway exports its binding; only the authoritative intent action consumes it", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /export const supabasePersistenceGateway/,
    "exported for its one permitted consumer, the authoritative intent action");
  // The legacy action remains unable to bind the real gateway. Production reachability is pinned
  // separately to the one accepted create route below.
  const legacy = codeOf(`${SAVE_DIR}save-estimate-from-wizard-action.ts`);
  assert.equal(legacy.includes("supabase" + "PersistenceGateway"), false,
    "the legacy action no longer binds the real gateway");
});

// ── B7-0A locked boundaries ─────────────────────────────────────────────────

test("the nine remaining legacy one-argument numbering call sites are intact", () => {
  const CALLERS: Array<[string, number]> = [
    ["src/lib/estimates/create-estimate.ts", 1],
    ["src/lib/invoices/create-invoice.ts", 2],
    // The accepted atomic payment RPC owns payment identity and intentionally
    // performs no legacy client-side document-number allocation.
    ["src/lib/payments/create-payment.ts", 0],
    ["src/lib/work-orders/create-work-order.ts", 1],
    ["src/lib/reservations/create-reservation.ts", 1],
    ["src/lib/reservations/update-reservation.ts", 1],
    ["src/lib/product-orders/create-product-order.ts", 1],
    ["src/lib/completion-reports/create-completion-report.ts", 1],
    ["src/lib/maintenance/create-maintenance-reminder.ts", 1],
  ];
  let total = 0;
  for (const [file, expected] of CALLERS) {
    const hits = (codeOf(file).match(/getNextDocumentNumber\("[a-z_]+"\)/g) ?? []).length;
    assert.equal(hits, expected, `${file}: one-argument call sites`);
    total += hits;
  }
  assert.equal(total, 9, "nine legacy one-argument call sites remain in eight files");
});

test("the numbering allocator module still exposes both entry points unchanged", () => {
  const allocator = codeOf(ALLOCATOR);
  assert.match(allocator, /export async function getNextDocumentNumberForDealer\(/,
    "the dealer-bound core survives for non-wizard use");
  assert.match(allocator, /export async function getNextDocumentNumber\(/,
    "the legacy one-argument wrapper survives");
  assert.equal((allocator.match(/\.rpc\(\s*["']get_next_document_number["']/g) ?? []).length, 1,
    "still exactly one numbering RPC call site, untouched by B7-0A");
});

test("the authoritative intent action binds the real gateway and is mounted only by the production create route", () => {
  // The module name is assembled from fragments so source-scanning tests do not mistake this
  // contract test's own source text for a production importer.
  const action = codeOf(
    "src/components/estimates/wizard/save/save-estimate-from-wizard-" + "intent-action.ts",
  );
  const REAL = "supabase" + "PersistenceGateway";
  assert.match(action, new RegExp(`new EstimatePersistenceService\\(\\s*${REAL}\\s*\\)`),
    "B7-1 binds the real gateway");
  assert.equal(action.includes("notImplementedPersistenceGateway"), false,
    "the placeholder binding is gone");

  // B7-3 made the action reachable from exactly one fail-closed server route.
  // No second app route may create another persistence entry point.
  const appDir = "src/" + "app";
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const mod = "save-estimate-from-wizard-" + "intent-action";
  const routeImporters = walk(appDir).filter((f) => codeOf(f).includes(mod));
  assert.deepEqual(
    routeImporters,
    ["src/app/estimates/new/page.tsx"],
    `only the accepted production create route may reach the action; found: ${routeImporters.join(", ")}`,
  );
});

test("the new migration adds the three-argument RPC and drops the four-argument one", () => {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const dir = "supabase/migrations";
  const migration = readdirSync(dir).find((f) => f.endsWith("_estimate_wizard_atomic_numbering.sql"));
  assert.ok(migration, "the B7-0A migration exists");
  const sql = readFileSync(`${dir}/${migration}`, "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_estimate_from_wizard\(\s*\n\s*p_dealer_id\s+uuid,\s*\n\s*p_actor_user_id\s+uuid,\s*\n\s*p_payload\s+jsonb\s*\n\)/,
    "the new signature is exactly three arguments");
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.save_estimate_from_wizard\(uuid, uuid, text, jsonb\);/,
    "the old four-argument writable path is dropped");
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_estimate_from_wizard\(uuid, uuid, jsonb\)\s*\n\s*TO service_role;/,
    "EXECUTE is granted to service_role only");
  assert.equal(/GRANT EXECUTE ON FUNCTION public\.save_estimate_from_wizard\(uuid, uuid, jsonb\)[\s\S]{0,80}TO (PUBLIC|anon|authenticated)/.test(sql),
    false, "never granted to PUBLIC, anon or authenticated");
});

test("the historical hardening migration is not modified by B7-0A", () => {
  const sql = readFileSync(
    "supabase/migrations/20260719122621_estimate_wizard_atomic_save_hardening.sql", "utf8");
  assert.match(sql, /p_estimate_number text,/,
    "the historical four-argument definition remains as written — history is immutable");
});

test("the gateway holds no client-supplied dealer id or JWT claim-bag authorization", () => {
  const code = codeOf(GATEWAY);
  assert.equal(/user_metadata|app_metadata/.test(code), false,
    "user-writable claims are not an authorization source");
});
