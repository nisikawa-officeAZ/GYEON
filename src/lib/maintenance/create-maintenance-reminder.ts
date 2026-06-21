"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  MaintenanceReminderInput,
  MaintenanceReminderDB,
  defaultMaintenanceMessage,
  maintenanceVehicleLabel,
} from "./maintenance-types";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";

function scheduledSendAtFromDueDate(dueDate: string): string {
  // Default: 7 days before due_date at 10:00
  const d = new Date(dueDate);
  d.setDate(d.getDate() - 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export async function createMaintenanceReminder(
  input: MaintenanceReminderInput
): Promise<{ error: string } | { success: true; data: MaintenanceReminderDB }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const did = dealer.dealer_id;

  // Validate customer ownership
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", input.customer_id)
    .eq("dealer_id", did)
    .maybeSingle();
  if (!customer) return { error: "顧客が見つかりません" };

  // Validate vehicle ownership (optional)
  if (input.vehicle_id) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", input.vehicle_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!vehicle) return { error: "車両が見つかりません" };
  }

  // Validate work_order ownership (optional)
  if (input.work_order_id) {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id")
      .eq("id", input.work_order_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!wo) return { error: "作業指示書が見つかりません" };
  }

  // Build scheduled_send_at
  const scheduledSendAt = input.scheduled_send_at
    ?? (input.due_date ? scheduledSendAtFromDueDate(input.due_date) : null);

  // Default message if not provided
  const reminderType = input.reminder_type ?? "maintenance";
  let messageTitle = input.message_title;
  let messageBody  = input.message_body;
  if (!messageTitle || !messageBody) {
    // Fetch vehicle label for default message
    let vehicleLabel: string | undefined;
    if (input.vehicle_id) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("maker, model, grade, plate_number")
        .eq("id", input.vehicle_id)
        .maybeSingle();
      if (v) {
        vehicleLabel = [v.maker, v.model, v.grade, v.plate_number].filter(Boolean).join(" ");
      }
    }
    const def = defaultMaintenanceMessage(reminderType, vehicleLabel);
    messageTitle = messageTitle ?? def.title;
    messageBody  = messageBody  ?? def.body;
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("maintenance_reminders")
    .insert({
      dealer_id:         did,
      customer_id:       input.customer_id,
      vehicle_id:        input.vehicle_id        ?? null,
      work_order_id:     input.work_order_id     ?? null,
      reminder_number:   input.reminder_number || (await getNextDocumentNumber("maintenance_reminder")) || `MNT-${Date.now()}`,
      title:             input.title             ?? null,
      reminder_type:     reminderType,
      status:            input.status            ?? "scheduled",
      due_date:          input.due_date          ?? null,
      scheduled_send_at: scheduledSendAt,
      message_title:     messageTitle,
      message_body:      messageBody,
      notes:             input.notes             ?? null,
      internal_memo:     input.internal_memo     ?? null,
      created_at:        now,
      updated_at:        now,
    })
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, grade, plate_number ),
      work_orders ( work_order_number, title, status )
    `)
    .single();

  if (error) {
    console.error("createMaintenanceReminder error:", error);
    return { error: error.message };
  }

  return { success: true, data: data as unknown as MaintenanceReminderDB };
}

export async function createMaintenanceReminderFromFormData(
  fd: FormData
): Promise<{ error: string } | { success: true; data: MaintenanceReminderDB }> {
  return createMaintenanceReminder({
    customer_id:       fd.get("customer_id")       as string,
    vehicle_id:        fd.get("vehicle_id")        as string | null,
    work_order_id:     fd.get("work_order_id")     as string | null,
    reminder_number:   (fd.get("reminder_number")  as string | null) || null,
    title:             fd.get("title")             as string | null,
    reminder_type:     (fd.get("reminder_type")    as string | null) as import("./maintenance-types").MaintenanceReminderType ?? "maintenance",
    status:            (fd.get("status")           as string | null) as import("./maintenance-types").MaintenanceReminderStatus ?? "scheduled",
    due_date:          fd.get("due_date")          as string | null,
    scheduled_send_at: fd.get("scheduled_send_at") as string | null,
    message_title:     fd.get("message_title")     as string | null,
    message_body:      fd.get("message_body")      as string | null,
    notes:             fd.get("notes")             as string | null,
    internal_memo:     fd.get("internal_memo")     as string | null,
  });
}
