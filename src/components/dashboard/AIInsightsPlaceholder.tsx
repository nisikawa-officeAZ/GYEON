"use client";

// Dealer Owner Dashboard — AI Insights placeholder (Sprint 12A)
// References insight types from Analytics & Reporting Center:
//   - ai_summary (30+ data points required)
//   - next_action_suggestion (7+ data points required)
//   - anomaly_detection, risk_warning, growth_opportunity
//
// AI execution requires AI Gateway (src/lib/ai/) — planned Sprint 12B.
// No fake metrics. No AI execution.

export default function AIInsightsPlaceholder() {
  const insights = [
    { label: "AIサマリー",     id: "ai_summary",              note: "30日分のデータが必要" },
    { label: "次のアクション", id: "next_action_suggestion",  note: "7日分のデータが必要"  },
    { label: "異常検知",       id: "anomaly_detection",        note: "30日分のデータが必要" },
    { label: "成長機会",       id: "growth_opportunity",       note: "60日分のデータが必要" },
    { label: "リスク警告",     id: "risk_warning",             note: "7日分のデータが必要"  },
  ];

  return (
    <div className="rounded-xl border border-slate-800/60 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0d1220]">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">AIインサイト</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-900/50 text-blue-600 uppercase tracking-wide">
          Sprint 12B
        </span>
      </div>

      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] text-slate-600 mb-3">
          AIインサイトはデータ蓄積後に有効化されます。
        </p>

        <div className="flex flex-col gap-1">
          {insights.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b border-slate-800/30 last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-800 flex-shrink-0" />
                <span className="text-[11px] text-slate-600">{item.label}</span>
              </div>
              <span className="text-[9px] text-slate-700">{item.note}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg bg-blue-950/10 border border-blue-900/20 px-3 py-2.5">
          <p className="text-[9px] text-blue-700 leading-relaxed">
            AIインサイトはAIゲートウェイ (Sprint 12B) の有効化後、
            十分なデータが蓄積された時点で順次表示されます。
          </p>
        </div>
      </div>
    </div>
  );
}
