// R90B — source guards for the LINE transport boundary.
//
// Run: node --import tsx --test src/lib/line/line-transport-boundary.test.ts
//
// `send-line-message.ts` and `create-line-message-log.ts` begin with
// `import "server-only"`, so they are NEVER imported here — `server-only` is a
// devDependency of Next and is not resolvable by Node. Their guarantees are
// asserted by inspecting SOURCE TEXT, the same technique
// `supabase-persistence-gateway.test.ts` uses for the persistence gateway.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Comment-stripped source, so documentation may name a hazard the code must not use. */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SEND = "src/lib/line/send-line-message.ts";
const LOG = "src/lib/line/create-line-message-log.ts";
const ACTION = "src/lib/line/send-estimate-line.ts";
const CORE = "src/lib/line/send-estimate-line-core.ts";
const GRANTS = "supabase/migrations/104_least_privilege_grants.sql";

// ── 1-2. The two transport modules are server-only ──────────────────────────

test("1. send-line-message.ts is a server-only module, not a Server Action", () => {
  const raw = readFileSync(SEND, "utf8");
  assert.match(raw, /^import "server-only";/, "must OPEN with the server-only import");
  assert.equal(codeOf(SEND).includes('"use server"'), false, "the file-level Server Action directive is gone");
});

test("2. create-line-message-log.ts is a server-only module, not a Server Action", () => {
  const raw = readFileSync(LOG, "utf8");
  assert.match(raw, /^import "server-only";/);
  assert.equal(codeOf(LOG).includes('"use server"'), false);
});

test("3. no client component imports either transport module", () => {
  // The estimate UI must reach LINE only through the dedicated action.
  const ui = readFileSync("src/components/estimates/EstimateLineAction.tsx", "utf8");
  for (const forbidden of ["send-line-message", "create-line-message-log"]) {
    assert.equal(ui.includes(forbidden), false, `the client component imports ${forbidden}`);
  }
  const detail = readFileSync("src/components/estimates/EstimateDetail.tsx", "utf8");
  for (const forbidden of ["send-line-message", "create-line-message-log"]) {
    assert.equal(detail.includes(forbidden), false, `EstimateDetail imports ${forbidden}`);
  }
});

// ── 4-6. Log-mutation authority ─────────────────────────────────────────────

test("4. migration 104 grants authenticated SELECT ONLY on line_message_logs", () => {
  // PRECONDITION for tests 5-6: this is WHY a separate admin client exists.
  const sql = readFileSync(GRANTS, "utf8");
  assert.match(sql, /GRANT SELECT ON TABLE public\.line_message_logs TO authenticated;/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.line_message_logs TO service_role;/);
  // The sibling LINE tables DO grant writes to authenticated — the asymmetry is
  // specific to the log table, which is exactly the scope of the admin client.
  assert.match(sql, /GRANT SELECT,INSERT,UPDATE ON TABLE public\.line_customers TO authenticated;/);
  assert.match(sql, /GRANT SELECT,INSERT,UPDATE ON TABLE public\.dealer_settings TO authenticated;/);
});

test("5. the admin client is created once, after the dealer, and only for log mutations", () => {
  const code = codeOf(SEND);

  assert.equal((code.match(/createAdminClient\(\)/g) ?? []).length, 1, "exactly one admin client");
  assert.match(code, /const logSupabase = createAdminClient\(\);/);

  // It is created only after the dealer is resolved.
  const dealerAt = code.indexOf("await getCurrentDealer()");
  const adminAt = code.indexOf("createAdminClient()");
  assert.ok(dealerAt >= 0 && adminAt > dealerAt, "the admin client must not precede the dealer resolution");

  // It reaches ONLY the three log helpers.
  for (const helper of ["createPendingLog", "markLogSent", "markLogFailed"]) {
    assert.ok(
      new RegExp(`${helper}\\(logSupabase`).test(code),
      `${helper} must receive the admin client`,
    );
  }
  // …and nothing else is handed to it.
  const adminUses = code.match(/logSupabase[,.)]/g) ?? [];
  assert.equal(adminUses.length, 3, `logSupabase used ${adminUses.length} times, expected exactly 3`);
});

