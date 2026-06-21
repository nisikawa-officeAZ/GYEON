"use server";

// DealerOS — Process due maintenance reminders (PHASE48)
//
// Manual server action — NOT auto-executed via cron (PHASE48 scope).
// Finds all scheduled reminders with scheduled_send_at <= now(),
// checks LINE connection, and queues them.
//
// LINE未連携 → status = failed, notes に理由を追記

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export interface ProcessRemindersResult {
  processed: number;
  queued:    number;
  failed:    number;
  skipped:   number;
  errors:    string[];
}

export async function processDueMaintenanceReminders(): Promise<
  { error: string } | ProcessRemindersResult
> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const did = dealer.dealer_id;
  const now = new Date().toISOString();

  // Fetch due reminders (scheduled_send_at <= now, status = scheduled)
  const { data: reminders, error: fetchErr } = await supabase
    .from("maintenance_reminders")
    .select(`
      id, customer_id, scheduled_send_at, message_title, message_body, reminder_type,
      customers ( line_connected, line_user_id )
    `)
    .eq("dealer_id", did)
    .eq("status", "scheduled")
    .lte("scheduled_send_at", now)
    .order("scheduled_send_at", { ascending: true })
    .limit(100);

  if (fetchErr) return { error: fetchErr.message };
  if (!reminders || reminders.length === 0) {
    return { processed: 0, queued: 0, failed: 0, skipped: 0, errors: [] };
  }

  const result: ProcessRemindersResult = {
    processed: 0, queued: 0, failed: 0, skipped: 0, errors: [],
  };

  for (const raw of reminders) {
    const r = raw as unknown as {
      id: string;
      customer_id: string;
      scheduled_send_at: string | null;
      message_title: string | null;
      message_body:  string | null;
      reminder_type: string;
      customers: { line_connected: boolean; line_user_id: string | null } | null;
    };

    const cust = r.customers;

    // LINE未連携 → failed
    if (!cust?.line_connected || !cust?.line_user_id) {
      await supabase
        .from("maintenance_reminders")
        .update({
          status:     "failed",
          notes:      "LINE未連携のため送信不可。顧客のLINE連携後に再設定してください。",
          updated_at: now,
        })
        .eq("id", r.id)
        .eq("dealer_id", did);
      result.failed++;
      result.processed++;
      result.errors.push(`Reminder ${r.id}: LINE未連携`);
      continue;
    }

    // Fetch line_customer id
    const { data: lc } = await supabase
      .from("line_customers")
      .select("id")
      .eq("dealer_id", did)
      .eq("customer_id", r.customer_id)
      .eq("is_friend", true)
      .maybeSingle();

    const body = r.message_body ?? r.message_title ?? "メンテナンス通知";

    // Insert into queue
    const { data: queueItem, error: qErr } = await supabase
      .from("line_notification_queue")
      .insert({
        dealer_id:        did,
        customer_id:      r.customer_id,
        line_customer_id: lc?.id ?? null,
        scheduled_at:     r.scheduled_send_at ?? now,
        message_type:     "text",
        purpose:          "maintenance_reminder",
        title:            r.message_title ?? "メンテナンス通知",
        body,
        payload: {
          messages:    [{ type: "text", text: body }],
          reminder_id: r.id,
        },
        status:     "scheduled",
        attempts:   0,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (qErr) {
      result.errors.push(`Reminder ${r.id}: queue insert failed - ${qErr.message}`);
      result.failed++;
      result.processed++;
      continue;
    }

    // Update reminder to queued
    await supabase
      .from("maintenance_reminders")
      .update({
        status:        "queued",
        line_queue_id: queueItem.id,
        updated_at:    now,
      })
      .eq("id", r.id)
      .eq("dealer_id", did);

    result.queued++;
    result.processed++;
  }

  return result;
}
