"use client";

// Client wrapper that renders the existing EstimateDetail as a full-page (variant="page")
// for the /estimates/[id] route. Reuses EstimateDetail verbatim — presentation only.
// Close returns to the list; 施工指示 returns to the list with ?workorder=<id>, which the
// list (EstimatesClient) turns into the existing work-order modal (no new logic).

import { useRouter } from "next/navigation";
import type { EstimateDB } from "@/lib/estimates/estimate-types";
import type { EstimateRelatedInvoice } from "@/lib/invoices/get-invoice";
import type { SavedInvoiceActions } from "./wizard/production/saved-estimate-invoice-controller";
import EstimateDetail from "./EstimateDetail";

export default function EstimateDetailView({
  estimate,
  dealerDisplayName = null,
  relatedInvoice = null,
  invoiceActions,
}: {
  estimate: EstimateDB;
  /** F1-R1: server-resolved dealer_settings.business_name for the LINE default message. */
  dealerDisplayName?: string | null;
  /** GDA_ESTIMATE_DETAIL_DOCUMENTS_R1: server-read, tenant-scoped minimal invoice fields
   *  for the delivery-note document surface. null means no eligible related invoice. */
  relatedInvoice?: EstimateRelatedInvoice | null;
  /** GDA_ESTIMATE_DETAIL_INVOICE_SAME_PAGE_R1: canonical server actions injected by the route. */
  invoiceActions: SavedInvoiceActions;
}) {
  const router = useRouter();
  const isApproved = estimate.status === "approved" || estimate.status === "APPROVED";

  return (
    <EstimateDetail
      estimate={estimate}
      dealerDisplayName={dealerDisplayName}
      relatedInvoice={relatedInvoice}
      invoiceActions={invoiceActions}
      variant="page"
      onClose={() => router.push("/estimates")}
      onCreateWorkOrder={isApproved ? () => router.push(`/estimates?workorder=${estimate.id}`) : undefined}
    />
  );
}
