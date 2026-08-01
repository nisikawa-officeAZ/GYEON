// GYEON-LINE-SETUP-F2 — LIFF link-token security contract.
//
// Run: node --import tsx --test src/lib/line/line-link-token.test.ts
//
// Two kinds of assertion live here:
//   (a) in-process behaviour of the token core and the LINE verification call;
//   (b) source contracts that must hold across the LIFF surfaces (no browser
//       customer_id, no environment LIFF fallback, token read only after init).
// Database-level guarantees (winner-gated consume, expiry/revocation, cross-
// tenant isolation) are asserted here at the migration-statement level; their
// runtime proof belongs to the disposable-database verification phase.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  LINE_LINK_TOKEN_BYTES,
  LINE_LINK_TOKEN_TTL_MS,
  LINE_VERIFY_URL,
  buildLiffLinkUrl,
  extractLoginChannelId,
  generateLineLinkToken,
  hashLineLinkToken,
  verifyLineIdToken,
} from "./consume-line-link-token";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const MIGRATION = read("supabase/migrations/20260801110110_line_link_tokens.sql");
const ROUTE = read("src/app/api/line/liff/link/route.ts");
const LIFF_PAGE = read("src/app/liff/link/[liffId]/page.tsx");
const OLD_LIFF_PAGE = read("src/app/liff/link/page.tsx");
const BADGE = read("src/components/line/LineStatusBadge.tsx");
const MINT = read("src/lib/line/create-line-link-token.ts");
const CORE = read("src/lib/line/consume-line-link-token.ts");

// ── 1. Token shape ───────────────────────────────────────────────────────────

test("1. token carries at least 128 bits of entropy and is unique per call", () => {
  assert.ok(LINE_LINK_TOKEN_BYTES * 8 >= 128);
  const seen = new Set(Array.from({ length: 200 }, () => generateLineLinkToken()));
  assert.equal(seen.size, 200);
});

test("2. only a SHA-256 hash is persisted, and it is not reversible to the token", () => {
  const raw = generateLineLinkToken();
  const hash = hashLineLinkToken(raw);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, raw);
  assert.ok(!hash.includes(raw));
  // The minting path inserts the hash, never the raw token.
  assert.match(MINT, /token_hash: hashLineLinkToken\(rawToken\)/);
  assert.ok(!/token:\s*rawToken/.test(MINT));
});

test("3. hashing is deterministic so the same link resolves to the same row", () => {
  const raw = generateLineLinkToken();
  assert.equal(hashLineLinkToken(raw), hashLineLinkToken(raw));
});

// ── 2. Audience resolution ───────────────────────────────────────────────────

test("4. the LINE Login channel id is the LIFF prefix, and malformed ids fail closed", () => {
  assert.equal(extractLoginChannelId("1654321987-DdFgHkLm"), "1654321987");
  for (const bad of [null, undefined, "", "no-digits-here", "12345-x", "1654321987", "abc-1654321987"]) {
    assert.equal(extractLoginChannelId(bad as string | null), null);
  }
});

test("5. minting refuses to issue a token when the dealer LIFF id is unusable", () => {
  assert.match(MINT, /if \(!liffId \|\| !loginChannelId\) return \{ kind: "liff-not-configured" \}/);
});

test("6. the audience never comes from the Messaging API channel id", () => {
  assert.ok(!/line_channel_id/.test(MINT));
  assert.ok(!/line_channel_id/.test(CORE));
  assert.match(CORE, /login_channel_id/);
});

// ── 3. Customer-facing URL ───────────────────────────────────────────────────

test("7. the LIFF url carries the opaque token only — no internal identifiers", () => {
  const url = buildLiffLinkUrl("1654321987-DdFgHkLm", "OPAQUE_TOKEN");
  assert.equal(
    url,
    "https://liff.line.me/1654321987-DdFgHkLm/1654321987-DdFgHkLm?t=OPAQUE_TOKEN"
  );
  for (const leak of ["customer_id", "dealer_id", "email", "uuid"]) {
    assert.ok(!url.includes(leak));
  }
});

