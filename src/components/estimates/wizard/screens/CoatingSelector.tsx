"use client";

// Estimate Wizard Ver2.2 — Coating selection (Phase 4A, presentation-only).
//
// Selection order: layer count → 1st layer → 2nd layer (if 2/3) → 3rd layer (if 3) →
// add/update via callback. All choices are visual buttons (no pull-down). Available
// products and disabled states arrive via PROPS (owner derives them from the approved
// coating matrix + shop rank). This component computes NO prices and creates NO estimate
// line items — `onAddOrUpdate` is a callback the future parent wires to existing logic.

import { SelectButton } from "../foundation/SelectButton";
import { cn } from "../foundation/tokens";
import type { CoatingSelectorProps, CoatingProductOption, LayerCount } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

const LAYER_COUNTS: LayerCount[] = [1, 2, 3];

function ProductGroup({
  label,
  products,
  selectedId,
  onChange,
  disabled,
  disabledNote,
}: {
  label: string;
  products: CoatingProductOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
  disabled: boolean;
  disabledNote?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("text-xs font-medium", disabled ? "text-slate-600" : "text-slate-300")}>{label}</span>
        {disabled && disabledNote && <span className="text-[10px] text-slate-500">（{disabledNote}）</span>}
      </div>
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2", disabled && "opacity-50 pointer-events-none")}>
        {products.length === 0 && !disabled && (
          <p className="text-[11px] text-slate-500">選択可能な製品がありません。</p>
        )}
        {products.map((p) => (
          <SelectButton
            key={p.id}
            selected={!disabled && selectedId === p.id}
            disabled={disabled || p.disabled}
            subLabel={p.disabled ? p.disabledReason : undefined}
            onSelect={() => onChange(p.id)}
          >
            {p.label}
          </SelectButton>
        ))}
      </div>
    </div>
  );
}

export function CoatingSelector(props: CoatingSelectorProps) {
  const {
    shopRank, coatingLocked, lockReason,
    selectedLayerCount, selectedLayer1ProductId, selectedLayer2ProductId, selectedLayer3ProductId,
    availableLayer1Products, availableLayer2Products, availableLayer3Products,
    onLayerCountChange, onLayer1Change, onLayer2Change, onLayer3Change, onAddOrUpdate,
  } = props;

  // Rank-level lock (e.g. GYEON PPFインストーラー): whole section greyed out.
  if (coatingLocked) {
    return (
      <div className={CARD}>
        <h3 className={SECHDR}>コーティング</h3>
        <p className="text-xs text-slate-500 mt-3">
          {lockReason ?? `現在のショップランク（${shopRank}）ではコーティングは選択できません。`}
        </p>
      </div>
    );
  }

  const count = selectedLayerCount ?? 0;
  const layer2Disabled = count < 2;
  // Layer 3 is disabled when count < 3 OR the chosen 1st-layer has no approved 3rd layer.
  const layer3NoOptions = availableLayer3Products.length === 0;
  const layer3Disabled = count < 3 || layer3NoOptions;

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECHDR}>コーティング</h3>
        <span className="text-[10px] text-slate-500">ショップランク: {shopRank}</span>
      </div>

      {/* 1) レイヤー数（先に選択・ボタンのみ）*/}
      <div className="mb-4">
        <span className="text-xs font-medium text-slate-300">レイヤー数</span>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {LAYER_COUNTS.map((n) => (
            <SelectButton key={n} selected={selectedLayerCount === n} onSelect={() => onLayerCountChange(n)} density="touch">
              {n}層
            </SelectButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 2) 1層目 */}
        <ProductGroup
          label="1層目のコーティング"
          products={availableLayer1Products}
          selectedId={selectedLayer1ProductId}
          onChange={onLayer1Change}
          disabled={false}
        />

        {/* 3) 2層目（1層選択時はグレーアウト）*/}
        <ProductGroup
          label="2層目のコーティング"
          products={availableLayer2Products}
          selectedId={selectedLayer2ProductId}
          onChange={onLayer2Change}
          disabled={layer2Disabled || !selectedLayer1ProductId}
          disabledNote={layer2Disabled ? "1層を選択中" : !selectedLayer1ProductId ? "1層目を先に選択" : undefined}
        />

        {/* 4) 3層目（2層以下、または3層目が無い製品はグレーアウト）*/}
        <ProductGroup
          label="3層目のコーティング"
          products={availableLayer3Products}
          selectedId={selectedLayer3ProductId}
          onChange={onLayer3Change}
          disabled={layer3Disabled || !selectedLayer1ProductId}
          disabledNote={
            count < 3 ? "3層以外を選択中" : layer3NoOptions ? "この製品に3層目はありません" : !selectedLayer1ProductId ? "1層目を先に選択" : undefined
          }
        />
      </div>

      {/* 5) 追加/更新（コールバック契約のみ・価格計算なし）*/}
      <div className="mt-5">
        <button
          type="button"
          onClick={onAddOrUpdate}
          disabled={!selectedLayer1ProductId}
          className="text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
        >
          明細に追加 / 更新
        </button>
        <p className="text-[10px] text-slate-600 mt-2">
          金額計算・明細生成は親（既存ロジック）が担当します。本コンポーネントは選択のみを扱います。
        </p>
      </div>
    </div>
  );
}
