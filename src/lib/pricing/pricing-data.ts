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
