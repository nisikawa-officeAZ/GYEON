import { EstimateDB } from "@/lib/estimates/estimate-types";

const STATUS_COLOR: Record<string, string> = {
  draft:    "bg-slate-600 text-slate-100",
  sent:     "bg-blue-600 text-white",
  approved: "bg-green-600 text-white",
  rejected: "bg-red-600 text-white",
  expired:  "bg-amber-600 text-white",
  // Legacy uppercase
  DRAFT:    "bg-slate-600 text-slate-100",
  SENT:     "bg-blue-600 text-white",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-red-600 text-white",
};

interface EstimateSummaryProps {
  estimate: Pick<
    EstimateDB,
    | "estimate_no"
    | "estimate_number"
    | "status"
    | "subtotal"
    | "tax"
    | "tax_rate"
    | "tax_amount"
    | "discount_amount"
    | "total"
    | "valid_until"
  >;
}

export default function EstimateSummary({ estimate }: EstimateSummaryProps) {
  const subtotal       = estimate.subtotal       ?? 0;
  const discountAmount = estimate.discount_amount ?? 0;
  const taxRate        = estimate.tax_rate        ?? 10;
  const taxAmount      = estimate.tax_amount      ?? estimate.tax ?? 0;
  const total          = estimate.total           ?? 0;
  const displayNo      = estimate.estimate_number ?? estimate.estimate_no ?? "—";

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          合計
        </h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[estimate.status] ?? "bg-slate-700 text-slate-300"}`}>
          {estimate.status.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">小計</span>
          <span className="text-xs text-slate-400">¥{subtotal.toLocaleString("ja-JP")}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-red-400">値引き</span>
            <span className="text-xs text-red-400">−¥{discountAmount.toLocaleString("ja-JP")}</span>
          </div>
        )}

        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
          <span className="text-xs text-slate-500">消費税 ({taxRate}%)</span>
          <span className="text-xs text-slate-400">¥{taxAmount.toLocaleString("ja-JP")}</span>
        </div>

        <div className="flex justify-between items-center pt-1">
          <span className="text-sm font-bold text-slate-100">合計</span>
          <span className="text-lg font-bold text-slate-100">¥{total.toLocaleString("ja-JP")}</span>
        </div>
      </div>

      {estimate.valid_until && (
        <p className="text-[10px] text-slate-600 mt-4">
          有効期限: {estimate.valid_until}
        </p>
      )}
      <p className="text-[10px] text-slate-600 mt-1 text-right">{displayNo}</p>
    </div>
  );
}
