"use client";

// B3-B1B I1 — payment form.
//
// CREATE (invoice context)  : fixed legacy_direct against the surrounding invoice.
// CREATE (global context)   : customer selection; allocated by default when open invoices
//                             exist (oldest-due-first advisory proposal, user-editable),
//                             unapplied only when none exist or explicitly chosen.
// EDIT                      : notes / internal_memo ONLY — every financial field is
//                             read-only display. Financial correction is a later phase.
//
// One client-stable idempotency key is minted per opened create form, reused verbatim on
// every retry of that submission, and regenerated only when a new form mounts after
// success. Creation status is always "completed" in I1.

import { useState, useTransition } from "react";
import {
  PaymentDB,
  PaymentMethod,
  PAYMENT_METHODS,
  PayableCustomerOption,
  OpenInvoiceOption,
  PaymentAllocationInput,
  calculateNetAmount,
  paymentDisplayNo,
} from "@/lib/payments/payment-types";
import { createPayment } from "@/lib/payments/create-payment";
import { updatePayment } from "@/lib/payments/update-payment";
import { getOpenInvoicesForCustomer } from "@/lib/payments/get-payments";
import AllocationEditor, { proposeOldestDueFirst, validateAllocations } from "./AllocationEditor";

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const labelClass = "text-xs font-medium text-slate-400";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

function customerOptionLabel(c: PayableCustomerOption): string {
  return [c.last_name, c.first_name].filter(Boolean).join(" ") || c.name || "（名称未設定）";
}

export type PaymentFormContext =
  | { kind: "invoice"; invoiceId: string; invoiceBalance?: number }
  | { kind: "global"; customers: PayableCustomerOption[] };

interface PaymentFormProps {
  context:   PaymentFormContext;
  payment?:  PaymentDB;
  onCancel?: () => void;
  onSuccess?: (id: string) => void;
}

