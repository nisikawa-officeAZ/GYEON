"use server";

// Phase 4 Sprint 4 — Create a reservation from a maintenance reminder.
//
// The reservations table has no maintenance_reminder_id column (and we add no schema),
// so the linkage is functional: the reservation inherits the reminder's customer,
// vehicle, and work order. dealer_id is always server-resolved; the reminder is read
// dealer-scoped; the write is delegated to createReservation (which re-enforces the
// "edit" capability and re-validates all ownership).

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createReservation } from "./create-reservation";
import { ReservationDB, ReservationServiceType, ReservationStatus } from "./reservation-types";

interface FromReminderInput {
  reservation_date:   string;
  start_time?:        string | null;
  end_time?:          string | null;
  service_type:       ReservationServiceType;
  assigned_staff_id?: string | null;
  notes?:             string | null;
  status?:            ReservationStatus;
}

export async function createReservationFromReminder(
  reminderId: string,
  input: FromReminderInput,
): Promise<{ success: boolean; data?: ReservationDB; error?: string }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();

  // Read the reminder (dealer-scoped) to inherit its customer / vehicle / work order.
  const { data: reminder } = await supabase
    .from("maintenance_reminders")
    .select("id, customer_id, vehicle_id, work_order_id")
    .eq("id",        reminderId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!reminder) return { success: false, error: "リマインダーが見つかりません" };

  return createReservation({
    customer_id:       reminder.customer_id   ?? null,
    vehicle_id:        reminder.vehicle_id    ?? null,
    work_order_id:     reminder.work_order_id ?? null,
    assigned_staff_id: input.assigned_staff_id ?? null,
    reservation_date:  input.reservation_date,
    start_time:        input.start_time ?? null,
    end_time:          input.end_time   ?? null,
    service_type:      input.service_type,
    notes:             input.notes      ?? null,
    status:            input.status,
  });
}
