"use client";

// DealerOS — AI Settings: Overview Section (Sprint 11U)
//
// Displays AI configuration health, primary provider, and migration status.
// All data pre-loaded server-side; no data fetching here.

import type { AIProviderId } from "@/lib/ai/types";

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  openai:       "OpenAI",
  anthropic:    "Anthropic Claude",
  gemini:       "Google Gemini",
  azure_openai: "Azure OpenAI",
  openrouter:   "OpenRouter",
};

interface AIOverviewSectionProps {
  isFullyConfigured:    boolean;
  configurationIssues:  string[];
  primaryProvider:      AIProviderId | null;
  settingsAvailable:    boolean;
  migrationRequired:    boolean;
  profileVersion:       string;
  platformCoreVersion:  string;
  aiGatewayModuleActive: boolean;
  errorCode:            string | null;
}

export default function AIOverviewSection({
  isFullyConfigured,
  configurationIssues,
  primaryProvider,
  settingsAvailable,
  migrationRequired,
  profileVersion,
  platformCoreVersion,
  aiGatewayModuleActive,
  errorCode,
}: AIOverviewSectionProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">概要</h2>

      {/* Migration notice */}
      {migrationRequired && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-950/30 border border-amber-700/40 rounded-xl">
          <span className="text-amber-400 text-sm mt-0.5">⚠</span>
          <div>
            <p className="text-xs font-semibold text-amber-300">データベース移行が保留中</p>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              Migration 072 (dealer_ai_settings テーブル) が未適用のため、設定の保存が制限されています。
              CTOの承認後に移行が完了します。それまでは初期設定でご利用いただけます。
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Config status */}
        <div className="px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">設定状態</p>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isFullyConfigured ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className={`text-sm font-semibold ${
              isFullyConfigured ? "text-emerald-300" : "text-amber-300"
            }`}>
              {isFullyConfigured ? "設定完了" : "設定が必要"}
            </span>
          </div>
          {configurationIssues.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {configurationIssues.map((issue) => (
                <li key={issue} className="text-[11px] text-slate-500 leading-relaxed">
                  · {issue}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Primary provider */}
        <div className="px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">プライマリプロバイダー</p>
          {primaryProvider ? (
            <p className="text-sm font-semibold text-slate-200">
              {PROVIDER_LABELS[primaryProvider]}
            </p>
          ) : (
            <p className="text-sm text-slate-500">未設定</p>
          )}
          <p className="text-[10px] text-slate-600 mt-1.5">
            <a href="/settings" className="hover:text-slate-400 transition-colors">
              AIゲートウェイ設定 →
            </a>
          </p>
        </div>

        {/* Gateway module status */}
        <div className="px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">プラットフォーム</p>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                aiGatewayModuleActive ? "bg-emerald-400" : "bg-slate-600"
              }`}
            />
            <span className="text-xs text-slate-400">
              AI Gateway{" "}
              <span className={aiGatewayModuleActive ? "text-emerald-400" : "text-slate-500"}>
                {aiGatewayModuleActive ? "active" : "planned"}
              </span>
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">
            Platform Core v{platformCoreVersion}
          </p>
        </div>
      </div>
    </section>
  );
}
