"use client";

// DealerOS — Today's Work Header (PHASE73)
// Replaces GyeonHero. Shows greeting and safe operational counters only.
// Financial data is NOT displayed here.

interface CounterChip {
  label: string;
  value: number;
  accent: "blue" | "amber" | "rose" | "sky";
}

function Chip({ label, value, accent }: CounterChip) {
  const styles = {
    blue:  "border-blue-700/40 bg-blue-950/20 text-blue-300",
    amber: "border-amber-700/40 bg-amber-950/20 text-amber-300",
    rose:  "border-rose-700/40 bg-rose-950/20 text-rose-300",
    sky:   "border-sky-700/40 bg-sky-950/20 text-sky-300",
  };
  return (
    <div className={`flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border ${styles[accent]} min-w-[72px]`}>
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[10px] leading-tight text-center opacity-80">{label}</span>
    </div>
  );
}

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
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0f1a] px-6 pt-6 pb-5 flex flex-col gap-4">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] text-slate-500 tracking-wider mb-0.5">GYEON Detailer Agent</p>
          <h1 className="text-xl font-bold text-slate-100 leading-tight">
            こんにちは、{name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">今日の業務</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-full border border-blue-700/40 text-blue-400 bg-blue-950/20">
            v1.0 Official
          </span>
        </div>
      </div>

      {/* Safe operational counters — no financial data */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        <Chip label="本日の予約"       value={reservationToday}     accent="blue"  />
        <Chip label="作業中"           value={workOrdersInProgress}  accent="amber" />
        <Chip label="メンテナンス通知"  value={maintenanceNext7Days}  accent="rose"  />
        <Chip label="LINE送信予定"     value={lineScheduled}         accent="sky"   />
      </div>
    </div>
  );
}
