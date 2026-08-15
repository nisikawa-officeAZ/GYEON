"use client";

// Estimate Wizard Ver2.2 — Screen 4 shared container (Phase 4A, presentation-only).
//
// Displays ONLY the service categories selected on Screen3 as a section navigation, and
// renders the active section's content (passed as children — the owner decides what to
// render; in Phase 4A only Coating is implemented). Completed / disabled indicators are
// shown per section. No pull-down menus; sections are chosen with visual buttons. One
// responsive implementation (desktop = left vertical tabs, mobile = horizontal tab row).
// No swipe. No pricing / business logic — deselecting a category here does NOT delete any
// existing estimate items (that is owner/estimate-logic responsibility, unchanged).

import { serviceCategoryLabel, SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";
import { cn } from "../foundation/tokens";
import type { Step4EstimateProps } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";

function SectionTab({
  id,
  active,
  completed,
  disabled,
  onSelect,
}: {
  id: string;
  active: boolean;
  completed: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      className={cn(
        "text-left rounded-lg px-3 min-h-[44px] text-sm border transition-colors flex items-center justify-between gap-2 shrink-0",
        "lg:w-full",
        disabled
          ? "bg-[#0f172a] border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
          : active
            ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100"
            : "bg-[#0f172a] border-slate-700 text-slate-300 hover:border-slate-500",
      )}
    >
      <span className="truncate">{serviceCategoryLabel(id)}</span>
      {completed && !disabled && <span aria-hidden className="text-emerald-400 text-xs shrink-0">✓</span>}
    </button>
  );
}

export function Step4Estimate({
  selectedCategories,
  activeSection,
  onSelectSection,
  completed,
  disabledSections,
  children,
  globalOptionsSlot,
  adjustmentNotice,
}: Step4EstimateProps) {
  // Fixed logical section order (Phase 4I) — canonical order regardless of Screen3 toggle
  // sequence; any unknown id is kept at the end so nothing is silently dropped.
  const orderedCategories = [
    ...SERVICE_CATEGORY_IDS.filter((id) => selectedCategories.includes(id)),
    ...selectedCategories.filter((id) => !SERVICE_CATEGORY_IDS.includes(id as never)),
  ];

  if (selectedCategories.length === 0) {
    return (
      <div className={CARD}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">見積</h3>
        <p className="text-xs text-slate-500 mt-3">
          作業内容（Screen3）でカテゴリが未選択です。カテゴリを選択すると、その施工内容のみがここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Section navigation — only the selected categories, visual buttons (no pull-down). */}
      <nav
        aria-label="施工セクション"
        className="lg:w-48 lg:shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0"
      >
        {orderedCategories.map((id) => (
          <SectionTab
            key={id}
            id={id}
            active={activeSection === id}
            completed={completed?.has(id) ?? false}
            disabled={disabledSections?.has(id) ?? false}
            onSelect={() => onSelectSection(id)}
          />
        ))}
      </nav>

      {/* Active section content (owner-rendered) + PPF/Coating supplied-adjustment display
          (Phase 4I) + cross-category global options (Phase 4H). */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {children}
        {adjustmentNotice && (
          <div className="bg-[#0f172a] border border-amber-500/25 rounded-xl p-3">
            <p className="text-[10px] text-amber-300/80 uppercase tracking-wider mb-1">親から供給される表示データ（計算はここでは行いません）</p>
            <div className="text-xs text-slate-300">{adjustmentNotice}</div>
          </div>
        )}
        {globalOptionsSlot}
      </div>
    </div>
  );
}
