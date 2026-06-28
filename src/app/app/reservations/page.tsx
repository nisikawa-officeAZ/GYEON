import { demoReservations } from "@/lib/customer-app/demo-data";
import ReservationRequest from "./ReservationRequest";

export const metadata = { title: "予約 | Detailer Agent" };
const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

function Row({ r, done }: { r: { date: string; time: string; menu: string; vehicle: string; status: string }; done?: boolean }) {
  return (
    <div className={`${card} p-4 flex items-center gap-3`}>
      <div className="grid place-items-center w-11 h-11 rounded-xl bg-blue-950/40 shrink-0">
        <span className="text-[10px] text-slate-400">{r.date.slice(5)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100">{r.menu}</p>
        <p className="text-[11px] text-slate-500">{r.vehicle}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">{r.date} {r.time}〜</p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${done ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-blue-950/50 text-blue-300 border-blue-700/40"}`}>
        {r.status}
      </span>
    </div>
  );
}

export default function Reservations() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-bold text-slate-100">予約</h1>

      <ReservationRequest />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-slate-400">今後の予約</p>
        {demoReservations.upcoming.length === 0
          ? <p className="text-xs text-slate-600 py-2">予定はありません</p>
          : demoReservations.upcoming.map((r) => <Row key={r.id} r={r} />)}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-slate-400">予約履歴</p>
        {demoReservations.history.map((r) => <Row key={r.id} r={r} done />)}
      </div>
    </div>
  );
}
