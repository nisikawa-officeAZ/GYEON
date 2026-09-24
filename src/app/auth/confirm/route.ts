// Supabase Auth email confirmation (token_hash / OTP flow).
// Supabase's SSR email templates link to `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…`.
// This route verifies the one-time token, which sets the session cookie, then
// redirects to the appropriate page (the reset form for password recovery).
//
// Complements /api/auth/callback (the PKCE "code" flow). Having both means the
// reset/confirmation link works regardless of which email-template style the
// Supabase project uses. Both boundaries converge a dealer signup to the SAME
// post-verification state: /signup/pending?confirm=0 (approval pending).
//
// Production UAT 2026-09-24: a signup token_hash is single-use, and mail
// scanners / link previews GET the link before the applicant does. For a
// signup confirmation type (`type=signup`, or the `type=email` alias the live
// Supabase template actually emits — Preview UAT 2026-09-24) a GET therefore
// never consumes the token: it renders a human-confirmation page whose only
// action is a same-origin POST. The POST runs the unchanged consuming sequence
// below with the ORIGINAL type value. Recovery and invite links keep their
// GET-consuming behaviour (out of scope here).

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse }      from "next/server";
import { createClient }      from "@/lib/supabase/server";
import { claimGyeonProvisioning } from "@/lib/dealer/claim-gyeon-provisioning";
import { createPendingDealer } from "@/lib/dealer/create-pending-dealer";
import { sanitizeNextPath }  from "@/lib/auth/sanitize-next-path";
import {
  SIGNUP_CONFIRM_BIND_COOKIE,
  SIGNUP_CONFIRM_BIND_MAX_AGE,
  SIGNUP_CONFIRM_BIND_PATH,
  bindingsMatch,
  decideSignupConfirmReplay,
  isSignupConfirmType,
  readCookie,
  renderSignupConfirmInterstitial,
  signupConfirmBinding,
  signupReplayRedirectPath,
} from "@/lib/auth/confirm-signup-redirect";

export const dynamic = "force-dynamic";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

interface ConfirmInput {
  origin: string;
  token_hash: string;
  type: EmailOtpType;
  next: string | null;
}

// ── 1. The consuming sequence (unchanged order) ─────────────────────────────
//
// verifyOtp → GYEON claim → recovery/invite → claimed → signup pending dealer.
// Returns the redirect on success, or `null` when verifyOtp rejected the token
// (already logged, token never included). Any other failure throws to the
// caller's unexpected-error path.
async function consumeConfirmation(
  supabase: ServerClient,
  { origin, token_hash, type, next }: ConfirmInput,
): Promise<NextResponse | null> {
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    console.error("[auth/confirm] verifyOtp error:", error.message);
    return null;
  }

  // GYEON partner onboarding: the email-verification boundary is a claim
  // convergence point (signup confirmations AND accepted invites). The
  // claim is gate-guarded, session-derived, idempotent, and fail-closed —
  // every non-eligible outcome leaves the existing flow untouched.
  let claimedGyeonProvisioning = false;
  try {
    const claim = await claimGyeonProvisioning();
    claimedGyeonProvisioning = claim.kind === "claimed";
  } catch (claimErr) {
    console.error("[auth/confirm] gyeon claim error:", claimErr);
  }

  if (type === "recovery" || type === "invite") {
    // Password reset, and invite acceptance — both need the reset form.
    //
    // An invited user is authenticated the moment verifyOtp succeeds, but has NO password:
    // the invite never asked for one. Falling through to `next ?? "/"` would drop them on the
    // app home, signed in, with nothing prompting them to set one — and no route in the app
    // would ever offer it, because /reset-password is the only surface that calls
    // updateUser({ password }). Sending them there is what makes the invite an onboarding
    // rather than a dead end.
    return NextResponse.redirect(`${origin}/reset-password`);
  }
  if (claimedGyeonProvisioning) {
    // Freshly claimed: the owner membership is 'invited' — the shop
    // profile is the only surface until activation.
    return withSignupBinding(NextResponse.redirect(`${origin}/shop-profile`), type, token_hash);
  }

  if (isSignupConfirmType(type)) {
    // Confirmation-required production signup converges here.
    // The service action derives id/email from this verified session and
    // creates at most one pending dealer; no browser-supplied identity,
    // dealer identifier, approval state, or privilege is accepted.
    const dealer = await createPendingDealer();
    if (dealer.kind === "created" || dealer.kind === "already-exists") {
      return withSignupBinding(NextResponse.redirect(`${origin}/signup/pending?confirm=0`), type, token_hash);
    }
    if (dealer.kind === "not-dealer-signup") {
      // A verified non-dealer email confirmation (no dealer-v1 flow
      // metadata) is not a registration — continue to the requested page.
      return withSignupBinding(NextResponse.redirect(`${origin}${next ?? "/"}`), type, token_hash);
    }
    // Verified, but the pending dealer could not be converged. Keep the
    // user on the approval-wait surface with an explicit setup notice
    // rather than an ordinary login screen.
    return withSignupBinding(
      NextResponse.redirect(`${origin}/signup/pending?confirm=0&setup_error=1`),
      type,
      token_hash,
    );
  }
  return NextResponse.redirect(`${origin}${next ?? "/"}`);
}

