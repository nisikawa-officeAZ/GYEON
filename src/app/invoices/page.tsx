import { getInvoices } from "@/lib/invoices/get-invoices";
import InvoicesClient from "@/components/invoices/InvoicesClient";

export const metadata = { title: "請求書 | DealerOS" };

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <InvoicesClient initialInvoices={invoices} />
    </div>
  );
}
