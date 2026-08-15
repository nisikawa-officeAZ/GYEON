// B3-B1B I2 — persisted monthly-statement list route. Fully separate from the legacy
// non-persisted /pdf/statement preview flow (never imported here).

import MainLayout from "@/components/layout/MainLayout";
import { getMonthlyStatements } from "@/lib/monthly-statements/get-monthly-statements";
import { getPayableCustomers } from "@/lib/payments/get-payments";
import MonthlyStatementsClient from "@/components/monthly-statements/MonthlyStatementsClient";

export const metadata = { title: "月次請求書 | DealerOS" };

export default async function MonthlyStatementsPage() {
  const [statements, customers] = await Promise.all([
    getMonthlyStatements(),
    getPayableCustomers(),
  ]);

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <MonthlyStatementsClient initialStatements={statements} customers={customers} />
      </div>
    </MainLayout>
  );
}
