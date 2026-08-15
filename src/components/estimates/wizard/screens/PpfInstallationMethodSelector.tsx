"use client";

// Estimate Wizard Ver2.2 — PPF installation-method selector (Phase 4B, presentation-only).
//
// Exactly five methods (フル / 部分 / フロントガラス / サンルーフ / 室内PPF). Panoramic roof
// is intentionally absent. Single active method; visual buttons only (no pull-down);
// disabled methods (owner-supplied) are greyed out and non-interactive. No pricing.

import { SelectButton } from "../foundation/SelectButton";
import type { InstallationMethodOption, PpfInstallationMethodId } from "./step-types";

export function PpfInstallationMethodSelector({
  methods,
  selected,
  onChange,
}: {
  methods: InstallationMethodOption[];
  selected: PpfInstallationMethodId | null;
  onChange: (id: PpfInstallationMethodId) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-300">施工方法を選択</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
        {methods.map((m) => (
          <SelectButton
            key={m.id}
            selected={selected === m.id}
            disabled={m.disabled}
            subLabel={m.disabled ? m.disabledReason : m.subLabel}
            onSelect={() => onChange(m.id)}
            density="touch"
          >
            {m.label}
          </SelectButton>
        ))}
      </div>
    </div>
  );
}
