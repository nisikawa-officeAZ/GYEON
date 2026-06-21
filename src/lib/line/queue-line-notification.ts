"use server";

// DealerOS — Queue LINE Notification (PHASE47)
// Creates a scheduled notification in line_notification_queue.
// Used for maintenance reminders, reservation notices, campaigns.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineQueueInput } from "./line-message-types";

export async function queueLineNotification(
  input: LineQueueInput
): Promise<{ error: string } | { success: true; id: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("line_notification_queue")
    .insert({
      dealer_id:        dealer.dealer_id,
      customer_id:      input.customer_id      ?? null,
      line_customer_id: input.line_customer_id ?? null,
      scheduled_at:     input.scheduled_at,
      message_type:     input.message_type     ?? "text",
      purpose:          input.purpose,
      title:            input.title            ?? null,
      body:             input.body,
      payload:          input.payload          ?? null,
      status:           "scheduled",
      attempts:         0,
      created_at:       now,
      updated_at:       now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("queueLineNotification error:", error);
    return { error: error.message };
  }

  return { success: true, id: data.id as string };
}

export async function cancelQueuedNotification(
  queueId: string
): Promise<{ error: string } | { success: true }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("line_notification_queue")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", queueId)
    .eq("dealer_id", dealer.dealer_id)
    .eq("status", "scheduled");  // Only cancel if still scheduled

  if (error) return { error: error.message };
  return { success: true };
}
