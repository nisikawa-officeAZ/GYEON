"use client";

// Estimate Wizard Ver2.2 — Discount mode selector (Phase 5, presentation-only).
//
// 金額 / % の二者択一（同時適用なし）。可視トグルボタン（プルダウンなし）。% モードでは親から
// 供給された換算円（convertedDiscountAmount）を確認用に表示するのみ — このコンポーネントは
// 価格計算・税計算・合計計算を一切行わず、pricing engine を作らない。値引き上限 / % 範囲は
// props 由来（ハードコードしない）。値の解釈・discountAmount への統合は親（既存フロー）が担当。

import { formatYen, cn } from "../foundation/tokens";
import type { DiscountMode } from "./step-types";

const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";
const INPUT =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex-1 min-h-[44px] rounded-lg border text-sm font-medium transition-colors",
        active
          ? "bg-blue-950/40 border-[#1d4ed8] text-slate-100"
          : "bg-[#0f172a] border-slate-700 text-slate-300 hover:border-slate-500",
      )}
    >
      {label}
    </button>
  );
}

export function DiscountModeSelector(props: {
  subtotal: number;
  activeDiscountMode: DiscountMode;
  discountAmountValue: string;
  discountPercentValue: string;
  convertedDiscountAmount?: number | null;
  maximumDiscountAmount?: number | null;
  minimumDiscountPercent?: number;
  maximumDiscountPercent?: number;
  discountValidationMessage?: string | null;
  onDiscountModeChange: (m: DiscountMode) => void;
  onDiscountAmountChange: (v: string) => void;
  onDiscountPercentChange: (v: string) => void;
  onDiscountClear: () => void;
}) {
  const {
    subtotal, activeDiscountMode, discountAmountValue, discountPercentValue,
    convertedDiscountAmount, maximumDiscountAmount, minimumDiscountPercent, maximumDiscountPercent,
    discountValidationMessage, onDiscountModeChange, onDiscountAmountChange, onDiscountPercentChange, onDiscountClear,
  } = props;

  const isNone = activeDiscountMode === "none";
  const isAmount = activeDiscountMode === "amount";
  const isPercent = activeDiscountMode === "percent";

  // Lightweight DISPLAY-only validation (bounds come from props; not a pricing engine).
  // When mode is `none`, NO amount/percentage validation runs.
  const amountNum = Number(discountAmountValue);
  const pctNum = Number(discountPercentValue);
  const localWarnings: string[] = [];
  if (isAmount && discountAmountValue !== "" && Number.isFinite(amountNum)) {
    if (amountNum > subtotal) localWarnings.push("値引き額が小計を超えています。");
    if (maximumDiscountAmount != null && amountNum > maximumDiscountAmount) {
      localWarnings.push(`最大値引き額（${formatYen(maximumDiscountAmount)}）を超えています。`);
    }
  }
  if (isPercent && discountPercentValue !== "" && Number.isFinite(pctNum)) {
    if (minimumDiscountPercent != null && pctNum < minimumDiscountPercent) localWarnings.push(`最小 ${minimumDiscountPercent}% を下回っています。`);
    if (maximumDiscountPercent != null && pctNum > maximumDiscountPercent) localWarnings.push(`最大 ${maximumDiscountPercent}% を超えています。`);
  }

  // `none` => no active discount (hasDiscount false); otherwise the active mode's value.
  const hasDiscount = isNone ? false : (isAmount ? discountAmountValue : discountPercentValue) !== "";

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className={SECHDR}>値引き</h3>
        <span className="text-[11px] text-slate-500">小計 {formatYen(subtotal)}</span>
      </div>

      {/* モード切替（値引きなし / 金額 / ％ の三者択一・同時適用なし・プルダウンなし）*/}
      <div className="flex gap-2 mt-3">
        <ModeButton active={isNone} label="値引きなし" onClick={() => onDiscountModeChange("none")} />
        <ModeButton active={isAmount} label="金額値引き" onClick={() => onDiscountModeChange("amount")} />
        <ModeButton active={isPercent} label="％値引き" onClick={() => onDiscountModeChange("percent")} />
      </div>

      {/* アクティブモードの入力のみ（none は入力なし）*/}
      <div className="mt-3">
        {isNone ? null : isAmount ? (
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">値引き額</span>
            <input
              type="number"
              inputMode="numeric"
              value={discountAmountValue}
              onChange={(e) => onDiscountAmountChange(e.target.value)}
              placeholder="0"
              className={`${INPUT} flex-1 text-right`}
            />
            <span className="text-xs text-slate-500">円</span>
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-16">値引き率</span>
              <input
                type="number"
                inputMode="numeric"
                value={discountPercentValue}
                onChange={(e) => onDiscountPercentChange(e.target.value)}
                placeholder="0"
                className={`${INPUT} flex-1 text-right`}
              />
              <span className="text-xs text-slate-500">%</span>
            </label>
            {/* 換算円プレビュー（親から供給・確認用のみ）*/}
            {convertedDiscountAmount != null && (
              <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">換算値引き額（親供給・確認用）</span>
                <span className="text-sm text-slate-100 tabular-nums">− {formatYen(convertedDiscountAmount)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 現在適用中の値引き表示 */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          適用中: {hasDiscount ? (isAmount ? `${formatYen(Number(discountAmountValue) || 0)}` : `${discountPercentValue || 0}%`) : "なし"}
        </span>
        <button
          type="button"
          onClick={onDiscountClear}
          disabled={!hasDiscount}
          className="text-[11px] text-slate-400 border border-slate-700 hover:border-slate-500 disabled:opacity-40 px-3 min-h-[36px] rounded-lg transition-colors"
        >
          値引きをクリア
        </button>
      </div>

      {/* バリデーションメッセージ領域（親供給 + 表示用ローカル境界チェック）*/}
      {(discountValidationMessage || localWarnings.length > 0) && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex flex-col gap-1">
          {discountValidationMessage && <p className="text-[11px] text-amber-300">{discountValidationMessage}</p>}
          {localWarnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-300/90">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
