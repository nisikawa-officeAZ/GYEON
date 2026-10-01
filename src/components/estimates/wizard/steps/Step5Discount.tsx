"use client";

// Step 5 — canonical-host adapter for the configured discount / coupon screen.
// Pricing stays in the existing authoritative hook; this adapter only projects canonical state
// and routes operator input through updateStore.
//
// GDA-ESTIMATE-WIZARD-10-STEP-R1 zero-line policy: when the authoritative pricing result carries no
// work line, authored discounts and coupons are unavailable — every coupon is disabled with a reason
// and the discount inputs are locked. The server save boundary rejects them independently. Nothing is
// auto-cleared: a stale authored value stays visible, blocks the save with its reason, and can be
// removed only by the operator's explicit clear action.

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Step5Discount as ConfiguredStep5Discount } from "../screens/Step5Discount";
import type { CouponOption } from "../screens/step-types";

export const ZERO_LINE_DISCOUNT_LOCK_MESSAGE =
  "作業明細がないため値引き・クーポンは選択できません。先に作業内容を選択し、価格を確定してください。";

export function Step5Discount({
  api, coupons, subtotal, hasLines,
}: {
  api: EstimateWizardApi;
  coupons: readonly CouponOption[];
  subtotal: number | null;
  /** True when the authoritative pricing result carries at least one work line. */
  hasLines: boolean;
}) {
  const { store, updateStore } = api;
  const nonCombinable = new Set(coupons.filter((coupon) => coupon.combinable === false).map((coupon) => coupon.id));
  const hasCombinableSelected = store.coupons.some((id) => !nonCombinable.has(id));
  const hasNonCombinableSelected = store.coupons.some((id) => nonCombinable.has(id));
  const combinabilityDisabledIds = hasNonCombinableSelected
    ? coupons.filter((coupon) => !store.coupons.includes(coupon.id)).map((coupon) => coupon.id)
    : hasCombinableSelected
      ? coupons.filter((coupon) => nonCombinable.has(coupon.id) && !store.coupons.includes(coupon.id)).map((coupon) => coupon.id)
      : [];
  const zeroLineLocked = !hasLines;
  const disabledCouponIds = zeroLineLocked ? coupons.map((coupon) => coupon.id) : combinabilityDisabledIds;
  const disabledReasonByCoupon = Object.fromEntries(
    disabledCouponIds.map((id) => [id, zeroLineLocked ? "作業明細がないため選択できません" : "選択中のクーポンとは併用できません"]),
  );
  const hasAuthoredValues =
    store.discountMode !== "none" || store.discountAmount.trim() !== "" || store.discountPercent.trim() !== "" || store.coupons.length > 0;

  return (
    <ConfiguredStep5Discount
      subtotal={subtotal}
      activeDiscountMode={store.discountMode}
      discountAmountValue={store.discountAmount}
      discountPercentValue={store.discountPercent}
      convertedDiscountAmount={null}
      maximumDiscountAmount={null}
      minimumDiscountPercent={0}
      maximumDiscountPercent={100}
      availableCoupons={[...coupons]}
      selectedCouponIds={store.coupons}
      disabledCouponIds={disabledCouponIds}
      disabledReasonByCoupon={disabledReasonByCoupon}
      informationalMessages={[]}
      discountValidationMessage={null}
      onDiscountModeChange={(discountMode) => updateStore({ discountMode })}
      onDiscountAmountChange={(discountAmount) => updateStore({ discountAmount })}
      onDiscountPercentChange={(discountPercent) => updateStore({ discountPercent })}
      onDiscountClear={() => updateStore({ discountMode: "none", discountAmount: "", discountPercent: "" })}
      onCouponToggle={(id) => {
        if (zeroLineLocked) return; // locked: no coupon may be selected on a zero-line estimate
        updateStore({
          coupons: store.coupons.includes(id)
            ? store.coupons.filter((couponId) => couponId !== id)
            : [...store.coupons, id],
        });
      }}
      zeroLineLock={zeroLineLocked ? {
        message: ZERO_LINE_DISCOUNT_LOCK_MESSAGE,
        hasAuthoredValues,
        // ONE explicit operator action clears every authored discount/coupon value at once.
        onClear: () => updateStore({ discountMode: "none", discountAmount: "", discountPercent: "", coupons: [] }),
      } : null}
    />
  );
}
