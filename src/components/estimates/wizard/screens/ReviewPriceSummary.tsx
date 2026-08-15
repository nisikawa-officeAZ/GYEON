"use client";

// Estimate Wizard Ver2.2 — Review price summary (Phase 7, presentation-only).
//
// PRESENTATION-ONLY. This component NEVER calculates prices/tax/totals, never imports
// src/lib/pricing, and never approximates values. It only displays values that already exist in
// the preview implementation, and those are clearly marked as preview/mock. Unavailable rows are
// shown as 未計算（プレビュー）rather than fabricated.

import type { ReviewPriceSummary as ReviewPriceSummaryData } from "./step-types";

export function ReviewPriceSummary({ data }: { data: ReviewPriceSummaryData }) {
  const rows = data.mockRows ?? [];
  return (
    <section className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-lg p-5" aria-label="金額サマリー">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-100">金額サマリー</h3>
        <span className="text-[10px] text-amber-300/80 border border-amber-500/30 rounded px-1.5 py-0.5">プレビュー値（モック）</span>
      </div>

      {rows.length > 0 ? (
        <dl className="flex flex-col">
          {rows.map((r, i) => (
            <div key={`${r.label}-${i}`} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-b-0">
              <dt className="text-xs text-slate-400">{r.label}</dt>
              <dd className="text-sm text-slate-200 tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-slate-500">未計算（プレビュー）</p>
      )}

      <p className="text-[10px] text-slate-600 mt-3">{data.note}</p>
    </section>
  );
}
