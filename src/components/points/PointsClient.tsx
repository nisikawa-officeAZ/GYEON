"use client";

import { useState, useTransition } from "react";
import { adjustPoints } from "@/lib/points/points";
import { POINT_TXN_LABEL, type PointCardWithCustomer, type PointTxnType } from "@/lib/points/point-types";

interface Props {
  initialCards: PointCardWithCustomer[];
  customers:    { id: string; name: string }[];
}

const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";

export default function PointsClient({ initialCards, customers }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<PointTxnType>("earn");
  const [points, setPoints] = useState("100");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(false);
    start(async () => {
      const res = await adjustPoints(customerId, type, Number(points), reason);
      if ("error" in res) { setError(res.error); return; }
      setOk(true);
      // reflect new balance locally
      const name = customers.find((c) => c.id === customerId)?.name ?? "—";
      setCards((prev) => {
        const i = prev.findIndex((c) => c.customer_id === customerId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], points_balance: res.balance };
          return next;
        }
        return [{
          id: customerId, dealer_id: "", customer_id: customerId, points_balance: res.balance,
          created_at: "", updated_at: "", customer_name: name,
        } as PointCardWithCustomer, ...prev];
      });
      setReason("");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Adjust form */}
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

      {/* Cards list */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">ポイントカードはまだありません</p>
        ) : cards.map((c, i) => (
          <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${i < cards.length - 1 ? "border-b border-slate-800/60" : ""}`}>
            <span className="text-sm text-slate-200">{c.customer_name}</span>
            <span className="text-sm font-semibold text-blue-300">{c.points_balance.toLocaleString()} pt</span>
          </div>
        ))}
      </div>
    </div>
  );
}
