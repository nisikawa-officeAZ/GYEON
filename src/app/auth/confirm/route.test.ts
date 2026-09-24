// /auth/confirm handler tests — GET interstitial, POST consumption, and
// server-authenticated (HMAC-bound) replay recovery for dealer signups.
//
// Run:
//   node --experimental-test-module-mocks --import tsx --test src/app/auth/confirm/route.test.ts
//   (or, together with the helper suite: npm run test:auth-confirm)
//
// The handlers are invoked directly with real `Request` objects. Their three
// server dependencies — the request-scoped Supabase client, the GYEON claim
// service, and the zero-argument pending-dealer service — are replaced with
// `mock.module` fakes that RECORD every invocation. No network, database,
// cookie jar, browser, or provider is involved, and no token is ever logged.
//
// Contract under test (production UAT 2026-09-24):
//   * GET type=signup never consumes the token: it renders a no-store
//     confirmation page with one same-origin POST form (scanners/previews
//     that only GET cannot burn the single-use link).
//   * POST type=signup (same-origin) verifies once, converges the pending
//     dealer → /signup/pending?confirm=0, and sets an HttpOnly HMAC binding
//     cookie that contains neither the token nor the secret.
//   * A replay recovers ONLY with a matching binding cookie AND a confirmed
//     dealer-v1 session. A confirmed session with a missing / wrong /
//     plain-SHA / other-token binding fails closed; binding without session
//     fails closed.
//   * Cross-origin POST, recovery/invite POST, missing params, thrown errors →
//     /login?error=auth_confirm_failed. Recovery/invite GET → /reset-password
//     (unchanged consuming behaviour). GYEON claim → /shop-profile.

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { after, before, beforeEach, describe, it, mock } from "node:test";

// ── Scenario + call log ──────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
}

interface Scenario {
  verify: { error: null } | { error: { message: string; code?: string } } | "throw";
  user: SessionUser | null | "throw";
  claim: { kind: string; dealerId?: string } | "throw";
  dealer: { kind: string; dealerId?: string };
}

interface CallLog {
  createClient: number;
  verifyOtp: Array<{ type: string; token_hash: string }>;
  getUser: number;
  claim: number;
  createPendingDealer: number;
  consoleError: string[];
}

let scenario: Scenario = { verify: { error: null }, user: null, claim: { kind: "disabled" }, dealer: { kind: "error" } };
let log: CallLog = { createClient: 0, verifyOtp: [], getUser: 0, claim: 0, createPendingDealer: 0, consoleError: [] };

const ORIGIN    = "https://app.test";
const TOKEN     = "pkce_0123456789abcdef0123456789abcdef0123456789abcdef";
const USER_ID   = "31e1717a-0000-4000-8000-000000000000";
const DEALER_ID = "30460a02-0000-4000-8000-000000000000";
const SECRET    = "test-service-secret-not-a-real-key";
const COOKIE    = "gda_signup_confirm_bind";

const confirmedDealerSignupUser = (): SessionUser => ({
  id: USER_ID,
  email: "applicant@example.com",
  email_confirmed_at: "2026-09-24T08:47:00.000Z",
  user_metadata: { dealer_signup_flow: "dealer-v1", dealer_business_name: "Test Shop" },
});

const USED_TOKEN_ERROR = { error: { message: "Email link is invalid or has expired", code: "otp_expired" } };

// ── Module mocks, installed BEFORE the route is imported ─────────────────────

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => {
      log.createClient += 1;
      return {
        auth: {
          verifyOtp: async (params: { type: string; token_hash: string }) => {
            log.verifyOtp.push(params);
            if (scenario.verify === "throw") throw new Error("network failure");
            return { data: { user: null, session: null }, error: scenario.verify.error };
          },
          getUser: async () => {
            log.getUser += 1;
            if (scenario.user === "throw") throw new Error("session lookup failure");
            return scenario.user
              ? { data: { user: scenario.user }, error: null }
              : { data: { user: null }, error: { message: "Auth session missing!" } };
          },
        },
      };
    },
  },
});

mock.module("@/lib/dealer/claim-gyeon-provisioning", {
  namedExports: {
    claimGyeonProvisioning: async () => {
      log.claim += 1;
      if (scenario.claim === "throw") throw new Error("claim failure");
      return scenario.claim;
    },
  },
});

mock.module("@/lib/dealer/create-pending-dealer", {
  namedExports: {
    createPendingDealer: async () => {
      log.createPendingDealer += 1;
      return scenario.dealer;
    },
  },
});

