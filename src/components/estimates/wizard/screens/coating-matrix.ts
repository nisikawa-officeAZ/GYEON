// Estimate Wizard Ver2.2 — coating matrix as PRESENTATION configuration (Phase 4A).
//
// This is availability/label configuration ONLY — it computes NO prices and creates NO
// estimate line items. It expresses the approved Ver2.2 coating layer matrix (which
// products are selectable for layer 1/2/3 given the shop rank and the chosen first-layer
// product). The owner / preview uses these helpers to derive the `availableLayerN`
// product lists passed as props into <CoatingSelector/>, which itself stays purely
// prop-driven. No pricing / business logic.

import type { CoatingProductOption, ShopRank } from "./step-types";

/** Product id → operator-facing label (exact wording, do not translate). */
export const COATING_PRODUCT_LABELS: Record<string, string> = {
  "one-evo":          "Q² ONE EVO",
  "cancoat-evo":      "Q² CANCOAT EVO",
  "pure-evo":         "Q² PURE EVO",
  "mohs-evo":         "Q² MOHS EVO",
  "syncro-evo":       "Q² SYNCRO EVO",
  "matte-evo":        "Q² MATTE EVO",
  "infinite-base-1":  "Q² INFINITE BASE TYPE 1",
  "infinite-base-2":  "Q² INFINITE BASE TYPE 2",
  "infinite-top-1":   "Q² INFINITE TOPCOAT TYPE 1",
  "infinite-top-2":   "Q² INFINITE TOPCOAT TYPE 2",
};

/** First-layer products available per shop rank. ppf_installer = coating locked (none). */
const FIRST_LAYER_BY_RANK: Record<ShopRank, string[]> = {
  shop:          ["one-evo", "cancoat-evo"],
  detailer:      ["one-evo", "pure-evo", "mohs-evo", "syncro-evo", "matte-evo"],
  certified:     ["one-evo", "pure-evo", "mohs-evo", "syncro-evo", "matte-evo", "infinite-base-1", "infinite-base-2"],
  ppf_installer: [],
};

/** Second-layer options keyed by the chosen first-layer product (approved matrix). */
const LAYER2_BY_FIRST: Record<string, string[]> = {
  "one-evo":         ["one-evo", "cancoat-evo"],
  "pure-evo":        ["pure-evo", "cancoat-evo"],
  "mohs-evo":        ["mohs-evo", "cancoat-evo"],
  "matte-evo":       ["matte-evo"],
  "syncro-evo":      ["mohs-evo"], // SYNCRO is a default multi-layer system; only MOHS may be added
  "infinite-base-1": ["infinite-base-1", "infinite-top-1", "infinite-top-2"],
  "infinite-base-2": ["infinite-base-2", "infinite-top-1", "infinite-top-2"],
};

/** Third-layer options keyed by the chosen first-layer product (approved matrix). */
const LAYER3_BY_FIRST: Record<string, string[]> = {
  "one-evo":         ["cancoat-evo"],
  "pure-evo":        ["cancoat-evo"],
  "mohs-evo":        ["cancoat-evo"],
  "infinite-base-1": ["infinite-top-1", "infinite-top-2"],
  "infinite-base-2": ["infinite-top-1", "infinite-top-2"],
  // matte-evo / syncro-evo: no approved 3rd layer → layer-3 control disabled
};

function toOptions(ids: string[]): CoatingProductOption[] {
  return ids.map((id) => ({ id, label: COATING_PRODUCT_LABELS[id] ?? id }));
}

/** Whether the given shop rank can perform coating at all (ppf_installer cannot). */
export function isCoatingAvailableForRank(rank: ShopRank): boolean {
  return FIRST_LAYER_BY_RANK[rank].length > 0;
}

export function firstLayerOptions(rank: ShopRank): CoatingProductOption[] {
  return toOptions(FIRST_LAYER_BY_RANK[rank]);
}

export function secondLayerOptions(firstLayerId: string | null): CoatingProductOption[] {
  return firstLayerId ? toOptions(LAYER2_BY_FIRST[firstLayerId] ?? []) : [];
}

export function thirdLayerOptions(firstLayerId: string | null): CoatingProductOption[] {
  return firstLayerId ? toOptions(LAYER3_BY_FIRST[firstLayerId] ?? []) : [];
}
