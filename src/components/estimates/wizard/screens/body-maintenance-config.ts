// Estimate Wizard Ver2.2 — Body Regular Maintenance presentation configuration (Phase 4D).
//
// EXAMPLE menus for the preview only — production menus come from Store Settings through
// props. NO price calculation. `estimatedDurationMinutes` is included in the data contract
// for future reservation/calendar workload calculation but is NEVER displayed on the
// Estimate UI (Architect #3). Do not treat this list as a fixed/hardcoded catalog.

import type { MaintenanceMenu } from "./step-types";

export const EXAMPLE_MAINTENANCE_MENUS: MaintenanceMenu[] = [
  { id: "maint-6m",      name: "6か月メンテナンス",        description: "半年ごとの基本メンテナンス", defaultPrice: 8000,  estimatedDurationMinutes: 60,  displayOrder: 1 },
  { id: "maint-12m",     name: "12か月メンテナンス",       description: "年次の点検・保護施工",       defaultPrice: 15000, estimatedDurationMinutes: 120, displayOrder: 2 },
  { id: "maint-coating", name: "コーティング定期メンテナンス", description: "コーティング被膜のリフレッシュ", defaultPrice: 25000, estimatedDurationMinutes: 150, displayOrder: 3 },
  { id: "maint-light",   name: "ライトメンテナンス",        description: "簡易メンテナンス",           defaultPrice: 5000,  estimatedDurationMinutes: 30,  displayOrder: 4 },
  { id: "maint-premium", name: "プレミアムメンテナンス",    description: "上位フルメンテナンス",       defaultPrice: 40000, estimatedDurationMinutes: 240, displayOrder: 5, badge: "おすすめ" },
];
