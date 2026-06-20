"use client";

import { SERVICE_OPTIONS, OptionKey } from "./mockServiceEstimate";

export type OptionsState = Record<OptionKey, boolean>;

interface ServiceOptionSectionProps {
  value: OptionsState;
  onChange: (v: OptionsState) => void;
}

export default function ServiceOptionSection({ value, onChange }: ServiceOptionSectionProps) {
  const toggle = (key: OptionKey) =>
    onChange({ ...value, [key]: !value[key] });

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Options
      </p>
      <div className="space-y-2">
        {SERVICE_OPTIONS.map((opt) => {
          const checked = value[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                checked
                  ? "bg-[#1d4ed8]/10 border-[#1d4ed8] text-slate-100"
                  : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"
                }`}>
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="white">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm">{opt.label}</span>
              </div>
              <span className={`text-xs ${checked ? "text-blue-300" : "text-slate-600"}`}>
                +¥{opt.price.toLocaleString("ja-JP")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