test("7a. F2-F1-01 — the url carries additional LIFF path info so LINE lands on /liff/link/{liffId}", () => {
  const liffId = "1654321987-DdFgHkLm";
  const url = new URL(buildLiffLinkUrl(liffId, "OPAQUE_TOKEN"));
  const segments = url.pathname.split("/").filter(Boolean);
  // First segment selects the LIFF app; the second is appended by LINE to the
  // app's single configured Endpoint URL (https://{host}/liff/link).
  assert.deepEqual(segments, [liffId, liffId]);
  assert.equal(url.searchParams.get("t"), "OPAQUE_TOKEN");
  // Resulting application path, once LINE performs the secondary redirect.
  assert.equal(`/liff/link/${segments[1]}`, `/liff/link/${liffId}`);
});

test("7b. F2-F1-01 — the retired /liff/link page cannot handle a live token", () => {
  assert.ok(!/searchParams/.test(OLD_LIFF_PAGE));
  assert.ok(!/\bt\b\s*=\s*.*get\(/.test(OLD_LIFF_PAGE));
  assert.ok(!/liff\.init/.test(OLD_LIFF_PAGE));
  assert.ok(!/fetch\(/.test(OLD_LIFF_PAGE));
  // ...while the dynamic page does handle it.
  assert.match(LIFF_PAGE, /get\("t"\)/);
});

test("8. no browser-supplied customer_id can select a row anywhere in the flow", () => {
  // The route accepts only token + id_token.
  assert.ok(!/customer_id/.test(ROUTE));
  assert.match(ROUTE, /const token = typeof body\.token === "string"/);
  assert.match(ROUTE, /const idToken = typeof body\.id_token === "string"/);
  // The LIFF page posts only those two fields.
  assert.match(LIFF_PAGE, /JSON\.stringify\(\{ token, id_token: idToken \}\)/);
  assert.ok(!/customer_id/.test(LIFF_PAGE));
  // The retired page reads no query parameter at all.
  assert.ok(!/customer_id/.test(OLD_LIFF_PAGE));
  assert.ok(!/useSearchParams/.test(OLD_LIFF_PAGE));
  // The consume path selects by token hash only.
  assert.match(CORE, /\.eq\("token_hash", tokenHash\)/);
});

test("9. no NEXT_PUBLIC LIFF environment fallback remains on any runtime surface", () => {
  for (const src of [LIFF_PAGE, OLD_LIFF_PAGE, BADGE, ROUTE, CORE, MINT]) {
    assert.ok(!/NEXT_PUBLIC_LINE_LIFF_ID/.test(src));
    assert.ok(!/NEXT_PUBLIC_LIFF_ID/.test(src));
  }
});

// ── 4. LINE verification call ────────────────────────────────────────────────

test("10. verification posts the id token in the body, never in a query string", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      json: async () => ({ sub: "U_line_user", aud: "1654321987", name: "Tester" }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    const payload = await verifyLineIdToken("SECRET_ID_TOKEN", "1654321987");
    assert.equal(payload?.sub, "U_line_user");

    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, LINE_VERIFY_URL);
    assert.ok(!url.includes("?"));
    assert.ok(!url.includes("SECRET_ID_TOKEN"));
    assert.equal(init.method, "POST");
    assert.equal(
      (init.headers as Record<string, string>)["Content-Type"],
      "application/x-www-form-urlencoded"
    );
    assert.ok(String(init.body).includes("id_token=SECRET_ID_TOKEN"));
    assert.ok(String(init.body).includes("client_id=1654321987"));
  } finally {
    globalThis.fetch = original;
  }
});

test("11. F2-F1-02 — a MISMATCHED audience is rejected", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: true, json: async () => ({ sub: "U_x", aud: "9999999999" }) }) as unknown as Response) as typeof globalThis.fetch;
  try {
    assert.equal(await verifyLineIdToken("t", "1654321987"), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("11a. F2-F1-02 — a MISSING audience is rejected, never inferred", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: true, json: async () => ({ sub: "U_x", name: "No Aud" }) }) as unknown as Response) as typeof globalThis.fetch;
  try {
    assert.equal(await verifyLineIdToken("t", "1654321987"), null);
  } finally {
    globalThis.fetch = original;
  }
  // The source must compare strictly, not conditionally on aud being present.
  assert.match(CORE, /if \(payload\.aud !== expectedAudience\) return null;/);
  assert.ok(!/payload\.aud &&/.test(CORE));
});

