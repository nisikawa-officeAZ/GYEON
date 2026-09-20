import type { WizardSettingsItemView } from "@/lib/wizard-catalog/estimate-wizard-settings-types";

type ItemValueLabelInput = Pick<
  WizardSettingsItemView,
  "kind" | "coupon" | "priceLabelJa"
>;

/**
 * Returns the authored monetary label shown in the settings item list.
 *
 * Coupons deliberately have no `default_unit_price`, so their normal
 * `priceLabelJa` is null. Their value lives in the coupon rule instead.
 */
export function getWizardSettingsItemValueLabel(item: ItemValueLabelInput): string {
  if (item.kind === "coupon") {
    return item.coupon?.discountLabelJa ?? "割引内容未設定";
  }

  return item.priceLabelJa ?? "価格なし";
}
