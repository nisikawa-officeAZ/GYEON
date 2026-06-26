// Dealer Owner Dashboard — Revenue Section (Sprint 12A)
//
// SERVER COMPONENT — no "use client" directive.
// Revenue data is rendered server-side only. Never passed as props to any
// "use client" component. Accessible only when canViewFinance(role) passes
// server-side in src/app/dashboard/page.tsx.
//
// Privacy guarantee:
//   - This component is conditionally rendered by the server page.
//   - If the user's role does not satisfy canViewFinance(), this component
//     is never included in the server response — the revenue HTML never
//     reaches the browser for unauthorized users.
//   - No client-side role check. No React context. Server-only authority.
//
// Metrics referenced:
//   - sales.monthly_revenue       → SalesSummary.monthly_sales
//   - sales.revenue_growth_rate   → not yet connected (placeholder)
//   - accounting.monthly_cash_flow → SalesSummary.monthly_received
//   - accounting.accounts_receivable → SalesSummary.outstanding

import Link from "next/link";
import type { SalesSummary, InvoiceCounts } from "@/lib/dashboard/get-dashboard-summary";

interface Props {
  sales:    SalesSummary;
  invoices: InvoiceCounts;
  role:     "owner" | "manager";
}

function fmtYen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000)      return `¥${Math.floor(n / 10_000).toLocaleString("ja-JP")}万`;
  return "¥" + n.toLocaleString("ja-JP");
}

function RevenueCard({
  label,
  value,
  sub,
  color = "text-slate-100",
  href,
}: {
  label: string;
  value: string;
  sub?:  string;
  color?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col gap-1.5 hover:border-slate-700 transition-colors">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 truncate">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function OwnerRevenueSection({ sales, invoices, role }: Props) {
  const roleLabel = role === "owner" ? "オーナー" : "マネージャー";
  const hasOverdue = invoices.overdue > 0;

  return (
    <div className="rounded-xl border border-blue-900/30 bg-[#0a0f1a] overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-900/30 bg-[#0d1525]">
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="text-[11px] font-semibold text-blue-400/70 uppercase tracking-wider">売上・財務</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-900/50 text-blue-600 uppercase tracking-wide">
            {roleLabel}のみ
          </span>
          <Link href="/sales" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            詳細 →
          </Link>
        </div>
      </div>

      {/* Revenue KPI grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <RevenueCard
          label="今月の売上"
          value={fmtYen(sales.monthly_sales)}
          sub="完了請求書合計"
          color={sales.monthly_sales > 0 ? "text-green-400" : "text-slate-500"}
          href="/sales"
        />
        <RevenueCard
          label="今月の入金"
          value={fmtYen(sales.monthly_received)}
          sub="確認済み入金"
          color={sales.monthly_received > 0 ? "text-blue-400" : "text-slate-500"}
          href="/payments"
        />
        <RevenueCard
          label="未収金"
          value={fmtYen(sales.outstanding)}
          sub="全未払い請求書"
          color={sales.outstanding > 0 ? "text-amber-400" : "text-green-400"}
          href="/invoices"
        />
        <RevenueCard
          label="今年の売上"
          value={fmtYen(sales.yearly_sales)}
          sub="年間累計"
          color="text-slate-300"
          href="/sales"
        />
      </div>

      {/* Invoice status row */}
      {(invoices.issued > 0 || hasOverdue) && (
        <div className="mx-4 mb-4 rounded-lg border border-slate-800 bg-[#0f172a] divide-y divide-slate-800">
          {invoices.issued > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-400">未払い請求書</span>
              <Link href="/invoices" className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                {invoices.issued}件
              </Link>
            </div>
          )}
          {hasOverdue && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-xs text-red-400">延滞請求書</span>
              </div>
              <Link href="/invoices" className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors">
                {invoices.overdue}件
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
