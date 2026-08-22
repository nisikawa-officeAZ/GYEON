"use client";

import { useState, useTransition } from "react";
import { adjustPoints, getPointTransactions, getPointsSummary } from "@/lib/points/points";
import {
  POINT_TXN_LABEL, REFERENCE_LABEL, signedPoints,
  type PointCardWithCustomer, type PointTxnType,
  type PointTransactionRow, type PointsSummary, type PointsFilter,
} from "@/lib/points/point-types";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

interface Props {
  initialCards:        PointCardWithCustomer[];
  customers:           { id: string; name: string }[];
  initialTransactions: PointTransactionRow[];
  summary:             PointsSummary;
}

const inp = "w-full bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff] transition-colors";

const chipBase =
  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[32px]";
const chipOn  = "border-[#3478ff] bg-[#173463] text-[#bcd4ff]";
const chipOff = "border-[#263955] text-[#8191ad] hover:text-[#c3cee2] hover:border-[#3b6eb4]";

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replace(/-/g, "/") : "—";
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl p-4 flex flex-col gap-1">
      <p className="text-[10px] text-[#7788a4]">{label}</p>
      <p className={`text-xl font-bold ${accent}`}>{value.toLocaleString()}<span className="text-xs font-medium text-[#7788a4] ml-1">pt</span></p>
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">ポイント</h1>
        <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">POINTS</p>
        <p className="mt-0.5 text-xs text-[#8191ad]">顧客ポイントカード・履歴</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="有効ポイント合計" value={sum.total_active}        accent="text-[#5f9cff]" />
        <SummaryCard label="今月の付与"       value={sum.issued_this_month}   accent="text-emerald-300" />
        <SummaryCard label="今月の利用"       value={sum.redeemed_this_month} accent="text-red-300" />
        <SummaryCard label="まもなく失効"     value={sum.expiring_soon}       accent="text-amber-300" />
      </div>

      {/* Operation form */}
      <form onSubmit={submit} className="rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl p-5 flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">ポイント操作</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inp} required>
            <option value="" className="bg-[#0b1220]">顧客を選択</option>
            {customers.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1220]">{c.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as PointTxnType)} className={inp}>
            <option value="earn"   className="bg-[#0b1220]">{POINT_TXN_LABEL.earn}</option>
            <option value="redeem" className="bg-[#0b1220]">{POINT_TXN_LABEL.redeem}</option>
            <option value="adjust" className="bg-[#0b1220]">{POINT_TXN_LABEL.adjust}</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="ポイント数" className={inp} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="理由(任意)" className={inp} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
          >
            {pending ? "処理中…" : "適用"}
          </button>
          {ok && <span className="text-xs text-emerald-300">更新しました</span>}
          {error && <span className="text-xs text-red-300">{error}</span>}
        </div>
      </form>

      {/* History */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">取引履歴</p>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={fCustomer} onChange={(e) => { setFCustomer(e.target.value); applyFilters({ customer_id: e.target.value }); }} className={inp}>
            <option value="" className="bg-[#0b1220]">全顧客</option>
            {customers.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1220]">{c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); applyFilters({ from: e.target.value }); }} className={inp} />
            <input type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); applyFilters({ to: e.target.value }); }} className={inp} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "earn", "redeem", "adjust"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setFType(v); applyFilters({ type: v }); }}
              aria-pressed={fType === v}
              className={`${chipBase} ${fType === v ? chipOn : chipOff}`}
            >
              {v === "all" ? "全種別" : POINT_TXN_LABEL[v]}
            </button>
          ))}
          <button type="button" onClick={clearFilters} className="text-[11px] text-[#7788a4] hover:text-[#c3cee2] transition-colors">
            フィルターをクリア
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl">
          {filtering ? (
            <p className="text-center text-[#7788a4] text-xs py-8">読み込み中…</p>
          ) : txns.length === 0 ? (
            <GdaOperationalListEmptyState
              messageJa="取引履歴はありません"
              messageEn="NO TRANSACTIONS YET"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#20304a]">
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">日付</th>
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">顧客</th>
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">種別</th>
                    <th className="text-right font-medium text-[#7788a4] px-3 py-2.5">ポイント</th>
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">理由</th>
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">関連書類</th>
                    <th className="text-left font-medium text-[#7788a4] px-3 py-2.5">期限</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => {
                    const signed = signedPoints(t.type, t.points);
                    return (
                      <tr key={t.id} className={`border-b border-[#1a2740] ${i === txns.length - 1 ? "border-b-0" : ""}`}>
                        <td className="px-3 py-2 text-[#8191ad] whitespace-nowrap">{fmtDate(t.created_at)}</td>
                        <td className="px-3 py-2 text-[#c3cee2]">{t.customer_name}</td>
                        <td className="px-3 py-2 text-[#8191ad]">{POINT_TXN_LABEL[t.type]}</td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${signed >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {signed >= 0 ? "+" : ""}{signed.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-[#8191ad] max-w-[140px] truncate">{t.reason ?? "—"}</td>
                        <td className="px-3 py-2 text-[#8191ad]">
                          {t.reference_type ? `${REFERENCE_LABEL[t.reference_type] ?? t.reference_type}${t.reference_id ? ` #${t.reference_id.slice(0, 8)}` : ""}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-[#7788a4] whitespace-nowrap">{fmtDate(t.expires_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Balances */}
        {cards.length > 0 && (
          <div className="rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl overflow-hidden mt-1">
            <p className="text-[10px] text-[#7788a4] px-3 pt-3">残高</p>
            {cards.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between px-3 py-2.5 ${i < cards.length - 1 ? "border-b border-[#1a2740]" : ""}`}>
                <span className="text-xs text-[#c3cee2]">{c.customer_name}</span>
                <span className="text-xs font-semibold text-[#5f9cff]">{c.points_balance.toLocaleString()} pt</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
