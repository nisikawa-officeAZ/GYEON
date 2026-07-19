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

// ── No source-reachable importer of the real gateway ─────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    out.push(`${e.parentPath ?? dir}/${e.name}`);
  }
  return out;
}

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

test("NO action, page or component imports the real gateway", () => {
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${REAL_GATEWAY_MODULE}.ts`)) continue;   // the gateway itself
    if (importsGateway(codeOf(file))) importers.push(file);
  }
  assert.deepEqual(importers, [],
    `the real gateway must have zero source-reachable importers; found: ${importers.join(", ")}`);
});

test("NO file outside the gateway BINDS the real gateway to a persistence service", () => {
  const binders: string[] = [];
  const bindPattern = new RegExp(`new EstimatePersistenceService\\(\\s*${REAL_GATEWAY_SYMBOL}\\s*\\)`);
  for (const file of walk("src")) {
    if (GUARD_FILES.has(file)) continue;   // these assert the absence of exactly this pattern
    if (bindPattern.test(codeOf(file))) binders.push(file);
  }
  assert.deepEqual(binders, [], `nothing may bind the real gateway; found: ${binders.join(", ")}`);
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

// ── B3 remains placeholder-bound and unmounted ───────────────────────────────

const B3_ACTION = `${SAVE_DIR}save-estimate-from-wizard` + "-intent-action.ts";

test("the B3 intent action remains placeholder-bound", () => {
  const code = codeOf(B3_ACTION);
  assert.match(code, /new EstimatePersistenceService\(\s*notImplementedPersistenceGateway\s*\)/,
    "still bound to the placeholder gateway");
  assert.equal(code.includes(REAL_GATEWAY_SYMBOL), false, "still does not reference the real gateway");
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
