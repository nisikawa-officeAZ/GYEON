"use client";

// DealerOS — AI Settings: Provider Status Section (Sprint 11U)
//
// Shows gateway provider tiles (5) and extension provider previews (6).
// Data is pre-loaded server-side. No data fetching here.

import type { AIProviderStatusCard } from "@/lib/ai-settings/settings-view-models";
import type { AIProviderProfile }    from "@/lib/ai-marketplace";

const HEALTH_LABEL: Record<string, string> = {
  healthy:      "正常",
  degraded:     "低下",
  unreachable:  "接続不可",
  not_checked:  "未確認",
  key_invalid:  "APIキー無効",
  rate_limited: "レート制限",
};

const HEALTH_DOT: Record<string, string> = {
  healthy:      "bg-emerald-400",
  degraded:     "bg-amber-400",
  unreachable:  "bg-red-500",
  not_checked:  "bg-slate-600",
  key_invalid:  "bg-red-500",
  rate_limited: "bg-amber-400",
};

const COST_LABEL: Record<string, string> = {
  budget:   "低コスト",
  standard: "標準",
  premium:  "プレミアム",
};

const QUALITY_LABEL: Record<string, string> = {
  good:   "Good",
  better: "Better",
  best:   "Best",
};

interface ProviderStatusSectionProps {
  providerCards:         AIProviderStatusCard[];
  extensionProviders:    AIProviderProfile[];
  aiGatewayModuleActive: boolean;
}

export default function ProviderStatusSection({
  providerCards,
  extensionProviders,
  aiGatewayModuleActive,
}: ProviderStatusSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">AIプロバイダー</h2>
        <a
          href="/settings"
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          APIキー設定 →
        </a>
      </div>

      {/* Gateway providers */}
      <div className="mb-4">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">
          ゲートウェイプロバイダー（5）
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {providerCards.map((card) => (
            <div
              key={card.provider_id}
              className={`px-4 py-3 border rounded-xl transition-colors ${
                card.is_primary
                  ? "border-blue-600/60 bg-blue-950/20"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {card.display_name}
                  </p>
                  {card.is_primary && (
                    <span className="text-[9px] text-blue-400 font-medium">PRIMARY</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[card.health_status] ?? "bg-slate-600"}`} />
                  <span className="text-[10px] text-slate-500">
                    {HEALTH_LABEL[card.health_status] ?? card.health_status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {/* Key status */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  card.has_key_stored
                    ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                    : "bg-slate-800/60 text-slate-500 border border-slate-700/40"
                }`}>
                  {card.has_key_stored ? "キー登録済" : "キー未設定"}
                </span>

                {/* Quality */}
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/40">
                  {QUALITY_LABEL[card.quality_tier] ?? card.quality_tier}
                </span>

                {/* Cost */}
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/40">
                  {COST_LABEL[card.cost_tier] ?? card.cost_tier}
                </span>
              </div>

              {!aiGatewayModuleActive && (
                <p className="text-[10px] text-slate-600 mt-2">アダプター実装予定</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Extension providers */}
      <div>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">
          マーケットプレイス拡張プロバイダー（{extensionProviders.length}）
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {extensionProviders.map((p) => (
            <div
              key={p.provider_id}
              className="px-3 py-2.5 border border-slate-800/60 bg-slate-900/30 rounded-xl"
            >
              <p className="text-[11px] font-medium text-slate-400 leading-tight">{p.display_name}</p>
              <p className="text-[10px] text-slate-600 mt-1">{p.vendor}</p>
              <span className="mt-1.5 inline-block text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/40">
                {p.adapter_sprint ?? "予定"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
