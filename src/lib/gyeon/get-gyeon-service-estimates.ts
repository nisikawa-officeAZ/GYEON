// Server-side function — fetches GYEON service estimates for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only records belonging to the current dealer are returned.
//
// Includes joined estimate → customer + vehicle data for PDF-friendly structure.

import { createClient }                from "@/lib/supabase/server";
import { getCurrentDealer }            from "@/lib/auth/get-current-dealer";
import { GyeonServiceEstimateDB }      from "./gyeon-service-types";

export async function getGyeonServiceEstimates(): Promise<GyeonServiceEstimateDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyeon_service_estimates")
    .select(`
      *,
      estimates (
        estimate_no,
        estimate_number,
        status,
        customers ( last_name, first_name, phone, email ),
        vehicles  ( maker, model, year, grade, plate_number )
      )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getGyeonServiceEstimates] error:", error.message);
    return [];
  }

  return (data as GyeonServiceEstimateDB[]) ?? [];
}
