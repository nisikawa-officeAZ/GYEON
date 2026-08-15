"use client";

// Estimate Wizard Ver2.2 — responsive shell (presentation-only).
//
// ONE responsive component system for Desktop / Tablet / Smartphone — layout differs by
// CSS breakpoint only; there are NO separate PC/tablet/mobile implementations. Navigation
// is VISIBLE Back / Next buttons + a jumpable stepper (buttons, never anchors → the
// unsaved-changes guard is not triggered). Swipe is prohibited. Contains NO business
// logic; totals and step state are supplied by the owner via props.
//
//   Desktop (lg+): 2 columns — left = active step content, right = sticky total + Back/Next
//   Tablet/Mobile (<lg): single column + fixed bottom bar (total + Back/Next)

import type { ReactNode } from "react";
import type { WizardStepId } from "./tokens";
import { StepHeader } from "./StepHeader";
import { ProgressBar } from "./ProgressBar";
import { StepperFull, StepperCompact, BackNextButtons } from "./StepNavigation";
import { MiniTotalPanel, MiniTotalBar, type WizardTotalsView } from "./MiniTotalBar";

export interface WizardShellProps {
  title: string;
  estimateNo?: string | null;
  step: WizardStepId;
  jumpTo: (id: WizardStepId) => void;
  onBack: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  completed?: ReadonlySet<WizardStepId>;
  totals: WizardTotalsView;
  children: ReactNode; // active step content (owner-rendered)
}

export function WizardShell({
  title,
  estimateNo,
  step,
  jumpTo,
  onBack,
  onNext,
  isFirst,
  isLast,
  completed,
  totals,
  children,
}: WizardShellProps) {
  return (
    <div className="flex flex-col gap-4 pb-36 lg:pb-4">
      <StepHeader title={title} estimateNo={estimateNo} />

      {/* Stepper (top navigation) + progress */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 lg:p-4 flex flex-col gap-3">
        <StepperFull step={step} jumpTo={jumpTo} completed={completed} />
        <StepperCompact step={step} jumpTo={jumpTo} completed={completed} />
        <ProgressBar step={step} completed={completed} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active step content */}
        <div className="lg:col-span-2 flex flex-col gap-4">{children}</div>

        {/* Desktop: sticky total + Back/Next */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 lg:sticky lg:top-[calc(var(--app-header-h,56px)+2.5rem)]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">合計</h3>
            <MiniTotalPanel totals={totals} />
            <div className="mt-4 pt-3 border-t border-slate-700/60">
              <BackNextButtons onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={isLast} />
            </div>
          </div>
        </div>
      </div>

      {/* Tablet / Mobile: fixed bottom bar (total + Back/Next) — no swipe */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800">
        <MiniTotalBar totals={totals} className="mb-2" />
        <BackNextButtons onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={isLast} />
      </div>
    </div>
  );
}
