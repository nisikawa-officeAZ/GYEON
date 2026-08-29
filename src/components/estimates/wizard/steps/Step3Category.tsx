"use client";

// Step 3 — 作業内容選択. Exactly 7 categories, multi-select push-buttons (no pulldown).
// Only selected categories flow to Step 4. PPF部分施工 is NOT a category here — it
// branches inside Step 4. Breakpoint-agnostic (identical across PC/Tablet/Mobile).

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Card, SectionTitle, SelectButton } from "../ui";

const CATEGORIES: Array<{ id: string; label: string; icon: string }> = [
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

export function Step3Category({ api, ppfOffered }: { api: EstimateWizardApi; ppfOffered: boolean }) {
  const selected = api.store.categories;
  // Presentation follows the CURRENT offering authority. Keep stale canonical input untouched for
  // the later server-enforcement phase, but never count an unavailable PPF selection as active.
  const effectiveSelected = ppfOffered ? selected : selected.filter((id) => id !== "ppf");
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
          // B2/GDA-ESTIMATE-PPF-OFFERING-R1-A — PPF alone is authority-gated by the dealer's own
          // service-offering switch. A stale selected id must never render as active while the
          // authoritative offering is off, so `selected` and `onClick` are both suppressed here
          // rather than only visually dimmed.
          const ppfDisabled = cat.id === "ppf" && !ppfOffered;
          return (
            <SelectButton
              key={cat.id}
              selected={ppfDisabled ? false : selected.includes(cat.id)}
              onClick={ppfDisabled ? undefined : () => toggle(cat.id)}
              disabled={ppfDisabled}
              density="touch"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{cat.icon}</span>
                <span className="font-medium">{cat.label}</span>
              </span>
            </SelectButton>
          );
        })}
      </div>
      {!ppfOffered && (
        <p className="text-[11px] text-amber-400 mt-2">{PPF_NOT_OFFERED_REASON}</p>
      )}
      {effectiveSelected.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3">選択中: {effectiveSelected.length} カテゴリ</p>
      )}
    </Card>
  );
}
