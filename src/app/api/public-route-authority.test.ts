// GDA-AUTH-DEVNEXT-1B — complete public-authority inventory and source guards.
//
// This is intentionally a source-contract test. Importing every public surface
// would initialize server-only Supabase modules and would weaken the claim that
// this phase performs no DB, Auth, Storage, LINE, or provider access.
//
// Run:
//   node --import tsx --test src/app/api/public-route-authority.test.ts

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

const read = (path: string): string => readFileSync(path, "utf8");
const code = (path: string): string =>
  read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

function walkRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkRouteFiles(absolute));
    else if (entry.isFile() && entry.name === "route.ts") {
      found.push(relative(process.cwd(), absolute).split(sep).join("/"));
    }
  }
  return found.sort();
}

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/no-dealer",
  "/liff",
  "/api",
  "/s/e",
] as const;

const API_ROUTE_AUTHORITY = {
  "src/app/api/admin/cron/downgrade-trials/route.ts": "cron-secret-post-only",
  "src/app/api/admin/cron/process-due-maintenance/route.ts": "cron-secret-get-post",
  "src/app/api/admin/cron/process-line-queue/route.ts": "cron-secret-get-post",
  "src/app/api/auth/callback/route.ts": "supabase-code-and-verified-session",
  "src/app/api/auth/status/route.ts": "session-derived-read-only",
  "src/app/api/line/liff/link/route.ts": "opaque-token-and-line-audience",
  "src/app/api/line/webhook/route.ts": "line-hmac-before-events",
  "src/app/api/observability/event/route.ts": "bounded-console-only",
  "src/app/api/trial/status/route.ts": "session-derived-read-only",
} as const;

const FROZEN_REGRESSIONS = {
  "src/app/s/e/share-route.test.ts":
    "f7967afd170860a97ba9305b47cee199af619294ea5ce84bc4f0167a959beb13",
  "src/lib/estimates/estimate-share-boundary.test.ts":
    "3c772e4ba0cf57b1dfac5e71571e1a5f89f0f4f339a37f18e2b1dacd663be5ba",
  "src/lib/dealer/create-pending-dealer.test.ts":
    "fee95410d77898a8124a677a6d7efc890dfdcd500c30d259eaeb8789285f8a78",
  "src/lib/dealer/claim-gyeon-provisioning.test.ts":
    "b7206e80855db84c94a225c35b96ccd89ae178a7ee24393f51abdbb1935813dd",
  "src/lib/line/line-link-token.test.ts":
    "5906f7eab62b6bbbcea2ff88dd9d4479ee949f95ced60b490038cba848223774",
  "src/app/api/observability/event/route.test.ts":
    "7453a177fa7720075519aa8402b863c5fcd8d70251ccf99a6ae45ed70a5a0a78",
} as const;

test("middleware freezes exactly nine non-duplicated public prefixes", () => {
  const middleware = code("src/middleware.ts");
  const match = /const PUBLIC_PREFIXES = \[([\s\S]*?)\];/.exec(middleware);
  assert.ok(match, "PUBLIC_PREFIXES must remain a literal auditable array");
  const actual = [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);

  assert.deepEqual(actual, [...PUBLIC_PREFIXES]);
  assert.equal(new Set(actual).size, PUBLIC_PREFIXES.length, "duplicates fail closed");
  assert.match(middleware, /pathname === p \|\| pathname\.startsWith\(p \+ "\/"\)/);
});

test("all and only the nine current API routes have an explicit authority class", () => {
  const actual = walkRouteFiles("src/app/api");
  const classified = Object.keys(API_ROUTE_AUTHORITY).sort();

  assert.deepEqual(actual, classified, "missing, extra or unclassified API routes fail closed");
  assert.equal(new Set(classified).size, classified.length, "duplicate route classification");
  assert.equal(
    Object.values(API_ROUTE_AUTHORITY).every((authority) => authority.length > 0),
    true,
  );
});

