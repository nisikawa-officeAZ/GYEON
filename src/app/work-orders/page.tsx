import MainLayout         from "@/components/layout/MainLayout";
import WorkOrdersClient   from "@/components/work-orders/WorkOrdersClient";
import { getWorkOrders }  from "@/lib/work-orders/get-work-orders";
import { getEstimates }   from "@/lib/estimates/get-estimates";
import { getCustomers }   from "@/lib/customers/get-customers";
import { getVehicles }    from "@/lib/vehicles/get-vehicles";
import FeatureGate        from "@/components/plans/FeatureGate";

export const metadata = {
  title: "Work Orders | DealerOS",
};

export default async function WorkOrdersPage() {
  const [workOrders, estimates, customers, vehicles] = await Promise.all([
    getWorkOrders(),
    getEstimates(),
    getCustomers(),
    getVehicles(),
  ]);

  return (
    <MainLayout>
      <FeatureGate feature="work_orders">
        <WorkOrdersClient
          workOrders={workOrders}
          estimates={estimates}
          customers={customers}
          vehicles={vehicles}
        />
      </FeatureGate>
    </MainLayout>
  );
}
