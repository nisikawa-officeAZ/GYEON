// Estimate Wizard Ver2.2 — Window Film presentation configuration (Phase 4C).
//
// Default labels/structure ONLY — NO price calculation. Installation areas are the eight
// approved areas. Film types are STORE-CONFIGURABLE and are NOT hardcoded as a fixed
// product catalog; the list below is an EXAMPLE used only to seed the preview (brands,
// VLT, heat rejection, color and default price all come from Store Settings in production
// and may include custom/non-GYEON brands).

import type { WindowAreaOption, FilmTypeOption } from "./step-types";

/** Seven canonical installation areas (C2B2A ruling — store may enable/disable/reorder).
 *  triangular-window and quarter-glass are DISTINCT concepts and distinct buttons/state values;
 *  the legacy merged `quarter` and the ambiguous front-side/rear-side/rear-window/full/other ids
 *  are retired and no longer emitted. */
export const DEFAULT_WINDOW_AREAS: WindowAreaOption[] = [
  { id: "front-windshield",  label: "フロントガラス" },
  { id: "front-door-glass",  label: "フロントドアガラス" },
  { id: "rear-door-glass",   label: "リアドアガラス" },
  { id: "triangular-window", label: "三角窓" },
  { id: "quarter-glass",     label: "クォーターガラス" },
  { id: "rear-glass",        label: "リアガラス（リアハッチ）" },
  { id: "sunroof",           label: "サンルーフ" },
];

/** EXAMPLE film types for the preview only (production comes from Store Settings). */
export const EXAMPLE_FILM_TYPES: FilmTypeOption[] = [
  { id: "standard", label: "スタンダード", brand: "GYEON", vlt: "15%", heatRejection: "遮熱 60%", color: "スモーク",   defaultUnitPrice: 25000 },
  { id: "ir-cut",   label: "IRカット",     brand: "GYEON", vlt: "20%", heatRejection: "遮熱 90%", color: "ニュートラル", defaultUnitPrice: 38000 },
  { id: "carbon",   label: "カーボン",     brand: "GYEON", vlt: "5%",  heatRejection: "遮熱 85%", color: "ブラック",   defaultUnitPrice: 42000 },
  { id: "clear-uv", label: "クリアUV",     brand: "GYEON", vlt: "80%", heatRejection: "遮熱 50%", color: "クリア",     defaultUnitPrice: 20000 },
];
