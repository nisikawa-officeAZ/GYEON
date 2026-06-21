// Server-side function — fetches vehicles for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only vehicles belonging to the current dealer are returned.
//
// Includes joined customer (last_name, first_name) for table display.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { VehicleDB }        from "./vehicle-types";

export async function getVehicles(): Promise<VehicleDB[]> {
  const dealer = await getCurrentDealer();

  // No active dealer membership — return empty list safely.
  if (!dealer) return [];

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
      deleted_at,
      created_at,
      updated_at,
      customers ( last_name, first_name )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getVehicles] error:", error.message);
    return [];
  }

  return (data as unknown as VehicleDB[]) ?? [];
}