test("11b. F2-F1-02 — an exactly matching audience is accepted", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: true, json: async () => ({ sub: "U_ok", aud: "1654321987" }) }) as unknown as Response) as typeof globalThis.fetch;
  try {
    const payload = await verifyLineIdToken("t", "1654321987");
    assert.equal(payload?.sub, "U_ok");
  } finally {
    globalThis.fetch = original;
  }
});

test("12. a rejected or subject-less LINE response yields no identity", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) }) as unknown as Response) as typeof globalThis.fetch;
  try {
    assert.equal(await verifyLineIdToken("t", "1654321987"), null);
  } finally {
    globalThis.fetch = original;
  }
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({}) }) as unknown as Response) as typeof globalThis.fetch;
  try {
    assert.equal(await verifyLineIdToken("t", "1654321987"), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("13. an invalid LINE id token cannot consume the link token", () => {
  // Verification happens before the consume RPC, and a failed verify returns early.
  const verifyAt = CORE.indexOf("await verifyLineIdToken(");
  const consumeAt = CORE.indexOf('admin.rpc("consume_line_link_token"');
  assert.ok(verifyAt > 0 && consumeAt > verifyAt);
  assert.match(CORE, /if \(!profile\?\.sub\) return \{ kind: "line-verification-failed" \}/);
});

// ── 5. Fail-closed responses ─────────────────────────────────────────────────

test("14. unknown, used, revoked and expired tokens collapse to one opaque outcome", () => {
  assert.match(CORE, /row\.used_at !== null/);
  assert.match(CORE, /row\.revoked_at !== null/);
  assert.match(CORE, /new Date\(row\.expires_at as string\)\.getTime\(\) <= Date\.now\(\)/);
  assert.match(CORE, /return \{ kind: "invalid-token" \}/);
  // The route answers both failure kinds identically, so nothing can be probed.
  assert.match(ROUTE, /case "line-verification-failed":\s*\n\s*case "invalid-token":/);
});

test("15. no error path leaks a token, id token, or upstream detail to the client", () => {
  assert.ok(!/detail/.test(ROUTE));
  assert.ok(!/console\.(log|error|warn)/.test(ROUTE));
  assert.ok(!/console\.(log|error|warn)/.test(CORE));
  assert.ok(!/console\.(log|error|warn)/.test(MINT));
});

// ── 6. LIFF page contract ────────────────────────────────────────────────────

test("16. the token is read only after liff.init resolves", () => {
  const initAt = LIFF_PAGE.indexOf("await window.liff!.init(");
  const readerDefinedAt = LIFF_PAGE.indexOf("function readTokenFromLocation");
  const callAt = LIFF_PAGE.indexOf("readTokenFromLocation()");
  assert.ok(readerDefinedAt > 0 && initAt > 0 && callAt > 0);
  // Exactly one call site (the definition also contains the bare name), and it
  // lives inside doLink(), which the effect only reaches after init resolves.
  assert.equal(LIFF_PAGE.split("= readTokenFromLocation()").length - 1, 1);
  assert.ok(LIFF_PAGE.indexOf("await doLink()") > initAt);
  // liff.state is handled for clients that keep the wrapper.
  assert.match(LIFF_PAGE, /liff\.state/);
});

test("17. the LIFF id comes from the path and is format-validated before init", () => {
  assert.match(LIFF_PAGE, /params: Promise<\{ liffId: string \}>/);
  assert.match(LIFF_PAGE, /function isValidLiffId/);
  assert.match(LIFF_PAGE, /\^\[0-9\]\{6,\}-\[0-9a-zA-Z\]\+\$/);
  const guardAt = LIFF_PAGE.indexOf("if (!isValidLiffId(liffId))");
  const initAt = LIFF_PAGE.indexOf("await window.liff!.init(");
  assert.ok(guardAt > 0 && guardAt < initAt);
});

test("18. the retired /liff/link page performs no init and no network call", () => {
  assert.ok(!/liff\.init/.test(OLD_LIFF_PAGE));
  assert.ok(!/fetch\(/.test(OLD_LIFF_PAGE));
  assert.ok(!/"use client"/.test(OLD_LIFF_PAGE));
});

test("19. the badge cannot build a link from a customer id alone", () => {
  assert.ok(!/liff\.line\.me/.test(BADGE));
  assert.match(BADGE, /createLineLinkToken\(customerId\)/);
  assert.match(BADGE, /result\.kind === "created"/);
});

test("19a. F2-F1-04 — the async mint callback never opens a window itself", () => {
  assert.ok(!/window\.open/.test(BADGE));
  // The minted URL goes to state, and the surface is an explicit anchor plus an
  // explicit copy action — both driven by a second, deliberate user gesture.
  assert.match(BADGE, /setLiffUrl\(result\.liffUrl\)/);
  assert.match(BADGE, /href=\{liffUrl\}/);
  assert.match(BADGE, /function handleCopy/);
  assert.match(BADGE, /navigator\.clipboard\.writeText\(liffUrl\)/);
});

test("19b. F2-F1-04 — the minted link never reaches logs or error text", () => {
  assert.ok(!/console\./.test(BADGE));
  // Error branches render fixed strings, never the URL or the server payload.
  assert.match(BADGE, /setError\(result\.kind === "liff-not-configured" \? "LIFF未設定" : "発行できません"\)/);
  assert.ok(!/setError\([^)]*liffUrl/.test(BADGE));
});

// ── 7. Minting authorization ─────────────────────────────────────────────────

test("20. minting requires an authenticated ACTIVE member before any admin client use", () => {
  const userAt = MINT.indexOf("await getCurrentUser()");
  const dealerAt = MINT.indexOf("await getCurrentDealer()");
  const ownershipAt = MINT.indexOf('.eq("dealer_id", dealer.dealer_id)');
  const adminAt = MINT.indexOf("createAdminClient()");
  assert.ok(userAt > 0 && dealerAt > userAt);
  assert.ok(ownershipAt > dealerAt, "ownership is proven before the service-role client");
  assert.ok(adminAt > ownershipAt, "the admin client is only reached after both checks");
  assert.match(MINT, /if \(!user\) return \{ kind: "unauthorized" \}/);
  assert.match(MINT, /if \(!dealer\) return \{ kind: "unauthorized" \}/);
  assert.match(MINT, /if \(!customer\) return \{ kind: "customer-not-found" \}/);
});

test("21. a customer belonging to another dealer cannot be minted for", () => {
  // The lookup is scoped by BOTH the customer id and the caller's dealer id.
  assert.match(MINT, /\.eq\("id", customerId\)\s*\n\s*\.eq\("dealer_id", dealer\.dealer_id\)/);
});

test("22. tokens expire", () => {
  assert.ok(LINE_LINK_TOKEN_TTL_MS > 0 && LINE_LINK_TOKEN_TTL_MS <= 60 * 60 * 1000);
  assert.match(MINT, /expires_at: expiresAt/);
});

// ── 8. Database contract carried by the migration ────────────────────────────

test("23. the token table is server-only: RLS on, zero policies, no anon grants", () => {
  assert.match(MIGRATION, /alter table public\.line_link_tokens enable row level security/);
  assert.ok(!/create policy/i.test(MIGRATION));
  assert.match(MIGRATION, /revoke all on table public\.line_link_tokens from anon/);
  assert.match(MIGRATION, /revoke all on table public\.line_link_tokens from authenticated/);
  assert.match(MIGRATION, /revoke all on table public\.line_link_tokens from public/);
  assert.match(MIGRATION, /grant select, insert, update on table public\.line_link_tokens to service_role/);
  assert.ok(!/grant .* to anon/i.test(MIGRATION));
  assert.ok(!/grant .* to authenticated/i.test(MIGRATION));
});

test("24. the consume function is winner-gated so exactly one caller can win", () => {
  assert.match(MIGRATION, /update public\.line_link_tokens t\s*\n\s*set used_at = v_now/);
  assert.match(MIGRATION, /and t\.used_at\s+is null/);
  assert.match(MIGRATION, /and t\.revoked_at is null/);
  assert.match(MIGRATION, /and t\.expires_at > v_now/);
  assert.match(MIGRATION, /returning t\.\* into v_tok/);
  assert.match(MIGRATION, /if not found then\s*\n\s*return jsonb_build_object\('outcome', 'invalid-token'\)/);
});

test("25. the consume function is hardened: empty search_path, invoker, service_role only", () => {
  assert.match(MIGRATION, /set search_path = ''/);
  assert.ok(!/security definer/i.test(MIGRATION));
  assert.match(MIGRATION, /revoke all on function public\.consume_line_link_token\(text, text, text, text\) from public/);
  assert.match(MIGRATION, /revoke all on function public\.consume_line_link_token\(text, text, text, text\) from anon/);
  assert.match(MIGRATION, /revoke all on function public\.consume_line_link_token\(text, text, text, text\) from authenticated/);
  assert.match(MIGRATION, /grant execute on function public\.consume_line_link_token\(text, text, text, text\) to service_role/);
  // Every referenced object is schema-qualified because search_path is empty.
  assert.ok(!/\bfrom line_customers\b/.test(MIGRATION));
  assert.ok(!/\bupdate customers\b/.test(MIGRATION));
});

test("26. F2-F1-03 — same LINE account / different customer is a typed conflict", () => {
  assert.match(MIGRATION, /lc\.line_user_id = p_line_user_id\s*\n\s*and lc\.customer_id is distinct from v_tok\.customer_id/);
  assert.match(MIGRATION, /line_link_account_conflict/);
  assert.match(MIGRATION, /'outcome', 'account-conflict'/);
  assert.match(ROUTE, /case "account-conflict":/);
});

test("26a. F2-F1-03 — same customer / different LINE account is also a conflict", () => {
  assert.match(MIGRATION, /lc\.customer_id = v_tok\.customer_id\s*\n\s*and lc\.line_user_id is distinct from p_line_user_id/);
  // ...and the customer record's own LINE id, read under the row lock, is
  // checked too (F2-F2-03 moved this from a re-query to the locked value).
  assert.match(
    MIGRATION,
    /if v_customer_line is not null\s*\n\s*and btrim\(v_customer_line\) <> ''\s*\n\s*and v_customer_line is distinct from p_line_user_id then/
  );
});

test("26b. F2-F1-03 — a dealer-scoped uniqueness guarantee backs both directions", () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists line_customers_dealer_customer_unique\s*\n\s*on public\.line_customers \(dealer_id, customer_id\)\s*\n\s*where customer_id is not null/
  );
});

test("26b1. F2-F2-01 — customers carries its own dealer-scoped LINE uniqueness", () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists customers_dealer_line_user_unique\s*\n\s*on public\.customers \(dealer_id, line_user_id\)\s*\n\s*where line_user_id is not null and btrim\(line_user_id\) <> ''/
  );
  // The migration must not try to repair data to make the index buildable.
  assert.ok(!/\bdelete from\b/i.test(MIGRATION));
  assert.ok(!/\btruncate\b/i.test(MIGRATION));
  assert.ok(!/update public\.customers[\s\S]{0,200}set line_user_id\s*=\s*null/i.test(MIGRATION));
  // ...and it must document the pre-apply duplicate check for both tables.
  assert.match(MIGRATION, /APPLY PRECONDITION/);
  assert.match(MIGRATION, /having count\(\*\) > 1/);
});

