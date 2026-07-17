"use client";

// Step 2 — 車両登録. Unified 車検証OCR entry (existing pipeline: 写真を撮影 / 写真から
// 読み込み / PDF読み込み). 車名 is manual-only (required). Body size = 7 buttons
// (SS/S/M/ML/L/LL/XL); the 3M recommendation only HIGHLIGHTS — it is never auto-fixed;
// the operator always makes the final choice. Real save/3M wire in Phase 2.

import type { EstimateWizardApi } from "../useEstimateWizard";
import { OcrEntry } from "../OcrEntry";
import { Card, SectionTitle, Field, TextInput, SelectButton, ChoiceGrid } from "../ui";

const BODY_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"];

export function Step2Vehicle({ api }: { api: EstimateWizardApi }) {
  const v = api.store.vehicle;
  const setV = (patch: Partial<typeof v>) => api.updateStore({ vehicle: { ...v, ...patch } });

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>車両登録</SectionTitle>
          <OcrEntry
            onApply={(f) => {
              const rec = f as Record<string, unknown>;
              const patch: Partial<typeof v> = {};
              if (typeof rec.maker === "string") patch.maker = rec.maker;
              if (typeof rec.plate_number === "string") patch.plateNumber = rec.plate_number;
              if (Object.keys(patch).length) setV(patch);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <ChoiceGrid cols={2}>
            <Field label="メーカー" value={v.maker}>
              <TextInput value={v.maker} onChange={(x) => setV({ maker: x })} placeholder="トヨタ" />
            </Field>
            <Field label="車名" required value={v.model} hint="車検証から取得不可 — 常に手入力必須">
              <TextInput value={v.model} onChange={(x) => setV({ model: x })} placeholder="クラウン" required />
            </Field>
            <Field label="型式" value={v.vehicleCode}>
              <TextInput value={v.vehicleCode} onChange={(x) => setV({ vehicleCode: x })} placeholder="ABA-XXX" />
            </Field>
            <Field label="排気量" value={v.displacement}>
              <TextInput value={v.displacement} onChange={(x) => setV({ displacement: x })} placeholder="1998cc" />
            </Field>
            <Field label="ナンバープレート" value={v.plateNumber}>
              <TextInput value={v.plateNumber} onChange={(x) => setV({ plateNumber: x })} placeholder="滋賀 330 に 1234" />
            </Field>
          </ChoiceGrid>
        </div>

        {/* Body size — 7 buttons, recommendation highlighted, never auto-fixed */}
        <div className="mt-4">
          <Field label="ボディサイズ（3M推定は推奨のみ・最終決定はオペレーター）" value={v.confirmedSize}>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {BODY_SIZES.map((s) => (
                <SelectButton key={s} selected={v.confirmedSize === s} onClick={() => setV({ confirmedSize: s })} density="touch">
                  <span className="w-full text-center block">
                    {s}
                    {v.suggestedSize === s && <span className="block text-[9px] text-emerald-400">推奨</span>}
                  </span>
                </SelectButton>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <p className="text-[11px] text-slate-500">
          既存車両の選択、拡張フィールド（車体番号 / 初年度登録年月 / 登録年月日 / 車検満了日 / ボディカラー）、
          3M自動推定の算出、車両保存は Phase 2 で既存ロジックに接続します。
        </p>
      </Card>
    </>
  );
}
