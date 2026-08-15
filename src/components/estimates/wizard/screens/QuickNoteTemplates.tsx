"use client";

// Estimate Wizard Ver2.2 — Quick note templates (Phase 6, presentation-only).
//
// Visual buttons that APPEND a predefined template to the customer-facing notes. Clicking a
// template calls onInsert(text); the container appends without overwriting existing content and
// never writes to internalMemo. No pull-down. No DB / API / template master. Multiple inserts
// are allowed. Buttons carry meaningful accessible labels.

import type { QuickNoteTemplate } from "./step-types";

export function QuickNoteTemplates({
  templates,
  onInsert,
}: {
  templates: QuickNoteTemplate[];
  onInsert: (text: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] text-slate-400 mb-2">定型文を挿入（お客様向けメモに追記されます）</p>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onInsert(t.text)}
            aria-label={`定型文を追記: ${t.label}`}
            title={t.text}
            className="text-[11px] text-blue-300 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] px-3 min-h-[36px] rounded-lg transition-colors"
          >
            <span className="text-slate-500 mr-1">＋</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
