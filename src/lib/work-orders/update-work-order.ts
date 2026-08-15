"use server";

// Server Action — updates an existing work order (GENERIC, non-completion path).
//
// Security rules:
//   1. Update is scoped by BOTH id AND dealer_id from dealer_members.
//   2. dealer_id is NEVER changeable via this action.
//   3. estimate_id, customer_id, vehicle_id changes are validated against dealer_id.
//
// GDA-1W completion boundary (accepted contract §7.1):
//   4. This action can neither express nor write `status = 'completed'` or
//      `actual_end_at`. Completion is ONE deliberate atomic operation —
//      `public.complete_work_order_v1` — reached through the dedicated
//      completion adapter, never through this generic form path. The database
//      enforces the same boundary independently: the authenticated role holds
//      no UPDATE privilege on `actual_end_at` (writing it here would fail the
//      ENTIRE update with a permission error), and a guard trigger rejects any
//      raw status change entering or leaving 'completed'. The typed payload
//      (`WorkOrderGenericUpdateInput` via `stripCompletionProtectedFields`)
//      makes the rejected write unrepresentable before it reaches a query.
//   5. Because this path can no longer produce a completion transition, the
//      previous WORK_COMPLETED engagement emission was removed WITH the
//      capability: §3.5 forbids the atomic completion operation from invoking
//      the legacy post-update event path, and a dead "isNewCompletion" branch
//      here could never fire again.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import {
  WorkOrderStatus,
  WorkOrderUpdateInput,
  stripCompletionProtectedFields,
} from "./work-order-types";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function updateWorkOrder(workOrderId: string, formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

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
  const assignedStaff = str(formData, "assigned_staff");
  const serviceSummary = str(formData, "service_summary");
  const notes         = str(formData, "notes");
  const internalMemo  = str(formData, "internal_memo");

  const supabase = await createClient();

  // ── Read current status before UPDATE (for completion-boundary decisions) ──
  // This SELECT is scoped by both id and dealer_id to prevent cross-dealer reads.
  const { data: priorOrder } = await supabase
    .from("work_orders")
    .select("status")
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!priorOrder) {
    return { error: "Work order not found or does not belong to your dealer." };
  }

  // ── Completion boundary (§7.1) ─────────────────────────────────────────────
  // Entering 'completed' through this form is refused with a stable, actionable
  // message rather than silently keeping the old status: choosing 完了 is an
  // explicit intent that belongs to the completion flow.
  if (status === "completed" && priorOrder.status !== "completed") {
    return {
      error:
        "Completion is not performed here. Use the completion flow, which confirms the actual end time and the performed work.",
    };
  }
  // Leaving 'completed' requires a future correction/recovery operation.
  if (priorOrder.status === "completed" && status !== "completed") {
    return { error: "A completed work order cannot leave completed through this form." };
  }

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

  // ── Build the payload through the protected-field strip ───────────────────
  // `actual_end_at` is deliberately never read from the form and is removed by
  // type: the authenticated role holds no UPDATE grant on that column, so a
  // payload containing it would fail every update. A same-value 'completed'
  // resubmit (editing notes on a completed order) is also stripped — the
  // column value is unchanged, so omitting it preserves behavior while keeping
  // 'completed' unrepresentable in the payload type.
  const requested: WorkOrderUpdateInput = {
    estimate_id:        estimateId     || null,
    customer_id:        customerId     || null,
    vehicle_id:         vehicleId      || null,
    work_order_number:  woNumber       || null,
    status,
    title:              title          || null,
    scheduled_start_at: schedStart     || null,
    scheduled_end_at:   schedEnd       || null,
    actual_start_at:    actualStart    || null,
    assigned_staff:     assignedStaff  || null,
    service_summary:    serviceSummary || null,
    notes:              notes          || null,
    internal_memo:      internalMemo   || null,
  };
  const payload = stripCompletionProtectedFields(requested);

  const { error } = await supabase
    .from("work_orders")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateWorkOrder] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
