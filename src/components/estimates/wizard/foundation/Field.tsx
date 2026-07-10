"use client";

// Estimate Wizard Ver2.2 — required-field Amber state.
//
// A required field is highlighted Amber (#fbbf24) while empty and returns to the normal
// look once filled. Presentation-only; validation of the value is the owner's concern.

import type { ReactNode } from "react";
import { cn, isRequiredEmpty } from "./tokens";

/** Small "必須" pill shown while a required field is empty. */
export function RequiredBadge() {
  return (
    <span className="inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded px-1.5 py-0.5">
      必須
    </span>
  );
}

/** Label + required Amber affordance wrapper. `value` decides the empty highlight. */
export function Field({
  label,
  required,
  value,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  value?: unknown;
  hint?: string;
  children: ReactNode;
}) {
  const empty = isRequiredEmpty(required, value);
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
        <span className={cn(empty && "text-amber-400")}>{label}</span>
        {required && (empty ? <RequiredBadge /> : <span className="text-slate-600">*</span>)}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Presentational text input carrying the required-Amber border. Emits raw string via
 * `onChange`; no formatting/validation/business logic.
 */
export function TextInput({
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  const empty = isRequiredEmpty(required, value);
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        // text-base on mobile prevents iOS zoom; sm:text-sm on desktop
        "w-full bg-[#0f172a] rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 border transition-colors focus:outline-none",
        empty ? "border-amber-500/50 focus:border-amber-400" : "border-slate-700 focus:border-[#1d4ed8]",
      )}
    />
  );
}
