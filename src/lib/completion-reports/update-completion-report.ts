"use server";

// Server Action — updates a completion report.
//
// Allowed: title, status, report_date, customer_message, internal_memo, is_shared, shared_at
// Forbidden: dealer_id, work_order_id (immutable after creation)

import { revalidatePath }        from "next/cache";
import { createClient }          from "@/lib/supabase/server";
import { getCurrentDealer }      from "@/lib/auth/get-current-dealer";
import { CompletionReportStatus } from "./completion-report-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { autoCreateMaintenanceReminderFromCompletion } from "@/lib/maintenance/auto-create-from-completion";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function updateCompletionReport(reportId: string, formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const title           = str(formData, "title");
  const status          = str(formData, "status") as CompletionReportStatus | null;
  const reportDate      = str(formData, "report_date");
  const customerMessage = str(formData, "customer_message");
  const internalMemo    = str(formData, "internal_memo");
  const isSharedRaw     = formData.get("is_shared");
  const isShared        = isSharedRaw !== null ? isSharedRaw === "true" : undefined;
  const nextMaintenanceDate = str(formData, "next_maintenance_date");

  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (title           !== undefined) updatePayload.title            = title;
  if (status          !== null && status !== undefined)
                                     updatePayload.status           = status;
  if (reportDate      !== undefined) updatePayload.report_date      = reportDate || null;
  if (customerMessage !== undefined) updatePayload.customer_message = customerMessage;
  if (internalMemo    !== undefined) updatePayload.internal_memo    = internalMemo;
  if (isShared        !== undefined) {
    updatePayload.is_shared = isShared;
    if (isShared) updatePayload.shared_at = new Date().toISOString();
  }
  if (nextMaintenanceDate) updatePayload.next_maintenance_date = nextMaintenanceDate;

  const { error } = await supabase
    .from("completion_reports")
    .update(updatePayload)
    .eq("id",        reportId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateCompletionReport] error:", error.message);
    return { error: error.message };
  }

  // Phase 4 Sprint 1 — if a next_maintenance_date is set on this report, auto-create a
  // (deduped, non-blocking) maintenance reminder for the owning work order.
  if (nextMaintenanceDate) {
    const { data: rep } = await supabase
      .from("completion_reports")
      .select("work_order_id")
      .eq("id",        reportId)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();
    if (rep?.work_order_id) {
      void autoCreateMaintenanceReminderFromCompletion(rep.work_order_id, nextMaintenanceDate);
    }
  }

  revalidatePath("/work-orders");
  return { success: true };
}
