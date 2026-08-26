"use client";

// Estimate Wizard Ver2.2 — PPF section orchestrator (Phase 4B, presentation-only).
//
// Flow: 施工方法 → (部分施工なら部位選択 / 室内PPFなら手入力行) → PPF種類 → 店舗設定由来の
// 単価・係数を表示（編集可能単価は上書き可）→ 追加/更新（コールバック）. Fully prop-driven.
// The component NEVER calculates price, NEVER applies a coefficient, NEVER creates estimate
// items, NEVER touches DB/inventory/Server Actions. The editable unit price is just a field
// with a default value that the owner uses later as the unit price (not a discount/modifier).

import { cn, formatYen } from "../foundation/tokens";
import { PpfInstallationMethodSelector } from "./PpfInstallationMethodSelector";
import { PpfPartialPartsSelector } from "./PpfPartialPartsSelector";
import { InteriorPpfRows } from "./InteriorPpfRows";
import { PpfTypeSelector } from "./PpfTypeSelector";
import { SelectButton } from "../foundation/SelectButton";
import type { PpfSelectorProps } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

export function PpfSelector(props: PpfSelectorProps) {
  const {
    shopRank, ppfLocked, lockReason,
    selectedInstallationMethod, installationMethods, onInstallationMethodChange,
    selectedFullCoverage = null, onFullCoverageChange,
    selectedPartialPartIds, partialParts, quantitiesByPart, onPartialPartToggle, onQuantityChange,
    selectedPpfTypeId, ppfTypes, onPpfTypeChange,
    interiorRows, onInteriorRowAdd, onInteriorRowUpdate, onInteriorRowDelete,
    displayedUnitPrice, editableUnitPrice, onUnitPriceChange, coefficientDisplay,
    vehicleCoefficientInput = "1.0", onVehicleCoefficientChange,
    combinedServiceAdjustment, onAddOrUpdate,
  } = props;

  if (ppfLocked) {
    return (
      <div className={CARD}>
        <h3 className={SECHDR}>PPF（ペイント プロテクション フィルム）</h3>
        <p className="text-xs text-slate-500 mt-3">
          {lockReason ?? `現在のショップランク（${shopRank}）では PPF は選択できません。`}
        </p>
      </div>
    );
  }

  const method = selectedInstallationMethod;
  const isPartial = method === "partial";
  const isInterior = method === "interior";
  // PPF type + unit price apply to full/partial/windshield/sunroof (not interior free rows).
  const showType = !!method && !isInterior;
  const usesR1Price = method === "full" || method === "partial";

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECHDR}>PPF（ペイント プロテクション フィルム）</h3>
        <span className="text-[10px] text-slate-500">ショップランク: {shopRank}</span>
      </div>

      <div className="flex flex-col gap-5">
        {/* 1) 施工方法（5モード）*/}
        <PpfInstallationMethodSelector methods={installationMethods} selected={method} onChange={onInstallationMethodChange} />

        {method === "full" && (
          <div>
            <span className="text-xs font-medium text-slate-300">施工範囲を選択</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <SelectButton
                selected={selectedFullCoverage === "front_full"}
                onSelect={() => onFullCoverageChange?.("front_full")}
              >
                フロントフル
              </SelectButton>
              <SelectButton
                selected={selectedFullCoverage === "full_body"}
                onSelect={() => onFullCoverageChange?.("full_body")}
              >
                フルボディ
              </SelectButton>
            </div>
          </div>
        )}

        {/* 2) 部分施工のみ部位選択（フル/ガラス/サンルーフでは非表示）*/}
        {isPartial && (
          <PpfPartialPartsSelector
            parts={partialParts}
            selectedIds={selectedPartialPartIds}
            quantitiesByPart={quantitiesByPart}
            onToggle={onPartialPartToggle}
            onQuantityChange={onQuantityChange}
          />
        )}

        {/* 室内PPF: 手入力行 */}
        {isInterior && (
          <InteriorPpfRows rows={interiorRows} onAdd={onInteriorRowAdd} onUpdate={onInteriorRowUpdate} onDelete={onInteriorRowDelete} />
        )}

        {/* フル/ガラス/サンルーフ: 部位セレクタは出さず、選択方法を明示 */}
        {method && !isPartial && !isInterior && (
          <p className="text-[11px] text-slate-400">
            選択中の施工方法：<span className="text-slate-200">{installationMethods.find((m) => m.id === method)?.label}</span>（部位選択は不要です）
          </p>
        )}

        {/* 3) PPF 種類（室内以外）*/}
        {showType && <PpfTypeSelector groups={ppfTypes} selectedId={selectedPpfTypeId} onChange={onPpfTypeChange} />}

        {/* 4) 店舗設定由来の 単価/係数 表示 + 編集可能単価（計算は親）*/}
        {showType && usesR1Price && (
          <div className="rounded-lg border border-slate-700/60 p-3 flex flex-col gap-2">
            <p className="text-xs text-slate-300">
              価格は、施工範囲の価格 × PPF施工係数 × 車格係数で自動計算されます。
            </p>
            <label className="text-xs text-slate-400">
              車格係数（通常車は1.0）
              <input
                type="number"
                inputMode="decimal"
                min="0.0001"
                step="0.01"
                value={vehicleCoefficientInput}
                onChange={(event) => onVehicleCoefficientChange?.(event.target.value)}
                className="mt-1 w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
              />
            </label>
            <p className="text-[10px] text-slate-500">
              輸入車・スーパーカーなど施工難易度が高い車両だけ調整してください。
            </p>
          </div>
        )}

        {showType && !usesR1Price && (
          <div className="rounded-lg border border-slate-700/60 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">店舗設定 単価（既定）</span>
              <span className="text-slate-200 tabular-nums">
                {displayedUnitPrice != null ? formatYen(displayedUnitPrice) : "—"}
              </span>
            </div>
            {coefficientDisplay && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">施工係数（表示のみ）</span>
                <span className="text-slate-200">{coefficientDisplay}</span>
              </div>
            )}
            {onUnitPriceChange && (
              <label className="text-xs text-slate-400">
                単価を上書き（任意・この値が親で単価として使われます）
                <input
                  type="number"
                  inputMode="numeric"
                  value={editableUnitPrice ?? ""}
                  onChange={(e) => onUnitPriceChange(e.target.value)}
                  placeholder={displayedUnitPrice != null ? String(displayedUnitPrice) : "単価"}
                  className="mt-1 w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                />
              </label>
            )}
          </div>
        )}

        {/* PPF + コーティング 減額（表示のみ・計算は本コンポーネント外）*/}
        {combinedServiceAdjustment && (
          <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3">
            <p className="text-[11px] text-emerald-300">{combinedServiceAdjustment}</p>
          </div>
        )}

        {/* 5) 追加/更新（コールバック契約のみ）*/}
        <div>
          <button
            type="button"
            onClick={onAddOrUpdate}
            disabled={!method}
            className={cn(
              "text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors",
            )}
          >
            明細に追加 / 更新
          </button>
          <p className="text-[10px] text-slate-600 mt-2">
            価格計算・係数適用・明細生成は親（既存ロジック）が担当します。本コンポーネントは選択と単価入力のみを扱います。
          </p>
        </div>
      </div>
    </div>
  );
}
