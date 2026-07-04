import MainLayout from "@/components/layout/MainLayout";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import EstimateEditor from "@/components/estimates/EstimateEditor";

interface Props {
  searchParams: Promise<{ customer_id?: string }>;
}

// Full-page Estimate CREATE (Phase 3). Create mode selects an existing customer /
// vehicle (inline creation + OCR are Phase 4). Reachable by URL; the "+新規見積"
// button repoint is deferred to Phase 4 to preserve the wizard's inline-create/OCR.
export default async function EstimateNewPage({ searchParams }: Props) {
  const { customer_id } = await searchParams;
  const [customers, vehicles] = await Promise.all([getCustomers(), getVehicles()]);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-4">
        <EstimateEditor mode="create" customers={customers} vehicles={vehicles} defaultCustomerId={customer_id} />
      </div>
    </MainLayout>
  );
}
