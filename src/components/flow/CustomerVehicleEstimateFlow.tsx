const MOCK_FLOW = {
  customer: {
    name: "山田 太郎",
    phone: "090-1234-5678",
    email: "yamada@example.com",
    lineId: "yamada_taro",
  },
  vehicle: {
    manufacturer: "Toyota",
    model: "Alphard",
    licensePlate: "品川 300 あ 1234",
    vin: "JT3HP10V9X0123456",
  },
  estimate: {
    estimateNo: "EST-2024-001",
    status: "APPROVED" as const,
    total: 3520000,
  },
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    "bg-slate-600 text-slate-100",
  SENT:     "bg-blue-600 text-white",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-red-600 text-white",
};

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

function FlowCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">
        {label}
      </p>
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-4 h-full">
        {children}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 px-1">
      {/* vertical on mobile, horizontal on desktop */}
      <div className="flex lg:hidden flex-col items-center py-1">
        <div className="w-px h-4 bg-slate-700" />
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M5 6L0 0h10L5 6z" fill="#475569" />
        </svg>
      </div>
      <div className="hidden lg:flex items-center">
        <div className="h-px w-4 bg-slate-700" />
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M6 5L0 0v10L6 5z" fill="#475569" />
        </svg>
      </div>
    </div>
  );
}

export default function CustomerVehicleEstimateFlow() {
  const { customer, vehicle, estimate } = MOCK_FLOW;

  return (
    <div className="bg-[#0f172a] rounded-xl p-4 shadow-lg">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
        Flow — Customer → Vehicle → Estimate → PDF
      </p>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-2">

        {/* Customer */}
        <FlowCard label="Customer">
          <p className="font-semibold text-slate-100 text-sm mb-2">{customer.name}</p>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">{customer.phone}</p>
            <p className="text-xs text-slate-500 truncate">{customer.email}</p>
            {customer.lineId && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                LINE: {customer.lineId}
              </span>
            )}
          </div>
        </FlowCard>

        <Arrow />

        {/* Vehicle */}
        <FlowCard label="Vehicle">
          <p className="font-semibold text-slate-100 text-sm mb-2">
            {vehicle.manufacturer} {vehicle.model}
          </p>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">{vehicle.licensePlate}</p>
            <p className="text-xs text-slate-600 truncate font-mono">{vehicle.vin}</p>
          </div>
        </FlowCard>

        <Arrow />

        {/* Estimate */}
        <FlowCard label="Estimate">
          <p className="font-semibold text-slate-100 text-sm mb-2">{estimate.estimateNo}</p>
          <div className="space-y-2">
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[estimate.status]}`}>
              {estimate.status}
            </span>
            <p className="text-sm font-bold text-slate-100">{formatYen(estimate.total)}</p>
          </div>
        </FlowCard>

        <Arrow />

        {/* PDF */}
        <FlowCard label="PDF">
          <p className="font-semibold text-slate-100 text-sm mb-3">見積書</p>
          <div className="flex flex-col gap-1.5">
            {["Preview PDF", "Print", "Send"].map((action) => (
              <button
                key={action}
                type="button"
                className={`w-full text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-left ${
                  action === "Preview PDF"
                    ? "bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
                    : "bg-slate-700/50 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </FlowCard>

      </div>
    </div>
  );
}
