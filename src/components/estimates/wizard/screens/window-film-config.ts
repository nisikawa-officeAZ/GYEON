// Estimate Wizard Ver2.2 — Window Film presentation configuration (Phase 4C).
//
// Default labels/structure ONLY — NO price calculation. Installation areas are the eight
// approved areas. Film types are STORE-CONFIGURABLE and are NOT hardcoded as a fixed
// product catalog; the list below is an EXAMPLE used only to seed the preview (brands,
// VLT, heat rejection, color and default price all come from Store Settings in production
// and may include custom/non-GYEON brands).

import type { WindowAreaOption, FilmTypeOption } from "./step-types";

/** Eight approved installation areas (store may enable/disable/reorder). */
export const DEFAULT_WINDOW_AREAS: WindowAreaOption[] = [
  { id: "front-windshield", label: "フロントガラス" },
  { id: "front-side",       label: "フロント左右" },
  { id: "rear-side",        label: "リア左右" },
  { id: "rear-window",      label: "リアガラス" },
  { id: "sunroof",          label: "サンルーフ" },
  { id: "quarter",          label: "三角窓（クォーター）" },
  { id: "full",             label: "全面施工" },
  { id: "other",            label: "その他" },
];

/** EXAMPLE film types for the preview only (production comes from Store Settings). */
export const EXAMPLE_FILM_TYPES: FilmTypeOption[] = [
  { id: "standard", label: "スタンダード", brand: "GYEON", vlt: "15%", heatRejection: "遮熱 60%", color: "スモーク",   defaultUnitPrice: 25000 },
  { id: "ir-cut",   label: "IRカット",     brand: "GYEON", vlt: "20%", heatRejection: "遮熱 90%", color: "ニュートラル", defaultUnitPrice: 38000 },
  { id: "carbon",   label: "カーボン",     brand: "GYEON", vlt: "5%",  heatRejection: "遮熱 85%", color: "ブラック",   defaultUnitPrice: 42000 },
  { id: "clear-uv", label: "クリアUV",     brand: "GYEON", vlt: "80%", heatRejection: "遮熱 50%", color: "クリア",     defaultUnitPrice: 20000 },
];
