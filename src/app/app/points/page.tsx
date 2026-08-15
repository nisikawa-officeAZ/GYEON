import { demoPoints } from "@/lib/customer-app/demo-data";

export const metadata = { title: "ポイント | Detailer Agent" };
const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

const TYPE_LABEL: Record<string, string> = { earn: "付与", redeem: "利用" };

export default function CustomerPoints() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">ポイント</h1>

      {/* Balance */}
      <div className="rounded-2xl border border-blue-700/30 bg-gradient-to-br from-blue-950/40 to-[#0f172a] p-5">
        <p className="text-[11px] text-slate-400">現在の有効ポイント</p>
        <p className="text-4xl font-black text-blue-300 mt-1">{demoPoints.balance.toLocaleString()}<span className="text-sm font-medium text-slate-500 ml-1">pt</span></p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300">
          <span>⏳</span>
          <span>{demoPoints.expiringSoon.toLocaleString()}pt が {demoPoints.expiringDate} に失効します</span>
        </div>
      </div>

      {/* History */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-slate-400">利用履歴</p>
        <div className={card}>
          {demoPoints.transactions.map((t, i) => {
            const signed = t.type === "redeem" ? -t.points : t.points;
            return (
              <div key={t.id} className={`flex items-center justify-between px-4 py-3 ${i < demoPoints.transactions.length - 1 ? "border-b border-white/[.05]" : ""}`}>
                <div>
                  <p className="text-xs text-slate-200">{t.reason}</p>
                  <p className="text-[10px] text-slate-600">{t.date} ・ {TYPE_LABEL[t.type]}</p>
                </div>
                <span className={`text-sm font-semibold ${signed >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {signed >= 0 ? "+" : ""}{signed.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
