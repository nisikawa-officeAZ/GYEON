import MainLayout      from "@/components/layout/MainLayout";
import CustomersClient from "@/components/customers/CustomersClient";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles }  from "@/lib/vehicles/get-vehicles";

export default async function CustomersPage() {
  const [customers, vehicles] = await Promise.all([getCustomers(), getVehicles()]);

  return (
    <MainLayout>
      <CustomersClient customers={customers} vehicles={vehicles} />
    </MainLayout>
  );
}