test("26b2. F2-F2-02 — a legacy customers-only LINE identity is still a conflict", () => {
  // Another customer of the dealer carrying this LINE id, with NO line_customers
  // row, must be caught.
  assert.match(
    MIGRATION,
    /from public\.customers c\s*\n\s*where c\.dealer_id\s+= v_tok\.dealer_id\s*\n\s*and c\.line_user_id = p_line_user_id\s*\n\s*and c\.id is distinct from v_tok\.customer_id/
  );
  assert.match(MIGRATION, /LEGACY PATH/);
});

test("26b3. F2-F2-03 — the token customer is locked and proven under the token dealer", () => {
  assert.match(
    MIGRATION,
    /select c\.line_user_id\s*\n\s*into v_customer_line\s*\n\s*from public\.customers c\s*\n\s*where c\.id\s+= v_tok\.customer_id\s*\n\s*and c\.dealer_id = v_tok\.dealer_id\s*\n\s*for update;/
  );
  assert.match(MIGRATION, /line_link_customer_missing/);
  // The lock happens before every conflict check and before any write.
  const lockAt = MIGRATION.indexOf("for update;");
  const firstWriteAt = MIGRATION.indexOf("update public.line_customers lc\n     set display_name");
  const insertAt = MIGRATION.indexOf("insert into public.line_customers");
  assert.ok(lockAt > 0 && firstWriteAt > lockAt && insertAt > lockAt);
});

