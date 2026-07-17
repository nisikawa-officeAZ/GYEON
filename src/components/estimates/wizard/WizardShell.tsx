"use client";

// Unified Estimate Wizard — responsive shell (Phase 1).
//
// ONE shell for PC / Tablet / Smartphone. Presentation differs by CSS breakpoint
// only. Navigation is VISIBLE Back / Next buttons on every breakpoint — NO swipe
// gestures (per Architect correction). Free-jump via the stepper (no gating).
//   Desktop (lg+): horizontal stepper + 2-col (content | sticky total & actions)
//   Tablet/Mobile (<lg): compact numbered stepper + fixed bottom bar (total + Back/Next)

import type { ReactNode } from "react";
import { WIZARD_STEPS, type StepId } from "./wizard-types";
import type { EstimateWizardApi } from "./useEstimateWizard";
import { cn, formatYen, PrimaryButton, SecondaryButton } from "./ui";

export interface WizardTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  ready: boolean; // false while the dealer catalog / pricing is still loading (Phase 2)
}

const EMPTY_TOTALS: WizardTotals = { subtotal: 0, discount: 0, tax: 0, total: 0, ready: false };

function FullStepper({ step, jumpTo, completed }: Pick<EstimateWizardApi, "step" | "jumpTo" | "completed">) {
  return (
    <div className="hidden lg:flex items-center gap-1">
      {WIZARD_STEPS.map((s, i) => {
        const active = s.id === step;
        const done = completed.has(s.id);
        return (
          <div key={s.id} className="flex items-center">
            <button type="button" onClick={() => jumpTo(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
                active ? "bg-blue-950/40 border border-[#1d4ed8] text-slate-100"
                       : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
              )}>
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0",
                active ? "bg-[#1d4ed8] text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300",
              )}>{done && !active ? "✓" : s.id}</span>
              <span className="font-medium">{s.label}</span>
            </button>
            {i < WIZARD_STEPS.length - 1 && <span className="text-slate-700 mx-0.5">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function CompactStepper({ step, jumpTo, completed }: Pick<EstimateWizardApi, "step" | "jumpTo" | "completed">) {
  const current = WIZARD_STEPS.find((s) => s.id === step);
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">{step} / {WIZARD_STEPS.length}　{current?.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((s) => {
          const active = s.id === step;
          const done = completed.has(s.id);
          return (
            <button key={s.id} type="button" onClick={() => jumpTo(s.id)} aria-label={s.label}
              className={cn(
                "flex-1 h-9 rounded-md text-[11px] font-medium transition-colors border",
                active ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                       : done ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-300"
                              : "bg-[#0f172a] border-slate-700 text-slate-400",
              )}>{s.short}</button>
          );
        })}
      </div>
    </div>
  );
}

function TotalRows({ totals }: { totals: WizardTotals }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200">{formatYen(totals.subtotal)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">値引き</span><span className="text-slate-200">-{formatYen(totals.discount)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">消費税</span><span className="text-slate-200">{formatYen(totals.tax)}</span></div>
      <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white">{formatYen(totals.total)}</span></div>
      {!totals.ready && <p className="text-[10px] text-amber-400/80">価格は Phase 2 で価格エンジンに接続され確定します。</p>}
    </div>
  );
}

function NavButtons({ api }: { api: EstimateWizardApi }) {
  return (
    <div className="flex items-center gap-2">
      <SecondaryButton onClick={api.back} disabled={api.isFirst} className="flex-1">戻る</SecondaryButton>
      <PrimaryButton onClick={api.next} disabled={api.isLast} className="flex-1">次へ</PrimaryButton>
    </div>
  );
}

export function WizardShell({
  api,
  totals = EMPTY_TOTALS,
  title,
  children,
}: {
  api: EstimateWizardApi;
  totals?: WizardTotals;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-36 lg:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
      </div>

      {/* Stepper (top nav) */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 lg:p-4">
        <FullStepper step={api.step} jumpTo={api.jumpTo} completed={api.completed} />
        <CompactStepper step={api.step} jumpTo={api.jumpTo} completed={api.completed} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active step content */}
        <div className="lg:col-span-2 flex flex-col gap-4">{children}</div>

        {/* Desktop: sticky total + Back/Next */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 lg:sticky lg:top-[calc(var(--app-header-h)+2.5rem)]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">合計</h3>
            <TotalRows totals={totals} />
            <div className="mt-4 pt-3 border-t border-slate-700/60">
              <NavButtons api={api} />
            </div>
          </div>
        </div>
      </div>

      {/* Tablet / Mobile: fixed bottom bar (total + Back/Next) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-slate-400">合計</span>
          <span className="text-white font-semibold">{formatYen(totals.total)}</span>
        </div>
        <NavButtons api={api} />
      </div>
    </div>
  );
}
