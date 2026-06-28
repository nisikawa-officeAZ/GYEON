import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import CustomerAppClient from "@/components/customer-app/CustomerAppClient";
import { getCustomerAppSettings } from "@/lib/customer-app/customer-app-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "顧客アプリ" };

export default async function CustomerAppPage() {
  const settings = await getCustomerAppSettings().catch(() => null);
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <PageTitle title="顧客アプリ" subtitle="顧客向けアプリの基本設定(基盤)" />
        <CustomerAppClient initial={settings} />
      </div>
    </MainLayout>
  );
}
