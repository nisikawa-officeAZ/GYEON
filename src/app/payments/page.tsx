import { getPayments } from "@/lib/payments/get-payments";
import PaymentsClient from "@/components/payments/PaymentsClient";

export const metadata = { title: "入金管理 | DealerOS" };

export default async function PaymentsPage() {
  const payments = await getPayments();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PaymentsClient initialPayments={payments} />
    </div>
  );
}