test("6. the authenticated client is NEVER used for log writes", () => {
  const code = codeOf(SEND);
  for (const helper of ["createPendingLog", "markLogSent", "markLogFailed"]) {
    assert.equal(
      new RegExp(`${helper}\\(supabase[,)]`).test(code), false,
      `${helper} receives the session client — its writes would silently no-op`,
    );
  }
  // The session client still owns the tenant-scoped reads/writes it is granted.
  assert.match(code, /supabase\s*\n?\s*\.from\("dealer_settings"\)/);
  assert.match(code, /supabase\s*\n?\s*\.from\("line_customers"\)/);
});

// ── 7. The service-role key never escapes ───────────────────────────────────

test("7. no credential or client is returned, logged or embedded", () => {
  const code = codeOf(SEND);
  for (const forbidden of [
    "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_", "process.env",
    "return logSupabase", "return settings", "access_token }",
  ]) {
    assert.equal(code.includes(forbidden), false, `send-line-message references ${forbidden}`);
  }
  // The token is used for the Authorization header and nowhere else.
  assert.equal((code.match(/line_access_token/g) ?? []).length, 3,
    "the token appears only in the select, the guard and the header");
});

// ── 8-9. Fail-closed ordering and metadata ──────────────────────────────────

test("8. requireLog aborts BEFORE last_message_at and BEFORE the LINE call", () => {
  const code = codeOf(SEND);
  const pendingAt = code.indexOf("const logId = await createPendingLog(");
  const guardAt = code.indexOf("options?.requireLog && !logId");
  const lastMsgAt = code.indexOf('.from("line_customers")');
  const fetchAt = code.indexOf("await fetch(`${LINE_API_BASE}/message/push`");

  assert.ok(pendingAt >= 0 && guardAt > pendingAt, "the guard follows the pending write");
  assert.ok(lastMsgAt > guardAt, "last_message_at must come AFTER the guard");
  assert.ok(fetchAt > guardAt, "the LINE call must come AFTER the guard");
  assert.match(code, /reason: "log-unavailable"/);
});

