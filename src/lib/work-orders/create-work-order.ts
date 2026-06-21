"use server";

// Server Action — creates a new work order.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//      dealer_id is NEVER accepted from client form input.
//   2. If estimate_id is provided, it is validated to belong to the same dealer.
//      customer_id and vehicle_id are then pulled from the estimate.
//   3. If customer_id / vehicle_id are provided directly, they are validated
//      to belong to the same dealer.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { WorkOrderStatus }  from "./work-order-types";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function createWorkOrder(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const estimateId   = str(formData, "estimate_id");
  let   customerId   = str(formData, "customer_id");
  let   vehicleId    = str(formData, "vehicle_id");
  let   title        = str(formData, "title");
  const woNumber     = str(formData, "work_order_number");
  const status       = (str(formData, "status") ?? "scheduled") as WorkOrderStatus;
  const schedStart   = str(formData, "scheduled_start_at");
  const schedEnd     = str(formData, "scheduled_end_at");
  const actualStart  = str(formData, "actual_start_at");
  const actualEnd    = str(formData, "actual_end_at");
  const assignedStaff = str(formData, "assigned_staff");
  const serviceSummary = str(formData, "service_summary");
  const notes        = str(formData, "notes");
  const internalMemo = str(formData, "internal_memo");

  const supabase = await createClient();

  // If estimate_id is provided, validate it and inherit customer/vehicle/title.
  if (estimateId) {
    const { data: est, error: estError } = await supabase
      .from("estimates")
      .select("id, customer_id, vehicle_id, title, estimate_number")
      .eq("id",        estimateId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (estError || !est) {
      return { error: "Estimate not found or does not belong to your dealer." };
    }

    // Inherit customer_id / vehicle_id / title from estimate if not overridden.
    customerId = customerId ?? est.customer_id;
    vehicleId  = vehicleId  ?? est.vehicle_id;
    title      = title      ?? est.title ?? est.estimate_number;
  }

  // Validate customer_id if provided.
  if (customerId) {
    const { data: cust, error: custError } = await supabase
      .from("customers")
      .select("id")
      .eq("id",        customerId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (custError || !cust) {
      return { error: "Customer not found or does not belong to your dealer." };
    }
  }

  // Validate vehicle_id if provided.
  if (vehicleId) {
    const { data: veh, error: vehError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id",        vehicleId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (vehError || !veh) {
      return { error: "Vehicle not found or does not belong to your dealer." };
    }
  }

  const resolvedWoNumber = woNumber || (await getNextDocumentNumber("work_order")) || null;

  const { error } = await supabase.from("work_orders").insert({
    dealer_id:          dealer.dealer_id,   // server-injected — never from form
    estimate_id:        estimateId        || null,
    customer_id:        customerId        || null,
    vehicle_id:         vehicleId         || null,
    work_order_number:  resolvedWoNumber,
    status,
    title:              title             || null,
    scheduled_start_at: schedStart        || null,
    scheduled_end_at:   schedEnd          || null,
    actual_start_at:    actualStart       || null,
    actual_end_at:      actualEnd         || null,
    assigned_staff:     assignedStaff     || null,
    service_summary:    serviceSummary    || null,
    notes:              notes             || null,
    internal_memo:      internalMemo      || null,
  });

  if (error) {
    console.error("[createWorkOrder] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
