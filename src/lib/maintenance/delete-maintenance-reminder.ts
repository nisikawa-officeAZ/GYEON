"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function deleteMaintenanceReminder(
  id: string
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Fetch to check ownership and get line_queue_id
  const { data: reminder } = await supabase
    .from("maintenance_reminders")
    .select("id, dealer_id, line_queue_id, status")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!reminder) return { error: "リマインダーが見つかりません" };

  // If linked to a queue entry, cancel it first
  if (reminder.line_queue_id) {
    await supabase
      .from("line_notification_queue")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", reminder.line_queue_id)
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "scheduled");  // Only cancel if still scheduled
  }

  const { error } = await supabase
    .from("maintenance_reminders")
    .delete()
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("deleteMaintenanceReminder error:", error);
    return { error: error.message };
  }

  return { success: true };
}
