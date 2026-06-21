"use server";

// Server Action — creates a new completion report for a work order.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//   2. work_order_id is validated to belong to the same dealer_id.
//   3. title and report_date have sensible defaults.
//   4. status is always 'draft' on creation.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function createCompletionReport(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const workOrderId     = str(formData, "work_order_id");
  if (!workOrderId)     return { error: "Work order ID is required." };

  const reportNumber    = str(formData, "report_number");
  const title           = str(formData, "title")           ?? "施工完了報告書";
  const reportDate      = str(formData, "report_date")     ?? new Date().toISOString().slice(0, 10);
  const customerMessage = str(formData, "customer_message");
  const internalMemo    = str(formData, "internal_memo");

  const supabase = await createClient();

  // Validate work_order_id belongs to the same dealer.
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .select("id, title")
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (woError || !wo) {
    return { error: "Work order not found or does not belong to your dealer." };
  }

  const { data: newReport, error } = await supabase
    .from("completion_reports")
    .insert({
      dealer_id:        dealer.dealer_id,   // server-injected — never from form
      work_order_id:    workOrderId,
      report_number:    reportNumber || null,
      title:            title || wo.title || "施工完了報告書",
      status:           "draft",
      report_date:      reportDate,
      customer_message: customerMessage || null,
      internal_memo:    internalMemo   || null,
      is_shared:        false,
    })
    .select("id")
    .single();

  if (error || !newReport) {
    console.error("[createCompletionReport] error:", error?.message);
    return { error: error?.message ?? "Failed to create report." };
  }

  revalidatePath("/work-orders");
  return { success: true, id: newReport.id };
}
