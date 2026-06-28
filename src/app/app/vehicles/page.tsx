import Link from "next/link";
import { demoVehicles } from "@/lib/customer-app/demo-data";

export const metadata = { title: "車両 | Detailer Agent" };
const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

export default function VehiclesList() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">マイ車両</h1>
      <div className="flex flex-col gap-3">
        {demoVehicles.map((v) => (
          <Link key={v.id} href={`/app/vehicles/${v.id}`} className={`${card} p-4 flex items-center gap-3`}>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-blue-950/40 text-lg shrink-0">🚗</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{v.maker} {v.model}</p>
              <p className="text-[11px] text-slate-500">{v.year}年 ・ {v.color}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{v.plate}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-600/40">{v.coating.status}</span>
              <p className="text-slate-600 text-xs mt-1">›</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
