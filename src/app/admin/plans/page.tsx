import { getDealersAdmin } from "@/lib/admin/get-dealers-admin";
import PlansAdminClient from "./PlansAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans | GYEON Admin" };

export default async function PlansPage() {
  const dealers = await getDealersAdmin();

  const activeTrials  = dealers.filter((d) => d.trial_status === "active").length;
  const endingSoon    = dealers.filter((d) => {
    if (d.trial_status !== "active" || !d.trial_end_date) return false;
    const days = Math.round(
      (new Date(d.trial_end_date).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime()) / 86_400_000
    );
    return days >= 0 && days <= 7;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Plan Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          All dealer plans, trial status, and auto-downgrade configuration
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-3 py-1 rounded-full bg-blue-900/30 text-blue-300 border border-blue-700/40">
          {activeTrials} active trial{activeTrials !== 1 ? "s" : ""}
        </span>
        {endingSoon > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-red-900/30 text-red-300 border border-red-700/40">
            {endingSoon} ending within 7 days
          </span>
        )}
        <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          {dealers.length} total dealers
        </span>
      </div>

      <PlansAdminClient dealers={dealers} />
    </div>
  );
}
