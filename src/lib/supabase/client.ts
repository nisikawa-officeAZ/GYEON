// Supabase client — not connected yet.
// Credentials will be configured when Supabase integration is approved by CTO.

import { createBrowserClient } from "@supabase/ssr";

export function createClient(options?: { rememberMe?: boolean }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  // "Remember me": when enabled, persist the auth cookies across browser
  // restarts (~400 days — the browser cap). When omitted/false, the default
  // session behavior is used (no change to existing callers).
  const browserOptions = options?.rememberMe
    ? { cookieOptions: { maxAge: 60 * 60 * 24 * 400 } }
    : undefined;

  return createBrowserClient(supabaseUrl, supabaseAnonKey, browserOptions);
}
