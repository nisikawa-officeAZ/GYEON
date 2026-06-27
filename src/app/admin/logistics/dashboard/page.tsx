import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getLogisticsDashboardStats } from "@/lib/admin/logistics/get-logistics-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logistics Dashboard | GYEON Admin" };

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
        <h1 className="text-xl font-semibold text-white">Logistics Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Warehouse and fulfillment overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Today's Receiving"
          value={stats.todayReceiving}
          color="text-emerald-400"
          description="Stock receipts recorded today"
        />
        <StatCard
          label="Pending Orders"
          value={stats.pendingOrders}
          color="text-blue-400"
          description="Submitted / approved orders"
        />
        <StatCard
          label="Backordering"
          value={stats.backordering}
          color="text-amber-400"
          description="Items waiting for stock"
        />
        <StatCard
          label="Pending Shipments"
          value={stats.pendingShipments}
          color="text-purple-400"
          description="Ready / picking / packed"
        />
        <StatCard
          label="Shipped Today"
          value={stats.shippedToday}
          color="text-green-400"
          description="Shipments marked shipped"
        />
        <StatCard
          label="Low Stock Alerts"
          value={stats.lowStockAlerts}
          color={stats.lowStockAlerts > 0 ? "text-red-400" : "text-slate-400"}
          description="Products at zero stock"
        />
        <StatCard
          label="Today's Adjustments"
          value={stats.todayAdjustments}
          color={stats.todayAdjustments > 0 ? "text-rose-400" : "text-slate-400"}
          description="Stock adjustments recorded today"
        />
      </div>

      {/* Module status panel */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Module Status</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: "Receiving Workflow",     status: "active" },
            { label: "Inventory Overview",     status: "active" },
            { label: "Backorder Center",       status: "active" },
            { label: "Shipment Queue",         status: "active" },
            { label: "棚卸し (Stocktaking)",   status: "active" },
            { label: "Stock Adjustments",      status: "active" },
            { label: "Movement History",       status: "active" },
            { label: "PO Receiving",           status: "active" },
          ].map((m) => (
            <div key={m.label} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
              <span className="text-slate-300">{m.label}</span>
              {m.status === "active" ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Active
                </span>
              ) : (
                <span className="text-xs text-slate-600">Coming Soon</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
