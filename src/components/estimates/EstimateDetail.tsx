"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EstimateDB,
  EstimateItemDB,
  estimateDisplayNo,
  estimateCustomerName,
  estimateVehicleLabel,
} from "@/lib/estimates/estimate-types";
import { createInvoiceFromEstimate } from "@/lib/invoices/create-invoice";
import { sortByCategoryOrder } from "@/lib/estimates/category-order";
import EstimateSummary from "./EstimateSummary";
import EstimateStatusControl from "./EstimateStatusControl";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

function formatDateTime(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const CATEGORY_LABEL: Record<string, string> = {
  coating:     "コーティング",
  ppf:         "PPF",
  window:      "ウィンドウ",
  interior:    "インテリア",
  glass:       "ガラス",
  other:       "その他",
  maintenance: "メンテナンス",   // Plan A (migration 093)
  carwash:     "洗車",
  roomclean:   "ルームクリーニング",
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

  // Phase 3 Sprint 5 — Estimate → Invoice (one-click, mirrors the WO transition).
  const router = useRouter();
  const [invError, setInvError] = useState<string | null>(null);
  const [invPending, startInvoice] = useTransition();
  const isApproved = estimate.status === "approved" || estimate.status === "APPROVED";

  function handleCreateInvoice() {
    setInvError(null);
    startInvoice(async () => {
      const result = await createInvoiceFromEstimate(estimate.id);
      if ("error" in result) {
        setInvError(result.error);
        return;
      }
      onClose();
      router.push("/invoices");
    });
  }

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
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500">見積詳細</span>
              <EstimateStatusControl estimateId={estimate.id} currentStatus={estimate.status} />
            </div>
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
            {isApproved && (
              <button
                onClick={handleCreateInvoice}
                disabled={invPending}
                className="text-xs font-medium bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {invPending ? "作成中..." : "請求書作成"}
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

          {invError && (
            <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
              <p className="text-xs text-red-400">{invError}</p>
            </div>
          )}

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
              <InfoRow label="登録年月日"  value={vehicle?.registration_date      ?? "—"} />
              <InfoRow label="車検満了日"  value={vehicle?.inspection_expiry_date ?? "—"} />
              <InfoRow label="ナンバー"    value={vehicle?.plate_number ?? "—"} />
              <InfoRow label="ボディサイズ" value={vehicle?.body_size    ?? "—"} />
            </div>
          </div>

          {/* Store/dealer info is intentionally NOT shown here — it belongs only in
              PDF / print / email / LINE output (see src/lib/pdf/dealer-branding.ts). */}

          {/* Service Summary — grouped by the categories actually selected */}
          {items.length > 0 && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                サービス内容
              </h3>
              <div className="flex flex-col gap-3">
                {Array.from(new Set(sortByCategoryOrder(items).map((i) => i.category))).map((cat) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-blue-300">{CATEGORY_LABEL[cat] ?? cat}</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {items.filter((i) => i.category === cat).map((i) => (
                        <li key={i.id} className="text-xs text-slate-300">
                          ・{i.item_name}
                          {i.description && <span className="text-slate-500">（{i.description}）</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    {sortByCategoryOrder(items)
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

          {/* Notes — customer note + internal memo */}
          {(estimate.notes || estimate.internal_memo) && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">備考・メモ</h3>
              {estimate.notes && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">お客様向け備考</p>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{estimate.notes}</p>
                </div>
              )}
              {estimate.internal_memo && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">社内メモ</p>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap">{estimate.internal_memo}</p>
                </div>
              )}
            </div>
          )}

          {/* 送信履歴 — 送信はステータスではなく履歴。一覧には出さず詳細のこの領域で管理。
              （LINE / メール / PDF ダウンロード等。現状は "送付済み" 状態から送信日時を表示） */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">送信履歴</h3>
            {String(estimate.status).toLowerCase() === "sent" ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">📤 送付済み</span>
                <span className="text-slate-500">{formatDateTime(estimate.updated_at)}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                送信履歴はありません（LINE・メール・PDF送信時に記録されます）
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
