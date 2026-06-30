// Phase 4 Sprint 2 — Shared per-reminder queueing logic for due maintenance reminders.
//
// Creates a queue-READY record in line_notification_queue (status "scheduled") and
// advances the reminder to "queued" + line_queue_id. It does NOT send any LINE
// message (sending is a later sprint).
//
// Idempotent: a reminder already linked to a queue item (line_queue_id set) is
// skipped, so re-running the processor never creates a duplicate queue item for the
// same reminder.
//
// Plain internal helper (not a Server Action): it takes the Supabase client + a
// trusted server-side dealer_id, so both the dealer-scoped (session-client) and the
// cron (admin-client) processors can reuse it. dealer_id is NEVER client-sourced.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DueReminderRow {
  id:                string;
  customer_id:       string;
  line_queue_id:     string | null;
  scheduled_send_at: string | null;
  message_title:     string | null;
  message_body:      string | null;
  customers:         { line_connected: boolean; line_user_id: string | null } | null;
}

export type QueueOutcome = "queued" | "failed" | "skipped";

export async function queueDueReminderToLine(
  supabase: SupabaseClient,
  dealerId: string,
  r: DueReminderRow,
  now: string,
): Promise<QueueOutcome> {
  // Idempotency / duplicate prevention: already linked to a queue item → skip.
  if (r.line_queue_id) return "skipped";

  const cust = r.customers;
  if (!cust?.line_connected || !cust?.line_user_id) {
    await supabase
      .from("maintenance_reminders")
      .update({
        status:     "failed",
        notes:      "LINE未連携のため送信不可。顧客のLINE連携後に再設定してください。",
        updated_at: now,
      })
      .eq("id",        r.id)
      .eq("dealer_id", dealerId);
    return "failed";
  }

  const { data: lc } = await supabase
    .from("line_customers")
    .select("id")
    .eq("dealer_id",   dealerId)
    .eq("customer_id", r.customer_id)
    .eq("is_friend",   true)
    .maybeSingle();

  const body = r.message_body ?? r.message_title ?? "メンテナンス通知";

  // Create a queue-READY record (NOT sent here).
  const { data: queueItem, error: qErr } = await supabase
    .from("line_notification_queue")
    .insert({
      dealer_id:        dealerId,
      customer_id:      r.customer_id,
      line_customer_id: lc?.id ?? null,
      scheduled_at:     r.scheduled_send_at ?? now,
      message_type:     "text",
      purpose:          "maintenance_reminder",
      title:            r.message_title ?? "メンテナンス通知",
      body,
      payload:          { messages: [{ type: "text", text: body }], reminder_id: r.id },
      status:           "scheduled",
      attempts:         0,
      created_at:       now,
      updated_at:       now,
    })
    .select("id")
    .single();

  if (qErr || !queueItem) return "failed";

  await supabase
    .from("maintenance_reminders")
    .update({ status: "queued", line_queue_id: queueItem.id, updated_at: now })
    .eq("id",        r.id)
    .eq("dealer_id", dealerId);

  return "queued";
}
