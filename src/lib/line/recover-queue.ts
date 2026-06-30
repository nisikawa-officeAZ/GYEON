// Phase 5 Sprint 1 — LINE notification queue recovery (retry + stuck reaper).
//
// Reuses EXISTING line_notification_queue fields only (status, attempts,
// last_attempt_at, updated_at) — no schema change. Both operations simply reset
// eligible rows back to "scheduled" so the existing credential-gated processor
// re-picks them; dealer_id on each row is preserved (never client-sourced).
//
// - Reaper: a row claimed to "processing" that never reached a terminal state (e.g. a
//   crashed processor) is reset after PROCESSING_TIMEOUT. The claim sets updated_at, so
//   the reaper keys on updated_at (last_attempt_at can be null on a first-attempt stall).
// - Retry: a "failed" row under the attempts cap is re-queued after a backoff window,
//   keyed on last_attempt_at (always set when a send fails).

import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_LINE_SEND_ATTEMPTS    = 3;   // total send attempts before giving up
export const RETRY_BACKOFF_MINUTES     = 10;  // wait before retrying a failed item
export const PROCESSING_TIMEOUT_MINUTES = 15; // stuck-"processing" reaper threshold

export interface RecoveryResult {
  reaped:   number;  // stuck "processing" rows reset to "scheduled"
  requeued: number;  // retryable "failed" rows reset to "scheduled"
}

export async function recoverStalledQueueItems(
  supabase: SupabaseClient,
  now: string,
): Promise<RecoveryResult> {
  const nowMs            = new Date(now).getTime();
  const processingCutoff = new Date(nowMs - PROCESSING_TIMEOUT_MINUTES * 60_000).toISOString();
  const retryCutoff      = new Date(nowMs - RETRY_BACKOFF_MINUTES      * 60_000).toISOString();

  // Reaper — reset items stuck in "processing" past the timeout (keyed on updated_at,
  // which the atomic claim sets) back to "scheduled".
  const { data: reaped } = await supabase
    .from("line_notification_queue")
    .update({ status: "scheduled", updated_at: now })
    .eq("status", "processing")
    .lt("updated_at", processingCutoff)
    .select("id");

  // Retry — requeue "failed" items still under the attempts cap, after the backoff window.
  const { data: requeued } = await supabase
    .from("line_notification_queue")
    .update({ status: "scheduled", updated_at: now })
    .eq("status", "failed")
    .lt("attempts", MAX_LINE_SEND_ATTEMPTS)
    .lt("last_attempt_at", retryCutoff)
    .select("id");

  return { reaped: reaped?.length ?? 0, requeued: requeued?.length ?? 0 };
}
