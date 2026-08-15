// Estimate Wizard Ver2.2 — shared presentation design tokens.
//
// Mirrors the approved GenSpark `colors_and_type.css` (--ds-* variables). These are
// PRESENTATION constants only. There is NO business / pricing / OCR / save / customer /
// vehicle / estimate logic in this module. Dark mode only.

export const WIZARD_TOKENS = {
  color: {
    bg:          "#080d1a", // page background
    bgElevated:  "#0f172a", // inputs / low surfaces
    bgCard:      "#1e293b", // cards / panels
    line:        "rgba(255,255,255,0.08)",
    lineStrong:  "rgba(255,255,255,0.15)",
    lineSlate:   "#334155",
    primary700:  "#1d4ed8", // standard primary (focus)
    primary800:  "#1e40af", // hover
    primary400:  "#4f8ef7",
    selOnBg:     "rgba(30,58,138,0.40)",  // selected button fill
    selOnBorder: "rgba(29,78,216,0.60)",  // selected button border
    textStrong:  "#ffffff", // total / strongest contrast
    textPrimary: "#f1f5f9",
    textBody:    "#e2e8f0",
    textMuted:   "#94a3b8", // labels
    textSubtle:  "#64748b",
    textFaint:   "#475569", // placeholder / weakest
    amber400:    "#fbbf24", // required-field highlight
    amberTint10: "rgba(245,158,11,0.10)",
    amberTint40: "rgba(245,158,11,0.40)",
    green500:    "#22c55e", // completed
    red400:      "#f87171",
  },
  radius: { sm: "8px", md: "10px", lg: "12px", xl: "16px" },
  /** Minimum tap target (px). */
  tapMin: 48,
  /** Breakpoints: Mobile <768 / Tablet 768–1023 / Desktop 1024+. */
  breakpoint: { tablet: 768, desktop: 1024 },
} as const;

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WizardStepMeta {
  id:    WizardStepId;
  key:   string;
  label: string; // full label (desktop)
  short: string; // compact label (tablet/mobile)
}

/** Fixed 7-step order (canonical Ver2.2). Never reorder. */
export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { id: 1, key: "customer", label: "顧客登録",        short: "顧客" },
  { id: 2, key: "vehicle",  label: "車両登録",        short: "車両" },
  { id: 3, key: "category", label: "作業内容選択",    short: "作業" },
  { id: 4, key: "estimate", label: "見積",            short: "見積" },
  { id: 5, key: "discount", label: "値引き / クーポン", short: "値引" },
  { id: 6, key: "notes",    label: "備考",            short: "備考" },
  { id: 7, key: "review",   label: "確認",            short: "確認" },
] as const;

/** Tailwind className joiner. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format a yen amount for display only (no calculation). */
export function formatYen(n: number): string {
  return "¥" + (n ?? 0).toLocaleString("ja-JP");
}

/**
 * Single source of truth for the required-empty check (fixes the `0`-value bug where
 * `!value` incorrectly flags 0). Presentation helper only.
 */
export function isRequiredEmpty(required: boolean | undefined, value: unknown): boolean {
  return !!required && (value === "" || value === null || value === undefined);
}