test("the non-API public authority surfaces exist at their exact literal paths", () => {
  const paths = [
    "src/app/auth/confirm/route.ts",
    "src/app/signup/page.tsx",
    "src/lib/dealer/check-email-account-state.ts",
    "src/lib/dealer/create-pending-dealer.ts",
    "src/app/no-dealer/page.tsx",
    "src/app/s/e/[token]/page.tsx",
    "src/app/s/e/[token]/file/route.ts",
  ];
  assert.deepEqual(paths.filter((path) => existsSync(path)), paths);
  assert.equal(new Set(paths).size, paths.length);
});

test("Auth callback and confirm routes reach pending-dealer authority only after verification", () => {
  const callback = code("src/app/api/auth/callback/route.ts");
  const callbackCodeAt = callback.indexOf("const code = searchParams.get(\"code\")");
  const callbackGuardAt = callback.indexOf("if (code)");
  const exchangeAt = callback.indexOf("await supabase.auth.exchangeCodeForSession(code)");
  const callbackPendingAt = callback.indexOf("await createPendingDealer()", exchangeAt);
  assert.ok(callbackCodeAt >= 0 && callbackGuardAt > callbackCodeAt);
  assert.ok(exchangeAt > callbackGuardAt && callbackPendingAt > exchangeAt);
  assert.match(callback.slice(exchangeAt, callbackPendingAt), /if \(!error\)/);

  const confirm = code("src/app/auth/confirm/route.ts");
  const tokenAt = confirm.indexOf("const token_hash = searchParams.get(\"token_hash\")");
  const guardAt = confirm.indexOf("if (token_hash && type)");
  const verifyAt = confirm.indexOf("await supabase.auth.verifyOtp({ type, token_hash })");
  const pendingAt = confirm.indexOf("await createPendingDealer()", verifyAt);
  assert.ok(tokenAt >= 0 && guardAt > tokenAt && verifyAt > guardAt && pendingAt > verifyAt);
  assert.match(confirm.slice(verifyAt, pendingAt), /if \(!error\)/);

  const pending = code("src/lib/dealer/create-pending-dealer.ts");
  const sessionAt = pending.indexOf("supabase.auth.getUser()");
  const verifiedAt = pending.indexOf("!user.email || !user.email_confirmed_at");
  const adminAt = pending.indexOf("createAdminClient()", verifiedAt);
  assert.ok(sessionAt >= 0 && verifiedAt > sessionAt && adminAt > verifiedAt);
  assert.match(pending, /export async function createPendingDealer\(\)/);
});

test("LIFF rejects missing input and verifies audience before atomic consume", () => {
  const route = code("src/app/api/line/liff/link/route.ts");
  const parseAt = route.indexOf("await req.json()");
  const requiredAt = route.indexOf("if (!token || !idToken)");
  const consumeAt = route.indexOf("await consumeLineLinkToken(token, idToken)");
  assert.ok(parseAt >= 0 && requiredAt > parseAt && consumeAt > requiredAt);

  const core = code("src/lib/line/consume-line-link-token.ts");
  const rowAt = core.indexOf('.from("line_link_tokens")');
  const verifyAt = core.indexOf("await verifyLineIdToken(idToken");
  const audienceAt = core.indexOf("payload.aud !== expectedAudience");
  const rpcAt = core.indexOf('admin.rpc("consume_line_link_token"');
  assert.ok(rowAt >= 0 && verifyAt > rowAt && rpcAt > verifyAt);
  assert.ok(audienceAt >= 0 && audienceAt < rpcAt, "audience equality precedes consume");
  assert.match(core, /if \(!profile\?\.sub\) return \{ kind: "line-verification-failed" \}/);
});

test("LINE webhook parses first and requires a matching HMAC before event processing", () => {
  const webhook = code("src/app/api/line/webhook/route.ts");
  const handler = webhook.slice(webhook.indexOf("export async function POST"));
  const parseAt = handler.indexOf("JSON.parse(rawBody)");
  const clientAt = handler.indexOf("getServiceClient()", parseAt);
  const signatureAt = handler.indexOf("verifySignature(rawBody", clientAt);
  const rejectAt = handler.indexOf("if (!matched)", signatureAt);
  const eventsAt = handler.indexOf("for (const event of body.events)", rejectAt);
  assert.ok(parseAt >= 0 && clientAt > parseAt && signatureAt > clientAt);
  assert.ok(rejectAt > signatureAt && eventsAt > rejectAt);

  const beforeSignatureAcceptance = handler.slice(clientAt, eventsAt);
  for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "fetchProfile("]) {
    assert.equal(beforeSignatureAcceptance.includes(forbidden), false, forbidden);
  }
});