test("9. metadata is merged BESIDE the canonical messages, never over them", () => {
  const code = codeOf(SEND);
  // `messages` is spread first and metadata occupies its own key.
  assert.match(code, /\{ messages, metadata: options\.logMetadata \}/);
  assert.match(code, /: \{ messages \}/);
  // There is no spread of caller-supplied payload into the log payload.
  assert.equal(/payload:\s*\{\s*\.\.\.options/.test(code), false, "caller payload must not be spread");
  assert.equal(code.includes("...options?.logMetadata"), false, "metadata must not be spread at the top level");
});

// ── 10-12. The dedicated action boundary ────────────────────────────────────

test("10. send-estimate-line.ts is the ONLY client-callable boundary", () => {
  const raw = readFileSync(ACTION, "utf8");
  assert.match(raw, /^"use server";/, "the action opens with the Server Action directive");
  assert.equal(codeOf(ACTION).includes('import "server-only"'), false);

  const code = codeOf(ACTION);
  // Exactly one export, taking exactly two parameters.
  assert.equal((code.match(/export async function/g) ?? []).length, 1, "exactly one exported action");
  assert.match(code, /export async function sendEstimateLine\(\s*estimateId: string,\s*authorization: EstimateResendAuthorization,\s*\)/);
});

test("11. the action accepts no recipient, dealer, customer, message, token or metadata", () => {
  const code = codeOf(ACTION);
  const sig = code.slice(code.indexOf("export async function sendEstimateLine("), code.indexOf("): Promise<"));
  for (const forbidden of ["lineUserId", "dealerId", "customerId", "text", "message", "token", "metadata", "logMetadata"]) {
    assert.equal(sig.includes(forbidden), false, `${forbidden} is a client-supplied parameter`);
  }
  // Dealer and recipient are resolved server-side; metadata is composed here.
  assert.match(code, /await getCurrentDealer\(\)/);
  assert.match(code, /\.eq\("dealer_id", dealerId\)/);
  assert.match(code, /\.eq\("is_friend", true\)/);
  assert.match(code, /logMetadata: \{ estimateId: id, mode: "text" \}/);
  assert.match(code, /requireLog: true/);
});

test("11b. the resend preflight INSPECTS the query error and never invents a total", () => {
  const code = codeOf(ACTION);
  // A failed read is reported as its own state, not collapsed into "none".
  assert.match(code, /const \{ data, error \} = await supabase/);
  assert.match(code, /if \(error\) return \{ kind: "unavailable" \};/);
  assert.match(code, /if \(!data\) return \{ kind: "none" \};/);
  // The persisted total passes through untouched.
  assert.match(code, /total: row\.total,/);
  assert.equal(/total:\s*row\.total\s*\?\?/.test(code), false, "a null total must not be coerced");
  assert.equal(code.includes("?? 0"), false, "no zero-value fallback anywhere in the action");
});

test("11c. the preflight selects status/sent_at/created_at over sent+pending, newest-first", () => {
  const code = codeOf(ACTION);
  assert.match(code, /\.select\("status, sent_at, created_at"\)/, "all three fields are read");
  assert.match(code, /\.in\("status", \["sent", "pending"\]\)/, "both relevant statuses");
  assert.match(code, /\.order\("created_at", \{ ascending: false \}\)/, "newest attempt first");
  // The old sent-only shape is fully gone.
  assert.equal(code.includes('.eq("status", "sent")'), false, "no status equality filter remains");
  assert.equal(/\.order\("sent_at"/.test(code), false, "must NOT order by sent_at");
});

test("11d. each status maps to its state, and an unexpected status fails closed", () => {
  const code = codeOf(ACTION);
  assert.match(code, /if \(row\.status === "sent"\) return \{ kind: "sent", sentAt: row\.sent_at \};/);
  assert.match(code, /if \(row\.status === "pending"\) return \{ kind: "indeterminate", attemptedAt: row\.created_at \};/);
  // Anything the query should not have returned is treated as unreadable, not sent.
  const tail = code.slice(code.indexOf('row.status === "pending"'));
  assert.match(tail, /return \{ kind: "unavailable" \};/, "a fall-through status fails closed");
});

test("11e. every action query — including the preflight — stays dealer-scoped", () => {
  const code = codeOf(ACTION);
  const froms = code.match(/\.from\("[a-z_]+"\)/g) ?? [];
  const scoped = code.match(/\.eq\("dealer_id", dealerId\)/g) ?? [];
  assert.equal(froms.length, 5, "estimates, line_customers, dealer_settings ×2, line_message_logs");
  assert.equal(scoped.length, froms.length, "every table read carries the dealer predicate");
});

test("12. every action query is dealer-scoped, and the access token is never returned", () => {
  const code = codeOf(ACTION);
  const froms = code.match(/\.from\("[a-z_]+"\)/g) ?? [];
  const scoped = code.match(/\.eq\("dealer_id", dealerId\)/g) ?? [];
  assert.equal(froms.length, 5, "estimates, line_customers, dealer_settings ×2, line_message_logs");
  assert.equal(scoped.length, froms.length, "every table read must carry the dealer predicate");
  // Only the EXISTENCE of a token crosses the boundary.
  assert.match(code, /hasAccessToken: Boolean\(row\?\.line_access_token\)/);
  assert.equal(/return[^\n]*line_access_token[^\n]*[^)]$/.test(code), false);
});

// ── 13. The core stays pure ─────────────────────────────────────────────────

test("13. the decision core imports nothing that would make it unimportable", () => {
  // Comment-stripped on BOTH checks: the core's header documents that it carries
  // neither directive, and naming them there must not trip the assertion.
  const code = codeOf(CORE);
  assert.equal(code.includes('"use server"'), false);
  assert.equal(code.includes('import "server-only"'), false);
  for (const forbidden of [
    "supa" + "base", "createClient", "createAdminClient", "next/", "react",
    "process.env", "fetch(", "Date.now", "new Date", "Math.random",
  ]) {
    assert.equal(code.includes(forbidden), false, `the core references ${forbidden}`);
  }
  // It imports nothing at all — every dependency arrives as a parameter.
  assert.equal(/^import\s/m.test(code), false, "the core must have no imports");
});
