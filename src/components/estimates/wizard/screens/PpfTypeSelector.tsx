"use client";

// Estimate Wizard Ver2.2 — PPF type selector (Phase 4B, presentation-only).
//
// PPF products grouped (Gloss / Matte / Color / custom) as visual buttons (no pull-down).
// Single selection per PPF entry (unless the owner supplies another rule later). Groups,
// products, brands, display-only coefficients and disabled states arrive through PROPS —
// custom/non-GYEON products are supported by supplying them in the groups. NO price/coef
// calculation.

import { SelectButton } from "../foundation/SelectButton";
import type { PpfTypeGroup } from "./step-types";

export function PpfTypeSelector({
  groups,
  selectedId,
  onChange,
}: {
  groups: PpfTypeGroup[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-300">PPF 種類を選択</span>
      <div className="flex flex-col gap-3 mt-2">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="text-[11px] text-slate-500 mb-1.5">{g.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {g.products.map((p) => (
                <SelectButton
                  key={p.id}
                  selected={selectedId === p.id}
                  disabled={p.disabled}
                  subLabel={
                    p.disabled
                      ? p.disabledReason
                      : [p.brand && p.brand !== "GYEON" ? p.brand : null, p.coefficientDisplay].filter(Boolean).join(" · ") || undefined
                  }
                  onSelect={() => onChange(p.id)}
                >
                  {p.label}
                </SelectButton>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
