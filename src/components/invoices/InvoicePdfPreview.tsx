"use client";

import { InvoiceDB, invoiceDisplayNo, invoiceCustomerName, invoiceVehicleLabel, invoiceCategoryLabel } from "@/lib/invoices/invoice-types";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

interface InvoicePdfPreviewProps {
  invoice: InvoiceDB;
}

export default function InvoicePdfPreview({ invoice: inv }: InvoicePdfPreviewProps) {
  const items = (inv.invoice_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            z-index: 9999 !important;
            padding: 24mm 20mm !important;
          }
        }
      `}</style>

      <div
        id="invoice-print-area"
        className="bg-white text-gray-900 rounded-xl p-8 text-sm leading-relaxed"
        style={{ minHeight: "297mm", fontFamily: "sans-serif" }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{inv.title ?? "請求書"}</h1>
            <p className="text-sm text-gray-500">{invoiceDisplayNo(inv)}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            {inv.issue_date && <p>発行日: {inv.issue_date}</p>}
            {inv.due_date  && <p>支払期限: {inv.due_date}</p>}
          </div>
        </div>

        {/* Customer / Vehicle */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">請求先</p>
            <p className="font-semibold text-gray-900">{invoiceCustomerName(inv.customers)}</p>
            {inv.customers?.phone && <p className="text-xs text-gray-500">{inv.customers.phone}</p>}
            {inv.customers?.email && <p className="text-xs text-gray-500">{inv.customers.email}</p>}
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">車両</p>
            <p className="text-sm text-gray-700">{invoiceVehicleLabel(inv.vehicles)}</p>
            {inv.vehicles?.grade && <p className="text-xs text-gray-500">{inv.vehicles.grade}</p>}
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-6 border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 pr-3 text-gray-600 font-medium">カテゴリ</th>
              <th className="text-left py-2 pr-3 text-gray-600 font-medium">品目</th>
              <th className="text-right py-2 pr-3 text-gray-600 font-medium">単価</th>
              <th className="text-right py-2 pr-3 text-gray-600 font-medium">数量</th>
              <th className="text-right py-2 pr-3 text-gray-600 font-medium">割引</th>
              <th className="text-right py-2 text-gray-600 font-medium">小計</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 pr-3 text-gray-500">{invoiceCategoryLabel(item.category)}</td>
                <td className="py-2 pr-3">
                  <p className="text-gray-900">{item.item_name}</p>
                  {item.description && <p className="text-[10px] text-gray-400">{item.description}</p>}
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 whitespace-nowrap">{formatYen(item.unit_price)}</td>
                <td className="py-2 pr-3 text-right text-gray-700">{item.quantity}</td>
                <td className="py-2 pr-3 text-right text-gray-500">
                  {item.discount_rate > 0 ? `${item.discount_rate}%` : "—"}
                </td>
                <td className="py-2 text-right font-medium text-gray-900 whitespace-nowrap">{formatYen(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-56 text-xs flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-gray-500">小計</span>
              <span className="text-gray-700">{formatYen(inv.subtotal)}</span>
            </div>
            {inv.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">値引き</span>
                <span className="text-red-600">－{formatYen(inv.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">消費税 ({inv.tax_rate}%)</span>
              <span className="text-gray-700">{formatYen(inv.tax_amount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-300 pt-1.5 mt-1">
              <span className="font-bold text-gray-900">合計</span>
              <span className="font-bold text-gray-900 text-sm">{formatYen(inv.total)}</span>
            </div>
            {inv.paid_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">入金済み</span>
                <span className="text-green-600">－{formatYen(inv.paid_amount)}</span>
              </div>
            )}
            {inv.balance_due > 0 && (
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-0.5">
                <span className="font-semibold text-blue-700">残高</span>
                <span className="font-bold text-blue-700">{formatYen(inv.balance_due)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">備考</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{inv.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
