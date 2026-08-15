import MainLayout      from "@/components/layout/MainLayout";
import CustomersClient from "@/components/customers/CustomersClient";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles }  from "@/lib/vehicles/get-vehicles";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import { resolveDealerBillingMethod } from "@/lib/customer-billing/billing-method";

export default async function CustomersPage() {
  const [customers, vehicles, ds] = await Promise.all([
    getCustomers(),
    getVehicles(),
    getCanonicalDealerSettings(),
  ]);
  const billing = resolveDealerBillingMethod(ds.dealer_closing_day, ds.dealer_payment_day);

  return (
    <MainLayout>
      <CustomersClient customers={customers} vehicles={vehicles} billing={billing} />
    </MainLayout>
  );
}
