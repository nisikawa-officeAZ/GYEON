// B3-B1B I2 — persisted monthly-statement detail route.

import MainLayout from "@/components/layout/MainLayout";
import { getMonthlyStatementDetail } from "@/lib/monthly-statements/get-monthly-statement-detail";
import MonthlyStatementDetailClient from "@/components/monthly-statements/MonthlyStatementDetailClient";

export const metadata = { title: "月次請求書詳細 | DealerOS" };

export default async function MonthlyStatementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getMonthlyStatementDetail(id);

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {"error" in result ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">{result.error}</p>
          </div>
        ) : (
          <MonthlyStatementDetailClient detail={result.detail} />
        )}
      </div>
    </MainLayout>
  );
}
