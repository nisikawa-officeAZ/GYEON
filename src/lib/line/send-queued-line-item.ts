// Phase 4 Sprint 3 — Shared per-item LINE send logic for the notification queue.
//
// Sends ONE queue item via the LINE push API using a caller-supplied access token,
// writes the message log, and updates the queue row's status (sent / failed) with
// attempts + last_attempt_at. Plain internal helper (not a Server Action): it takes
// the Supabase client + a TRUSTED server-side dealer_id + the dealer's access token,
// so both the dealer-scoped (session-client) and cron (admin-client) processors reuse
// it. dealer_id and the access token are NEVER client-sourced.
//
// Retry-safe: the caller only feeds status="scheduled" items; this helper marks each
// item "processing" then a terminal "sent"/"failed", so a re-run never double-sends a
// completed item.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPendingLog, markLogSent, markLogFailed } from "./create-line-message-log";
import { LineNotificationQueueDB } from "./line-message-types";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type QueuedLineItem = LineNotificationQueueDB & {
  line_customers: { line_user_id: string } | null;
};

export type SendOutcome = "sent" | "failed";

export async function sendQueuedLineItem(
  supabase: SupabaseClient,
  dealerId: string,
  accessToken: string,
  item: QueuedLineItem,
  now: string,
): Promise<{ outcome: SendOutcome; error?: string }> {
  const lineUserId = item.line_customers?.line_user_id;
  if (!lineUserId) {
    await supabase
      .from("line_notification_queue")
      .update({
        status:          "failed",
        error_message:   "LINE user_id が見つかりません",
        attempts:        item.attempts + 1,
        last_attempt_at: now,
        updated_at:      now,
      })
      .eq("id",        item.id)
      .eq("dealer_id", dealerId);
    return { outcome: "failed", error: "LINE user_id missing" };
  }

  // Atomically claim the item (only if still "scheduled") so two concurrent processors
  // cannot both send it. If no row is claimed, another processor already took it — skip.
  const { data: claimed } = await supabase
    .from("line_notification_queue")
    .update({ status: "processing", updated_at: now })
    .eq("id",        item.id)
    .eq("dealer_id", dealerId)
    .eq("status",    "scheduled")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { outcome: "failed", error: "別プロセスが処理中のため送信をスキップしました" };
  }

  const logId = await createPendingLog(supabase, dealerId, {
    customer_id:      item.customer_id,
    line_customer_id: item.line_customer_id,
    line_user_id:     lineUserId,
    message_type:     item.message_type,
    purpose:          item.purpose,
    title:            item.title,
    body:             item.body,
    payload:          item.payload,
  });

  const messages = item.payload?.messages ?? [{ type: "text", text: item.body }];

  let pushRes: Response;
  try {
    pushRes = await fetch(LINE_PUSH_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });
  } catch (err) {
    const errMsg = `LINE送信ネットワークエラー: ${String(err)}`;
    if (logId) await markLogFailed(supabase, logId, dealerId, errMsg);
    await supabase
      .from("line_notification_queue")
      .update({
        status:          "failed",
        attempts:        item.attempts + 1,
        last_attempt_at: now,
        error_message:   errMsg,
        sent_log_id:     logId ?? null,
        updated_at:      now,
      })
      .eq("id",        item.id)
      .eq("dealer_id", dealerId);
    return { outcome: "failed", error: errMsg };
  }

  if (pushRes.ok) {
    if (logId) await markLogSent(supabase, logId, dealerId);
    await supabase
      .from("line_notification_queue")
      .update({
        status:          "sent",
        attempts:        item.attempts + 1,
        last_attempt_at: now,
        sent_log_id:     logId ?? null,
        updated_at:      now,
      })
      .eq("id",        item.id)
      .eq("dealer_id", dealerId);
    return { outcome: "sent" };
  }

  const errJson = await pushRes.json().catch(() => ({}));
  const errMsg  = (errJson as { message?: string }).message ?? pushRes.statusText;
  if (logId) await markLogFailed(supabase, logId, dealerId, errMsg);
  await supabase
    .from("line_notification_queue")
    .update({
      status:          "failed",
      attempts:        item.attempts + 1,
      last_attempt_at: now,
      error_message:   errMsg,
      sent_log_id:     logId ?? null,
      updated_at:      now,
    })
    .eq("id",        item.id)
    .eq("dealer_id", dealerId);
  return { outcome: "failed", error: errMsg };
}
