// DealerOS — Canonical Dealer Settings Default Values (PHASE71)
// These defaults mirror the hardcoded constants in EstimateWizard.tsx.
// They apply when:
//   - PHASE70 migration has not been applied (columns are absent)
//   - Columns exist but contain NULL (dealer has not configured settings)
// EstimateWizard.tsx continues to use its own hardcoded constants until
// a future phase wires it to read from here.

import type {
  CouponSetting,
  ServicePriceSettings,
  PpfPriceTables,
  ReminderTemplate,
  OcrPolicySettings,
} from "./dealer-settings-types";

// ─── Coupon defaults (matches EstimateWizard DEFAULT_COUPONS) ─────────────────

export const DEFAULT_COUPON_SETTINGS: CouponSetting[] = [
  { name: "新規ご来店クーポン",   amount: 5000  },
  { name: "リピーター割引",       amount: 3000  },
  { name: "紹介特典クーポン",     amount: 5000  },
  { name: "キャンペーンクーポン", amount: 10000 },
  { name: "スタッフ割引",         amount: 3000  },
];

// ─── OCR policy defaults ──────────────────────────────────────────────────────

export const DEFAULT_OCR_POLICY: OcrPolicySettings = {
  human_confirmation_required: true,
  allowed_formats:             ["jpeg", "jpg", "png", "pdf"],
  max_file_size_mb:            10,
};

// ─── Service price defaults (mirrors EstimateWizard constants) ────────────────

export const DEFAULT_SERVICE_PRICE_SETTINGS: ServicePriceSettings = {
  coating: {
    products: [
      { id: "cancoat-evo", name: "CanCoat EVO",          grade: "エントリー",   base_price_m: 55000,  certified_only: false, active: true },
      { id: "one-evo",     name: "ONE EVO",              grade: "エントリー",   base_price_m: 45000,  certified_only: false, active: true },
      { id: "pure-evo",    name: "PURE EVO",             grade: "スタンダード", base_price_m: 60000,  certified_only: false, active: true },
      { id: "mohs-evo",    name: "MOHS EVO",             grade: "スタンダード", base_price_m: 60000,  certified_only: false, active: true },
      { id: "syncro-evo",  name: "SYNCRO EVO",           grade: "プレミアム",   base_price_m: 110000, certified_only: false, active: true },
      { id: "infinit1",    name: "infinit Base Type 1",  grade: "CERTIFIED",    base_price_m: 130000, certified_only: true,  active: true },
      { id: "infinit2",    name: "infinit Base Type 2",  grade: "CERTIFIED",    base_price_m: 160000, certified_only: true,  active: true },
    ],
    size_multipliers: {
      SS: 0.75, S: 0.85, M: 1.0, ML: 1.15,
      L: 1.3,   LL: 1.5, XL: 1.7, XXL: 1.9,
    },
    topcoat_prices: {
      "one-evo":         15000,
      "pure-evo":        20000,
      "mohs-evo":        25000,
      "cancoat-evo":     18000,
      "cancoat-evo-pro": 25000,
      "infinit1":       130000,
      "infinit2":       160000,
      "infinit-t1":      40000,
      "infinit-t2":      50000,
    },
    option_prices: {
      "polish":        30000,
      "iron":           8000,
      "glass":         15000,
      "wheel":         18000,
      "interior":      20000,
      "leather-clean": 15000,
      "leather-coat":  18000,
      "headlight":     12000,
      "engine-clean":  20000,
      "engine-coat":   15000,
    },
    option_names: {
      "polish":        "ハードポリッシュ",
      "iron":          "鉄粉除去",
      "glass":         "ガラス撥水コート",
      "wheel":         "ホイールコーティング",
      "interior":      "室内クリーニング",
      "leather-clean": "レザークリーニング",
      "leather-coat":  "レザーコーティング",
      "headlight":     "ヘッドライトリペア",
      "engine-clean":  "エンジンルームクリーニング",
      "engine-coat":   "エンジンルームコーティング",
    },
  },

  ppf: {
    active: true,
    plan_labels: {
      "front-half": "フロントハーフ",
      "full-body":  "フルボディ",
      "partial":    "部分施工",
    },
  },

  window_film: {
    base_prices: {
      "wf-front-side": 25000,
      "wf-rear-side":  20000,
      "wf-rear":       18000,
      "wf-quarter":    12000,
      "wf-all":        80000,
    },
    grade_coeff: {
      "standard": 1.0,
      "premium":  1.3,
      "uv-cut":   1.1,
      "ir-cut":   1.2,
    },
  },

  maintenance: {
    menus: [
      { id: "A", name: "メンテナンスA", price: 0 },
      { id: "B", name: "メンテナンスB", price: 0 },
      { id: "C", name: "メンテナンスC", price: 0 },
      { id: "D", name: "メンテナンスD", price: 0 },
      { id: "E", name: "メンテナンスE", price: 0 },
    ],
  },

  carwash: {
    menus: [
      { id: "cw-hand",   name: "手洗い洗車",       price: 3000 },
      { id: "cw-polish", name: "ポリッシュ洗車",   price: 5000 },
      { id: "cw-coat",   name: "簡易コーティング", price: 8000 },
      { id: "cw-wax",    name: "ワックス仕上げ",   price: 5000 },
      { id: "cw-vacuum", name: "室内掃除機",        price: 2000 },
    ],
  },

  room_cleaning: {
    base_prices: {
      "rc-floor":   12000,
      "rc-seat":    15000,
      "rc-ceiling":  8000,
      "rc-dash":    10000,
      "rc-full":    45000,
    },
    condition_coeff: {
      "normal": 1.0,
      "dirty":  1.3,
      "heavy":  1.6,
    },
  },
};