test("26b4. F2-F2-03 — 'linked' is impossible unless the guarded update hit one row", () => {
  assert.match(MIGRATION, /get diagnostics v_rows = row_count;/);
  assert.match(
    MIGRATION,
    /if v_rows <> 1 then\s*\n\s*raise exception using errcode = 'P0001', message = 'line_link_consistency_failure';/
  );
  // The success return comes only after that check.
  const rowsCheckAt = MIGRATION.indexOf("if v_rows <> 1 then");
  const linkedAt = MIGRATION.indexOf("return jsonb_build_object('outcome', 'linked');");
  assert.ok(rowsCheckAt > 0 && linkedAt > rowsCheckAt);
  // The guard clause also tolerates a blank legacy value without repointing.
  assert.match(
    MIGRATION,
    /and \(c\.line_user_id is null or btrim\(c\.line_user_id\) = '' or c\.line_user_id = p_line_user_id\)/
  );
});

test("26b5. F2-F2-04 — every consistency failure rolls the consumption back", () => {
  assert.match(
    MIGRATION,
    /elsif sqlerrm in \('line_link_customer_missing', 'line_link_consistency_failure'\) then\s*\n[\s\S]{0,200}?return jsonb_build_object\('outcome', 'consistency-failure'\)/
  );
  // Handlers sit at the end of the same block as the claim, so raising undoes
  // the used_at update along with everything else.
  const claimAt = MIGRATION.indexOf("set used_at = v_now");
  for (const handler of ["when unique_violation then", "when sqlstate 'P0001' then"]) {
    assert.ok(MIGRATION.indexOf(handler) > claimAt);
  }
  // A consistency failure is never reported as a link.
  assert.ok(!/'outcome', 'linked'[\s\S]{0,120}consistency/i.test(MIGRATION));
});

