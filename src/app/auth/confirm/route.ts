// Supabase Auth email confirmation (token_hash / OTP flow).
// Supabase's SSR email templates link to `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…`.
// This route verifies the one-time token, which sets the session cookie, then
// redirects to the appropriate page (the reset form for password recovery).
//
// Complements /api/auth/callback (the PKCE "code" flow). Having both means the
// reset/confirmation link works regardless of which email-template style the
// Supabase project uses.

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse }      from "next/server";
import { createClient }      from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next");

  if (token_hash && type) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });

      if (!error) {
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
        return NextResponse.redirect(`${origin}${next ?? "/"}`);
      }

      console.error("[auth/confirm] verifyOtp error:", error.message);
    } catch (err) {
      console.error("[auth/confirm] unexpected error:", err);
    }
  }

  // Fallback — send to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}