export default function PaymentForm({ context, payment, onCancel, onSuccess }: PaymentFormProps) {
  const isEdit = !!payment;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // One stable key per opened create form; unchanged across retries of this submission.
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());

  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentDate, setPaymentDate]     = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod]               = useState<PaymentMethod>("cash");
  const [amount, setAmount]               = useState<number>(
    context.kind === "invoice" ? (context.invoiceBalance ?? 0) : 0);
  const [fee, setFee]                     = useState<number>(0);
  const [referenceNo, setReferenceNo]     = useState("");
  const [notes, setNotes]                 = useState(payment?.notes ?? "");
  const [internalMemo, setInternalMemo]   = useState(payment?.internal_memo ?? "");

  // global-flow state
  const [customerId, setCustomerId]       = useState("");
  const [openInvoices, setOpenInvoices]   = useState<OpenInvoiceOption[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [mode, setMode]                   = useState<"allocated" | "unapplied">("unapplied");
  const [allocations, setAllocations]     = useState<PaymentAllocationInput[]>([]);

  const netAmount = calculateNetAmount(amount, fee);

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setAllocations([]);
    setOpenInvoices([]);
    if (!nextCustomerId) return;
    setInvoicesLoading(true);
    getOpenInvoicesForCustomer(nextCustomerId).then((invoices) => {
      setOpenInvoices(invoices);
      // Open invoices -> allocated by default with the advisory proposal;
      // none -> unapplied credit is the only sensible default.
      if (invoices.length > 0) {
        setMode("allocated");
        setAllocations(proposeOldestDueFirst(invoices, amount));
      } else {
        setMode("unapplied");
      }
      setInvoicesLoading(false);
    });
  }

  function handleModeChange(next: "allocated" | "unapplied") {
    setMode(next);
    if (next === "allocated" && allocations.length === 0) {
      setAllocations(proposeOldestDueFirst(openInvoices, amount));
    }
    if (next === "unapplied") setAllocations([]);
  }

  // ── EDIT: notes / internal_memo only ──────────────────────────────────────────
  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("notes", notes);
    fd.set("internal_memo", internalMemo);
    startTransition(async () => {
      const result = await updatePayment(payment!.id, fd);
      if ("error" in result) setError(result.error);
      else onSuccess?.(payment!.id);
    });
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────
  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(amount) || amount <= 0) { setError("入金額を入力してください"); return; }

    const fd = new FormData();
    fd.set("idempotency_key", idempotencyKey);
    fd.set("payment_number", paymentNumber);
    fd.set("payment_date",   paymentDate);
    fd.set("payment_method", method);
    fd.set("amount",         String(amount));
    fd.set("fee_amount",     String(fee));
    fd.set("reference_no",   referenceNo);
    fd.set("notes",          notes);
    fd.set("internal_memo",  internalMemo);

    if (context.kind === "invoice") {
      fd.set("mode", "legacy_direct");
      fd.set("invoice_id", context.invoiceId);
      fd.set("allocations", "[]");
    } else {
      if (!customerId) { setError("顧客を選択してください"); return; }
      fd.set("customer_id", customerId);
      if (mode === "allocated") {
        if (allocations.length === 0) { setError("割当先の請求書を指定してください"); return; }
        const validationError = validateAllocations(allocations, openInvoices, amount);
        if (validationError) { setError(validationError); return; }
        fd.set("mode", "allocated");
        fd.set("allocations", JSON.stringify(allocations));
      } else {
        fd.set("mode", "unapplied");
        fd.set("allocations", "[]");
      }
    }

    startTransition(async () => {
      const result = await createPayment(fd);
      if ("error" in result) setError(result.error);
      else onSuccess?.(result.id);
    });
  }

  // ── EDIT rendering: memo fields only, financial fields shown read-only ────────
  if (isEdit && payment) {
    return (
      <form onSubmit={handleEditSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 flex flex-col gap-0.5">
          <p className="text-[10px] text-slate-500">入金番号: {paymentDisplayNo(payment)}</p>
          <p className="text-[10px] text-slate-500">
            入金額 {formatYen(payment.amount)} ・ 入金日 {payment.payment_date ?? "—"}
          </p>
          <p className="text-[10px] text-amber-500/80">
            金額・日付などの金銭項目は登録後に変更できません（備考・内部メモのみ編集可能）
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>備考</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3} placeholder="備考..." className={`${inputClass} resize-none`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>内部メモ（PDFには出力されません）</label>
          <textarea value={internalMemo} onChange={(e) => setInternalMemo(e.target.value)}
            rows={2} placeholder="社内向けメモ..." className={`${inputClass} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
          <button type="button" onClick={onCancel} disabled={pending}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
            キャンセル
          </button>
          <button type="submit" disabled={pending}
            className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
            {pending ? "保存中..." : "更新"}
          </button>
        </div>
      </form>
    );
  }

  // ── CREATE rendering ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleCreateSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {context.kind === "global" && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>顧客</label>
          <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}
            className={inputClass}>
            <option value="">顧客を選択...</option>
            {context.customers.map((c) => (
              <option key={c.id} value={c.id}>{customerOptionLabel(c)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Payment number / Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金番号（任意）</label>
          <input type="text" value={paymentNumber}
            onChange={(e) => setPaymentNumber(e.target.value)}
            placeholder="PAY-0000-00001" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金日</label>
          <input type="date" value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Method */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>支払方法</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className={inputClass}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金額 (¥)</label>
          <input type="number" value={amount} min={0}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>手数料 (¥)</label>
          <input type="number" value={fee} min={0}
            onChange={(e) => setFee(parseFloat(e.target.value) || 0)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>実入金額</label>
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-medium">
            {formatYen(netAmount)}
          </div>
        </div>
      </div>

      {/* Global flow: mode + allocation editor */}
      {context.kind === "global" && customerId && (
        <div className="flex flex-col gap-3 border border-slate-700 rounded-lg p-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input type="radio" name="payment-mode" checked={mode === "allocated"}
                disabled={openInvoices.length === 0}
                onChange={() => handleModeChange("allocated")} />
              請求書へ割当
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input type="radio" name="payment-mode" checked={mode === "unapplied"}
                onChange={() => handleModeChange("unapplied")} />
              前受金として登録（未割当）
            </label>
          </div>
          {invoicesLoading ? (
            <p className="text-xs text-slate-500">未払い請求書を読み込み中...</p>
          ) : mode === "allocated" ? (
            <AllocationEditor
              invoices={openInvoices}
              amount={amount}
              allocations={allocations}
              onChange={setAllocations}
            />
          ) : (
            <p className="text-[10px] text-slate-500">
              入金額全額を前受金（未割当）として記録します。
              {openInvoices.length > 0 && " 未払いの請求書がありますが、明示的に前受金を選択しています。"}
            </p>
          )}
        </div>
      )}

      {/* Reference No */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>参照番号</label>
        <input type="text" value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
          placeholder="振込番号・取引IDなど" className={inputClass} />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>備考</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={3} placeholder="備考..." className={`${inputClass} resize-none`} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>内部メモ（PDFには出力されません）</label>
        <textarea value={internalMemo} onChange={(e) => setInternalMemo(e.target.value)}
          rows={2} placeholder="社内向けメモ..." className={`${inputClass} resize-none`} />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
          キャンセル
        </button>
        <button type="submit" disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "保存中..." : "入金登録"}
        </button>
      </div>
    </form>
  );
}
