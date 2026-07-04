import MainLayout from "@/components/layout/MainLayout";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import EstimateEditor from "@/components/estimates/EstimateEditor";

interface Props {
  searchParams: Promise<{ customer_id?: string; vehicle_id?: string }>;
}

// Full-page Estimate CREATE. The "+新規見積" button navigates here; new customers/
// vehicles are registered via the onboarding flow ("顧客・車両登録") which hands off
// with ?customer_id=&vehicle_id= preselected. Create mode selects existing records
// (no inline creation / OCR here — those live in the onboarding flow, unchanged).
export default async function EstimateNewPage({ searchParams }: Props) {
  const { customer_id, vehicle_id } = await searchParams;
  const [customers, vehicles] = await Promise.all([getCustomers(), getVehicles()]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <EstimateEditor mode="create" customers={customers} vehicles={vehicles} defaultCustomerId={customer_id} defaultVehicleId={vehicle_id} />
      </div>
    </MainLayout>
  );
}
