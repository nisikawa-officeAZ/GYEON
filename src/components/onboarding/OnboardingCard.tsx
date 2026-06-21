// Server component — fetches its own onboarding status
// PHASE59: Shows onboarding progress on the dashboard.
// Hidden automatically if onboarding_completed = true.

import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { ONBOARDING_TOTAL_STEPS, ONBOARDING_STEPS } from "@/lib/onboarding/onboarding-types";
import Link from "next/link";

export default async function OnboardingCard() {
  const status = await getOnboardingStatus();

  // Nothing to show: no dealer, migration not applied, or already completed
  if (!status || status.onboarding_completed) return null;

  const currentStep = Math.max(1, Math.min(ONBOARDING_TOTAL_STEPS, status.onboarding_step));
  const pct = Math.round(((currentStep - 1) / ONBOARDING_TOTAL_STEPS) * 100);
  const stepMeta = ONBOARDING_STEPS[currentStep - 1];

  // If skipped (step = 8), show a minimal "resume" card
  const isSkipped = status.onboarding_step > ONBOARDING_TOTAL_STEPS;
  const displayStep = isSkipped ? 1 : currentStep;
  const displayPct  = isSkipped ? 0 : pct;

  return (
    <div className="bg-gradient-to-r from-blue-950/50 to-slate-900/60 border border-blue-800/30 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
              {displayStep}
            </div>
            <p className="text-xs font-semibold text-slate-200">
              初期セットアップを続けましょう
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${displayPct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">
              {isSkipped
                ? "未開始"
                : `STEP ${displayStep} / ${ONBOARDING_TOTAL_STEPS} — ${displayPct}%`}
            </span>
          </div>

          {/* Step dots */}
          {!isSkipped && (
            <div className="flex gap-1">
              {ONBOARDING_STEPS.map((s) => (
                <div
                  key={s.number}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    s.number < displayStep
                      ? "bg-green-500"
                      : s.number === displayStep
                        ? "bg-blue-500"
                        : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Current step label */}
          {!isSkipped && stepMeta && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              現在のステップ: {stepMeta.title}
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          href="/onboarding"
          className="shrink-0 text-[10px] font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          {isSkipped ? "セットアップ開始" : "セットアップを続ける"}
        </Link>
      </div>
    </div>
  );
}
