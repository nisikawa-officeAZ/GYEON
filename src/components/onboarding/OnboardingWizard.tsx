"use client";

// PHASE59: Onboarding wizard — 7-step setup flow
// Client component. Calls server actions for each step save.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveOnboardingStep,
  completeOnboarding,
  skipOnboarding,
} from "@/lib/onboarding/onboarding";
import {
  OnboardingStatus,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/lib/onboarding/onboarding-types";
import {
  getPlanLabel,
  getStatusLabel,
  getStatusBadgeColor,
} from "@/lib/subscription/subscription-types";
import { planBadgeColor } from "@/lib/plans/plan-types";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffRow {
  id:     string;
  name:   string | null;
  email:  string | null;
  role:   string;
  status: string;
}

interface SubInfo {
  plan_code: string;
  status:    string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
}

interface Props {
  initialStatus: OnboardingStatus;
  staffList:     StaffRow[];
  subscription:  SubInfo | null;
  appUrl:        string;
}

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

// ─── Step 1: Dealer Information ───────────────────────────────────────────────

function Step1Form({
  data,
  onChange,
}: {
  data: { name: string; phone: string; email: string; address: string; website: string; logo: string };
  onChange: (f: string, v: string) => void;
}) {
  const Field = ({ label, field, type = "text", placeholder = "" }: {
    label: string; field: string; type?: string; placeholder?: string;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={data[field as keyof typeof data]}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        ショップ情報を入力してください。後からも変更できます。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="ショップ名 *"       field="name"    placeholder="例: GYEON Tokyo" />
        <Field label="電話番号"           field="phone"   type="tel" placeholder="例: 03-0000-0000" />
        <Field label="メールアドレス"     field="email"   type="email" placeholder="info@example.com" />
        <Field label="ウェブサイト URL"   field="website" placeholder="https://example.com" />
      </div>
      <Field label="住所" field="address" placeholder="例: 東京都渋谷区..." />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">ロゴ URL（任意）</span>
        <input
          type="url"
          value={data.logo}
          onChange={(e) => onChange("logo", e.target.value)}
          placeholder="https://example.com/logo.png"
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
        />
        <span className="text-[10px] text-slate-600">ロゴ画像の URL を入力。後から設定でも変更できます。</span>
      </label>
    </div>
  );
}

// ─── Step 2: Staff Setup ──────────────────────────────────────────────────────

function Step2Staff({ staffList }: { staffList: StaffRow[] }) {
  const roleLabel = (r: string) => {
    switch (r) {
      case "owner":    return "オーナー";
      case "manager":  return "マネージャー";
      case "staff":    return "スタッフ";
      case "readonly": return "閲覧のみ";
      default:         return r;
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        現在のスタッフメンバーを確認し、必要に応じて設定ページからスタッフを招待してください。
      </p>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        {staffList.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-500">スタッフが登録されていません</p>
            <p className="text-[10px] text-slate-600 mt-1">設定ページから招待できます</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2 text-left">名前</th>
                <th className="px-4 py-2 text-left">メール</th>
                <th className="px-4 py-2 text-left">役割</th>
                <th className="px-4 py-2 text-left">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} className="border-b border-slate-700/30 last:border-b-0">
                  <td className="px-4 py-2 text-slate-200">{s.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{s.email ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{roleLabel(s.role)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      s.status === "active"
                        ? "bg-green-900/30 text-green-400 border-green-800/40"
                        : "bg-slate-800 text-slate-500 border-slate-700"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-300 font-medium mb-1">スタッフを招待するには</p>
        <p className="text-[10px] text-blue-400">
          設定ページの「スタッフ管理」から招待できます。役割は Owner / Manager / Staff / ReadOnly から選択できます。
        </p>
        <Link
          href="/settings"
          target="_blank"
          className="inline-block mt-2 text-[10px] text-blue-400 underline hover:text-blue-300"
        >
          設定を開く →
        </Link>
      </div>
    </div>
  );
}

// ─── Step 3: Subscription ─────────────────────────────────────────────────────

function Step3Subscription({ subscription }: { subscription: SubInfo | null }) {
  if (!subscription) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-slate-400">サブスクリプション情報を取得できませんでした。</p>
      </div>
    );
  }
  const planCode = subscription.plan_code as Parameters<typeof getPlanLabel>[0];
  const status   = subscription.status   as Parameters<typeof getStatusLabel>[0];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">現在の契約プランをご確認ください。</p>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${planBadgeColor(planCode)}`}>
            {getPlanLabel(planCode)}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${getStatusBadgeColor(status)}`}>
            {getStatusLabel(status)}
          </span>
        </div>
        {subscription.trial_ends_at && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>トライアル終了日</span>
            <span>{subscription.trial_ends_at.slice(0, 10)}</span>
          </div>
        )}
        {subscription.current_period_ends_at && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>有効期限</span>
            <span>{subscription.current_period_ends_at.slice(0, 10)}</span>
          </div>
        )}
      </div>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3">
        <p className="text-[10px] text-slate-500">
          プランのアップグレード・変更については管理者へお問い合わせください。詳しくは設定ページの「契約プラン」をご確認ください。
        </p>
      </div>
    </div>
  );
}

// ─── Step 4: Estimate Settings ────────────────────────────────────────────────

function Step4Estimates({
  data,
  onChange,
}: {
  data: { tax_rate: string; terms: string };
  onChange: (f: string, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">見積書・請求書の基本設定を行います。</p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">消費税率 (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={data.tax_rate}
          onChange={(e) => onChange("tax_rate", e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 w-32"
        />
        <span className="text-[10px] text-slate-600">日本の標準税率: 10%</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">取引条件・注意事項</span>
        <textarea
          value={data.terms}
          onChange={(e) => onChange("terms", e.target.value)}
          rows={4}
          placeholder="例: 支払期日：請求書発行より30日以内&#10;振込手数料はご負担ください..."
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
        />
        <span className="text-[10px] text-slate-600">見積書・請求書の末尾に表示されます。</span>
      </label>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3">
        <p className="text-[10px] text-slate-500">
          書類番号のカスタマイズ（接頭語・開始番号）は設定ページの「番号設定」から行えます。
        </p>
      </div>
    </div>
  );
}

// ─── Step 5: LINE Integration ─────────────────────────────────────────────────

function Step5Line({
  lineEnabled,
  liffId,
  webhookUrl,
  appUrl,
}: {
  lineEnabled: boolean;
  liffId: string | null;
  webhookUrl: string | null;
  appUrl: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        LINE連携はオプション機能です（Pro Plus プランで利用可能）。後から設定することもできます。
      </p>
      <div className="flex items-start gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${lineEnabled ? "bg-green-400" : "bg-slate-600"}`} />
        <div>
          <p className="text-xs font-medium text-slate-200">
            LINE接続: {lineEnabled ? "設定済み" : "未設定"}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {lineEnabled ? "LINE Messaging API が有効です" : "LINE Messaging API が設定されていません"}
          </p>
        </div>
      </div>
      {liffId && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">LIFF ID</span>
          <code className="text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded px-3 py-2">
            {liffId}
          </code>
        </div>
      )}
      {webhookUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Webhook URL</span>
          <code className="text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded px-3 py-2 break-all">
            {appUrl}/api/line/webhook
          </code>
        </div>
      )}
      {!lineEnabled && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 flex flex-col gap-1.5">
          <p className="text-[10px] text-slate-400 font-medium">LINE連携を設定するには</p>
          <ol className="text-[10px] text-slate-500 list-decimal pl-4 space-y-1">
            <li>LINE Developers Console でチャンネルを作成</li>
            <li>Channel ID / Secret / Access Token を取得</li>
            <li>Webhook URL に <code className="text-slate-400">/api/line/webhook</code> を設定</li>
            <li>設定ページの「LINE設定」から認証情報を入力</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Step 6: PDF & Document Settings ─────────────────────────────────────────

function Step6Pdf({
  data,
  onChange,
}: {
  data: { stamp: string; footer: string; invoiceNote: string; completionNote: string };
  onChange: (f: string, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">PDF書類の共通設定を行います。</p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">社判・スタンプ画像 URL（任意）</span>
        <input
          type="url"
          value={data.stamp}
          onChange={(e) => onChange("stamp", e.target.value)}
          placeholder="https://example.com/stamp.png"
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
        />
        <span className="text-[10px] text-slate-600">PDF の右下に表示されます。透過 PNG 推奨。</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">PDF フッター</span>
        <textarea
          value={data.footer}
          onChange={(e) => onChange("footer", e.target.value)}
          rows={2}
          placeholder="例: 〒000-0000 東京都... | Tel: 03-0000-0000"
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
        />
        <span className="text-[10px] text-slate-600">すべての PDF 書類の下部に表示されます。</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">請求書 備考</span>
        <textarea
          value={data.invoiceNote}
          onChange={(e) => onChange("invoiceNote", e.target.value)}
          rows={2}
          placeholder="例: お振込先: ○○銀行 △△支店..."
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">完了報告書 備考</span>
        <textarea
          value={data.completionNote}
          onChange={(e) => onChange("completionNote", e.target.value)}
          rows={2}
          placeholder="例: 施工後1週間以内にご連絡ください..."
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
        />
      </label>
    </div>
  );
}

// ─── Step 7: Finish ───────────────────────────────────────────────────────────

function Step7Finish() {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center text-3xl">
        ✓
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-100">
          セットアップが完了しました！
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          GYEON Detailer Agent の準備が整いました。さっそく始めましょう。
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
        {[
          { href: "/",          label: "ダッシュボード",   icon: "▦" },
          { href: "/customers", label: "顧客管理",         icon: "⊙" },
          { href: "/estimates", label: "見積作成",         icon: "⊛" },
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

export default function OnboardingWizard({
  initialStatus,
  staffList,
  subscription,
  appUrl,
}: Props) {
  const router = useRouter();

  // Resolve starting step (clamp to 1-7)
  const startStep = Math.max(1, Math.min(ONBOARDING_TOTAL_STEPS, initialStatus.onboarding_step));
  const [currentStep, setCurrentStep] = useState(startStep);
  const [isPending, startTransition]  = useTransition();
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // Per-step form state
  const [step1, setStep1] = useState({
    name:    initialStatus.business_name    ?? "",
    phone:   initialStatus.business_phone   ?? "",
    email:   initialStatus.business_email   ?? "",
    address: initialStatus.business_address ?? "",
    website: initialStatus.business_website ?? "",
    logo:    initialStatus.logo_url         ?? "",
  });

  const [step4, setStep4] = useState({
    tax_rate: String(initialStatus.tax_rate ?? 10),
    terms:    initialStatus.terms_and_conditions ?? "",
  });

  const [step6, setStep6] = useState({
    stamp:          initialStatus.stamp_url       ?? "",
    footer:         initialStatus.pdf_footer      ?? "",
    invoiceNote:    initialStatus.invoice_note    ?? "",
    completionNote: initialStatus.completion_note ?? "",
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function updateStep1(field: string, value: string) {
    setStep1((prev) => ({ ...prev, [field]: value }));
  }
  function updateStep4(field: string, value: string) {
    setStep4((prev) => ({ ...prev, [field]: value }));
  }
  function updateStep6(field: string, value: string) {
    setStep6((prev) => ({ ...prev, [field]: value }));
  }

  function buildStepParams(step: number) {
    const base = { step };
    if (step === 1) {
      return {
        ...base,
        business_name:    step1.name    || null,
        business_phone:   step1.phone   || null,
        business_email:   step1.email   || null,
        business_address: step1.address || null,
        business_website: step1.website || null,
        logo_url:         step1.logo    || null,
      };
    }
    if (step === 4) {
      return {
        ...base,
        tax_rate:             Number(step4.tax_rate) || 10,
        terms_and_conditions: step4.terms || null,
      };
    }
    if (step === 6) {
      return {
        ...base,
        stamp_url:       step6.stamp          || null,
        pdf_footer:      step6.footer         || null,
        invoice_note:    step6.invoiceNote     || null,
        completion_note: step6.completionNote  || null,
      };
    }
    return base;
  }

  async function handleNext() {
    startTransition(async () => {
      const nextStep = currentStep + 1;
      const params   = buildStepParams(currentStep);
      const result   = await saveOnboardingStep(params);
      if (!result.success) {
        showToast(result.error ?? "保存に失敗しました", false);
        return;
      }
      if (currentStep < ONBOARDING_TOTAL_STEPS) {
        setCurrentStep(nextStep);
      }
    });
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  function handleSkipStep() {
    // Skip current step without saving, advance to next
    if (currentStep < ONBOARDING_TOTAL_STEPS) {
      startTransition(async () => {
        await saveOnboardingStep({ step: currentStep + 1 });
        setCurrentStep((s) => s + 1);
      });
    }
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
      setTimeout(() => router.push("/"), 1500);
    });
  }

  const isLastStep    = currentStep === ONBOARDING_TOTAL_STEPS;
  const hasStepData   = [1, 4, 6].includes(currentStep);

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      {/* Toast */}
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
            数分で設定完了します。後からいつでも変更できます。
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
            {currentStep === 1 && (
              <Step1Form data={step1} onChange={updateStep1} />
            )}
            {currentStep === 2 && (
              <Step2Staff staffList={staffList} />
            )}
            {currentStep === 3 && (
              <Step3Subscription subscription={subscription} />
            )}
            {currentStep === 4 && (
              <Step4Estimates data={step4} onChange={updateStep4} />
            )}
            {currentStep === 5 && (
              <Step5Line
                lineEnabled={initialStatus.line_enabled}
                liffId={initialStatus.line_liff_id}
                webhookUrl={initialStatus.webhook_url}
                appUrl={appUrl}
              />
            )}
            {currentStep === 6 && (
              <Step6Pdf data={step6} onChange={updateStep6} />
            )}
            {currentStep === 7 && (
              <Step7Finish />
            )}
          </div>

          {/* Footer / action buttons */}
          <div className="px-6 pb-6 pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
            {/* Left: resume later */}
            {!isLastStep && (
              <button
                onClick={handleResumeLater}
                disabled={isPending}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
              >
                後で続ける
              </button>
            )}
            {isLastStep && <div />}

            {/* Right: back / skip / next / complete */}
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

              {!isLastStep && !hasStepData && (
                <button
                  onClick={handleSkipStep}
                  disabled={isPending}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                >
                  スキップ
                </button>
              )}

              {!isLastStep && (
                <button
                  onClick={handleNext}
                  disabled={isPending}
                  className="text-xs px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors font-medium"
                >
                  {isPending ? "保存中..." : hasStepData ? "保存して次へ" : "次へ"}
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
