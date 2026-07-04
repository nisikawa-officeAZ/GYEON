import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getEstimate } from "@/lib/estimates/get-estimate";
import EstimateDetailView from "@/components/estimates/EstimateDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

// Read-only full-page Estimate detail (Phase 1). getEstimate is dealer-scoped
// (id AND dealer_id) and returns null for a foreign/invalid id → 404.
export default async function EstimateDetailPage({ params }: Props) {
  const { id } = await params;
  const estimate = await getEstimate(id);
  if (!estimate) notFound();

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-4">
        <EstimateDetailView estimate={estimate} />
      </div>
    </MainLayout>
  );
}