// ── 2. Binding cookie (set only after a SUCCESSFUL signup verification) ─────
//
// Value = HMAC-SHA256(service key, type + token_hash). The browser cannot forge
// it, it contains neither the token nor the key, and it is only ever sent back
// to this path. Without the server-only key no cookie is set: replay recovery
// is then unavailable, but the first valid confirmation still succeeds.
function withSignupBinding(response: NextResponse, type: EmailOtpType, token_hash: string): NextResponse {
  if (!isSignupConfirmType(type)) return response;
  const binding = signupConfirmBinding(type, token_hash, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!binding) return response;
  response.cookies.set({
    name:     SIGNUP_CONFIRM_BIND_COOKIE,
    value:    binding,
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     SIGNUP_CONFIRM_BIND_PATH,
    maxAge:   SIGNUP_CONFIRM_BIND_MAX_AGE,
  });
  return response;
}

// ── 3. Bound replay recovery ────────────────────────────────────────────────
//
// A duplicate click on a link THIS browser already consumed. Two positive
// conditions, both server-authenticated: the presented cookie equals the
// keyed binding for exactly this type + token_hash (constant-time compare),
// and auth.getUser() proves a confirmed dealer-v1 signup. Only then is the
// same idempotent, zero-argument pending-dealer convergence run. verifyOtp is
// never called here. Returns `null` to fail closed.
//
// The cookie is deliberately kept (one-hour residual) so that repeated
// "Back → click again" replays keep converging to the truthful state; it
// grants nothing beyond what the existing session already shows.
async function recoverBoundReplay(
  supabase: ServerClient | null,
  { origin, token_hash, type }: ConfirmInput,
  cookieHeader: string | null,
): Promise<NextResponse | null> {
  if (!isSignupConfirmType(type)) return null;
  const expected  = signupConfirmBinding(type, token_hash, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const presented = readCookie(cookieHeader, SIGNUP_CONFIRM_BIND_COOKIE);
  if (!bindingsMatch(presented, expected)) return null;

  const client = supabase ?? (await createClient());
  const { data: { user } } = await client.auth.getUser();
  if (decideSignupConfirmReplay(type, user, presented, expected).kind !== "recover") return null;

  const dealer = await createPendingDealer();
  const path = signupReplayRedirectPath(dealer.kind);
  return path ? NextResponse.redirect(`${origin}${path}`) : null;
}

function failedRedirect(origin: string): NextResponse {
  // Fallback — send to login with a non-secret error flag. /login renders it as
  // an authentication-link notice, never as a wrong-credentials message.
  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}

function interstitialResponse({ token_hash, type, next }: ConfirmInput): NextResponse {
  return new NextResponse(renderSignupConfirmInterstitial({ tokenHash: token_hash, type, next }), {
    status: 200,
    headers: {
      "content-type":    "text/html; charset=utf-8",
      "cache-control":   "no-store, max-age=0",
      "referrer-policy": "no-referrer",
      "x-robots-tag":    "noindex, nofollow",
    },
  });
}

// The interstitial form is same-origin. Its POST must carry an Origin header
// equal to this origin (modern browsers always send it on form POSTs); when
// the header is absent, only an explicit same-origin fetch metadata signal is
// accepted. Anything else fails closed BEFORE any Supabase work.
function isSameOriginPost(request: Request, origin: string): boolean {
  const originHeader = request.headers.get("origin");
  if (originHeader !== null) return originHeader === origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next");

  if (token_hash && type) {
    const input: ConfirmInput = { origin, token_hash, type, next };
    try {
      if (isSignupConfirmType(type)) {
        // Never consume on GET. A browser that already consumed this exact link
        // (bound cookie + confirmed session) is shown the truthful state; every
        // other GET — scanner, preview, prefetch, first human visit — gets the
        // confirmation page and the token stays valid for the human's POST.
        try {
          const replay = await recoverBoundReplay(null, input, request.headers.get("cookie"));
          if (replay) return replay;
        } catch (replayErr) {
          console.error("[auth/confirm] replay check error:", replayErr);
        }
        return interstitialResponse({ ...input, next: next ? sanitizeNextPath(next) : null });
      }

      const supabase = await createClient();
      const consumed = await consumeConfirmation(supabase, input);
      if (consumed) return consumed;
    } catch (err) {
      console.error("[auth/confirm] unexpected error:", err);
    }
  }

  return failedRedirect(origin);
}

// ── POST (signup confirmation types only: signup | email) ───────────────────
export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  if (!isSameOriginPost(request, origin)) return failedRedirect(origin);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failedRedirect(origin);
  }

  const token_hash = form.get("token_hash");
  const type       = form.get("type");
  const rawNext    = form.get("next");
  if (typeof token_hash !== "string" || token_hash.length === 0 || !isSignupConfirmType(type)) {
    return failedRedirect(origin);
  }

  const input: ConfirmInput = {
    origin,
    token_hash,
    type,
    next: typeof rawNext === "string" && rawNext.length > 0 ? sanitizeNextPath(rawNext) : null,
  };

  try {
    const supabase = await createClient();
    const consumed = await consumeConfirmation(supabase, input);
    if (consumed) return consumed;

    // verifyOtp rejected the token. Only a server-authenticated bound replay
    // may recover; forged, expired, unrelated, or scanner-consumed links in a
    // browser without the binding stay exactly as fail-closed as before.
    const replay = await recoverBoundReplay(supabase, input, request.headers.get("cookie"));
    if (replay) return replay;
  } catch (err) {
    console.error("[auth/confirm] unexpected error:", err);
  }

  return failedRedirect(origin);
}
