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
  CompletionReportItemDB,
  WorkReportNotReadyReason,
} from "./completion-report-types";
import {
  evaluateWorkReportEligibility,
  type WorkReportEligibilityFacts,
} from "./completion-report-eligibility-core";
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
    // GDA-1W boundary: the estimate joined here (with its totals) exists ONLY
    // for the legacy on-screen preview of the linked ESTIMATE. It is a
    // proposal, never performed-work authority, and nothing in the work-report
    // path below reads it. The authoritative loader is getWorkReportSource.
    work_order: wo as CompletionReportFullData["work_order"] ?? null,
    files:      (files as WorkOrderFileDB[]) ?? [],
  };
}

// ─── GDA-1W work-report source loader (contract §8) ──────────────────────────
// ONE fail-closed loader consumed by BOTH the completion-report UI and the
// authenticated PDF route (the route re-invokes it inside its own genuine
// request scope and remains the final authority). It:
//   * loads the canonical same-tenant report, completed work-order facts, and
//     the CONFIRMED monetary-free snapshot rows from completion_report_items
//     ordered by sort_order — and nothing else;
//   * selects NO quantity, price, cost, tax, discount, total, margin, payment,
//     or invoice column anywhere, and has NO estimate-item fallback: when the
//     snapshot is not confirmed the result is a reason, never estimate data;
//   * judges readiness with the shared pure eligibility core, so the UI shows
//     the exact same reasons the PDF route enforces.

/** The monetary-free performed-work rows plus the header facts a renderer needs. */
export interface WorkReportSourceData {
  report: CompletionReportDB;
  workOrder: {
    id:                string;
    work_order_number: string | null;
    title:             string | null;
    actual_start_at:   string | null;
    actual_end_at:     string | null;
    assigned_staff:    string | null;
  };
  customer: { last_name: string | null; first_name: string | null };
  vehicle:  { maker: string | null; model: string | null; plate_number: string | null };
  /** Confirmed snapshot rows, sorted by sort_order. The ONLY performed-work source. */
  items: Pick<CompletionReportItemDB, "category" | "item_name" | "description" | "sort_order">[];
}

/** Discriminated: source data exists ONLY when the report is genuinely ready. */
export type WorkReportSourceResult =
  | { ready: true;  data: WorkReportSourceData }
  | { ready: false; reasons: readonly WorkReportNotReadyReason[] };

const NOT_READY = (
  ...reasons: WorkReportNotReadyReason[]
): WorkReportSourceResult => ({ ready: false, reasons });

export async function getWorkReportSource(
  reportId: string,
): Promise<WorkReportSourceResult> {
  const supabase = await createClient();

  // ── Genuine request-scope actor and dealer context, fail-closed. ──
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authError ? null : authData.user?.id ?? null;
  const dealer = await getCurrentDealer();
  if (!userId || !dealer) return NOT_READY("unauthenticated");
  const dealerId = dealer.dealer_id;

  // ── Load the facts, each scoped to the caller's dealer. Any read failure or
  //    absence flows into the eligibility judgment as a null fact (fail-closed);
  //    nothing is defaulted or repaired.
  // ONE string literal (never concatenated): supabase-js's type-level query
  // parser only parses a single literal; an expression widens the row to
  // GenericStringError and destroys the typed shape (C4R).
  const { data: report } = await supabase
    .from("completion_reports")
    .select(
      "id, dealer_id, work_order_id, report_number, title, status, report_date, customer_message, internal_memo, pdf_file_path, pdf_file_url, is_shared, shared_at, next_maintenance_date, created_at, updated_at, performed_work_confirmed_at, performed_work_confirmed_by, performed_work_version, performed_work_updated_at",
    )
    .eq("id",        reportId)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  if (!report) return NOT_READY("tenant-mismatch");

  // Same single-literal rule as above (C4R).
  const { data: workOrder } = await supabase
    .from("work_orders")
    .select(
      "id, dealer_id, work_order_number, title, status, actual_start_at, actual_end_at, assigned_staff, customer_id, vehicle_id, estimate_id, deleted_at",
    )
    .eq("id",        report.work_order_id)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  // The canonical report for the work order, resolved INDEPENDENTLY through
  // the unique (dealer_id, work_order_id) index — never assumed from the id
  // the caller supplied.
  const { data: canonical } = await supabase
    .from("completion_reports")
    .select("id")
    .eq("dealer_id",     dealerId)
    .eq("work_order_id", report.work_order_id)
    .maybeSingle();

  const { data: customer } = workOrder?.customer_id
    ? await supabase
        .from("customers")
        .select("id, dealer_id, last_name, first_name")
        .eq("id",        workOrder.customer_id)
        .eq("dealer_id", dealerId)
        .maybeSingle()
    : { data: null };

  const { data: vehicle } = workOrder?.vehicle_id
    ? await supabase
        .from("vehicles")
        .select("id, dealer_id, maker, model, plate_number")
        .eq("id",        workOrder.vehicle_id)
        .eq("dealer_id", dealerId)
        .maybeSingle()
    : { data: null };

  // A linked estimate contributes ONLY binding facts (no monetary column, no
  // items). Its absence never blocks; a broken binding is a tenant reason.
  const { data: estimate } = workOrder?.estimate_id
    ? await supabase
        .from("estimates")
        .select("dealer_id, customer_id, vehicle_id")
        .eq("id",        workOrder.estimate_id)
        .eq("dealer_id", dealerId)
        .maybeSingle()
    : { data: null };

  // The confirmed snapshot: completion_report_items ONLY, in sort order,
  // material columns only.
  const { data: items, error: itemsError } = await supabase
    .from("completion_report_items")
    .select("category, item_name, description, sort_order")
    .eq("dealer_id",            dealerId)
    .eq("completion_report_id", report.id)
    .order("sort_order", { ascending: true });

  // ── One shared judgment; deleted work orders fail closed as not-loaded. ──
  const facts: WorkReportEligibilityFacts = {
    actor: { userId, dealerId },
    report,
    workOrder: workOrder && workOrder.deleted_at === null ? workOrder : null,
    customer:  customer ?? null,
    vehicle:   vehicle  ?? null,
    estimate:  workOrder?.estimate_id ? estimate ?? { dealer_id: "", customer_id: null, vehicle_id: null } : null,
    canonicalReportId: canonical?.id ?? null,
    confirmedItems: itemsError ? null : items ?? [],
  };

  const eligibility = evaluateWorkReportEligibility(facts);
  if (!eligibility.ready) return { ready: false, reasons: eligibility.reasons };

  // Ready is proven, so the non-null facts below are established.
  return {
    ready: true,
    data: {
      report: report as CompletionReportDB,
      workOrder: {
        id:                workOrder!.id,
        work_order_number: workOrder!.work_order_number,
        title:             workOrder!.title,
        actual_start_at:   workOrder!.actual_start_at,
        actual_end_at:     workOrder!.actual_end_at,
        assigned_staff:    workOrder!.assigned_staff,
      },
      customer: { last_name: customer!.last_name, first_name: customer!.first_name },
      vehicle:  { maker: vehicle!.maker, model: vehicle!.model, plate_number: vehicle!.plate_number },
      items: (items ?? []) as WorkReportSourceData["items"],
    },
  };
}