let GET: typeof import("./route")["GET"];
let POST: typeof import("./route")["POST"];
let signupConfirmBinding: typeof import("@/lib/auth/confirm-signup-redirect")["signupConfirmBinding"];
const realConsoleError = console.error;
const realSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
before(async () => {
  console.error = (...args: unknown[]) => { log.consoleError.push(args.map(String).join(" ")); };
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  ({ GET, POST } = await import("./route"));
  ({ signupConfirmBinding } = await import("@/lib/auth/confirm-signup-redirect"));
});
after(() => {
  console.error = realConsoleError;
  if (realSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = realSecret;
});

beforeEach(() => {
  scenario = { verify: { error: null }, user: null, claim: { kind: "disabled" }, dealer: { kind: "error" } };
  log = { createClient: 0, verifyOtp: [], getUser: 0, claim: 0, createPendingDealer: 0, consoleError: [] };
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
});

const binding = () => signupConfirmBinding("signup", TOKEN, SECRET)!;

// Next declares `process.env.NODE_ENV` as readonly, so the swap goes through a
// narrow cast. The original value is restored in `finally` — even when an
// assertion inside `run` throws — so sibling tests never observe the change.
const realNodeEnv = process.env.NODE_ENV;
async function withNodeEnv<T>(value: string, run: () => Promise<T>): Promise<T> {
  const env = process.env as { NODE_ENV?: string };
  env.NODE_ENV = value;
  try {
    return await run();
  } finally {
    if (realNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = realNodeEnv;
  }
}

function get(query: string, headers: Record<string, string> = {}): Promise<Response> {
  return GET(new Request(`${ORIGIN}/auth/confirm${query}`, { headers }));
}

interface PostOptions {
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  origin?: string | null;
  cookie?: string | null;
}

function post({ fields, headers = {}, origin = ORIGIN, cookie = null }: PostOptions = {}): Promise<Response> {
  const body = new URLSearchParams(fields ?? { token_hash: TOKEN, type: "signup" });
  const h: Record<string, string> = { ...headers };
  if (origin !== null) h.origin = origin;
  if (cookie !== null) h.cookie = cookie;
  return POST(new Request(`${ORIGIN}/auth/confirm`, { method: "POST", headers: h, body }));
}

function expectRedirect(res: Response, path: string) {
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), `${ORIGIN}${path}`);
  assert.equal(res.headers.get("location")!.includes(TOKEN), false, "redirect never echoes the token");
}

function expectNoBindingCookie(res: Response) {
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.equal(setCookie.includes(COOKIE), false, "no binding cookie");
}

function expectNothingConsumed() {
  assert.deepEqual(log.verifyOtp, [], "verifyOtp never called");
  assert.equal(log.claim, 0, "claim never called");
  assert.equal(log.createPendingDealer, 0, "createPendingDealer never called");
}

const LOGIN_FAILED = "/login?error=auth_confirm_failed";
const PENDING      = "/signup/pending?confirm=0";

// ── 1. GET type=signup renders, never consumes ──────────────────────────────

