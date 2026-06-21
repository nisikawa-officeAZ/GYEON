// Server-side function — fetches a single work order with full joined data.
//
// Architecture rule:
//   Scoped by BOTH id AND dealer_id from dealer_members.
//   Returns null if the work order does not belong to the current dealer.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { WorkOrderDB }      from "./work-order-types";

export async function getWorkOrder(workOrderId: string): Promise<WorkOrderDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

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
      estimates (
        estimate_number,
        title,
        total,
        status,
        estimate_items (
          id,
          category,
          item_name,
          description,
          quantity,
          unit_price,
          discount_rate,
          line_total,
          sort_order
        )
      )
    `)
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("[getWorkOrder] error:", error.message);
    return null;
  }

  return (data as unknown as WorkOrderDB) ?? null;
}
