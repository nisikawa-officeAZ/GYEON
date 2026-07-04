// Server-side function — fetches estimates for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only estimates belonging to the current dealer are returned.
//
// Joins customer (last_name, first_name, phone, email) and vehicle (maker, model, year, grade, plate_number).

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
      id,
      customer_id,
      vehicle_id,
      estimate_no,
      estimate_number,
      title,
      status,
      subtotal,
      tax,
      tax_rate,
      tax_amount,
      discount_amount,
      total,
      valid_until,
      notes,
      internal_memo,
      dealer_id,
      deleted_at,
      created_at,
      updated_at,
      customers ( last_name, first_name, phone, email ),
      vehicles  ( maker, model, year, grade, plate_number, body_size, registration_date, inspection_expiry_date ),
      estimate_items (
        id, estimate_id, dealer_id, category, item_name, description,
        quantity, unit_price, discount_rate, line_total, sort_order, created_at, updated_at
      )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEstimates] error:", error.message);
    return [];
  }

  return (data as unknown as EstimateDB[]) ?? [];
}
