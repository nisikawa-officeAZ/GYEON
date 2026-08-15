// TEMPLATE-C2-WR + GDA-1W — the ONE work-report data loader + eligibility gate.
//
// Reworked under the accepted completion contract (§8): eligibility and the
// performed-work rows now come EXCLUSIVELY from the shared fail-closed source
// `getWorkReportSource`, which judges the canonical same-tenant report with
// the pure eligibility core and reads performed work ONLY from the confirmed
// `completion_report_items` snapshot.
//
// What this removes from the previous revision:
//   * the estimate_items join and the "no estimate items -> not eligible"
//     rule: estimate items are a proposal and are NEVER a work-report source;
//     their absence no longer matters and their presence can no longer leak in;
//   * the hand-rolled eligibility conditions, replaced by the shared reason
//     matrix — the route and the UI now surface IDENTICAL reasons.
//
// The monetary exclusion still holds at the query layer: the shared source
// selects no priced column, and the enrichment read below selects only
// non-monetary customer/vehicle display facts.

import { createClient } from "@/lib/supabase/server";
import { getWorkReportSource } from "@/lib/completion-reports/get-completion-report";
import type { WorkReportNotReadyReason } from "@/lib/completion-reports/completion-report-types";
import type { WorkReportSource } from "./work-report-document-data";

export type WorkReportPdfData =
  | { readonly kind: "ok"; readonly source: WorkReportSource }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | {
      readonly kind: "not_eligible";
      /** The EXACT shared §8 reasons, for rendering instead of a vague message. */
      readonly reasons: readonly WorkReportNotReadyReason[];
    };

/**
 * Resolve and gate the work-report source.
 *
 * @param dealerId the authenticated dealer, resolved server-side (never client
 *                 input). The shared source re-derives its own request-scoped
 *                 context; this parameter is cross-checked against the loaded
 *                 report as defense in depth.
 * @param reportId the requested completion_reports id
 */
export async function getWorkReportPdfData(
  dealerId: string,
  reportId: string,
): Promise<WorkReportPdfData> {
  if (!dealerId) return { kind: "unauthenticated" };
  if (typeof reportId !== "string" || reportId.trim() === "") return { kind: "invalid_request" };

  // ── ONE shared fail-closed judgment (§8). ──
  const source = await getWorkReportSource(reportId);

  if (!source.ready) {
    // 'unauthenticated' keeps its dedicated arm for the route's 401 path.
    if (source.reasons.includes("unauthenticated")) return { kind: "unauthenticated" };
    // A pure tenant/existence failure stays indistinguishable from absence.
    if (source.reasons.length === 1 && source.reasons[0] === "tenant-mismatch") {
      return { kind: "not_found" };
    }
    return { kind: "not_eligible", reasons: source.reasons };
  }

  const { report, workOrder, items } = source.data;

  // Defense in depth: the route-resolved dealer must be the report's dealer.
  if (report.dealer_id !== dealerId) return { kind: "not_found" };

  // ── Best-effort NON-MONETARY display enrichment. The tenant binding of the
  //    customer and vehicle is already PROVEN by the eligibility judgment; a
  //    failed enrichment read falls back to the guaranteed name facts rather
  //    than blocking an eligible report.
  let customer: WorkReportSource["customer"] = null;
  let vehicle: WorkReportSource["vehicle"] = null;
  const supabase = await createClient();
  const { data: enrichment } = await supabase
    .from("work_orders")
    .select(`
      id,
      customers ( last_name, first_name, phone, email, postal_code, address1, is_business ),
      vehicles  ( maker, model, year, grade, plate_number, color, mileage )
    `)
    .eq("id", workOrder.id)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  if (enrichment) {
    const row = enrichment as unknown as {
      customers: WorkReportSource["customer"];
      vehicles: WorkReportSource["vehicle"];
    };
    customer = row.customers ?? null;
    vehicle = row.vehicles ?? null;
  }
  if (!customer) {
    customer = {
      last_name:   source.data.customer.last_name,
      first_name:  source.data.customer.first_name,
      phone:       null,
      email:       null,
      postal_code: null,
      address1:    null,
      is_business: null,
    } as WorkReportSource["customer"];
  }
  if (!vehicle) {
    vehicle = {
      maker:        source.data.vehicle.maker,
      model:        source.data.vehicle.model,
      year:         null,
      grade:        null,
      plate_number: source.data.vehicle.plate_number,
      color:        null,
      mileage:      null,
    } as WorkReportSource["vehicle"];
  }

  // ── Build the PDF source SOLELY from proven canonical facts:
  //    database-allocated number, server-derived date, the completed work
  //    order's actual end, and the confirmed monetary-free snapshot rows.
  return {
    kind: "ok",
    source: {
      reportNumber:    (report.report_number ?? "").trim(),
      reportDate:      (report.report_date ?? "").trim(),
      workDate:        (workOrder.actual_end_at ?? "").trim(),
      customerMessage: report.customer_message ?? null,
      customer,
      vehicle,
      items: items.map((it) => ({
        category:    it.category,
        item_name:   it.item_name,
        description: it.description,
        sort_order:  it.sort_order,
      })),
    },
  };
}
