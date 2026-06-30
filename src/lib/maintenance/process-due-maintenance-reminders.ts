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
import { queueDueReminderToLine, type DueReminderRow } from "./queue-due-reminder";

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

  // Fetch due reminders (scheduled_send_at <= now, status = scheduled).
  // line_queue_id is selected so the shared helper can skip already-queued reminders
  // (idempotency / duplicate-queue prevention).
  const { data: reminders, error: fetchErr } = await supabase
    .from("maintenance_reminders")
    .select(`
      id, customer_id, line_queue_id, scheduled_send_at, message_title, message_body, reminder_type,
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
    const r = raw as unknown as DueReminderRow;
    result.processed++;
    try {
      const outcome = await queueDueReminderToLine(supabase, did, r, now);
      if (outcome === "queued")       result.queued++;
      else if (outcome === "skipped") result.skipped++;
      else {
        result.failed++;
        result.errors.push(`Reminder ${r.id}: not queued (LINE未連携 or insert failed)`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Reminder ${r.id}: ${String(err)}`);
    }
  }

  return result;
}
