"use client";

import Link from "next/link";
import {
  EstimateDB,
  EstimateItemDB,
  estimateDisplayNo,
  estimateCustomerName,
  estimateVehicleLabel,
} from "@/lib/estimates/estimate-types";
import EstimateSummary from "./EstimateSummary";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const CATEGORY_LABEL: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

interface EstimateDetailProps {
  estimate:             EstimateDB;
  onClose:              () => void;
  onCreateWorkOrder?:   () => void;
}

export default function EstimateDetail({ estimate, onClose, onCreateWorkOrder }: EstimateDetailProps) {
  const customer = estimate.customers;
  const vehicle  = estimate.vehicles;
  const items    = estimate.estimate_items ?? [];

  const customerName = estimateCustomerName(customer);
  const vehicleLabel = estimateVehicleLabel(vehicle);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{estimateDisplayNo(estimate)}</h2>
            {estimate.title && (
              <p className="text-xs text-slate-400 mt-0.5">{estimate.title}</p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">見積詳細</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/pdf?estimateId=${estimate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              PDF表示
            </Link>
            {onCreateWorkOrder && (
              <button
                onClick={onCreateWorkOrder}
                className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                施工指示作成
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Customer & Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                顧客情報
              </h3>
              <InfoRow label="顧客名"  value={customerName} />
              <InfoRow label="電話番号" value={customer?.phone ?? "—"} />
              <InfoRow label="メール"   value={customer?.email ?? "—"} />
            </div>

            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                車両情報
              </h3>
              <InfoRow label="メーカー"    value={vehicle?.maker        ?? "—"} />
              <InfoRow label="車種"        value={vehicle?.model        ?? "—"} />
              <InfoRow label="年式"        value={vehicle?.year         ?? "—"} />
              <InfoRow label="グレード"    value={vehicle?.grade        ?? "—"} />
              <InfoRow label="ナンバー"    value={vehicle?.plate_number ?? "—"} />
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                明細
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left pb-2 pr-3">カテゴリ</th>
                      <th className="text-left pb-2 pr-3">品目</th>
                      <th className="text-right pb-2 pr-3">単価</th>
                      <th className="text-right pb-2 pr-3">数量</th>
                      <th className="text-right pb-2 pr-3">割引</th>
                      <th className="text-right pb-2">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .slice()
                      .sort((a: EstimateItemDB, b: EstimateItemDB) => a.sort_order - b.sort_order)
                      .map((item: EstimateItemDB) => (
                        <tr key={item.id} className="border-b border-slate-700/40 last:border-b-0">
                          <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                            {CATEGORY_LABEL[item.category] ?? item.category}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            <div>{item.item_name}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{item.description}</div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400 whitespace-nowrap">
                            {formatYen(item.unit_price)}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400">
                            {item.quantity}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400">
                            {item.discount_rate > 0 ? `${item.discount_rate}%` : "—"}
                          </td>
                          <td className="py-2 text-right text-slate-200 font-medium whitespace-nowrap">
                            {formatYen(item.line_total)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          <EstimateSummary estimate={estimate} />

          {/* Notes */}
          {estimate.notes && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{estimate.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
