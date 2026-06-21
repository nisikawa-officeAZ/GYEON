// Server-side function — fetches a single estimate with its line items.
//
// Architecture rule:
//   Scoped by BOTH id AND dealer_id from dealer_members.
//   Returns null if the estimate does not belong to the current dealer.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateDB }       from "./estimate-types";

export async function getEstimate(estimateId: string): Promise<EstimateDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

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
      vehicles  ( maker, model, year, grade, plate_number ),
      estimate_items (
        id,
        estimate_id,
        dealer_id,
        category,
        item_name,
        description,
        quantity,
        unit_price,
        discount_rate,
        line_total,
        sort_order,
        created_at,
        updated_at
      )
    `)
    .eq("id",        estimateId)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("[getEstimate] error:", error.message);
    return null;
  }

  return (data as unknown as EstimateDB) ?? null;
}
