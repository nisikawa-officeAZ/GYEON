// Server-side function — fetches estimates for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only estimates belonging to the current dealer are returned.
//
// Includes joined customer and vehicle data for display.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateDB }       from "./estimate-types";

export async function getEstimates(): Promise<EstimateDB[]> {
  const dealer = await getCurrentDealer();

  // No active dealer membership — return empty list safely.
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estimates")
    .select(`
      *,
      customers ( name, phone, email ),
      vehicles  ( manufacturer, model, year, grade, license_plate )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEstimates] error:", error.message);
    return [];
  }

  return (data as EstimateDB[]) ?? [];
}
