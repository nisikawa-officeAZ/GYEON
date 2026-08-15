"use client";

// B3-B1B I2 — monthly-statement list + draft-creation dialog.
//
// Draft creation calls the single server action bound to the atomic D1 RPC and ALWAYS
// navigates to the returned draft id — the RPC may return an existing exact-scope draft,
// so the UI never claims a brand-new draft was created.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MonthlyStatementDB,
  MonthlyStatementStatus,
  monthlyStatementStatusLabel,
} from "@/lib/monthly-statements/monthly-statement-types";
import { createMonthlyStatementDraft } from "@/lib/monthly-statements/create-monthly-statement-draft";
import type { PayableCustomerOption } from "@/lib/payments/payment-types";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<MonthlyStatementStatus, string> = {
  draft:  "bg-amber-600 text-white",
  issued: "bg-green-600 text-white",
  voided: "bg-slate-600 text-slate-300",
};

function customerOptionLabel(c: PayableCustomerOption): string {
  return [c.last_name, c.first_name].filter(Boolean).join(" ") || c.name || "（名称未設定）";
}

function statementCustomerName(s: MonthlyStatementDB): string {
  const snap = s.customer_snapshot as { name?: string; last_name?: string; first_name?: string };
  return [snap?.last_name, snap?.first_name].filter(Boolean).join(" ") || snap?.name || "—";
}

interface MonthlyStatementsClientProps {
  initialStatements: MonthlyStatementDB[];
  customers:         PayableCustomerOption[];
}

export default function MonthlyStatementsClient({ initialStatements, customers }: MonthlyStatementsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [customerId, setCustomerId]   = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");   // YYYY-MM from <input type=month>
  const [error, setError]             = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  function handleCreate() {
    setError(null);
    if (!customerId) { setError("顧客を選択してください"); return; }
    if (!/^\d{4}-\d{2}$/.test(referenceMonth)) { setError("対象月を選択してください"); return; }
    startTransition(async () => {
      // Reference date = first day of the selected month; the RPC derives the closing period.
      const result = await createMonthlyStatementDraft(customerId, `${referenceMonth}-01`);
      if ("error" in result) setError(result.error);
      else router.push(`/monthly-statements/${result.statement.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">月次請求書</h1>
        <button
          onClick={() => { setDialogOpen(true); setError(null); }}
          className="text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors"
        >
          + 月次請求書を作成
        </button>
      </div>

      {initialStatements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">月次請求書がありません</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#1e293b]">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">番号</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">顧客</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">対象期間</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ステータス</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">当月請求額</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">締め残高</th>
              </tr>
            </thead>
            <tbody>
              {initialStatements.map((s) => (
                <tr key={s.id}
                  className="border-b border-slate-800 hover:bg-[#1e293b]/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/monthly-statements/${s.id}`)}>
                  <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">
                    {s.statement_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{statementCustomerName(s)}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {s.period_start} 〜 {s.period_end}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[s.status]}`}>
                      {monthlyStatementStatusLabel(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap hidden sm:table-cell">
                    {s.status === "draft" ? "—" : formatYen(s.current_total)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200 font-medium whitespace-nowrap">
                    {s.status === "draft" ? "—" : formatYen(s.closing_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* draft-creation dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0f172a] rounded-xl shadow-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">月次請求書の下書き</h2>
              <button onClick={() => setDialogOpen(false)}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">顧客</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                  className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full">
                  <option value="">顧客を選択...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{customerOptionLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">対象月</label>
                <input type="month" value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                  className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full" />
                <p className="text-[10px] text-slate-500">
                  ディーラー締め日設定に基づいて対象期間が自動決定されます。同じ期間の下書きが既にある場合はその下書きを開きます。
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                <button onClick={() => setDialogOpen(false)} disabled={pending}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                  キャンセル
                </button>
                <button onClick={handleCreate} disabled={pending}
                  className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
                  {pending ? "作成中..." : "下書きを開く"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
