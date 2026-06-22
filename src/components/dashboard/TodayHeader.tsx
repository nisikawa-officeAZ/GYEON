"use client";

import Image from "next/image";

interface Props {
  businessName:         string | null;
  reservationToday:     number;
  workOrdersInProgress: number;
  maintenanceNext7Days: number;
  lineScheduled:        number;
}

export default function TodayHeader({
  businessName,
  reservationToday,
  workOrdersInProgress,
  maintenanceNext7Days,
  lineScheduled,
}: Props) {
  const name = businessName ?? "ディーラー";

  const chips = [
    { label: "予約",   value: reservationToday,     color: "bg-blue-950 text-blue-300 border-blue-800/60"      },
    { label: "作業中", value: workOrdersInProgress,  color: "bg-amber-950 text-amber-300 border-amber-800/60"   },
    { label: "メンテ", value: maintenanceNext7Days,  color: "bg-rose-950 text-rose-300 border-rose-800/60"      },
    { label: "LINE",   value: lineScheduled,          color: "bg-emerald-950 text-emerald-300 border-emerald-800/60" },
  ].filter(c => c.value > 0);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0a0f1e] border border-white/[0.07] shadow-2xl shadow-black/60">

      {/* Car hero image */}
      <div className="relative h-40 sm:h-48">
        <Image
          src="/car_hero_nobg.png"
          alt=""
          fill
          priority
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-contain object-center mix-blend-screen opacity-75"
        />
        {/* Top fade — merges with card top edge */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#0a0f1e] to-transparent" />
        {/* Bottom fade — merges hero into info strip */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0f1e] to-transparent" />
      </div>

      {/* Brand + dealer name */}
      <div className="px-5 pt-0 pb-4 -mt-4 relative">
        <p className="text-[9px] font-bold tracking-[0.2em] text-blue-500/70 uppercase">
          GYEON® Detailer Agent
        </p>
        <p className="text-[17px] font-bold text-white mt-1 truncate leading-tight">
          {name}
        </p>

        {/* Operational chips — only when count > 0 */}
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map(c => (
              <span
                key={c.label}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.color}`}
              >
                {c.label} {c.value}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600 mt-2.5">今日の予定なし</p>
        )}
      </div>
    </div>
  );
}
