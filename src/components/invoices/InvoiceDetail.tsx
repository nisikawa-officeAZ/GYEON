"use client";

import { useState } from "react";
import {
  InvoiceDB,
  InvoiceStatus,
  invoiceDisplayNo,
  invoiceCustomerName,
  invoiceVehicleLabel,
  invoiceStatusLabel,
  invoiceCategoryLabel,
} from "@/lib/invoices/invoice-types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right break-all">{value}</span>
    </div>
  );
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:          "bg-slate-600 text-slate-100",
  issued:         "bg-blue-600 text-white",
  paid:           "bg-green-600 text-white",
  partially_paid: "bg-amber-600 text-white",
  overdue:        "bg-red-600 text-white",
  cancelled:      "bg-slate-700 text-slate-400",
};

interface InvoiceDetailProps {
  invoice: InvoiceDB;
  onClose: () => void;
  onEdit:  () => void;
}

export default function InvoiceDetail({ invoice: inv, onClose, onEdit }: InvoiceDetailProps) {
  const [showPdf, setShowPdf] = useState(false);
  const items = (inv.invoice_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">{invoiceDisplayNo(inv)}</h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[inv.status] ?? "bg-slate-700 text-slate-300"}`}>
                {invoiceStatusLabel(inv.status)}
              </span>
            </div>
            {inv.title && <p className="text-xs text-slate-400 mt-0.5">{inv.title}</p>}
            <p className="text-xs text-slate-500 mt-0.5">請求書</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg transition-colors">
              編集
            </button>
            <button onClick={onClose}
              className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none ml-2">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Customer / Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">顧客情報</h3>
              <InfoRow label="顧客名" value={invoiceCustomerName(inv.customers)} />
              {inv.customers?.phone && <InfoRow label="電話番号" value={inv.customers.phone} />}
              {inv.customers?.email && <InfoRow label="メール" value={inv.customers.email} />}
            </div>
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">車両情報</h3>
              <InfoRow label="車両" value={invoiceVehicleLabel(inv.vehicles)} />
              {inv.vehicles?.grade && <InfoRow label="グレード" value={inv.vehicles.grade} />}
            </div>
          </div>

          {/* Dates */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">日付</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="発行日" value={inv.issue_date ?? "—"} />
              <InfoRow label="支払期限" value={inv.due_date ?? "—"} />
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">明細</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500">
                    <th className="text-left pb-1.5 pr-3">カテゴリ</th>
                    <th className="text-left pb-1.5 pr-3">品目</th>
                    <th className="text-right pb-1.5 pr-3">単価</th>
                    <th className="text-right pb-1.5 pr-3">数量</th>
                    <th className="text-right pb-1.5">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-700/40 last:border-b-0">
                      <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">
                        {invoiceCategoryLabel(item.category)}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-300">
                        <div>{item.item_name}</div>
                        {item.description && (
                          <div className="text-[10px] text-slate-500">{item.description}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-slate-400 whitespace-nowrap">
                        {formatYen(item.unit_price)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-slate-400">{item.quantity}</td>
                      <td className="py-1.5 text-right text-slate-200 font-medium whitespace-nowrap">
                        {formatYen(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">金額</h3>
            <div className="flex flex-col items-end gap-1.5 text-xs">
              <div className="flex justify-between w-52">
                <span className="text-slate-500">小計</span>
                <span className="text-slate-300">{formatYen(inv.subtotal)}</span>
              </div>
              {inv.discount_amount > 0 && (
                <div className="flex justify-between w-52">
                  <span className="text-slate-500">値引き</span>
                  <span className="text-red-400">－{formatYen(inv.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between w-52">
                <span className="text-slate-500">消費税 ({inv.tax_rate}%)</span>
                <span className="text-slate-300">{formatYen(inv.tax_amount)}</span>
              </div>
              <div className="flex justify-between w-52 border-t border-slate-700 pt-1.5 mt-0.5">
                <span className="text-slate-300 font-semibold">合計</span>
                <span className="text-slate-100 font-bold">{formatYen(inv.total)}</span>
              </div>
              {inv.paid_amount > 0 && (
                <div className="flex justify-between w-52">
                  <span className="text-slate-500">入金済み</span>
                  <span className="text-green-400">－{formatYen(inv.paid_amount)}</span>
                </div>
              )}
              <div className="flex justify-between w-52 border-t border-slate-700 pt-1.5 mt-0.5">
                <span className="text-blue-400 font-semibold">残高</span>
                <span className="text-blue-300 font-bold">{formatYen(inv.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Linked docs */}
          {(inv.work_orders || inv.estimates) && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">紐付け</h3>
              {inv.estimates && (
                <InfoRow label="見積番号" value={inv.estimates.estimate_number ?? "—"} />
              )}
              {inv.work_orders && (
                <InfoRow label="作業指示書" value={inv.work_orders.work_order_number ?? "—"} />
              )}
            </div>
          )}

          {/* Notes */}
          {inv.notes && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}

          {inv.internal_memo && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 border border-slate-700">
              <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider mb-2">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{inv.internal_memo}</p>
            </div>
          )}

          {/* PDF Preview toggle */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <button
              onClick={() => setShowPdf((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                PDF プレビュー
              </h3>
              <span className="text-slate-600 text-xs">{showPdf ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>
            {showPdf && (
              <div className="mt-4">
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => window.print()}
                    className="text-xs bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    印刷 / PDF保存
                  </button>
                </div>
                {/* InvoicePdfPreview is rendered here when ready */}
                <p className="text-xs text-slate-500 text-center py-4">
                  PDFプレビューはこちらに表示されます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
