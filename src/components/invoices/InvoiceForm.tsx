"use client";

import { useState, useTransition, useEffect } from "react";
import {
  InvoiceDB,
  InvoiceStatus,
  InvoiceCategory,
  InvoiceItemInput,
  INVOICE_CATEGORIES,
  INVOICE_STATUSES,
  calculateInvoiceTotals,
  lineTotal,
  invoiceDisplayNo,
} from "@/lib/invoices/invoice-types";
import { createInvoice } from "@/lib/invoices/create-invoice";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";
import { updateInvoice } from "@/lib/invoices/update-invoice";

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const labelClass = "text-xs font-medium text-slate-400";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const EMPTY_ITEM: InvoiceItemInput = {
  category:      "other",
  item_name:     "",
  description:   "",
  quantity:      1,
  unit_price:    0,
  discount_rate: 0,
  sort_order:    0,
};

interface FormFields {
  invoice_number:      string;
  status:              InvoiceStatus;
  title:               string;
  issue_date:          string;
  due_date:            string;
  discount_amount:     number;
  tax_rate:            number;
  paid_amount:         number;
  notes:               string;
  internal_memo:       string;
}

function fromDB(inv: InvoiceDB): { form: FormFields; items: InvoiceItemInput[] } {
  return {
    form: {
      invoice_number:  inv.invoice_number  ?? "",
      status:          inv.status,
      title:           inv.title           ?? "",
      issue_date:      inv.issue_date      ?? "",
      due_date:        inv.due_date        ?? "",
      discount_amount: inv.discount_amount,
      tax_rate:        inv.tax_rate,
      paid_amount:     inv.paid_amount,
      notes:           inv.notes           ?? "",
      internal_memo:   inv.internal_memo   ?? "",
    },
    items: (inv.invoice_items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        category:      item.category,
        item_name:     item.item_name,
        description:   item.description ?? "",
        quantity:      item.quantity,
        unit_price:    item.unit_price,
        discount_rate: item.discount_rate,
        sort_order:    item.sort_order,
      })),
  };
}

const EMPTY_FORM: FormFields = {
  invoice_number:  "",
  status:          "draft",
  title:           "請求書",
  issue_date:      new Date().toISOString().slice(0, 10),
  due_date:        "",
  discount_amount: 0,
  tax_rate:        10,
  paid_amount:     0,
  notes:           "",
  internal_memo:   "",
};

interface InvoiceFormProps {
  invoice?:     InvoiceDB;
  workOrderId?: string;
  onCancel?:   () => void;
  onSuccess?:  (id: string) => void;
}

