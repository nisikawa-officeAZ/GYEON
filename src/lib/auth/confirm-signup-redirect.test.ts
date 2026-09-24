// Deterministic unit tests for the /auth/confirm signup helpers.
//
// Run: node --import tsx --test src/lib/auth/confirm-signup-redirect.test.ts
//
// No Supabase, cookies, network, or browser. These tests prove that:
//   * the binding is a KEYED (HMAC) value — deterministic per secret, distinct
//     per token/type, unforgeable without the secret, unavailable without it;
//   * replay recovery requires the binding AND positive session evidence AND
//     signup-specific conditions; every other input fails closed;
//   * the interstitial escapes all values and exposes the token only inside
//     the hidden POST field.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEALER_SIGNUP_FLOW,
  SIGNUP_CONFIRM_BIND_COOKIE,
  SIGNUP_CONFIRM_BIND_MAX_AGE,
  SIGNUP_CONFIRM_BIND_PATH,
  bindingsMatch,
  decideSignupConfirmReplay,
  escapeHtml,
  readCookie,
  renderSignupConfirmInterstitial,
  signupConfirmBinding,
  signupReplayRedirectPath,
  type ConfirmSessionUser,
  type PendingDealerKind,
} from "./confirm-signup-redirect";

const SECRET = "test-service-secret-not-a-real-key";
const TOKEN  = "pkce_0123456789abcdef0123456789abcdef0123456789abcdef";
const BIND   = signupConfirmBinding("signup", TOKEN, SECRET)!;

const confirmedDealerSignup = (): ConfirmSessionUser => ({
  email: "applicant@example.com",
  email_confirmed_at: "2026-09-24T08:47:00.000Z",
  user_metadata: { dealer_signup_flow: DEALER_SIGNUP_FLOW, dealer_business_name: "Test Shop" },
});

test("1. flow constant and cookie contract match the route/page conventions", () => {
  assert.equal(DEALER_SIGNUP_FLOW, "dealer-v1");
  assert.equal(SIGNUP_CONFIRM_BIND_COOKIE, "gda_signup_confirm_bind");
  assert.equal(SIGNUP_CONFIRM_BIND_MAX_AGE, 3600);
  assert.equal(SIGNUP_CONFIRM_BIND_PATH, "/auth/confirm");
});

// ── binding ──────────────────────────────────────────────────────────────────

test("2. binding is a deterministic 64-hex HMAC that never contains the token or the secret", () => {
  assert.match(BIND, /^[0-9a-f]{64}$/);
  assert.equal(signupConfirmBinding("signup", TOKEN, SECRET), BIND);
  assert.equal(BIND.includes(TOKEN), false);
  assert.equal(BIND.includes(SECRET), false);
});

test("3. binding differs per token, per type, and per secret", () => {
  assert.notEqual(signupConfirmBinding("signup", TOKEN + "x", SECRET), BIND);
  assert.notEqual(signupConfirmBinding("recovery", TOKEN, SECRET), BIND);
  assert.notEqual(signupConfirmBinding("signup", TOKEN, SECRET + "x"), BIND);
  // Length-prefixed input: shifting characters between type and token never collides.
  assert.notEqual(signupConfirmBinding("signu", "p" + TOKEN, SECRET), BIND);
});

test("4. binding is unavailable (null) without a secret, type, or token — never an unkeyed fallback", () => {
  assert.equal(signupConfirmBinding("signup", TOKEN, undefined), null);
  assert.equal(signupConfirmBinding("signup", TOKEN, null), null);
  assert.equal(signupConfirmBinding("signup", TOKEN, ""), null);
  assert.equal(signupConfirmBinding("", TOKEN, SECRET), null);
  assert.equal(signupConfirmBinding(null, TOKEN, SECRET), null);
  assert.equal(signupConfirmBinding("signup", "", SECRET), null);
  assert.equal(signupConfirmBinding("signup", undefined, SECRET), null);
});

