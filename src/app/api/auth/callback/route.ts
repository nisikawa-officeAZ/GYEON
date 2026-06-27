// Supabase Auth callback — handles email magic links, password reset, etc.
// Supabase redirects to this endpoint after the user clicks an auth email link.
// The endpoint exchanges the one-time code for a session, then redirects the
// user to the appropriate page.

import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";

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
        if (type === "recovery") {
          // Password reset — send to the reset form
          return NextResponse.redirect(`${origin}/reset-password`);
        }
        // Email confirmation or other auth — go to home
        return NextResponse.redirect(origin);
      }

      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    } catch (err) {
      console.error("[auth/callback] unexpected error:", err);
    }
  }

  // Fallback — send to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
