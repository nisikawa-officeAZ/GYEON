"use client";

// Estimate Wizard Ver2.2 — persistent total display.
//
// DISPLAY ONLY. It receives already-computed amounts and renders them; it performs NO
// pricing calculation. Desktop shows an expanded breakdown; the compact variant (mobile
// bottom bar) shows the total only. No business logic.

import { cn, formatYen } from "./tokens";

export interface WizardTotalsView {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** false while the dealer catalog / pricing is not yet resolved (owner-provided). */
  ready?: boolean;
}

/** Expanded breakdown (desktop right column). */
export function MiniTotalPanel({ totals }: { totals: WizardTotalsView }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200 tabular-nums">{formatYen(totals.subtotal)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">値引き</span><span className="text-slate-200 tabular-nums">-{formatYen(totals.discount)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">消費税</span><span className="text-slate-200 tabular-nums">{formatYen(totals.tax)}</span></div>
      <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white tabular-nums">{formatYen(totals.total)}</span></div>
      {totals.ready === false && <p className="text-[10px] text-amber-400/80">価格は保存時にサーバーで確定します。</p>}
    </div>
  );
}

/** Compact total row (tablet/mobile bottom bar). */
export function MiniTotalBar({ totals, className }: { totals: WizardTotalsView; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-slate-400">合計</span>
      <span className="text-white font-semibold tabular-nums">{formatYen(totals.total)}</span>
    </div>
  );
}
