"use client";

// Initial Setup — fast 3-step onboarding (Admin/Owner → Estimate Settings →
// Finish). Goal: register → approve → login → onboard → start estimating in
// ~1 minute. Shop info / subscription / LINE / PDF are configured later from
// Settings (see the Dashboard "Profile Completion" card).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveOnboardingStep,
  completeOnboarding,
  skipOnboarding,
} from "@/lib/onboarding/onboarding";
import { saveOnboardingAdmin } from "@/lib/onboarding/save-onboarding-admin";
import {
  OnboardingStatus,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/lib/onboarding/onboarding-types";
import Link from "next/link";

interface Props {
  initialStatus: OnboardingStatus;
}

const INPUT_CLASS =
  "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 placeholder:text-slate-600";

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.min(100, Math.round(((step - 1) / total) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>STEP {step} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Step nav dots ────────────────────────────────────────────────────────────

function StepNav({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {ONBOARDING_STEPS.map((s) => (
        <div
          key={s.number}
          className={`flex flex-col items-center gap-1 ${currentStep === s.number ? "opacity-100" : "opacity-40"}`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
              currentStep > s.number
                ? "bg-green-600 border-green-500 text-white"
                : currentStep === s.number
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
          >
            {currentStep > s.number ? "✓" : s.number}
          </div>
          <span className="text-[9px] text-slate-500 hidden sm:block">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Admin / Owner (管理者情報) ───────────────────────────────────────

interface Step1Data {
  name:     string;
  furigana: string;
  phone:    string;
}

function Step1Admin({
  data,
  onChange,
}: {
  data: Step1Data;
  onChange: (f: string, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        管理者（オーナー）の情報を入力してください。この方が店舗の主担当・管理者になります。
        メールアドレスはログイン済みのため入力不要です。追加スタッフや店舗情報はあとで「設定」から登録できます。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">管理者氏名 *</span>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="例: 山田 太郎"
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">フリガナ</span>
          <input
            type="text"
            value={data.furigana}
            onChange={(e) => onChange("furigana", e.target.value)}
            placeholder="例: ヤマダ タロウ"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">電話番号（任意）</span>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="例: 090-0000-0000"
          className={INPUT_CLASS}
        />
      </label>
    </div>
  );
}

// ─── Step 2: Estimate Settings (見積設定) ─────────────────────────────────────

function Step2Estimates({
  data,
  onChange,
}: {
  data: { tax_rate: string; terms: string };
  onChange: (f: string, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        見積を作成するための最小限の設定です。詳細な書類設定はあとで「設定」から変更できます。
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">消費税率 (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={data.tax_rate}
          onChange={(e) => onChange("tax_rate", e.target.value)}
          className={`${INPUT_CLASS} w-32`}
        />
        <span className="text-[10px] text-slate-600">日本の標準税率: 10%</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">取引条件・注意事項（任意）</span>
        <textarea
          value={data.terms}
          onChange={(e) => onChange("terms", e.target.value)}
          rows={4}
          placeholder="例: 支払期日：請求書発行より30日以内..."
          className={`${INPUT_CLASS} resize-none`}
        />
        <span className="text-[10px] text-slate-600">見積書・請求書の末尾に表示されます。</span>
      </label>
    </div>
  );
}

// ─── Step 3: Finish ───────────────────────────────────────────────────────────

function Step3Finish() {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center text-3xl">
        ✓
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-100">初期セットアップが完了しました。</h3>
        <p className="text-xs text-slate-400 mt-1">
          さっそく見積を作成しましょう。店舗情報・LINE・PDF などはダッシュボードや設定から後で登録できます。
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
        {[
          { href: "/",          label: "ダッシュボード", icon: "▦" },
          { href: "/estimates", label: "見積作成",       icon: "⊛" },
          { href: "/settings",  label: "設定",           icon: "⚙" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors"
          >
            <span className="text-xl text-slate-300">{link.icon}</span>
            <span className="text-xs text-slate-200 font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard({ initialStatus }: Props) {
  const router = useRouter();

  const startStep = Math.max(1, Math.min(ONBOARDING_TOTAL_STEPS, initialStatus.onboarding_step));
  const [currentStep, setCurrentStep] = useState(startStep);
  const [isPending, startTransition]  = useTransition();
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  const [step1, setStep1] = useState({ name: "", furigana: "", phone: "" });
  const [step2, setStep2] = useState({
    tax_rate: String(initialStatus.tax_rate ?? 10),
    terms:    initialStatus.terms_and_conditions ?? "",
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const updateStep1 = (field: string, value: string) => setStep1((p) => ({ ...p, [field]: value }));
  const updateStep2 = (field: string, value: string) => setStep2((p) => ({ ...p, [field]: value }));

  async function handleNext() {
    startTransition(async () => {
      const result =
        currentStep === 1
          ? await saveOnboardingAdmin({ name: step1.name, furigana: step1.furigana, phone: step1.phone })
          : await saveOnboardingStep({
              step: 2,
              tax_rate: Number(step2.tax_rate) || 10,
              terms_and_conditions: step2.terms || null,
            });
      if (!result.success) {
        showToast(result.error ?? "保存に失敗しました", false);
        return;
      }
      if (currentStep < ONBOARDING_TOTAL_STEPS) setCurrentStep(currentStep + 1);
    });
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  function handleResumeLater() {
    startTransition(async () => {
      await skipOnboarding();
      router.push("/");
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (!result.success) {
        showToast(result.error ?? "完了処理に失敗しました", false);
        return;
      }
      showToast("セットアップ完了！ダッシュボードへ移動します...");
      setTimeout(() => router.push("/"), 1200);
    });
  }

  const isLastStep = currentStep === ONBOARDING_TOTAL_STEPS;

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border text-xs shadow-lg ${
          toast.ok
            ? "bg-green-900/80 border-green-700 text-green-200"
            : "bg-red-900/80 border-red-700 text-red-200"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] text-blue-400 tracking-widest uppercase font-semibold mb-2">
            GYEON Detailer Agent
          </p>
          <h1 className="text-xl font-bold text-slate-100">初期セットアップ</h1>
          <p className="text-xs text-slate-500 mt-1">
            数分で完了します。店舗情報など詳細は後から設定できます。
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
          {/* Progress */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-800">
            <ProgressBar step={currentStep} total={ONBOARDING_TOTAL_STEPS} />
            <div className="mt-4">
              <StepNav currentStep={currentStep} />
            </div>
          </div>

          {/* Step title */}
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {ONBOARDING_STEPS[currentStep - 1]?.title}
            </h2>
          </div>

          {/* Step content */}
          <div className="px-6 pb-4">
            {currentStep === 1 && <Step1Admin data={step1} onChange={updateStep1} />}
            {currentStep === 2 && <Step2Estimates data={step2} onChange={updateStep2} />}
            {currentStep === 3 && <Step3Finish />}
          </div>

          {/* Footer / actions */}
          <div className="px-6 pb-6 pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
            {!isLastStep ? (
              <button
                onClick={handleResumeLater}
                disabled={isPending}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
              >
                後で続ける
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {currentStep > 1 && !isLastStep && (
                <button
                  onClick={handleBack}
                  disabled={isPending}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-40"
                >
                  戻る
                </button>
              )}

              {!isLastStep && (
                <button
                  onClick={handleNext}
                  disabled={isPending}
                  className="text-xs px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors font-medium"
                >
                  {isPending ? "保存中..." : "保存して次へ"}
                </button>
              )}

              {isLastStep && (
                <button
                  onClick={handleComplete}
                  disabled={isPending}
                  className="text-xs px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors font-medium"
                >
                  {isPending ? "完了処理中..." : "セットアップ完了"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom link */}
        <p className="text-center text-[10px] text-slate-600 mt-4">
          <Link href="/" className="hover:text-slate-400 underline underline-offset-2 transition-colors">
            今はスキップしてダッシュボードへ
          </Link>
        </p>
      </div>
    </div>
  );
}