// ─── PPF price table defaults (from dealer_settings_final_schema.md §9a) ──────

export const DEFAULT_PPF_PRICE_TABLES: PpfPriceTables = {
  plan_prices: {
    "front-half_SS":  130000, "front-half_S":  150000, "front-half_M":  170000,
    "front-half_ML":  195000, "front-half_L":  220000, "front-half_LL": 260000,
    "front-half_XL":  300000,
    "full-body_SS":   280000, "full-body_S":   320000, "full-body_M":   360000,
    "full-body_ML":   415000, "full-body_L":   470000, "full-body_LL":  550000,
    "full-body_XL":   650000,
    "roof_SS":         30000, "roof_S":         35000, "roof_M":         40000,
    "roof_ML":         45000, "roof_L":         52000, "roof_LL":        60000,
    "roof_XL":         70000,
  },
  film_coeff: {
    "clear":     1.0,
    "matte":     1.3,
    "color":     1.2,
    "self-heal": 1.1,
  },
  rank_coeff: {
    "std":     1.0,
    "premium": 1.3,
    "ultra":   1.6,
  },
  glass_prices: {
    "ppf": 80000,
    "tpu": 60000,
  },
  parts_prices: {
    "sp-headlight":  25000,
    "sp-b-pillar":   15000,
    "sp-c-pillar":   15000,
    "sp-mirror":     12000,
    "sp-step":       10000,
    "sp-rear-bump":  18000,
    "sp-door-cup":    8000,
    "sp-hood":       35000,
    "sp-door-edge":  12000,
  },
};

// ─── Reminder template defaults ───────────────────────────────────────────────

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplate[] = [
  { id: 1, name: "1ヶ月メンテナンス",  months_after: 1,  message: "", menus: [], enabled: false, repeat_yearly: false },
  { id: 2, name: "6ヶ月メンテナンス",  months_after: 6,  message: "", menus: [], enabled: false, repeat_yearly: false },
  { id: 3, name: "12ヶ月メンテナンス", months_after: 12, message: "", menus: [], enabled: true,  repeat_yearly: false },
];

// ─── Scalar defaults ──────────────────────────────────────────────────────────

export const DEFAULT_DETAILER_RANK      = "detailer" as const;
export const DEFAULT_DEALER_RATE        = 70;
export const DEFAULT_TAX_RATE           = 10;
export const DEFAULT_OCR_ENABLED        = true;
