// A4-style printable estimate preview (PHASE38).
// Accepts real EstimateDB data including line items.
// Print-friendly: white background, black text, print CSS included.

import {
  EstimateDB,
  EstimateItemDB,
  estimateDisplayNo,
  estimateCustomerName,
  estimateVehicleLabel,
} from "@/lib/estimates/estimate-types";

const STATUS_LABEL: Record<string, string> = {
  draft:    "下書き",
  sent:     "送付済み",
  approved: "承認済み",
  rejected: "却下",
  expired:  "期限切れ",
  DRAFT:    "下書き",
  SENT:     "送付済み",
  APPROVED: "承認済み",
  REJECTED: "却下",
};

const STATUS_COLOR: Record<string, string> = {
  draft:    "bg-slate-200 text-slate-600",
  sent:     "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired:  "bg-amber-100 text-amber-700",
  DRAFT:    "bg-slate-200 text-slate-600",
  SENT:     "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

function yen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

interface EstimatePdfPreviewProps {
  estimate: EstimateDB;
}

export default function EstimatePdfPreview({ estimate }: EstimatePdfPreviewProps) {
  const customer = estimate.customers;
  const vehicle  = estimate.vehicles;
  const status   = estimate.status;
  const items    = (estimate.estimate_items ?? [])
    .slice()
    .sort((a: EstimateItemDB, b: EstimateItemDB) => a.sort_order - b.sort_order);

  const subtotal       = estimate.subtotal       ?? 0;
  const discountAmount = estimate.discount_amount ?? 0;
  const taxRate        = estimate.tax_rate        ?? 10;
  const taxAmount      = estimate.tax_amount      ?? estimate.tax ?? 0;
  const total          = estimate.total           ?? 0;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pdf-print-area, #pdf-print-area * { visibility: visible; }
          #pdf-print-area { position: fixed; inset: 0; }
        }
      `}</style>

      <div id="pdf-print-area" className="bg-[#1e293b] rounded-xl shadow-lg p-4 sm:p-6">
        {/* White A4-like paper */}
        <div className="bg-white text-gray-900 rounded-lg shadow-lg mx-auto max-w-3xl p-8 sm:p-12">

          {/* Document header */}
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
              <p className="text-sm text-gray-500">{estimateDisplayNo(estimate)}</p>
              {estimate.title && (
                <p className="text-sm text-gray-700 font-medium mt-0.5">{estimate.title}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(estimate.created_at).toLocaleDateString("ja-JP")}
              </p>
              {estimate.valid_until && (
                <p className="text-xs text-gray-400">
                  有効期限: {estimate.valid_until}
                </p>
              )}
              <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
            </div>
          </div>

          {/* Customer & Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">お客様</p>
              {customer ? (
                <>
                  <p className="font-bold text-gray-900">{estimateCustomerName(customer)} 様</p>
                  {customer.phone && <p className="text-sm text-gray-600 mt-1">{customer.phone}</p>}
                  {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                </>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">車両情報</p>
              {vehicle ? (
                <>
                  <p className="font-bold text-gray-900">
                    {estimateVehicleLabel(vehicle)}
                  </p>
                  {(vehicle.year || vehicle.grade) && (
                    <p className="text-sm text-gray-600">
                      {[vehicle.year && `${vehicle.year}年`, vehicle.grade].filter(Boolean).join(" / ")}
                    </p>
                  )}
                  {vehicle.plate_number && (
                    <p className="text-sm text-gray-600 mt-1">{vehicle.plate_number}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className="mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">カテゴリ</th>
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">品目</th>
                    <th className="text-right font-semibold text-gray-700 pb-2 pr-4">単価</th>
                    <th className="text-right font-semibold text-gray-700 pb-2 pr-4">数量</th>
                    <th className="text-right font-semibold text-gray-700 pb-2 pr-4">割引</th>
                    <th className="text-right font-semibold text-gray-700 pb-2">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: EstimateItemDB) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-gray-500 text-xs whitespace-nowrap">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-800">
                        <div>{item.item_name}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-700 whitespace-nowrap">
                        {yen(item.unit_price)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-700">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-500 text-xs">
                        {item.discount_rate > 0 ? `${item.discount_rate}%` : "—"}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                        {yen(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-60">
              <div className="flex justify-between py-1.5 text-sm text-gray-600">
                <span>小計</span>
                <span>{yen(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-red-600">
                  <span>値引き</span>
                  <span>−{yen(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 text-sm text-gray-600 border-b border-gray-200">
                <span>消費税 ({taxRate}%)</span>
                <span>{yen(taxAmount)}</span>
              </div>
              <div className="flex justify-between py-2 text-base font-bold text-gray-900 mt-1">
                <span>合計</span>
                <span>{yen(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {estimate.notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">備考</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{estimate.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            <p>本見積書の有効期限は発行日より30日間です。</p>
            <p className="mt-1">DealerOS — Dealer Management System</p>
          </div>
        </div>
      </div>
    </>
  );
}
