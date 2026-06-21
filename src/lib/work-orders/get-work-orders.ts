// Server-side function — fetches work orders for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only work orders belonging to the current dealer are returned.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { WorkOrderDB }      from "./work-order-types";

export async function getWorkOrders(): Promise<WorkOrderDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      id,
      dealer_id,
      estimate_id,
      customer_id,
      vehicle_id,
      work_order_number,
      status,
      title,
      scheduled_start_at,
      scheduled_end_at,
      actual_start_at,
      actual_end_at,
      assigned_staff,
      service_summary,
      notes,
      internal_memo,
      deleted_at,
      created_at,
      updated_at,
      customers ( last_name, first_name ),
      vehicles  ( maker, model, grade, plate_number ),
      estimates ( estimate_number, title, total, status )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("scheduled_start_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[getWorkOrders] error:", error.message);
    return [];
  }

  return (data as unknown as WorkOrderDB[]) ?? [];
}
