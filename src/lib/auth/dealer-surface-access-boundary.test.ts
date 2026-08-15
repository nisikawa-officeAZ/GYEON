// GYEON-PARTNER-ONBOARD-F1 — the central dealer-shell access boundary.
//
// Run: node --import tsx --test src/lib/auth/dealer-surface-access-boundary.test.ts
//
// Proves the mandatory GPT correction: MainLayout is the SHARED SERVER guard
// (not per-page inserts), MainLayoutClient holds the byte-moved client shell,
// and no non-dealer-shell exception route imports MainLayout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAIN = "src/components/layout/MainLayout.tsx";
const CLIENT = "src/components/layout/MainLayoutClient.tsx";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// A page imports the guard-wrapped shell iff it imports the exact module
// specifier (the trailing quote excludes MainLayoutClient).
const SHELL_IMPORT = /from\s+"@\/components\/layout\/MainLayout"/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

test("1. MainLayout is an async SERVER wrapper that guards BEFORE rendering the shell", () => {
  const raw = readFileSync(MAIN, "utf8");
  const code = strip(raw);
  assert.equal(raw.includes('"use client"'), false, "MainLayout must be a server component");
  assert.match(code, /import \{ requireActiveDealer \} from "@\/lib\/auth\/require-active-dealer"/);
  assert.match(code, /import MainLayoutClient from "@\/components\/layout\/MainLayoutClient"/);
  assert.match(code, /export default async function MainLayout\(/);
  const guardAt = code.indexOf("await requireActiveDealer()");
  const shellAt = code.indexOf("<MainLayoutClient");
  assert.ok(guardAt >= 0 && shellAt >= 0);
  assert.ok(guardAt < shellAt, "the guard runs before the shell renders");
  assert.match(code, /footer=\{footer\}/, "the existing footer prop is preserved");
});

test("2. MainLayoutClient carries the client shell (moved implementation intact)", () => {
  const raw = readFileSync(CLIENT, "utf8");
  assert.match(raw, /^"use client";/, "the shell is the client component");
  for (const piece of [
    "StaffProvider",
    'from "@/components/Header"',
    'from "@/components/Sidebar"',
    'from "@/components/layout/BottomNav"',
    'from "@/components/trial/TrialBanner"',
    "const HEADER_OFFSET",
    "useState",
    "footer && <footer>{footer}</footer>",
  ]) {
    assert.ok(raw.includes(piece), `shell piece missing from MainLayoutClient: ${piece}`);
  }
  assert.equal(SHELL_IMPORT.test(raw), false, "the shell never imports its own wrapper");
});

test("3. MainLayoutClient does NOT guard and MainLayout does NOT own shell UI", () => {
  const client = strip(readFileSync(CLIENT, "utf8"));
  assert.equal(client.includes("requireActiveDealer"), false, "guarding lives in the wrapper only");
  const main = strip(readFileSync(MAIN, "utf8"));
  for (const forbidden of ["useState", "StaffProvider", "<Header", "<Sidebar", "<BottomNav"]) {
    assert.equal(main.includes(forbidden), false, `wrapper must not own shell UI: ${forbidden}`);
  }
});

test("4. every MainLayout importer under src/app is a SERVER file (guard cannot be bypassed by client rendering)", () => {
  const importers = walk("src/app").filter((p) => SHELL_IMPORT.test(readFileSync(p, "utf8")));
  assert.ok(importers.length >= 30, `expected the broad dealer surface, got ${importers.length}`);
  for (const p of importers) {
    const head = readFileSync(p, "utf8").slice(0, 200);
    assert.equal(head.includes('"use client"'), false, `client importer would break the server guard: ${p}`);
  }
});

test("5. non-dealer-shell exceptions never import MainLayout", () => {
  const importers = walk("src/app").filter((p) => SHELL_IMPORT.test(readFileSync(p, "utf8")));
  const exceptionPrefixes = [
    "src/app/login",
    "src/app/signup",
    "src/app/forgot-password",
    "src/app/reset-password",
    "src/app/auth",
    "src/app/api",
    "src/app/admin",
    "src/app/s/",
    "src/app/liff",
    "src/app/app",
    "src/app/no-dealer",
    "src/app/shop-profile",
    "src/app/onboarding",
  ];
  for (const p of importers) {
    for (const prefix of exceptionPrefixes) {
      assert.equal(p.startsWith(prefix), false,
        `exception route must stay outside the dealer shell guard: ${p}`);
    }
  }
});

test("6. the guarded surface includes the named dealer pages, UNMODIFIED by this phase's ten-page proposal", () => {
  // The A2-R1 per-page inserts were REJECTED: these pages get their boundary
  // from MainLayout alone and must not call requireActiveDealer themselves.
  const namedPages = [
    "src/app/products/page.tsx",
    "src/app/product-orders/page.tsx",
    "src/app/estimates/page.tsx",
    "src/app/settings/page.tsx",
    "src/app/settings/[category]/page.tsx",
    "src/app/settings/ai/page.tsx",
    "src/app/settings/business-hours/page.tsx",
    "src/app/settings/estimate-wizard/page.tsx",
    "src/app/settings/staff-capacity/page.tsx",
    "src/app/settings/service-durations/page.tsx",
  ];
  for (const p of namedPages) {
    const raw = readFileSync(p, "utf8");
    assert.ok(SHELL_IMPORT.test(raw), `named dealer page must render inside MainLayout: ${p}`);
    assert.equal(raw.includes("requireActiveDealer"), false,
      `central guard only — no per-page insert: ${p}`);
  }
});
