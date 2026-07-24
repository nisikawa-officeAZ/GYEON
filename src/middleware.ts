// Authentication middleware — protects all app routes.
// Unauthenticated requests are redirected to /login.
// Public paths (login, signup, password reset, LIFF, API) bypass this check.
// Dealer membership is NOT checked here (requires DB — too expensive per-request).
// Pages that require a dealer do their own check and redirect to /no-dealer.

import { createServerClient } from "@supabase/ssr";
import { NextResponse }        from "next/server";
import type { NextRequest }    from "next/server";

// Path prefixes accessible without a Supabase session
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",            // Supabase email confirm/recovery routes (e.g. /auth/confirm)
  "/no-dealer",
  "/liff",
  "/api",
  "/s/e",             // R92B: public estimate-share landing + file (token-gated in-route)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth check
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublic) return NextResponse.next();

  // Build response we can attach refreshed session cookies to. Forward the current internal path via
  // `x-pathname` so downstream Server Component guards (e.g. the admin layout) can preserve the
  // destination as `?next=` when THEY redirect an authenticated-but-unauthorized user to /login.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname + request.nextUrl.search);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Vercel PREVIEW only: keep refreshed auth cookies SameSite=None; Secure so
  // they survive Deployment Protection (SSO). Must match client/server clients
  // so a middleware refresh doesn't downgrade the cookie to Lax. Prod: default.
  const isPreview = process.env.VERCEL_ENV === "preview";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(isPreview
      ? { cookieOptions: { sameSite: "none" as const, secure: true } }
      : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Preserve the original destination so login can return the user to where they were.
    // `next` carries the internal path+query only; the login page sanitizes it (no open redirect).
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.headers.set("Cache-Control", "no-store"); // never cache the auth redirect
    return redirectRes;
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|workbox|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
