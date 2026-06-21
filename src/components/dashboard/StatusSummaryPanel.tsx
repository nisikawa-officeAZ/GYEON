"use client";

// PHASE66-B: Status summary panel — estimates / work orders / invoices.
// Extracted from DashboardClient for the branded layout.

import type { EstimateCounts, WorkOrderCounts, InvoiceCounts } from "@/lib/dashboard/get-dashboard-summary";

function StatusBar({ items }: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="flex flex-col gap-2">
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          {items.map(item =>
            item.count > 0 ? (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      {total === 0 && (
        <div className="h-1.5 rounded-full bg-slate-800" />
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
            <span className="text-[10px] text-slate-500">{item.label}</span>
            <span className="text-[10px] font-semibold text-slate-300">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  estimates:  EstimateCounts;
  workOrders: WorkOrderCounts;
  invoices:   InvoiceCounts;
}

export default function StatusSummaryPanel({ estimates: e, workOrders: w, invoices: i }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">見積状況</h3>
        <StatusBar items={[
          { label: "下書き",   count: e.draft,    color: "bg-slate-500" },
          { label: "送付済み", count: e.sent,     color: "bg-blue-500"  },
          { label: "承認",     count: e.approved, color: "bg-green-500" },
          { label: "却下",     count: e.rejected, color: "bg-red-500"   },
          { label: "期限切れ", count: e.expired,  color: "bg-slate-600" },
        ]} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">施工状況</h3>
        <StatusBar items={[
          { label: "予定",       count: w.scheduled,   color: "bg-blue-500"   },
          { label: "施工中",     count: w.in_progress, color: "bg-amber-500"  },
          { label: "完了",       count: w.completed,   color: "bg-green-500"  },
          { label: "保留",       count: w.on_hold,     color: "bg-orange-500" },
          { label: "キャンセル", count: w.cancelled,   color: "bg-slate-600"  },
        ]} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">請求状況</h3>
        <StatusBar items={[
          { label: "下書き",   count: i.draft,          color: "bg-slate-500" },
          { label: "発行済み", count: i.issued,         color: "bg-blue-500"  },
          { label: "一部入金", count: i.partially_paid, color: "bg-amber-500" },
          { label: "入金済み", count: i.paid,           color: "bg-green-500" },
          { label: "期限超過", count: i.overdue,        color: "bg-red-500"   },
        ]} />
      </div>
    </div>
  );
}