test("5. a plain SHA-256 of type:token (client-computable) is NOT the binding", () => {
  const plain = createHash("sha256").update(`signup:${TOKEN}`).digest("hex");
  assert.notEqual(plain, BIND);
  assert.equal(bindingsMatch(plain, BIND), false);
});

test("6. bindingsMatch: equal-length constant-time compare; every degenerate input fails", () => {
  assert.equal(bindingsMatch(BIND, BIND), true);
  assert.equal(bindingsMatch(BIND.slice(0, 63) + (BIND.endsWith("0") ? "1" : "0"), BIND), false);
  assert.equal(bindingsMatch(BIND.slice(0, 32), BIND), false);
  assert.equal(bindingsMatch(BIND + "0", BIND), false);
  assert.equal(bindingsMatch("", BIND), false);
  assert.equal(bindingsMatch(BIND, ""), false);
  assert.equal(bindingsMatch(null, BIND), false);
  assert.equal(bindingsMatch(undefined, BIND), false);
  assert.equal(bindingsMatch(BIND, null), false);
  assert.equal(bindingsMatch(null, null), false);
  assert.equal(bindingsMatch("", ""), false);
});

// ── cookie parser ────────────────────────────────────────────────────────────

test("7. readCookie parses the named value out of a raw Cookie header", () => {
  const header = `sb-x-auth-token=abc; ${SIGNUP_CONFIRM_BIND_COOKIE}=${BIND}; other=1`;
  assert.equal(readCookie(header, SIGNUP_CONFIRM_BIND_COOKIE), BIND);
  assert.equal(readCookie(`${SIGNUP_CONFIRM_BIND_COOKIE}=${BIND}`, SIGNUP_CONFIRM_BIND_COOKIE), BIND);
  assert.equal(readCookie(`  ${SIGNUP_CONFIRM_BIND_COOKIE} = ${BIND} `, SIGNUP_CONFIRM_BIND_COOKIE), BIND);
  assert.equal(readCookie(`${SIGNUP_CONFIRM_BIND_COOKIE}=${encodeURIComponent("a b")}`, SIGNUP_CONFIRM_BIND_COOKIE), "a b");
});

