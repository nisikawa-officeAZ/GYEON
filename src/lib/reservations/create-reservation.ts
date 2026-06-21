"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { ReservationDB, ReservationStatus, ReservationServiceType } from "./reservation-types";
import { createActivityLog } from "@/lib/activity/activity-log";
import { createNotification } from "@/lib/notifications/notification";

interface CreateReservationInput {
  customer_id?: string | null;
  vehicle_id?: string | null;
  reservation_date: string;
  start_time?: string | null;
  end_time?: string | null;
  service_type: ReservationServiceType;
  notes?: string | null;
  status?: ReservationStatus;
}

export async function createReservation(
  input: CreateReservationInput
): Promise<{ success: boolean; data?: ReservationDB; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const reservation_number = await getNextDocumentNumber("reservation");

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      dealer_id:          did,
      reservation_number: reservation_number ?? null,
      customer_id:        input.customer_id  ?? null,
      vehicle_id:         input.vehicle_id   ?? null,
      reservation_date:   input.reservation_date,
      start_time:         input.start_time   ?? null,
      end_time:           input.end_time     ?? null,
      service_type:       input.service_type,
      notes:              input.notes        ?? null,
      status:             input.status       ?? "pending",
    })
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .single();

  if (error || !data) {
    console.error("[createReservation] error:", error?.message);
    return { success: false, error: error?.message ?? "Insert failed" };
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  void createActivityLog({
    entity_type: "reservation",
    entity_id:   data.id,
    customer_id: input.customer_id ?? null,
    action:      "created",
    title:       `予約を作成: ${reservation_number ?? data.id.slice(0, 8)}`,
  });

  void createNotification({
    type:        "info",
    title:       "予約を作成しました",
    message:     `${input.reservation_date} ${input.service_type}`,
    entity_type: "reservation",
    entity_id:   data.id,
  });

  return { success: true, data: data as unknown as ReservationDB };
}
