const MOCK_TIRE = {
  front: {
    size: "225/45R18",
    brand: "BRIDGESTONE POTENZA S007A",
    price: 38000,
    qty: 2,
    subtotal: 76000,
  },
  rear: {
    size: "255/40R18",
    brand: "BRIDGESTONE POTENZA S007A",
    price: 44000,
    qty: 2,
    subtotal: 88000,
  },
  subtotal: 164000,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-36">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

export default function TireEstimateSection() {
  const t = MOCK_TIRE;
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Tire Information
      </h3>

      <p className="text-[10px] font-medium text-[#1d4ed8] uppercase tracking-wider mb-2">Front</p>
      <Row label="Front Tire Size"  value={t.front.size} />
      <Row label="Brand"            value={t.front.brand} />
      <Row label="Front Tire Price" value={`¥${t.front.price.toLocaleString("ja-JP")} × ${t.front.qty}`} />

      <p className="text-[10px] font-medium text-[#1d4ed8] uppercase tracking-wider mt-4 mb-2">Rear</p>
      <Row label="Rear Tire Size"  value={t.rear.size} />
      <Row label="Brand"           value={t.rear.brand} />
      <Row label="Rear Tire Price" value={`¥${t.rear.price.toLocaleString("ja-JP")} × ${t.rear.qty}`} />

      <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
        <span className="text-xs text-slate-400">Tire Subtotal</span>
        <span className="text-sm font-semibold text-slate-100">¥{t.subtotal.toLocaleString("ja-JP")}</span>
      </div>
    </div>
  );
}
