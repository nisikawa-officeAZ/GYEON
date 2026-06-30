// Server-side function — fetches a single vehicle for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only a vehicle belonging to the current dealer (and not soft-deleted) is
//   returned; otherwise null. The owning customer (last_name, first_name) is
//   joined for display — and, being part of the same dealer-scoped query, this
//   confirms the vehicle's customer belongs to the same dealer.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { VehicleDB }        from "./vehicle-types";

export async function getVehicleById(id: string): Promise<VehicleDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      id,
      dealer_id,
      customer_id,
      vehicle_code,
      maker,
      model,
      grade,
      year,
      color,
      plate_number,
      vin,
      body_size,
      mileage,
      inspection_expiry_date,
      notes,
      displacement,
      fuel_type,
      registration_date,
      deleted_at,
      created_at,
      updated_at,
      customers ( last_name, first_name )
    `)
    .eq("id",        id)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return data as unknown as VehicleDB;
}
