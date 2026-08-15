import Link from "next/link";
import { notFound } from "next/navigation";
import { demoVehicle } from "@/lib/customer-app/demo-data";

const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = demoVehicle(id);
  if (!v) notFound();

  const row = (k: string, val: string) => (
    <div className="flex items-center justify-between py-2 border-b border-white/[.05] last:border-0">
      <span className="text-[11px] text-slate-500">{k}</span>
      <span className="text-xs text-slate-200">{val}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/vehicles" className="text-[11px] text-slate-400">← 車両一覧</Link>
      <div>
        <h1 className="text-lg font-bold text-slate-100">{v.maker} {v.model}</h1>
        <p className="text-[11px] text-slate-500">{v.plate}</p>
      </div>

      <div className={`${card} p-4`}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">車両情報</p>
        {row("年式", `${v.year}年`)}
        {row("カラー", v.color)}
        {row("コーティング", v.coating.product)}
        {row("施工日", v.coating.appliedAt)}
        {row("保証期限", v.coating.warrantyUntil)}
        {row("状態", v.coating.status)}
      </div>

      <div className={`${card} p-4`}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">コーティング履歴</p>
        {v.coatingHistory.map((h, i) => (
          <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[.05] last:border-0">
            <span className="text-[11px] text-slate-500 w-20 shrink-0">{h.date}</span>
            <div className="flex-1"><p className="text-xs text-slate-200">{h.item}</p><p className="text-[10px] text-slate-600">担当: {h.staff}</p></div>
          </div>
        ))}
      </div>

      <div className={`${card} p-4`}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">メンテナンス履歴</p>
        {v.maintenanceHistory.map((h, i) => (
          <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[.05] last:border-0">
            <span className="text-[11px] text-slate-500 w-20 shrink-0">{h.date}</span>
            <div className="flex-1"><p className="text-xs text-slate-200">{h.item}</p><p className="text-[10px] text-slate-600">{h.note}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
