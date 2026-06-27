import MainLayout      from "@/components/layout/MainLayout";
import FeatureGate    from "@/components/plans/FeatureGate";
import { getPayments } from "@/lib/payments/get-payments";
import PaymentsClient from "@/components/payments/PaymentsClient";

export const metadata = { title: "入金管理 | DealerOS" };

export default async function PaymentsPage() {
  const payments = await getPayments();

  return (
    <MainLayout>
      <FeatureGate feature="payments">
        <div className="p-6 max-w-7xl mx-auto">
          <PaymentsClient initialPayments={payments} />
        </div>
      </FeatureGate>
    </MainLayout>
  );
}
