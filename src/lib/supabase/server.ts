// Supabase server client — not connected yet.
// Credentials will be configured when Supabase integration is approved by CTO.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  // Vercel PREVIEW only: write refreshed auth cookies as SameSite=None; Secure
  // so they survive the Deployment Protection (SSO) browsing context. Must match
  // the browser client so a refresh doesn't downgrade the cookie back to Lax.
  // Production/localhost keep the default (Lax).
  const isPreview = process.env.VERCEL_ENV === "preview";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(isPreview
      ? { cookieOptions: { sameSite: "none" as const, secure: true } }
      : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}
