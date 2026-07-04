import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getLogisticsDashboardStats } from "@/lib/admin/logistics/get-logistics-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "物流ダッシュボード | GYEON Admin" };

function StatCard({
  label,
  value,
  color,
  description,
}: {
  label:       string;
  value:       number;
  color:       string;
  description: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color} mb-1`}>{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default async function LogisticsDashboardPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const stats = await getLogisticsDashboardStats();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">物流ダッシュボード</h1>
        <p className="text-sm text-slate-400 mt-0.5">倉庫・出荷管理の概要</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="本日の入荷"
          value={stats.todayReceiving}
          color="text-emerald-400"
          description="本日記録された入荷"
        />
        <StatCard
          label="未処理注文"
          value={stats.pendingOrders}
          color="text-blue-400"
          description="申請済み / 承認済みの注文"
        />
        <StatCard
          label="バックオーダー中"
          value={stats.backordering}
          color="text-amber-400"
          description="入荷待ちの商品"
        />
        <StatCard
          label="出荷待ち"
          value={stats.pendingShipments}
          color="text-purple-400"
          description="準備完了 / ピッキング / 梱包済み"
        />
        <StatCard
          label="本日出荷"
          value={stats.shippedToday}
          color="text-green-400"
          description="出荷済みとして記録された出荷"
        />
        <StatCard
          label="在庫不足アラート"
          value={stats.lowStockAlerts}
          color={stats.lowStockAlerts > 0 ? "text-red-400" : "text-slate-400"}
          description="在庫ゼロの商品"
        />
        <StatCard
          label="本日の在庫調整"
          value={stats.todayAdjustments}
          color={stats.todayAdjustments > 0 ? "text-rose-400" : "text-slate-400"}
          description="本日記録された在庫調整"
        />
      </div>

      {/* Module status panel */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">モジュール状態</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: "入荷ワークフロー",       status: "active" },
            { label: "在庫概要",              status: "active" },
            { label: "バックオーダーセンター",  status: "active" },
            { label: "出荷キュー",            status: "active" },
            { label: "棚卸し",                status: "active" },
            { label: "在庫調整",              status: "active" },
            { label: "在庫移動履歴",           status: "active" },
            { label: "発注入荷",              status: "active" },
          ].map((m) => (
            <div key={m.label} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
              <span className="text-slate-300">{m.label}</span>
              {m.status === "active" ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  稼働中
                </span>
              ) : (
                <span className="text-xs text-slate-600">近日公開</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
