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
  "/no-dealer",
  "/liff",
  "/api",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth check
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublic) return NextResponse.next();

  // Build response we can attach refreshed session cookies to
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|workbox|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
