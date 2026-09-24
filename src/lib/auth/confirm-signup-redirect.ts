// Pure helpers for the /auth/confirm signup boundary.
//
// Why this exists (production UAT, 2026-09-24): a dealer signup confirmation
// link (`/auth/confirm?token_hash=…&type=signup`) ended on
// /login?error=auth_confirm_failed even though Supabase Auth had confirmed the
// email, recorded a sign-in, and the pending dealer row existed exactly once.
// A token_hash is single-use. The first request that reached Supabase verified
// it, received the session cookies, and converged the pending dealer; every
// later request for the same link fails verifyOtp with the same `otp_expired`
// shape that a forged or genuinely expired token produces. The applicant only
// ever saw the failure screen, so the first consumption was invisible to them:
// a mail scanner / link preview / prefetch performed a GET on the link before
// the human did.
//
// Two mechanisms, both pure and deterministic (no Supabase, no I/O):
//
//   1. GET must not consume. `renderSignupConfirmInterstitial` builds a
//      no-store page whose only action is a same-origin POST that a human
//      triggers with one button. Scanners that merely GET (or prefetch) the
//      link never reach verifyOtp.
//
//   2. Duplicate / replay recovery requires a SERVER-AUTHENTICATED binding.
//      After a successful signup verification the route stores
//      `signupConfirmBinding(type, token_hash, secret)` — an HMAC-SHA256 keyed
//      with the server-only service key — in an HttpOnly cookie. A later
//      failed verifyOtp may be treated as a replay only if the presented
//      binding equals the expected one (constant-time compare) AND the
//      server-validated session is a confirmed dealer-v1 signup. A plain hash
//      is NOT acceptable here: anyone holding the link could compute it, so it
//      would prove nothing. Without the secret no binding can be produced and
//      recovery is simply unavailable (fail closed); the first valid
//      confirmation is unaffected.
//
// The token never appears in any log, redirect, visible text, or cookie value.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CreatePendingDealerResult } from "@/lib/dealer/create-pending-dealer";

// Mirrors the private constant in create-pending-dealer.ts and the value the
// signup page persists in user_metadata. Display/flow metadata only — it never
// grants authority; the pending dealer service re-checks it independently.
export const DEALER_SIGNUP_FLOW = "dealer-v1";

/** Cookie carrying the server-authenticated binding of a consumed signup link. */
export const SIGNUP_CONFIRM_BIND_COOKIE = "gda_signup_confirm_bind";

/** Cookie lifetime in seconds (one hour: covers a "Back → click again" replay). */
export const SIGNUP_CONFIRM_BIND_MAX_AGE = 3600;

/** Cookie path: the binding is only ever needed by this boundary. */
export const SIGNUP_CONFIRM_BIND_PATH = "/auth/confirm";

// Domain separation: the service key is also used elsewhere; the HMAC input is
// prefixed so a binding can never collide with any other keyed value.
const BINDING_PURPOSE = "gda:auth-confirm:signup-binding:v1";

