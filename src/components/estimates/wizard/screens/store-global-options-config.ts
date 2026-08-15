// Estimate Wizard Ver2.2 — Store Global Options presentation configuration (Phase 4H).
//
// EXAMPLE global options (追加サービスオプション) for the PREVIEW only — production options
// come from each store's Store Settings through props. A store can later add / edit / remove
// options, change prices / display order, enable / disable, and define which service
// categories each option applies to. Applicability is data-driven here (applicableCategoryIds
// / appliesToAllCategories) — NOT hardcoded. NO price calculation. `estimatedDurationMinutes`
// is internal (future calendar/workload) and is NEVER displayed on the Estimate UI. Do not
// treat this list as a fixed catalog.

import type { StoreGlobalOption } from "./step-types";

export const EXAMPLE_STORE_GLOBAL_OPTIONS: StoreGlobalOption[] = [
  {
    id: "gopt-iron",
    name: "鉄粉除去",
    description: "鉄粉除去（下地処理）",
    defaultPrice: 8000,
    editableUnitPrice: true,
    displayOrder: 1,
    applicableCategoryIds: ["coating", "ppf"],
    estimatedDurationMinutes: 60,
    badge: "下地",
  },
  {
    id: "gopt-hardpolish",
    name: "ハードポリッシュ",
    description: "深い傷向けの研磨",
    defaultPrice: 30000,
    editableUnitPrice: true,
    displayOrder: 2,
    applicableCategoryIds: ["coating"],
    estimatedDurationMinutes: 180,
  },
  {
    id: "gopt-scratch",
    name: "傷補修",
    description: "小傷・線傷の補修",
    defaultPrice: 12000,
    editableUnitPrice: true,
    quantityRequired: true,
    minQty: 1,
    maxQty: 20,
    unitLabel: "箇所",
    displayOrder: 3,
    applicableCategoryIds: ["coating", "ppf", "other"],
    estimatedDurationMinutes: 45,
  },
  {
    id: "gopt-headlight",
    name: "ヘッドライトリペア",
    description: "ヘッドライトの黄ばみ除去・保護",
    defaultPrice: 15000,
    editableUnitPrice: true,
    displayOrder: 4,
    applicableCategoryIds: ["coating", "ppf", "other"],
    estimatedDurationMinutes: 60,
  },
  {
    id: "gopt-touchpen",
    name: "タッチペン",
    description: "部分タッチアップ",
    defaultPrice: 3000,
    editableUnitPrice: true,
    quantityRequired: true,
    minQty: 1,
    unitLabel: "箇所",
    displayOrder: 5,
    appliesToAllCategories: true,
    estimatedDurationMinutes: 20,
  },
];
