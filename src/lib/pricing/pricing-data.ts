import { EstimateCategory } from "../estimates/estimate-types";

// ── Body sizes ────────────────────────────────────────────────────────────────

export const BODY_SIZES: { key: string; name: string; multi: number }[] = [
  { key: "SS",  name: "軽自動車",       multi: 0.75 },
  { key: "S",   name: "コンパクト",     multi: 0.85 },
  { key: "M",   name: "セダン / HB",   multi: 1.0  },
  { key: "ML",  name: "ミニバン S",    multi: 1.15 },
  { key: "L",   name: "ミニバン L",    multi: 1.3  },
  { key: "LL",  name: "SUV / 大型",    multi: 1.5  },
  { key: "XL",  name: "高級大型",       multi: 1.7  },
  { key: "XXL", name: "プレミアムカー", multi: 1.9  },
];

// ── Coating products ──────────────────────────────────────────────────────────

export const COATINGS = [
  { id: "cancoat-evo", name: "CanCoat EVO",        grade: "エントリー",   base: 55000,  certOnly: false },
  { id: "one-evo",     name: "ONE EVO",             grade: "エントリー",   base: 45000,  certOnly: false },
  { id: "pure-evo",    name: "PURE EVO",            grade: "スタンダード", base: 60000,  certOnly: false },
  { id: "mohs-evo",    name: "MOHS EVO",            grade: "スタンダード", base: 60000,  certOnly: false },
  { id: "syncro-evo",  name: "SYNCRO EVO",          grade: "プレミアム",   base: 110000, certOnly: false },
  { id: "infinit1",    name: "infinit Base Type 1", grade: "CERTIFIED",    base: 130000, certOnly: true  },
  { id: "infinit2",    name: "infinit Base Type 2", grade: "CERTIFIED",    base: 160000, certOnly: true  },
] as const;

export type CoatingId = typeof COATINGS[number]["id"];

export const TOPCOAT_BASE: Record<string, number> = {
  "one-evo": 15000, "pure-evo": 20000, "mohs-evo": 25000,
  "cancoat-evo": 18000, "cancoat-evo-pro": 25000,
  "infinit1": 130000, "infinit2": 160000, "infinit-t1": 40000, "infinit-t2": 50000,
};

export const TOPCOAT_NAME: Record<string, string> = {
  "one-evo": "ONE EVO", "pure-evo": "PURE EVO", "mohs-evo": "MOHS EVO",
  "cancoat-evo": "CanCoat EVO", "cancoat-evo-pro": "CanCoat EVO PRO",
  "infinit1": "infinit Base Type 1",     "infinit2": "infinit Base Type 2",
  "infinit-t1": "infinit TopCoat Type 1", "infinit-t2": "infinit TopCoat Type 2",
};

export const COATING_OPTIONS: { id: string; name: string; price: number; cat: EstimateCategory }[] = [
  { id: "polish",        name: "ハードポリッシュ",           price: 30000, cat: "coating"  },
  { id: "iron",          name: "鉄粉除去",                   price: 8000,  cat: "coating"  },
  { id: "glass",         name: "ガラス撥水コート",           price: 15000, cat: "glass"    },
  { id: "wheel",         name: "ホイールコーティング",       price: 18000, cat: "coating"  },
  { id: "interior",      name: "室内クリーニング",           price: 20000, cat: "interior" },
  { id: "leather-clean", name: "レザークリーニング",         price: 15000, cat: "interior" },
  { id: "leather-coat",  name: "レザーコーティング",         price: 18000, cat: "interior" },
  { id: "headlight",     name: "ヘッドライトリペア",         price: 12000, cat: "other"    },
  { id: "engine-clean",  name: "エンジンルームクリーニング", price: 20000, cat: "other"    },
  { id: "engine-coat",   name: "エンジンルームコーティング", price: 15000, cat: "other"    },
];

// ── Maintenance ───────────────────────────────────────────────────────────────

export const MAINTENANCE_MENUS: { id: string; name: string; price: number }[] = [
  { id: "A", name: "メンテナンスA", price: 0 },
  { id: "B", name: "メンテナンスB", price: 0 },
  { id: "C", name: "メンテナンスC", price: 0 },
  { id: "D", name: "メンテナンスD", price: 0 },
  { id: "E", name: "メンテナンスE", price: 0 },
];

// ── Carwash ───────────────────────────────────────────────────────────────────

export const CARWASH_MENUS: { id: string; name: string; price: number }[] = [
  { id: "cw-hand",   name: "手洗い洗車",       price: 3000 },
  { id: "cw-polish", name: "ポリッシュ洗車",   price: 5000 },
  { id: "cw-coat",   name: "簡易コーティング", price: 8000 },
  { id: "cw-wax",    name: "ワックス仕上げ",   price: 5000 },
  { id: "cw-vacuum", name: "室内掃除機",        price: 2000 },
];

// ── Room cleaning ─────────────────────────────────────────────────────────────

export const ROOM_CLEAN_PARTS: { id: string; name: string; basePrice: number }[] = [
  { id: "rc-floor",   name: "フロア",         basePrice: 12000 },
  { id: "rc-seat",    name: "シート",         basePrice: 15000 },
  { id: "rc-ceiling", name: "天井",           basePrice:  8000 },
  { id: "rc-dash",    name: "ダッシュボード", basePrice: 10000 },
  { id: "rc-full",    name: "フルパッケージ", basePrice: 45000 },
];

