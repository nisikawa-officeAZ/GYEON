"use client";

import {
  PaymentDB,
  PaymentStatus,
  paymentDisplayNo,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentCustomerName,
} from "@/lib/payments/payment-types";

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

const STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "bg-green-600 text-white",
  pending:   "bg-amber-600 text-white",
  cancelled: "bg-slate-600 text-slate-300",
  refunded:  "bg-red-700 text-white",
};

interface PaymentDetailProps {
  payment: PaymentDB;
  onClose: () => void;
  onEdit:  () => void;
}

export default function PaymentDetail({ payment: p, onClose, onEdit }: PaymentDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">{paymentDisplayNo(p)}</h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[p.status] ?? "bg-slate-700 text-slate-300"}`}>
                {paymentStatusLabel(p.status)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">入金記録</p>
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

          {/* Payment Info */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">入金情報</h3>
            <InfoRow label="入金日"    value={p.payment_date ?? "—"} />
            <InfoRow label="支払方法"  value={paymentMethodLabel(p.payment_method)} />
            <InfoRow label="入金額"    value={formatYen(p.amount)} />
            {p.fee_amount > 0 && (
              <InfoRow label="手数料"  value={formatYen(p.fee_amount)} />
            )}
            <InfoRow label="実入金額"  value={formatYen(p.net_amount)} />
            {p.reference_no && (
              <InfoRow label="参照番号" value={p.reference_no} />
            )}
          </div>

          {/* Invoice Info */}
          {p.invoices && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">請求書情報</h3>
              <InfoRow label="請求書番号" value={p.invoices.invoice_number ?? "—"} />
              {p.invoices.title && <InfoRow label="タイトル" value={p.invoices.title} />}
              <InfoRow label="請求額合計" value={formatYen(p.invoices.total)} />
              <InfoRow label="入金済み"   value={formatYen(p.invoices.paid_amount)} />
              <InfoRow label="残高"       value={formatYen(p.invoices.balance_due)} />
            </div>
          )}

          {/* Customer Info */}
          {p.customers && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">顧客情報</h3>
              <InfoRow label="顧客名" value={paymentCustomerName(p.customers)} />
            </div>
          )}

          {/* Notes */}
          {p.notes && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}

          {p.internal_memo && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 border border-slate-700">
              <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider mb-2">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{p.internal_memo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
