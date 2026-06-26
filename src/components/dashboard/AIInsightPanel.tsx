// Dealer Owner Dashboard — AI Insight Panel (Sprint 12B)
//
// SERVER COMPONENT — no "use client" directive.
//
// Renders role-filtered AIInsight objects produced by buildDeterministicInsights().
// Revenue-tagged insights are excluded before this component receives them.
// This component trusts that the passed insights have already been role-filtered
// server-side by the dashboard page (AIP-002, AIP-005).
//
// Insight cards are color-coded by severity:
//   critical    → red border
//   warning     → amber border
//   info        → slate border
//   opportunity → green border
//
// Data status badges:
//   connected       → no badge (real data, already shown in summary)
//   not_connected   → "未接続" grey badge
//   ai_required     → "AI必要" blue badge
//   insufficient    → "データ不足" amber badge

import Link from "next/link";
import type { AIInsight, AIInsightDataStatus, AIInsightSeverity } from "@/lib/ai-insights/ai-insight-types";
import type { DealerStaffRole } from "@/lib/staff/staff-types";

interface Props {
  insights:       AIInsight[];
  role:           DealerStaffRole;
  gateway_status: "not_configured" | "configured" | "unknown";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function severityBorder(severity: AIInsightSeverity): string {
  switch (severity) {
    case "critical":    return "border-l-red-600";
    case "warning":     return "border-l-amber-500";
    case "opportunity": return "border-l-green-600";
    case "info":
    default:            return "border-l-slate-700";
  }
}

function severityDot(severity: AIInsightSeverity): string {
  switch (severity) {
    case "critical":    return "bg-red-500";
    case "warning":     return "bg-amber-400";
    case "opportunity": return "bg-green-400";
    case "info":
    default:            return "bg-slate-600";
  }
}

function DataStatusBadge({ status }: { status: AIInsightDataStatus }) {
  if (status === "connected") return null;

  const styles: Record<Exclude<AIInsightDataStatus, "connected">, string> = {
    not_connected: "border-slate-700 text-slate-600",
    ai_required:   "border-blue-900/60 text-blue-700",
    insufficient:  "border-amber-900/60 text-amber-700",
  };
  const labels: Record<Exclude<AIInsightDataStatus, "connected">, string> = {
    not_connected: "未接続",
    ai_required:   "AI必要",
    insufficient:  "データ不足",
  };

  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const border = severityBorder(insight.severity);
  const dot    = severityDot(insight.severity);
  const isActionable = insight.data_status === "connected" && insight.actions.length > 0;
  const primaryAction = insight.actions.find(a => a.style === "primary");
  const secondaryAction = insight.actions.find(a => a.style === "secondary");

  return (
    <div className={`rounded-xl border border-slate-800 border-l-2 ${border} bg-[#0a0f1a] p-3.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0 mt-1.5`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-300">{insight.title}</span>
              <DataStatusBadge status={insight.data_status} />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{insight.summary}</p>
            {insight.detail && insight.data_status === "connected" && (
              <p className="text-[10px] text-slate-700 mt-1 leading-snug">{insight.detail}</p>
            )}
          </div>
        </div>
        {isActionable && primaryAction && (
          <Link
            href={primaryAction.href}
            className="flex-shrink-0 text-[10px] font-semibold text-blue-400 border border-blue-900/50 rounded-lg px-2.5 py-1.5 hover:bg-blue-950/30 transition-colors whitespace-nowrap"
          >
            {primaryAction.label}
          </Link>
        )}
        {!isActionable && secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="flex-shrink-0 text-[10px] text-slate-600 hover:text-slate-400 transition-colors whitespace-nowrap"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>

      {/* Recommendation row — only for connected, high-priority insights */}
      {insight.recommendation && insight.data_status === "connected" && insight.recommendation.priority === 1 && (
        <div className="mt-2.5 ml-3.5 pl-3 border-l border-slate-800 rounded">
          <p className="text-[10px] text-slate-600 leading-snug">
            推奨: {insight.recommendation.action_label}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function AIInsightPanel({ insights, role, gateway_status }: Props) {
  const connectedInsights      = insights.filter(i => i.data_status === "connected");
  const criticalCount          = connectedInsights.filter(i => i.severity === "critical").length;
  const warningCount           = connectedInsights.filter(i => i.severity === "warning").length;
  const actionableCount        = criticalCount + warningCount;
  const gatewayReady           = gateway_status === "configured";
  const canSeePremiumUpgrade   = role === "owner" || role === "manager";

  return (
    <div className="rounded-xl border border-slate-800/60 bg-[#0a0f1a] overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0d1220]">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            AIインサイト
          </span>
          {actionableCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 border border-amber-800/50">
              {actionableCount}件 要対応
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!gatewayReady && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-700">
              AI未設定
            </span>
          )}
          <Link
            href="/settings/ai"
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            設定 →
          </Link>
        </div>
      </div>

      {/* Insight cards */}
      <div className="p-3 flex flex-col gap-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {/* Gateway notice */}
      {!gatewayReady && (
        <div className="mx-3 mb-3 rounded-lg bg-blue-950/10 border border-blue-900/20 px-3 py-2.5">
          <p className="text-[9px] text-blue-800 leading-relaxed">
            AIゲートウェイを設定すると、より深いインサイト
            （AIサマリー・異常検知・成長機会）が有効化されます。
          </p>
        </div>
      )}

      {/* Premium upgrade notice — owner/manager only, advisory per AIP-006 */}
      {canSeePremiumUpgrade && !gatewayReady && (
        <div className="mx-3 mb-3 rounded-lg bg-purple-950/10 border border-purple-900/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-purple-800">
              Business AI以上でAI推奨・成長機会分析が利用可能
            </p>
            <Link
              href="/settings"
              className="text-[9px] text-purple-700 hover:text-purple-500 ml-2 flex-shrink-0"
            >
              プラン確認 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
