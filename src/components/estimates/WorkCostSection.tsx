const MOCK_WORK = {
  mountingFee:    12000,
  balanceFee:      8000,
  wheelCoating:   25000,
  otherFee:        5000,
  subtotal:       50000,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-200">{value}</span>
    </div>
  );
}

export default function WorkCostSection() {
  const w = MOCK_WORK;
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Work Cost
      </h3>
      <Row label="Mounting Fee"    value={`¥${w.mountingFee.toLocaleString("ja-JP")}`} />
      <Row label="Balance Fee"     value={`¥${w.balanceFee.toLocaleString("ja-JP")}`} />
      <Row label="Wheel Coating"   value={`¥${w.wheelCoating.toLocaleString("ja-JP")}`} />
      <Row label="Other Fee"       value={`¥${w.otherFee.toLocaleString("ja-JP")}`} />
      <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
        <span className="text-xs text-slate-400">Work Subtotal</span>
        <span className="text-sm font-semibold text-slate-100">¥{w.subtotal.toLocaleString("ja-JP")}</span>
      </div>
    </div>
  );
}
