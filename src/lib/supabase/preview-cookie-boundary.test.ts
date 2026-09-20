// R4Q-R14-C1R — pins the accepted Preview cookie source contract: SameSite=
// None; Secure applies ONLY on a Vercel Preview deployment; production and
// localhost keep the default (Lax). This phase's allowlist explicitly
// prohibits editing client.ts / server.ts / middleware.ts — this test reads
// them only, to guard the accepted behavior against an unrelated future edit.
//
// Run: node --import tsx --test src/lib/supabase/preview-cookie-boundary.test.ts
//
// All three modules import next/headers or next/server and so cannot execute
// under node:test; the contract is pinned from source, the same discipline as
// the other server-boundary tests in this repo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CLIENT = "src/lib/supabase/client.ts";
const SERVER = "src/lib/supabase/server.ts";
const MIDDLEWARE = "src/middleware.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("1. client.ts: the browser client detects Preview via NEXT_PUBLIC_VERCEL_ENV, with a *.vercel.app host fallback, but never on explicit production", () => {
  const code = strip(readFileSync(CLIENT, "utf8"));
  assert.match(code, /const vercelEnv = process\.env\.NEXT_PUBLIC_VERCEL_ENV;/);
  assert.match(code, /vercelEnv === "preview"/);
  assert.match(code, /vercelEnv !== "production"/, "the host-fallback path is disabled once production is explicit");
  assert.match(code, /window\.location\.hostname\.endsWith\("\.vercel\.app"\)/);
});

test("2. client.ts: SameSite=None; Secure is applied ONLY inside the onVercelPreview branch — no other branch sets it", () => {
  const code = strip(readFileSync(CLIENT, "utf8"));
  const sameSiteNoneCount = (code.match(/sameSite = "none"/g) ?? []).length;
  const secureCount = (code.match(/cookieOptions\.secure = true/g) ?? []).length;
  assert.equal(sameSiteNoneCount, 1, "exactly one SameSite=None assignment in the whole module");
  assert.equal(secureCount, 1, "exactly one Secure assignment in the whole module");
  const guardAt = code.indexOf("if (onVercelPreview) {");
  const sameSiteAt = code.indexOf('sameSite = "none"');
  const secureAt = code.indexOf("cookieOptions.secure = true");
  assert.ok(guardAt >= 0 && sameSiteAt > guardAt && secureAt > guardAt,
    "both cookie-option writes sit inside the onVercelPreview guard");
});

test("3. client.ts: no cookieOptions.sameSite/secure are set by default — production/localhost keep the SDK default (Lax)", () => {
  const code = strip(readFileSync(CLIENT, "utf8"));
  const declAt = code.indexOf("const cookieOptions:");
  const guardAt = code.indexOf("if (onVercelPreview) {");
  assert.ok(declAt >= 0 && guardAt > declAt);
  const between = code.slice(declAt, guardAt);
  assert.equal(between.includes("cookieOptions.sameSite ="), false, "sameSite is not preset before the Preview guard");
  assert.equal(between.includes("cookieOptions.secure ="), false, "secure is not preset before the Preview guard");
});

test("4. server.ts: isPreview is derived strictly from VERCEL_ENV === 'preview' (server-side env, not the NEXT_PUBLIC client one)", () => {
  const code = strip(readFileSync(SERVER, "utf8"));
  assert.match(code, /const isPreview = process\.env\.VERCEL_ENV === "preview";/);
});

test("5. server.ts: cookieOptions {sameSite: none, secure: true} is applied ONLY when isPreview — the spread is empty otherwise", () => {
  const code = strip(readFileSync(SERVER, "utf8"));
  assert.match(code, /\.\.\.\(isPreview\s*\n?\s*\?\s*\{\s*cookieOptions:\s*\{\s*sameSite:\s*"none" as const,\s*secure:\s*true\s*\}\s*\}\s*\n?\s*:\s*\{\}\)/,
    "ternary: Preview → {sameSite:none,secure:true}, else → {} (SDK default)");
});

test("6. middleware.ts: isPreview uses the SAME server-side VERCEL_ENV check as server.ts, and the same conditional cookieOptions shape", () => {
  const code = strip(readFileSync(MIDDLEWARE, "utf8"));
  assert.match(code, /const isPreview = process\.env\.VERCEL_ENV === "preview";/);
  assert.match(code, /\.\.\.\(isPreview\s*\n?\s*\?\s*\{\s*cookieOptions:\s*\{\s*sameSite:\s*"none" as const,\s*secure:\s*true\s*\}\s*\}\s*\n?\s*:\s*\{\}\)/);
});

test("7. middleware.ts still enforces auth for non-public paths, and cookie handling does not weaken the redirect gate", () => {
  const code = strip(readFileSync(MIDDLEWARE, "utf8"));
  assert.match(code, /if \(!user\) \{/);
  assert.match(code, /NextResponse\.redirect\(loginUrl\)/);
  const isPreviewAt = code.indexOf("const isPreview");
  const redirectAt = code.indexOf("if (!user) {");
  assert.ok(isPreviewAt >= 0 && redirectAt > isPreviewAt,
    "the Preview cookie branch sits before the auth check — it configures the client, never bypasses it");
});

test("8. no other Preview-detection signal (a shared boolean, a market flag) has leaked into these three files — VERCEL_ENV/NEXT_PUBLIC_VERCEL_ENV are the only source", () => {
  for (const file of [CLIENT, SERVER, MIDDLEWARE]) {
    const code = strip(readFileSync(file, "utf8"));
    for (const forbidden of ["DEALEROS_MARKET", "NEXT_PUBLIC_PREVIEW", "IS_PREVIEW_BUILD"]) {
      assert.equal(code.includes(forbidden), false, `${file} must not read: ${forbidden}`);
    }
  }
});
