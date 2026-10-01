"use client";

// Estimate Wizard Ver2.2 — Screen5 (値引き・クーポン選択) container (Phase 5, presentation-only).
//
// Composes the discount-mode selector + coupon selector + parent-supplied conflict / dealer-rate
// messages. Fully prop-driven: computes NO estimate totals / tax, applies no discount to prices,
// mutates no EstimateEditor state, calls no Server Actions, touches no DB / coupon master /
// customer data. Discount + coupon may be used together unless the parent supplies a restriction
// (surfaced as informational messages / disabled coupon state). One responsive implementation;
// no pull-down menus; no swipe. Continue uses a button (does not trigger the unsaved guard).

import { useRef } from "react";
import { DiscountModeSelector } from "./DiscountModeSelector";
import { CouponSelector } from "./CouponSelector";
import type { Step5DiscountProps } from "./step-types";

/**
 * GDA-ESTIMATE-WIZARD-10-STEP-R1 zero-line lock (presentation only). Supplied by the canonical host
 * adapter when the authoritative pricing result carries no work line: the discount inputs are
 * rendered inside a disabled fieldset, every coupon arrives already disabled with a reason, and the
 * only enabled control is an explicit clear action for any stale authored value. No total is
 * computed or changed here.
 */
export type Step5ZeroLineLock = {
  message: string;
  hasAuthoredValues: boolean;
  onClear: () => void;
};

export function Step5Discount(props: Step5DiscountProps & { zeroLineLock?: Step5ZeroLineLock | null }) {
  const {
    subtotal, activeDiscountMode, discountAmountValue, discountPercentValue, convertedDiscountAmount,
    maximumDiscountAmount, minimumDiscountPercent, maximumDiscountPercent,
    availableCoupons, selectedCouponIds, disabledCouponIds, disabledReasonByCoupon,
    informationalMessages, discountValidationMessage,
    onDiscountModeChange, onDiscountAmountChange, onDiscountPercentChange, onDiscountClear,
    onCouponToggle, onContinue, zeroLineLock,
  } = props;
  const couponSectionRef = useRef<HTMLDivElement>(null);
  const locked = zeroLineLock != null;

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <div data-testid="discount-zero-line-lock" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 flex flex-col gap-2">
          <p className="text-[11px] text-amber-300">{zeroLineLock.message}</p>
          {zeroLineLock.hasAuthoredValues && (
            <button
              type="button"
              data-testid="discount-zero-line-clear"
              onClick={zeroLineLock.onClear}
              className="self-start text-[11px] text-slate-200 border border-amber-500/40 hover:border-amber-400 px-3 min-h-[36px] rounded-lg transition-colors"
            >
              値引き・クーポンをクリア
            </button>
          )}
        </div>
      )}
      <fieldset disabled={locked} aria-disabled={locked} className={locked ? "opacity-60 min-w-0 border-0 p-0 m-0" : "min-w-0 border-0 p-0 m-0"}>
      <DiscountModeSelector
        subtotal={subtotal}
        activeDiscountMode={activeDiscountMode}
        couponSelectionActive={selectedCouponIds.length > 0}
        discountAmountValue={discountAmountValue}
        discountPercentValue={discountPercentValue}
        convertedDiscountAmount={convertedDiscountAmount}
        maximumDiscountAmount={maximumDiscountAmount}
        minimumDiscountPercent={minimumDiscountPercent}
        maximumDiscountPercent={maximumDiscountPercent}
        discountValidationMessage={discountValidationMessage}
        onDiscountModeChange={onDiscountModeChange}
        onDiscountAmountChange={onDiscountAmountChange}
        onDiscountPercentChange={onDiscountPercentChange}
        onDiscountClear={onDiscountClear}
        onCouponSelectionRequest={() => couponSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />
      </fieldset>

      <div ref={couponSectionRef} className="scroll-mt-4">
        <CouponSelector
          availableCoupons={availableCoupons}
          selectedCouponIds={selectedCouponIds}
          disabledCouponIds={disabledCouponIds}
          disabledReasonByCoupon={disabledReasonByCoupon}
          onCouponToggle={onCouponToggle}
        />
      </div>

      {/* 親から供給される併用制限 / 掛け率 / 最大値引きなどのメッセージ（発明しない）*/}
      {informationalMessages && informationalMessages.length > 0 && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">お知らせ（親供給）</span>
          {informationalMessages.map((m, i) => (
            <p key={i} className="text-[11px] text-slate-300">{m}</p>
          ))}
        </div>
      )}

      {onContinue && <div>
        <button
          type="button"
          onClick={onContinue}
          className="text-sm font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-4 min-h-[44px] rounded-lg transition-colors"
        >
          次へ進む
        </button>
        <p className="text-[10px] text-slate-600 mt-2">
          合計・税・値引き反映は親（既存ロジック）が担当します。本画面は入力と選択のみを扱います。
        </p>
      </div>}
    </div>
  );
}
