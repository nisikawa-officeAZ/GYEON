import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getEstimate } from "@/lib/estimates/get-estimate";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import EstimateEditor from "@/components/estimates/EstimateEditor";

interface Props {
  params: Promise<{ id: string }>;
}

// Full-page Estimate EDIT (Phase 2). getEstimate is dealer-scoped (id AND dealer_id)
// and returns null for a foreign/invalid id → 404.
export default async function EstimateEditPage({ params }: Props) {
  const { id } = await params;
  const [estimate, customers, vehicles] = await Promise.all([
    getEstimate(id),
    getCustomers(),
    getVehicles(),
  ]);
  if (!estimate) notFound();

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <EstimateEditor mode="edit" estimate={estimate} customers={customers} vehicles={vehicles} />
      </div>
    </MainLayout>
  );
}
