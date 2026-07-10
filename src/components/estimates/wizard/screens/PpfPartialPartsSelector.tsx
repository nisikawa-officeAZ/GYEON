"use client";

// Estimate Wizard Ver2.2 — PPF partial-parts selector (Phase 4B, presentation-only).
//
// Multiple part selection via visual buttons (no pull-down). Re-clicking a selected part
// deselects it. Parts, quantity rules (quantityRequired/min/max) and disabled states all
// arrive through PROPS (store-configurable master + order). Quantity-required parts show a
// small stepper when selected. NO prices, NO calculation, NO estimate-item creation —
// selection/quantity are reported via callbacks. Deselecting here does NOT delete any
// existing estimate item (owner handles that).

import { SelectButton } from "../foundation/SelectButton";
import { cn } from "../foundation/tokens";
import type { PpfPartOption } from "./step-types";

function QtyStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max ? Math.min(max, value + 1) : value + 1);
  return (
    <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={dec} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">−</button>
      <span className="w-8 text-center text-sm text-slate-100 tabular-nums">{value}</span>
      <button type="button" onClick={inc} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">＋</button>
      <span className="text-[10px] text-slate-500 ml-1">数量{max ? `（最大${max}）` : ""}</span>
    </div>
  );
}

export function PpfPartialPartsSelector({
  parts,
  selectedIds,
  quantitiesByPart,
  onToggle,
  onQuantityChange,
}: {
  parts: PpfPartOption[];
  selectedIds: string[];
  quantitiesByPart: Record<string, number>;
  onToggle: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-300">部分施工の部位（複数選択可）</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
        {parts.map((p) => {
          const sel = selectedIds.includes(p.id);
          const qty = quantitiesByPart[p.id] ?? p.minQty ?? 1;
          return (
            <div key={p.id} className={cn(sel && p.quantityRequired && "sm:col-span-1")}>
              <SelectButton
                selected={sel}
                disabled={p.disabled}
                subLabel={p.disabled ? p.disabledReason : undefined}
                onSelect={() => onToggle(p.id)}
              >
                {p.label}
              </SelectButton>
              {sel && p.quantityRequired && !p.disabled && (
                <QtyStepper
                  value={qty}
                  min={p.minQty ?? 1}
                  max={p.maxQty}
                  onChange={(n) => onQuantityChange(p.id, n)}
                />
              )}
            </div>
          );
        })}
      </div>
      {selectedIds.length > 0 && <p className="text-[11px] text-slate-400 mt-2">選択中: {selectedIds.length} 部位</p>}
    </div>
  );
}
