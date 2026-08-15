"use client";

// Estimate Wizard Ver2.2 — Review section wrapper + field row (Phase 7, presentation-only).
//
// A simple read-only section shell: heading + optional edit button + children. Plus a FieldRow
// helper for label/value pairs. No calculation, no state. Values are display-ready strings the
// owner has resolved (empty values already shown as 未入力/未選択/なし).

import type { ReviewField } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";

export function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD} aria-label={title}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={editLabel ?? `${title}を編集`}
            className="text-[11px] text-blue-300 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] px-3 min-h-[36px] rounded-lg transition-colors shrink-0"
          >
            編集
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function FieldRow({ field }: { field: ReviewField }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-slate-800/60 last:border-b-0">
      <dt className="text-[11px] text-slate-500 sm:w-40 sm:shrink-0">{field.label}</dt>
      <dd className="text-sm text-slate-200 break-words min-w-0 whitespace-pre-wrap">{field.value}</dd>
    </div>
  );
}

export function FieldList({ fields }: { fields: ReviewField[] }) {
  if (fields.length === 0) return <p className="text-xs text-slate-500">未入力</p>;
  return (
    <dl className="flex flex-col">
      {fields.map((f, i) => (
        <FieldRow key={`${f.label}-${i}`} field={f} />
      ))}
    </dl>
  );
}
