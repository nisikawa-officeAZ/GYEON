"use client";

// Estimate Wizard Ver2.2 — step navigation.
//
// BINDING: swipe navigation is prohibited. Navigation uses VISIBLE Back / Next buttons
// on every breakpoint. The stepper nodes are <button>s (never <a> anchors) so the app's
// unsaved-changes guard (which intercepts anchor clicks / route changes) is NOT triggered
// by internal step jumps. Presentation-only — all transitions are callbacks supplied by
// the owner. All 7 nodes are freely jumpable (未到達もロックしない).

import { cn, WIZARD_STEPS, type WizardStepId } from "./tokens";

export interface StepNavHandlers {
  step:    WizardStepId;
  jumpTo:  (id: WizardStepId) => void;
  onBack:  () => void;
  onNext:  () => void;
  isFirst: boolean;
  isLast:  boolean;
  completed?: ReadonlySet<WizardStepId>;
}

/** Full horizontal stepper (desktop / tablet). Buttons only — no anchors, no swipe. */
export function StepperFull({ step, jumpTo, completed }: Pick<StepNavHandlers, "step" | "jumpTo" | "completed">) {
  return (
    <div className="hidden md:flex items-center gap-1">
      {WIZARD_STEPS.map((s, i) => {
        const active = s.id === step;
        const done = completed?.has(s.id) ?? false;
        return (
          <div key={s.id} className="flex items-center">
            <button
              type="button"
              onClick={() => jumpTo(s.id)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors min-h-[44px]",
                active ? "bg-blue-950/40 border border-[#1d4ed8] text-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0",
                  active ? "bg-[#1d4ed8] text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300",
                )}
              >
                {done && !active ? "✓" : s.id}
              </span>
              <span className="font-medium">{s.label}</span>
            </button>
            {i < WIZARD_STEPS.length - 1 && <span aria-hidden className="text-slate-700 mx-0.5">›</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Compact stepper (smartphone). Row of numbered <button>s for direct jump. */
export function StepperCompact({ step, jumpTo, completed }: Pick<StepNavHandlers, "step" | "jumpTo" | "completed">) {
  const current = WIZARD_STEPS.find((s) => s.id === step);
  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          {step} / {WIZARD_STEPS.length}　{current?.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((s) => {
          const active = s.id === step;
          const done = completed?.has(s.id) ?? false;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              aria-label={s.label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex-1 min-h-[44px] rounded-md text-[11px] font-medium transition-colors border",
                active ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : done ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-300" : "bg-[#0f172a] border-slate-700 text-slate-400",
              )}
            >
              {s.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Visible Back / Next buttons (no swipe). Buttons only. */
export function BackNextButtons({ onBack, onNext, isFirst, isLast }: Pick<StepNavHandlers, "onBack" | "onNext" | "isFirst" | "isLast">) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={isFirst}
        className="flex-1 min-h-[48px] text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-2.5 rounded-lg transition-colors"
      >
        戻る
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="flex-1 min-h-[48px] text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        次へ
      </button>
    </div>
  );
}
