"use client";

// Phase 2 Sprint 2 — Customer list filters (client-side, over the loaded list).

export type BusinessFilter = "all" | "business" | "individual";
export type LineFilter     = "all" | "connected" | "unconnected";

interface Props {
  business:    BusinessFilter;
  line:        LineFilter;
  onBusiness:  (v: BusinessFilter) => void;
  onLine:      (v: LineFilter) => void;
  total:       number;
  shown:       number;
}

const chipBase =
  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors";
const chipOn  = "border-[#1d4ed8] bg-[#1d4ed8]/15 text-blue-300";
const chipOff = "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600";

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${chipBase} ${active ? chipOn : chipOff}`}>
      {label}
    </button>
  );
}

export default function CustomerFilters({ business, line, onBusiness, onLine, total, shown }: Props) {
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 w-16">区分</span>
        <Chip active={business === "all"}        label="すべて" onClick={() => onBusiness("all")} />
        <Chip active={business === "business"}    label="業者"   onClick={() => onBusiness("business")} />
        <Chip active={business === "individual"}  label="個人"   onClick={() => onBusiness("individual")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 w-16">LINE</span>
        <Chip active={line === "all"}          label="すべて"   onClick={() => onLine("all")} />
        <Chip active={line === "connected"}    label="連携済み" onClick={() => onLine("connected")} />
        <Chip active={line === "unconnected"}  label="未連携"   onClick={() => onLine("unconnected")} />
      </div>
      <p className="text-[11px] text-slate-500">
        {shown} / {total} 件を表示
      </p>
    </div>
  );
}
