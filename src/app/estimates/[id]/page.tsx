import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getEstimate } from "@/lib/estimates/get-estimate";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import EstimateDetailView from "@/components/estimates/EstimateDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * F1-R1 — the dealer display name for the LINE default message: the SAME
 * dealer_settings.business_name field the send path itself reads. Resolved
 * server-side for the SESSION dealer only; any failure resolves to null, which
 * omits the template line (never an unresolved token, never a blocked page).
 */
async function getDealerDisplayName(): Promise<string | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("dealer_settings")
      .select("business_name")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();
    const name = (data as { business_name: string | null } | null)?.business_name;
    return name && name.trim() ? name : null;
  } catch {
    return null;
  }
}

// Read-only full-page Estimate detail (Phase 1). getEstimate is dealer-scoped
// (id AND dealer_id) and returns null for a foreign/invalid id → 404.
export default async function EstimateDetailPage({ params }: Props) {
  const { id } = await params;
  const estimate = await getEstimate(id);
  if (!estimate) notFound();

  const dealerDisplayName = await getDealerDisplayName();

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-4">
        <EstimateDetailView estimate={estimate} dealerDisplayName={dealerDisplayName} />
      </div>
    </MainLayout>
  );
}
