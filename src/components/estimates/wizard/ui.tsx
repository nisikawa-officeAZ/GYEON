"use client";

// Unified Estimate Wizard — shared component library (Phase 0).
//
// ONE set of primitives used by all breakpoints. Responsive sizing is a `density`
// prop (touch = larger tap targets), NOT a per-breakpoint fork. All selections are
// push-BUTTONS (no native <select>) per canonical spec §4. Dark-mode only; colors
// match the approved tokens (#0f172a / #1e293b / #1d4ed8; amber #fbbf24 = required).

import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatYen(n: number): string {
  return "¥" + (n ?? 0).toLocaleString("ja-JP");
}

/** Single source of truth for the required-empty check (fixes the 0-value bug). */
export function isRequiredEmpty(required: boolean | undefined, value: unknown): boolean {
  return !!required && (value === "" || value === null || value === undefined);
}

export type Density = "compact" | "touch";

// ── Card / titles ────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-[#1e293b] rounded-xl shadow-lg p-5", className)}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{children}</h3>;
}

// ── Buttons ──────────────────────────────────────────────────────────────────
interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}

export function PrimaryButton({ children, onClick, disabled, type = "button", className, title }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={cn("text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-colors", className)}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, type = "button", className, title }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={cn("text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-2.5 rounded-lg transition-colors", className)}>
      {children}
    </button>
  );
}

// ── SelectButton (pulldown replacement) ────────────────────────────────────────
const SELECT_SIZE: Record<Density, string> = {
  // touch adds ~+8px tap area vs compact (finger-only operation).
  compact: "min-h-[48px] px-4 py-3 text-sm",
  touch:   "min-h-[56px] px-4 py-3.5 text-[15px]",
};

export function SelectButton({
  children, selected, onClick, disabled, density = "compact", className,
}: {
  children: ReactNode;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
  density?: Density;
  className?: string;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} disabled={disabled}
      className={cn(
        "rounded-lg border text-left transition-colors w-full flex items-center justify-between gap-2 disabled:opacity-40",
        SELECT_SIZE[density],
        selected
          ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100"
          : "bg-[#0f172a] border-slate-700 text-slate-300 hover:border-slate-500",
        className,
      )}>
      <span className="min-w-0">{children}</span>
      {selected && <span className="text-blue-300 text-xs shrink-0">✓</span>}
    </button>
  );
}

/** Independent on/off toggle (e.g. 業者 / 掛売り). */
export function ToggleButton({
  children, active, onClick, density = "compact",
}: {
  children: ReactNode;
  active: boolean;
  onClick?: () => void;
  density?: Density;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn(
        "rounded-lg border transition-colors",
        SELECT_SIZE[density],
        active ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500",
      )}>
      {children}
    </button>
  );
}

// ── Amber required badge ───────────────────────────────────────────────────────
export function AmberBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}

// ── Field wrapper (label + amber-until-filled highlight) ───────────────────────
export function Field({
  label, required, value, children, hint,
}: {
  label: string;
  required?: boolean;
  value?: unknown;
  children: ReactNode;
  hint?: string;
}) {
  const empty = isRequiredEmpty(required, value);
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
        <span>{label}</span>
        {required && (empty ? <AmberBadge>必須</AmberBadge> : <span className="text-slate-600">*</span>)}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

// ── Inputs ─────────────────────────────────────────────────────────────────────
interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}

export function TextInput({ value, onChange, placeholder, required, type = "text", inputMode }: InputProps) {
  const empty = isRequiredEmpty(required, value);
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "bg-[#0f172a] border rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors w-full",
        empty ? "border-amber-500/50 focus:border-amber-400" : "border-slate-700 focus:border-[#1d4ed8]",
      )}
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full resize-y"
    />
  );
}

// ── Responsive grid for choice buttons ─────────────────────────────────────────
export function ChoiceGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const map: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };
  return <div className={cn("grid gap-2", map[cols])}>{children}</div>;
}

// ── Phase-2 placeholder marker (used by not-yet-wired steps) ───────────────────
export function PhaseTwoNotice({ screen }: { screen: string }) {
  return (
    <Card>
      <SectionTitle>{screen}</SectionTitle>
      <p className="text-xs text-slate-400 leading-relaxed">
        この画面は Phase 2 で既存ロジック（価格エンジン / OCR / 保存）に接続します。
        本 Phase 0/1 ではウィザードの骨格・state・ナビゲーションの検証が対象です。
      </p>
    </Card>
  );
}