test("8. readCookie fails closed on absent, empty, malformed, or differently named cookies", () => {
  assert.equal(readCookie(null, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(undefined, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie("", SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie("other=1", SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(`${SIGNUP_CONFIRM_BIND_COOKIE}=`, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(`${SIGNUP_CONFIRM_BIND_COOKIE}`, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(`x${SIGNUP_CONFIRM_BIND_COOKIE}=${BIND}`, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(`${SIGNUP_CONFIRM_BIND_COOKIE}=%E0%A4%A`, SIGNUP_CONFIRM_BIND_COOKIE), null);
  assert.equal(readCookie(header(BIND), ""), null);
});

function header(value: string) {
  return `${SIGNUP_CONFIRM_BIND_COOKIE}=${value}`;
}

// ── replay decision ──────────────────────────────────────────────────────────

test("9. recover: signup type + matching binding + confirmed session + dealer-v1 metadata", () => {
  assert.deepEqual(decideSignupConfirmReplay("signup", confirmedDealerSignup(), BIND, BIND), { kind: "recover" });
});

test("10. fail closed: non-signup types never recover, even with binding and a confirmed dealer session", () => {
  for (const type of ["recovery", "invite", "magiclink", "email_change", "email", "", null]) {
    assert.deepEqual(
      decideSignupConfirmReplay(type, confirmedDealerSignup(), BIND, BIND),
      { kind: "fail-closed", reason: "not-signup" },
      `type=${String(type)}`,
    );
  }
});

test("11. fail closed: a confirmed dealer-v1 session with a missing / wrong / plain-SHA / other-token binding (Objection 1)", () => {
  const user = confirmedDealerSignup();
  const plain = createHash("sha256").update(`signup:${TOKEN}`).digest("hex");
  const other = signupConfirmBinding("signup", TOKEN + "x", SECRET)!;
  const cases: Array<[string | null | undefined, string | null | undefined, string]> = [
    [null, BIND, "no cookie"],
    [undefined, BIND, "undefined cookie"],
    ["", BIND, "empty cookie"],
    ["forged", BIND, "forged short value"],
    [plain, BIND, "plain SHA-256"],
    [other, BIND, "binding of another token"],
    [BIND, null, "secret unavailable: no expected binding"],
    [BIND, undefined, "secret unavailable: undefined expected binding"],
    [BIND, other, "expected binding for a different link"],
  ];
  for (const [presented, expected, label] of cases) {
    assert.deepEqual(
      decideSignupConfirmReplay("signup", user, presented, expected),
      { kind: "fail-closed", reason: "not-bound" },
      label,
    );
  }
});

test("12. fail closed: binding without a session (session-less browser)", () => {
  assert.deepEqual(decideSignupConfirmReplay("signup", null, BIND, BIND),      { kind: "fail-closed", reason: "no-session" });
  assert.deepEqual(decideSignupConfirmReplay("signup", undefined, BIND, BIND), { kind: "fail-closed", reason: "no-session" });
});

test("13. fail closed: binding + session without a confirmed email or without an email", () => {
  const unverified = { ...confirmedDealerSignup(), email_confirmed_at: null };
  assert.deepEqual(decideSignupConfirmReplay("signup", unverified, BIND, BIND), { kind: "fail-closed", reason: "not-verified" });
  const missing = { ...confirmedDealerSignup(), email_confirmed_at: undefined };
  assert.deepEqual(decideSignupConfirmReplay("signup", missing, BIND, BIND), { kind: "fail-closed", reason: "not-verified" });
  const noEmail = { ...confirmedDealerSignup(), email: "" };
  assert.deepEqual(decideSignupConfirmReplay("signup", noEmail, BIND, BIND), { kind: "fail-closed", reason: "not-verified" });
});

test("14. fail closed: binding + confirmed session that is not a dealer-v1 signup", () => {
  const cases: ConfirmSessionUser[] = [
    { ...confirmedDealerSignup(), user_metadata: null },
    { ...confirmedDealerSignup(), user_metadata: undefined },
    { ...confirmedDealerSignup(), user_metadata: {} },
    { ...confirmedDealerSignup(), user_metadata: { dealer_signup_flow: "dealer-v2" } },
    { ...confirmedDealerSignup(), user_metadata: { dealer_signup_flow: true } },
    { ...confirmedDealerSignup(), user_metadata: { dealer_signup_flow: ["dealer-v1"] } },
  ];
  for (const user of cases) {
    assert.deepEqual(
      decideSignupConfirmReplay("signup", user, BIND, BIND),
      { kind: "fail-closed", reason: "not-dealer-signup" },
      JSON.stringify(user.user_metadata),
    );
  }
});

test("15. metadata never carries authority: privilege-looking keys do not change the decision", () => {
  const user = confirmedDealerSignup();
  user.user_metadata = { ...user.user_metadata, role: "super_admin", approval_status: "approved" };
  assert.deepEqual(decideSignupConfirmReplay("signup", user, BIND, BIND), { kind: "recover" });
  const nonDealer = { ...confirmedDealerSignup(), user_metadata: { role: "super_admin", approval_status: "approved" } };
  assert.deepEqual(decideSignupConfirmReplay("signup", nonDealer, BIND, BIND), { kind: "fail-closed", reason: "not-dealer-signup" });
  // …and never substitute for the binding.
  assert.deepEqual(decideSignupConfirmReplay("signup", user, null, BIND), { kind: "fail-closed", reason: "not-bound" });
});

// ── redirect mapping ─────────────────────────────────────────────────────────

test("16. redirect mapping: converged pending dealer → approval-wait state", () => {
  assert.equal(signupReplayRedirectPath("created"),        "/signup/pending?confirm=0");
  assert.equal(signupReplayRedirectPath("already-exists"), "/signup/pending?confirm=0");
});

test("17. redirect mapping: identity contradictions fail closed (null → /login?error=auth_confirm_failed)", () => {
  assert.equal(signupReplayRedirectPath("not-authenticated"), null);
  assert.equal(signupReplayRedirectPath("not-verified"),      null);
  assert.equal(signupReplayRedirectPath("not-dealer-signup"), null);
});

test("18. redirect mapping: service setup failures keep the approval-wait surface with the setup notice", () => {
  for (const kind of ["invalid-business-name", "email-conflict", "error"] as const) {
    assert.equal(signupReplayRedirectPath(kind), "/signup/pending?confirm=0&setup_error=1", kind);
  }
});

test("19. redirect mapping is total over every pending-dealer result kind", () => {
  const kinds: PendingDealerKind[] = [
    "created", "already-exists", "not-authenticated", "not-verified",
    "not-dealer-signup", "invalid-business-name", "email-conflict", "error",
  ];
  for (const kind of kinds) {
    const path = signupReplayRedirectPath(kind);
    assert.ok(path === null || path.startsWith("/signup/pending?confirm=0"), kind);
    assert.ok(path === null || !path.includes("token"), "never echoes a token");
  }
});

// ── interstitial ─────────────────────────────────────────────────────────────

test("20. escapeHtml neutralises every HTML/attribute metacharacter", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml("plain-token_123"), "plain-token_123");
});

test("21. interstitial: Japanese copy, same-origin POST form, one explicit confirmation button", () => {
  const html = renderSignupConfirmInterstitial({ tokenHash: TOKEN, type: "signup" });
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /メールアドレスの確認<\/h1>/);
  assert.match(html, /下のボタンを押すとメールアドレスの確認が完了し、GYEON Japanの承認待ちに進みます。/);
  assert.match(html, /<form method="post" action="\/auth\/confirm"/);
  assert.equal(html.match(/<form /g)!.length, 1, "exactly one form");
  assert.equal(html.match(/<button type="submit">/g)!.length, 1, "exactly one submit button");
  assert.match(html, /<button type="submit">メールアドレスを確認する<\/button>/);
  assert.match(html, /<input type="hidden" name="type" value="signup">/);
  assert.match(html, new RegExp(`<input type="hidden" name="token_hash" value="${TOKEN}">`));
  assert.equal(html.includes('name="next"'), false, "no next field when next is absent");
  // No external resources, no automatic submission, no GET form.
  assert.equal(/<script\b/.test(html), false);
  assert.equal(/\bsrc=|<link\b|@import|url\(/.test(html), false);
  assert.equal(/\.submit\(\)|method="get"/.test(html), false);
});

test("22. interstitial: the token appears only inside the hidden field, never in visible text", () => {
  const html = renderSignupConfirmInterstitial({ tokenHash: TOKEN, type: "signup", next: "/hub" });
  const withoutHidden = html.replace(/<input type="hidden"[^>]*>/g, "");
  assert.equal(withoutHidden.includes(TOKEN), false);
  assert.match(html, /<input type="hidden" name="next" value="\/hub">/);
});

test("23. interstitial: every hidden value is HTML-escaped (attribute breakout impossible)", () => {
  const hostile = `"><script>alert(1)</script><input value="`;
  const html = renderSignupConfirmInterstitial({ tokenHash: hostile, type: hostile, next: hostile });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes(hostile), false);
  assert.equal(html.match(/<input type="hidden"/g)!.length, 3);
  assert.equal(html.match(/<form /g)!.length, 1);
  assert.equal(html.match(/<button /g)!.length, 1);
  assert.match(html, /value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;&lt;input value=&quot;"/);
});

test("24. interstitial never writes authority-looking literals", () => {
  const html = renderSignupConfirmInterstitial({ tokenHash: TOKEN, type: "signup", next: "/" });
  for (const forbidden of ["role:", "user_id", "dealer_id", "approval_status", "is_admin"]) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});
