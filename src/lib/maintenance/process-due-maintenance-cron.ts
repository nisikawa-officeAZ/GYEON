// Phase 4 Sprint 2 — Cron-safe due-maintenance processor (all dealers).
//
// Invoked only by the secret-guarded cron route (server-side); NOT a client-callable
// action. A scheduled job has no user/dealer session, so this uses the service-role
// admin client and carries dealer_id from each TRUSTED DB ROW (never from client).
// RLS remains enabled on the tables; this is the guarded server-only cron path, and
// every write is explicitly scoped by the row's dealer_id.
//
// Creates queue-READY records only — does NOT send LINE messages. Idempotent via the
// shared helper (skips reminders already linked to a queue item).

import { createAdminClient } from "@/lib/supabase/admin";
import { queueDueReminderToLine, type DueReminderRow } from "./queue-due-reminder";
import type { ProcessRemindersResult } from "./process-due-maintenance-reminders";

export async function processDueMaintenanceRemindersForCron(): Promise<ProcessRemindersResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const result: ProcessRemindersResult = {
    processed: 0, queued: 0, failed: 0, skipped: 0, errors: [],
  };

  // Due reminders across ALL dealers (status scheduled, scheduled_send_at <= now).
  const { data: reminders, error } = await supabase
    .from("maintenance_reminders")
    .select(`
      id, dealer_id, customer_id, line_queue_id, scheduled_send_at, message_title, message_body, reminder_type,
      customers ( line_connected, line_user_id )
    `)
    .eq("status", "scheduled")
    .lte("scheduled_send_at", now)
    .order("scheduled_send_at", { ascending: true })
    .limit(500);

  if (error) {
    result.errors.push(error.message);
    return result;
  }
  if (!reminders || reminders.length === 0) return result;

  for (const raw of reminders) {
    const row = raw as unknown as DueReminderRow & { dealer_id: string };
    result.processed++;
    try {
      // dealer_id comes from the trusted DB row (server-side), never from a client.
      const outcome = await queueDueReminderToLine(supabase, row.dealer_id, row, now);
      if (outcome === "queued")       result.queued++;
      else if (outcome === "skipped") result.skipped++;
      else {
        result.failed++;
        result.errors.push(`Reminder ${row.id}: not queued (LINE未連携 or insert failed)`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Reminder ${row.id}: ${String(err)}`);
    }
  }

  return result;
}
