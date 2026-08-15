import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import CustomerDetailClient from "@/components/customers/CustomerDetailClient";
import { getCustomerById } from "@/lib/customers/get-customer";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import { resolveDealerBillingMethod } from "@/lib/customer-billing/billing-method";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customer = await getCustomerById(id);
  if (!customer) notFound();

  // Reuse the dealer-scoped vehicle fetch and filter to this customer.
  const allVehicles = await getVehicles();
  const vehicles = allVehicles.filter((v) => v.customer_id === id);

  const ds = await getCanonicalDealerSettings();
  const billing = resolveDealerBillingMethod(ds.dealer_closing_day, ds.dealer_payment_day);

  return (
    <MainLayout>
      <CustomerDetailClient customer={customer} vehicles={vehicles} billing={billing} />
    </MainLayout>
  );
}
