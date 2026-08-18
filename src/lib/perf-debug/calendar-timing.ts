// TEMPORARY — CALENDAR_PERF_C4 diagnostic instrumentation only.
//
// Source-only console.log timing markers for the calendar month-view settle
// path, added to get exact durations from the app itself instead of
// browser-automation timing (proven unreliable for sub-15s windows in
// CALENDAR_PERF_C3_PUSH_MEASUREMENT_RESULT_V1). No migration, no RPC, no
// Supabase/DB access, no secrets/cookies/tokens ever logged — only labels,
// counters, and millisecond durations.
//
// Disabled entirely on production (server via VERCEL_ENV, client via the
// NEXT_PUBLIC_-prefixed twin — the same split already used by
// src/lib/supabase/client.ts / server.ts and src/middleware.ts). Active on
// Preview and local dev. Safe and trivial to delete once the root cause of
// the calendar settle time is found — every call site is tagged PERF-C4.

const SERVER_ENABLED = process.env.VERCEL_ENV !== "production";
const CLIENT_ENABLED = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function perfLogServer(label: string, data?: Record<string, unknown>): void {
  if (!SERVER_ENABLED) return;
  console.log(`[PERF-C4][server] ${label}`, data ? JSON.stringify(data) : "");
}

export function perfLogClient(label: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !CLIENT_ENABLED) return;
  console.log(`[PERF-C4][client] ${label}`, data ? JSON.stringify(data) : "");
}
