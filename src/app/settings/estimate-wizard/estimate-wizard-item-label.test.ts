import assert from "node:assert/strict";
import test from "node:test";

import { getWizardSettingsItemValueLabel } from "./estimate-wizard-item-label";

test("coupon list items show their authored amount instead of the unit-price fallback", () => {
  assert.equal(
    getWizardSettingsItemValueLabel({
      kind: "coupon",
      priceLabelJa: null,
      coupon: {
        discountType: "amount",
        discountValue: 5000,
        discountLabelJa: "¥5,000引き",
        combinable: true,
        combinableLabelJa: "併用可",
        validFrom: null,
        validTo: null,
        validityLabelJa: "期限なし",
      },
    }),
    "¥5,000引き",
  );
});

test("coupon list items show their authored percentage", () => {
  assert.equal(
    getWizardSettingsItemValueLabel({
      kind: "coupon",
      priceLabelJa: null,
      coupon: {
        discountType: "percent",
        discountValue: 10,
        discountLabelJa: "10%引き",
        combinable: false,
        combinableLabelJa: "併用不可",
        validFrom: "2026-09-20",
        validTo: "2026-09-20",
        validityLabelJa: "2026-09-20 〜 2026-09-20",
      },
    }),
    "10%引き",
  );
});

test("malformed coupons fail closed without being described as price-less", () => {
  assert.equal(
    getWizardSettingsItemValueLabel({
      kind: "coupon",
      priceLabelJa: null,
      coupon: null,
    }),
    "割引内容未設定",
  );
});

test("non-coupon list items keep their existing unit-price labels", () => {
  assert.equal(
    getWizardSettingsItemValueLabel({
      kind: "maintenance_menu",
      priceLabelJa: "¥12,000",
      coupon: null,
    }),
    "¥12,000",
  );
  assert.equal(
    getWizardSettingsItemValueLabel({
      kind: "other_work_preset",
      priceLabelJa: null,
      coupon: null,
    }),
    "価格なし",
  );
});
