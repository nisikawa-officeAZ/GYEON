"use server";

// Server Actions — fetch completion report data.
//
// Architecture rule:
//   All queries are scoped by dealer_id from dealer_members.
//   Returns null / [] if records do not belong to the current dealer.
//
// Marked "use server" so these can be called from client components.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  CompletionReportDB,
  CompletionReportFullData,
} from "./completion-report-types";
import { WorkOrderFileDB } from "@/lib/work-order-files/work-order-file-types";

// ─── List reports for a work order ────────────────────────────────────────────

export async function getCompletionReportsByWorkOrder(
  workOrderId: string
): Promise<CompletionReportDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("completion_reports")
    .select("*")
    .eq("work_order_id", workOrderId)
    .eq("dealer_id",     dealer.dealer_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getCompletionReportsByWorkOrder] error:", error.message);
    return [];
  }

  return (data as CompletionReportDB[]) ?? [];
}

// ─── Full data for preview ────────────────────────────────────────────────────

export async function getCompletionReportFull(
  reportId: string
): Promise<CompletionReportFullData | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  // 1. Fetch the report itself.
  const { data: report, error: reportError } = await supabase
    .from("completion_reports")
    .select("*")
    .eq("id",        reportId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (reportError || !report) {
    console.error("[getCompletionReportFull] report error:", reportError?.message);
    return null;
  }

  // 2. Fetch work order with joins.
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .select(`
      id,
      work_order_number,
      title,
      status,
      scheduled_start_at,
      scheduled_end_at,
      actual_start_at,
      actual_end_at,
      assigned_staff,
      service_summary,
      notes,
      customers ( last_name, first_name, phone, email ),
      vehicles  ( maker, model, year, grade, plate_number, color ),
      estimates (
        estimate_number,
        title,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        total,
        estimate_items (
          id, category, item_name, description,
          quantity, unit_price, discount_rate, line_total, sort_order
        )
      )
    `)
    .eq("id",        report.work_order_id)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (woError) {
    console.error("[getCompletionReportFull] work_order error:", woError.message);
  }

  // 3. Fetch work order files (all phases).
  const { data: files, error: filesError } = await supabase
    .from("work_order_files")
    .select("*")
    .eq("work_order_id", report.work_order_id)
    .eq("dealer_id",     dealer.dealer_id)
    .order("phase",      { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filesError) {
    console.error("[getCompletionReportFull] files error:", filesError.message);
  }

  // 4. Fetch dealer info from dealers table.
  const { data: dealerInfo, error: dealerError } = await supabase
    .from("dealers")
    .select("id, name, dealer_type, prefecture, address, phone, email")
    .eq("id", dealer.dealer_id)
    .single();

  if (dealerError) {
    console.warn("[getCompletionReportFull] dealer info not available:", dealerError.message);
  }

  return {
    report:     report as CompletionReportDB,
    dealer:     dealerInfo ?? null,
    work_order: wo as CompletionReportFullData["work_order"] ?? null,
    files:      (files as WorkOrderFileDB[]) ?? [],
  };
}
