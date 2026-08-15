// Estimate Wizard Ver2.2 — Car Wash presentation configuration (Phase 4E).
//
// EXAMPLE menus for the preview only — production menus come from Store Settings through
// props. NO price calculation. `estimatedDurationMinutes` is included in the data contract
// for future reservation workload calculation but is NEVER displayed on the Estimate UI.
// Do not treat this list as a fixed/hardcoded catalog.

import type { WashMenu } from "./step-types";

export const EXAMPLE_WASH_MENUS: WashMenu[] = [
  { id: "wash-hand",       name: "手洗い洗車",     description: "丁寧な手洗い", defaultPrice: 3000,  estimatedDurationMinutes: 40, displayOrder: 1 },
  { id: "wash-premium",    name: "プレミアム洗車", description: "上位フル洗車", defaultPrice: 8000,  estimatedDurationMinutes: 90, displayOrder: 2, badge: "おすすめ" },
  { id: "wash-pure",       name: "純水洗車",       description: "純水仕上げ",   defaultPrice: 5000,  estimatedDurationMinutes: 50, displayOrder: 3 },
  { id: "wash-hydrophobic", name: "撥水洗車",      description: "撥水コート付き", defaultPrice: 6000, estimatedDurationMinutes: 60, displayOrder: 4 },
  { id: "wash-maint",      name: "メンテナンス洗車", description: "定期メンテ洗車", defaultPrice: 4000, estimatedDurationMinutes: 45, displayOrder: 5 },
];
