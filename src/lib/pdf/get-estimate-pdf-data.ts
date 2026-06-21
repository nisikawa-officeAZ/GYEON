// Server-side function — fetches a single estimate for PDF generation.
//
// Security rules:
//   1. dealer_id comes from dealer_members, NOT from auth.uid().
//   2. Record is scoped by BOTH id AND dealer_id.
//      A user cannot access another dealer's estimate.
//   3. estimateId is provided by the caller (URL param), NOT trusted blindly —
//      the .eq("dealer_id", ...) clause enforces access control.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateDB }       from "@/lib/estimates/estimate-types";

export async function getEstimatePdfData(estimateId: string): Promise<EstimateDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estimates")
    .select(`
      *,
      customers ( name, phone, email ),
      vehicles  ( manufacturer, model, year, grade, license_plate )
    `)
    .eq("id",        estimateId)
    .eq("dealer_id", dealer.dealer_id)   // tenant scope — never from client
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    if (error) console.error("[getEstimatePdfData] error:", error.message);
    return null;
  }

  return data as EstimateDB;
}
