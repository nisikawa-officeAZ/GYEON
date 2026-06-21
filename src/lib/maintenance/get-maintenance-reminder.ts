"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { MaintenanceReminderDB } from "./maintenance-types";

export async function getMaintenanceReminder(
  id: string
): Promise<MaintenanceReminderDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, grade, plate_number ),
      work_orders ( work_order_number, title, status )
    `)
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (error) {
    console.error("getMaintenanceReminder error:", error);
    return null;
  }

  return data as unknown as MaintenanceReminderDB | null;
}
