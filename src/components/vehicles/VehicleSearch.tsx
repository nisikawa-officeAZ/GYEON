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
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">メーカー</label>
          <input
            type="text"
            value={values.maker}
            onChange={(e) => onChange("maker", e.target.value)}
            placeholder="Toyota"
            className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">車種</label>
          <input
            type="text"
            value={values.model}
            onChange={(e) => onChange("model", e.target.value)}
            placeholder="アルファード"
            className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#8191ad]">ナンバー</label>
          <input
            type="text"
            value={values.plate}
            onChange={(e) => onChange("plate", e.target.value)}
            placeholder="品川 300 あ 1234"
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
