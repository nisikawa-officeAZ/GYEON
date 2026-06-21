import { getDealersWithSubscriptionsAdmin } from "@/lib/admin/subscription-actions";
import DealerSubscriptionManager from "@/components/admin/DealerSubscriptionManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions | Admin" };

export default async function AdminSubscriptionsPage() {
  const dealers = await getDealersWithSubscriptionsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Subscription Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ディーラーごとのサブスクリプション・プラン・トライアルを管理します
          </p>
        </div>
      </div>

      <DealerSubscriptionManager dealers={dealers} />
    </div>
  );
}
