// A4-style printable GYEON service estimate preview.
// Accepts real GyeonServiceEstimateDB data — no mock values.
// Print-friendly: white background, black text, print CSS included.

import { GyeonServiceEstimateDB } from "@/lib/gyeon/gyeon-service-types";
import { SERVICE_OPTIONS }        from "@/components/services/mockServiceEstimate";

function yen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

interface GyeonServicePdfPreviewProps {
  gyeonEstimate: GyeonServiceEstimateDB;
}

export default function GyeonServicePdfPreview({ gyeonEstimate: est }: GyeonServicePdfPreviewProps) {
  const customer = est.estimates?.customers;
  const vehicle  = est.estimates?.vehicles;
  const options  = est.options_json ?? {};
  const selectedOptions = SERVICE_OPTIONS.filter((o) => options[o.key]);

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
                  G
                </div>
                <span className="font-bold text-gray-900 text-lg">GYEON Service</span>
              </div>
              <p className="text-xs text-gray-400">Detailing Estimate</p>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">サービス見積書</h1>
              {est.estimates?.estimate_no && (
                <p className="text-sm text-gray-500">{est.estimates.estimate_no}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(est.created_at).toLocaleDateString("ja-JP")}
              </p>
            </div>
          </div>

          {/* Customer & Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">お客様</p>
              {customer ? (
                <>
                  <p className="font-bold text-gray-900">
                    {[customer.last_name, customer.first_name].filter(Boolean).join(" ")} 様
                  </p>
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
                    {[vehicle.maker, vehicle.model].filter(Boolean).join(" ") || "—"}
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

          {/* Service details */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              サービス内容
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left font-semibold text-gray-700 pb-2 pr-4">項目</th>
                  <th className="text-right font-semibold text-gray-700 pb-2 pl-4">金額</th>
                </tr>
              </thead>
              <tbody>
                {/* Base service */}
                <tr className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-800">
                    <span className="font-medium">{est.service_category}</span>
                    <span className="text-gray-500 ml-2">({est.body_size})</span>
                  </td>
                  <td className="py-3 pl-4 text-right font-medium text-gray-800">
                    {yen(est.base_price)}
                  </td>
                </tr>
                {/* Selected options */}
                {selectedOptions.map((opt) => (
                  <tr key={opt.key} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-gray-700 pl-4">{opt.label}</td>
                    <td className="py-2.5 pl-4 text-right text-gray-700">
                      +{yen(opt.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-1.5 text-sm text-gray-600">
                <span>基本料金</span>
                <span>{yen(est.base_price)}</span>
              </div>
              {selectedOptions.length > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-gray-600">
                  <span>オプション合計</span>
                  <span>
                    +{yen(selectedOptions.reduce((s, o) => s + o.price, 0))}
                  </span>
                </div>
              )}
              {est.discount > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-red-600">
                  <span>値引き</span>
                  <span>−{yen(est.discount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 text-sm text-gray-600 border-b border-gray-200">
                <span>消費税（10%）</span>
                <span>{yen(est.tax)}</span>
              </div>
              <div className="flex justify-between py-2 text-base font-bold text-gray-900 mt-1">
                <span>合計</span>
                <span>{yen(est.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            <p>本見積書の有効期限は発行日より30日間です。</p>
            <p className="mt-1">DealerOS — GYEON Authorized Dealer</p>
          </div>
        </div>
      </div>
    </>
  );
}
