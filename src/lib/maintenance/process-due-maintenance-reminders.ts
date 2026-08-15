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
import { createEngagementEvent } from "@/lib/customer-engagement/context";
import { EngagementWorkflowRuntime } from "@/lib/customer-engagement/engine/runtime";

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
      id, customer_id, vehicle_id, due_date, line_queue_id, scheduled_send_at, message_title, message_body, reminder_type,
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
    const r = raw as unknown as DueReminderRow & {
      vehicle_id: string | null; due_date: string | null; reminder_type: string;
    };
    result.processed++;
    try {
      const outcome = await queueDueReminderToLine(supabase, did, r, now);
      if (outcome === "queued") {
        result.queued++;
        // Phase 4 Sprint 5 — emit MAINTENANCE_DUE for the maintenance engagement flow.
        // The flow's LINE message is cross-deduped against this reminder's just-queued
        // item (payload.reminder_id === job_id), so it never double-sends.
        const dueDate = r.due_date ?? now.slice(0, 10);
        const overdueDays = Math.max(
          0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000),
        );
        const event = await createEngagementEvent(
          "MAINTENANCE_DUE",
          r.customer_id,
          {
            maintenance_id: r.id,
            due_date:       dueDate,
            service_type:   r.reminder_type ?? "maintenance",
            overdue_days:   overdueDays,
          },
          { vehicle_id: r.vehicle_id ?? undefined, job_id: r.id },
        );
        if (event) await new EngagementWorkflowRuntime().dispatch(event);
      }
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
