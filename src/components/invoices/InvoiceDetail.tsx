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
import PaymentSection from "@/components/payments/PaymentSection";
import InvoicePdfIssueActions from "@/components/invoices/InvoicePdfIssueActions";
import { paymentProgress } from "@/lib/accounts-receivable/ar-calculations";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#263955]/70 py-2 last:border-b-0">
      <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C6B84]">{label}</span>
      <span className="break-all text-right text-xs text-[#E8EEF7]">{value}</span>
    </div>
  );
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:          "border-[#5C6B84]/40 bg-[#5C6B84]/15 text-[#c3cee2]",
  issued:         "border-[#2F6BFF]/45 bg-[#2F6BFF]/15 text-[#93c5fd]",
  paid:           "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  partially_paid: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  overdue:        "border-red-400/40 bg-red-500/15 text-red-300",
  cancelled:      "border-[#5C6B84]/30 bg-[#0b1220]/70 text-[#8191ad]",
};

const detailCardClass =
  "rounded-2xl border border-[#263955] bg-[#111826]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl";
const sectionTitleClass =
  "mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93A4BD]";
const secondaryButtonClass =
  "rounded-xl border border-[#263955] bg-[#0b1220]/70 px-3 py-1.5 text-xs font-semibold text-[#93A4BD] transition-colors hover:border-[#60a5fa]/50 hover:text-[#E8EEF7]";

interface InvoiceDetailProps {
  invoice: InvoiceDB;
  onClose: () => void;
  onEdit:  () => void;
  /**
   * B1-V1-R1: lets the owning list replace its copy of this row the moment the
   * invoice changes, so the table leaves the draft state without a reload.
   * Fired twice on issuance: once optimistically, once with the canonical row.
   */
  onInvoiceChange?: (invoice: InvoiceDB) => void;
}

