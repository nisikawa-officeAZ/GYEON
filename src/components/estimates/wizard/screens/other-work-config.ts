// Estimate Wizard Ver2.2 — Other Work presentation configuration (Phase 4G).
//
// EXAMPLE preset items for the preview only — production presets come from Store Settings
// through props. Fully manual custom rows require no registration. NO price calculation.
// `estimatedDurationMinutes` is internal (future calendar/workload) and NEVER displayed on
// the Estimate UI. Do not treat this list as a fixed/hardcoded catalog.

import type { OtherWorkPresetItem } from "./step-types";

export const EXAMPLE_OTHER_WORK_PRESETS: OtherWorkPresetItem[] = [
  { id: "ow-travel",   name: "出張費",         description: "出張施工の交通費", defaultPrice: 5000,  displayOrder: 1, editableUnitPrice: true },
  { id: "ow-disposal", name: "廃材処理",       description: "廃材・廃液処理費", defaultPrice: 3000,  displayOrder: 2 },
  { id: "ow-parts",    name: "部品代",         description: "使用部品",         defaultPrice: 2000,  displayOrder: 3, editableUnitPrice: true, quantityRequired: true, minQty: 1, maxQty: 20, unitLabel: "個" },
  { id: "ow-repair",   name: "特殊補修",       description: "特殊な補修作業",   defaultPrice: 12000, displayOrder: 4, editableUnitPrice: true },
  { id: "ow-labor",    name: "追加作業工賃",   description: "カスタム工賃",     defaultPrice: 8000,  displayOrder: 5, editableUnitPrice: true, unitLabel: "時間", quantityRequired: true, minQty: 1 },
];
