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
    <div className="flex items-start justify-between gap-4 border-b border-[#263955]/70 py-2 last:border-b-0">
      <span className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C6B84]">{label}</span>
      <span className="break-all text-right text-xs text-[#E8EEF7]">{value}</span>
    </div>
  );
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  pending:   "border-amber-400/40 bg-amber-500/15 text-amber-300",
  cancelled: "border-[#5C6B84]/40 bg-[#5C6B84]/15 text-[#c3cee2]",
  refunded:  "border-red-400/40 bg-red-500/15 text-red-300",
};

const detailCardClass =
  "rounded-2xl border border-[#263955] bg-[#111826]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl";
const sectionTitleClass =
  "mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93A4BD]";
const secondaryButtonClass =
  "rounded-xl border border-[#263955] bg-[#0b1220]/70 px-3 py-1.5 text-xs font-semibold text-[#93A4BD] transition-colors hover:border-[#60a5fa]/50 hover:text-[#E8EEF7] disabled:opacity-50";
const primaryButtonClass =
  "rounded-xl bg-[#2F6BFF] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_22px_rgba(47,107,255,0.28)] transition-colors hover:bg-[#3b82f6] disabled:opacity-50";

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
      <div className="fixed inset-0 bg-[#070B14]/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-[#263955] bg-[#070B14] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#263955] bg-[#111826]/70 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#E8EEF7]">{paymentDisplayNo(p)}</h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_BADGE[p.status] ?? "border-[#263955] bg-[#0b1220]/70 text-[#93A4BD]"}`}>
                {paymentStatusLabel(p.status)}
              </span>
              <span className="rounded-full border border-[#263955] bg-[#0b1220]/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#93A4BD]">
                {paymentModeLabel(mode)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5C6B84]">PAYMENT DETAIL</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className={secondaryButtonClass}>
              メモ編集
            </button>
            <button onClick={onClose}
              className="ml-2 text-lg leading-none text-[#5C6B84] transition-colors hover:text-[#E8EEF7]">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Payment Info */}
          <div className={detailCardClass}>
            <h3 className={sectionTitleClass}>入金情報 / PAYMENT</h3>
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
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>請求書情報 / DIRECT INVOICE</h3>
              <InfoRow label="請求書番号" value={p.invoices.invoice_number ?? "—"} />
              {p.invoices.title && <InfoRow label="タイトル" value={p.invoices.title} />}
              <InfoRow label="請求額合計" value={formatYen(p.invoices.total)} />
              <InfoRow label="入金済み"   value={formatYen(p.invoices.paid_amount)} />
              <InfoRow label="残高"       value={formatYen(p.invoices.balance_due)} />
            </div>
          )}

          {/* Allocations (allocated) */}
          {mode === "allocated" && (
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>割当内訳 / ALLOCATIONS</h3>
              {allocations.length === 0 ? (
                <p className="text-xs text-[#5C6B84]">読み込み中...</p>
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
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>前受金 / UNAPPLIED</h3>
              <p className="text-xs text-[#c3cee2]">
                この入金は前受金（未割当）として記録されています。未割当残額: {formatYen(p.amount)}
              </p>
            </div>
          )}

          {/* Conversion (legacy_direct only) */}
          {canConvert && !converting && (
            <button onClick={openConversion}
              className="self-start rounded-full border border-[#2F6BFF]/35 bg-[#2F6BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#60a5fa] transition-colors hover:bg-[#2F6BFF]/15">
              → 割当入金へ振替（複数請求書への配分）
            </button>
          )}
          {converting && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#2F6BFF]/40 bg-[#111826]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93A4BD]">割当入金へ振替 / CONVERT</h3>
              <p className="text-[10px] text-[#5C6B84]">
                入金額 {formatYen(p.amount)} を割当し直します。元の請求書への正の割当が必須です。
              </p>
              {convError && (
                <div className="rounded-xl border border-red-500/35 bg-red-950/30 px-3 py-2">
                  <p className="text-xs text-red-300">{convError}</p>
                </div>
              )}
              {convLoading ? (
                <p className="text-xs text-[#5C6B84]">未払い請求書を読み込み中...</p>
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
                  className={secondaryButtonClass}>
                  キャンセル
                </button>
                <button onClick={submitConversion} disabled={pending}
                  className={primaryButtonClass}>
                  {pending ? "振替中..." : "振替を実行"}
                </button>
              </div>
            </div>
          )}

          {/* Customer Info */}
          {p.customers && (
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>顧客情報 / CUSTOMER</h3>
              <InfoRow label="顧客名" value={paymentCustomerName(p.customers)} />
            </div>
          )}

          {/* Notes */}
          {p.notes && (
            <div className={detailCardClass}>
              <h3 className={sectionTitleClass}>備考 / NOTES</h3>
              <p className="text-xs text-[#c3cee2] whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}

          {p.internal_memo && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-[#E8EEF7] whitespace-pre-wrap">{p.internal_memo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
