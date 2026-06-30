"use client";

// Phase 2 Sprint 3 — Controlled vehicle search. Filters the already-loaded list
// live (parent owns state); replaces the previous non-functional stub.

export interface VehicleSearchValues {
  maker: string;
  model: string;
  plate: string;
}

interface Props {
  values:   VehicleSearchValues;
  onChange: (field: keyof VehicleSearchValues, value: string) => void;
  onClear:  () => void;
}

export default function VehicleSearch({ values, onChange, onClear }: Props) {
  const hasQuery = !!(values.maker || values.model || values.plate);

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">メーカー</label>
          <input
            type="text"
            value={values.maker}
            onChange={(e) => onChange("maker", e.target.value)}
            placeholder="Toyota"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">車種</label>
          <input
            type="text"
            value={values.model}
            onChange={(e) => onChange("model", e.target.value)}
            placeholder="アルファード"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">ナンバー</label>
          <input
            type="text"
            value={values.plate}
            onChange={(e) => onChange("plate", e.target.value)}
            placeholder="品川 300 あ 1234"
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
