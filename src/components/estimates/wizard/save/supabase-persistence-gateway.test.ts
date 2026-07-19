// R56B — source guards for the hardened (still UNBOUND) real persistence gateway.
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

test("the dev-only diagnostic logs code+message only, and is production-gated", () => {
  const code = codeOf(GATEWAY);
  if (/console\.error/.test(code)) {
    assert.match(code, /process\.env\.NODE_ENV\s*!==\s*["']production["']/,
      "the diagnostic is gated out of production");
    assert.equal(/console\.error[\s\S]{0,200}error\.details|console\.error[\s\S]{0,200}error\.hint/.test(code),
      false, "the diagnostic must not log details/hint");
  }
});

// ── R56D: the numbering allocation is DEALER-BOUND and FAIL-CLOSED ───────────
// These replace the R56B defect-pins (which asserted the gateway called the bare
// allocator, and that the allocator still contained getCurrentDealer/fallbackNum).
// Those were deliberate records of the open blocker; R56D closes it, so they are
// now inverted into positive assertions.

const ALLOCATOR = "src/lib/numbering/get-next-document-number.ts";

test("the gateway allocates the number for the server-proven dealer", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /import\s*\{\s*getNextDocumentNumberForDealer\s*\}\s*from\s*["']@\/lib\/numbering\/get-next-document-number["']/,
    "imports the dealer-bound allocator");
  assert.match(code, /getNextDocumentNumberForDealer\(\s*["']estimate["']\s*,\s*ctx\.dealerId\s*\)/,
    "allocates for exactly ctx.dealerId");
  // The bare one-argument form must be gone: it is what discarded the tenant.
  assert.equal(/getNextDocumentNumber\(\s*["']estimate["']\s*\)/.test(code), false,
    "no bare getNextDocumentNumber(\"estimate\") remains");
  assert.equal(/getCurrentDealer/.test(code), false,
    "the gateway never resolves a dealer itself");
});

test("the same dealer id feeds numbering and the save RPC", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /getNextDocumentNumberForDealer\(\s*["']estimate["']\s*,\s*ctx\.dealerId\s*\)/,
    "numbering uses ctx.dealerId");
  assert.match(code, /p_dealer_id:\s*ctx\.dealerId/, "the save RPC uses the SAME ctx.dealerId");
  // Neither may come from the client payload.
  assert.equal(/getNextDocumentNumberForDealer\([^)]*payload/.test(code), false,
    "the dealer id is never taken from the payload");
});

test("a null allocation still maps to ESTIMATE_NUMBER_FAILED", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /if\s*\(\s*!estimateNumber\s*\)[\s\S]{0,160}code:\s*"ESTIMATE_NUMBER_FAILED"/,
    "fail-closed allocation maps to the stable code");
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

test("R56D changes no migration and no production route", () => {
  // The numbering RPC already accepts p_dealer_id and already authorizes on it
  // (046 + 104), so R56D is a pure TypeScript correction.
  const allocator = codeOf(ALLOCATOR);
  assert.match(allocator, /p_dealer_id:\s*dealerId/, "passes the caller's dealer id straight through");
  const guard = readFileSync("src/app/admin/dev-preview/estimate-wizard/page.tsx", "utf8");
  assert.match(guard, /NODE_ENV === "production"\)\s*notFound\(\)/,
    "the production route guard is untouched");
});

// ── The gateway remains UNBOUND ──────────────────────────────────────────────

test("the gateway exports the binding but nothing binds it", () => {
  const code = codeOf(GATEWAY);
  assert.match(code, /export const supabasePersistenceGateway/, "still exported for a future phase");
  // Reachability is asserted exhaustively in legacy-save-action-disabled.test.ts; this pins the
  // one former importer.
  const legacy = codeOf(`${SAVE_DIR}save-estimate-from-wizard-action.ts`);
  assert.equal(legacy.includes("supabase" + "PersistenceGateway"), false,
    "the legacy action no longer binds the real gateway");
});

test("the gateway holds no client-supplied dealer id or JWT claim-bag authorization", () => {
  const code = codeOf(GATEWAY);
  assert.equal(/user_metadata|app_metadata/.test(code), false,
    "user-writable claims are not an authorization source");
});
