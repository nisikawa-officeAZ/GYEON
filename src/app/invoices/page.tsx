import { getInvoices } from "@/lib/invoices/get-invoices";
import InvoicesClient  from "@/components/invoices/InvoicesClient";
import MainLayout      from "@/components/layout/MainLayout";
import FeatureGate     from "@/components/plans/FeatureGate";

export const metadata = { title: "請求書 | DealerOS" };

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <MainLayout>
      <FeatureGate feature="invoices">
        <div className="p-6 max-w-7xl mx-auto">
          <InvoicesClient initialInvoices={invoices} />
        </div>
      </FeatureGate>
    </MainLayout>
  );
}
