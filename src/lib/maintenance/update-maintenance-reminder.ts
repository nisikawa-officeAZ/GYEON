"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { MaintenanceReminderUpdateInput, MaintenanceReminderDB } from "./maintenance-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function updateMaintenanceReminder(
  id: string,
  input: MaintenanceReminderUpdateInput
): Promise<{ error: string } | { success: true; data: MaintenanceReminderDB }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Build update payload — only include provided fields
  const update: Record<string, unknown> = { updated_at: now };
  if (input.title             !== undefined) update.title             = input.title;
  if (input.reminder_type     !== undefined) update.reminder_type     = input.reminder_type;
  if (input.status            !== undefined) update.status            = input.status;
  if (input.due_date          !== undefined) update.due_date          = input.due_date;
  if (input.scheduled_send_at !== undefined) update.scheduled_send_at = input.scheduled_send_at;
  if (input.message_title     !== undefined) update.message_title     = input.message_title;
  if (input.message_body      !== undefined) update.message_body      = input.message_body;
  if (input.notes             !== undefined) update.notes             = input.notes;
  if (input.internal_memo     !== undefined) update.internal_memo     = input.internal_memo;

  const { data, error } = await supabase
    .from("maintenance_reminders")
    .update(update)
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)    // Ownership gate — never trust client dealer_id
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, grade, plate_number ),
      work_orders ( work_order_number, title, status )
    `)
    .single();

  if (error) {
    console.error("updateMaintenanceReminder error:", error);
    return { error: error.message };
  }

  return { success: true, data: data as unknown as MaintenanceReminderDB };
}

export async function updateMaintenanceReminderFromFormData(
  id: string,
  fd: FormData
): Promise<{ error: string } | { success: true; data: MaintenanceReminderDB }> {
  return updateMaintenanceReminder(id, {
    title:             (fd.get("title")             as string | null) || null,
    reminder_type:     fd.get("reminder_type")      as import("./maintenance-types").MaintenanceReminderType,
    status:            fd.get("status")             as import("./maintenance-types").MaintenanceReminderStatus,
    due_date:          (fd.get("due_date")          as string | null) || null,
    scheduled_send_at: (fd.get("scheduled_send_at") as string | null) || null,
    message_title:     (fd.get("message_title")     as string | null) || null,
    message_body:      (fd.get("message_body")      as string | null) || null,
    notes:             (fd.get("notes")             as string | null) || null,
    internal_memo:     (fd.get("internal_memo")     as string | null) || null,
  });
}