describe("GET signup: scanner / preview / prefetch / first human visit", () => {
  it("returns a no-store, noindex, no-referrer HTML confirmation page and performs zero verify/dealer calls", async () => {
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    const res = await get(`?token_hash=${TOKEN}&type=signup`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^text\/html; charset=utf-8/);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(res.headers.get("location"), null);
    expectNoBindingCookie(res);
    expectNothingConsumed();
    assert.equal(log.getUser, 0);
    assert.equal(log.createClient, 0, "no Supabase client is even created for a plain GET");
    assert.deepEqual(log.consoleError, []);

    const html = await res.text();
    assert.match(html, /<form method="post" action="\/auth\/confirm"/);
    assert.match(html, /<button type="submit">メールアドレスを確認する<\/button>/);
    assert.match(html, /name="token_hash" value="[^"]+"/);
    assert.match(html, /name="type" value="signup"/);
    assert.equal(html.replace(/<input type="hidden"[^>]*>/g, "").includes(TOKEN), false, "token only in the hidden field");
  });

  it("carries a sanitised next through the form and drops unsafe values", async () => {
    let html = await (await get(`?token_hash=${TOKEN}&type=signup&next=/hub`)).text();
    assert.match(html, /name="next" value="\/hub"/);
    html = await (await get(`?token_hash=${TOKEN}&type=signup&next=//evil.example`)).text();
    assert.match(html, /name="next" value="\/"/);
    html = await (await get(`?token_hash=${TOKEN}&type=signup&next=https://evil.example`)).text();
    assert.match(html, /name="next" value="\/"/);
    expectNothingConsumed();
  });

  it("HTML-escapes a hostile token_hash so it cannot break out of the hidden field", async () => {
    const hostile = `"><script>alert(1)</script>`;
    const res = await get(`?token_hash=${encodeURIComponent(hostile)}&type=signup`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes(hostile), false);
    assert.match(html, /value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
    expectNothingConsumed();
  });

  it("a confirmed dealer session WITHOUT the binding still gets the page, not a recovery (no session lookup)", async () => {
    scenario.user = confirmedDealerSignupUser();
    const res = await get(`?token_hash=${TOKEN}&type=signup`);
    assert.equal(res.status, 200);
    assert.equal(log.getUser, 0);
    assert.equal(log.createClient, 0);
    expectNothingConsumed();
  });

  it("a wrong / plain-SHA / other-token binding cookie on GET still gets the page, never a recovery", async () => {
    scenario.user = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    const plain = createHash("sha256").update(`signup:${TOKEN}`).digest("hex");
    const other = signupConfirmBinding("signup", TOKEN + "x", SECRET)!;
    for (const value of ["forged", plain, other, ""]) {
      const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${value}` });
      assert.equal(res.status, 200, `binding=${value.slice(0, 8)}`);
    }
    assert.equal(log.getUser, 0);
    expectNothingConsumed();
  });
});

// ── 2. GET bound replay short-circuit ───────────────────────────────────────

describe("GET signup with matching binding cookie + confirmed dealer-v1 session (Back → click again)", () => {
  it("redirects to /signup/pending?confirm=0 without calling verifyOtp", async () => {
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `sb-x=1; ${COOKIE}=${binding()}` });
    expectRedirect(res, PENDING);
    assert.deepEqual(log.verifyOtp, []);
    assert.equal(log.getUser, 1);
    assert.equal(log.createPendingDealer, 1);
    assert.equal(log.claim, 0);
    assert.deepEqual(log.consoleError, []);
  });

  it("matching binding but NO session → page (not recovery, not failure)", async () => {
    scenario.user = null;
    const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${binding()}` });
    assert.equal(res.status, 200);
    assert.equal(log.getUser, 1);
    expectNothingConsumed();
  });

  it("matching binding but unverified / non-dealer session → page", async () => {
    for (const user of [
      { ...confirmedDealerSignupUser(), email_confirmed_at: null },
      { ...confirmedDealerSignupUser(), user_metadata: { role: "super_admin" } },
    ]) {
      scenario.user = user;
      const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${binding()}` });
      assert.equal(res.status, 200);
    }
    expectNothingConsumed();
  });

  it("matching binding + session but identity contradiction from the service → page (token untouched)", async () => {
    scenario.user = confirmedDealerSignupUser();
    for (const kind of ["not-authenticated", "not-verified", "not-dealer-signup"]) {
      scenario.dealer = { kind };
      const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${binding()}` });
      assert.equal(res.status, 200, kind);
    }
    assert.deepEqual(log.verifyOtp, []);
  });

  it("a thrown session lookup during the replay check is logged and still renders the page", async () => {
    scenario.user = "throw";
    const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${binding()}` });
    assert.equal(res.status, 200);
    assert.equal(log.consoleError.length, 1);
    assert.equal(log.consoleError[0].includes(TOKEN), false);
    expectNothingConsumed();
  });

  it("without the server secret no binding can match → page, no session lookup", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    scenario.user = confirmedDealerSignupUser();
    const res = await get(`?token_hash=${TOKEN}&type=signup`, { cookie: `${COOKIE}=${binding()}` });
    assert.equal(res.status, 200);
    assert.equal(log.getUser, 0);
    expectNothingConsumed();
  });
});

// ── 3. POST type=signup: the human confirmation ─────────────────────────────

describe("POST signup: first valid confirmation", () => {
  it("verifies once, claims once, converges a created pending dealer → /signup/pending?confirm=0, sets the HMAC binding cookie", async () => {
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    const res = await post();
    expectRedirect(res, PENDING);
    assert.deepEqual(log.verifyOtp, [{ type: "signup", token_hash: TOKEN }]);
    assert.equal(log.claim, 1);
    assert.equal(log.createPendingDealer, 1);
    assert.equal(log.getUser, 0, "success path needs no extra session lookup");
    assert.deepEqual(log.consoleError, []);

    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`^${COOKIE}=${binding()};`), "cookie value is the keyed binding");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=lax/i);
    assert.match(setCookie, /Path=\/auth\/confirm/);
    assert.match(setCookie, /Max-Age=3600/);
    assert.equal(setCookie.includes(TOKEN), false, "cookie never contains the token");
    assert.equal(setCookie.includes(SECRET), false, "cookie never contains the secret");
    const plain = createHash("sha256").update(`signup:${TOKEN}`).digest("hex");
    assert.equal(setCookie.includes(plain), false, "cookie is not a plain SHA-256");
    assert.equal(/Secure/i.test(setCookie), process.env.NODE_ENV === "production");
  });

  it("in production mode the binding cookie is issued WITH the Secure attribute (observed on Set-Cookie)", async () => {
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    const res = await withNodeEnv("production", () => post());
    expectRedirect(res, PENDING);
    assert.deepEqual(log.consoleError, []);

    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`^${COOKIE}=${binding()};`), "same keyed binding cookie is issued in production");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /;\s*Secure\b/i, "production binding cookie carries Secure");
    assert.equal(process.env.NODE_ENV, realNodeEnv, "NODE_ENV is restored after the production-mode request");
  });

  it("an already-existing pending dealer converges to the same state", async () => {
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    expectRedirect(await post(), PENDING);
  });

  it("a service setup failure keeps the approval-wait surface with the setup notice (cookie still set)", async () => {
    scenario.dealer = { kind: "error" };
    const res = await post();
    expectRedirect(res, `${PENDING}&setup_error=1`);
    assert.match(res.headers.get("set-cookie") ?? "", new RegExp(`^${COOKIE}=`));
  });

  it("a verified non-dealer confirmation continues to a sanitised next (default /)", async () => {
    scenario.dealer = { kind: "not-dealer-signup" };
    expectRedirect(await post(), "/");
    expectRedirect(await post({ fields: { token_hash: TOKEN, type: "signup", next: "/hub" } }), "/hub");
    expectRedirect(await post({ fields: { token_hash: TOKEN, type: "signup", next: "//evil.example" } }), "/");
    expectRedirect(await post({ fields: { token_hash: TOKEN, type: "signup", next: "@evil.example" } }), "/");
  });

  it("GYEON claim on the verified boundary still wins → /shop-profile", async () => {
    scenario.claim  = { kind: "claimed", dealerId: DEALER_ID };
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    expectRedirect(await post(), "/shop-profile");
    assert.equal(log.createPendingDealer, 0);
  });

  it("a thrown GYEON claim is logged and the signup still converges", async () => {
    scenario.claim  = "throw";
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    const res = await post();
    expectRedirect(res, PENDING);
    assert.equal(log.claim, 1);
    assert.equal(log.createPendingDealer, 1);
    assert.equal(log.consoleError.length, 1);
    assert.equal(log.consoleError[0].includes(TOKEN), false);
    assert.match(res.headers.get("set-cookie") ?? "", new RegExp(`^${COOKIE}=`));
  });

  it("without the server secret the confirmation still succeeds — just without a binding cookie", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    const res = await post();
    expectRedirect(res, PENDING);
    expectNoBindingCookie(res);
    assert.equal(log.verifyOtp.length, 1);
  });

  it("accepts a same-origin POST that carries only Sec-Fetch-Site (no Origin header)", async () => {
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    expectRedirect(await post({ origin: null, headers: { "sec-fetch-site": "same-origin" } }), PENDING);
    assert.equal(log.verifyOtp.length, 1);
  });
});

// ── 4. POST replay recovery — binding AND session required ──────────────────

describe("POST signup replay after a successful confirmation", () => {
  it("recovers with matching binding cookie + confirmed dealer-v1 session", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    const res = await post({ cookie: `${COOKIE}=${binding()}` });
    expectRedirect(res, PENDING);
    assert.deepEqual(log.verifyOtp, [{ type: "signup", token_hash: TOKEN }], "the token is still verified first");
    assert.equal(log.getUser, 1, "recovery is decided on server-side session evidence");
    assert.equal(log.createPendingDealer, 1, "the same idempotent zero-argument convergence runs");
    assert.equal(log.claim, 0, "the claim convergence stays on the verified boundary only");
    assert.equal(log.consoleError.length, 1, "the verify failure is still logged");
    assert.equal(log.consoleError[0].includes(TOKEN), false, "the token is never logged");
  });

  it("recovers when the first request had not converged the dealer yet (created on replay)", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), PENDING);
  });

  it("a service setup failure on the replay keeps the approval-wait surface with the setup notice", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    for (const kind of ["error", "email-conflict", "invalid-business-name"]) {
      scenario.dealer = { kind };
      expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), `${PENDING}&setup_error=1`);
    }
  });

  it("identity contradictions from the service fail closed even after a recover decision", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    for (const kind of ["not-authenticated", "not-verified", "not-dealer-signup"]) {
      scenario.dealer = { kind };
      expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), LOGIN_FAILED);
    }
  });

  it("confirmed dealer-v1 session with NO binding cookie → fail closed (Objection 1)", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    expectRedirect(await post(), LOGIN_FAILED);
    assert.equal(log.getUser, 0, "no session lookup without a binding");
    assert.equal(log.createPendingDealer, 0);
  });

  it("confirmed session with a wrong / forged / plain-SHA / other-token / truncated binding → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    const plain = createHash("sha256").update(`signup:${TOKEN}`).digest("hex");
    const other = signupConfirmBinding("signup", TOKEN + "x", SECRET)!;
    const wrongType = signupConfirmBinding("recovery", TOKEN, SECRET)!;
    const wrongKey = signupConfirmBinding("signup", TOKEN, SECRET + "x")!;
    for (const value of ["forged", plain, other, wrongType, wrongKey, binding().slice(0, 63), binding() + "0", ""]) {
      expectRedirect(await post({ cookie: `${COOKIE}=${value}` }), LOGIN_FAILED);
    }
    assert.equal(log.getUser, 0);
    assert.equal(log.createPendingDealer, 0);
  });

  it("binding presented under a different cookie name → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    expectRedirect(await post({ cookie: `other=${binding()}; x${COOKIE}=${binding()}` }), LOGIN_FAILED);
    assert.equal(log.getUser, 0);
  });

  it("matching binding but NO session (cookie copied into a session-less browser) → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = null;
    expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), LOGIN_FAILED);
    assert.equal(log.getUser, 1);
    assert.equal(log.createPendingDealer, 0, "no service work without a session");
  });

  it("matching binding but unverified or non-dealer session → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    for (const user of [
      { ...confirmedDealerSignupUser(), email_confirmed_at: null },
      { ...confirmedDealerSignupUser(), user_metadata: { role: "super_admin" } },
    ]) {
      scenario.user = user;
      expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), LOGIN_FAILED);
    }
    assert.equal(log.createPendingDealer, 0);
  });

  it("without the server secret a previously issued binding cannot be validated → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), LOGIN_FAILED);
    assert.equal(log.getUser, 0);
    assert.equal(log.createPendingDealer, 0);
  });

  it("a replayed recovery never sets or re-sets the binding cookie", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    scenario.dealer = { kind: "already-exists", dealerId: DEALER_ID };
    const res = await post({ cookie: `${COOKIE}=${binding()}` });
    expectRedirect(res, PENDING);
    expectNoBindingCookie(res);
  });
});

// ── 5. POST fail-closed paths ───────────────────────────────────────────────

describe("POST fail-closed", () => {
  it("cross-origin POST fails closed BEFORE any Supabase work", async () => {
    scenario.dealer = { kind: "created", dealerId: DEALER_ID };
    for (const origin of ["https://evil.example", "http://app.test", "https://app.test.evil.example", "null", ""]) {
      expectRedirect(await post({ origin }), LOGIN_FAILED);
    }
    expectRedirect(await post({ origin: null }), LOGIN_FAILED);
    expectRedirect(await post({ origin: null, headers: { "sec-fetch-site": "cross-site" } }), LOGIN_FAILED);
    expectRedirect(await post({ origin: null, headers: { "sec-fetch-site": "same-site" } }), LOGIN_FAILED);
    expectRedirect(await post({ origin: null, headers: { "sec-fetch-site": "none" } }), LOGIN_FAILED);
    assert.equal(log.createClient, 0);
    expectNothingConsumed();
    assert.equal(log.getUser, 0);
  });

  it("recovery / invite / other types are never consumed by POST", async () => {
    scenario.user = confirmedDealerSignupUser();
    for (const type of ["recovery", "invite", "magiclink", "email_change", "email", ""]) {
      expectRedirect(await post({ fields: { token_hash: TOKEN, type } }), LOGIN_FAILED);
    }
    assert.equal(log.createClient, 0);
    expectNothingConsumed();
  });

  it("missing token_hash / type / body never touches Supabase", async () => {
    scenario.user = confirmedDealerSignupUser();
    expectRedirect(await post({ fields: { type: "signup" } }), LOGIN_FAILED);
    expectRedirect(await post({ fields: { token_hash: TOKEN } }), LOGIN_FAILED);
    expectRedirect(await post({ fields: { token_hash: "", type: "signup" } }), LOGIN_FAILED);
    expectRedirect(await post({ fields: {} }), LOGIN_FAILED);
    const noBody = await POST(new Request(`${ORIGIN}/auth/confirm`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ token_hash: TOKEN, type: "signup" }),
    }));
    expectRedirect(noBody, LOGIN_FAILED);
    assert.equal(log.createClient, 0);
    expectNothingConsumed();
    assert.equal(log.getUser, 0);
  });

  it("forged / expired / unrelated token in a browser without binding → fail closed", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = null;
    const res = await post();
    expectRedirect(res, LOGIN_FAILED);
    expectNoBindingCookie(res);
    assert.equal(log.getUser, 0);
    assert.equal(log.createPendingDealer, 0);
    assert.equal(log.claim, 0);
  });

  it("a thrown verifyOtp error stays on the unexpected-error path (no session lookup, no recovery)", async () => {
    scenario.verify = "throw";
    scenario.user   = confirmedDealerSignupUser();
    expectRedirect(await post({ cookie: `${COOKIE}=${binding()}` }), LOGIN_FAILED);
    assert.equal(log.getUser, 0);
    assert.equal(log.createPendingDealer, 0);
  });

  it("the failure redirect never carries the provider message or the token", async () => {
    scenario.verify = { error: { message: "secret provider detail", code: "otp_expired" } };
    const res = await post();
    const location = res.headers.get("location")!;
    assert.equal(location, `${ORIGIN}${LOGIN_FAILED}`);
    assert.equal(location.includes("secret"), false);
    assert.equal(log.consoleError.some((line) => line.includes(TOKEN)), false);
  });
});

// ── 6. GET non-signup types: unchanged consuming behaviour ──────────────────

describe("GET recovery / invite (unchanged)", () => {
  it("recovery and invite consume on GET and converge to /reset-password before any dealer work", async () => {
    for (const type of ["recovery", "invite"]) {
      const res = await get(`?token_hash=${TOKEN}&type=${type}`);
      expectRedirect(res, "/reset-password");
      expectNoBindingCookie(res);
    }
    assert.equal(log.verifyOtp.length, 2);
    assert.equal(log.claim, 2);
    assert.equal(log.createPendingDealer, 0);
  });

  it("other verified types continue to next (default /) without dealer work", async () => {
    expectRedirect(await get(`?token_hash=${TOKEN}&type=magiclink`), "/");
    expectRedirect(await get(`?token_hash=${TOKEN}&type=email_change&next=/hub`), "/hub");
    assert.equal(log.createPendingDealer, 0);
  });

  it("recovery / invite verify failures are never recovered, even with binding + confirmed dealer session", async () => {
    scenario.verify = USED_TOKEN_ERROR;
    scenario.user   = confirmedDealerSignupUser();
    for (const type of ["recovery", "invite", "magiclink", "email_change"]) {
      const bound = signupConfirmBinding(type, TOKEN, SECRET)!;
      expectRedirect(await get(`?token_hash=${TOKEN}&type=${type}`, { cookie: `${COOKIE}=${bound}` }), LOGIN_FAILED);
    }
    assert.equal(log.getUser, 0, "non-signup types do not consult the session");
    assert.equal(log.createPendingDealer, 0);
  });

  it("a thrown verifyOtp on GET recovery stays fail closed", async () => {
    scenario.verify = "throw";
    expectRedirect(await get(`?token_hash=${TOKEN}&type=recovery`), LOGIN_FAILED);
  });

  it("missing token_hash or type never touches Supabase (GET)", async () => {
    scenario.user = confirmedDealerSignupUser();
    expectRedirect(await get(`?type=signup`), LOGIN_FAILED);
    expectRedirect(await get(`?token_hash=${TOKEN}`), LOGIN_FAILED);
    expectRedirect(await get(``), LOGIN_FAILED);
    assert.equal(log.createClient, 0);
    expectNothingConsumed();
    assert.equal(log.getUser, 0);
  });
});
