"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { ReservationDB, ReservationStatus, serviceTypeLabel } from "./reservation-types";
import { getReservation } from "./get-reservation";

interface UpdateReservationInput {
  status?: ReservationStatus;
  reservation_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  work_order_id?: string | null;
  service_type?: string;
  customer_id?: string | null;
  vehicle_id?: string | null;
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput
): Promise<{ success: boolean; data?: ReservationDB; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .single();

  if (error || !data) {
    console.error("[updateReservation] error:", error?.message);
    return { success: false, error: error?.message ?? "Update failed" };
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, data: data as unknown as ReservationDB };
}

export async function createWorkOrderFromReservation(
  reservationId: string
): Promise<{ success: boolean; work_order_id?: string; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const reservation = await getReservation(reservationId);
  if (!reservation) return { success: false, error: "Reservation not found." };

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const work_order_number = await getNextDocumentNumber("work_order");

  // Build scheduled_start_at from reservation_date + start_time
  let scheduledStartAt: string | null = null;
  if (reservation.start_time) {
    scheduledStartAt = `${reservation.reservation_date}T${reservation.start_time}`;
  } else {
    scheduledStartAt = `${reservation.reservation_date}T00:00:00`;
  }

  let scheduledEndAt: string | null = null;
  if (reservation.end_time) {
    scheduledEndAt = `${reservation.reservation_date}T${reservation.end_time}`;
  }

  const title = serviceTypeLabel(reservation.service_type);

  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .insert({
      dealer_id:          did,
      customer_id:        reservation.customer_id  ?? null,
      vehicle_id:         reservation.vehicle_id   ?? null,
      work_order_number:  work_order_number        ?? null,
      status:             "scheduled",
      title,
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at:   scheduledEndAt           ?? null,
      notes:              reservation.notes        ?? null,
    })
    .select("id")
    .single();

  if (woError || !wo) {
    console.error("[createWorkOrderFromReservation] WO error:", woError?.message);
    return { success: false, error: woError?.message ?? "Work order creation failed" };
  }

  // Link the work order back to the reservation
  const { error: linkError } = await supabase
    .from("reservations")
    .update({ work_order_id: wo.id, updated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("dealer_id", did);

  if (linkError) {
    console.error("[createWorkOrderFromReservation] link error:", linkError.message);
  }

  revalidatePath("/reservations");
  revalidatePath("/work-orders");
  revalidatePath("/calendar");

  return { success: true, work_order_id: wo.id };
}
