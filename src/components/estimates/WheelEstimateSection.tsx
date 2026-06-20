const MOCK_WHEEL = {
  wheelModel: "RAYS Volk Racing TE37 Ultra",
  frontSize: "18×9.5J +38",
  rearSize: "18×10.5J +25",
  diskColor: "Diamond Dark Gunmetal",
  rimColor: "Machined Rim",
  piercingBolt: "M12×P1.5 / 5H-114.3",
  option: "Center cap set",
  discountRate: 15,
  unitPrice: 220000,
  qty: 4,
  subtotal: 748000,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-36">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

export default function WheelEstimateSection() {
  const w = MOCK_WHEEL;
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Wheel Information
      </h3>
      <Row label="Wheel Model"         value={w.wheelModel} />
      <Row label="Front Size"           value={w.frontSize} />
      <Row label="Rear Size"            value={w.rearSize} />
      <Row label="Disk Color"           value={w.diskColor} />
      <Row label="Rim Color"            value={w.rimColor} />
      <Row label="Piercing Bolt"        value={w.piercingBolt} />
      <Row label="Option"               value={w.option} />
      <Row label="Unit Price"           value={`¥${w.unitPrice.toLocaleString("ja-JP")} × ${w.qty}`} />
      <Row label="Customer Discount"    value={`${w.discountRate}%`} />
      <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
        <span className="text-xs text-slate-400">Wheel Subtotal</span>
        <span className="text-sm font-semibold text-slate-100">¥{w.subtotal.toLocaleString("ja-JP")}</span>
      </div>
    </div>
  );
}
