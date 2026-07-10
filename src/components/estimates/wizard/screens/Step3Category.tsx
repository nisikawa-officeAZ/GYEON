"use client";

// Estimate Wizard Ver2.2 — Step 3 作業内容選択 (presentation-only).
//
// EXACTLY seven categories, multiple-selection, visual button/card selection (no
// pull-down). The category list is the existing canonical source
// (src/lib/estimates/service-categories.ts) — reused, not duplicated. PPF Partial
// Installation is intentionally NOT a category here; it branches inside Screen4 after
// PPF is selected. Controlled via props; the component holds no business state (the owner
// / EstimateEditor remains the single owner). No pricing / OCR / save logic.

import { SERVICE_CATEGORIES } from "@/lib/estimates/service-categories";
import { SelectButton } from "../foundation/SelectButton";
import type { Step3CategoryProps } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

export function Step3Category({ selected, onToggle }: Step3CategoryProps) {
  return (
    <div className={CARD}>
      <h3 className={SECHDR}>作業内容選択（複数選択可）</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">
        選択したカテゴリのみが次の「見積」ステップに表示されます。PPF の部分施工は見積ステップ内で分岐します。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {SERVICE_CATEGORIES.map((cat) => (
          <SelectButton
            key={cat.id}
            selected={selected.includes(cat.id)}
            onSelect={() => onToggle(cat.id)}
            density="touch"
          >
            {cat.label}
          </SelectButton>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3">選択中: {selected.length} カテゴリ</p>
      )}
    </div>
  );
}
