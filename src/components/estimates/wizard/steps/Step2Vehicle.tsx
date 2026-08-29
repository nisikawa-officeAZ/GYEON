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
import type { VehicleDraft } from "../wizard-types";
import {
  selectableVehiclesForCustomer, effectiveExistingCustomer, effectiveExistingVehicle,
  vehicleSelectionPatch,
} from "./existing-entity-selection";
import { willSaveExistingVehicle } from "../validity/wizard-step-validity";
import { buildWizardVehicleOcrPatch } from "@/lib/ocr/wizard-vehicle-ocr-apply-core";
import { OcrEntry } from "../OcrEntry";
import { Card, SectionTitle, Field, TextInput, SelectButton, ChoiceGrid } from "../ui";
import {
  BODY_SIZE_KEYS,
  adjacentBodySizeKeys,
  estimateBodySizeFromVehicleRegistrationOcr,
  type BodySizeEstimate,
  type BodySizeKey,
} from "@/lib/vehicles/body-size-estimate";

const BODY_SIZES = BODY_SIZE_KEYS;

/** EST-WIZ-REQ-F2-R1: the editable-field patch TYPE excludes `existingId`, so a field
 *  edit CANNOT re-assert vehicle identity even by mistake — identity is written only by
 *  the explicit selection actions. `suggestedSize` is excluded too: it is display-only
 *  and the patch adapter rejects it. */
type EditableVehiclePatch = Partial<Omit<VehicleDraft, "existingId" | "suggestedSize">>;

export function Step2Vehicle({
  api, customers, vehicles, sizeEstimate = null, onSizeEstimate,
}: {
  api: EstimateWizardApi;
  sizeEstimate?: BodySizeEstimate | null;
  onSizeEstimate?: (estimate: BodySizeEstimate | null) => void;
} & WizardExistingEntityInputs) {
  const v = api.store.vehicle;
  const c = api.store.customer;
  // EST-WIZ-REQ-F1: field edits emit ONLY the changed keys — never a spread of the full
  // vehicle projection. A spread would re-assert `existingId` (and re-derive sourceMode)
  // on every keystroke, silently rewriting vehicle IDENTITY from a field edit. Identity
  // is written exclusively by the explicit selection actions below.
  const setV = (patch: EditableVehiclePatch) => api.updateStore({ vehicle: patch });

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

  // EST-WIZ-REQ-F2-R1 — the persistence-mode discriminator is the SAME truthy test the
  // save mapper uses (willSaveExistingVehicle over the canonical draft). The
  // effectiveness oracle runs ONLY on the will-save-existing branch.
  const saveExisting = willSaveExistingVehicle(api.draft);
  const selected = saveExisting ? effectiveExistingVehicle(vehicles, ownerId, v.existingId) : null;
  const registeredSize = selected && BODY_SIZES.includes(selected.bodySize as BodySizeKey)
    ? selected.bodySize as BodySizeKey
    : null;
  const suggestedSize = selected ? registeredSize : sizeEstimate?.sizeKey ?? null;
  const suggestionBasis = selected && registeredSize
    ? `登録済みボディサイズ ${registeredSize}（再確認が必要）`
    : sizeEstimate?.basis ?? "";

  /** Existing select/clear writes ONE key. Never a spread of the vehicle projection. */
  const setExistingVehicle = (id: string | null) => {
    onSizeEstimate?.(null);
    api.updateStore(vehicleSelectionPatch(id));
  };

  // An INEFFECTIVE retained selection: the draft would still SAVE as an existing vehicle,
  // but the id no longer resolves (owner left search mode or became ambiguous, the id is
  // absent, duplicated, or foreign-owned). Navigation is blocked in this state, so it must
  // be VISIBLE and OPERABLE here: ONLY the recovery alert with its explicit clear action is
  // rendered for the vehicle area — no selector and no editable form — until the operator
  // explicitly clears. Nothing clears automatically; the typed new-vehicle fields survive
  // the clear untouched, and the normal editable flow then returns.
  const ineffectiveExisting = saveExisting && selected === null;

  return (
    <>
      {ineffectiveExisting ? (
        // ONLY the recovery surface for the vehicle area: no selector, no editable form,
        // until the operator explicitly clears the ineffective selection.
        <Card>
          <div role="alert" data-testid="ineffective-existing-vehicle-recovery"
            className="rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-2">
            <p className="text-xs text-amber-200">
              以前に選択した車両は現在利用できません。顧客の変更、参照の重複、または参照切れの可能性があります。
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              選択を解除すると、入力済みの内容を保持したまま新規車両として入力できます。
            </p>
            <button
              type="button"
              data-testid="ineffective-existing-vehicle-clear"
              className="mt-2 min-h-[44px] px-3 rounded-lg border border-slate-600 text-xs text-slate-100 hover:bg-slate-800/60"
              onClick={() => setExistingVehicle(null)}
            >
              車両の選択を解除する
            </button>
          </div>
        </Card>
      ) : (
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
              // GDA-2A-OCR-R1 — Step 2 remains an explicit rescan/correction route, but shares
              // ONE typed mapper with Step 1 rather than a duplicate inline mapping.
              const patch: EditableVehiclePatch = buildWizardVehicleOcrPatch(f);

              // OCR dimensions produce a recommendation only. The operator's
              // confirmedSize remains untouched until a size button is pressed.
              const estimate = estimateBodySizeFromVehicleRegistrationOcr(f);
              onSizeEstimate?.(estimate);
              if (Object.keys(patch).length) setV(patch);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <ChoiceGrid cols={2}>
            <Field label="メーカー" value={v.maker}>
              <TextInput value={v.maker} onChange={(x) => setV({ maker: x })} placeholder="トヨタ" />
            </Field>
            <Field label="車名" required value={v.model} hint="OCR読み取りで反映される場合があります。内容を確認し、必要に応じて修正してください（必須）">
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

      </Card>
      )}

      {/* One confirmed physical size is shared by coating and PPF pricing. */}
      <Card>
        <Field label="ボディサイズ（3M推定は推奨のみ・最終決定はオペレーター）" value={v.confirmedSize}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {BODY_SIZES.map((s) => {
              const recommended = suggestedSize === s;
              const adjacent = suggestedSize != null && adjacentBodySizeKeys(suggestedSize).includes(s);
              return (
                <SelectButton
                  key={s}
                  selected={v.confirmedSize === s}
                  onClick={() => setV({ confirmedSize: s })}
                  density="touch"
                  className={
                    recommended
                      ? "border-blue-400 bg-blue-600/25 text-blue-50 hover:border-blue-300"
                      : adjacent
                        ? "border-amber-400/80 bg-amber-400/10 text-amber-100 hover:border-amber-300"
                        : undefined
                  }
                >
                  <span className="block w-full text-center">
                    {s}
                    {recommended && <span className="block text-[9px] text-blue-200">推奨サイズ</span>}
                    {adjacent && <span className="block text-[9px] text-amber-300">前後候補</span>}
                  </span>
                </SelectButton>
              );
            })}
          </div>
          {suggestedSize == null && (
            <p className="mt-2 text-[11px] text-amber-300">
              OCR寸法または登録サイズが確認できません。車検証を確認してサイズを選択してください。
            </p>
          )}
          {suggestionBasis && (
            <p className="mt-2 text-[11px] text-slate-400">推定根拠：{suggestionBasis}</p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            ここで確定したサイズを、コーティングとPPFの価格選択に共通利用します。
          </p>
        </Field>
      </Card>
      </>
      )}
    </>
  );
}
