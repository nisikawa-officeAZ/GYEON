"use server";

// DealerOS — Queue a maintenance reminder to LINE notification queue (PHASE48)
// Manual queue: registers one reminder's message to line_notification_queue.
// Does NOT send immediately — relies on processLineNotificationQueue.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export async function queueMaintenanceReminder(
  reminderId: string
): Promise<{ error: string } | { success: true; queueId: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const did = dealer.dealer_id;

  // Fetch reminder + line_customer
  const { data: reminder } = await supabase
    .from("maintenance_reminders")
    .select(`
      id, dealer_id, customer_id, status,
      scheduled_send_at, message_title, message_body, reminder_type,
      customers ( line_connected, line_user_id )
    `)
    .eq("id", reminderId)
    .eq("dealer_id", did)
    .maybeSingle();

  if (!reminder) return { error: "リマインダーが見つかりません" };

  const cust = reminder.customers as unknown as {
    line_connected: boolean;
    line_user_id: string | null;
  } | null;

  if (!cust?.line_connected || !cust?.line_user_id) {
    return { error: "顧客のLINE連携がありません。先にLINE連携を行ってください。" };
  }

  // Fetch line_customer id
  const { data: lc } = await supabase
    .from("line_customers")
    .select("id")
    .eq("dealer_id", did)
    .eq("customer_id", reminder.customer_id as string)
    .eq("is_friend", true)
    .maybeSingle();

  const scheduledAt = (reminder.scheduled_send_at as string | null)
    ?? new Date().toISOString();

  const body = (reminder.message_body as string | null)
    ?? (reminder.message_title as string | null)
    ?? "メンテナンス通知";

  const now = new Date().toISOString();

  // Insert into line_notification_queue
  const { data: queueItem, error: qErr } = await supabase
    .from("line_notification_queue")
    .insert({
      dealer_id:        did,
      customer_id:      reminder.customer_id,
      line_customer_id: lc?.id ?? null,
      scheduled_at:     scheduledAt,
      message_type:     "text",
      purpose:          "maintenance_reminder",
      title:            reminder.message_title ?? "メンテナンス通知",
      body,
      payload: {
        messages: [{ type: "text", text: body }],
        reminder_id: reminderId,
      },
      status:    "scheduled",
      attempts:  0,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (qErr) {
    console.error("queueMaintenanceReminder queue error:", qErr);
    return { error: qErr.message };
  }

  const queueId = queueItem.id as string;

  // Update reminder: status = queued, line_queue_id
  await supabase
    .from("maintenance_reminders")
    .update({
      status:        "queued",
      line_queue_id: queueId,
      updated_at:    now,
    })
    .eq("id", reminderId)
    .eq("dealer_id", did);

  return { success: true, queueId };
}
