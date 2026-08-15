"use client";

// B3-B1B I1 — payment detail. Shows the derived mode, persisted allocations, and the
// unapplied remainder. Legacy-direct payments can be converted to allocated through the
// atomic conversion RPC (the proposed set MUST keep a positive allocation on the original
// invoice — mirrored here for UX; the database enforces it authoritatively). No delete.

import { useEffect, useState, useTransition } from "react";
import {
  PaymentDB,
  PaymentStatus,
  PaymentAllocationInput,
  PaymentAllocationRow,
  OpenInvoiceOption,
  paymentDisplayNo,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentCustomerName,
  paymentModeLabel,
  derivePaymentMode,
} from "@/lib/payments/payment-types";
import { getPaymentAllocations } from "@/lib/payments/get-payment-allocations";
import { getOpenInvoicesForCustomer } from "@/lib/payments/get-payments";
import { convertPaymentToAllocated } from "@/lib/payments/convert-payment-to-allocated";
import AllocationEditor, { validateAllocations } from "./AllocationEditor";

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
  payment:      PaymentDB;
  onClose:      () => void;
  onEdit:       () => void;
  onConverted?: () => void;
}

export default function PaymentDetail({ payment: p, onClose, onEdit, onConverted }: PaymentDetailProps) {
  const mode = derivePaymentMode(p);
  const [allocations, setAllocations] = useState<PaymentAllocationRow[]>([]);
  const [converting, setConverting]   = useState(false);
  const [convError, setConvError]     = useState<string | null>(null);
  const [convInvoices, setConvInvoices] = useState<OpenInvoiceOption[]>([]);
  const [convPinned, setConvPinned]     = useState<OpenInvoiceOption[]>([]);
  const [convAllocs, setConvAllocs]     = useState<PaymentAllocationInput[]>([]);
  const [convLoading, setConvLoading]   = useState(false);
  const [pending, startTransition]      = useTransition();

  useEffect(() => {
    if (mode === "allocated") {
      getPaymentAllocations(p.id).then(setAllocations);
    }
  }, [p.id, mode]);

  const allocatedSum = allocations.reduce((s, a) => s + a.allocated_amount, 0);
  const canConvert = mode === "legacy_direct" && p.status === "completed";

  function openConversion() {
    if (!p.invoice_id) return;
    setConvError(null);
    setConverting(true);
    setConvLoading(true);
    // Default proposal: keep the full amount on the ORIGINAL invoice; the operator can
    // then split it. The original invoice is pinned even when it is no longer "open".
    setConvAllocs([{ invoice_id: p.invoice_id, allocated_amount: p.amount, allocation_order: 0 }]);
    const pinned: OpenInvoiceOption = {
      id:             p.invoice_id,
      invoice_number: p.invoices?.invoice_number ?? null,
      title:          p.invoices?.title ?? null,
      due_date:       null,
      total:          p.invoices?.total ?? p.amount,
      paid_amount:    p.invoices?.paid_amount ?? 0,
      balance_due:    (p.invoices?.balance_due ?? 0) + p.amount, // capacity freed by unlinking
      status:         p.invoices?.status ?? "issued",
    };
    setConvPinned([pinned]);
    if (p.customer_id) {
      getOpenInvoicesForCustomer(p.customer_id).then((list) => {
        setConvInvoices(list.filter((i) => i.id !== p.invoice_id));
        setConvLoading(false);
      });
    } else {
      setConvInvoices([]);
      setConvLoading(false);
    }
  }

  function submitConversion() {
    setConvError(null);
    if (!p.invoice_id) return;
    // UX mirror of the RPC rule: the set must keep a positive allocation on the original.
    const original = convAllocs.find((a) => a.invoice_id === p.invoice_id);
    if (!original || original.allocated_amount <= 0) {
      setConvError("元の請求書への割当が必要です");
      return;
    }
    const validationError = validateAllocations(convAllocs, [...convPinned, ...convInvoices], p.amount);
    if (validationError) { setConvError(validationError); return; }
    startTransition(async () => {
      const result = await convertPaymentToAllocated(p.id, convAllocs);
      if ("error" in result) setConvError(result.error);
      else {
        setConverting(false);
        onConverted?.();
      }
    });
  }

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
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                {paymentModeLabel(mode)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">入金記録</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg transition-colors">
              メモ編集
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
            <InfoRow label="区分"      value={paymentModeLabel(mode)} />
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

          {/* Direct invoice (legacy_direct) */}
          {p.invoices && p.invoice_id && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">請求書情報（直接入金）</h3>
              <InfoRow label="請求書番号" value={p.invoices.invoice_number ?? "—"} />
              {p.invoices.title && <InfoRow label="タイトル" value={p.invoices.title} />}
              <InfoRow label="請求額合計" value={formatYen(p.invoices.total)} />
              <InfoRow label="入金済み"   value={formatYen(p.invoices.paid_amount)} />
              <InfoRow label="残高"       value={formatYen(p.invoices.balance_due)} />
            </div>
          )}

          {/* Allocations (allocated) */}
          {mode === "allocated" && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">割当内訳</h3>
              {allocations.length === 0 ? (
                <p className="text-xs text-slate-500">読み込み中...</p>
              ) : (
                <>
                  {allocations.map((a) => (
                    <InfoRow key={a.id}
                      label={a.invoices?.invoice_number ?? "（番号なし）"}
                      value={formatYen(a.allocated_amount)} />
                  ))}
                  <InfoRow label="割当合計" value={formatYen(allocatedSum)} />
                  <InfoRow label="未割当（前受金）" value={formatYen(p.amount - allocatedSum)} />
                </>
              )}
            </div>
          )}

          {/* Unapplied credit */}
          {mode === "unapplied" && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">前受金</h3>
              <p className="text-xs text-slate-300">
                この入金は前受金（未割当）として記録されています。未割当残額: {formatYen(p.amount)}
              </p>
            </div>
          )}

          {/* Conversion (legacy_direct only) */}
          {canConvert && !converting && (
            <button onClick={openConversion}
              className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium self-start transition-colors">
              → 割当入金へ振替（複数請求書への配分）
            </button>
          )}
          {converting && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 flex flex-col gap-3 border border-[#1d4ed8]/40">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">割当入金へ振替</h3>
              <p className="text-[10px] text-slate-500">
                入金額 {formatYen(p.amount)} を割当し直します。元の請求書への正の割当が必須です。
              </p>
              {convError && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{convError}</p>
                </div>
              )}
              {convLoading ? (
                <p className="text-xs text-slate-500">未払い請求書を読み込み中...</p>
              ) : (
                <AllocationEditor
                  invoices={convInvoices}
                  pinnedInvoices={convPinned}
                  amount={p.amount}
                  allocations={convAllocs}
                  onChange={setConvAllocs}
                />
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setConverting(false)} disabled={pending}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                  キャンセル
                </button>
                <button onClick={submitConversion} disabled={pending}
                  className="px-3 py-1.5 text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
                  {pending ? "振替中..." : "振替を実行"}
                </button>
              </div>
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
