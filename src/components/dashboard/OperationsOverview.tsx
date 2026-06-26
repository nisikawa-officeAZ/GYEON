"use client";

// Dealer Owner Dashboard — Operations Overview card (Sprint 12A)
// Shows work order and estimate counts safe for all roles (no revenue data).
// Metrics referenced: dealer_operations.active_jobs_in_shop,
//   work_orders.open_work_orders, estimates.pending_estimates

import Link from "next/link";
import type { WorkOrderCounts, EstimateCounts } from "@/lib/dashboard/get-dashboard-summary";

interface Props {
  workOrders: WorkOrderCounts;
  estimates:  EstimateCounts;
  customers:  number;
  vehicles:   number;
}

interface StatItemProps {
  label:  string;
  value:  number;
  href:   string;
  color?: "blue" | "amber" | "green" | "red" | "slate";
}

function StatItem({ label, value, href, color = "slate" }: StatItemProps) {
  const valueColor =
    color === "blue"  ? "text-blue-400"  :
    color === "amber" ? "text-amber-400" :
    color === "green" ? "text-green-400" :
    color === "red"   ? "text-red-400"   :
    "text-slate-300";

  return (
    <Link
      href={href}
      className="flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02] -mx-4 px-4 transition-colors"
    >
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>{value.toLocaleString()}</span>
    </Link>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
        <span className="text-base">{icon}</span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export default function OperationsOverview({ workOrders, estimates, customers, vehicles }: Props) {
  const activeJobs = workOrders.scheduled + workOrders.in_progress;
  const pendingEst = estimates.draft + estimates.sent;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Work Orders */}
      <SectionCard title="作業管理" icon="🔧">
        <StatItem label="施工中"     value={workOrders.in_progress} href="/work-orders" color="amber" />
        <StatItem label="予定"       value={workOrders.scheduled}   href="/work-orders" color="blue"  />
        <StatItem label="本日アクティブ" value={activeJobs}          href="/work-orders" color="blue"  />
        <StatItem label="完了 (累計)" value={workOrders.completed}   href="/work-orders" color="green" />
        {workOrders.on_hold > 0 && (
          <StatItem label="保留中"   value={workOrders.on_hold}     href="/work-orders" color="red"   />
        )}
      </SectionCard>

      {/* Estimates */}
      <SectionCard title="見積もり" icon="📋">
        <StatItem label="下書き"       value={estimates.draft}    href="/estimates" color="slate" />
        <StatItem label="送付済・承認待" value={estimates.sent}     href="/estimates" color="amber" />
        <StatItem label="承認済"       value={estimates.approved} href="/estimates" color="green" />
        {pendingEst > 0 && (
          <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
            <span className="text-[10px] text-slate-500">対応待ち合計</span>
            <span className="text-[11px] font-bold text-blue-400 bg-blue-950/30 px-2 py-0.5 rounded border border-blue-800/40">
              {pendingEst}件
            </span>
          </div>
        )}
      </SectionCard>

      {/* Customers + Vehicles */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/customers"
          className="rounded-xl border border-slate-800 bg-[#0a0f1a] p-4 flex flex-col gap-1 hover:border-slate-700 transition-colors"
        >
          <span className="text-base">👥</span>
          <span className="text-xl font-bold text-slate-100">{customers.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500">顧客数</span>
        </Link>
        <Link
          href="/vehicles"
          className="rounded-xl border border-slate-800 bg-[#0a0f1a] p-4 flex flex-col gap-1 hover:border-slate-700 transition-colors"
        >
          <span className="text-base">🚗</span>
          <span className="text-xl font-bold text-slate-100">{vehicles.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500">車両数</span>
        </Link>
      </div>
    </div>
  );
}
