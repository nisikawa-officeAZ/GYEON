"use client";

import { useState, useTransition } from "react";
import {
  PaymentDB,
  PaymentMethod,
  PaymentStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  calculateNetAmount,
  paymentDisplayNo,
} from "@/lib/payments/payment-types";
import { createPayment } from "@/lib/payments/create-payment";
import { updatePayment } from "@/lib/payments/update-payment";

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const labelClass = "text-xs font-medium text-slate-400";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

interface FormFields {
  payment_number: string;
  payment_date:   string;
  payment_method: PaymentMethod;
  amount:         number;
  fee_amount:     number;
  status:         PaymentStatus;
  reference_no:   string;
  notes:          string;
  internal_memo:  string;
}

function fromDB(p: PaymentDB): FormFields {
  return {
    payment_number: p.payment_number  ?? "",
    payment_date:   p.payment_date    ?? "",
    payment_method: p.payment_method,
    amount:         p.amount,
    fee_amount:     p.fee_amount,
    status:         p.status,
    reference_no:   p.reference_no    ?? "",
    notes:          p.notes           ?? "",
    internal_memo:  p.internal_memo   ?? "",
  };
}

const EMPTY_FORM: FormFields = {
  payment_number: "",
  payment_date:   new Date().toISOString().slice(0, 10),
  payment_method: "cash",
  amount:         0,
  fee_amount:     0,
  status:         "completed",
  reference_no:   "",
  notes:          "",
  internal_memo:  "",
};

interface PaymentFormProps {
  invoiceId:        string;
  invoiceBalance?:  number;  // pre-fill amount with balance
  payment?:         PaymentDB;
  onCancel?:        () => void;
  onSuccess?:       (id: string) => void;
}

export default function PaymentForm({
  invoiceId,
  invoiceBalance,
  payment,
  onCancel,
  onSuccess,
}: PaymentFormProps) {
  const isEdit = !!payment;
  const [form, setForm] = useState<FormFields>(
    payment
      ? fromDB(payment)
      : { ...EMPTY_FORM, amount: invoiceBalance ?? 0 }
  );
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const netAmount = calculateNetAmount(form.amount, form.fee_amount);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("invoice_id",     invoiceId);
    fd.set("payment_number", form.payment_number);
    fd.set("payment_date",   form.payment_date);
    fd.set("payment_method", form.payment_method);
    fd.set("amount",         String(form.amount));
    fd.set("fee_amount",     String(form.fee_amount));
    fd.set("status",         form.status);
    fd.set("reference_no",   form.reference_no);
    fd.set("notes",          form.notes);
    fd.set("internal_memo",  form.internal_memo);

    startTransition(async () => {
      const result = isEdit && payment
        ? await updatePayment(payment.id, fd)
        : await createPayment(fd);

      if ("error" in result) {
        setError(result.error);
      } else {
        const id = isEdit ? payment!.id : (result as { success: true; id: string }).id;
        onSuccess?.(id);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {isEdit && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500">入金番号: {paymentDisplayNo(payment!)}</p>
        </div>
      )}

      {/* Payment number / Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金番号</label>
          <input type="text" value={form.payment_number}
            onChange={(e) => set("payment_number", e.target.value)}
            placeholder="PAY-2024-001" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金日</label>
          <input type="date" value={form.payment_date}
            onChange={(e) => set("payment_date", e.target.value)}
            className={inputClass} />
        </div>
      </div>

      {/* Method / Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>支払方法</label>
          <select value={form.payment_method}
            onChange={(e) => set("payment_method", e.target.value as PaymentMethod)}
            className={inputClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          <select value={form.status}
            onChange={(e) => set("status", e.target.value as PaymentStatus)}
            className={inputClass}>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入金額 (¥)</label>
          <input type="number" value={form.amount} min={0}
            onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
            className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>手数料 (¥)</label>
          <input type="number" value={form.fee_amount} min={0}
            onChange={(e) => set("fee_amount", parseFloat(e.target.value) || 0)}
            className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>実入金額</label>
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-medium">
            {formatYen(netAmount)}
          </div>
        </div>
      </div>

      {/* Reference No */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>参照番号</label>
        <input type="text" value={form.reference_no}
          onChange={(e) => set("reference_no", e.target.value)}
          placeholder="振込番号・取引IDなど" className={inputClass} />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>備考</label>
        <textarea value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3} placeholder="備考..."
          className={`${inputClass} resize-none`} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>内部メモ（PDFには出力されません）</label>
        <textarea value={form.internal_memo}
          onChange={(e) => set("internal_memo", e.target.value)}
          rows={2} placeholder="社内向けメモ..."
          className={`${inputClass} resize-none`} />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
          キャンセル
        </button>
        <button type="submit" disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "保存中..." : isEdit ? "更新" : "入金登録"}
        </button>
      </div>
    </form>
  );
}
