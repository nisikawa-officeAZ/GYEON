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

/** Fail-closed display state (mirrors WizardPricingResult.completeness). */
export type WizardPricingDisplayState = "complete" | "partial" | "unavailable" | "error";

export interface WizardTotals {
  subtotal: number | null;
  discount: number | null;
  tax:      number | null;
  total:    number | null;
  state:    WizardPricingDisplayState;
}

// Fail-closed default: no pricing yet → null amounts (rendered as —), NEVER a manufactured ¥0.
const EMPTY_TOTALS: WizardTotals = { subtotal: null, discount: null, tax: null, total: null, state: "unavailable" };

/** null → "—" (never a manufactured ¥0); a genuine numeric zero → "¥0". Presentation only. */
function yen(v: number | null): string {
  return v === null ? "—" : formatYen(v);
}
/** Discount line: null → "—" (never "-—"); a number → "-¥N". */
function discountYen(v: number | null): string {
  return v === null ? "—" : `-${formatYen(v)}`;
}
/** Operator-safe notice for every non-complete state (null when complete). */
function stateNotice(state: WizardPricingDisplayState): string | null {
  switch (state) {
    case "partial":     return "一部の金額が未確定です。表示金額は確定前です。";
    case "unavailable": return "サービスと必要情報を選択すると金額が表示されます。";
    case "error":       return "金額を計算できません。入力内容を確認してください。";
    default:            return null;
  }
}
function noticeColor(state: WizardPricingDisplayState): string {
  return state === "error" ? "text-red-400/90" : state === "partial" ? "text-amber-400/90" : "text-slate-400";
}

function FullStepper({ step, jumpTo, completed, maxEnterableStep }: Pick<EstimateWizardApi, "step" | "jumpTo" | "completed" | "maxEnterableStep">) {
  return (
    <div className="hidden lg:flex items-center gap-1">
      {WIZARD_STEPS.map((s, i) => {
        const active = s.id === step;
        const done = completed.has(s.id);
        // Fail-closed pairing: the disabled attribute mirrors the SAME validity the
        // resolvers enforce — jumpTo() independently rejects a blocked forward target.
        // Only targets FORWARD of the current step can be blocked: the current step and
        // every backward target stay operable even when they sit above maxEnterableStep.
        const blocked = s.id > step && s.id > maxEnterableStep;
        return (
          <div key={s.id} className="flex items-center">
            <button type="button" onClick={() => jumpTo(s.id)} disabled={blocked} aria-disabled={blocked}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
                active ? "bg-blue-950/40 border border-[#1d4ed8] text-slate-100"
                       : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
                blocked && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-slate-400",
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

function CompactStepper({ step, jumpTo, completed, maxEnterableStep }: Pick<EstimateWizardApi, "step" | "jumpTo" | "completed" | "maxEnterableStep">) {
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
          const blocked = s.id > step && s.id > maxEnterableStep;
          return (
            <button key={s.id} type="button" onClick={() => jumpTo(s.id)} aria-label={s.label}
              disabled={blocked} aria-disabled={blocked}
              className={cn(
                "flex-1 h-9 rounded-md text-[11px] font-medium transition-colors border",
                active ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                       : done ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-300"
                              : "bg-[#0f172a] border-slate-700 text-slate-400",
                blocked && "opacity-40 cursor-not-allowed",
              )}>{s.short}</button>
          );
        })}
      </div>
    </div>
  );
}

function TotalRows({ totals }: { totals: WizardTotals }) {
  const notice = stateNotice(totals.state);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200">{yen(totals.subtotal)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">値引き</span><span className="text-slate-200">{discountYen(totals.discount)}</span></div>
      <div className="flex justify-between"><span className="text-slate-400">消費税</span><span className="text-slate-200">{yen(totals.tax)}</span></div>
      <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white">{yen(totals.total)}</span></div>
      {notice && <p className={cn("text-[10px]", noticeColor(totals.state))}>{notice}</p>}
    </div>
  );
}

function NavButtons({ api }: { api: EstimateWizardApi }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <SecondaryButton onClick={api.back} disabled={api.isFirst} className="flex-1">戻る</SecondaryButton>
        {/* Fail-closed pairing: canAdvance is resolveNext !== current — NOT current-step
            validity alone — so an invalidated EARLIER prerequisite blocks the button while
            the operator stands on a later step; next() independently refuses regardless. */}
        <PrimaryButton onClick={api.next} disabled={api.isLast || !api.canAdvance} className="flex-1">次へ</PrimaryButton>
      </div>
      {/* Always-mounted polite live region: the reason appears/clears in place. */}
      <p aria-live="polite" data-testid="wizard-blocked-reason" className="text-[11px] text-amber-400/90 mt-2 min-h-[1em]">
        {api.blockedReasonJa}
      </p>
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
        <FullStepper step={api.step} jumpTo={api.jumpTo} completed={api.completed} maxEnterableStep={api.maxEnterableStep} />
        <CompactStepper step={api.step} jumpTo={api.jumpTo} completed={api.completed} maxEnterableStep={api.maxEnterableStep} />
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
          <span className="text-white font-semibold">{yen(totals.total)}</span>
        </div>
        {stateNotice(totals.state) && (
          <p className={cn("text-[10px] mb-2", noticeColor(totals.state))}>{stateNotice(totals.state)}</p>
        )}
        <NavButtons api={api} />
      </div>
    </div>
  );
}
