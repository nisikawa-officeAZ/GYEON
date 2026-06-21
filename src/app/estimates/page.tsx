import MainLayout       from "@/components/layout/MainLayout";
import EstimatesClient  from "@/components/estimates/EstimatesClient";
import { getEstimates } from "@/lib/estimates/get-estimates";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles }  from "@/lib/vehicles/get-vehicles";

export default async function EstimatesPage() {
  const [estimates, customers, vehicles] = await Promise.all([
    getEstimates(),
    getCustomers(),
    getVehicles(),
  ]);

  return (
    <MainLayout>
      <EstimatesClient
        estimates={estimates}
        customers={customers}
        vehicles={vehicles}
      />
    </MainLayout>
  );
}
