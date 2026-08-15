"use client";

// Client wrapper that renders the existing EstimateDetail as a full-page (variant="page")
// for the /estimates/[id] route. Reuses EstimateDetail verbatim — presentation only.
// Close returns to the list; 施工指示 returns to the list with ?workorder=<id>, which the
// list (EstimatesClient) turns into the existing work-order modal (no new logic).

import { useRouter } from "next/navigation";
import type { EstimateDB } from "@/lib/estimates/estimate-types";
import EstimateDetail from "./EstimateDetail";

export default function EstimateDetailView({
  estimate,
  dealerDisplayName = null,
}: {
  estimate: EstimateDB;
  /** F1-R1: server-resolved dealer_settings.business_name for the LINE default message. */
  dealerDisplayName?: string | null;
}) {
  const router = useRouter();
  const isApproved = estimate.status === "approved" || estimate.status === "APPROVED";

  return (
    <EstimateDetail
      estimate={estimate}
      dealerDisplayName={dealerDisplayName}
      variant="page"
      onClose={() => router.push("/estimates")}
      onCreateWorkOrder={isApproved ? () => router.push(`/estimates?workorder=${estimate.id}`) : undefined}
    />
  );
}
