"use client";

// GDA-1W completion-report form (accepted contract §3.3, §5.7, §7.1).
//
// What this form can do now:
//   * EDIT MODE, draft + confirmed only: correct the title, customer message,
//     internal memo, and the monetary-free performed-work snapshot through the
//     versioned draft RPC adapter (`updateCompletionReportDraft`). The
//     expected version travels with every save; a losing concurrent edit gets
//     a STALE_VERSION message and must reload — nothing is overwritten.
//
// What it can no longer do (removed legacy raw-write paths):
//   * create a report — the canonical report is born ONLY from the atomic
//     「作業完了」 flow; create mode shows that guidance and offers to resolve
//     an already-existing canonical report;
//   * choose or edit the report number (database-allocated, immutable);
//   * choose or edit the report date (server-derived from the actual end);
//   * change status or sharing state (dedicated future operations);
//   * touch maintenance scheduling; and
//   * treat estimate data as performed-work authority — the items edited here
//     are the CONFIRMED snapshot rows, never estimate items.
//
// All failures render stable operator-facing messages; raw server text never
// reaches this component by construction of the adapters.

import { useState, useTransition } from "react";
import {
  CompletionReportDB,
  completionReportStatusLabel,
  completionReportDisplayNo,
  type PerformedWorkItemInput,
} from "@/lib/completion-reports/completion-report-types";
import { createCompletionReport } from "@/lib/completion-reports/create-completion-report";
import { updateCompletionReportDraft } from "@/lib/completion-reports/update-completion-report";

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
const labelClass = "text-xs font-medium text-slate-400";

const COMPLETION_FLOW_GUIDANCE =
  "完了報告書は「作業完了」操作で自動的に作成されます。作業指示の編集画面から、実際の終了日時と実施した作業を確認して完了してください。";

// Stable domain codes from the draft adapter, in operator language.
const DRAFT_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED:               "ログインが必要です。再度ログインしてください。",
  NOT_FOUND:                     "完了報告書が見つかりません。",
  PERMISSION_DENIED:             "編集権限がありません。",
  VALIDATION_ERROR:              "入力内容を確認してください（実施した作業 1〜100 件が必要です）。",
  INVALID_STATE:                 "下書きの報告書のみ修正できます。共有済み・アーカイブ済みは変更できません。",
  STALE_VERSION:                 "他の更新が先に行われました。画面を再読み込みして最新の内容を確認してください。",
  RECOVERY_REQUIRED:             "過去データの復旧確認が必要です。管理者に連絡してください。",
  COMPLETION_STATE_INCONSISTENT: "保存に失敗しました。再読み込みしてもう一度お試しください。",
};

interface ItemDraft {
  category:    string;
  itemName:    string;
  description: string;
}

const EMPTY_ITEM: ItemDraft = { category: "", itemName: "", description: "" };

interface CompletionReportFormProps {
  workOrderId:  string;
  report?:      CompletionReportDB;   // present in edit mode
  /**
   * The report's CONFIRMED snapshot rows (from completion_report_items),
   * supplied by the loading surface. Estimate items must never be passed
   * here — they are prefill for the completion flow, not for corrections.
   */
  initialItems?: readonly PerformedWorkItemInput[];
  onCancel?:    () => void;
  onSuccess?:   (reportId: string) => void;
}