export default function InvoiceDetail({
  invoice: inv,
  onClose,
  onEdit,
  onInvoiceChange,
}: InvoiceDetailProps) {
  const [showPayments, setShowPayments] = useState(false);
  const [invoiceData,  setInvoiceData]  = useState(inv);
  const isDraft = invoiceData.status === "draft";
  const items = (invoiceData.invoice_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  /**
   * A successful issuance is SERVER-CONFIRMED before this runs, so the local
   * view flips to issued immediately and never flips back: the canonical
   * re-read only enriches the row (numbers, pointers, timestamps). If that
   * read fails, the optimistic issued state stands rather than lying about a
   * draft the database no longer has.
   */
  function handleIssued() {
    const optimistic: InvoiceDB = { ...invoiceData, status: "issued" };
    setInvoiceData(optimistic);
    onInvoiceChange?.(optimistic);

    import("@/lib/invoices/get-invoice")
      .then(({ getInvoice }) => getInvoice(inv.id))
      .then((canonical) => {
        if (!canonical) return;
        setInvoiceData(canonical);
        onInvoiceChange?.(canonical);
      })
      .catch(() => {
        /* keep the server-confirmed issued state */
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[#070B14]/85 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-[#263955] bg-[#070B14] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#263955] bg-[#111826]/70 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#E8EEF7]">{invoiceDisplayNo(invoiceData)}</h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_BADGE[invoiceData.status] ?? "border-[#263955] bg-[#0b1220]/70 text-[#93A4BD]"}`}>
                {invoiceStatusLabel(invoiceData.status)}
              </span>
            </div>
            {invoiceData.title && <p className="mt-0.5 text-xs text-[#93A4BD]">{invoiceData.title}</p>}
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5C6B84]">INVOICE DETAIL</p>
          </div>
          <div className="flex items-center gap-2">
            {/* B1: editing is a draft-only privilege. */}
            {isDraft && (
              <button onClick={onEdit}
                className={secondaryButtonClass}>
                編集
              </button>
            )}
            <button onClick={onClose}
              className="ml-2 text-lg leading-none text-[#5C6B84] transition-colors hover:text-[#E8EEF7]">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Customer / Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>顧客情報 / CUSTOMER</h3>
              <InfoRow label="顧客名" value={invoiceCustomerName(inv.customers)} />
              {inv.customers?.phone && <InfoRow label="電話番号" value={inv.customers.phone} />}
              {inv.customers?.email && <InfoRow label="メール" value={inv.customers.email} />}
            </div>
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>車両情報 / VEHICLE</h3>
              <InfoRow label="車両" value={invoiceVehicleLabel(inv.vehicles)} />
              {inv.vehicles?.grade && <InfoRow label="グレード" value={inv.vehicles.grade} />}
            </div>
          </div>

          {/* Dates */}
          <div className={detailCardClass}>
            <h3 className={sectionTitleClass}>日付 / DATES</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="発行日" value={inv.issue_date ?? "—"} />
              <InfoRow label="支払期限" value={inv.due_date ?? "—"} />
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>明細 / LINE ITEMS</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#263955] text-[#5C6B84]">
                    <th className="text-left pb-1.5 pr-3">カテゴリ</th>
                    <th className="text-left pb-1.5 pr-3">品目</th>
                    <th className="text-right pb-1.5 pr-3">単価</th>
                    <th className="text-right pb-1.5 pr-3">数量</th>
                    <th className="text-right pb-1.5">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[#263955]/70 last:border-b-0">
                      <td className="py-1.5 pr-3 text-[#5C6B84] whitespace-nowrap">
                        {invoiceCategoryLabel(item.category)}
                      </td>
                      <td className="py-1.5 pr-3 text-[#c3cee2]">
                        <div>{item.item_name}</div>
                        {item.description && (
                          <div className="text-[10px] text-[#5C6B84]">{item.description}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#93A4BD] whitespace-nowrap">
                        {formatYen(item.unit_price)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#93A4BD]">{item.quantity}</td>
                      <td className="py-1.5 text-right text-[#E8EEF7] font-medium whitespace-nowrap">
                        {formatYen(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className={detailCardClass}>
            <h3 className={sectionTitleClass}>金額 / TOTALS</h3>
            <div className="flex flex-col items-end gap-1.5 text-xs">
              <div className="flex justify-between w-52">
                <span className="text-[#5C6B84]">小計</span>
                <span className="text-[#93A4BD]">{formatYen(invoiceData.subtotal)}</span>
              </div>
              {invoiceData.discount_amount > 0 && (
                <div className="flex justify-between w-52">
                  <span className="text-[#5C6B84]">値引き</span>
                  <span className="text-red-400">－{formatYen(invoiceData.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between w-52">
                <span className="text-[#5C6B84]">消費税 ({invoiceData.tax_rate}%)</span>
                <span className="text-[#93A4BD]">{formatYen(invoiceData.tax_amount)}</span>
              </div>
              <div className="flex justify-between w-52 border-t border-[#263955] pt-1.5 mt-0.5">
                <span className="text-[#E8EEF7] font-semibold">合計</span>
                <span className="text-white font-bold">{formatYen(invoiceData.total)}</span>
              </div>
              {invoiceData.paid_amount > 0 && (
                <div className="flex justify-between w-52">
                  <span className="text-[#5C6B84]">入金済み</span>
                  <span className="text-green-400">－{formatYen(invoiceData.paid_amount)}</span>
                </div>
              )}
              <div className="flex justify-between w-52 border-t border-[#263955] pt-1.5 mt-0.5">
                <span className="text-[#60a5fa] font-semibold">残高</span>
                <span className="text-[#93c5fd] font-bold">{formatYen(invoiceData.balance_due)}</span>
              </div>
              {/* E8.6: payment progress */}
              <div className="w-52 mt-2">
                <div className="flex justify-between text-[10px] text-[#5C6B84] mb-1">
                  <span>入金進捗</span>
                  <span>{paymentProgress(invoiceData)}%</span>
                </div>
                <div className="h-1.5 bg-[#263955] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${paymentProgress(invoiceData)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Linked docs */}
          {(inv.work_orders || inv.estimates) && (
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>紐付け / LINKED</h3>
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
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>備考 / NOTES</h3>
              <p className="text-xs text-[#c3cee2] whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}

          {inv.internal_memo && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-[#E8EEF7] whitespace-pre-wrap">{inv.internal_memo}</p>
            </div>
          )}

          {/* Payment Section */}
          <div className={detailCardClass}>
            <button
              onClick={() => setShowPayments((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93A4BD]">入金管理 / PAYMENTS</h3>
                {invoiceData.paid_amount > 0 && (
                  <span className="text-[10px] text-green-400 font-medium">
                    ¥{invoiceData.paid_amount.toLocaleString("ja-JP")} 入金済み
                  </span>
                )}
                {invoiceData.balance_due > 0 && (
                  <span className="text-[10px] text-blue-400 font-medium">
                    残 ¥{invoiceData.balance_due.toLocaleString("ja-JP")}
                  </span>
                )}
              </div>
              <span className="text-[#5C6B84] text-xs">{showPayments ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>
            {showPayments && (
              <div className="mt-4">
                <PaymentSection
                  invoiceId={invoiceData.id}
                  invoiceBalance={invoiceData.balance_due}
                  onPaymentSaved={async () => {
                    // Refresh invoice data after payment changes
                    const { getInvoice } = await import("@/lib/invoices/get-invoice");
                    const fresh = await getInvoice(invoiceData.id);
                    if (fresh) setInvoiceData(fresh);
                  }}
                />
              </div>
            )}
          </div>

          {/* B1: the invoice PDF surface. A draft is issued once, producing an
              immutable artifact; an issued invoice only ever re-downloads that
              same file. The old placeholder and the target-less print button are
              gone — they promised a document they could not produce. */}
          <div className={detailCardClass}>
            <h3 className={sectionTitleClass}>
              請求書PDF / PDF
            </h3>
            <InvoicePdfIssueActions
              invoiceId={invoiceData.id}
              status={invoiceData.status}
              workOrderActualEndAt={invoiceData.work_orders?.actual_end_at ?? null}
              onIssued={handleIssued}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