export default function InvoiceForm({ invoice, workOrderId, onCancel, onSuccess }: InvoiceFormProps) {
  const isEdit = !!invoice;
  const init = invoice ? fromDB(invoice) : { form: EMPTY_FORM, items: [{ ...EMPTY_ITEM }] };

  const [form, setForm]   = useState<FormFields>(init.form);
  const [items, setItems] = useState<InvoiceItemInput[]>(init.items);
  const [error,     setError]   = useState<string | null>(null);
  const [pending,   startTransition] = useTransition();
  const [previewNo, setPreviewNo] = useState<string>("");

  useEffect(() => {
    if (!invoice) {
      previewDocumentNumber("invoice").then((p) => setPreviewNo(p ?? ""));
    }
  }, [invoice]);

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(index: number, key: keyof InvoiceItemInput, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM, sort_order: prev.length }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, sort_order: i })));
  }

  const totals = calculateInvoiceTotals(items, form.discount_amount, form.tax_rate, form.paid_amount);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (workOrderId) fd.set("work_order_id", workOrderId);
    fd.set("invoice_number",  form.invoice_number);
    fd.set("status",          form.status);
    fd.set("title",           form.title);
    fd.set("issue_date",      form.issue_date);
    fd.set("due_date",        form.due_date);
    fd.set("discount_amount", String(form.discount_amount));
    fd.set("tax_rate",        String(form.tax_rate));
    fd.set("paid_amount",     String(form.paid_amount));
    fd.set("notes",           form.notes);
    fd.set("internal_memo",   form.internal_memo);
    fd.set("items_json",      JSON.stringify(items.map((it, i) => ({ ...it, sort_order: i }))));

    startTransition(async () => {
      const result = isEdit && invoice
        ? await updateInvoice(invoice.id, fd)
        : await createInvoice(fd);

      if ("error" in result) {
        setError(result.error);
      } else {
        const id = isEdit ? invoice!.id : (result as { success: true; id: string }).id;
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
          <p className="text-[10px] text-slate-500">請求書番号: {invoiceDisplayNo(invoice!)}</p>
        </div>
      )}

      {/* Basic fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>タイトル</label>
          <input type="text" value={form.title} onChange={(e) => setField("title", e.target.value)}
            placeholder="請求書" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>請求書番号</label>
          <input type="text" value={form.invoice_number} onChange={(e) => setField("invoice_number", e.target.value)}
            placeholder={previewNo ? `自動採番: ${previewNo}` : "INV-0000-00001"} className={inputClass} />
          {!form.invoice_number && previewNo && (
            <p className="text-xs text-slate-500">空欄の場合、保存時に自動採番されます（次: {previewNo}）</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          <select value={form.status} onChange={(e) => setField("status", e.target.value as InvoiceStatus)}
            className={inputClass}>
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>発行日</label>
          <input type="date" value={form.issue_date} onChange={(e) => setField("issue_date", e.target.value)}
            className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>支払期限</label>
          <input type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)}
            className={inputClass} />
        </div>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className={labelClass}>明細</p>
          <button type="button" onClick={addItem}
            className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors">
            + 行を追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="text-left pb-2 pr-2 w-28">カテゴリ</th>
                <th className="text-left pb-2 pr-2">品目</th>
                <th className="text-right pb-2 pr-2 w-20">単価</th>
                <th className="text-right pb-2 pr-2 w-14">数量</th>
                <th className="text-right pb-2 pr-2 w-16">割引%</th>
                <th className="text-right pb-2 w-24">小計</th>
                <th className="pb-2 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-700/40 last:border-b-0">
                  <td className="py-1.5 pr-2">
                    <select value={item.category}
                      onChange={(e) => setItem(i, "category", e.target.value as InvoiceCategory)}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 w-full focus:outline-none focus:border-[#1d4ed8]">
                      {INVOICE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="text" value={item.item_name}
                      onChange={(e) => setItem(i, "item_name", e.target.value)}
                      placeholder="品目名"
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 w-full focus:outline-none focus:border-[#1d4ed8] placeholder-slate-600" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" value={item.unit_price} min={0}
                      onChange={(e) => setItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 w-full text-right focus:outline-none focus:border-[#1d4ed8]" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" value={item.quantity} min={1} step={0.1}
                      onChange={(e) => setItem(i, "quantity", parseFloat(e.target.value) || 1)}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 w-full text-right focus:outline-none focus:border-[#1d4ed8]" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" value={item.discount_rate} min={0} max={100} step={0.1}
                      onChange={(e) => setItem(i, "discount_rate", parseFloat(e.target.value) || 0)}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 w-full text-right focus:outline-none focus:border-[#1d4ed8]" />
                  </td>
                  <td className="py-1.5 text-right text-slate-200 font-medium whitespace-nowrap pr-2">
                    {formatYen(lineTotal(item.quantity, item.unit_price, item.discount_rate))}
                  </td>
                  <td className="py-1.5">
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>値引き額 (¥)</label>
            <input type="number" value={form.discount_amount} min={0}
              onChange={(e) => setField("discount_amount", parseFloat(e.target.value) || 0)}
              className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>消費税率 (%)</label>
            <input type="number" value={form.tax_rate} min={0} max={100} step={0.1}
              onChange={(e) => setField("tax_rate", parseFloat(e.target.value) || 0)}
              className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>入金済み額 (¥)</label>
            <input type="number" value={form.paid_amount} min={0}
              onChange={(e) => setField("paid_amount", parseFloat(e.target.value) || 0)}
              className={inputClass} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <div className="flex justify-between w-48">
            <span className="text-slate-500">小計</span>
            <span className="text-slate-300">{formatYen(totals.subtotal)}</span>
          </div>
          {form.discount_amount > 0 && (
            <div className="flex justify-between w-48">
              <span className="text-slate-500">値引き</span>
              <span className="text-red-400">－{formatYen(form.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between w-48">
            <span className="text-slate-500">消費税 ({form.tax_rate}%)</span>
            <span className="text-slate-300">{formatYen(totals.tax_amount)}</span>
          </div>
          <div className="flex justify-between w-48 border-t border-slate-700 pt-1 mt-1">
            <span className="text-slate-300 font-semibold">合計</span>
            <span className="text-slate-100 font-bold">{formatYen(totals.total)}</span>
          </div>
          {form.paid_amount > 0 && (
            <div className="flex justify-between w-48">
              <span className="text-slate-500">入金済み</span>
              <span className="text-green-400">－{formatYen(form.paid_amount)}</span>
            </div>
          )}
          <div className="flex justify-between w-48 border-t border-slate-700 pt-1 mt-1">
            <span className="text-blue-400 font-semibold">残高</span>
            <span className="text-blue-300 font-bold">{formatYen(totals.balance_due)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>備考</label>
        <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)}
          rows={3} placeholder="お客様へのメモ..."
          className={`${inputClass} resize-none`} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>内部メモ（PDFには出力されません）</label>
        <textarea value={form.internal_memo} onChange={(e) => setField("internal_memo", e.target.value)}
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
          {pending ? "保存中..." : isEdit ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