export default function CompletionReportForm({
  workOrderId,
  report,
  initialItems,
  onCancel,
  onSuccess,
}: CompletionReportFormProps) {
  const isEdit = !!report;
  const isDraft = report?.status === "draft";
  const isConfirmed =
    typeof report?.performed_work_version === "number" && report.performed_work_version > 0;
  const canCorrect = isEdit && isDraft && isConfirmed;

  const [title,           setTitle]           = useState(report?.title ?? "");
  const [customerMessage, setCustomerMessage] = useState(report?.customer_message ?? "");
  const [internalMemo,    setInternalMemo]    = useState(report?.internal_memo ?? "");
  const [items, setItems] = useState<ItemDraft[]>(() =>
    initialItems && initialItems.length > 0
      ? initialItems.map((i) => ({
          category:    i.category,
          itemName:    i.itemName,
          description: i.description ?? "",
        }))
      : [{ ...EMPTY_ITEM }],
  );

  const [error,   setError]   = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => (prev.length >= 100 ? prev : [...prev, { ...EMPTY_ITEM }]));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // ── CREATE MODE: no creation form exists any more. Resolve-or-guide. ──
  function handleResolve() {
    setError(null);
    const fd = new FormData();
    fd.set("work_order_id", workOrderId);
    startTransition(async () => {
      const result = await createCompletionReport(fd);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      const id = (result as { success: true; id: string }).id;
      onSuccess?.(id);
    });
  }

  // ── EDIT MODE: the versioned, monetary-free draft correction. ──
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!report || !canCorrect || report.performed_work_version === null) return;

    const performedItems: PerformedWorkItemInput[] = items.map((it) => ({
      category:    it.category,
      itemName:    it.itemName,
      description: it.description.trim() === "" ? null : it.description,
    }));

    startTransition(async () => {
      const result = await updateCompletionReportDraft({
        completionReportId:           report.id,
        expectedPerformedWorkVersion: report.performed_work_version as number,
        title:                        title.trim() === "" ? null : title,
        customerMessage:              customerMessage.trim() === "" ? null : customerMessage,
        internalMemo:                 internalMemo.trim() === "" ? null : internalMemo,
        performedItems,
      });

      if (!result.ok) {
        setError(
          DRAFT_ERROR_MESSAGES[result.code] ?? DRAFT_ERROR_MESSAGES.COMPLETION_STATE_INCONSISTENT,
        );
        return;
      }

      setNotice(`保存しました（版数 ${result.result.performed_work_version}）`);
      onSuccess?.(report.id);
    });
  }

  // ─── CREATE MODE UI: completion-flow guidance ───────────────────────────────
  if (!isEdit) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-300">{COMPLETION_FLOW_GUIDANCE}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "確認中..." : "作成済みの報告書を開く"}
          </button>
        </div>
      </div>
    );
  }

  // ─── EDIT MODE UI ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg px-3 py-2">
          <p className="text-xs text-emerald-300">{notice}</p>
        </div>
      )}

      {/* Immutable header facts: number and date are database authority. */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-[10px] text-slate-500">
          報告書番号: <span className="text-slate-300">{completionReportDisplayNo(report!)}</span>
        </p>
        <p className="text-[10px] text-slate-500">
          報告日: <span className="text-slate-300">{report!.report_date ?? "—"}</span>
        </p>
        <p className="text-[10px] text-slate-500">
          ステータス: <span className="text-slate-300">{completionReportStatusLabel(report!.status)}</span>
        </p>
        {isConfirmed && (
          <p className="text-[10px] text-slate-500">
            版数: <span className="text-slate-300">{report!.performed_work_version}</span>
          </p>
        )}
      </div>

      {!isDraft && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-300">
            {DRAFT_ERROR_MESSAGES.INVALID_STATE}
          </p>
        </div>
      )}
      {isDraft && !isConfirmed && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-300">
            この報告書には確定済みの作業内容がありません。{COMPLETION_FLOW_GUIDANCE}
          </p>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>タイトル</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="施工完了報告書"
          disabled={!canCorrect || pending}
          className={inputClass}
        />
      </div>

      {/* Confirmed performed work (monetary-free snapshot) */}
      <div className="flex flex-col gap-2">
        <label className={labelClass}>実施した作業（確定内容の修正・1〜100件）</label>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_1.5fr_auto] gap-2">
            <input
              type="text"
              value={item.category}
              onChange={(e) => setItem(index, { category: e.target.value })}
              placeholder="カテゴリ"
              disabled={!canCorrect || pending}
              className={inputClass}
            />
            <input
              type="text"
              value={item.itemName}
              onChange={(e) => setItem(index, { itemName: e.target.value })}
              placeholder="作業名"
              disabled={!canCorrect || pending}
              className={inputClass}
            />
            <input
              type="text"
              value={item.description}
              onChange={(e) => setItem(index, { description: e.target.value })}
              placeholder="補足（任意）"
              disabled={!canCorrect || pending}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={!canCorrect || items.length <= 1 || pending}
              className="px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
              aria-label="この作業を削除"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          disabled={!canCorrect || items.length >= 100 || pending}
          className="self-start px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors disabled:opacity-40"
        >
          ＋ 作業を追加
        </button>
      </div>

      {/* Customer Message */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>顧客向けメッセージ</label>
        <textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          rows={5}
          placeholder="お客様へのメッセージを入力..."
          disabled={!canCorrect || pending}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Internal Memo */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>内部メモ（PDFには出力されません）</label>
        <textarea
          value={internalMemo}
          onChange={(e) => setInternalMemo(e.target.value)}
          rows={3}
          placeholder="社内向けメモ..."
          disabled={!canCorrect || pending}
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
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!canCorrect || pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "保存中..." : "修正を保存"}
        </button>
      </div>
    </form>
  );
}
