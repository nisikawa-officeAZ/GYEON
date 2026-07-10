"use client";

// Estimate Wizard Ver2.2 — Screen5 (値引き・クーポン選択) container (Phase 5, presentation-only).
//
// Composes the discount-mode selector + coupon selector + parent-supplied conflict / dealer-rate
// messages. Fully prop-driven: computes NO estimate totals / tax, applies no discount to prices,
// mutates no EstimateEditor state, calls no Server Actions, touches no DB / coupon master /
// customer data. Discount + coupon may be used together unless the parent supplies a restriction
// (surfaced as informational messages / disabled coupon state). One responsive implementation;
// no pull-down menus; no swipe. Continue uses a button (does not trigger the unsaved guard).

import { DiscountModeSelector } from "./DiscountModeSelector";
import { CouponSelector } from "./CouponSelector";
import type { Step5DiscountProps } from "./step-types";

export function Step5Discount(props: Step5DiscountProps) {
  const {
    subtotal, activeDiscountMode, discountAmountValue, discountPercentValue, convertedDiscountAmount,
    maximumDiscountAmount, minimumDiscountPercent, maximumDiscountPercent,
    availableCoupons, selectedCouponIds, disabledCouponIds, disabledReasonByCoupon,
    informationalMessages, discountValidationMessage,
    onDiscountModeChange, onDiscountAmountChange, onDiscountPercentChange, onDiscountClear,
    onCouponToggle, onContinue,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <DiscountModeSelector
        subtotal={subtotal}
        activeDiscountMode={activeDiscountMode}
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
      />

      <CouponSelector
        availableCoupons={availableCoupons}
        selectedCouponIds={selectedCouponIds}
        disabledCouponIds={disabledCouponIds}
        disabledReasonByCoupon={disabledReasonByCoupon}
        onCouponToggle={onCouponToggle}
      />

      {/* 親から供給される併用制限 / 掛け率 / 最大値引きなどのメッセージ（発明しない）*/}
      {informationalMessages && informationalMessages.length > 0 && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">お知らせ（親供給）</span>
          {informationalMessages.map((m, i) => (
            <p key={i} className="text-[11px] text-slate-300">{m}</p>
          ))}
        </div>
      )}

      <div>
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
      </div>
    </div>
  );
}
