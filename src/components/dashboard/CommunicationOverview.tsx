"use client";

// Dealer Owner Dashboard — Communication Overview card (Sprint 12A)
// Shows LINE stats and message activity — safe for all roles (no revenue data).
// Metrics referenced: communication.messages_sent, communication.channel_distribution
//   reviews.review_requests_sent (placeholder — not yet connected)

import Link from "next/link";
import type {
  LineStats,
  LineMessageStats,
} from "@/lib/dashboard/get-dashboard-summary";

interface Props {
  lineStats:        LineStats;
  lineMessageStats: LineMessageStats;
  lineQueueStats:   { scheduled: number; failed: number };
}

export default function CommunicationOverview({
  lineStats,
  lineMessageStats,
  lineQueueStats,
}: Props) {
  const hasFailures = lineMessageStats.this_month_failed > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">コミュニケーション</span>
        </div>
        <Link href="/line" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          LINE管理 →
        </Link>
      </div>

      <div className="px-4 py-1">
        {/* LINE connection stats */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
          <span className="text-xs text-slate-400">LINE 連携顧客</span>
          <span className="text-sm font-semibold text-green-400">{lineStats.linked_count.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
          <span className="text-xs text-slate-400">LINE 友達数</span>
          <span className="text-sm font-semibold text-slate-300">{lineStats.friends_count.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
          <span className="text-xs text-slate-400">今月の新規友達</span>
          <span className="text-sm font-semibold text-blue-400">{lineStats.this_month_new.toLocaleString()}</span>
        </div>

        {/* Message stats */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
          <span className="text-xs text-slate-400">今月の送信メッセージ</span>
          <span className="text-sm font-semibold text-slate-300">{lineMessageStats.this_month_sent.toLocaleString()}</span>
        </div>
        {hasFailures && (
          <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
            <span className="text-xs text-red-400">送信エラー</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-red-400">{lineMessageStats.this_month_failed}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/50 text-red-400 bg-red-950/30">要確認</span>
            </div>
          </div>
        )}

        {/* Queue stats */}
        {lineQueueStats.scheduled > 0 && (
          <div className="flex items-center justify-between py-2.5 border-b border-slate-800/50">
            <span className="text-xs text-slate-400">送信待ちキュー</span>
            <span className="text-sm font-semibold text-amber-400">{lineQueueStats.scheduled}</span>
          </div>
        )}

        {/* Placeholder — other channels not yet connected */}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-slate-600">WhatsApp / Email / SMS</span>
          <span className="text-[10px] text-slate-700 italic">Sprint 12+</span>
        </div>
      </div>
    </div>
  );
}