export const ROOM_CLEAN_CONDITIONS: { id: string; label: string; coeff: number }[] = [
  { id: "normal", label: "通常",    coeff: 1.0 },
  { id: "dirty",  label: "汚れあり", coeff: 1.3 },
  { id: "heavy",  label: "重度汚れ", coeff: 1.6 },
];

// ── Window film ───────────────────────────────────────────────────────────────

export const WINDOW_FILM_PARTS: { id: string; name: string; basePrice: number }[] = [
  { id: "wf-front-side", name: "フロントサイド",   basePrice: 25000 },
  { id: "wf-rear-side",  name: "リアサイド",       basePrice: 20000 },
  { id: "wf-rear",       name: "リアウィンドウ",   basePrice: 18000 },
  { id: "wf-quarter",    name: "クォーター",       basePrice: 12000 },
  { id: "wf-all",        name: "全窓一括",         basePrice: 80000 },
];

export const WINDOW_FILM_GRADES: { id: string; name: string; coeff: number }[] = [
  { id: "standard", name: "スタンダード", coeff: 1.0 },
  { id: "premium",  name: "プレミアム",   coeff: 1.3 },
  { id: "uv-cut",   name: "UVカット",    coeff: 1.1 },
  { id: "ir-cut",   name: "IRカット",    coeff: 1.2 },
];

// ── PPF ───────────────────────────────────────────────────────────────────────

export const PPF_PLANS: { id: string; name: string; desc: string }[] = [
  { id: "front-half", name: "フロントフル",  desc: "ボンネット・フロントフェンダー・ドアミラー・バンパー" },
  // ↑ OD-10: name may change to "フロントハーフ" after operator session
  { id: "full-body",  name: "フルボディ",   desc: "全パネル施工" },
];

// Flat price table — absolute values per plan × size (not multipliers).
// OD-2: prices from canonical spec. OD-15: XXL fallback = XL price.
export const PPF_PLAN_PRICES: Record<string, Record<string, number>> = {
  "front-half": {
    SS: 130000, S: 150000, M: 170000, ML: 180000,
    L:  190000, LL: 220000, XL: 260000, XXL: 260000,
  },
  "full-body": {
    SS: 250000, S: 290000, M: 330000, ML: 350000,
    L:  370000, LL: 430000, XL: 520000, XXL: 520000,
  },
};

export const PPF_FILM_TYPES: { id: string; name: string; coeff: number }[] = [
  { id: "clear",  name: "クリア",   coeff: 1.0 },
  { id: "matte",  name: "マット",   coeff: 1.3 },
  { id: "carbon", name: "カーボン", coeff: 1.5 }, // OD-4: verify canonical
  { id: "color",  name: "カラー",   coeff: 1.8 }, // OD-4: coeff was 1.2 in impl
];

// OD-3: 4-rank system (canonical). Previous impl had 3 ranks.
export const PPF_VEHICLE_RANKS: { id: string; name: string; coeff: number }[] = [
  { id: "std",     name: "スタンダード",   coeff: 1.0 },
  { id: "premium", name: "プレミアム",     coeff: 1.3 },
  { id: "upper",   name: "アッパー",       coeff: 1.5 },
  { id: "luxury",  name: "ラグジュアリー", coeff: 1.8 },
];

export const PPF_RANK_AUTO_DETECT: { rank: string; makers: string[] }[] = [
  { rank: "luxury",  makers: ["フェラーリ", "ランボルギーニ", "マクラーレン", "ベントレー", "ロールスロイス", "マセラティ", "アストンマーチン"] },
  { rank: "upper",   makers: ["BMW", "メルセデス", "Mercedes", "アウディ", "Audi", "VW", "フォルクスワーゲン", "ポルシェ", "ランドローバー", "ボルボ", "ジャガー", "テスラ", "Tesla", "レクサス"] },
  { rank: "premium", makers: ["トヨタ", "Toyota", "日産", "Nissan", "ホンダ", "Honda", "マツダ", "Mazda", "スバル", "Subaru", "三菱", "Mitsubishi", "スズキ", "ダイハツ"] },
];

export function detectPpfRank(maker: string): string {
  if (!maker) return "std";
  const normalized = maker.trim().toLowerCase();
  for (const group of PPF_RANK_AUTO_DETECT) {
    if (group.makers.some(m => normalized.includes(m.toLowerCase()))) return group.rank;
  }
  return "std";
}

export const PPF_FRONT_GLASS: { id: string; name: string; price: number }[] = [
  { id: "ppf", name: "PPFフィルム貼り", price: 80000 },
  { id: "tpu", name: "TPUフィルム貼り", price: 60000 },
];

export const PPF_SINGLE_PARTS: { id: string; name: string; price: number; maxQty: number }[] = [
  { id: "sp-headlight", name: "ヘッドライト",       price: 25000, maxQty: 1 },
  { id: "sp-b-pillar",  name: "Bピラー",           price: 15000, maxQty: 1 },
  { id: "sp-c-pillar",  name: "Cピラー",           price: 15000, maxQty: 1 },
  { id: "sp-mirror",    name: "ドアミラー",         price: 12000, maxQty: 1 },
  { id: "sp-step",      name: "サイドステップ",     price: 18000, maxQty: 1 },
  { id: "sp-rear-bump", name: "リアバンパー",       price: 20000, maxQty: 1 },
  { id: "sp-door-cup",  name: "ドアカップ（1枚）", price:  3000, maxQty: 6 },
];
