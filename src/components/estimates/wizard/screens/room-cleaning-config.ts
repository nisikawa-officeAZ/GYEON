// Estimate Wizard Ver2.2 — Room Cleaning presentation configuration (Phase 4F).
//
// EXAMPLE menus for the preview only — production menus come from Store Settings through
// props. NO price calculation. `estimatedDurationMinutes` is included in the data contract
// for future reservation/calendar workload calculation but is NEVER displayed on the
// Estimate UI. Do not treat this list as a fixed/hardcoded catalog.

import type { RoomMenu } from "./step-types";

export const EXAMPLE_ROOM_MENUS: RoomMenu[] = [
  { id: "room-interior", name: "車内クリーニング",         description: "車内全体の清掃",   defaultPrice: 12000, estimatedDurationMinutes: 90,  displayOrder: 1 },
  { id: "room-seat",     name: "シートクリーニング",       description: "座席の洗浄",       defaultPrice: 15000, estimatedDurationMinutes: 120, displayOrder: 2 },
  { id: "room-leather",  name: "レザークリーニング",       description: "本革シートケア",   defaultPrice: 18000, estimatedDurationMinutes: 120, displayOrder: 3 },
  { id: "room-ceiling",  name: "天井クリーニング",         description: "天井（ルーフ）清掃", defaultPrice: 10000, estimatedDurationMinutes: 90,  displayOrder: 4 },
  { id: "room-carpet",   name: "カーペットクリーニング",   description: "フロアカーペット洗浄", defaultPrice: 12000, estimatedDurationMinutes: 90,  displayOrder: 5 },
  { id: "room-deodor",   name: "消臭・除菌",               description: "消臭・除菌施工",     defaultPrice: 8000,  estimatedDurationMinutes: 45,  displayOrder: 6 },
  { id: "room-premium",  name: "プレミアムルームクリーニング", description: "上位フル車内清掃", defaultPrice: 40000, estimatedDurationMinutes: 240, displayOrder: 7, badge: "おすすめ" },
];
