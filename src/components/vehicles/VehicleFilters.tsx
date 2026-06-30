"use client";

// Phase 2 Sprint 3 — Vehicle list filters (client-side, over the loaded list).

export type InspectionFilter = "all" | "valid" | "soon" | "expired" | "none";
export type LinkFilter       = "all" | "linked" | "unlinked";

interface Props {
  inspection:   InspectionFilter;
  link:         LinkFilter;
  onInspection: (v: InspectionFilter) => void;
  onLink:       (v: LinkFilter) => void;
  total:        number;
  shown:        number;
}

const chipBase = "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors";
const chipOn   = "border-[#1d4ed8] bg-[#1d4ed8]/15 text-blue-300";
const chipOff  = "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600";

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${chipBase} ${active ? chipOn : chipOff}`}>
      {label}
    </button>
  );
}

export default function VehicleFilters({ inspection, link, onInspection, onLink, total, shown }: Props) {
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 w-16">車検</span>
        <Chip active={inspection === "all"}     label="すべて"   onClick={() => onInspection("all")} />
        <Chip active={inspection === "valid"}   label="有効"     onClick={() => onInspection("valid")} />
        <Chip active={inspection === "soon"}    label="間近"     onClick={() => onInspection("soon")} />
        <Chip active={inspection === "expired"} label="切れ"     onClick={() => onInspection("expired")} />
        <Chip active={inspection === "none"}    label="未登録"   onClick={() => onInspection("none")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 w-16">顧客</span>
        <Chip active={link === "all"}      label="すべて"   onClick={() => onLink("all")} />
        <Chip active={link === "linked"}   label="紐付きあり" onClick={() => onLink("linked")} />
        <Chip active={link === "unlinked"} label="紐付きなし" onClick={() => onLink("unlinked")} />
      </div>
      <p className="text-[11px] text-slate-500">
        {shown} / {total} 件を表示
      </p>
    </div>
  );
}
