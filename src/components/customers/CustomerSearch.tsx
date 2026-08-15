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
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">氏名</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="山田 太郎"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">電話番号</label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="090-0000-0000"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">LINE ID</label>
          <input
            type="text"
            value={values.lineId}
            onChange={(e) => onChange("lineId", e.target.value)}
            placeholder="line_id"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasQuery}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          クリア
        </button>
      </div>
    </div>
  );
}
