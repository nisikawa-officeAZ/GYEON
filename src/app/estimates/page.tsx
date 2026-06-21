import MainLayout       from "@/components/layout/MainLayout";
import EstimatesClient  from "@/components/estimates/EstimatesClient";
import { getEstimates } from "@/lib/estimates/get-estimates";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles }  from "@/lib/vehicles/get-vehicles";

export default async function EstimatesPage() {
  let estimates: Awaited<ReturnType<typeof getEstimates>>  = [];
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  let vehicles:  Awaited<ReturnType<typeof getVehicles>>  = [];

  try {
    [estimates, customers, vehicles] = await Promise.all([
      getEstimates(),
      getCustomers(),
      getVehicles(),
    ]);
  } catch (err) {
    console.error("[EstimatesPage] data fetch failed:", err);
  }

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
