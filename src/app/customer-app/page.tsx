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
        <div className="flex items-center justify-between">
          <PageTitle title="顧客アプリ" subtitle="顧客向けアプリの基本設定(基盤)" />
          <a href="/app" target="_blank" rel="noopener noreferrer"
            className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 text-white">
            アプリをプレビュー ↗
          </a>
        </div>
        <CustomerAppClient initial={settings} />
      </div>
    </MainLayout>
  );
}
