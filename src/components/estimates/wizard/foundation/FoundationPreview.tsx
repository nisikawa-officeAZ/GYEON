"use client";

// Estimate Wizard Ver2.2 — NON-FUNCTIONAL foundation preview (validation only).
//
// Renders the Phase 1 shared foundation with static mock data and no-op-ish local step
// state so the layout/responsive behavior can be visually validated. It is NOT connected
// to EstimateEditor and contains NO pricing / OCR / save / customer / vehicle / estimate
// business logic. Not mounted on any route.

import { useState } from "react";
import { WizardShell } from "./WizardShell";
import { SelectButton } from "./SelectButton";
import { Field, TextInput } from "./Field";
import { WIZARD_STEPS, type WizardStepId } from "./tokens";
import type { WizardTotalsView } from "./MiniTotalBar";

const MOCK_TOTALS: WizardTotalsView = { subtotal: 0, discount: 0, tax: 0, total: 0, ready: false };

function clamp(n: number): WizardStepId {
  return Math.min(7, Math.max(1, n)) as WizardStepId;
}

export default function FoundationPreview() {
  const [step, setStep] = useState<WizardStepId>(1);
  const [demo, setDemo] = useState("");
  const [pick, setPick] = useState<string | null>(null);

  const meta = WIZARD_STEPS.find((s) => s.id === step);

  return (
    <WizardShell
      title="見積ウィザード（基盤プレビュー）"
      estimateNo="PREVIEW"
      step={step}
      jumpTo={(id) => setStep(id)}
      onBack={() => setStep((s) => clamp(s - 1))}
      onNext={() => setStep((s) => clamp(s + 1))}
      isFirst={step === 1}
      isLast={step === 7}
      totals={MOCK_TOTALS}
    >
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 flex flex-col gap-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {meta?.label}（プレビュー）
        </h3>

        <Field label="サンプル必須項目" required value={demo} hint="入力すると Amber が解除されます">
          <TextInput value={demo} onChange={setDemo} placeholder="ここに入力" required />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {["選択A", "選択B", "選択C（無効）"].map((label, i) => (
            <SelectButton
              key={label}
              selected={pick === label}
              disabled={i === 2}
              density="touch"
              subLabel={i === 2 ? "準備中" : undefined}
              onSelect={() => setPick(label)}
            >
              {label}
            </SelectButton>
          ))}
        </div>

        <p className="text-[11px] text-slate-500">
          これは Phase 1 基盤の非機能プレビューです（価格/OCR/保存等のロジックなし・EstimateEditor 未接続）。
        </p>
      </div>
    </WizardShell>
  );
}
