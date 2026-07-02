"use client";

// DealerOS — Accounts Receivable summary panel (Phase E8.6). Loads the
// dealer-scoped AR summary and shows Outstanding Balance, Last Payment Date,
// Outstanding Invoice Count, and computed Statement Status. Hidden when the
// customer has no invoices. Safe rendering for empty/null values.

import { useEffect, useState } from "react";
import { getCustomerAccountsReceivable } from "@/lib/accounts-receivable/get-customer-ar";
import { AR_STATUS_LABEL, type AccountsReceivableSummary, type ARStatus } from "@/lib/accounts-receivable/ar-calculations";

const card   = "bg-[#111827] rounded-2xl border border-white/[.08] p-5";
const secHdr = "text-[11px] font-bold text-slate-400 uppercase tracking-[1px] mb-3";
const yen = (n: number) => "¥" + (Number.isFinite(n) ? n : 0).toLocaleString("ja-JP");

const STATUS_STYLE: Record<ARStatus, string> = {
  draft:          "bg-slate-700/40 text-slate-300 border-slate-600",
  issued:         "bg-blue-500/15 text-blue-400 border-blue-500/30",
  partially_paid: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  paid:           "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  overdue:        "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function AccountsReceivablePanel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<AccountsReceivableSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCustomerAccountsReceivable(customerId)
      .then((r) => { if (!cancelled) { if (!("error" in r)) setData(r); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading || !data || data.invoiceCount === 0) return null; // nothing to show

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <div className={secHdr + " mb-0"}>売掛状況</div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[data.status]}`}>
          {AR_STATUS_LABEL[data.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="未回収残高" value={yen(data.outstanding)} accent={data.outstanding > 0} />
        <Stat label="未回収件数" value={`${data.outstandingCount} 件`} />
        <Stat label="最終入金日" value={data.lastPaymentDate ?? "—"} />
        <Stat label="次回支払期限" value={data.nextDueDate ?? "—"} warn={data.overdueCount > 0} />
      </div>

      {data.overdueCount > 0 && (
        <p className="text-xs text-red-400 mt-3">期限超過 {data.overdueCount} 件</p>
      )}
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-2.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${warn ? "text-red-400" : accent ? "text-blue-400" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}
