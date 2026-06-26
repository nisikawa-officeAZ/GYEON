"use client";

// DealerOS — AI Settings: Budget Section (Sprint 11U Phase E)
//
// Displays monthly AI spend, limit, warning threshold, and budget strategy.
// current_month_usd = 0 until migration 073 (dealer_ai_usage_log) is applied.
// Limit editing is display-only until migration 072 is applied.

import { useState } from "react";
import type { AIBudgetCard } from "@/lib/ai-settings/settings-view-models";

const STRATEGY_LABELS: Record<string, { label: string; desc: string }> = {
  preferred_cost: { label: "コスト優先",   desc: "予算超過時にコストを下げたモデルへ自動切替" },
  quality:        { label: "品質優先",     desc: "品質を維持しつつ予算超過時に警告のみ" },
  balanced:       { label: "バランス",     desc: "コストと品質のバランスを保って自動調整" },
};

interface BudgetSectionProps {
  budgetCard:        AIBudgetCard;
  hasAnyKey:         boolean;
  migrationRequired: boolean;
}

export default function BudgetSection({
  budgetCard,
  hasAnyKey,
  migrationRequired,
}: BudgetSectionProps) {
  const { monthly_limit_usd, current_month_usd, remaining_usd, strategy, is_over_warning, is_over_limit } = budgetCard;
  const hasLimit      = monthly_limit_usd > 0;
  const usagePercent  = hasLimit ? Math.min(100, (current_month_usd / monthly_limit_usd) * 100) : 0;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">予算管理</h2>

      {/* Migration hint for usage tracking */}
      <div className="mb-4 px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">今月の使用量</p>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold tabular-nums ${
                is_over_limit ? "text-red-400" : is_over_warning ? "text-amber-400" : "text-slate-200"
              }`}>
                ${current_month_usd.toFixed(2)}
              </span>
              {hasLimit && (
                <span className="text-xs text-slate-500 mb-0.5">/ ${monthly_limit_usd.toFixed(2)}</span>
              )}
            </div>

            {/* Progress bar */}
            {hasLimit && (
              <div className="mt-3">
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      is_over_limit ? "bg-red-500" : is_over_warning ? "bg-amber-400" : "bg-blue-500"
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-600">0</span>
                  <span className="text-[10px] text-slate-600">${monthly_limit_usd}</span>
                </div>
              </div>
            )}

            {remaining_usd !== null && (
              <p className="text-[11px] text-slate-500 mt-2">
                残り予算: <span className="text-slate-300">${remaining_usd.toFixed(2)}</span>
              </p>
            )}

            {current_month_usd === 0 && (
              <p className="text-[10px] text-slate-600 mt-1">
                ※ 使用量追跡は Migration 073 (dealer_ai_usage_log) 適用後に有効になります
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Budget settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Monthly limit */}
        <div className="px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">月次上限</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">
              {hasLimit ? `$${monthly_limit_usd.toFixed(0)}` : "上限なし"}
            </span>
            {migrationRequired && (
              <span className="text-[9px] text-amber-500 px-1.5 py-0.5 bg-amber-950/30 border border-amber-700/30 rounded">
                移行後に設定可
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {hasLimit
              ? `警告閾値: ${(budgetCard.warning_threshold * 100).toFixed(0)}%`
              : "AIゲートウェイ設定で月次上限を設定できます"}
          </p>
        </div>

        {/* Budget strategy */}
        <div className="px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-1.5">予算戦略</p>
          <p className="text-sm font-semibold text-slate-200">
            {STRATEGY_LABELS[strategy]?.label ?? strategy}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            {STRATEGY_LABELS[strategy]?.desc ?? ""}
          </p>
        </div>
      </div>

      {/* API key status note */}
      {!hasAnyKey && (
        <div className="mt-3 px-4 py-3 border border-slate-700/50 bg-slate-900/30 rounded-xl">
          <p className="text-[11px] text-slate-500">
            AIプロバイダーのAPIキーが登録されていません。
            <a href="/settings" className="text-blue-400 hover:text-blue-300 ml-1">
              AIゲートウェイ設定でキーを追加してください →
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
