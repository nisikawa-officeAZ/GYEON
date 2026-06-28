import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import PointsClient from "@/components/points/PointsClient";
import { getPointCards } from "@/lib/points/points";
import { getCustomers } from "@/lib/customers/get-customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "ポイント" };

export default async function PointsPage() {
  const [cards, customers] = await Promise.all([
    getPointCards().catch(() => []),
    getCustomers().catch(() => []),
  ]);

  const customerOptions = (customers ?? []).map((c) => ({
    id:   c.id,
    name: [c.last_name, c.first_name].filter(Boolean).join(" ") || "—",
  }));

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
        <PageTitle title="ポイント" subtitle="顧客ポイントカード(基盤)" />
        <PointsClient initialCards={cards} customers={customerOptions} />
      </div>
    </MainLayout>
  );
}
