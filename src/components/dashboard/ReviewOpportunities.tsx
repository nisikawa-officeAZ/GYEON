"use client";

// Dealer Owner Dashboard — Review Opportunities card (Sprint 12A)
// Placeholder — review metrics (reviews.review_conversion_rate,
//   reviews.review_requests_sent) not yet connected to live data.
// Safe for all roles. No revenue data.

import Link from "next/link";

export default function ReviewOpportunities() {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className="text-base">⭐</span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">レビュー機会</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-600 uppercase tracking-wide">
          Sprint 12+
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Placeholder stats — not yet connected */}
        <div className="flex items-center justify-between py-2 border-b border-slate-800/30">
          <span className="text-xs text-slate-600">Googleレビュー獲得数</span>
          <span className="text-xs text-slate-700">—</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-slate-800/30">
          <span className="text-xs text-slate-600">レビュー依頼送付数</span>
          <span className="text-xs text-slate-700">—</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-slate-800/30">
          <span className="text-xs text-slate-600">平均評価</span>
          <span className="text-xs text-slate-700">—</span>
        </div>

        {/* Call to action hint */}
        <div
          className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-center"
        >
          <p className="text-[10px] text-slate-600">
            メンテナンス完了後の自動レビュー依頼は
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Sprint 12以降で有効化されます
          </p>
          <Link
            href="/maintenance"
            className="inline-block mt-2 text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
          >
            メンテナンス管理 →
          </Link>
        </div>
      </div>
    </div>
  );
}
