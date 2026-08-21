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
  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[32px]";
const chipOn  = "border-[#3478ff] bg-[#173463] text-[#bcd4ff]";
const chipOff = "border-[#263955] text-[#8191ad] hover:text-[#c3cee2] hover:border-[#3b6eb4]";

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${chipBase} ${active ? chipOn : chipOff}`}>
      {label}
    </button>
  );
}

export default function CustomerFilters({ business, line, onBusiness, onLine, total, shown }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#7788a4] w-16">区分</span>
        <Chip active={business === "all"}        label="すべて" onClick={() => onBusiness("all")} />
        <Chip active={business === "business"}    label="業者"   onClick={() => onBusiness("business")} />
        <Chip active={business === "individual"}  label="個人"   onClick={() => onBusiness("individual")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#7788a4] w-16">LINE</span>
        <Chip active={line === "all"}          label="すべて"   onClick={() => onLine("all")} />
        <Chip active={line === "connected"}    label="連携済み" onClick={() => onLine("connected")} />
        <Chip active={line === "unconnected"}  label="未連携"   onClick={() => onLine("unconnected")} />
      </div>
      <p className="text-[11px] text-[#7788a4]">
        {shown} / {total} 件を表示
      </p>
    </div>
  );
}
