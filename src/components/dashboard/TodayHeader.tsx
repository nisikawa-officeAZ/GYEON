"use client";

// DealerOS — Compact Today Header (PHASE73 iPhone-first revision)
// Thin single row: dealer name on left, operational counter chips on right.
// No financial data. Chips only shown when value > 0 to save space.

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
    { label: "予約",    value: reservationToday,     color: "bg-blue-950/50 text-blue-300 border-blue-700/30"    },
    { label: "作業中",  value: workOrdersInProgress,  color: "bg-amber-950/50 text-amber-300 border-amber-700/30" },
    { label: "メンテ",  value: maintenanceNext7Days,  color: "bg-rose-950/50 text-rose-300 border-rose-700/30"    },
    { label: "LINE",    value: lineScheduled,          color: "bg-sky-950/50 text-sky-300 border-sky-700/30"       },
  ].filter(c => c.value > 0);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      {/* Greeting */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-500 leading-none">今日の業務</p>
        <p className="text-sm font-bold text-slate-100 truncate mt-0.5">{name}</p>
      </div>

      {/* Operational counter chips — only when > 0 */}
      {chips.length > 0 ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {chips.map(c => (
            <span
              key={c.label}
              className={`text-[10px] font-bold px-2 py-1 rounded-full border ${c.color}`}
            >
              {c.label} {c.value}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-slate-600 shrink-0">今日の予定なし</span>
      )}
    </div>
  );
}
