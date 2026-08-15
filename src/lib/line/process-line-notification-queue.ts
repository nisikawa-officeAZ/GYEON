"use server";

// DealerOS — Process LINE Notification Queue (PHASE47)
//
// Manual server action — NOT auto-executed via cron (PHASE47 scope).
// Call from admin action or future PHASE cron job.
//
// Finds scheduled queue items with scheduled_at <= now(),
// sends LINE push messages, and updates status + log.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { sendQueuedLineItem, type QueuedLineItem } from "./send-queued-line-item";

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
    const item = raw as unknown as QueuedLineItem;
    result.processed++;
    try {
      const { outcome, error } = await sendQueuedLineItem(supabase, did, accessToken, item, now);
      if (outcome === "sent") result.sent++;
      else {
        result.failed++;
        if (error) result.errors.push(`Queue ${item.id}: ${error}`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Queue ${item.id}: ${String(err)}`);
    }
  }

  return result;
}
