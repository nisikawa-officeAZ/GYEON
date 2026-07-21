// B7-3 — production route reachability + create-surface source guards.
//
// Run: node --import tsx --test src/components/estimates/wizard/production/production-route-reachability.test.ts
//
// The create route is a Server Component that imports "use server" + server-only
// modules, so it cannot be runtime-imported here. Every assertion reads SOURCE
// (comment-stripped for executable scans). Module tokens are assembled from
// fragments so this guard never counts itself as an importer.
//
// This file lives OUTSIDE src/app on purpose: the src/app importer scans below
// must see only the real route, not this test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const ROUTE = "src/app/estimates/new/page.tsx";

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    out.push(`${e.parentPath ?? dir}/${e.name}`);
  }
  return out;
}

// Fragment-assembled so this guard file is not itself an importer match.
const ACTION_MODULE = "save-estimate-from-wizard" + "-intent-action";
const GATEWAY_MODULE = "supabase-persistence" + "-gateway";
const AUTH_ACTION = "src/components/estimates/wizard/save/" + ACTION_MODULE + ".ts";
const ACTION_SYMBOL = "saveEstimateFromWizard" + "IntentAction";

const importsModule = (code: string, mod: string): boolean =>
  new RegExp(`from\\s*["'][^"']*${mod}["']`).test(code)
  || new RegExp(`import\\s*\\(\\s*["'][^"']*${mod}["']`).test(code);

const isTest = (f: string): boolean => /\.test\.(ts|tsx)$/.test(f);

// ── The create route wires the wizard + action correctly ────────────────────

