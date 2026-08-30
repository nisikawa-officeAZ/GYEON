"use client";

// Step 3 — 作業内容選択. Exactly 7 categories, multi-select push-buttons (no pulldown).
// Only selected categories flow to Step 4. PPF部分施工 is NOT a category here — it
// branches inside Step 4. Breakpoint-agnostic (identical across PC/Tablet/Mobile).

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Card, SectionTitle, SelectButton } from "../ui";
import {
  serviceFamilyForCategory,
  type ServiceCategoryId,
  type ServiceOfferings,
} from "@/lib/estimates/service-categories";

const CATEGORIES: Array<{ id: ServiceCategoryId; label: string; icon: string }> = [
  { id: "coating",     label: "コーティング",         icon: "✨" },
  { id: "ppf",         label: "PPF",                 icon: "🛡" },
  { id: "window",      label: "ウィンドウフィルム",   icon: "🪟" },
  { id: "maintenance", label: "ボディ定期メンテナンス", icon: "🔧" },
  { id: "carwash",     label: "洗車",                 icon: "🚿" },
  { id: "roomclean",   label: "ルームクリーニング",   icon: "🧹" },
  { id: "other",       label: "その他の作業",         icon: "📋" },
];

/** Exact operator-facing reason shown when the dealer's store setting disables PPF. */
export const PPF_NOT_OFFERED_REASON = "店舗設定でPPFが「提供しない」に設定されています。";

export function serviceNotOfferedReason(label: string): string {
  return label === "PPF"
    ? PPF_NOT_OFFERED_REASON
    : `店舗設定で${label}が「提供しない」に設定されています。`;
}

export function Step3Category({
  api,
  serviceOfferings,
}: {
  api: EstimateWizardApi;
  serviceOfferings: ServiceOfferings;
}) {
  const selected = api.store.categories;
  const isOffered = (id: ServiceCategoryId) => {
    const family = serviceFamilyForCategory(id);
    return family === null || serviceOfferings[family];
  };
  // Presentation follows the CURRENT offering authority. Keep stale canonical input untouched for
  // server enforcement, but never render or count an unavailable service selection as active.
  const effectiveSelected = selected.filter((id) => isOffered(id as ServiceCategoryId));
  const unavailableCategories = CATEGORIES.filter((cat) => !isOffered(cat.id));
  const toggle = (id: string) =>
    api.updateStore({
      categories: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    });

  return (
    <Card>
      <SectionTitle>作業内容選択（複数選択可）</SectionTitle>
      <p className="text-[11px] text-slate-500 mb-3">選択したカテゴリのみが次の「見積」ステップに表示されます。PPFの部分施工は見積ステップ内で分岐します。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {CATEGORIES.map((cat) => {
          const disabled = !isOffered(cat.id);
          return (
            <SelectButton
              key={cat.id}
              selected={disabled ? false : selected.includes(cat.id)}
              onClick={disabled ? undefined : () => toggle(cat.id)}
              disabled={disabled}
              density="touch"
              className="h-[72px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="shrink-0">{cat.icon}</span>
                <span className="font-medium leading-tight">{cat.label}</span>
              </span>
            </SelectButton>
          );
        })}
      </div>
      {unavailableCategories.map((cat) => (
        <p key={cat.id} className="text-[11px] text-amber-400 mt-2">
          {serviceNotOfferedReason(cat.label)}
        </p>
      ))}
      {effectiveSelected.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3">選択中: {effectiveSelected.length} カテゴリ</p>
      )}
    </Card>
  );
}
