import MainLayout from "@/components/layout/MainLayout";
import PointsClient from "@/components/points/PointsClient";
import { getPointCards, getPointTransactions, getPointsSummary } from "@/lib/points/points";
import { getCustomers } from "@/lib/customers/get-customers";
import { EMPTY_POINTS_SUMMARY } from "@/lib/points/point-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "ポイント" };

export default async function PointsPage() {
  const [cards, customers, transactions, summary] = await Promise.all([
    getPointCards().catch(() => []),
    getCustomers().catch(() => []),
    getPointTransactions().catch(() => []),
    getPointsSummary().catch(() => ({ ...EMPTY_POINTS_SUMMARY })),
  ]);

  const customerOptions = (customers ?? []).map((c) => ({
    id:   c.id,
    name: [c.last_name, c.first_name].filter(Boolean).join(" ") || "—",
  }));

  return (
    <MainLayout>
      <PointsClient
        initialCards={cards}
        customers={customerOptions}
        initialTransactions={transactions}
        summary={summary}
      />
    </MainLayout>
  );
}
