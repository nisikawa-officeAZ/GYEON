import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getEstimate } from "@/lib/estimates/get-estimate";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import EstimateEditor from "@/components/estimates/EstimateEditor";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";

interface Props {
  params: Promise<{ id: string }>;
}

// Full-page Estimate EDIT (Phase 2). getEstimate is dealer-scoped (id AND dealer_id)
// and returns null for a foreign/invalid id → 404.
export default async function EstimateEditPage({ params }: Props) {
  const { id } = await params;
  const [estimate, customers, vehicles, rank] = await Promise.all([
    getEstimate(id),
    getCustomers(),
    getVehicles(),
    getAuthoritativeShopRank(),
  ]);
  if (!estimate) notFound();

  // Rank is authorization input, not a display preference. Never guess or fall
  // back to Detailer when the authoritative read is unavailable.
  if (!rank.ok) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-16 text-center" role="alert">
          <h1 className="text-xl font-bold text-slate-100 mb-3">見積を編集できません</h1>
          <p className="text-sm text-slate-300">店舗ランクを確認できませんでした。時間をおいて再度お試しください。</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <EstimateEditor mode="edit" estimate={estimate} customers={customers} vehicles={vehicles} shopRank={rank.rank} />
      </div>
    </MainLayout>
  );
}
