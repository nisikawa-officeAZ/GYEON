"use client";

// Estimate Wizard Ver2.2 — visual selection push-button (pulldown replacement).
//
// Presentation-only. Screen3+ selections MUST use this (never a native <select>).
// Selected state is always visible (fill + border + check). `density="touch"` enlarges
// the tap target for finger use. No business logic.

import type { ReactNode } from "react";
import { cn } from "./tokens";

export type Density = "compact" | "touch";

const SIZE: Record<Density, string> = {
  compact: "min-h-[48px] px-4 py-3 text-sm",
  touch:   "min-h-[56px] px-4 py-3.5 text-[15px]",
};

export function SelectButton({
  children,
  subLabel,
  selected,
  onSelect,
  disabled = false,
  density = "compact",
  className,
}: {
  children: ReactNode;
  subLabel?: ReactNode;
  selected: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  density?: Density;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={cn(
        "w-full rounded-lg border text-left transition-colors flex items-center justify-between gap-2",
        SIZE[density],
        disabled
          ? "bg-[#0f172a] border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
          : selected
            ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100"
            : "bg-[#0f172a] border-slate-700 text-slate-300 hover:border-slate-500",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block font-medium truncate">{children}</span>
        {subLabel && <span className="block text-[11px] text-slate-500 truncate">{subLabel}</span>}
      </span>
      {selected && !disabled && <span aria-hidden className="text-blue-300 text-xs shrink-0">✓</span>}
    </button>
  );
}

/** Independent on/off toggle (e.g. 業者 / 掛売り). Presentation-only. */
export function ToggleButton({
  children,
  active,
  onToggle,
  density = "compact",
  className,
}: {
  children: ReactNode;
  active: boolean;
  onToggle?: () => void;
  density?: Density;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "rounded-lg border transition-colors",
        SIZE[density],
        active ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500",
        className,
      )}
    >
      {children}
    </button>
  );
}
