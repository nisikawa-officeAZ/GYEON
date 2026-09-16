"use client";

// Step 5 — canonical-host adapter for the configured discount / coupon screen.
// Pricing stays in the existing authoritative hook; this adapter only projects canonical state
// and routes operator input through updateStore.

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Step5Discount as ConfiguredStep5Discount } from "../screens/Step5Discount";
import type { CouponOption } from "../screens/step-types";

export function Step5Discount({
  api, coupons, subtotal,
}: {
  api: EstimateWizardApi;
  coupons: readonly CouponOption[];
  subtotal: number | null;
}) {
  const { store, updateStore } = api;
  const nonCombinable = new Set(coupons.filter((coupon) => coupon.combinable === false).map((coupon) => coupon.id));
  const hasCombinableSelected = store.coupons.some((id) => !nonCombinable.has(id));
  const hasNonCombinableSelected = store.coupons.some((id) => nonCombinable.has(id));
  const disabledCouponIds = hasNonCombinableSelected
    ? coupons.filter((coupon) => !store.coupons.includes(coupon.id)).map((coupon) => coupon.id)
    : hasCombinableSelected
      ? coupons.filter((coupon) => nonCombinable.has(coupon.id) && !store.coupons.includes(coupon.id)).map((coupon) => coupon.id)
      : [];
  const disabledReasonByCoupon = Object.fromEntries(
    disabledCouponIds.map((id) => [id, "選択中のクーポンとは併用できません"]),
  );

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
      onCouponToggle={(id) => updateStore({
        coupons: store.coupons.includes(id)
          ? store.coupons.filter((couponId) => couponId !== id)
          : [...store.coupons, id],
      })}
    />
  );
}