/** The minimal view of a session user needed for the replay decision. */
export interface ConfirmSessionUser {
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export type SignupReplayDecision =
  | { kind: "recover" }
  | {
      kind: "fail-closed";
      reason: "not-signup" | "not-bound" | "no-session" | "not-verified" | "not-dealer-signup";
    };

/**
 * HMAC-SHA256 (hex) over `type` + `token_hash`, keyed with the server-only
 * secret. Returns `null` when any input is unusable — in particular when the
 * secret is unavailable — so callers cannot accidentally fall back to an
 * unkeyed value. The output never contains the token or the secret.
 */
export function signupConfirmBinding(
  type: string | null | undefined,
  tokenHash: string | null | undefined,
  secret: string | null | undefined,
): string | null {
  if (typeof secret !== "string" || secret.length === 0) return null;
  if (typeof type !== "string" || type.length === 0) return null;
  if (typeof tokenHash !== "string" || tokenHash.length === 0) return null;
  return createHmac("sha256", secret)
    .update(BINDING_PURPOSE)
    .update("\0")
    .update(String(type.length))
    .update(":")
    .update(type)
    .update("\0")
    .update(tokenHash)
    .digest("hex");
}

/**
 * Constant-time equality of a presented binding against the expected one.
 * Fails closed on any missing value or length mismatch; `timingSafeEqual`
 * itself requires equal lengths, so that check happens first.
 */
export function bindingsMatch(
  presented: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (typeof presented !== "string" || typeof expected !== "string") return false;
  if (presented.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Reads one cookie value from a raw `Cookie` request header. Pure parser: no
 * decoding beyond percent-decoding of the value, first match wins, and any
 * malformed pair is ignored.
 */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader || !name) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (raw.length === 0) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Decides whether a FAILED (or skipped) verifyOtp may be treated as a replay
 * of an already successful signup confirmation. Every condition is a positive
 * requirement; absence of any one of them keeps the original fail-closed
 * behaviour. The binding is checked BEFORE the session: a confirmed dealer
 * session alone never recovers a link it did not consume.
 */
export function decideSignupConfirmReplay(
  type: string | null,
  user: ConfirmSessionUser | null | undefined,
  presentedBinding: string | null | undefined,
  expectedBinding: string | null | undefined,
): SignupReplayDecision {
  if (type !== "signup") return { kind: "fail-closed", reason: "not-signup" };
  if (!bindingsMatch(presentedBinding, expectedBinding)) {
    return { kind: "fail-closed", reason: "not-bound" };
  }
  if (!user) return { kind: "fail-closed", reason: "no-session" };
  if (!user.email || !user.email_confirmed_at) {
    return { kind: "fail-closed", reason: "not-verified" };
  }
  if (user.user_metadata?.dealer_signup_flow !== DEALER_SIGNUP_FLOW) {
    return { kind: "fail-closed", reason: "not-dealer-signup" };
  }
  return { kind: "recover" };
}

export type PendingDealerKind = CreatePendingDealerResult["kind"];

/**
 * Maps the idempotent pending-dealer convergence result of a recovered replay
 * to the redirect path, or `null` to fail closed (the caller falls through to
 * /login?error=auth_confirm_failed).
 *
 * "created" / "already-exists" are the same approval-wait state the first
 * valid confirmation converged to. A service-side setup failure keeps the
 * applicant on the approval-wait surface with the explicit setup notice, as on
 * the first request. Identity outcomes that contradict the replay decision
 * (no session, unverified, not a dealer signup) never become a success.
 */
export function signupReplayRedirectPath(kind: PendingDealerKind): string | null {
  switch (kind) {
    case "created":
    case "already-exists":
      return "/signup/pending?confirm=0";
    case "not-authenticated":
    case "not-verified":
    case "not-dealer-signup":
      return null;
    case "invalid-business-name":
    case "email-conflict":
    case "error":
      return "/signup/pending?confirm=0&setup_error=1";
  }
}

/** Escapes a string for safe use in HTML text and double-quoted attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SignupConfirmInterstitialInput {
  tokenHash: string;
  type: string;
  next?: string | null;
}

/**
 * The human-confirmation page returned to a GET of a signup link. It performs
 * no verification: the token travels only inside a hidden field of a
 * same-origin POST form that a human submits with one button. Inline CSS only,
 * no external resources, no scripts other than a disable-on-submit guard.
 */
export function renderSignupConfirmInterstitial(input: SignupConfirmInterstitialInput): string {
  const tokenHash = escapeHtml(input.tokenHash);
  const type      = escapeHtml(input.type);
  const nextField = input.next
    ? `\n      <input type="hidden" name="next" value="${escapeHtml(input.next)}">`
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <title>メールアドレスの確認</title>
  <style>
    html, body { margin: 0; padding: 0; background: #0a0a0f; color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif; }
    main { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
    .card { width: 100%; max-width: 384px; background: #16161f; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; box-sizing: border-box; }
    h1 { font-size: 18px; margin: 0 0 8px; text-align: center; }
    p { font-size: 13px; line-height: 1.7; color: #9999b0; margin: 0 0 16px; }
    button { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #4f8ef7; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
    button[disabled] { opacity: 0.5; cursor: not-allowed; }
    .note { font-size: 11px; color: #55556a; margin: 16px 0 0; text-align: center; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>メールアドレスの確認</h1>
      <p>下のボタンを押すとメールアドレスの確認が完了し、GYEON Japanの承認待ちに進みます。</p>
      <form method="post" action="/auth/confirm" autocomplete="off" onsubmit="this.querySelector('button[type=submit]').disabled=true">
        <input type="hidden" name="token_hash" value="${tokenHash}">
        <input type="hidden" name="type" value="${type}">${nextField}
        <button type="submit">メールアドレスを確認する</button>
      </form>
      <p class="note">このページを開いただけでは確認は完了しません。ご本人がボタンを押してください。</p>
    </div>
  </main>
</body>
</html>
`;
}
