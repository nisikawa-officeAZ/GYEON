"use server";

// DealerOS — Process LINE Notification Queue (PHASE47)
//
// Manual server action — NOT auto-executed via cron (PHASE47 scope).
// Call from admin action or future PHASE cron job.
//
// Finds scheduled queue items with scheduled_at <= now(),
// sends LINE push messages, and updates status + log.

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createPendingLog, markLogSent, markLogFailed } from "./create-line-message-log";
import { LineNotificationQueueDB } from "./line-message-types";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export interface ProcessQueueResult {
  processed: number;
  sent:      number;
  failed:    number;
  errors:    string[];
}

// ─── Process queue for the current dealer (authenticated) ────────────────────

export async function processLineNotificationQueue(): Promise<
  { error: string } | ProcessQueueResult
> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const service  = getServiceClient();
  const did      = dealer.dealer_id;
  const now      = new Date().toISOString();

  // Fetch dealer access token
  const { data: settings } = await supabase
    .from("dealer_settings")
    .select("line_access_token, line_enabled")
    .eq("dealer_id", did)
    .maybeSingle();

  if (!settings?.line_enabled || !settings.line_access_token) {
    return { error: "LINE連携が無効またはアクセストークン未設定です" };
  }

  const accessToken = settings.line_access_token as string;

  // Fetch due scheduled items
  const { data: items, error: fetchErr } = await supabase
    .from("line_notification_queue")
    .select(`
      id, dealer_id, customer_id, line_customer_id,
      scheduled_at, message_type, purpose, title, body, payload,
      status, attempts,
      line_customers ( line_user_id )
    `)
    .eq("dealer_id", did)
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (fetchErr) return { error: fetchErr.message };
  if (!items || items.length === 0) {
    return { processed: 0, sent: 0, failed: 0, errors: [] };
  }

  const result: ProcessQueueResult = { processed: 0, sent: 0, failed: 0, errors: [] };

  for (const raw of items) {
    const item = raw as unknown as LineNotificationQueueDB & {
      line_customers: { line_user_id: string } | null;
    };

    const lineUserId = item.line_customers?.line_user_id;
    if (!lineUserId) {
      await service
        .from("line_notification_queue")
        .update({
          status:        "failed",
          error_message: "LINE user_id が見つかりません",
          attempts:      item.attempts + 1,
          last_attempt_at: now,
          updated_at:    now,
        })
        .eq("id", item.id)
        .eq("dealer_id", did);
      result.processed++;
      result.failed++;
      result.errors.push(`Queue ${item.id}: LINE user_id missing`);
      continue;
    }

    // Mark as processing
    await supabase
      .from("line_notification_queue")
      .update({ status: "processing", updated_at: now })
      .eq("id", item.id)
      .eq("dealer_id", did);

    // Create pending log
    const logId = await createPendingLog(supabase, did, {
      customer_id:      item.customer_id,
      line_customer_id: item.line_customer_id,
      line_user_id:     lineUserId,
      message_type:     item.message_type,
      purpose:          item.purpose,
      title:            item.title,
      body:             item.body,
      payload:          item.payload,
    });

    // Send LINE push
    const messages = item.payload?.messages ?? [{ type: "text", text: item.body }];
    const pushRes = await fetch(LINE_PUSH_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });

    if (pushRes.ok) {
      if (logId) await markLogSent(supabase, logId, did);
      await supabase
        .from("line_notification_queue")
        .update({
          status:          "sent",
          attempts:        item.attempts + 1,
          last_attempt_at: now,
          sent_log_id:     logId ?? null,
          updated_at:      now,
        })
        .eq("id", item.id)
        .eq("dealer_id", did);
      result.sent++;
    } else {
      const errJson = await pushRes.json().catch(() => ({}));
      const errMsg  = (errJson as { message?: string }).message ?? pushRes.statusText;
      if (logId) await markLogFailed(supabase, logId, did, errMsg);
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
        .eq("id", item.id)
        .eq("dealer_id", did);
      result.failed++;
      result.errors.push(`Queue ${item.id}: ${errMsg}`);
    }

    result.processed++;
  }

  return result;
}
