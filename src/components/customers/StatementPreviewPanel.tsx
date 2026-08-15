"use client";

// DealerOS — Statement Preview panel (Phase E8.5). Shown only for closing-billing
// customers (parent gates on billing.mode). Loads the non-persisted preview from
// the server service and offers the on-demand Statement PDF. Renders safely for
// missing vehicle / registration / totals and for the empty-invoice state.

import { useEffect, useState } from "react";
import { getStatementPreview, type StatementPreviewResult } from "@/lib/customer-billing/statement-preview";

const card   = "bg-[#111827] rounded-2xl border border-white/[.08] p-5";
const secHdr = "text-[11px] font-bold text-slate-400 uppercase tracking-[1px] mb-3";
const yen = (n: number) => "¥" + (Number.isFinite(n) ? n : 0).toLocaleString("ja-JP");

export default function StatementPreviewPanel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<StatementPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStatementPreview(customerId)
      .then((r) => {
        if (cancelled) return;
        if ("error" in r) setErr(r.error);
        else setData(r);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setErr("統合請求の読み込みに失敗しました"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <div className={card}><div className={secHdr}>統合請求プレビュー</div><p className="text-sm text-slate-500">読み込み中…</p></div>;
  if (err) return <div className={card}><div className={secHdr}>統合請求プレビュー</div><p className="text-sm text-red-400">{err}</p></div>;
  if (!data || !data.eligible) return null; // per-invoice billing → no preview

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <div className={secHdr + " mb-0"}>統合請求プレビュー</div>
        <a
          href={`/pdf/statement?customerId=${encodeURIComponent(customerId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          統合請求書PDF
        </a>
      </div>

      <div className="flex flex-col gap-1 text-sm text-slate-300 mb-4">
        {data.billingPeriod && (
          <div className="flex gap-3"><span className="text-slate-500 w-24 shrink-0">請求期間</span><span>{data.billingPeriod.periodStart} 〜 {data.billingPeriod.periodEnd}</span></div>
        )}
        {data.paymentDueDate && (
          <div className="flex gap-3"><span className="text-slate-500 w-24 shrink-0">支払期限</span><span>{data.paymentDueDate}</span></div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Stat label="請求件数" value={`${data.invoiceCount} 件`} />
        <Stat label="小計" value={yen(data.subtotal)} />
        <Stat label="消費税" value={yen(data.tax)} />
        <Stat label="合計" value={yen(data.grandTotal)} accent />
      </div>

      {data.invoiceCount === 0 || data.detail.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">この期間の対象請求書はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="text-left py-2 pr-3">発行日</th>
                <th className="text-left py-2 pr-3">車両</th>
                <th className="text-left py-2 pr-3">登録番号</th>
                <th className="text-left py-2 pr-3">区分</th>
                <th className="text-left py-2 pr-3">請求番号</th>
                <th className="text-right py-2">金額</th>
              </tr>
            </thead>
            <tbody>
              {data.detail.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/60 last:border-b-0">
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{r.issueDate}</td>
                  <td className="py-2 pr-3 text-slate-200">{r.vehicleName}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{r.registrationNumber}</td>
                  <td className="py-2 pr-3 text-slate-400">{r.serviceCategory}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{r.invoiceNumber}</td>
                  <td className="py-2 text-right text-slate-200 whitespace-nowrap">{yen(r.invoiceTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-2.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${accent ? "text-blue-400" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
