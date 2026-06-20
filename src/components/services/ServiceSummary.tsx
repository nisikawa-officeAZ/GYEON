"use client";

import { DISCOUNT_STEPS } from "./mockServiceEstimate";

interface ServiceSummaryProps {
  basePrice:     number;
  optionsTotal:  number;
  discountRate:  number;
  onDiscountChange: (v: number) => void;
}

export default function ServiceSummary({
  basePrice,
  optionsTotal,
  discountRate,
  onDiscountChange,
}: ServiceSummaryProps) {
  // Mock fixed values — no calculation per spec
  const discount    = MOCK_DISCOUNT[discountRate] ?? 0;
  const taxBase     = basePrice + optionsTotal - discount;
  const tax         = Math.floor(taxBase * 0.1);
  const total       = taxBase + tax;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 space-y-5">
      {/* Discount Slider */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Customer Discount
        </p>
        <div className="flex gap-2">
          {DISCOUNT_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => onDiscountChange(step)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                discountRate === step
                  ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                  : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {step}%
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Summary
        </p>
        <div className="space-y-2.5">
          <SummaryRow label="Base Price"     value={basePrice} />
          <SummaryRow label="Options Total"  value={optionsTotal} />
          {discountRate > 0 && (
            <SummaryRow label={`Discount (${discountRate}%)`} value={-discount} accent="text-red-400" />
          )}
          <div className="border-t border-slate-700 pt-2.5">
            <SummaryRow label="Tax (10%)"    value={tax} muted />
          </div>
          <div className="border-t border-slate-600 pt-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-100">Total</span>
              <span className="text-xl font-bold text-slate-100">
                ¥{total.toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pre-computed mock discounts to avoid calculation
const MOCK_DISCOUNT: Record<number, number> = {
  0: 0, 5: 4000, 10: 8000, 15: 12000, 20: 16000,
};

function SummaryRow({
  label, value, muted, accent,
}: {
  label: string;
  value: number;
  muted?: boolean;
  accent?: string;
}) {
  const colorClass = accent ?? (muted ? "text-slate-500" : "text-slate-300");
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${colorClass}`}>
        {value < 0 ? "−" : ""}¥{Math.abs(value).toLocaleString("ja-JP")}
      </span>
    </div>
  );
}
