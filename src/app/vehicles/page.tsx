import MainLayout      from "@/components/layout/MainLayout";
import VehiclesClient  from "@/components/vehicles/VehiclesClient";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import { getCustomers } from "@/lib/customers/get-customers";

export default async function VehiclesPage() {
  const [vehicles, customers] = await Promise.all([
    getVehicles(),
    getCustomers(),
  ]);

  return (
    <MainLayout>
      <VehiclesClient vehicles={vehicles} customers={customers} />
    </MainLayout>
  );
}
