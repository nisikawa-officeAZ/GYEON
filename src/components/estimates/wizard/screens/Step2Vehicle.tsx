"use client";

// Estimate Wizard Ver2.2 — Step 2 車両登録 (presentation-only).
//
// Driven ENTIRELY by props mapping 1:1 to EstimateEditor's existing vehicle state +
// handlers. No business/OCR/pricing/save logic here. 車名 is manual-only (required).
// OCR entry shows the three Ver2.2 input options (写真を撮影 / 写真から読み込み /
// PDF読み込み) — all open the EXISTING OCR pipeline (unchanged). Body size uses the
// existing 3M estimate: the recommended size is HIGHLIGHTED only and is NEVER auto-fixed;
// the operator makes the final selection via the 7 size buttons.

import { vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import { SelectButton } from "../foundation/SelectButton";
import { Field, TextInput } from "../foundation/Field";
import type { Step2VehicleProps } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

// All three route to the existing OCR pipeline (which offers its own camera/file capture).
const OCR_OPTIONS = ["写真を撮影", "写真から読み込み", "PDF読み込み"];

export function Step2Vehicle(props: Step2VehicleProps) {
  const {
    vehicleMode, onSetVehicleMode, onOpenOcr,
    vehicleId, onSelectVehicle, vehicles,
    nv, onChangeNv,
    sizeKey, onSelectSize, sizeKeys, sizeEstimate, onEstimateSize,
  } = props;

  return (
    <>
      <div className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECHDR}>車両登録</h3>
        </div>

        {/* OCR 3 入力方式（既存パイプラインを起動）*/}
        <Field label="車検証OCR（入力方式）">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {OCR_OPTIONS.map((label) => (
              <SelectButton key={label} selected={false} onSelect={onOpenOcr}>
                {label}
              </SelectButton>
            ))}
          </div>
        </Field>

        {/* モード切替 */}
        <div className="mt-4 flex gap-2">
          <SelectButton selected={vehicleMode === "select"} onSelect={() => onSetVehicleMode("select")} className="sm:w-48">既存車両を選択</SelectButton>
          <SelectButton selected={vehicleMode === "new"} onSelect={() => onSetVehicleMode("new")} className="sm:w-48">新規車両を入力</SelectButton>
        </div>

        {/* 既存車両: タップ選択リスト（プルダウン不使用）*/}
        {vehicleMode === "select" && (
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-400">車両を選択</label>
            <div className="mt-1 flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {vehicles.length === 0 && <p className="text-[11px] text-slate-500">この顧客に紐づく車両がありません。「新規車両を入力」で登録できます。</p>}
              {vehicles.map((v) => (
                <SelectButton key={v.id} selected={vehicleId === v.id} onSelect={() => onSelectVehicle(v.id)}>
                  {vehicleDisplayName(v) || "（車両）"}
                </SelectButton>
              ))}
            </div>
          </div>
        )}

        {/* 新規車両フォーム（既存 nv 状態）*/}
        {vehicleMode === "new" && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ナンバープレート" value={nv.plate_number}>
              <TextInput value={nv.plate_number} onChange={(v) => onChangeNv({ plate_number: v })} placeholder="滋賀 330 に 1234" />
            </Field>
            <Field label="メーカー" value={nv.maker}>
              <TextInput value={nv.maker} onChange={(v) => onChangeNv({ maker: v })} placeholder="トヨタ" />
            </Field>
            <Field label="車名" required value={nv.model} hint="車検証から取得不可 — 常に手入力必須">
              <TextInput value={nv.model} onChange={(v) => onChangeNv({ model: v })} placeholder="クラウン" required />
            </Field>
            <Field label="グレード" value={nv.grade}>
              <TextInput value={nv.grade} onChange={(v) => onChangeNv({ grade: v })} placeholder="アスリート" />
            </Field>
            <Field label="型式" value={nv.vehicle_code}>
              <TextInput value={nv.vehicle_code} onChange={(v) => onChangeNv({ vehicle_code: v })} placeholder="ABA-XXX" />
            </Field>
            <Field label="車体番号" value={nv.vin}>
              <TextInput value={nv.vin} onChange={(v) => onChangeNv({ vin: v })} />
            </Field>
            <Field label="初年度登録年月" value={nv.first_registration_year_month}>
              <TextInput value={nv.first_registration_year_month} onChange={(v) => onChangeNv({ first_registration_year_month: v })} placeholder="2020-04" />
            </Field>
            <Field label="登録年月日" value={nv.registration_date}>
              <TextInput value={nv.registration_date} onChange={(v) => onChangeNv({ registration_date: v })} type="date" />
            </Field>
            <Field label="車検満了年月日" value={nv.inspection_expiry_date}>
              <TextInput value={nv.inspection_expiry_date} onChange={(v) => onChangeNv({ inspection_expiry_date: v })} type="date" />
            </Field>
            <Field label="ボディカラー" value={nv.color}>
              <TextInput value={nv.color} onChange={(v) => onChangeNv({ color: v })} placeholder="ホワイトパール" />
            </Field>
          </div>
        )}
      </div>

      {/* ボディサイズ（3M推奨はハイライトのみ・自動確定しない・最終はオペレーター）*/}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECHDR}>ボディサイズ（3M推定は推奨のみ）</h3>
          <button
            type="button"
            onClick={onEstimateSize}
            className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 min-h-[40px] rounded-lg transition-colors"
          >
            3M推定
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {sizeKeys.map((k) => {
            const recommended = sizeEstimate?.sizeKey === k;
            return (
              <SelectButton key={k} selected={sizeKey === k} onSelect={() => onSelectSize(k)} density="touch">
                <span className="w-full text-center block">
                  {k}
                  {recommended && <span className="block text-[9px] text-emerald-400">推奨</span>}
                </span>
              </SelectButton>
            );
          })}
        </div>
        {sizeEstimate?.basis && <p className="text-[10px] text-slate-500 mt-2">推定根拠: {sizeEstimate.basis}</p>}
      </div>
    </>
  );
}