test("the route imports ProductionEstimateWizard exactly once and mounts it once", () => {
  const code = codeOf(ROUTE);
  assert.match(code,
    /import ProductionEstimateWizard from ["']@\/components\/estimates\/wizard\/production\/ProductionEstimateWizard["']/,
    "single default import");
  assert.equal((code.match(/<ProductionEstimateWizard\b/g) ?? []).length, 1, "mounted exactly once");
});

test("the route imports the real action exactly once, passed ONLY as saveInvoker", () => {
  const code = codeOf(ROUTE);
  assert.equal(
    (code.match(new RegExp(`from\\s*["'][^"']*${ACTION_MODULE}["']`, "g")) ?? []).length, 1,
    "exactly one direct action import");
  assert.match(code, new RegExp(`saveInvoker=\\{${ACTION_SYMBOL}\\}`), "passed as saveInvoker");
  // The symbol appears exactly twice: the import binding and the single prop.
  assert.equal((code.match(new RegExp(ACTION_SYMBOL, "g")) ?? []).length, 2,
    "the action is used nowhere but the saveInvoker prop");
});

test("EstimateEditor is absent from the create route", () => {
  assert.equal(codeOf(ROUTE).includes("EstimateEditor"), false);
});

test("the actor resolver is called exactly once and its context feeds both loaders", () => {
  const code = codeOf(ROUTE);
  assert.equal((code.match(/getEstimateSaveActorContext\(/g) ?? []).length, 1, "resolved once");
  assert.match(code, /getAuthoritativeWizardRuntimeConfigForDealer\(actor\.context\)/, "same context → runtime");
  assert.match(code, /loadDealerWizardEntityReferences\(actor\.context\)/, "same context → entities");
});

test("runtime props and lifecycle.currentRevision are mapped exactly", () => {
  const code = codeOf(ROUTE);
  for (const mapping of [
    /mode="create"/,
    /shopRank=\{runtime\.shopRank\}/,
    /catalog=\{runtime\.catalog\}/,
    /screenConfig=\{runtime\.screenConfig\}/,
    /pricingConfig=\{runtime\.pricingConfig\}/,
    /customers=\{references\.customers\}/,
    /vehicles=\{references\.vehicles\}/,
    /expectedConfigRevision=\{runtime\.lifecycle\.currentRevision\}/,
  ]) {
    assert.match(code, mapping, `missing exact mapping ${mapping}`);
  }
});

test("failure dispositions are exact and fail-closed", () => {
  const code = codeOf(ROUTE);
  assert.match(code, /actor\.reason === "unauthenticated"[\s\S]*?redirect\("\/login"\)/, "unauthenticated → /login");
  assert.match(code, /actor\.reason === "no-active-membership"[\s\S]*?redirect\("\/no-dealer"\)/, "no membership → /no-dealer");
  assert.match(code, /if \(!actor\.ok\)[\s\S]*?return <Unavailable \/>;/, "other actor failures → Unavailable");
  assert.match(code, /if \(!runtime\.ok\) return <Unavailable \/>;/, "every runtime failure → Unavailable");
  assert.match(code, /if \(!references\.ok\) return <Unavailable \/>;/, "every entity failure → Unavailable");
  // No broad try/catch — uncaught failures must reach the estimates error boundary.
  assert.equal(/try\s*\{/.test(code), false, "no broad try/catch in the route");
  // Success mounts exactly once.
  assert.equal((code.match(/<ProductionEstimateWizard\b/g) ?? []).length, 1);
});

test("the Unavailable notice is fixed copy and leaks no internal reason", () => {
  const code = codeOf(ROUTE);
  assert.match(code, /data-testid="estimate-create-unavailable"/);
  assert.match(code, /role="alert"/);
  assert.match(code, /見積を開始できません/, "exact heading");
  assert.match(code,
    /現在この画面をご利用いただけません。時間をおいて再度お試しいただくか、担当者へご連絡ください。/, "exact body");
  // The notice component takes no props and renders no dynamic value.
  const start = code.indexOf("function Unavailable(");
  assert.ok(start >= 0, "PRECONDITION: Unavailable located");
  assert.match(code.slice(start, start + 40), /function Unavailable\(\)/, "takes no props");
  const body = code.slice(start, code.indexOf("export default async function"));
  for (const leak of ["reason", "message", "stack", "digest", "error", "code",
                      "dealerId", "userId", ".role", "{actor", "{runtime", "{references"]) {
    assert.equal(body.includes(leak), false, `Unavailable renders ${leak}`);
  }
});

test("search params are scalar-normalized and untrusted", () => {
  const code = codeOf(ROUTE);
  assert.match(code, /customer_id\?: string \| string\[\]/, "customer_id typed as production delivers it");
  assert.match(code, /vehicle_id\?: string \| string\[\]/, "vehicle_id likewise");
  assert.match(code, /typeof value === "string" \? value : undefined/, "scalar-only normalization");
  assert.match(code, /defaultCustomerId=\{scalar\(customer_id\)\}/);
  assert.match(code, /defaultVehicleId=\{scalar\(vehicle_id\)\}/);
});

test("the route owns no ws/sessionStorage/crypto/idempotency state", () => {
  const code = codeOf(ROUTE);
  // Word-boundary, not substring: a bare `ws` identifier is rejected without
  // false-matching unrelated words that merely contain the letters.
  assert.equal(/\bws\b/.test(code), false, "the route must not read or own ws");
  for (const forbidden of ["sessionStorage", "crypto", "idempotency", "wizardSessionId",
                          "localStorage", "history.replaceState"]) {
    assert.equal(code.includes(forbidden), false, `route touches ${forbidden}`);
  }
});

test("no feature flag, fallback editor, preview bridge or dev harness", () => {
  const code = codeOf(ROUTE);
  for (const forbidden of ["EstimateEditor", "ScreensPreview", "wizardPreview",
                          "featureFlag", "getCustomers", "getVehicles"]) {
    assert.equal(code.includes(forbidden), false, `route references ${forbidden}`);
  }
});

// ── Whole-tree reachability counts ──────────────────────────────────────────

test("the real action has exactly ONE production importer: the create route", () => {
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${ACTION_MODULE}.ts`)) continue;   // the action itself
    if (isTest(file)) continue;                            // guards name it, never import it
    if (importsModule(codeOf(file), ACTION_MODULE)) importers.push(file);
  }
  assert.deepEqual(importers, [ROUTE], `action importers: ${importers.join(", ")}`);
});

test("ProductionEstimateWizard has exactly ONE route importer: the create route", () => {
  const importers: string[] = [];
  for (const file of walk("src/app")) {
    if (isTest(file)) continue;
    if (codeOf(file).includes("ProductionEstimateWizard")) importers.push(file);
  }
  assert.deepEqual(importers, [ROUTE], `route importers: ${importers.join(", ")}`);
});

test("the real gateway still has exactly ONE production importer: the authoritative action", () => {
  const importers: string[] = [];
  for (const file of walk("src")) {
    if (file.endsWith(`${GATEWAY_MODULE}.ts`)) continue;
    if (isTest(file)) continue;
    if (importsModule(codeOf(file), GATEWAY_MODULE)) importers.push(file);
  }
  assert.deepEqual(importers, [AUTH_ACTION], `gateway importers: ${importers.join(", ")}`);
});

test("the save barrel exports neither the real action nor a second adapter", () => {
  const barrel = "src/components/estimates/wizard/save/index.ts";
  const raw = readFileSync(barrel, "utf8");
  assert.equal(raw.includes(ACTION_MODULE), false, "the action is not re-exported from the barrel");
  assert.equal(/export\s+\*/.test(raw), false, "no wildcard export could re-export it");
});

// ── The two locked existing surfaces remain byte-identical ──────────────────

test("the edit route and EstimateEditor are byte-unchanged", () => {
  const locked: Record<string, string> = {
    "src/app/estimates/[id]/edit/page.tsx":
      "56da7e5dae16842b766e87f63bbb22cba094eb3dd1326aa207d0ead00d8d8de8",
    "src/components/estimates/EstimateEditor.tsx":
      "188ba1b50cc5dd4503fa8538a0cb6a6dbac219d691d1d013d5f29b7cdf7f9207",
  };
  for (const [file, digest] of Object.entries(locked)) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), digest,
      `${file} must remain byte-identical`);
  }
});
