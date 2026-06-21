"use client";

import { useState, useTransition } from "react";
import {
  CompletionReportDB,
  CompletionReportStatus,
  completionReportStatusLabel,
  completionReportDisplayNo,
} from "@/lib/completion-reports/completion-report-types";
import { createCompletionReport } from "@/lib/completion-reports/create-completion-report";
import { updateCompletionReport } from "@/lib/completion-reports/update-completion-report";

const STATUSES: CompletionReportStatus[] = ["draft", "generated", "shared", "archived"];

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
const labelClass = "text-xs font-medium text-slate-400";

interface FormFields {
  report_number:    string;
  title:            string;
  status:           CompletionReportStatus;
  report_date:      string;
  customer_message: string;
  internal_memo:    string;
}

function fromDB(r: CompletionReportDB): FormFields {
  return {
    report_number:    r.report_number    ?? "",
    title:            r.title            ?? "施工完了報告書",
    status:           r.status,
    report_date:      r.report_date      ?? "",
    customer_message: r.customer_message ?? "",
    internal_memo:    r.internal_memo    ?? "",
  };
}

const EMPTY_FORM: FormFields = {
  report_number:    "",
  title:            "施工完了報告書",
  status:           "draft",
  report_date:      new Date().toISOString().slice(0, 10),
  customer_message: "",
  internal_memo:    "",
};

const DEFAULT_MESSAGE = `この度は施工をご依頼いただきありがとうございました。
施工が完了しましたので、ご報告申し上げます。
ご不明な点やご要望がございましたら、お気軽にお問い合わせください。`;

interface CompletionReportFormProps {
  workOrderId:  string;
  report?:      CompletionReportDB;   // present in edit mode
  onCancel?:    () => void;
  onSuccess?:   (reportId: string) => void;
}

export default function CompletionReportForm({
  workOrderId,
  report,
  onCancel,
  onSuccess,
}: CompletionReportFormProps) {
  const isEdit = !!report;

  const [form, setForm] = useState<FormFields>(
    report ? fromDB(report) : { ...EMPTY_FORM, customer_message: DEFAULT_MESSAGE }
  );
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("work_order_id",   workOrderId);
    fd.set("report_number",   form.report_number);
    fd.set("title",           form.title);
    fd.set("status",          form.status);
    fd.set("report_date",     form.report_date);
    fd.set("customer_message", form.customer_message);
    fd.set("internal_memo",   form.internal_memo);

    startTransition(async () => {
      const result = isEdit && report
        ? await updateCompletionReport(report.id, fd)
        : await createCompletionReport(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        const id = (result as { success: true; id?: string }).id ?? report?.id ?? "";
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
          <p className="text-[10px] text-slate-500">
            報告書番号: {completionReportDisplayNo(report)}
          </p>
        </div>
      )}

      {/* Title & Report Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>タイトル</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="施工完了報告書"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>報告書番号</label>
          <input
            type="text"
            value={form.report_number}
            onChange={(e) => set("report_number", e.target.value)}
            placeholder="RPT-2024-001"
            className={inputClass}
          />
        </div>
      </div>

      {/* Status & Report Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as CompletionReportStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{completionReportStatusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>報告日</label>
          <input
            type="date"
            value={form.report_date}
            onChange={(e) => set("report_date", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Customer Message */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>顧客向けメッセージ</label>
        <textarea
          value={form.customer_message}
          onChange={(e) => set("customer_message", e.target.value)}
          rows={5}
          placeholder="お客様へのメッセージを入力..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Internal Memo */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>内部メモ（PDFには出力されません）</label>
        <textarea
          value={form.internal_memo}
          onChange={(e) => set("internal_memo", e.target.value)}
          rows={3}
          placeholder="社内向けメモ..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Saving..." : isEdit ? "Update" : "作成"}
        </button>
      </div>
    </form>
  );
}
