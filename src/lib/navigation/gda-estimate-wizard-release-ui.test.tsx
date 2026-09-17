import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Step5Discount } from "@/components/estimates/wizard/screens/Step5Discount";

(globalThis as { React?: typeof React }).React = React;

const read = (path: string) => readFileSync(path, "utf8");

test("Step 5 visibly orders coupon access immediately after no discount and renders configured coupons", () => {
  const html = renderToStaticMarkup(React.createElement(Step5Discount, {
    subtotal: 100_000,
    activeDiscountMode: "none",
    discountAmountValue: "",
    discountPercentValue: "",
    availableCoupons: [{
      id: "coupon-1",
      name: "新規ご来店クーポン",
      discountType: "amount",
      discountValue: 5_000,
      combinable: false,
    }],
    selectedCouponIds: [],
    onDiscountModeChange: () => {},
    onDiscountAmountChange: () => {},
    onDiscountPercentChange: () => {},
    onDiscountClear: () => {},
    onCouponToggle: () => {},
  }));

  const none = html.indexOf("値引きなし");
  const coupon = html.indexOf("クーポン値引き");
  const amount = html.indexOf("金額値引き");
  const percent = html.indexOf("％値引き");
  assert.ok(none >= 0 && none < coupon && coupon < amount && amount < percent);
  assert.match(html, /新規ご来店クーポン/);
  assert.match(html, /併用不可/);
  assert.doesNotMatch(html, /次へ進む/);
});

test("the canonical production host supplies authoritative coupons and nullable pricing without the stale Phase 2 notice", () => {
  const host = read("src/components/estimates/wizard/EstimateWizard.tsx");
  const adapter = read("src/components/estimates/wizard/steps/Step5Discount.tsx");

  assert.match(host, /<Step5Discount api=\{api\} coupons=\{screenConfig\.coupons\} subtotal=\{pricing\.subtotal\} \/>/);
  assert.match(adapter, /availableCoupons=\{\[\.\.\.coupons\]\}/);
  assert.match(adapter, /updateStore\(\{\s*coupons:/);
  assert.doesNotMatch(adapter, /PhaseTwoNotice/);
  assert.doesNotMatch(adapter, /calculateEstimateTotals|createClient|\.rpc\(|fetch\(/);
});
