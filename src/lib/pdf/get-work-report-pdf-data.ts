// TEMPLATE-C2-WR — the ONE work-report data loader + eligibility gate.
//
// A work report may only be produced from a completion_reports row whose linked work order is
// completed and dated. This module reads through the CALLER'S RLS-scoped client (never the service
// role), scoped by BOTH the report id AND the authenticated dealer id, so a foreign report id
// resolves to nothing. It selects ONLY non-monetary columns — the estimate join takes exactly
// category / item_name / description / sort_order from estimate_items and NOTHING priced — so the
// monetary exclusion holds at the query layer, not by discarding fields later.

import { createClient } from "@/lib/supabase/server";
import type { WorkReportSource } from "./work-report-document-data";

export type WorkReportPdfData =
  | { readonly kind: "ok"; readonly source: WorkReportSource }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_eligible" };

/**
 * Resolve and gate the work-report source.
 *
 * @param dealerId the authenticated dealer, resolved server-side (never client input)
 * @param reportId the requested completion_reports id
 */
export async function getWorkReportPdfData(
  dealerId: string,
  reportId: string,
): Promise<WorkReportPdfData> {
  if (!dealerId) return { kind: "unauthenticated" };
  if (typeof reportId !== "string" || reportId.trim() === "") return { kind: "invalid_request" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("completion_reports")
    .select(`
      id, dealer_id, work_order_id, report_number, report_date, customer_message, status,
      work_orders (
        id, dealer_id, status, actual_end_at, estimate_id,
        customers ( last_name, first_name, phone, email, postal_code, address1, is_business ),
        vehicles  ( maker, model, year, grade, plate_number, color, mileage ),
        estimates (
          estimate_items ( category, item_name, description, sort_order )
        )
      )
    `)
    .eq("id", reportId)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  // A foreign or missing report is indistinguishable: both are "not_found".
  if (error || !data) return { kind: "not_found" };

  const row = data as unknown as {
    report_number: string | null;
    report_date: string | null;
    customer_message: string | null;
    work_order_id: string | null;
    work_orders: {
      dealer_id: string | null;
      status: string | null;
      actual_end_at: string | null;
      estimate_id: string | null;
      customers: WorkReportSource["customer"];
      vehicles: WorkReportSource["vehicle"];
      estimates: { estimate_items: Array<{ category: string | null; item_name: string | null; description: string | null; sort_order: number | null }> } | null;
    } | null;
  };

  const wo = row.work_orders;

  // Eligibility, all fail-closed → one coarse "not_eligible".
  if (!row.work_order_id || !wo) return { kind: "not_eligible" };
  if (wo.dealer_id != null && wo.dealer_id !== dealerId) return { kind: "not_eligible" };
  if (wo.status !== "completed") return { kind: "not_eligible" };
  const workDate = (wo.actual_end_at ?? "").toString().trim();
  if (!workDate) return { kind: "not_eligible" };
  const reportDate = (row.report_date ?? "").toString().trim();
  if (!reportDate) return { kind: "not_eligible" };
  const reportNumber = (row.report_number ?? "").toString().trim();
  if (!reportNumber) return { kind: "not_eligible" };
  const items = wo.estimates?.estimate_items ?? [];
  if (!wo.estimate_id || items.length === 0) return { kind: "not_eligible" };

  const source: WorkReportSource = {
    reportNumber,
    reportDate,
    workDate,
    customerMessage: row.customer_message ?? null,
    customer: wo.customers ?? null,
    vehicle: wo.vehicles ?? null,
    items: items.map((it) => ({
      category: it.category ?? null,
      item_name: it.item_name ?? null,
      description: it.description ?? null,
      sort_order: it.sort_order ?? null,
    })),
  };

  return { kind: "ok", source };
}
