"use client";

import { useState, useTransition } from "react";
import { adjustPoints, getPointTransactions, getPointsSummary } from "@/lib/points/points";
import {
  POINT_TXN_LABEL, REFERENCE_LABEL, signedPoints,
  type PointCardWithCustomer, type PointTxnType,
  type PointTransactionRow, type PointsSummary, type PointsFilter,
} from "@/lib/points/point-types";

interface Props {
  initialCards:        PointCardWithCustomer[];
  customers:           { id: string; name: string }[];
  initialTransactions: PointTransactionRow[];
  summary:             PointsSummary;
}

const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replace(/-/g, "/") : "—";
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 flex flex-col gap-1">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${accent}`}>{value.toLocaleString()}<span className="text-xs font-medium text-slate-500 ml-1">pt</span></p>
    </div>
  );
}

export default function PointsClient({ initialCards, customers, initialTransactions, summary }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [txns, setTxns] = useState(initialTransactions);
  const [sum, setSum] = useState(summary);

  // operation form
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<PointTxnType>("earn");
  const [points, setPoints] = useState("100");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // filters
  const [fCustomer, setFCustomer] = useState("");
  const [fType, setFType] = useState<PointTxnType | "all">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [filtering, startFilter] = useTransition();

  function applyFilters(next?: Partial<PointsFilter>) {
    const filter: PointsFilter = {
      customer_id: next?.customer_id ?? fCustomer,
      type:        next?.type ?? fType,
      from:        next?.from ?? fFrom,
      to:          next?.to ?? fTo,
    };
    startFilter(async () => {
      const rows = await getPointTransactions(filter);
      setTxns(rows);
    });
  }

  function clearFilters() {
    setFCustomer(""); setFType("all"); setFFrom(""); setFTo("");
    startFilter(async () => setTxns(await getPointTransactions({})));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(false);
    start(async () => {
      const res = await adjustPoints(customerId, type, Number(points), reason);
      if ("error" in res) { setError(res.error); return; }
      setOk(true);
      const name = customers.find((c) => c.id === customerId)?.name ?? "—";
      setCards((prev) => {
        const i = prev.findIndex((c) => c.customer_id === customerId);
        if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], points_balance: res.balance }; return n; }
        return [{ id: customerId, dealer_id: "", customer_id: customerId, points_balance: res.balance, created_at: "", updated_at: "", customer_name: name } as PointCardWithCustomer, ...prev];
      });
      setReason("");
      // refresh history + summary
      const [rows, s] = await Promise.all([getPointTransactions({ customer_id: fCustomer, type: fType, from: fFrom, to: fTo }), getPointsSummary()]);
      setTxns(rows); setSum(s);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="有効ポイント合計" value={sum.total_active}        accent="text-blue-300" />
        <SummaryCard label="今月の付与"       value={sum.issued_this_month}   accent="text-emerald-300" />
        <SummaryCard label="今月の利用"       value={sum.redeemed_this_month} accent="text-red-300" />
        <SummaryCard label="まもなく失効"     value={sum.expiring_soon}       accent="text-amber-300" />
      </div>

      {/* Operation form */}
      <form onSubmit={submit} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ポイント操作</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inp} required>
            <option value="" className="bg-slate-900">顧客を選択</option>
            {customers.map((c) => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as PointTxnType)} className={inp}>
            <option value="earn"   className="bg-slate-900">{POINT_TXN_LABEL.earn}</option>
            <option value="redeem" className="bg-slate-900">{POINT_TXN_LABEL.redeem}</option>
            <option value="adjust" className="bg-slate-900">{POINT_TXN_LABEL.adjust}</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="ポイント数" className={inp} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="理由(任意)" className={inp} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
            {pending ? "処理中…" : "適用"}
          </button>
          {ok && <span className="text-xs text-green-400">更新しました</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>

      {/* History */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">取引履歴</p>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={fCustomer} onChange={(e) => { setFCustomer(e.target.value); applyFilters({ customer_id: e.target.value }); }} className={inp}>
            <option value="" className="bg-slate-900">全顧客</option>
            {customers.map((c) => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
          </select>
          <select value={fType} onChange={(e) => { const v = e.target.value as PointTxnType | "all"; setFType(v); applyFilters({ type: v }); }} className={inp}>
            <option value="all"    className="bg-slate-900">全種別</option>
            <option value="earn"   className="bg-slate-900">付与</option>
            <option value="redeem" className="bg-slate-900">利用</option>
            <option value="adjust" className="bg-slate-900">調整</option>
          </select>
          <input type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); applyFilters({ from: e.target.value }); }} className={inp} />
          <input type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); applyFilters({ to: e.target.value }); }} className={inp} />
        </div>
        <button type="button" onClick={clearFilters} className="self-start text-[11px] text-slate-500 hover:text-slate-300">フィルターをクリア</button>

        {/* Table */}
        <div className="border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left font-medium px-3 py-2">日付</th>
                <th className="text-left font-medium px-3 py-2">顧客</th>
                <th className="text-left font-medium px-3 py-2">種別</th>
                <th className="text-right font-medium px-3 py-2">ポイント</th>
                <th className="text-left font-medium px-3 py-2">理由</th>
                <th className="text-left font-medium px-3 py-2">関連書類</th>
                <th className="text-left font-medium px-3 py-2">期限</th>
              </tr>
            </thead>
            <tbody>
              {filtering ? (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6">読み込み中…</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6">取引履歴はありません</td></tr>
              ) : txns.map((t) => {
                const signed = signedPoints(t.type, t.points);
                return (
                  <tr key={t.id} className="border-b border-slate-800/50">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                    <td className="px-3 py-2 text-slate-200">{t.customer_name}</td>
                    <td className="px-3 py-2 text-slate-400">{POINT_TXN_LABEL[t.type]}</td>
                    <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${signed >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {signed >= 0 ? "+" : ""}{signed.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-[140px] truncate">{t.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {t.reference_type ? `${REFERENCE_LABEL[t.reference_type] ?? t.reference_type}${t.reference_id ? ` #${t.reference_id.slice(0, 8)}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(t.expires_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Balances */}
        {cards.length > 0 && (
          <div className="border border-slate-800 rounded-xl overflow-hidden mt-1">
            <p className="text-[10px] text-slate-500 px-3 pt-2">残高</p>
            {cards.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between px-3 py-2 ${i < cards.length - 1 ? "border-b border-slate-800/50" : ""}`}>
                <span className="text-xs text-slate-300">{c.customer_name}</span>
                <span className="text-xs font-semibold text-blue-300">{c.points_balance.toLocaleString()} pt</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
