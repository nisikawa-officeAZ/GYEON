"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { ReservationDB } from "./reservation-types";

export async function getReservationsByDateRange(from: string, to: string): Promise<ReservationDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .gte("reservation_date", from)
    .lte("reservation_date", to)
    .order("reservation_date", { ascending: true })
    .order("start_time",       { ascending: true });

  if (error) {
    console.error("[getReservationsByDateRange] error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ReservationDB[];
}

export async function getReservationsByDate(date: string): Promise<ReservationDB[]> {
  return getReservationsByDateRange(date, date);
}
