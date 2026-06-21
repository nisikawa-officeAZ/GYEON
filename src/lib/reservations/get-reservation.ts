"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { ReservationDB } from "./reservation-types";

export async function getReservation(id: string): Promise<ReservationDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (error || !data) {
    if (error) console.error("[getReservation] error:", error.message);
    return null;
  }

  return data as unknown as ReservationDB;
}
