import Link from "next/link";
import Image from "next/image";
import { demoCustomer, demoVehicles, demoPoints, demoNotifications, NOTIF_CATEGORY_ICON } from "@/lib/customer-app/demo-data";

export const metadata = { title: "ホーム | Detailer Agent" };

const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

export default function CustomerHome() {
  const v = demoVehicles[0];
  const news = demoNotifications.slice(0, 2);

  return (
    <div className="flex flex-col gap-4">
      {/* Welcome */}
      <div>
        <p className="text-[11px] text-slate-500">おかえりなさい</p>
        <h1 className="text-lg font-bold text-slate-100">{demoCustomer.name} 様</h1>
      </div>

      {/* Vehicle hero + coating status */}
      <div className={`${card} overflow-hidden`}>
        <div className="relative h-40 bg-gradient-to-b from-blue-950/30 to-transparent">
          <Image src="/car_hero_nobg.png" alt="" fill priority sizes="(max-width:448px) 100vw, 448px"
            className="object-contain object-center" style={{ filter: "drop-shadow(0 0 24px rgba(37,99,235,0.45))" }} />
          <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-600/40">
            コーティング {v.coating.status}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1 border-t border-white/[.06]">
          <p className="text-sm font-semibold text-slate-100">{v.maker} {v.model}</p>
          <p className="text-[11px] text-slate-500">{v.plate}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-400">{v.coating.product}</span>
            <span className="text-[10px] text-slate-500">保証 {v.coating.warrantyUntil}まで</span>
          </div>
        </div>
      </div>

      {/* Quick stats: points + next maintenance */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/points" className={`${card} p-4 flex flex-col gap-1`}>
          <span className="text-[10px] text-slate-500">現在のポイント</span>
          <span className="text-xl font-bold text-blue-300">{demoPoints.balance.toLocaleString()}<span className="text-[11px] text-slate-500 ml-1">pt</span></span>
        </Link>
        <Link href="/app/reservations" className={`${card} p-4 flex flex-col gap-1`}>
          <span className="text-[10px] text-slate-500">次回おすすめ</span>
          <span className="text-sm font-semibold text-slate-100 leading-tight">{v.next.label}</span>
          <span className="text-[10px] text-amber-300">{v.next.dueDate}</span>
        </Link>
      </div>

      {/* Latest news */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-400">お知らせ</p>
          <Link href="/app/notifications" className="text-[10px] text-blue-400">すべて見る</Link>
        </div>
        {news.map((n) => (
          <Link key={n.id} href="/app/notifications" className={`${card} p-3 flex items-start gap-3`}>
            <span className="text-base leading-none mt-0.5">{NOTIF_CATEGORY_ICON[n.category]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{n.title}</p>
              <p className="text-[10px] text-slate-500 truncate">{n.body}</p>
            </div>
            <span className="text-[9px] text-slate-600 shrink-0">{n.date.slice(5)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
