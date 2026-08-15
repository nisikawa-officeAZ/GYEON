// R92B Phase 2 — source guards for the PUBLIC estimate-share surface.
//
// Run: node --import tsx --test src/app/s/e/share-route.test.ts
//
// The page and route handler pull in server-only modules (via
// resolve-estimate-share → supabase admin), unresolvable under this runner, so
// their guarantees are asserted from SOURCE TEXT: unauthenticated reachability,
// one indistinguishable failure, no data leak, and header safety through the
// SAME pure helpers the authenticated download uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PAGE = "src/app/s/e/[token]/page.tsx";
const ROUTE = "src/app/s/e/[token]/file/route.ts";
const MIDDLEWARE = "src/middleware.ts";

// ── 1-3. Middleware makes /s/e public, and only /s/e ───────────────────────

test("1. /s/e is a public prefix, so the share surface is reachable without a session", () => {
  const code = codeOf(MIDDLEWARE);
  assert.match(code, /const PUBLIC_PREFIXES = \[[\s\S]*?"\/s\/e",[\s\S]*?\]/, "/s/e is listed among the public prefixes");
});

test("2. the public match is prefix-scoped to /s/e — not a broad /s opening", () => {
  const code = codeOf(MIDDLEWARE);
  // The matcher tests `pathname === p || pathname.startsWith(p + "/")`, so "/s/e"
  // covers /s/e and /s/e/<token>/file but NOT some sibling /s/x.
  assert.match(code, /pathname === p \|\| pathname\.startsWith\(p \+ "\/"\)/);
  assert.equal(code.includes('"/s",'), false, "must not open the whole /s namespace");
});

// ── 3-6. The landing page ──────────────────────────────────────────────────

test("3. the page is an unauthenticated Server Component — no directive, node runtime", () => {
  const raw = readFileSync(PAGE, "utf8");
  assert.equal(raw.includes('"use client"'), false, "not a client component");
  assert.equal(raw.includes('"use server"'), false, "not a Server Action file");
  assert.equal(raw.includes('import "server-only"'), false);
  const code = codeOf(PAGE);
  assert.match(code, /runtime = "nodejs"/);
  // No auth gate is imported here — the middleware public prefix is the contract.
  for (const forbidden of ["getCurrentDealer", "getCurrentUser", "redirect("]) {
    assert.equal(code.includes(forbidden), false, `the public page references ${forbidden}`);
  }
});

test("4. the page awaits the async params and resolves the token via the pure boundary", () => {
  const code = codeOf(PAGE);
  assert.match(code, /params: Promise<\{ token: string \}>/, "Next 15 async params");
  assert.match(code, /const \{ token \} = await params;/);
  assert.match(code, /resolveEstimateShare\(token\)/);
});

test("5. the page renders exactly two states and links to the file route on success", () => {
  const code = codeOf(PAGE);
  // Failure branch first — anything not `available` shows the same notice.
  assert.match(code, /resolved\.kind !== "available"/);
  // Success links to the sibling file route, opening the PDF.
  assert.match(code, /\/s\/e\/\$\{encodeURIComponent\(token\)\}\/file/);
});

test("6. the page leaks NO estimate, customer or dealer data — only the file link", () => {
  const code = codeOf(PAGE);
  for (const forbidden of [
    "customer", "estimate_number", "estimateNumber", "total", "合計", "dealer",
    "filePath", "file_path", "token_hash",
  ]) {
    assert.equal(code.includes(forbidden), false, `the public page discloses ${forbidden}`);
  }
});

// ── 7-10. The file route ───────────────────────────────────────────────────

test("7. the route is an unauthenticated Route Handler — no directive, node runtime", () => {
  const raw = readFileSync(ROUTE, "utf8");
  assert.equal(raw.includes('"use client"'), false);
  assert.equal(raw.includes('"use server"'), false);
  assert.equal(raw.includes('import "server-only"'), false);
  const code = codeOf(ROUTE);
  assert.match(code, /runtime = "nodejs"/);
  for (const forbidden of ["getCurrentDealer", "getCurrentUser"]) {
    assert.equal(code.includes(forbidden), false, `the public route references ${forbidden}`);
  }
});

test("8. the route resolves, then downloads, and answers a UNIFORM 404 for every failure", () => {
  const code = codeOf(ROUTE);
  assert.match(code, /const \{ token \} = await params;/);
  const resolveAt = code.indexOf("resolveEstimateShare(token)");
  const downloadAt = code.indexOf("downloadSharedPdfBytes(");
  assert.ok(resolveAt >= 0 && downloadAt > resolveAt, "resolve precedes download");
  // Two distinct failure points, one identical response — nothing distinguishes
  // an unknown/expired/revoked token from a missing object.
  const notFounds = code.match(/new Response\("Not found", \{ status: 404 \}\)/g) ?? [];
  assert.equal(notFounds.length, 2, "both the unavailable share and the missing object answer the same 404");
});

test("9. the PDF headers match the R92B-H1 contract exactly", () => {
  const code = codeOf(ROUTE);
  assert.match(code, /from "@\/app\/pdf\/estimate\/pdf-response-headers"/, "reuses the audited header helper");
  // ATTACHMENT (a public link saves, not renders), no-store, no-referrer.
  assert.match(code, /buildContentDisposition\("attachment", resolved\.fileName\)/);
  assert.equal(code.includes('buildContentDisposition("inline"'), false, "must NOT serve inline");
  assert.match(code, /"Content-Type": "application\/pdf"/);
  assert.match(code, /"Cache-Control": "no-store"/);
  assert.match(code, /"Referrer-Policy": "no-referrer"/);
});

test("10. the route exposes no storage internals to the client", () => {
  const code = codeOf(ROUTE);
  for (const forbidden of ["createAdminClient", ".storage", "SUPABASE_SERVICE_ROLE_KEY", "token_hash", "filePath: resolved"]) {
    assert.equal(code.includes(forbidden), false, `the route leaks ${forbidden}`);
  }
});

test("11. the landing page is marked noindex,nofollow — the URL itself is the secret", () => {
  const code = codeOf(PAGE);
  assert.match(code, /export const metadata: Metadata = \{/);
  assert.match(code, /robots: \{ index: false, follow: false \}/);
});
