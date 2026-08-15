// Supabase client — not connected yet.
// Credentials will be configured when Supabase integration is approved by CTO.

import { createBrowserClient } from "@supabase/ssr";

export function createClient(options?: { rememberMe?: boolean }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  // Build cookie options.
  const cookieOptions: {
    maxAge?: number;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  } = {};

  // "Remember me": persist the auth cookies across browser restarts (~400 days).
  if (options?.rememberMe) cookieOptions.maxAge = 60 * 60 * 24 * 400;

  // Vercel PREVIEW only: Deployment Protection (SSO) mediates the browsing
  // context, so the browser withholds SameSite=Lax cookies from requests to the
  // deployment (only Vercel's SameSite=None _vercel_jwt is sent). Write the auth
  // cookie as SameSite=None; Secure on previews so the session reaches the
  // server. Production/localhost keep the default (Lax) — no global change.
  // Robust detection: trust NEXT_PUBLIC_VERCEL_ENV when present, else fall back
  // to the *.vercel.app host (a preview host) unless explicitly production.
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const onVercelPreview =
    vercelEnv === "preview" ||
    (vercelEnv !== "production" &&
      typeof window !== "undefined" &&
      window.location.hostname.endsWith(".vercel.app"));
  if (onVercelPreview) {
    cookieOptions.sameSite = "none";
    cookieOptions.secure = true;
  }

  const browserOptions =
    Object.keys(cookieOptions).length > 0 ? { cookieOptions } : undefined;

  return createBrowserClient(supabaseUrl, supabaseAnonKey, browserOptions);
}
