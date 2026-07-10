"use client";

// Estimate Wizard Ver2.2 — 7-step progress indicator (display-only).
//
// Shows current / completed / pending state. It does NOT gate navigation (jumping is
// handled by StepNavigation). Presentation-only.

import { cn, WIZARD_STEPS, type WizardStepId } from "./tokens";

export function ProgressBar({
  step,
  completed,
}: {
  step: WizardStepId;
  completed?: ReadonlySet<WizardStepId>;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`ステップ ${step} / ${WIZARD_STEPS.length}`}>
      {WIZARD_STEPS.map((s) => {
        const isCurrent = s.id === step;
        const isDone = completed?.has(s.id) ?? false;
        return (
          <div
            key={s.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              isCurrent ? "bg-[#1d4ed8]" : isDone ? "bg-emerald-600/70" : "bg-slate-700",
            )}
          />
        );
      })}
    </div>
  );
}
