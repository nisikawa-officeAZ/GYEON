// Estimate Wizard Ver2.2 — Discount / Coupon presentation configuration (Phase 5).
//
// EXAMPLE coupons for the PREVIEW only — the real coupon source is connected later through
// props (existing coupon backend is NOT modified here). `discountType`/`discountValue` are
// display data; the component never applies them. Combinability / conflict is decided by the
// parent and supplied via disabled state. NO price calculation. Do not treat as a fixed master.

import type { CouponOption } from "./step-types";

export const EXAMPLE_COUPONS: CouponOption[] = [
  { id: "cp-new",     name: "新規ご成約クーポン", description: "初回ご利用の方", discountType: "amount",  discountValue: 5000,  validityText: "初回のみ",       displayOrder: 1, combinable: true,  badge: "新規" },
  { id: "cp-line",    name: "LINE友だち割",       description: "LINE連携特典",   discountType: "percent", discountValue: 5,     validityText: "友だち登録者",   displayOrder: 2, combinable: true },
  { id: "cp-season",  name: "季節キャンペーン",   description: "期間限定",       discountType: "percent", discountValue: 10,    validityText: "〜今月末",       displayOrder: 3, combinable: false, badge: "併用不可" },
  { id: "cp-repeat",  name: "リピーター割",       description: "2回目以降",     discountType: "amount",  discountValue: 3000,  validityText: "リピーター",     displayOrder: 4, combinable: true },
  { id: "cp-referral",name: "紹介クーポン",       description: "ご紹介特典",     discountType: "amount",  discountValue: 8000,  validityText: "紹介経由",       displayOrder: 5, combinable: true },
];
