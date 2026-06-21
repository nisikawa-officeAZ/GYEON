// Server-side function — fetches a single GYEON service estimate for PDF generation.
//
// Security rules:
//   1. dealer_id comes from dealer_members, NOT from auth.uid().
//   2. Record is scoped by BOTH id AND dealer_id.
//      A user cannot access another dealer's gyeon_service_estimate.
//   3. gyeonId is provided by the caller (URL param), NOT trusted blindly —
//      the .eq("dealer_id", ...) clause enforces access control.

import { createClient }           from "@/lib/supabase/server";
import { getCurrentDealer }       from "@/lib/auth/get-current-dealer";
import { GyeonServiceEstimateDB } from "@/lib/gyeon/gyeon-service-types";

export async function getGyeonServicePdfData(gyeonId: string): Promise<GyeonServiceEstimateDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyeon_service_estimates")
    .select(`
      *,
      estimates (
        estimate_no,
        status,
        customers ( name, phone, email ),
        vehicles  ( manufacturer, model, year, grade, license_plate )
      )
    `)
    .eq("id",        gyeonId)
    .eq("dealer_id", dealer.dealer_id)   // tenant scope — never from client
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    if (error) console.error("[getGyeonServicePdfData] error:", error.message);
    return null;
  }

  return data as GyeonServiceEstimateDB;
}