test("26c. F2-F1-03 — writes are exact-pair and never repoint an identifier", () => {
  // The blind ON CONFLICT ... DO UPDATE SET customer_id form must be gone.
  assert.ok(!/on conflict[\s\S]*do update[\s\S]*customer_id\s*=\s*excluded/i.test(MIGRATION));
  // The update matches the identical (dealer, customer, line user) triple only.
  assert.match(
    MIGRATION,
    /where lc\.dealer_id\s+= v_tok\.dealer_id\s*\n\s*and lc\.customer_id\s+= v_tok\.customer_id\s*\n\s*and lc\.line_user_id = p_line_user_id/
  );
  assert.match(MIGRATION, /if not found then\s*\n\s*insert into public\.line_customers/);
  // Replaying the same pair keeps the original link time — idempotent, not new.
  assert.match(MIGRATION, /linked_at\s+= coalesce\(lc\.linked_at, v_now\)/);
  // The customers update refuses to overwrite a different LINE user (a blank
  // legacy value is treated as unset, never as a different identity).
  assert.match(
    MIGRATION,
    /and \(c\.line_user_id is null or btrim\(c\.line_user_id\) = '' or c\.line_user_id = p_line_user_id\)/
  );
});

test("26d. F2-F1-03 — a concurrent unique violation rolls the consumption back", () => {
  assert.match(MIGRATION, /when unique_violation then\s*\n\s*return jsonb_build_object\('outcome', 'account-conflict'\)/);
  // Both handlers sit at the end of the same block as the claim, so raising
  // rolls the `used_at` update back with everything else.
  const claimAt = MIGRATION.indexOf("set used_at = v_now");
  const handlerAt = MIGRATION.indexOf("when unique_violation then");
  assert.ok(claimAt > 0 && handlerAt > claimAt);
});

test("27. writes are dealer-scoped and derived from the token row only", () => {
  assert.match(MIGRATION, /v_tok\.dealer_id, v_tok\.customer_id, p_line_user_id/);
  assert.match(MIGRATION, /where c\.id\s+= v_tok\.customer_id\s*\n\s*and c\.dealer_id = v_tok\.dealer_id/);
});

test("28. the token hash column is constrained to a sha-256 hex digest", () => {
  assert.match(MIGRATION, /line_link_tokens_token_hash_sha256 check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(MIGRATION, /line_link_tokens_token_hash_unique unique \(token_hash\)/);
});
