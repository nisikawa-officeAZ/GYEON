"use server";

// Phase 4 Sprint 1 — Auto-create a maintenance reminder from a qualifying
// completion report.
//
// Qualifying condition: the completion report carries a next_maintenance_date.
// Dealer-scoped throughout (dealer_id from getCurrentDealer(); never from client).
// Duplicate prevention: at most one auto "maintenance" reminder per work order
// (skips if a non-cancelled maintenance reminder already exists for that work order).
// Non-blocking: never throws; completion-report creation must not fail if this
// auxiliary step does.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createMaintenanceReminder } from "./create-maintenance-reminder";

// NOTE: "use server" module — only async functions may be exported, so this type
// is kept local (consumers call the action for its side effect, not the result type).
type AutoReminderResult =
  | { created: true; id: string }
  | { created: false; reason: "no_date" | "no_work_order" | "duplicate" | "error" };

export async function autoCreateMaintenanceReminderFromCompletion(
  workOrderId: string,
  nextMaintenanceDate: string | null,
): Promise<AutoReminderResult> {
  try {
    // Only a completion report with a next maintenance date qualifies.
    if (!nextMaintenanceDate) return { created: false, reason: "no_date" };

    const dealer = await getCurrentDealer();
    if (!dealer) return { created: false, reason: "error" };

    const supabase = await createClient();
    const did = dealer.dealer_id;

    // Resolve the owning work order (dealer-scoped) for customer/vehicle linkage.
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, customer_id, vehicle_id")
      .eq("id",        workOrderId)
      .eq("dealer_id", did)
      .maybeSingle();

    if (!wo || !wo.customer_id) return { created: false, reason: "no_work_order" };

    // Duplicate prevention: one (non-cancelled) auto maintenance reminder per work order.
    const { data: existing } = await supabase
      .from("maintenance_reminders")
      .select("id")
      .eq("dealer_id",     did)
      .eq("work_order_id", workOrderId)
      .eq("reminder_type", "maintenance")
      .neq("status",       "cancelled")
      .limit(1)
      .maybeSingle();

    if (existing) return { created: false, reason: "duplicate" };

    // Create the reminder. due_date drives scheduled_send_at (7 days prior, in the
    // reminder action). No LINE send here (out of Sprint 1 scope).
    const result = await createMaintenanceReminder({
      customer_id:   wo.customer_id,
      vehicle_id:    wo.vehicle_id ?? null,
      work_order_id: workOrderId,
      reminder_type: "maintenance",
      status:        "scheduled",
      due_date:      nextMaintenanceDate,
    });

    if ("error" in result) return { created: false, reason: "error" };
    return { created: true, id: result.data.id };
  } catch (err) {
    console.error("[autoCreateMaintenanceReminderFromCompletion] error:", err);
    return { created: false, reason: "error" };
  }
}