test("public status surfaces are session-derived and read-only; observability is provider-free", () => {
  const authStatus = code("src/app/api/auth/status/route.ts");
  const trialStatus = code("src/app/api/trial/status/route.ts");
  const observability = code("src/app/api/observability/event/route.ts");

  assert.match(authStatus, /await getCurrentUser\(\)/);
  assert.match(authStatus, /await getCurrentDealer\(\)/);
  assert.match(trialStatus, /await getCurrentDealer\(\)/);
  assert.match(trialStatus, /\.select\("plan, trial_status, trial_end_date, auto_downgrade_plan_type"\)/);
  for (const [label, source] of [["auth", authStatus], ["trial", trialStatus]] as const) {
    for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "auth.admin"]) {
      assert.equal(source.includes(forbidden), false, `${label}: ${forbidden}`);
    }
  }

  for (const forbidden of ["supabase", ".storage", "fetch(", "createAdminClient", "createClient"]) {
    assert.equal(observability.includes(forbidden), false, `observability: ${forbidden}`);
  }
  assert.match(observability, /reportObservabilityEvent\(/);
});

test("unauthenticated signup-state lookup is bounded read-only and returns only coarse states", () => {
  const source = code("src/lib/dealer/check-email-account-state.ts");
  assert.match(source, /\.select\("approval_status, deleted_at, created_at"\)/);
  for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "auth.admin", "fetch("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }

  const returned = [...source.matchAll(/return \{ state: "([a-z]+)" \}/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(returned)].sort(), ["active", "new", "pending", "suspended"]);
  assert.equal(/return \{ state:[^}]+[,][^}]+\}/.test(source), false, "no row, id, name or email is returned");
});

test("/no-dealer authenticates first and keeps every privileged onboarding edge inside the exact gate", () => {
  const gate = code("src/lib/gyeon/partner-onboarding-enabled.ts");
  assert.match(gate, /process\.env\.GYEON_PARTNER_ONBOARDING_ENABLED === "true"/);

  const page = code("src/app/no-dealer/page.tsx");
  const body = page.slice(page.indexOf("export default async function NoDealerPage"));
  const userAt = body.indexOf("await getCurrentUser()");
  const unauthAt = body.indexOf('if (!user) redirect("/login")');
  const gateAt = body.indexOf("if (isGyeonPartnerOnboardingEnabled())");
  const claimAt = body.indexOf("await claimGyeonProvisioning()", gateAt);
  const pendingAt = body.indexOf("await createPendingDealer()", gateAt);
  const adminAt = body.indexOf("createAdminClient()", gateAt);
  const shopAt = body.indexOf('redirect("/shop-profile")', gateAt);
  assert.ok(userAt >= 0 && unauthAt > userAt && gateAt > unauthAt);
  assert.ok(claimAt > gateAt && pendingAt > gateAt && adminAt > gateAt && shopAt > gateAt);
  assert.equal((body.match(/redirect\("\/shop-profile"\)/g) ?? []).length, 1);
});

test("R92B stays bound to the immutable opaque-token uniform-404 boundary", () => {
  const page = code("src/app/s/e/[token]/page.tsx");
  const route = code("src/app/s/e/[token]/file/route.ts");
  assert.match(page, /resolveEstimateShare\(token\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(route, /resolveEstimateShare\(token\)/);
  assert.match(route, /downloadSharedPdfBytes\(resolved\.filePath\)/);
  assert.equal((route.match(/new Response\("Not found", \{ status: 404 \}\)/g) ?? []).length, 2);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /"Referrer-Policy": "no-referrer"/);
  assert.match(route, /buildContentDisposition\("attachment", resolved\.fileName\)/);
});

test("all frozen executable authority regressions retain their exact accepted hashes", () => {
  for (const [path, expected] of Object.entries(FROZEN_REGRESSIONS)) {
    assert.equal(sha256(path), expected, path);
  }
});
