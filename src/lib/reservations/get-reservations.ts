"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { ReservationDB, ReservationStatus } from "./reservation-types";

export interface ReservationFilter {
  status?: ReservationStatus | ReservationStatus[];
  from?: string;   // ISO date
  to?: string;     // ISO date
  customer_id?: string;
  limit?: number;
}

export async function getReservations(filter: ReservationFilter = {}): Promise<ReservationDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .eq("dealer_id", dealer.dealer_id);

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in("status", filter.status);
    } else {
      query = query.eq("status", filter.status);
    }
  }

  if (filter.from) {
    query = query.gte("reservation_date", filter.from);
  }

  if (filter.to) {
    query = query.lte("reservation_date", filter.to);
  }

  if (filter.customer_id) {
    query = query.eq("customer_id", filter.customer_id);
  }

  const limit = filter.limit ?? 200;
  query = query
    .order("reservation_date", { ascending: true })
    .order("start_time",       { ascending: true })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[getReservations] error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ReservationDB[];
}
