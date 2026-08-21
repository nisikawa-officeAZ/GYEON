"use client";

// Phase 2 Sprint 2 — Controlled customer search. Filters the already-loaded
// list live (parent owns state); replaces the previous non-functional stub.

export interface CustomerSearchValues {
  name:   string;
  phone:  string;
  lineId: string;
}

interface Props {
  values:   CustomerSearchValues;
  onChange: (field: keyof CustomerSearchValues, value: string) => void;
  onClear:  () => void;
}

export default function CustomerSearch({ values, onChange, onClear }: Props) {
  const hasQuery = !!(values.name || values.phone || values.lineId);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">氏名</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="山田 太郎"
            className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">電話番号</label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="090-0000-0000"
            className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">LINE ID</label>
          <input
            type="text"
            value={values.lineId}
            onChange={(e) => onChange("lineId", e.target.value)}
            placeholder="line_id"
            className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasQuery}
          className="border border-[#263955] text-[#c3cee2] hover:border-[#3b6eb4] hover:bg-[#141e2f] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          クリア
        </button>
      </div>
    </div>
  );
}
