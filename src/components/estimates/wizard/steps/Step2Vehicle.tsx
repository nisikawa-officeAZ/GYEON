"use client";

// Step 2 — 車両登録. Unified 車検証OCR entry (existing pipeline: 写真を撮影 / 写真から
// 読み込み / PDF読み込み). 車名 is manual-only (required). Body size = 7 buttons
// (SS/S/M/ML/L/LL/XL); the 3M recommendation only HIGHLIGHTS — it is never auto-fixed;
// the operator always makes the final choice. Real save/3M wire in Phase 2.
//
// B7-2A: existing-vehicle selection is wired, scoped to the vehicles OWNED by the
// selected existing customer. Selecting one records ONLY the id — never a copy of
// the reference's display fields into the new-vehicle CREATE payload — and never
// auto-sets a body size.

import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardExistingEntityInputs } from "../contract/wizard-runtime-inputs";
import {
  selectableVehiclesForCustomer, effectiveExistingCustomer, effectiveExistingVehicle,
  vehicleSelectionPatch,
} from "./existing-entity-selection";
import { OcrEntry } from "../OcrEntry";
import { Card, SectionTitle, Field, TextInput, SelectButton, ChoiceGrid } from "../ui";

const BODY_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"];

export function Step2Vehicle({
  api, customers, vehicles,
}: { api: EstimateWizardApi } & WizardExistingEntityInputs) {
  const v = api.store.vehicle;
  const c = api.store.customer;
  const setV = (patch: Partial<typeof v>) => api.updateStore({ vehicle: { ...v, ...patch } });

  // The owner is resolved through the SAME effectiveness rule Step 1 uses: the mode
  // must be "search" AND the stored id must resolve to exactly one reference.
  //
  // The stored `c.existingId` is never trusted directly. If it is absent, unknown,
  // used under the wrong mode, or DUPLICATED in the references, there is no
  // effective owner — so no existing-vehicle surface is rendered at all and the
  // editable/OCR flow stands. An ambiguous customer must not be able to offer
  // "its" vehicles, because which record it names is exactly what is unknown.
  const owner = effectiveExistingCustomer(customers, c.regMethod, c.existingId);
  const ownerId = owner?.id ?? null;
  const ownedVehicles = selectableVehiclesForCustomer(vehicles, ownerId);
  const selected = effectiveExistingVehicle(vehicles, ownerId, v.existingId);

  /** Existing select/clear writes ONE key. Never a spread of the vehicle projection. */
  const setExistingVehicle = (id: string | null) => api.updateStore(vehicleSelectionPatch(id));

  return (
    <>
      {ownerId !== null && (
        <Card>
          <SectionTitle>既存車両</SectionTitle>
          {selected ? (
            <div className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2" data-testid="existing-vehicle-summary">
              <p className="text-xs text-emerald-300">既存車両を選択中</p>
              <p className="text-sm mt-1">{selected.displayName}</p>
              {selected.plateNumber && <p className="text-[11px] text-slate-400">{selected.plateNumber}</p>}
              {/* bodySize is shown for orientation ONLY. It never sets confirmedSize:
                  the operator's final body-size choice is the persistence authority,
                  exactly as with the 3M recommendation below. */}
              {selected.bodySize && (
                <p className="text-[11px] text-slate-500">登録ボディサイズ: {selected.bodySize}（参考表示）</p>
              )}
              <button
                type="button"
                className="mt-2 text-[11px] text-slate-400 underline"
                onClick={() => setExistingVehicle(null)}
              >
                選択を解除
              </button>
            </div>
          ) : (
            <div data-testid="existing-vehicle-selector">
              {ownedVehicles.length === 0 ? (
                <p className="text-xs text-slate-500">この顧客に登録済みの車両はありません。下の項目で新規登録できます。</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800">
                  {ownedVehicles.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      data-testid={`existing-vehicle-option-${o.id}`}
                      className="w-full text-left py-2 px-1 hover:bg-slate-800/60"
                      onClick={() => setExistingVehicle(o.id)}
                    >
                      <span className="block text-sm">{o.displayName}</span>
                      {o.plateNumber && <span className="block text-[11px] text-slate-500">{o.plateNumber}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* No existing vehicle selected → the editable / OCR flow is preserved exactly. */}
      {selected === null && (
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
      )}

      <Card>
        <p className="text-[11px] text-slate-500">
          拡張フィールド（車体番号 / 初年度登録年月 / 登録年月日 / 車検満了日 / ボディカラー）、
          3M自動推定の算出、車両保存は Phase 2 で既存ロジックに接続します。
        </p>
      </Card>
    </>
  );
}
