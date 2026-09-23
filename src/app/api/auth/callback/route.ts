// Supabase Auth callback — handles email magic links, password reset, etc.
// Supabase redirects to this endpoint after the user clicks an auth email link.
// The endpoint exchanges the one-time code for a session, then redirects the
// user to the appropriate page.
//
// This is the emailRedirectTo target for a new dealer signup (PKCE "code"
// flow). It must never be the ordinary /login page: only this boundary can
// exchange the code, derive the verified session, and converge the pending
// dealer before showing the approval-waiting state.

import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { claimGyeonProvisioning } from "@/lib/dealer/claim-gyeon-provisioning";
import { createPendingDealer } from "@/lib/dealer/create-pending-dealer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        if (type === "recovery" || type === "invite") {
          // Password reset and invite acceptance both need the reset form.
          return NextResponse.redirect(`${origin}/reset-password`);
        }

        const claim = await claimGyeonProvisioning();
        if (claim.kind === "claimed") {
          return NextResponse.redirect(`${origin}/shop-profile`);
        }

        // PKCE confirmation templates converge through the same verified,
        // session-derived pending-dealer boundary as token_hash templates.
        // No browser-supplied user id, dealer id, approval status, or role is
        // accepted; the action reads identity only from the exchanged session.
        const dealer = await createPendingDealer();
        if (dealer.kind === "created" || dealer.kind === "already-exists") {
          return NextResponse.redirect(`${origin}/signup/pending?confirm=0`);
        }
        if (dealer.kind === "not-dealer-signup") {
          // Verified non-dealer auth (magic link, email change) — go to home.
          return NextResponse.redirect(origin);
        }
        // Verified dealer signup whose pending row could not be converged.
        // Stay on the approval-wait surface with an explicit setup notice; do
        // not drop a freshly verified applicant on the home or login screen.
        return NextResponse.redirect(`${origin}/signup/pending?confirm=0&setup_error=1`);
      }

      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    } catch (err) {
      console.error("[auth/callback] unexpected error:", err);
    }
  }

  // Fallback — send to login with a non-secret error flag. /login renders it as
  // an authentication-link notice, never as a wrong-credentials message.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
