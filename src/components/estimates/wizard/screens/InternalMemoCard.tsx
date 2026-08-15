"use client";

// Estimate Wizard Ver2.2 — Internal staff memo card (Phase 6, presentation-only).
//
// PROTECTED internal data. This content must NEVER appear on any customer-facing output (PDF /
// invoice / delivery note / completion report / summary invoice / LINE / email / preview /
// portal / API). It is a SEPARATE explicit field (`internalMemo`) — never merged with
// customerNotes. Visually distinct: muted/neutral internal-use surface + soft amber accent +
// lock icon, with helper text stating it is never shown to the customer (icon is not the only
// signal). Non-alarming (no aggressive red). Multiline, optional, preserves line breaks, live
// character count, max length enforced. No persistence / API / DB.

const CARD = "bg-[#0f172a] border border-amber-500/25 rounded-xl shadow-lg p-5";

export function InternalMemoCard({
  value,
  maxLength,
  onChange,
}: {
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  const helperId = "internal-memo-helper";
  const countId = "internal-memo-count";

  return (
    <section className={CARD} aria-labelledby="internal-memo-title">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">🔒</span>
        <h3 id="internal-memo-title" className="text-sm font-semibold text-amber-200/90">社内メモ（スタッフ専用）</h3>
        <span className="text-[10px] text-amber-300/90 border border-amber-500/40 rounded px-1.5 py-0.5">お客様には表示されません</span>
      </div>
      <p id={helperId} className="text-[11px] text-amber-200/70 mt-1">
        この内容は社内スタッフ専用です。見積書・請求書・納品書・完了報告・LINE・メール・お客様向けプレビューには一切表示されません。
      </p>

      <label htmlFor="internalMemo" className="sr-only">社内メモ（スタッフ専用）</label>
      <textarea
        id="internalMemo"
        name="internalMemo"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${helperId} ${countId}`}
        placeholder="例）既存の車両ダメージ、社内承認メモ、特別対応の指示、フォローアップの備忘、スタッフ専用の運用メモ など"
        className="mt-3 w-full min-h-[140px] sm:min-h-[180px] resize-y bg-[#0b1220] border border-amber-500/20 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/60 transition-colors"
      />
      <div className="mt-1 flex justify-end">
        <span id={countId} aria-live="polite" className="text-[10px] text-amber-200/60 tabular-nums">
          {value.length} / {maxLength} 文字
        </span>
      </div>
    </section>
  );
}
