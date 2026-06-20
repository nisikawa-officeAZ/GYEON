const MOCK_SUMMARY = {
  wheelSubtotal: 748000,
  tireSubtotal:  164000,
  workSubtotal:   50000,
  discount:      132000,
  tax:            83000,
  total:         913000,
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    "bg-slate-600 text-slate-100",
  SENT:     "bg-blue-600 text-white",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-red-600 text-white",
};

interface EstimateSummaryProps {
  estimateNo: string;
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
}

export default function EstimateSummary({ estimateNo, status }: EstimateSummaryProps) {
  const s = MOCK_SUMMARY;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Total Summary
        </h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[status]}`}>
          {status}
        </span>
      </div>

      <div className="space-y-2">
        {[
          { label: "Wheel Subtotal", value: s.wheelSubtotal, muted: true },
          { label: "Tire Subtotal",  value: s.tireSubtotal,  muted: true },
          { label: "Work Subtotal",  value: s.workSubtotal,  muted: true },
        ].map(({ label, value, muted }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-xs ${muted ? "text-slate-400" : "text-slate-200"}`}>
              ¥{value.toLocaleString("ja-JP")}
            </span>
          </div>
        ))}

        <div className="flex justify-between items-center border-t border-slate-700 pt-2">
          <span className="text-xs text-red-400">Discount</span>
          <span className="text-xs text-red-400">−¥{s.discount.toLocaleString("ja-JP")}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Tax (10%)</span>
          <span className="text-xs text-slate-400">¥{s.tax.toLocaleString("ja-JP")}</span>
        </div>

        <div className="flex justify-between items-center border-t border-slate-600 pt-3 mt-1">
          <span className="text-sm font-bold text-slate-100">Total</span>
          <span className="text-lg font-bold text-slate-100">¥{s.total.toLocaleString("ja-JP")}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 mt-4 text-right">{estimateNo}</p>
    </div>
  );
}
