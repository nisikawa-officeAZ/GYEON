import MainLayout      from "@/components/layout/MainLayout";
import CustomersClient from "@/components/customers/CustomersClient";
import { getCustomers } from "@/lib/customers/get-customers";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <MainLayout>
      <CustomersClient customers={customers} />
    </MainLayout>
  );
}
