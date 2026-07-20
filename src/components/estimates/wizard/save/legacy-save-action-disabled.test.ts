// R56B — source guards proving the LEGACY save path is disabled.
// Run: node --import tsx --test src/components/estimates/wizard/save/legacy-save-action-disabled.test.ts
//
// The legacy action is a "use server" module that imports server-only code, so it is NEVER imported
// here. Its guarantees are asserted by inspecting SOURCE TEXT.
//
// Why this file exists: until R56B this action was the ONE source-complete route to real
// persistence — browser → ScreensPreview (a client component that prices in the browser) → this
// action → the real atomic-RPC gateway. These guards prevent that binding from silently returning.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SAVE_DIR = "src/components/estimates/wizard/save/";
const LEGACY_ACTION = `${SAVE_DIR}save-estimate-from-wizard-action.ts`;
// Assembled from fragments so this guard file does not itself register as an importer
// of the real gateway in the scans below.
const REAL_GATEWAY_SYMBOL = "supabase" + "PersistenceGateway";
const REAL_GATEWAY_MODULE = "supabase-persistence" + "-gateway";

// ── The legacy action binds ONLY the placeholder gateway ─────────────────────

test("the legacy action imports the placeholder gateway and binds it", () => {
  const code = codeOf(LEGACY_ACTION);
  assert.match(code, /import\s*\{\s*notImplementedPersistenceGateway\s*\}\s*from\s*["']\.\/estimate-persistence-gateway["']/,
    "imports the placeholder gateway");
  assert.match(code, /new EstimatePersistenceService\(\s*notImplementedPersistenceGateway\s*\)/,
    "binds the placeholder gateway");
  assert.equal((code.match(/new EstimatePersistenceService\(/g) ?? []).length, 1,
    "exactly one service construction");
});

test("the legacy action no longer references the REAL gateway in code", () => {
  const code = codeOf(LEGACY_ACTION);
  assert.equal(code.includes(REAL_GATEWAY_SYMBOL), false, "no real-gateway symbol");
  assert.equal(code.includes(REAL_GATEWAY_MODULE), false, "no real-gateway module import");
  assert.equal(/createAdminClient|SUPABASE_SERVICE_ROLE_KEY|service_role/.test(code), false,
    "the legacy action holds no service-role surface");
  assert.equal(/\.rpc\(/.test(code), false, "performs no RPC call of its own");
});

test("the legacy action is still a Server Action with its signature intact", () => {
  const raw = readFileSync(LEGACY_ACTION, "utf8");
  assert.match(raw, /^["']use server["'];/, "first statement is the server directive");
  assert.match(codeOf(LEGACY_ACTION), /export async function saveEstimateFromWizardAction\(/,
    "the exported action name is unchanged — ScreensPreview is frozen and still calls it");
});

test("the legacy action retains its auth / dealer / permission gates", () => {
  // Retained deliberately: they are the failure ordering the frozen ScreensPreview expects.
  const code = codeOf(LEGACY_ACTION);
  for (const gate of ["getCurrentUser", "getCurrentDealer", "requireStaffCapability"]) {
    assert.ok(code.includes(gate), `${gate} gate retained`);
  }
});

// ── ScreensPreview is untouched ──────────────────────────────────────────────

test("ScreensPreview is unchanged and still calls the legacy action", () => {
  const preview = readFileSync(`${SAVE_DIR}../screens/ScreensPreview.tsx`, "utf8");
  assert.ok(preview.includes("saveEstimateFromWizardAction"), "still calls the legacy action");
  assert.equal(preview.includes(REAL_GATEWAY_SYMBOL), false,
    "ScreensPreview never referenced the real gateway and still does not");
});

// ── Exactly one permitted importer and binder of the real gateway ────────────
//
// Before B7-1 this section asserted ZERO importers. It is now an exact-path
// allowlist of one: the authoritative intent action. That is a narrower claim
// than it looks — every other file, including any future route or UI module,
// still fails these two tests.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    out.push(`${e.parentPath ?? dir}/${e.name}`);
  }
  return out;
}

/**
 * The ONE production file permitted to import and bind the real gateway (B7-1).
 *
 * Assembled from fragments so this guard is not itself counted as an importer of
 * the intent action by the zero-importer walk below.
 */
const AUTHORITATIVE_ACTION =
  `${SAVE_DIR}save-estimate-from-wizard-` + "intent-action.ts";

const GUARD_FILES = new Set([
  `${SAVE_DIR}legacy-save-action-disabled.test.ts`,
  `${SAVE_DIR}supabase-persistence-gateway.test.ts`,
]);

// An IMPORT is what makes the gateway reachable. A file that merely names it in a comment or inside
// a source-guard assertion is not an importer, so this scans comment-stripped code for real import
// syntax (static and dynamic) rather than for the bare substring.
const importsGateway = (code: string): boolean =>
  new RegExp(`from\\s*["'][^"']*${REAL_GATEWAY_MODULE}["']`).test(code)
  || new RegExp(`import\\s*\\(\\s*["'][^"']*${REAL_GATEWAY_MODULE}["']`).test(code)
  || new RegExp(`require\\s*\\(\\s*["'][^"']*${REAL_GATEWAY_MODULE}["']`).test(code);

test("EXACTLY ONE production importer of the real gateway is permitted", () => {
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${REAL_GATEWAY_MODULE}.ts`)) continue;   // the gateway itself
    if (importsGateway(codeOf(file))) importers.push(file);
  }
  // B7-1: the real gateway now has EXACTLY ONE permitted production importer — the
  // authoritative intent action. This is an exact-path allowlist, not an exemption
  // pattern: any other importer, including a future route or UI module, still fails.
  assert.deepEqual(importers, [AUTHORITATIVE_ACTION],
    `only the authoritative intent action may import the real gateway; found: ${importers.join(", ")}`);
});

test("EXACTLY ONE file binds the real gateway to a persistence service", () => {
  const binders: string[] = [];
  const bindPattern = new RegExp(`new EstimatePersistenceService\\(\\s*${REAL_GATEWAY_SYMBOL}\\s*\\)`);
  for (const file of walk("src")) {
    if (GUARD_FILES.has(file)) continue;   // these assert the absence of exactly this pattern
    if (bindPattern.test(codeOf(file))) binders.push(file);
  }
  assert.deepEqual(binders, [AUTHORITATIVE_ACTION],
    `only the authoritative intent action may bind the real gateway; found: ${binders.join(", ")}`);
});

test("the save barrel does not re-export the real gateway and has no wildcard export", () => {
  const barrel = readFileSync(`${SAVE_DIR}index.ts`, "utf8");
  assert.equal(barrel.includes(REAL_GATEWAY_MODULE), false, "not re-exported");
  assert.equal(/export\s+\*/.test(barrel), false, "no wildcard export could pick it up");
});

test("nothing under src/app imports the real gateway", () => {
  for (const file of walk("src/app")) {
    assert.equal(importsGateway(codeOf(file)), false, `${file} must not import the real gateway`);
    assert.equal(codeOf(file).includes(REAL_GATEWAY_SYMBOL), false,
      `${file} must not reference the real gateway`);
  }
});

// ── The authoritative intent action: real-gateway-bound, still unmounted ─────
//
// B7-1 armed persistence here. What keeps it safe is REACHABILITY — nothing
// imports this action — not the binding, which is now real.

const B3_ACTION = `${SAVE_DIR}save-estimate-from-wizard` + "-intent-action.ts";

test("B7-1: the authoritative intent action binds the REAL gateway, exactly once", () => {
  const code = codeOf(B3_ACTION);
  assert.match(code, new RegExp(`new EstimatePersistenceService\\(\\s*${REAL_GATEWAY_SYMBOL}\\s*\\)`),
    "bound to the real gateway");
  assert.equal((code.match(/new EstimatePersistenceService\(/g) ?? []).length, 1,
    "exactly one service construction — no second, differently-bound instance");
  // The placeholder must be fully gone: leaving it imported would allow a future
  // edit to re-bind it under a branch and make persistence conditionally silent.
  assert.equal(code.includes("notImplementedPersistenceGateway"), false,
    "the placeholder gateway is no longer imported or referenced");
  assert.match(code, new RegExp(`import \\{ ${REAL_GATEWAY_SYMBOL} \\} from ["']\\./supabase-persistence` + `-gateway["']`),
    "imports the real gateway directly, not through a barrel");
});

test("B7-1: arming persistence did NOT change orchestration, actor or request-id behaviour", () => {
  const code = codeOf(B3_ACTION);
  // The binding is the ONLY thing this phase may change.
  assert.match(code, /getEstimateSaveActorContext/, "actor resolution unchanged");
  assert.match(code, /getAuthoritativeWizardRuntimeConfigForDealer/, "dealer-bound runtime config unchanged");
  assert.match(code, /createObservabilityRequestId\(\)/, "server-generated obs request id unchanged");
  assert.match(code, /createWizardSaveFailureReporter\(requestId\)/, "observability ownership unchanged");
  assert.match(code, /runWizardSaveIntent\(raw, \{/, "the pure orchestrator still owns ordering");
  assert.match(code, /saveEstimateFromWizardIntentAction\(\s*raw:\s*unknown\s*\)/,
    "the signature still accepts no client-supplied context");
});

test("the B3 intent action remains unmounted (zero real importers)", () => {
  const module = "save-estimate-from-wizard" + "-intent-action";
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${module}.ts`)) continue;
    if (GUARD_FILES.has(file)) continue;
    if (file.endsWith("wizard-save-intent-orchestrator.test.ts")) continue;  // source-text guard
    if (readFileSync(file, "utf8").includes(module)) importers.push(file);
  }
  assert.deepEqual(importers, [], `B3 action must remain unmounted; found: ${importers.join(", ")}`);
});

// ── Neither guard file contains a raw NUL byte (R54B-F2 regression) ──────────

test("no B3/R56B guard source contains a raw NUL or other C0 control byte", () => {
  const ALLOWED = new Set([0x09, 0x0a, 0x0d]);
  for (const src of [LEGACY_ACTION, `${SAVE_DIR}supabase-persistence-gateway.ts`, ...GUARD_FILES]) {
    const bytes = readFileSync(src);
    const bad: string[] = [];
    for (let i = 0; i < bytes.length; i += 1) {
      const b = bytes[i] as number;
      if (b < 0x20 && !ALLOWED.has(b)) bad.push(`0x${b.toString(16).padStart(2, "0")}@${i}`);
    }
    assert.deepEqual(bad, [], `${src} contains raw control byte(s): ${bad.join(", ")}`);
  }
});
