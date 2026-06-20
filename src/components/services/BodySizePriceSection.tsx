"use client";

import { BODY_SIZES, BASE_PRICES, ServiceCategory, BodySize } from "./mockServiceEstimate";

interface BodySizePriceSectionProps {
  category: ServiceCategory;
  value: BodySize;
  onChange: (v: BodySize) => void;
}

export default function BodySizePriceSection({ category, value, onChange }: BodySizePriceSectionProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Body Size
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {BODY_SIZES.map((size) => {
          const price = BASE_PRICES[category][size];
          const isSelected = value === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              className={`flex flex-col items-center py-3 px-2 rounded-lg border transition-colors ${
                isSelected
                  ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                  : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              <span className="text-sm font-bold">{size}</span>
              <span className={`text-[10px] mt-1 ${isSelected ? "text-blue-200" : "text-slate-600"}`}>
                ¥{(price / 1000).toFixed(0)}k
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between items-center bg-[#0f172a] rounded-lg px-4 py-3">
        <span className="text-xs text-slate-400">Base Price — {category} / {value}</span>
        <span className="text-sm font-bold text-slate-100">
          ¥{BASE_PRICES[category][value].toLocaleString("ja-JP")}
        </span>
      </div>
    </div>
  );
}
