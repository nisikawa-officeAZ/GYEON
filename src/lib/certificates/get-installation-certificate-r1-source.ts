"use server";

import { getWorkReportSource } from "@/lib/completion-reports/get-completion-report";
import type { WorkReportNotReadyReason } from "@/lib/completion-reports/completion-report-types";
import { createClient } from "@/lib/supabase/server";
import {
  projectInstallationCertificateR1,
  type InstallationCertificateR1NotReadyReason,
  type InstallationCertificateR1Projection,
  type InstallationCertificateR1Source,
} from "./installation-certificate-r1-contract";

export type GetInstallationCertificateR1SourceResult =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | {
      readonly kind: "not_eligible";
      readonly reasons: readonly InstallationCertificateR1NotReadyReason[];
    }
  | { readonly kind: "ok"; readonly projection: InstallationCertificateR1Projection };

interface EnrichmentRow {
  customers: {
    last_name: string | null;
    first_name: string | null;
    is_business: boolean | null;
  } | null;
  vehicles: {
    maker: string | null;
    model: string | null;
    year: string | null;
    grade: string | null;
    vin: string | null;
    plate_number: string | null;
    color: string | null;
  } | null;
}

const hasReason = (
  reasons: readonly WorkReportNotReadyReason[],
  reason: WorkReportNotReadyReason,
): boolean => reasons.includes(reason);

export async function getInstallationCertificateR1Source(
  completionReportId: string,
): Promise<GetInstallationCertificateR1SourceResult> {
  if (typeof completionReportId !== "string" || completionReportId.trim() === "") {
    return { kind: "invalid_request" };
  }

  try {
    // The shared source is the only authority and is intentionally called once.
    const shared = await getWorkReportSource(completionReportId.trim());
    if (!shared.ready) {
      if (hasReason(shared.reasons, "unauthenticated")) return { kind: "unauthenticated" };
      if (hasReason(shared.reasons, "tenant-mismatch")) return { kind: "not_found" };
      return { kind: "not_eligible", reasons: shared.reasons };
    }

    const { report, workOrder, items } = shared.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("work_orders")
      .select(`
        customers ( last_name, first_name, is_business ),
        vehicles  ( maker, model, year, grade, vin, plate_number, color )
      `)
      .eq("id", workOrder.id)
      .eq("dealer_id", report.dealer_id)
      .maybeSingle();

    if (error || !data) return { kind: "not_found" };
    const enrichment = data as unknown as EnrichmentRow;
    if (!enrichment.customers || !enrichment.vehicles) return { kind: "not_found" };

    const source: InstallationCertificateR1Source = {
      customer: {
        lastName: enrichment.customers.last_name,
        firstName: enrichment.customers.first_name,
        isBusiness: enrichment.customers.is_business,
      },
      vehicle: {
        maker: enrichment.vehicles.maker,
        model: enrichment.vehicles.model,
        year: enrichment.vehicles.year,
        grade: enrichment.vehicles.grade,
        vin: enrichment.vehicles.vin,
        plate: enrichment.vehicles.plate_number,
        color: enrichment.vehicles.color,
      },
      appliedAt: workOrder.actual_end_at,
      technicianName: workOrder.assigned_staff,
      items: items.map((item) => ({
        category: item.category,
        itemName: item.item_name,
        description: item.description,
        sortOrder: item.sort_order,
      })),
    };

    const projected = projectInstallationCertificateR1(source);
    if (!projected.ready) return { kind: "not_eligible", reasons: projected.reasons };
    return { kind: "ok", projection: projected.projection };
  } catch {
    // Never expose request, row, UUID, SQL, or Supabase exception details.
    return { kind: "not_found" };
  }
}
