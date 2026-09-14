// Request-scoped Supabase client for Server Components, Actions and Route Handlers.

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
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          // Next 15 rejects writes while rendering a Server Component. Middleware
          // owns refresh persistence there. Actions/Route Handlers still write
          // normally; never hide a different storage/programming failure.
          if (!(error instanceof Error) || error.message !==
            "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options") {
            throw error;
          }
        }
      },
    },
  });
}
