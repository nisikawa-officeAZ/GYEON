import { MOCK_PDF_ESTIMATE } from "./mockPdfEstimate";

const STATUS_LABEL: Record<string, string> = {
  DRAFT:    "下書き",
  SENT:     "送付済み",
  APPROVED: "承認済み",
  REJECTED: "却下",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    "bg-slate-200 text-slate-600",
  SENT:     "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

export default function PDFPreview() {
  const e = MOCK_PDF_ESTIMATE;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4 sm:p-6">
      {/* White paper */}
      <div className="bg-white text-gray-900 rounded-lg shadow-lg mx-auto max-w-3xl p-8 sm:p-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-[#1d4ed8] rounded-md flex items-center justify-center text-white font-bold text-sm">
                D
              </div>
              <span className="font-bold text-gray-900 text-lg">DealerOS</span>
            </div>
            <p className="text-xs text-gray-400">Dealer Management System</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">見積書</h1>
            <p className="text-sm text-gray-500">{e.estimateNo}</p>
            <p className="text-xs text-gray-400 mt-1">{e.createdAt}</p>
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLOR[e.status]}`}>
              {STATUS_LABEL[e.status]}
            </span>
          </div>
        </div>

        {/* Customer & Vehicle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">お客様</p>
            <p className="font-bold text-gray-900">{e.customer.name} 様</p>
            <p className="text-xs text-gray-500">{e.customer.kana}</p>
            <p className="text-sm text-gray-600 mt-1">{e.customer.phone}</p>
            <p className="text-sm text-gray-600">{e.customer.email}</p>
            <p className="text-xs text-gray-500 mt-1">{e.customer.address}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">車両情報</p>
            <p className="font-bold text-gray-900">{e.vehicle.manufacturer} {e.vehicle.model}</p>
            <p className="text-sm text-gray-600">{e.vehicle.year}年 / {e.vehicle.grade}</p>
            <p className="text-sm text-gray-600">{e.vehicle.bodyColor}</p>
            <p className="text-sm text-gray-600 mt-1">{e.vehicle.licensePlate}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left font-semibold text-gray-700 pb-2 pr-4">Description</th>
              <th className="text-center font-semibold text-gray-700 pb-2 px-4 w-16">Qty</th>
              <th className="text-right font-semibold text-gray-700 pb-2 px-4">Unit Price</th>
              <th className="text-right font-semibold text-gray-700 pb-2 pl-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {e.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2.5 pr-4 text-gray-800">{item.description}</td>
                <td className="py-2.5 px-4 text-center text-gray-600">{item.qty}</td>
                <td className="py-2.5 px-4 text-right text-gray-600">{formatYen(item.unitPrice)}</td>
                <td className="py-2.5 pl-4 text-right font-medium text-gray-800">{formatYen(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-56">
            <div className="flex justify-between py-1.5 text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatYen(e.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm text-gray-600 border-b border-gray-200">
              <span>Tax (10%)</span>
              <span>{formatYen(e.tax)}</span>
            </div>
            <div className="flex justify-between py-2 text-base font-bold text-gray-900 mt-1">
              <span>Total</span>
              <span>{formatYen(e.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>This estimate is valid for 30 days from the date of issue.</p>
          <p className="mt-1">DealerOS — Dealer Management System</p>
        </div>
      </div>
    </div>
  );
}
