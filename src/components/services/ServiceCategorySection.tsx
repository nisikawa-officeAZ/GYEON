"use client";

import { SERVICE_CATEGORIES, ServiceCategory } from "./mockServiceEstimate";

interface ServiceCategorySectionProps {
  value: ServiceCategory;
  onChange: (v: ServiceCategory) => void;
}

export default function ServiceCategorySection({ value, onChange }: ServiceCategorySectionProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Service Category
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SERVICE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors text-left ${
              value === cat
                ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
