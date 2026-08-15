"use client";

// Estimate Wizard Ver2.2 — Customer-facing notes card (Phase 6, presentation-only).
//
// Standard bright card. This content MAY later appear on customer-facing documents (PDF /
// invoice / LINE / email / preview), so the helper text says so plainly. Multiline textarea,
// optional, preserves line breaks, live character count (announced to assistive tech), max
// length enforced. Quick templates append to this field only. No persistence / API / DB.

import { QuickNoteTemplates } from "./QuickNoteTemplates";
import type { QuickNoteTemplate } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";

export function CustomerNotesCard({
  value,
  maxLength,
  templates,
  onChange,
  onInsertTemplate,
}: {
  value: string;
  maxLength: number;
  templates: QuickNoteTemplate[];
  onChange: (v: string) => void;
  onInsertTemplate: (text: string) => void;
}) {
  const helperId = "customer-notes-helper";
  const countId = "customer-notes-count";

  return (
    <section className={CARD} aria-labelledby="customer-notes-title">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">💬</span>
        <h3 id="customer-notes-title" className="text-sm font-semibold text-slate-100">お客様向けメモ・ご案内</h3>
        <span className="text-[10px] text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.5">お客様に表示される場合あり</span>
      </div>
      <p id={helperId} className="text-[11px] text-slate-400 mt-1">
        この内容は見積書・請求関連書類・LINE・メール・お客様向けプレビューに表示される場合があります。
      </p>

      <label htmlFor="customerNotes" className="sr-only">お客様向けメモ</label>
      <textarea
        id="customerNotes"
        name="customerNotes"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${helperId} ${countId}`}
        placeholder="例）作業時間の目安、施工後の注意、代車のご案内、ご予約・お支払い・保証や証明書のご案内 など"
        className="mt-3 w-full min-h-[160px] sm:min-h-[200px] resize-y bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:border-[#1d4ed8] transition-colors"
      />
      <div className="mt-1 flex justify-end">
        <span id={countId} aria-live="polite" className="text-[10px] text-slate-500 tabular-nums">
          {value.length} / {maxLength} 文字
        </span>
      </div>

      <QuickNoteTemplates templates={templates} onInsert={onInsertTemplate} />
    </section>
  );
}
