"use client";

// DealerOS — AI Settings: AI Health Section (Sprint 11U)
//
// Displays provider health status, latency, and last-checked timestamp.
// All values are null/"not_checked" until real health checks are implemented
// (requires gateway adapters in a future sprint).

import type { AIHealthCard } from "@/lib/ai-settings/settings-view-models";

const HEALTH_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  healthy:      { dot: "bg-emerald-400", label: "正常",   bg: "border-emerald-800/20" },
  degraded:     { dot: "bg-amber-400",   label: "低下",   bg: "border-amber-800/20" },
  unreachable:  { dot: "bg-red-500",     label: "接続不可", bg: "border-red-800/20" },
  not_checked:  { dot: "bg-slate-600",   label: "未確認",  bg: "border-slate-800" },
  key_invalid:  { dot: "bg-red-500",     label: "キー無効", bg: "border-red-800/20" },
  rate_limited: { dot: "bg-amber-400",   label: "レート制限", bg: "border-amber-800/20" },
};

const PROVIDER_LABELS: Record<string, string> = {
  openai:       "OpenAI",
  anthropic:    "Anthropic Claude",
  gemini:       "Google Gemini",
  azure_openai: "Azure OpenAI",
  openrouter:   "OpenRouter",
};

interface AIHealthSectionProps {
  healthCards: AIHealthCard[];
}

export default function AIHealthSection({ healthCards }: AIHealthSectionProps) {
  const anyChecked = healthCards.some((c) => c.health_status !== "not_checked");

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">AIヘルス状態</h2>
        {!anyChecked && (
          <span className="text-[10px] text-slate-600">
            ヘルスチェックはゲートウェイアダプター実装後に有効になります
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {healthCards.map((card) => {
          const cfg = HEALTH_CONFIG[card.health_status] ?? HEALTH_CONFIG.not_checked;

          return (
            <div
              key={card.provider_id}
              className={`px-4 py-3 bg-slate-900/50 border rounded-xl ${cfg.bg}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">
                  {PROVIDER_LABELS[card.provider_id] ?? card.provider_id}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] text-slate-500">{cfg.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-slate-600">レイテンシ</p>
                  <p className="text-xs text-slate-400">
                    {card.latency_ms !== null ? `${card.latency_ms} ms` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600">最終確認</p>
                  <p className="text-xs text-slate-400">
                    {card.last_checked
                      ? new Date(card.last_checked).toLocaleString("ja-JP", {
                          month: "2-digit",
                          day:   "2-digit",
                          hour:  "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              {card.error_message && (
                <p className="mt-2 text-[10px] text-red-400 truncate">{card.error_message}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
