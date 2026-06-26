"use server";

// Server Action — updates an existing work order.
//
// Security rules:
//   1. Update is scoped by BOTH id AND dealer_id from dealer_members.
//   2. dealer_id is NEVER changeable via this action.
//   3. estimate_id, customer_id, vehicle_id changes are validated against dealer_id.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { WorkOrderStatus }  from "./work-order-types";
import { createEngagementEvent }   from "@/lib/customer-engagement/context";
import { EngagementWorkflowRuntime } from "@/lib/customer-engagement/engine/runtime";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function updateWorkOrder(workOrderId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const estimateId    = str(formData, "estimate_id");
  const customerId    = str(formData, "customer_id");
  const vehicleId     = str(formData, "vehicle_id");
  const woNumber      = str(formData, "work_order_number");
  const status        = (str(formData, "status") ?? "scheduled") as WorkOrderStatus;
  const title         = str(formData, "title");
  const schedStart    = str(formData, "scheduled_start_at");
  const schedEnd      = str(formData, "scheduled_end_at");
  const actualStart   = str(formData, "actual_start_at");
  const actualEnd     = str(formData, "actual_end_at");
  const assignedStaff = str(formData, "assigned_staff");
  const serviceSummary = str(formData, "service_summary");
  const notes         = str(formData, "notes");
  const internalMemo  = str(formData, "internal_memo");

  const supabase = await createClient();

  // ── Read current status before UPDATE (for transition detection) ──────────
  // We need the prior status to detect when a work order transitions into "completed".
  // This SELECT is scoped by both id and dealer_id to prevent cross-dealer reads.
  const { data: priorOrder } = await supabase
    .from("work_orders")
    .select("status, customer_id")
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  const isNewCompletion =
    status === "completed" &&
    priorOrder !== null &&
    priorOrder.status !== "completed";

  // Validate estimate_id if provided.
  if (estimateId) {
    const { data: est, error: estError } = await supabase
      .from("estimates")
      .select("id")
      .eq("id",        estimateId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (estError || !est) {
      return { error: "Estimate not found or does not belong to your dealer." };
    }
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

  const { error } = await supabase
    .from("work_orders")
    .update({
      estimate_id:        estimateId     || null,
      customer_id:        customerId     || null,
      vehicle_id:         vehicleId      || null,
      work_order_number:  woNumber       || null,
      status,
      title:              title          || null,
      scheduled_start_at: schedStart     || null,
      scheduled_end_at:   schedEnd       || null,
      actual_start_at:    actualStart    || null,
      actual_end_at:      actualEnd      || null,
      assigned_staff:     assignedStaff  || null,
      service_summary:    serviceSummary || null,
      notes:              notes          || null,
      internal_memo:      internalMemo   || null,
      updated_at:         new Date().toISOString(),
    })
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateWorkOrder] error:", error.message);
    return { error: error.message };
  }

  // ── Emit WORK_COMPLETED engagement event ──────────────────────────────────
  // Triggered only on a genuine non-completed → completed transition.
  // dealer_id is from getCurrentDealer() inside createEngagementEvent — never from form input.
  // Engine never throws; any failure is captured as a typed WorkflowExecutionResult.
  if (isNewCompletion && customerId) {
    const event = await createEngagementEvent(
      "WORK_COMPLETED",
      customerId,
      {
        work_order_id:        workOrderId,
        completion_report_id: undefined,
        services_performed:   [],
        completed_at:         actualEnd ?? new Date().toISOString(),
      },
      {
        vehicle_id: vehicleId ?? undefined,
        job_id:     workOrderId,
      },
    );

    if (event) {
      const engine = new EngagementWorkflowRuntime();
      await engine.dispatch(event);
    }
  }

  revalidatePath("/work-orders");
  return { success: true };
}
