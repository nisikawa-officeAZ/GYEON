"use client";

// Estimate Wizard Ver2.2 — Screen6 (Notes and Guidance) container (Phase 6, presentation-only).
//
// Composes two STRICTLY SEPARATED note fields: customer-facing notes (bright card, may appear on
// customer output later) and internal staff memo (muted internal-use card, never customer-facing).
// The two explicit fields are never merged. Template inserts append to customerNotes only, via a
// pure helper that preserves existing content / line breaks and avoids duplicate separators. No
// persistence, no API/DB, no EstimateEditor mutation. Navigation uses buttons (no unsaved guard).

import { CustomerNotesCard } from "./CustomerNotesCard";
import { InternalMemoCard } from "./InternalMemoCard";
import { CUSTOMER_NOTE_TEMPLATES, appendCustomerNote } from "./note-templates-config";
import type { Step6NotesProps } from "./step-types";

export function Step6Notes(props: Step6NotesProps) {
  const {
    customerNotes, internalMemo,
    onCustomerNotesChange, onInternalMemoChange,
    customerNotesMaxLength = 1000,
    internalMemoMaxLength = 2000,
    templates = CUSTOMER_NOTE_TEMPLATES,
    onBack, onContinue,
  } = props;

  // Append a template to the customer-facing field only — never touch internalMemo.
  const handleInsertTemplate = (text: string) =>
    onCustomerNotesChange(appendCustomerNote(customerNotes, text, customerNotesMaxLength));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">備考・ご案内</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">お客様向けのご案内と社内スタッフ用メモを分けて入力します。</p>
      </div>

      <CustomerNotesCard
        value={customerNotes}
        maxLength={customerNotesMaxLength}
        templates={templates}
        onChange={onCustomerNotesChange}
        onInsertTemplate={handleInsertTemplate}
      />

      <InternalMemoCard
        value={internalMemo}
        maxLength={internalMemoMaxLength}
        onChange={onInternalMemoChange}
      />

      {(onBack || onContinue) && (
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-slate-300 border border-slate-700 hover:border-slate-500 px-4 min-h-[44px] rounded-lg transition-colors"
            >
              戻る
            </button>
          )}
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="text-sm font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-4 min-h-[44px] rounded-lg transition-colors"
            >
              次へ進む
            </button>
          )}
        </div>
      )}
    </div>
  );
}
